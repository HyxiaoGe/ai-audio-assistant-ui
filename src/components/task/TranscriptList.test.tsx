import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useAudioStore } from "@/store/audio-store"
import { TranscriptList, type DisplayTranscriptSegment } from "./TranscriptList"

// TranscriptList 拥有 currentTime 订阅 + 高亮派生 + 自动滚动，是把 per-tick 重渲染
// 从 2788 行的 TaskDetail 里隔离出来的核心 seam。这里锁定它必须保留的行为。

vi.mock("@/lib/i18n-context", () => ({
  useI18n: () => ({ t: (k: string) => k, locale: "zh" }),
}))

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

const SEGMENTS: DisplayTranscriptSegment[] = [
  seg({
    id: "a",
    startTime: "00:00",
    endTime: "00:02",
    startSeconds: 0,
    endSeconds: 2,
    words: [
      { word: "hello", start_time: 0, end_time: 1, confidence: null },
      { word: "world", start_time: 1, end_time: 2, confidence: null },
    ],
  }),
  seg({
    id: "b",
    startTime: "00:02",
    endTime: "00:04",
    startSeconds: 2,
    endSeconds: 4,
    words: [
      { word: "foo", start_time: 2, end_time: 3, confidence: null },
      { word: "bar", start_time: 3, end_time: 4, confidence: null },
    ],
  }),
  seg({
    id: "c",
    startTime: "00:04",
    endTime: "00:06",
    startSeconds: 4,
    endSeconds: 6,
    words: [
      { word: "baz", start_time: 4, end_time: 5, confidence: null },
      { word: "qux", start_time: 5, end_time: 6, confidence: null },
    ],
  }),
]

beforeEach(() => {
  // jsdom 未实现 scrollIntoView；自动滚动副作用会调用它，补一个桩。
  Element.prototype.scrollIntoView = vi.fn()
  act(() => {
    useAudioStore.setState({ currentTime: 0, src: null, isPlaying: false })
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

function renderList(props: Partial<React.ComponentProps<typeof TranscriptList>> = {}) {
  return render(
    <TranscriptList
      transcript={SEGMENTS}
      transcriptLoading={false}
      isActiveAudio={true}
      onTimeClick={props.onTimeClick ?? vi.fn()}
      onEditSegment={props.onEditSegment ?? vi.fn()}
      {...props}
    />
  )
}

describe("TranscriptList", () => {
  it("highlights the word under currentTime and moves the highlight as playback advances", () => {
    const { container } = renderList()

    act(() => useAudioStore.setState({ currentTime: 2.5 }))
    let active = container.querySelector(".transcript-word-active")
    expect(active?.textContent?.trim()).toBe("foo")

    act(() => useAudioStore.setState({ currentTime: 4.5 }))
    active = container.querySelector(".transcript-word-active")
    expect(active?.textContent?.trim()).toBe("baz")
  })

  it("scrolls the active segment's row into view as playback enters it", () => {
    const scrollSpy = vi.fn()
    Element.prototype.scrollIntoView = scrollSpy
    const { container } = renderList()

    // 推进到 segment b（[2,4]）区间内，应当把 b 这一行滚动到可见位置
    act(() => useAudioStore.setState({ currentTime: 2.5 }))

    // 断言 scrollIntoView 被调用在 segment b 的行容器上（用 data-segment-id 定位 DOM 节点）
    const target = scrollSpy.mock.contexts[scrollSpy.mock.contexts.length - 1]
    const segmentB = container.querySelector('[data-segment-id="b"]')
    expect(segmentB).not.toBeNull()
    expect(target).toBe(segmentB)
  })

  it("does not highlight anything when the audio is not this task's (isActiveAudio=false)", () => {
    const { container } = renderList({ isActiveAudio: false })

    act(() => useAudioStore.setState({ currentTime: 2.5 }))
    expect(container.querySelector(".transcript-word-active")).toBeNull()
  })

  it("calls onTimeClick with the segment start time when its timestamp is clicked", () => {
    const onTimeClick = vi.fn()
    renderList({ onTimeClick })

    fireEvent.click(screen.getByText("(00:02 - 00:04)"))
    expect(onTimeClick).toHaveBeenCalledWith("00:02")
  })

  it("calls onEditSegment with (segmentId, newContent) when a row is edited and saved", () => {
    const onEditSegment = vi.fn()
    const { container } = renderList({ onEditSegment })

    // 第一行（id="a"）：hover 显出编辑按钮 → 进入编辑 → 改文本 → 保存
    const firstRow = container.querySelector("div.px-4.py-4") as HTMLElement
    fireEvent.mouseEnter(firstRow)
    fireEvent.click(screen.getByText("common.edit"))
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "edited text" } })
    fireEvent.click(screen.getByText("common.save"))

    expect(onEditSegment).toHaveBeenCalledWith("a", "edited text")
  })
})
