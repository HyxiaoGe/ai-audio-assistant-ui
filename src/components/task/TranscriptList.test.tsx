import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useAudioStore } from "@/store/audio-store"
import { TranscriptList } from "./TranscriptList"
import type { DisplayTranscriptSegment } from "@/lib/transcript-mapping"

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

  // 复用:深链跳播测试用「从 100s 起」的段,使挂载时 currentTime=0 落在所有段之前 →
  // activeSegment=null → 挂载不滚动,干净隔离「深链跳入某段」这一次滚动(与真实 ADBG 一致)。
  function farSegments(): DisplayTranscriptSegment[] {
    return [
      seg({ id: "p", startSeconds: 100, endSeconds: 102, words: [{ word: "p", start_time: 100, end_time: 102, confidence: null }] }),
      seg({ id: "q", startSeconds: 102, endSeconds: 104, words: [{ word: "q", start_time: 102, end_time: 104, confidence: null }] }),
    ]
  }

  // 回归核心(深链跳播「二次定位」根因):大跨度 smooth scrollIntoView 动画时长可达 ~1.5s,整段动画
  // 持续派发 scroll 事件。旧代码用「固定 300ms 计时器」清程序化标志,远短于动画时长,尾帧被误判为
  // 用户滚动 → 触发「3s 暂停 + 恢复」对同一活动段二次 scrollIntoView(用户看到「滑到位后等一会又滑
  // 一次」,ADBG 实测第二次滚动 reason='resume-timer')。修复改用权威的 scrollend 事件清旗:整段动画
  // 期间标志稳定保持,无第二次滚动。currentTime/activeSegment 全程未变。
  it("does not re-scroll when a long programmatic smooth scroll keeps emitting scroll frames (cleared by scrollend, not a timer)", () => {
    vi.useFakeTimers()
    const scrollSpy = vi.fn()
    Element.prototype.scrollIntoView = scrollSpy
    const { container } = renderList({ transcript: farSegments() })
    expect(scrollSpy).toHaveBeenCalledTimes(0) // 挂载不滚动

    // 深链落入段 p → 触发一次合法的自动滚动(effect)
    act(() => useAudioStore.setState({ currentTime: 101 }))
    expect(scrollSpy).toHaveBeenCalledTimes(1)

    const sc = container.querySelector(".overflow-y-auto") as HTMLElement
    expect(sc).not.toBeNull()

    // 平滑动画:~1.2s 内每 50ms 一帧 scroll。整段动画期间标志保持,这些帧不得被当成用户滚动。
    act(() => {
      for (let i = 0; i < 24; i += 1) {
        vi.advanceTimersByTime(50)
        sc.dispatchEvent(new Event("scroll"))
      }
    })
    // 动画真正停下 → 浏览器派发 scrollend,权威清旗。
    act(() => {
      sc.dispatchEvent(new Event("scrollend"))
    })
    // 再静默推进 >3s,给任何被(错误)安排的恢复定时器充分触发机会。
    act(() => {
      vi.advanceTimersByTime(3500)
    })

    expect(scrollSpy).toHaveBeenCalledTimes(1) // 不得二次定位
    vi.useRealTimers()
  })

  // 关键鲁棒性守卫(对抗审查发现的「帧间隔脆弱性」+ 防止退回任何短计时器方案):
  // 慢机/主线程卡顿时 smooth 动画两帧之间可能停顿很久(实测已见 230ms,卡顿更大)。只要 scrollend 未到、
  // 动画未结束,程序化标志就不能被某个短计时器提前清掉,否则下一帧会被误判为用户滚动 → 二次定位。
  // 本用例插入 1500ms 的「帧间停顿」——远超旧的固定 300ms 与曾试的 400ms 静默窗——只有 scrollend/宽松
  // 兜底方案能通过;任何 <1500ms 的计时阈值都会让它 FAIL。
  it("keeps the programmatic flag through a long inter-frame stall (immune to frame-gap timing; no second scroll)", () => {
    vi.useFakeTimers()
    const scrollSpy = vi.fn()
    Element.prototype.scrollIntoView = scrollSpy
    const { container } = renderList({ transcript: farSegments() })

    act(() => useAudioStore.setState({ currentTime: 101 }))
    expect(scrollSpy).toHaveBeenCalledTimes(1)

    const sc = container.querySelector(".overflow-y-auto") as HTMLElement
    // 动画中途主线程卡顿 1500ms(无帧、无 scrollend)——远超任何合理的短计时窗口。
    act(() => {
      vi.advanceTimersByTime(1500)
    })
    // 卡顿后动画恢复又来一帧:此刻标志必须仍为真,否则该帧会被误判为用户滚动 → 二次定位。
    act(() => {
      sc.dispatchEvent(new Event("scroll"))
    })
    // 动画结束 scrollend 清旗,再推进给恢复定时器机会。
    act(() => {
      sc.dispatchEvent(new Event("scrollend"))
      vi.advanceTimersByTime(3500)
    })

    expect(scrollSpy).toHaveBeenCalledTimes(1) // 帧间隔再大也不二次定位
    vi.useRealTimers()
  })

  // 不变量守卫 + scrollend 接线证明:scrollend 清旗后(程序化滚动已结束),真实用户滚动仍要
  // 「暂停自动跟随 → 3s 后恢复」。若 scrollend 未正确接线,标志会一直为真、用户滚动被吞,则下面
  // currentTime=103 会立刻滚到 q 使断言提前变 2 而失败——故本用例同时锁定 scrollend 必须清旗。
  it("clears the flag on scrollend so a genuine user scroll still pauses auto-follow and resumes after 3s", () => {
    vi.useFakeTimers()
    const scrollSpy = vi.fn()
    Element.prototype.scrollIntoView = scrollSpy
    const { container } = renderList({ transcript: farSegments() })

    act(() => useAudioStore.setState({ currentTime: 101 })) // effect 滚动 #1,flag=true
    expect(scrollSpy).toHaveBeenCalledTimes(1)

    const sc = container.querySelector(".overflow-y-auto") as HTMLElement
    // 程序化滚动结束 → scrollend 清旗
    act(() => {
      sc.dispatchEvent(new Event("scrollend"))
    })
    // 用户真实滚动(此刻 flag 已清)→ 暂停自动跟随
    act(() => {
      sc.dispatchEvent(new Event("scroll"))
    })
    // 播放推进到段 q:处于暂停窗口内,不应立即滚动(若 scrollend 没清旗,这里会变成 2 → 失败)
    act(() => useAudioStore.setState({ currentTime: 103 }))
    expect(scrollSpy).toHaveBeenCalledTimes(1)

    // 3s 后自动恢复,把当前活动段 q 滚入视图
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(scrollSpy).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })

  it("applies content-visibility classes to every row container so off-screen rows skip layout/paint", () => {
    // jsdom 不做真实布局,这里只锁定样式类存在(真浏览器视觉行为由人工验证):
    // content-visibility:auto 让视口外行跳过布局/绘制;contain-intrinsic-size 用
    // auto 100px 记忆真实尺寸,减少滚动锚定修正误触自动滚动暂停。
    const { container } = renderList()

    const rows = container.querySelectorAll("[data-segment-id]")
    expect(rows.length).toBe(SEGMENTS.length)
    for (const row of rows) {
      expect(row.className).toContain("[content-visibility:auto]")
      expect(row.className).toContain("[contain-intrinsic-size:auto_100px]")
    }
  })

  it("does not highlight anything when the audio is not this task's (isActiveAudio=false)", () => {
    const { container } = renderList({ isActiveAudio: false })

    act(() => useAudioStore.setState({ currentTime: 2.5 }))
    expect(container.querySelector(".transcript-word-active")).toBeNull()
  })

  // 转写段连续(prev.end == next.start，如 a[0,2] 与 b[2,4])。currentTime 正好落在边界 2 时，
  // 须归属"以它为起点"的那段(b)，而非"以它为终点"的那段(a)。否则从搜索命中深链跳播到段 start
  // 会停在上一段(实测:点「会接替库克」停在上一句)。这是边界判定的 off-by-one 回归守卫。
  it("activates the segment that STARTS at an exact contiguous boundary, not the one that ends there", () => {
    const { container } = renderList()

    act(() => useAudioStore.setState({ currentTime: 2 }))

    // 段 b 的首词 foo([2,3]) 应高亮，而非段 a 的末词 world([1,2])
    const active = container.querySelector(".transcript-word-active")
    expect(active?.textContent?.trim()).toBe("foo")
  })

  it("scrolls to the segment that STARTS at an exact contiguous boundary (deep-link to segment start)", () => {
    const scrollSpy = vi.fn()
    Element.prototype.scrollIntoView = scrollSpy
    const { container } = renderList()

    act(() => useAudioStore.setState({ currentTime: 2 }))

    const target = scrollSpy.mock.contexts[scrollSpy.mock.contexts.length - 1]
    expect(target).toBe(container.querySelector('[data-segment-id="b"]'))
  })

  // 不变量守卫:currentTime 落在段间空隙(prev.end < next.start)时,保持高亮上一段,不前跳到下一段。
  it("keeps the previous segment active when currentTime is in a gap before the next segment", () => {
    const gapped: DisplayTranscriptSegment[] = [
      seg({ id: "g0", startSeconds: 0, endSeconds: 2, words: [{ word: "x", start_time: 0, end_time: 2, confidence: null }] }),
      seg({ id: "g1", startSeconds: 4, endSeconds: 6, words: [{ word: "y", start_time: 4, end_time: 6, confidence: null }] }),
    ]
    const { container } = renderList({ transcript: gapped })

    act(() => useAudioStore.setState({ currentTime: 3 })) // 落在 [2,4) 空隙
    expect(container.querySelector(".transcript-word-active")?.textContent?.trim()).toBe("x")
  })

  // 重叠段(diarization 可能产生 prev.end > next.start):语义钉死为"以最新开始的段为准"(后段)。
  it("activates the later-starting segment in an overlap region", () => {
    const overlap: DisplayTranscriptSegment[] = [
      seg({ id: "o0", startSeconds: 0, endSeconds: 3, words: [{ word: "early", start_time: 0, end_time: 3, confidence: null }] }),
      seg({ id: "o1", startSeconds: 2, endSeconds: 5, words: [{ word: "late", start_time: 2, end_time: 5, confidence: null }] }),
    ]
    const { container } = renderList({ transcript: overlap })

    act(() => useAudioStore.setState({ currentTime: 2.5 })) // 落在 [2,3] 重叠区
    expect(container.querySelector(".transcript-word-active")?.textContent?.trim()).toBe("late")
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

describe("TranscriptList empty/error states", () => {
  // 回归核心：空转写不再一律显示写死的「任务处理失败」(errors.processFailedDesc)，
  // 而是区分「加载出错可重试」与「确实暂无内容」两种中性/可重试态。
  it("shows a retryable load-failed state (not the hardcoded 任务处理失败) when the fetch errored", () => {
    const onRetry = vi.fn()
    renderList({ transcript: [], transcriptError: true, onRetry })

    expect(screen.getByText("task.transcriptLoadFailed")).not.toBeNull()
    expect(screen.getByText("errors.networkFailedDesc")).not.toBeNull()
    // 关键回归断言：绝不再显示「任务处理失败，请重试」
    expect(screen.queryByText("errors.processFailedDesc")).toBeNull()

    fireEvent.click(screen.getByText("common.retry"))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it("shows a neutral empty state (not 任务处理失败) when fetch succeeded but returned no transcript", () => {
    const onRetry = vi.fn()
    renderList({ transcript: [], transcriptError: false, onRetry })

    expect(screen.getByText("task.transcriptEmpty")).not.toBeNull()
    expect(screen.getByText("task.transcriptEmptyDesc")).not.toBeNull()
    expect(screen.queryByText("errors.processFailedDesc")).toBeNull()

    fireEvent.click(screen.getByText("common.retry"))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it("falls back to a full reload when no onRetry is provided (backward compat)", () => {
    renderList({ transcript: [], transcriptError: true, onRetry: undefined })
    // 仅断言渲染出可重试态、不抛错；onRetry 缺省时退回 window.location.reload。
    expect(screen.getByText("task.transcriptLoadFailed")).not.toBeNull()
  })
})

describe("TranscriptList processing (生成中) state", () => {
  // 回归核心：任务仍在处理中（polishing/summarizing，转写尚未产出，后端返回 empty-success）
  // 不能显示「暂无内容」或「加载失败」，而应显示「转写生成中」，且不给重试按钮。
  it("shows 转写生成中 (no retry) when the task is still processing and transcript is empty", () => {
    const onRetry = vi.fn()
    renderList({ transcript: [], transcriptInProgress: true, transcriptError: false, onRetry })

    expect(screen.getByText("task.transcriptGenerating")).not.toBeNull()
    // 处理中绝不冤枉成「暂无内容」「加载失败」「任务处理失败」
    expect(screen.queryByText("task.transcriptEmpty")).toBeNull()
    expect(screen.queryByText("task.transcriptLoadFailed")).toBeNull()
    expect(screen.queryByText("errors.processFailedDesc")).toBeNull()
    // 生成中无可重试之物，不出现重试按钮
    expect(screen.queryByText("common.retry")).toBeNull()
  })

  it("prioritizes 生成中 over the load-failed state while still processing (no false failure)", () => {
    // 即使这一次拉取瞬态出错(transcriptError=true)，只要任务还没完成，也只显示「生成中」而非「加载失败」。
    renderList({ transcript: [], transcriptInProgress: true, transcriptError: true, onRetry: vi.fn() })

    expect(screen.getByText("task.transcriptGenerating")).not.toBeNull()
    expect(screen.queryByText("task.transcriptLoadFailed")).toBeNull()
    expect(screen.queryByText("common.retry")).toBeNull()
  })

  it("once completed (not in progress), still surfaces load-failed/empty states as before", () => {
    // transcriptInProgress=false 时退回 PR#64 行为：出错→加载失败可重试；空→暂无内容。
    const { rerender } = renderList({ transcript: [], transcriptInProgress: false, transcriptError: true, onRetry: vi.fn() })
    expect(screen.getByText("task.transcriptLoadFailed")).not.toBeNull()
    expect(screen.queryByText("task.transcriptGenerating")).toBeNull()

    rerender(
      <TranscriptList
        transcript={[]}
        transcriptLoading={false}
        isActiveAudio={true}
        onTimeClick={vi.fn()}
        onEditSegment={vi.fn()}
        transcriptInProgress={false}
        transcriptError={false}
        onRetry={vi.fn()}
      />
    )
    expect(screen.getByText("task.transcriptEmpty")).not.toBeNull()
    expect(screen.queryByText("task.transcriptGenerating")).toBeNull()
  })
})
