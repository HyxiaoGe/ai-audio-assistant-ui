import { describe, it, expect } from "vitest"
import { appendMediaToken } from "./media-url"

describe("appendMediaToken", () => {
  const token = "tok 123/+=" // includes chars that must be URL-encoded

  it("appends token to /api/v1/media proxy URLs", () => {
    expect(appendMediaToken("/api/v1/media/upload/u1/x.wav", token)).toBe(
      "/api/v1/media/upload/u1/x.wav?token=tok%20123%2F%2B%3D"
    )
  })

  it("appends token to /api/v1/summaries/images URLs", () => {
    expect(appendMediaToken("/api/v1/summaries/images/u1/t/img.png", token)).toBe(
      "/api/v1/summaries/images/u1/t/img.png?token=tok%20123%2F%2B%3D"
    )
  })

  it("uses & when the URL already has a query string", () => {
    expect(appendMediaToken("/api/v1/media/x.wav?v=2", token)).toBe(
      "/api/v1/media/x.wav?v=2&token=tok%20123%2F%2B%3D"
    )
  })

  it("is a no-op when token is null", () => {
    expect(appendMediaToken("/api/v1/media/upload/u1/x.wav", null)).toBe(
      "/api/v1/media/upload/u1/x.wav"
    )
  })

  it("leaves non-proxy / external URLs untouched (e.g. OAuth avatars)", () => {
    expect(appendMediaToken("https://lh3.googleusercontent.com/a/x", token)).toBe(
      "https://lh3.googleusercontent.com/a/x"
    )
    expect(appendMediaToken("/api/v1/tasks/123", token)).toBe("/api/v1/tasks/123")
    expect(appendMediaToken("data:image/png;base64,abc", token)).toBe("data:image/png;base64,abc")
  })

  it("returns empty string for empty/nullish input", () => {
    expect(appendMediaToken("", token)).toBe("")
    expect(appendMediaToken(null, token)).toBe("")
    expect(appendMediaToken(undefined, token)).toBe("")
  })
})
