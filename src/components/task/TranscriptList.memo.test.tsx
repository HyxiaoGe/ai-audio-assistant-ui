import { act, render } from "@testing-library/react"
import { memo } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useAudioStore } from "@/store/audio-store"

// 证明本次重构的核心收益：播放每帧（currentTime 变化）只有正在高亮的那一行重渲染，
// 其余行因 props 引用稳定被 React.memo 跳过——而不是像重构前那样整列重渲染。

// 用 vi.fn 记录每次行渲染（而非在 render 中修改外层对象），既能统计渲染次数又不触发
// React Compiler 的 immutability 规则。renderCount(id) 统计某行被渲染的次数。
const renderSpy = vi.fn<(segmentId: string) => void>()
const renderCount = (segmentId: string) =>
  renderSpy.mock.calls.filter(([id]) => id === segmentId).length

vi.mock("@/components/task/TranscriptItem", () => ({
  default: memo(function MockTranscriptItem(props: { segmentId: string }) {
    renderSpy(props.segmentId)
    return <div data-testid={`item-${props.segmentId}`} />
  }),
}))

vi.mock("@/lib/i18n-context", () => ({
  useI18n: () => ({ t: (k: string) => k, locale: "zh" }),
}))

import { TranscriptList, type DisplayTranscriptSegment } from "./TranscriptList"

function seg(over: Partial<DisplayTranscriptSegment> & { id: string }): DisplayTranscriptSegment {
  return {
    speaker: "S",
    startTime: "00:00",
    endTime: "00:02",
    startSeconds: 0,
    endSeconds: 2,
    content: "c",
    words: null,
    avatarColor: "var(--app-primary)",
    isPolished: false,
    originalContent: null,
    ...over,
  }
}

// 稳定的 transcript 引用 + 稳定的回调（模拟父组件用 useCallback 传入）
const SEGMENTS: DisplayTranscriptSegment[] = [
  seg({ id: "a", startSeconds: 0, endSeconds: 2, words: [{ word: "hello", start_time: 0, end_time: 1, confidence: null }] }),
  seg({
    id: "b",
    startSeconds: 2,
    endSeconds: 4,
    words: [{ word: "foo", start_time: 2, end_time: 3, confidence: null }],
  }),
  seg({ id: "c", startSeconds: 4, endSeconds: 6, words: [{ word: "baz", start_time: 4, end_time: 5, confidence: null }] }),
]
const onTimeClick = () => {}
const onEditSegment = () => {}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
  renderSpy.mockClear()
  act(() => useAudioStore.setState({ currentTime: 0, src: null, isPlaying: false }))
})

describe("TranscriptList memoization", () => {
  it("re-renders only the active row on a currentTime tick that does not change which segment/word is active", () => {
    render(
      <TranscriptList
        transcript={SEGMENTS}
        transcriptLoading={false}
        isActiveAudio={true}
        onTimeClick={onTimeClick}
        onEditSegment={onEditSegment}
      />
    )

    // 推进到 segment b 的 word "foo"（[2,3]）窗口内
    act(() => useAudioStore.setState({ currentTime: 2.5 }))
    const baseline = { a: renderCount("a"), b: renderCount("b"), c: renderCount("c") }

    // 同一个 word 窗口内再前进一帧：只有 activeWordProgress 变（0.5→0.6），高亮的段/词不变
    act(() => useAudioStore.setState({ currentTime: 2.6 }))

    // 非高亮行 a、c 的 props 完全未变 → memo 跳过，渲染次数不增
    expect(renderCount("a")).toBe(baseline.a)
    expect(renderCount("c")).toBe(baseline.c)
    // 高亮行 b 因 activeWordProgress 变化而重渲染一次
    expect(renderCount("b")).toBe(baseline.b + 1)
  })
})
