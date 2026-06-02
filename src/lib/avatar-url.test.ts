import { describe, it, expect } from "vitest"
import { proxiedAvatar } from "./avatar-url"

// OAuth 头像直连 Google/GitHub 图床在国内慢/被墙，登录数据早已返回卡住的只是那张 <img>。
// 改走同源代理 /api/v1/users/avatar（后端按白名单抓取+强缓存）。这里只校验 URL 改写策略。
describe("proxiedAvatar", () => {
  it("rewrites a Google avatar https URL to the same-origin proxy", () => {
    const raw = "https://lh3.googleusercontent.com/a/ACg8ocK=s96-c"
    expect(proxiedAvatar(raw)).toBe(
      `/api/v1/users/avatar?url=${encodeURIComponent(raw)}`
    )
  })

  it("rewrites a GitHub avatar https URL to the same-origin proxy", () => {
    const raw = "https://avatars.githubusercontent.com/u/12345?v=4"
    expect(proxiedAvatar(raw)).toBe(
      `/api/v1/users/avatar?url=${encodeURIComponent(raw)}`
    )
  })

  it("passes through an unknown host untouched", () => {
    const raw = "https://cdn.example.com/a.png"
    expect(proxiedAvatar(raw)).toBe(raw)
  })

  it("passes through a relative path untouched", () => {
    expect(proxiedAvatar("/avatars/me.png")).toBe("/avatars/me.png")
  })

  it("passes through a data: URL untouched", () => {
    const raw = "data:image/png;base64,iVBORw0KGgo="
    expect(proxiedAvatar(raw)).toBe(raw)
  })

  it("does not proxy a non-https (http) whitelisted host", () => {
    const raw = "http://lh3.googleusercontent.com/a/x"
    expect(proxiedAvatar(raw)).toBe(raw)
  })

  it("returns undefined for empty / whitespace / undefined / null", () => {
    expect(proxiedAvatar("")).toBeUndefined()
    expect(proxiedAvatar("   ")).toBeUndefined()
    expect(proxiedAvatar(undefined)).toBeUndefined()
    expect(proxiedAvatar(null)).toBeUndefined()
  })
})
