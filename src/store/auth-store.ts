/**
 * Auth Store — 认证状态层。
 *
 * P3.2：token 的获取/刷新/换码/登出「机制」全部委托给共享 SDK auth-client-web
 * （登录走 /auth/authorize 带 PKCE + state；回调走 handleCallback 校验 state；刷新有
 * 合流 + 轮转）。本 store 退化为「audio 形态的 {user,status} 真相源」+ SDK↔audio 用户
 * 形态映射（SDK 的 avatarUrl → audio 的 avatar_url）。SDK 通过 configureAuth 绑定到本
 * store 历史使用的 localStorage 键，故为零登出迁移。
 */

import { create } from "zustand"
import {
  fetchUserInfo as sdkFetchUserInfo,
  getAccessToken as sdkGetAccessToken,
  handleCallback as sdkHandleCallback,
  login as sdkLogin,
  logout as sdkLogout,
} from "auth-client-web"

import { configureAuth } from "@/lib/auth-sdk"
import { clearSsoReturn, isSafeReturnPath, markSsoProbed, takeSsoReturnPath } from "@/lib/sso-probe"

const ACCESS_TOKEN_KEY = "auth_access_token"
const USER_INFO_KEY = "auth_user_info"

export interface AuthUserPreferences {
  locale: string
  timezone: string
  theme: string
}

export interface AuthUser {
  id: string
  email: string
  name: string
  avatar_url?: string
  is_superuser: boolean
  preferences: AuthUserPreferences
}

const DEFAULT_PREFERENCES: AuthUserPreferences = {
  locale: "zh",
  timezone: "Asia/Shanghai",
  theme: "system",
}

interface AuthState {
  user: AuthUser | null
  status: "loading" | "authenticated" | "unauthenticated"

  // Actions
  initialize: () => Promise<void>
  completeLogin: () => Promise<{ ok: boolean; redirectPath: string; error?: string }>
  getAccessToken: () => Promise<string | null>
  logout: () => Promise<void>
}

function getStored(key: string): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(key)
}

function setStored(key: string, value: string): void {
  if (typeof window === "undefined") return
  localStorage.setItem(key, value)
}

/**
 * 偏好按字段归一：present 且为 string 的字段保留，缺失/类型不符的字段单独填默认。
 * 不能「缺一个字段就把整组偏好替换成默认」——那会丢掉用户真实的 locale/timezone。
 */
function normalizePreferences(raw: unknown): AuthUserPreferences {
  const v = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {}
  return {
    locale: typeof v.locale === "string" ? v.locale : DEFAULT_PREFERENCES.locale,
    timezone: typeof v.timezone === "string" ? v.timezone : DEFAULT_PREFERENCES.timezone,
    theme: typeof v.theme === "string" ? v.theme : DEFAULT_PREFERENCES.theme,
  }
}

/**
 * 把任意来源的用户对象归一化为 audio 的 AuthUser：SDK 形态用 avatarUrl、audio 历史缓存
 * 形态用 avatar_url，两者都容忍；缺失字段给安全默认；id 一律强制为字符串。
 */
export function normalizeUser(raw: Record<string, unknown>): AuthUser {
  const avatar =
    typeof raw.avatar_url === "string"
      ? raw.avatar_url
      : typeof raw.avatarUrl === "string"
        ? raw.avatarUrl
        : undefined
  return {
    id: String(raw.id ?? ""),
    email: typeof raw.email === "string" ? raw.email : "",
    name: typeof raw.name === "string" ? raw.name : "",
    avatar_url: avatar,
    is_superuser: raw.is_superuser === true,
    preferences: normalizePreferences(raw.preferences),
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: "loading",

  initialize: async () => {
    configureAuth()

    if (!getStored(ACCESS_TOKEN_KEY)) {
      set({ user: null, status: "unauthenticated" })
      return
    }

    // 先用缓存即时上屏；记下缓存用户，后续遇到瞬时网络故障时据此保持已登录
    let cachedUser: AuthUser | null = null
    const cached = getStored(USER_INFO_KEY)
    if (cached) {
      try {
        cachedUser = normalizeUser(JSON.parse(cached))
        set({ user: cachedUser, status: "authenticated" })
      } catch {
        // ignore parse errors
      }
    }

    // 校验/刷新 token。SDK 语义：定论失败（无 refresh token / 轮转被拒）返回 null 且已清空其
    // 自身会话；瞬时网络故障则 throw。两者必须区别对待——瞬时故障不能把用户登出。
    let token: string | null
    try {
      token = await sdkGetAccessToken()
    } catch {
      // 瞬时故障此刻无法校验：有缓存用户就维持已登录（真过期时下次 API 调用会触发 401 重认证）；
      // 无可展示用户则落到未登录。
      if (!cachedUser) set({ user: null, status: "unauthenticated" })
      return
    }
    if (token === null) {
      set({ user: null, status: "unauthenticated" })
      return
    }

    // token 有效 → 拉最新 userinfo 富化；userinfo 仅瞬时失败时不应把有效会话登出
    const sdkUser = await sdkFetchUserInfo(token).catch(() => null)
    if (sdkUser) {
      const user = normalizeUser(sdkUser as unknown as Record<string, unknown>)
      setStored(USER_INFO_KEY, JSON.stringify(user))
      set({ user, status: "authenticated" })
    } else if (cachedUser) {
      // token 有效但 userinfo 瞬时失败 → 保持缓存用户的已登录态
      set({ user: cachedUser, status: "authenticated" })
    } else {
      // token 有效但既无最新 userinfo 也无缓存可展示 → 无法呈现用户
      set({ user: null, status: "unauthenticated" })
    }
  },

  completeLogin: async () => {
    configureAuth()
    const result = await sdkHandleCallback()
    // 若本次回调源自静默探测，取回探测前记下的原始路径（HIT/MISS 都回到此处）。
    // 消费端再独立校验一次开放重定向：不安全（站外/协议相对）路径直接丢弃回退，
    // 与探测落库端的校验形成纵深防御——绝不把站外路径喂给 router.replace。
    const rawReturn = takeSsoReturnPath()
    const silentReturn = rawReturn && isSafeReturnPath(rawReturn) ? rawReturn : null

    if (result.status === "authenticated") {
      const user = normalizeUser(result.user as unknown as Record<string, unknown>)
      setStored(USER_INFO_KEY, JSON.stringify(user))
      set({ user, status: "authenticated" })
      return { ok: true, redirectPath: silentReturn || result.redirectPath || "/tasks" }
    }

    set({ user: null, status: "unauthenticated" })
    const error = result.status === "unauthenticated" ? result.error : "no_callback"
    // 静默探测未命中（login_required）：软回到原页，不强制 /login（audio 是软门禁，未登录也可浏览）
    if (error === "login_required" && silentReturn) {
      return { ok: false, redirectPath: silentReturn, error }
    }
    return { ok: false, redirectPath: "/login", error }
  },

  getAccessToken: async () => {
    configureAuth()
    try {
      const token = await sdkGetAccessToken()
      if (token === null) {
        // 定论失败：SDK 已清空自身会话 → 同步反映到 audio 自己的 store（两者非同一 store）
        set({ user: null, status: "unauthenticated" })
      }
      return token
    } catch {
      // 瞬时网络故障：不要登出，只让这次取 token 失败（调用方据 null 跳过重试）
      return null
    }
  },

  logout: async () => {
    configureAuth()
    // 先落探测守卫：即便随后撤销/清理抛错，也保证登出后本标签页不被静默重新登入
    //（IdP 会话仍在，无守卫会被立刻 SSO 回去）。
    markSsoProbed()
    // 媒体短票先失效再翻转登录态：避免登出瞬间仍有组件用旧票拼出媒体 URL（同浏览器换号
    // 后旧票会被后端归属校验拒为 404）。动态 import 规避与 api-client 的静态循环依赖。
    await import("@/lib/media-ticket").then((m) => m.clearMediaTicket()).catch(() => {})
    // 全局单点登出：本地清理后由 SDK 顶层表单 POST 到 /auth/logout 销毁共享 IdP 会话，
    // 做到「一处登出、处处登出」（否则只撤销本应用 token，IdP 会话仍在、会被静默重登）。
    // 撤销是 best-effort：失败不能阻断本地登出，否则用户卡在已登录态。
    try {
      await sdkLogout({ global: true })
    } catch {
      // ignore: 本地清理在下方无条件执行
    }
    set({ user: null, status: "unauthenticated" })
  },
}))

// ── OAuth 登录入口（顶层跳转 /auth/authorize，带 PKCE + state）────────────────
// 交互式登录前清掉残留的静默探测原始路径，避免被放弃的探测劫持本次登录的重定向目标。
export function loginWithGoogle(redirectPath: string = "/tasks") {
  configureAuth()
  clearSsoReturn()
  void sdkLogin("google", { redirectPath })
}

export function loginWithGitHub(redirectPath: string = "/tasks") {
  configureAuth()
  clearSsoReturn()
  void sdkLogin("github", { redirectPath })
}
