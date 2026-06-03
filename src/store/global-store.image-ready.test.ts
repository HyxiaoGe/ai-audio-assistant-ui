import { beforeEach, describe, expect, it } from "vitest"
import { useGlobalStore } from "./global-store"
import type { WsImageReadyData } from "@/types/api"

function evt(over: Partial<WsImageReadyData> = {}): WsImageReadyData {
  return {
    task_id: "t1",
    summary_id: "s1",
    summary_type: "overview",
    placeholder: "{{IMAGE: a}}",
    status: "ready",
    url: "/api/v1/summaries/images/a.png",
    model_id: "gemini",
    ...over,
  }
}

describe("global-store image_ready events", () => {
  beforeEach(() => {
    useGlobalStore.setState({ imageReadyEvents: {} })
  })

  it("appends events keyed by task_id", () => {
    useGlobalStore.getState().applyImageReady(evt({ placeholder: "{{IMAGE: a}}" }))
    useGlobalStore.getState().applyImageReady(evt({ placeholder: "{{IMAGE: b}}" }))
    useGlobalStore.getState().applyImageReady(evt({ task_id: "t2", placeholder: "{{IMAGE: c}}" }))

    const events = useGlobalStore.getState().imageReadyEvents
    expect(events["t1"]).toHaveLength(2)
    expect(events["t1"].map((e) => e.placeholder)).toEqual(["{{IMAGE: a}}", "{{IMAGE: b}}"])
    expect(events["t2"]).toHaveLength(1)
  })

  it("clears the queue for a single task without touching others", () => {
    useGlobalStore.getState().applyImageReady(evt({ task_id: "t1" }))
    useGlobalStore.getState().applyImageReady(evt({ task_id: "t2" }))

    useGlobalStore.getState().clearImageReadyEvents("t1")

    const events = useGlobalStore.getState().imageReadyEvents
    expect(events["t1"]).toBeUndefined()
    expect(events["t2"]).toHaveLength(1)
  })

  it("clearing a non-existent task is a no-op and keeps the same reference (no needless rerender)", () => {
    const before = useGlobalStore.getState().imageReadyEvents
    useGlobalStore.getState().clearImageReadyEvents("nope")
    const after = useGlobalStore.getState().imageReadyEvents
    expect(after).toBe(before)
  })
})
