import { describe, it, expect } from "vitest"
import { classifyChannelInput, normalizeHandle, normalizeQuery } from "./youtube-channel-classify"

const UCID = "UC1234567890abcdefghijkl" // UC + 22 chars

describe("classifyChannelInput", () => {
  it("/channel/UC… 链接 → channel_id + UCID", () => {
    expect(classifyChannelInput(`https://www.youtube.com/channel/${UCID}`)).toEqual({
      matchField: "channel_id",
      normalizedValue: UCID,
    })
  })

  it("裸 UCID → channel_id(原样保留大小写)", () => {
    expect(classifyChannelInput(UCID)).toEqual({ matchField: "channel_id", normalizedValue: UCID })
  })

  it("youtube.com/@x 链接 → channel_handle + 小写 handle", () => {
    expect(classifyChannelInput("https://www.youtube.com/@LexFridman")).toEqual({
      matchField: "channel_handle",
      normalizedValue: "lexfridman",
    })
  })

  it("m./music. 子域链接 → channel_handle", () => {
    expect(classifyChannelInput("https://m.youtube.com/@LexFridman/videos")).toEqual({
      matchField: "channel_handle",
      normalizedValue: "lexfridman",
    })
  })

  it("裸 @handle → channel_handle", () => {
    expect(classifyChannelInput("@LexFridman")).toEqual({
      matchField: "channel_handle",
      normalizedValue: "lexfridman",
    })
  })

  it("百分号编码 @ → 解码后 channel_handle", () => {
    expect(classifyChannelInput("https://youtube.com/@%40weird")).toEqual({
      matchField: "channel_handle",
      normalizedValue: "weird",
    })
  })

  it("解码后含空格的 handle → 落回 channel_name(整串归一化)", () => {
    expect(classifyChannelInput("https://youtube.com/@Lex%20Fridman")).toEqual({
      matchField: "channel_name",
      normalizedValue: "https://youtube.com/@lex%20fridman",
    })
  })

  it("纯频道名 → channel_name(折叠空白 + 小写)", () => {
    expect(classifyChannelInput("  Lex   Fridman ")).toEqual({
      matchField: "channel_name",
      normalizedValue: "lex fridman",
    })
  })

  it("/user/ 与 /c/ 链接 → 落 channel_name 兜底(对整串归一化)", () => {
    expect(classifyChannelInput("https://www.youtube.com/user/PewDiePie")).toEqual({
      matchField: "channel_name",
      normalizedValue: "https://www.youtube.com/user/pewdiepie",
    })
    expect(classifyChannelInput("https://www.youtube.com/c/SomeChannel")).toEqual({
      matchField: "channel_name",
      normalizedValue: "https://www.youtube.com/c/somechannel",
    })
  })

  it("前缀紧贴 youtube.com 不误判为 handle(lookbehind)", () => {
    // "xyoutube.com/@h" 不应匹配 handle url 正则 → 落 channel_name
    expect(classifyChannelInput("notyoutube.com/@h").matchField).toBe("channel_name")
  })

  it("unicode handle 用 \\p{L} 对齐后端 \\w → channel_handle", () => {
    expect(classifyChannelInput("@测试频道")).toEqual({
      matchField: "channel_handle",
      normalizedValue: "测试频道",
    })
  })
})

describe("normalizeHandle", () => {
  it("解码 + 去前导@ + 小写", () => {
    expect(normalizeHandle("@LexFridman")).toBe("lexfridman")
    expect(normalizeHandle("%40Lex")).toBe("lex")
  })
  it("非法百分号编码回退原串不抛", () => {
    expect(normalizeHandle("%E0%A4%A")).toBe("%e0%a4%a")
  })
})

describe("normalizeQuery", () => {
  it("折叠空白 + 小写", () => {
    expect(normalizeQuery("  Lex   Fridman ")).toBe("lex fridman")
  })
})
