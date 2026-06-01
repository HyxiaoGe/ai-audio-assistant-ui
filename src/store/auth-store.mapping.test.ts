import { describe, expect, it } from "vitest"

import { normalizeUser } from "./auth-store"

// The shared SDK normalizes the profile to `avatarUrl`; audio's UI reads `avatar_url`.
// normalizeUser bridges the two and tolerates either source (legacy localStorage cache vs SDK).
describe("normalizeUser", () => {
  it("maps the SDK's avatarUrl onto audio's avatar_url and passes through the rest", () => {
    const u = normalizeUser({
      id: "1",
      email: "a@b.c",
      name: "Ada",
      avatarUrl: "http://i/a.png",
      is_superuser: true,
      preferences: { locale: "en", timezone: "UTC", theme: "dark" },
    })
    expect(u).toEqual({
      id: "1",
      email: "a@b.c",
      name: "Ada",
      avatar_url: "http://i/a.png",
      is_superuser: true,
      preferences: { locale: "en", timezone: "UTC", theme: "dark" },
    })
  })

  it("accepts audio's own avatar_url shape unchanged (legacy cached user)", () => {
    expect(normalizeUser({ id: "2", avatar_url: "http://i/b.png" }).avatar_url).toBe("http://i/b.png")
  })

  it("fills safe defaults for missing fields and coerces a non-string id", () => {
    expect(normalizeUser({ id: 7 })).toEqual({
      id: "7",
      email: "",
      name: "",
      avatar_url: undefined,
      is_superuser: false,
      preferences: { locale: "zh", timezone: "Asia/Shanghai", theme: "system" },
    })
  })

  // 偏好按字段合并，而非全有或全无：后端/旧缓存只缺 theme 时，不能把用户真实的
  // locale/timezone 整体丢弃替换成默认（zh/Asia-Shanghai）。只对缺失字段填默认。
  it("merges partial preferences field-by-field instead of dropping the whole object", () => {
    expect(normalizeUser({ id: "9", preferences: { locale: "en", timezone: "UTC" } }).preferences).toEqual({
      locale: "en",
      timezone: "UTC",
      theme: "system",
    })
  })

  it("defaults only the non-string preference fields, keeping the valid ones", () => {
    expect(
      normalizeUser({ id: "9", preferences: { locale: "ja", timezone: 123, theme: null } }).preferences
    ).toEqual({ locale: "ja", timezone: "Asia/Shanghai", theme: "system" })
  })
})
