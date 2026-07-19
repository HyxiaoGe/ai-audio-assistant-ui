import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

describe("邮箱验证码能力探测", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv("NEXT_PUBLIC_AUTH_URL", "https://auth.example.com/")
    vi.stubEnv("NEXT_PUBLIC_AUTH_CLIENT_ID", "app_audio")
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("当前客户端明确开放 headless 邮箱登录时返回可用", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ email_headless_login: true }), { status: 200 })
    )
    vi.stubGlobal("fetch", fetchMock)
    const { getEmailLoginCapabilities } = await import("./auth-sdk")

    await expect(getEmailLoginCapabilities()).resolves.toEqual({ headless: true })
    expect(fetchMock).toHaveBeenCalledWith(
      "https://auth.example.com/auth/capabilities?client_id=app_audio&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fauth%2Fcallback",
      { method: "GET", cache: "no-store" }
    )
  })

  it("服务未开放、响应异常或网络失败时均关闭入口", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ email_headless_login: false }), { status: 200 })
      )
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockRejectedValueOnce(new TypeError("network down"))
    vi.stubGlobal("fetch", fetchMock)
    const { getEmailLoginCapabilities } = await import("./auth-sdk")

    await expect(getEmailLoginCapabilities()).resolves.toEqual({ headless: false })
    await expect(getEmailLoginCapabilities()).resolves.toEqual({ headless: false })
    await expect(getEmailLoginCapabilities()).resolves.toEqual({ headless: false })
  })

  it("缺少客户端配置时不发请求", async () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_CLIENT_ID", "")
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    const { getEmailLoginCapabilities } = await import("./auth-sdk")

    await expect(getEmailLoginCapabilities()).resolves.toEqual({ headless: false })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("只允许 HTTP 和 HTTPS 运行时", async () => {
    const { isEmailHeadlessRuntime } = await import("./auth-sdk")

    expect(isEmailHeadlessRuntime("https:")).toBe(true)
    expect(isEmailHeadlessRuntime("http:")).toBe(true)
    expect(isEmailHeadlessRuntime("file:")).toBe(false)
  })
})
