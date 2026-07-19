import { describe, expect, it } from "vitest"

import {
  createInitialEmailCodeLoginState,
  emailCodeLoginReducer,
  normalizeEmailCodeFailure,
  remainingSeconds,
  type EmailCodeChallenge,
} from "./emailCodeLoginMachine"

const challenge: EmailCodeChallenge = {
  interactionToken: "interaction-1",
  maskedDestination: "u***@example.com",
  expiresInSeconds: 300,
  resendAfterSeconds: 60,
  codeLength: 6,
}

function codeEntryState() {
  let state = emailCodeLoginReducer(createInitialEmailCodeLoginState(), { type: "SELECT_EMAIL" })
  state = emailCodeLoginReducer(state, { type: "SET_EMAIL", email: " user@example.com " })
  state = emailCodeLoginReducer(state, {
    type: "REQUEST_STARTED",
    operation: "start",
    requestId: 1,
    submittedEmail: "user@example.com",
  })
  return emailCodeLoginReducer(state, {
    type: "CHALLENGE_RECEIVED",
    operation: "start",
    requestId: 1,
    challenge,
    now: 1_000,
  })
}

describe("emailCodeLoginMachine", () => {
  it("从登录方式进入邮箱输入，并完整推进到验证码状态", () => {
    expect(codeEntryState()).toMatchObject({
      phase: "code-entry",
      emailDraft: "user@example.com",
      interactionToken: "interaction-1",
      maskedDestination: "u***@example.com",
      codeLength: 6,
      codeExpiresAt: 301_000,
      resendAvailableAt: 61_000,
    })
  })

  it("关闭后的迟到响应不能复活流程", () => {
    let state = emailCodeLoginReducer(createInitialEmailCodeLoginState(), { type: "SELECT_EMAIL" })
    state = emailCodeLoginReducer(state, {
      type: "REQUEST_STARTED",
      operation: "start",
      requestId: 7,
      submittedEmail: "user@example.com",
    })
    state = emailCodeLoginReducer(state, { type: "RESET" })
    state = emailCodeLoginReducer(state, {
      type: "CHALLENGE_RECEIVED",
      operation: "start",
      requestId: 7,
      challenge,
      now: 1_000,
    })

    expect(state).toEqual(createInitialEmailCodeLoginState())
  })

  it("更换邮箱会保留草稿但清掉 interaction、验证码和倒计时", () => {
    let state = emailCodeLoginReducer(codeEntryState(), { type: "SET_CODE", code: "123456" })
    state = emailCodeLoginReducer(state, { type: "CHANGE_EMAIL" })

    expect(state).toMatchObject({
      phase: "email-entry",
      emailDraft: "user@example.com",
      interactionToken: null,
      verificationCode: "",
      codeExpiresAt: null,
      resendAvailableAt: null,
    })
  })

  it("重发成功清空旧验证码并刷新服务端倒计时", () => {
    let state = emailCodeLoginReducer(codeEntryState(), { type: "SET_CODE", code: "123456" })
    state = emailCodeLoginReducer(state, {
      type: "REQUEST_STARTED",
      operation: "resend",
      requestId: 2,
    })
    state = emailCodeLoginReducer(state, {
      type: "CHALLENGE_RECEIVED",
      operation: "resend",
      requestId: 2,
      challenge: { ...challenge, interactionToken: "interaction-2", resendAfterSeconds: 30 },
      now: 5_000,
    })

    expect(state).toMatchObject({
      phase: "code-entry",
      interactionToken: "interaction-2",
      verificationCode: "",
      resendAvailableAt: 35_000,
      notice: "code_resent",
    })
  })

  it("invalid_code 留在验证码页，interaction 终态回邮箱页", () => {
    let state = emailCodeLoginReducer(codeEntryState(), { type: "SET_CODE", code: "123456" })
    state = emailCodeLoginReducer(state, {
      type: "REQUEST_STARTED",
      operation: "verify",
      requestId: 2,
    })
    state = emailCodeLoginReducer(state, {
      type: "REQUEST_FAILED",
      operation: "verify",
      requestId: 2,
      failure: { code: "invalid_code" },
      now: 2_000,
    })
    expect(state).toMatchObject({ phase: "code-entry", verificationCode: "", error: { code: "invalid_code" } })

    state = emailCodeLoginReducer(state, {
      type: "REQUEST_STARTED",
      operation: "verify",
      requestId: 3,
    })
    state = emailCodeLoginReducer(state, {
      type: "REQUEST_FAILED",
      operation: "verify",
      requestId: 3,
      failure: { code: "interaction_consumed" },
      now: 3_000,
    })
    expect(state).toMatchObject({
      phase: "email-entry",
      interactionToken: null,
      error: { code: "interaction_consumed" },
    })
  })

  it("rate_limited 使用服务端 retry_after，冷却结束自动清错", () => {
    let state = emailCodeLoginReducer(createInitialEmailCodeLoginState(), { type: "SELECT_EMAIL" })
    state = emailCodeLoginReducer(state, {
      type: "REQUEST_STARTED",
      operation: "start",
      requestId: 1,
      submittedEmail: "user@example.com",
    })
    state = emailCodeLoginReducer(state, {
      type: "REQUEST_FAILED",
      operation: "start",
      requestId: 1,
      failure: { code: "rate_limited", retryAfterSeconds: 45 },
      now: 10_000,
    })

    expect(state).toMatchObject({
      phase: "email-entry",
      retryAvailableAt: 55_000,
      retryOperation: "start",
      error: { code: "rate_limited", retryAfterSeconds: 45 },
    })
    state = emailCodeLoginReducer(state, { type: "TICK", now: 55_000 })
    expect(state).toMatchObject({ retryAvailableAt: null, retryOperation: null, error: null })
  })

  it("缺失 retry_after 时采用一秒最小冷却", () => {
    let state = emailCodeLoginReducer(createInitialEmailCodeLoginState(), { type: "SELECT_EMAIL" })
    state = emailCodeLoginReducer(state, {
      type: "REQUEST_STARTED",
      operation: "start",
      requestId: 1,
      submittedEmail: "user@example.com",
    })
    state = emailCodeLoginReducer(state, {
      type: "REQUEST_FAILED",
      operation: "start",
      requestId: 1,
      failure: { code: "rate_limited" },
      now: 10_000,
    })

    expect(state.retryAvailableAt).toBe(11_000)
    state = emailCodeLoginReducer(state, { type: "TICK", now: 11_000 })
    expect(state).toMatchObject({ retryAvailableAt: null, retryOperation: null, error: null })
  })

  it("中止请求回到稳定页且不展示错误", () => {
    let state = emailCodeLoginReducer(createInitialEmailCodeLoginState(), { type: "SELECT_EMAIL" })
    state = emailCodeLoginReducer(state, {
      type: "REQUEST_STARTED",
      operation: "start",
      requestId: 1,
      submittedEmail: "user@example.com",
    })
    state = emailCodeLoginReducer(state, {
      type: "REQUEST_FAILED",
      operation: "start",
      requestId: 1,
      failure: { code: "aborted" },
      now: 10_000,
    })

    expect(state).toMatchObject({
      phase: "email-entry",
      activeRequestId: null,
      activeOperation: null,
      error: null,
    })
  })

  it("客户端倒计时到期后清掉旧验证码并标记过期", () => {
    let state = codeEntryState()
    state = emailCodeLoginReducer(state, { type: "SET_CODE", code: "12a34b567" })
    expect(state.verificationCode).toBe("123456")
    state = emailCodeLoginReducer({ ...state, codeExpiresAt: 6_000 }, { type: "TICK", now: 6_000 })

    expect(state).toMatchObject({ verificationCode: "", error: { code: "code_expired" } })
  })

  it("归一化 Abort、网络、结构化错误和未知错误", () => {
    expect(normalizeEmailCodeFailure(new DOMException("aborted", "AbortError"))).toEqual({ code: "aborted" })
    expect(normalizeEmailCodeFailure(new TypeError("Failed to fetch"))).toEqual({ code: "network_error" })
    expect(normalizeEmailCodeFailure({ code: "rate_limited", retryAfterSeconds: 12.9 })).toEqual({
      code: "rate_limited",
      retryAfterSeconds: 12,
    })
    expect(normalizeEmailCodeFailure(new Error("oops"))).toEqual({ code: "server_error" })
  })

  it("倒计时向上取整且不会为负", () => {
    expect(remainingSeconds(2_001, 1_000)).toBe(2)
    expect(remainingSeconds(1_000, 1_000)).toBe(0)
    expect(remainingSeconds(500, 1_000)).toBe(0)
    expect(remainingSeconds(null, 1_000)).toBe(0)
  })
})
