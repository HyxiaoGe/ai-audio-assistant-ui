/**
 * 应用加载时的一次性静默 SSO 探测（P3.2b）。
 *
 * 若本地无 token，顶层跳转到 auth-service 的 /auth/authorize?prompt=none：存在 IdP 会话则
 * 静默签发授权码（无 UI，跨应用免登）；无会话则原样带回 login_required（由回调页软回到原页）。
 *
 * 关键不变量：
 *  - 每个标签页至多探测一次（PROBED 守卫在跳转前同步落库，回来后阻止再探，杜绝重定向死循环）。
 *  - 探测前记下原始路径（RETURN），HIT/MISS 都据此回到用户本来要去的页面。
 *  - 回调换码期间（/auth/callback）绝不探测，避免冲掉正在进行的换码。
 *  - sessionStorage 不可用时直接放弃探测（失败保守，绝不冒死循环风险）。
 *  - 登出调用 markSsoProbed() 落守卫，防止登出后被静默重新登入。
 */

import { silentLogin as sdkSilentLogin } from "auth-client-web"

import { configureAuth } from "@/lib/auth-sdk"

const PROBED_KEY = "audio_sso_probed"
const RETURN_KEY = "audio_sso_return"
const ACCESS_TOKEN_KEY = "auth_access_token"
const CALLBACK_PATH = "/auth/callback"

function session(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null
  } catch {
    return null
  }
}

/** 落「已探测/勿探测」守卫——登出时调用以阻止登出后被静默重新登入。 */
export function markSsoProbed(): void {
  try {
    session()?.setItem(PROBED_KEY, "1")
  } catch {
    // ignore
  }
}

/** 读取并清除探测前记下的原始路径（HIT/MISS 均据此回到原页）。 */
export function takeSsoReturnPath(): string | null {
  const s = session()
  if (!s) return null
  try {
    const v = s.getItem(RETURN_KEY)
    if (v) s.removeItem(RETURN_KEY)
    return v
  } catch {
    return null
  }
}

/**
 * 清除残留的原始路径——交互式登录开始时调用：一个被放弃的静默探测会留下 RETURN_KEY，
 * 若不清，后续交互式登录的回调会读到它并把用户带到错误的目标页（劫持重定向）。
 */
export function clearSsoReturn(): void {
  try {
    session()?.removeItem(RETURN_KEY)
  } catch {
    // ignore
  }
}

/**
 * 满足条件时发起一次静默 SSO 探测；返回 true 表示已发起（页面正在跳走）。
 * 条件：无本地 token、本标签页未探测过、当前不在回调路径、sessionStorage 可用。
 */
export function maybeSilentLogin(currentPath: string): boolean {
  if (typeof window === "undefined") return false
  const s = session()
  if (!s) return false // 无 sessionStorage → 保守放弃，绝不死循环
  if (currentPath.startsWith(CALLBACK_PATH)) return false // 换码进行中，勿探测

  let probed: string | null
  let token: string | null
  try {
    probed = s.getItem(PROBED_KEY)
    token = window.localStorage.getItem(ACCESS_TOKEN_KEY)
  } catch {
    return false
  }
  if (probed) return false // 本标签页已探测过
  if (token) return false // 已有本地会话

  // 跳转前同步落守卫 + 原始路径（sessionStorage 同步写入，跨这次顶层跳转存活）
  try {
    s.setItem(PROBED_KEY, "1")
    s.setItem(RETURN_KEY, currentPath)
  } catch {
    return false
  }

  configureAuth()
  void sdkSilentLogin()
  return true
}
