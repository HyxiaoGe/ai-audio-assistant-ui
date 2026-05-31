import { describe, expect, it } from "vitest"
import { parseActionItems, parseSummaryLines } from "./summary-parse"

// 从 TaskDetail 抽出的纯解析逻辑（audit #8 拆分第 1 步）。锁定既有行为后再迁移。

describe("parseSummaryLines", () => {
  it("returns [] for empty/null/undefined", () => {
    expect(parseSummaryLines("")).toEqual([])
    expect(parseSummaryLines(null)).toEqual([])
    expect(parseSummaryLines(undefined)).toEqual([])
  })

  it("strips list/ordinal/checkbox markers and trims", () => {
    expect(parseSummaryLines("- alpha")).toEqual(["alpha"])
    expect(parseSummaryLines("* beta")).toEqual(["beta"])
    expect(parseSummaryLines("1. gamma")).toEqual(["gamma"])
    expect(parseSummaryLines("[x] done")).toEqual(["done"])
    expect(parseSummaryLines("[ ] todo")).toEqual(["todo"])
  })

  it("splits on blank/newlines and drops empty lines", () => {
    expect(parseSummaryLines("- a\n\n- b\n  \n- c")).toEqual(["a", "b", "c"])
  })
})

const labels = { pendingAssignee: "未指派", pendingDeadline: "无截止" }

describe("parseActionItems", () => {
  it("returns [] for empty/null", () => {
    expect(parseActionItems("", labels)).toEqual([])
    expect(parseActionItems(null, labels)).toEqual([])
  })

  it("extracts assignee, deadline, completion and task text", () => {
    const [item] = parseActionItems("[x] Ship the build @alice 2026-01-15", labels)
    expect(item).toEqual({
      id: "action-1",
      task: "Ship the build",
      assignee: "alice",
      deadline: "2026-01-15",
      completed: true,
    })
  })

  it("falls back to provided labels when assignee/deadline are absent", () => {
    const [item] = parseActionItems("- Write the docs", labels)
    expect(item.assignee).toBe("未指派")
    expect(item.deadline).toBe("无截止")
    expect(item.completed).toBe(false)
    expect(item.task).toBe("Write the docs")
  })

  it("supports the m/d deadline format and indexes ids from 1", () => {
    const items = parseActionItems("- first @bob 3/9\n- second", labels)
    expect(items[0].deadline).toBe("3/9")
    expect(items[0].assignee).toBe("bob")
    expect(items[1].id).toBe("action-2")
  })
})
