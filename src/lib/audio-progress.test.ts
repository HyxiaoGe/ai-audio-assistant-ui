import { describe, expect, it } from "vitest"
import { canonicalizeAudioSrc } from "./audio-progress"

// audit MEDIUM [bugs]：播放进度恢复是死代码。持久化写的是 DOM 的 audio.src
// （绝对 URL + token 查询串），恢复时却拿它和 store 的 src（无 token 的相对逻辑
// URL）比较，`parsed.src !== src` 永真 → 永不恢复。canonicalizeAudioSrc 把两侧
// 归一到同一 pathname（丢掉 origin/token/query），让比较重新有意义、且不再把
// token 写进 localStorage。

describe("canonicalizeAudioSrc", () => {
  it("reduces an absolute, token-bearing proxy URL to its pathname", () => {
    expect(
      canonicalizeAudioSrc("https://host.example/api/v1/media/xyz?token=ABC123")
    ).toBe("/api/v1/media/xyz")
  })

  it("leaves a bare relative proxy path unchanged", () => {
    expect(canonicalizeAudioSrc("/api/v1/media/xyz")).toBe("/api/v1/media/xyz")
  })

  it("treats the persisted (absolute+token) and store (relative, token-free) forms of the SAME media as equal", () => {
    const persisted = "https://host.example/api/v1/media/xyz?token=OLD_TOKEN"
    const storeSrc = "/api/v1/media/xyz"
    expect(canonicalizeAudioSrc(persisted)).toBe(canonicalizeAudioSrc(storeSrc))
  })

  it("keeps DIFFERENT media distinguishable", () => {
    expect(canonicalizeAudioSrc("/api/v1/media/aaa")).not.toBe(
      canonicalizeAudioSrc("/api/v1/media/bbb")
    )
  })

  it("returns null for empty / null / undefined", () => {
    expect(canonicalizeAudioSrc("")).toBeNull()
    expect(canonicalizeAudioSrc(null)).toBeNull()
    expect(canonicalizeAudioSrc(undefined)).toBeNull()
  })
})
