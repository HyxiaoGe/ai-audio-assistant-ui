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
  refresh as sdkRefresh,
} from "auth-client-web"

import { configureAuth } from "@/lib/auth-sdk"
import { clearSsoReturn, isSafeReturnPath, markLoggedOut, takeSsoReturnPath } from "@/lib/sso-probe"

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
  revalidateToken: () => Promise<string | null>
  checkLiveness: () => Promise<void>
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

/**
 * userinfo 失败是否为「服务端明确拒绝」(401 未授权 / 403 禁止)——即别处已登出 / 令牌被吊销,
 * 应登出。SDK 抛出形如 "auth-client-web: userinfo failed (401)" 的 Error;仅当能确凿识别出
 * 401/403 时返回 true。任何含糊(网络中断 / 5xx / 解析异常)一律返回 false → 保持登录,把误登出
 * 风险压到零(漏判由下一次正常 API 请求的 401 或 token 过期兜底)。
 */
function isAuthRejection(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /\b40[13]\b/.test(msg)
}

export const useAuthStore = create<AuthState>((set, get) => ({
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

  revalidateToken: async () => {
    configureAuth()
    // 强制服务端往返(轮换)的取 token 路径。现仅供 api-client 的 401 重试使用:某个受保护请求
    // 被服务端拒为 401(本地 access token 已被别处轮换 / 吊销 / 时钟偏移),必须 sdkRefresh() 拿到
    // 服务端当前有效的(轮换后)新票再重试——不能信 getAccessToken 的本地缓存(会拿回刚被拒的同一
    // 张票、重试必再 401)。注意:focus/可见性的存活校验【不再】走这里(那会每切标签轮换一次 refresh
    // token、在慢隧道下引发失同步被动登出),改用只读的 checkLiveness。
    // 语义:refresh 定论失败返回 null(SDK 已清会话)→ 同步翻未登录;会话仍在则返回轮换后新票;
    // 瞬时网络故障 throw → 绝不登出(与 getAccessToken 同一套)。
    try {
      const token = await sdkRefresh()
      if (token === null) {
        set({ user: null, status: "unauthenticated" })
      }
      return token
    } catch {
      return null
    }
  },

  checkLiveness: async () => {
    configureAuth()
    // 已登出 / 加载中无需探测(无 token 可验,且避免与首屏静默探测竞态)
    if (get().status !== "authenticated") return
    // 只读单点登出探测——【绝不轮换 refresh token】。由 focus/可见性恢复与低频定时器触发:
    // 取本地 access token(sdkGetAccessToken 仅临期才刷),再打一次 auth-service 的 denylist 受
    // 保护端点 userinfo。别处登出后这张 access token 签名仍有效、但被服务端吊销标记拒为 401 →
    // 据此登出。瞬时网络 / 5xx / 解析失败一律保持登录(宁可漏判一轮也绝不因抖动误登出——漏判由
    // 下一次正常 API 请求的 401 或 token 过期兜住)。覆盖「纯播放 / 纯 SSE 页长时间不发受保护请求」
    // 的 SLO 盲区:scoped media 短票不查 denylist,否则别处登出最坏要等到 token 过期才被感知。
    let token: string | null
    try {
      token = await sdkGetAccessToken()
    } catch {
      return // 瞬时故障:保持现状,不登出
    }
    if (token === null) {
      set({ user: null, status: "unauthenticated" }) // 定论失败(刷新被拒 / 无票)
      return
    }
    try {
      await sdkFetchUserInfo(token)
    } catch (err) {
      if (isAuthRejection(err)) {
        set({ user: null, status: "unauthenticated" })
      }
      // 否则瞬时:保持登录
    }
  },

  logout: async () => {
    configureAuth()
    // 先落登出守卫：即便随后撤销/清理抛错，也保证登出后本标签页不被静默重新登入
    //（IdP 会话仍在，无守卫会被立刻 SSO 回去；这道守卫连「手动刷新放行重探」也一并拦死）。
    markLoggedOut()
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
