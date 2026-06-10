/**
 * 应用加载时的静默 SSO 探测（P3.2b）。
 *
 * 若本地无 token，顶层跳转到 auth-service 的 /auth/authorize?prompt=none：存在 IdP 会话则
 * 静默签发授权码（无 UI，跨应用免登）；无会话则原样带回 login_required（由回调页软回到原页）。
 *
 * 关键不变量（两道守卫各管一摊，刻意拆成两个键，不再共用一个）：
 *  - 每标签页默认只探一次（PROBED 去重守卫在跳转前同步落库，回来后阻止再探，杜绝重定向死循环）。
 *    例外：用户「真·手动刷新」（performance navigation type === "reload"，见 isReload）放行再探一次——
 *    这样在别处（如 fusion）登录后切回本页刷新即可补登；而自动跳转返回那一圈是 "navigate"、永远进
 *    不来，死循环重新引入不了。sessionStorage 跨刷新存活，故纯布尔守卫本会把刷新也一并拦死——这正是
 *    之前「登了 fusion、刷新 audio 也不自动登」的根因，reload 放行即为修复。
 *  - 显式登出另有一道 LOGGED_OUT 守卫（markLoggedOut，登出时落）：它连「reload 再探」也一并拦死，
 *    保证「一处登出后即便 IdP 会话仍在、刷新本页也绝不被静默登回去」。登出守卫与去重守卫互不影响。
 *  - 探测前记下原始路径（RETURN），HIT/MISS 都据此回到用户本来要去的页面。
 *  - 回调换码期间（/auth/callback）绝不探测，避免冲掉正在进行的换码。
 *  - sessionStorage 不可用时直接放弃探测（失败保守，绝不冒死循环风险）。
 */

import { silentLogin as sdkSilentLogin } from "auth-client-web"

import { configureAuth } from "@/lib/auth-sdk"

const PROBED_KEY = "audio_sso_probed" // 探测去重：每标签一次；但真·手动刷新（reload）放行再探
const LOGGED_OUT_KEY = "audio_sso_logged_out" // 显式登出守卫：reload 也不绕过，绝不自动重登
const RETURN_KEY = "audio_sso_return"
const ACCESS_TOKEN_KEY = "auth_access_token"
const CALLBACK_PATH = "/auth/callback"
const PUBLIC_PATH_PREFIXES = ["/explore"]

function session(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null
  } catch {
    return null
  }
}

/**
 * 本次页面加载是不是用户「真·手动刷新」(F5/Cmd-R)。
 *
 * 静默探测的整个往返——顶层跳到 /authorize、auth-service 302 跳回、回调页 router.replace 回原页
 * ——在浏览器里都算 "navigate"；只有显式刷新才是 "reload"。据此让「刷新补探」放行，而自动跳转那一圈
 * 永远进不来，不会把重定向死循环放回来。拿不到导航类型的环境（老浏览器/SSR）保守按「非 reload」，
 * 退回原本的「每标签一次」行为。
 */
function isReload(): boolean {
  try {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined
    return nav?.type === "reload"
  } catch {
    return false
  }
}

/**
 * 回跳路径是否为安全的同源相对路径。
 *
 * 防客户端开放重定向（CWE-601）：探测前的原始路径取自 `window.location.pathname`，
 * 浏览器不会折叠前导双斜杠——访问 `https://app//evil.com` 时 pathname 字面就是
 * `//evil.com`，`new URL("//evil.com", origin).origin` 会解析成站外，喂给 router.replace
 * 即跳出本站。要求：去掉反斜杠歧义（`/\` 在部分浏览器等价于 `//`）后，必须是单个前导斜杠。
 */
export function isSafeReturnPath(path: string): boolean {
  return /^\/(?!\/)/.test(path.replace(/\\/g, "/"))
}

/**
 * 落「已登出 / 勿自动重登」守卫——登出时调用。
 *
 * 即便 IdP 会话仍在、用户随后刷新本页，也绝不被静默登回去：这道守卫连 maybeSilentLogin 里
 * 「reload 放行重探」都一并拦死，与每标签去重的 PROBED 守卫分属两个键、互不影响。
 */
export function markLoggedOut(): void {
  try {
    session()?.setItem(LOGGED_OUT_KEY, "1")
  } catch {
    // ignore
  }
}

/**
 * 探测前记下的原始路径是否还在（peek，不消费）。
 *
 * 回调页据此区分两种落到 /auth/callback 的来源：本次有 RETURN ⇒ 是「静默探测中转」
 *（用户只是刷新了已登录页，并未主动发起登录）⇒ 渲染中性加载态，绝不显示「登录中」误导文案；
 * 无 RETURN ⇒ 是用户主动发起的交互式登录 ⇒ 正常显示「登录中」。消费仍由 takeSsoReturnPath 负责。
 */
export function hasPendingSsoReturn(): boolean {
  try {
    return session()?.getItem(RETURN_KEY) != null
  } catch {
    return false
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

  // 公开探索路由:匿名浏览是产品功能本身,绝不在这里发起静默 SSO 跳转打断浏览
  if (PUBLIC_PATH_PREFIXES.some((prefix) => currentPath.startsWith(prefix))) return false

  let loggedOut: string | null
  let probed: string | null
  let token: string | null
  try {
    loggedOut = s.getItem(LOGGED_OUT_KEY)
    probed = s.getItem(PROBED_KEY)
    token = window.localStorage.getItem(ACCESS_TOKEN_KEY)
  } catch {
    return false
  }
  if (token) return false // 已有本地会话
  if (loggedOut) return false // 显式登出过：绝不自动重登（刷新也不绕过）
  if (probed && !isReload()) return false // 本标签已探过；仅「真·手动刷新」放行再探一次

  // 跳转前同步落守卫 + 原始路径（sessionStorage 同步写入，跨这次顶层跳转存活）。
  // 落库端先把站外/协议相对路径挡回 "/"——与回调消费端的校验形成纵深防御（防开放重定向）。
  const safeReturn = isSafeReturnPath(currentPath) ? currentPath : "/"
  try {
    s.setItem(PROBED_KEY, "1")
    s.setItem(RETURN_KEY, safeReturn)
  } catch {
    return false
  }

  configureAuth()
  void sdkSilentLogin()
  return true
}
