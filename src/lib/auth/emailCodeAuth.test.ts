import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const {
  configureAuthMock,
  getAuthServiceUrlMock,
  clearSsoReturnMock,
  prepareAuthorizationMock,
  completeAuthorizationMock,
  cancelAuthorizationMock,
} = vi.hoisted(() => ({
  configureAuthMock: vi.fn(),
  getAuthServiceUrlMock: vi.fn(),
  clearSsoReturnMock: vi.fn(),
  prepareAuthorizationMock: vi.fn(),
  completeAuthorizationMock: vi.fn(),
  cancelAuthorizationMock: vi.fn(),
}))

vi.mock("../auth-sdk", () => ({
  configureAuth: configureAuthMock,
  getAuthServiceUrl: getAuthServiceUrlMock,
}))
vi.mock("../sso-probe", () => ({ clearSsoReturn: clearSsoReturnMock }))
vi.mock("auth-client-web", () => ({
  prepareAuthorization: prepareAuthorizationMock,
  completeAuthorization: completeAuthorizationMock,
  cancelAuthorization: cancelAuthorizationMock,
}))

import {
  cancelEmailCodeLogin,
  resendEmailCodeLogin,
  startEmailCodeLogin,
  verifyEmailCodeLogin,
} from "./emailCodeAuth"

const prepared = {
  responseType: "code" as const,
  clientId: "audio-app",
  redirectUri: "https://audio.example.com/auth/callback",
  state: "oauth-state-1",
  codeChallenge: "challenge-1",
  codeChallengeMethod: "S256" as const,
}

function jsonResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    json: vi.fn(async () => body),
  } as unknown as Response
}

function startAndSendResponses(resendAfter = 60): Response[] {
  return [
    jsonResponse({
      flow_id: "flow-1",
      csrf_token: "csrf-1",
      expires_in: 600,
      code_length: 6,
    }, 201),
    jsonResponse({
      accepted: true,
      next: "verify",
      expires_in: 300,
      resend_after: resendAfter,
      masked_destination: "u***@example.com",
    }, 202),
  ]
}

describe("emailCodeAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getAuthServiceUrlMock.mockReturnValue("http://127.0.0.1:18100")
    prepareAuthorizationMock.mockResolvedValue({ ...prepared })
    completeAuthorizationMock.mockResolvedValue({
      status: "authenticated",
      user: { id: "u1" },
      redirectPath: "/tasks",
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    cancelEmailCodeLogin({ interactionToken: "oauth-state-1" })
    vi.clearAllMocks()
  })

  it("使用 Audio SDK 准备 OAuth，并按 start 到 send 的精确协议发码", async () => {
    const responses = startAndSendResponses()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(responses[0])
      .mockResolvedValueOnce(responses[1])
    vi.stubGlobal("fetch", fetchMock)

    await expect(startEmailCodeLogin({
      email: "user@example.com",
      signal: new AbortController().signal,
    })).resolves.toEqual({
      interactionToken: "oauth-state-1",
      maskedDestination: "u***@example.com",
      expiresInSeconds: 300,
      resendAfterSeconds: 60,
      codeLength: 6,
    })

    expect(configureAuthMock).toHaveBeenCalledTimes(1)
    expect(clearSsoReturnMock).toHaveBeenCalledTimes(1)
    expect(prepareAuthorizationMock).toHaveBeenCalledWith()
    expect(fetchMock).toHaveBeenNthCalledWith(1, "http://127.0.0.1:18100/auth/email/headless/start", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        client_id: "audio-app",
        redirect_uri: "https://audio.example.com/auth/callback",
        response_type: "code",
        state: "oauth-state-1",
        code_challenge: "challenge-1",
        code_challenge_method: "S256",
      }),
      signal: expect.any(AbortSignal),
    })
    expect(fetchMock).toHaveBeenNthCalledWith(2, "http://127.0.0.1:18100/auth/email/headless/send", {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json",
        "X-CSRF-Token": "csrf-1",
      },
      body: JSON.stringify({ flow_id: "flow-1", email: "user@example.com" }),
      signal: expect.any(AbortSignal),
    })
  })

  it.each([
    ["start 响应失败", [jsonResponse({ error: "invalid_request" }, 400)]],
    ["send 响应失败", [
      startAndSendResponses()[0],
      jsonResponse({ error: "delivery_unavailable" }, 503),
    ]],
  ] as const)("%s会清理 SDK pending 和内存事务", async (_case, responses) => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(responses[0])
      .mockResolvedValueOnce(responses[1]))

    await expect(startEmailCodeLogin({
      email: "user@example.com",
      signal: new AbortController().signal,
    })).rejects.toMatchObject({ code: expect.any(String) })

    expect(cancelAuthorizationMock).toHaveBeenCalledWith("oauth-state-1")
    await expect(resendEmailCodeLogin({
      interactionToken: "oauth-state-1",
      signal: new AbortController().signal,
    })).rejects.toMatchObject({ code: "interaction_expired" })
  })

  it("start 被 Abort 时仍清理 SDK pending", async () => {
    const controller = new AbortController()
    vi.stubGlobal("fetch", vi.fn((_url, init: RequestInit) => new Promise((_resolve, reject) => {
      if (init.signal?.aborted) {
        reject(new DOMException("aborted", "AbortError"))
        return
      }
      init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))
    })))

    const request = startEmailCodeLogin({ email: "user@example.com", signal: controller.signal })
    controller.abort()

    await expect(request).rejects.toMatchObject({ name: "AbortError" })
    expect(cancelAuthorizationMock).toHaveBeenCalledWith("oauth-state-1")
  })

  it("resend 复用同一 flow、邮箱和 csrf，不会重新准备 OAuth", async () => {
    const responses = startAndSendResponses(0)
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(responses[0])
      .mockResolvedValueOnce(responses[1])
      .mockResolvedValueOnce(jsonResponse({
        accepted: true,
        next: "verify",
        expires_in: 300,
        resend_after: 60,
        masked_destination: "u***@example.com",
      }, 202))
    vi.stubGlobal("fetch", fetchMock)
    const signal = new AbortController().signal
    await startEmailCodeLogin({ email: "user@example.com", signal })

    await expect(resendEmailCodeLogin({ interactionToken: "oauth-state-1", signal })).resolves.toMatchObject({
      interactionToken: "oauth-state-1",
      resendAfterSeconds: 60,
    })
    expect(fetchMock).toHaveBeenNthCalledWith(3, "http://127.0.0.1:18100/auth/email/headless/send", {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json",
        "X-CSRF-Token": "csrf-1",
      },
      body: JSON.stringify({ flow_id: "flow-1", email: "user@example.com" }),
      signal,
    })
    expect(prepareAuthorizationMock).toHaveBeenCalledTimes(1)
  })

  it("verify 校验 state 后交给 SDK 换码，并消费内存事务", async () => {
    const responses = startAndSendResponses()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(responses[0])
      .mockResolvedValueOnce(responses[1])
      .mockResolvedValueOnce(jsonResponse({
        code: "authorization-code",
        state: "oauth-state-1",
        expires_in: 60,
      }))
    vi.stubGlobal("fetch", fetchMock)
    const signal = new AbortController().signal
    await startEmailCodeLogin({ email: "user@example.com", signal })

    await expect(verifyEmailCodeLogin({
      interactionToken: "oauth-state-1",
      verificationCode: "123456",
      signal,
    })).resolves.toMatchObject({ status: "authenticated" })

    expect(completeAuthorizationMock).toHaveBeenCalledWith({
      authorizationCode: "authorization-code",
      state: "oauth-state-1",
      signal: expect.any(AbortSignal),
    })
    expect(completeAuthorizationMock.mock.calls[0]?.[0].signal).not.toBe(signal)
    await expect(resendEmailCodeLogin({ interactionToken: "oauth-state-1", signal }))
      .rejects.toMatchObject({ code: "interaction_expired" })
  })

  it("invalid_code 和限流保留事务，且 Retry-After 响应头优先", async () => {
    const responses = startAndSendResponses(0)
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(responses[0])
      .mockResolvedValueOnce(responses[1])
      .mockResolvedValueOnce(jsonResponse({ error: "invalid_code" }, 400))
      .mockResolvedValueOnce(jsonResponse({ error: "rate_limited", retry_after: 2 }, 429, {
        "Retry-After": "7",
      }))
      .mockResolvedValueOnce(jsonResponse({
        accepted: true,
        next: "verify",
        expires_in: 300,
        resend_after: 60,
        masked_destination: "u***@example.com",
      }, 202))
    vi.stubGlobal("fetch", fetchMock)
    const signal = new AbortController().signal
    await startEmailCodeLogin({ email: "user@example.com", signal })

    await expect(verifyEmailCodeLogin({
      interactionToken: "oauth-state-1",
      verificationCode: "000000",
      signal,
    })).rejects.toMatchObject({ code: "invalid_code" })
    await expect(verifyEmailCodeLogin({
      interactionToken: "oauth-state-1",
      verificationCode: "000001",
      signal,
    })).rejects.toMatchObject({ code: "rate_limited", retryAfterSeconds: 7 })
    await expect(resendEmailCodeLogin({ interactionToken: "oauth-state-1", signal }))
      .resolves.toMatchObject({ interactionToken: "oauth-state-1" })
  })

  it.each(["invalid_interaction", "interaction_expired", "interaction_consumed"])(
    "%s 会清理 SDK pending 和内存事务",
    async (backendError) => {
      const responses = startAndSendResponses(0)
      vi.stubGlobal("fetch", vi.fn()
        .mockResolvedValueOnce(responses[0])
        .mockResolvedValueOnce(responses[1])
        .mockResolvedValueOnce(jsonResponse({ error: backendError }, 400)))
      const signal = new AbortController().signal
      await startEmailCodeLogin({ email: "user@example.com", signal })

      await expect(verifyEmailCodeLogin({
        interactionToken: "oauth-state-1",
        verificationCode: "123456",
        signal,
      })).rejects.toMatchObject({
        code: backendError === "interaction_consumed" ? "interaction_consumed" : "interaction_expired",
      })
      expect(cancelAuthorizationMock).toHaveBeenCalledWith("oauth-state-1")
    },
  )

  it("拒绝不同 state，且不会把攻击者返回值交给 SDK", async () => {
    const responses = startAndSendResponses(0)
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(responses[0])
      .mockResolvedValueOnce(responses[1])
      .mockResolvedValueOnce(jsonResponse({
        code: "authorization-code",
        state: "attacker-state",
        expires_in: 60,
      })))
    const signal = new AbortController().signal
    await startEmailCodeLogin({ email: "user@example.com", signal })

    await expect(verifyEmailCodeLogin({
      interactionToken: "oauth-state-1",
      verificationCode: "123456",
      signal,
    })).rejects.toMatchObject({ code: "server_error" })
    expect(completeAuthorizationMock).not.toHaveBeenCalled()
    expect(cancelAuthorizationMock).toHaveBeenCalledWith("oauth-state-1")
  })

  it("授权码签发后 SDK 失败统一视为 interaction_consumed", async () => {
    const responses = startAndSendResponses(0)
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(responses[0])
      .mockResolvedValueOnce(responses[1])
      .mockResolvedValueOnce(jsonResponse({
        code: "authorization-code",
        state: "oauth-state-1",
        expires_in: 60,
      })))
    completeAuthorizationMock.mockRejectedValueOnce(new Error("token exchange failed"))
    const signal = new AbortController().signal
    await startEmailCodeLogin({ email: "user@example.com", signal })

    await expect(verifyEmailCodeLogin({
      interactionToken: "oauth-state-1",
      verificationCode: "123456",
      signal,
    })).rejects.toMatchObject({ code: "interaction_consumed" })
    await expect(resendEmailCodeLogin({ interactionToken: "oauth-state-1", signal }))
      .rejects.toMatchObject({ code: "interaction_expired" })
  })

  it("verify 超时返回 network_error 并保留事务供重试", async () => {
    vi.useFakeTimers()
    const responses = startAndSendResponses(0)
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(responses[0])
      .mockResolvedValueOnce(responses[1])
      .mockImplementationOnce((_url, init: RequestInit) => new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new DOMException("timeout", "AbortError")))
      }))
      .mockResolvedValueOnce(jsonResponse({
        accepted: true,
        next: "verify",
        expires_in: 300,
        resend_after: 60,
        masked_destination: "u***@example.com",
      }, 202))
    vi.stubGlobal("fetch", fetchMock)
    const signal = new AbortController().signal
    await startEmailCodeLogin({ email: "user@example.com", signal })

    const verification = expect(verifyEmailCodeLogin({
      interactionToken: "oauth-state-1",
      verificationCode: "123456",
      signal,
    })).rejects.toMatchObject({ code: "network_error" })
    await vi.advanceTimersByTimeAsync(30_000)
    await verification

    await expect(resendEmailCodeLogin({ interactionToken: "oauth-state-1", signal }))
      .resolves.toMatchObject({ interactionToken: "oauth-state-1" })
  })

  it("cancel 同时取消 SDK pending 并删除事务", async () => {
    const responses = startAndSendResponses(0)
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(responses[0])
      .mockResolvedValueOnce(responses[1]))
    const signal = new AbortController().signal
    await startEmailCodeLogin({ email: "user@example.com", signal })

    cancelEmailCodeLogin({ interactionToken: "oauth-state-1" })

    expect(cancelAuthorizationMock).toHaveBeenCalledWith("oauth-state-1")
    await expect(resendEmailCodeLogin({ interactionToken: "oauth-state-1", signal }))
      .rejects.toMatchObject({ code: "interaction_expired" })
  })
})
