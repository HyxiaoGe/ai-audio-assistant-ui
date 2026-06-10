import { describe, expect, it } from "vitest"

import { maybeSilentLogin } from "./sso-probe"

describe("公开路由 SSO 探测豁免", () => {
  it("/explore 前缀绝不发起静默登录(匿名浏览是产品功能,不是未登录异常)", () => {
    sessionStorage.clear()
    localStorage.clear()
    expect(maybeSilentLogin("/explore")).toBe(false)
    expect(maybeSilentLogin("/explore/abc-123")).toBe(false)
  })
})
