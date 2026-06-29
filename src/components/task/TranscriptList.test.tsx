import { act, fireEvent, render, screen, within } from "@testing-library/react"
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
  vi.useRealTimers()
  vi.unstubAllGlobals()
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

  // ───────────────────────────────────────────────────────────────────────────
  // 深链跳播「定位」根因(4 次修复后由 ADBG 坐标实锤):转写每行 content-visibility:auto +
  // contain-intrinsic-size:auto 100px,未渲染行按 100px 估算。behavior:'smooth' 的大跨度
  // scrollIntoView 会逐帧「穿过」沿途约 960 行 → 每行首次渲染、真实高度(~103px)替换估算 →
  // 文档被撑高 ~3000px → 固定终点的平滑滚动结构性「欠冲」(ADBG:首滚落定后目标 rect.top 仍偏 +3448)。
  // 此前几次 resume-timer 重滚其实在对「已长高布局」重新测量、逐步收敛(3448→547→~0),是位置收敛的
  // 承重梁;ui#98 用 scrollend 砍掉这些重滚后,欠冲暴露=只滚一次但落点错。修复:改「瞬时跳转
  // (behavior:'auto')+有界 rAF 重定位收敛」。瞬时跳转不穿过中间行 → 不撑高文档 → 落点即居中,仅剩
  // 目标周围约一个视口的小残差,由 rAF 循环按 rect 差(非 rect.top vs scrollTop)测量并收敛。
  // 以下用例钉死控制流(jsdom 无真实布局,真浏览器视觉由人工验证)。

  // 可控 rAF:手动队列,flush 一代回调即「跑一帧」。各 step 末尾自排下一帧,故 flush N 次 = N 帧。
  function installRaf() {
    const cbs = new Map<number, FrameRequestCallback>()
    let id = 0
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      id += 1
      cbs.set(id, cb)
      return id
    })
    vi.stubGlobal("cancelAnimationFrame", (rid: number) => {
      cbs.delete(rid)
    })
    const runGen = () => {
      const snapshot = [...cbs.values()]
      cbs.clear()
      act(() => {
        for (const cb of snapshot) cb(0)
      })
    }
    return {
      pending: () => cbs.size,
      flush: runGen,
      flushAll: (max = 80) => {
        let n = 0
        while (cbs.size && n < max) {
          runGen()
          n += 1
        }
      },
    }
  }

  // 直接给目标行/容器装上可控几何:drift = (nodeTop - containerTop) - (clientHeight - nodeHeight)/2。
  // 取 containerTop=0、clientHeight=600、nodeHeight=100 → 期望居中位 250 → drift = nodeTop - 250。
  function mockGeometry(sc: HTMLElement, node: HTMLElement, nodeTop: () => number) {
    Object.defineProperty(sc, "clientHeight", { value: 600, configurable: true })
    vi.spyOn(sc, "getBoundingClientRect").mockReturnValue({
      top: 0, left: 0, right: 0, bottom: 600, width: 0, height: 600, x: 0, y: 0, toJSON() {},
    } as DOMRect)
    vi.spyOn(node, "getBoundingClientRect").mockImplementation(() => {
      const top = nodeTop()
      return { top, left: 0, right: 0, bottom: top + 100, width: 0, height: 100, x: 0, y: top, toJSON() {} } as DOMRect
    })
  }
  // 让目标行的 rect.top 对应一个指定的 |drift|(像素)。
  const DRIFT = (px: number) => 250 + px

  // 核心回归 #1:深链是「瞬时」跳转(behavior:'auto'),不是平滑滑入——平滑正是欠冲漂移的成因。
  it("deep-links with an INSTANT scroll (behavior:auto), not a smooth glide", () => {
    const scrollSpy = vi.fn()
    Element.prototype.scrollIntoView = scrollSpy
    installRaf()
    const { container } = renderList({ transcript: farSegments() })
    const node = container.querySelector('[data-segment-id="p"]') as HTMLElement
    const sc = container.querySelector(".overflow-y-auto") as HTMLElement
    mockGeometry(sc, node, () => DRIFT(4)) // 已基本居中,聚焦「首滚是 auto」

    act(() => useAudioStore.setState({ currentTime: 101 }))

    expect(scrollSpy).toHaveBeenCalledTimes(1)
    expect(scrollSpy.mock.calls[0][0]).toMatchObject({ behavior: "auto", block: "center" })
  })

  // 核心回归 #2:rAF 收敛——首滚后残差(content-visibility 局部重估)会被逐帧重定位吸收直至居中。
  it("re-centers across rAF frames until the target is centered (convergence absorbs content-visibility drift)", () => {
    const scrollSpy = vi.fn()
    Element.prototype.scrollIntoView = scrollSpy
    const raf = installRaf()
    const { container } = renderList({ transcript: farSegments() })
    const node = container.querySelector('[data-segment-id="p"]') as HTMLElement
    const sc = container.querySelector(".overflow-y-auto") as HTMLElement
    // 模拟 ADBG 实测序列:首滚后残差 3448 → 547 → ~0(收敛)。
    let top = DRIFT(3448)
    mockGeometry(sc, node, () => top)

    act(() => useAudioStore.setState({ currentTime: 101 })) // 初次瞬时跳转
    expect(scrollSpy).toHaveBeenCalledTimes(1)

    raf.flush() // 帧1:drift 3448 → 重定位
    top = DRIFT(547)
    raf.flush() // 帧2:drift 547 → 重定位
    top = DRIFT(4)
    raf.flush() // 帧3:drift 4 ≤ TOL → 收敛退出,不再滚动

    expect(scrollSpy).toHaveBeenCalledTimes(3)
    for (const call of scrollSpy.mock.calls) expect(call[0]).toMatchObject({ behavior: "auto" })
    raf.flushAll()
    expect(scrollSpy).toHaveBeenCalledTimes(3) // 收敛后不再有追加帧
  })

  // 播放跟随(目标已近居中):退化为一次瞬时滚动,无收敛追加帧。
  it("does a single instant scroll with no extra frames when the target is already centered (playback follow)", () => {
    const scrollSpy = vi.fn()
    Element.prototype.scrollIntoView = scrollSpy
    const raf = installRaf()
    const { container } = renderList({ transcript: farSegments() })
    const node = container.querySelector('[data-segment-id="p"]') as HTMLElement
    const sc = container.querySelector(".overflow-y-auto") as HTMLElement
    mockGeometry(sc, node, () => DRIFT(1)) // drift 1 ≤ TOL

    act(() => useAudioStore.setState({ currentTime: 101 }))
    expect(scrollSpy).toHaveBeenCalledTimes(1)
    raf.flushAll()
    expect(scrollSpy).toHaveBeenCalledTimes(1)
  })

  // 终止性:漂移始终不收敛时,由帧上限收口,绝不无限滚动。
  it("bounds the convergence loop to a finite number of frames when drift never settles", () => {
    const scrollSpy = vi.fn()
    Element.prototype.scrollIntoView = scrollSpy
    const raf = installRaf()
    const { container } = renderList({ transcript: farSegments() })
    const node = container.querySelector('[data-segment-id="p"]') as HTMLElement
    const sc = container.querySelector(".overflow-y-auto") as HTMLElement
    // 严格递减但始终远大于 TOL:停滞守卫不触发,只能由帧上限收口。
    let top = DRIFT(5000)
    mockGeometry(sc, node, () => {
      const v = top
      top -= 1
      return v
    })

    act(() => useAudioStore.setState({ currentTime: 101 }))
    raf.flushAll(200)

    // 初次(1)+ 帧上限(MAX=30)次重定位后停止。
    expect(scrollSpy).toHaveBeenCalledTimes(31)
    const settled = scrollSpy.mock.calls.length
    raf.flushAll(50)
    expect(scrollSpy).toHaveBeenCalledTimes(settled)
  })

  // 停滞守卫:漂移连续两帧不再下降即提前退出,远早于帧上限——防止病态布局下的可见抖动。
  it("exits early (well before the frame cap) when drift stops decreasing (stall guard)", () => {
    const scrollSpy = vi.fn()
    Element.prototype.scrollIntoView = scrollSpy
    const raf = installRaf()
    const { container } = renderList({ transcript: farSegments() })
    const node = container.querySelector('[data-segment-id="p"]') as HTMLElement
    const sc = container.querySelector(".overflow-y-auto") as HTMLElement
    mockGeometry(sc, node, () => DRIFT(1000)) // 恒定 drift,从不下降

    act(() => useAudioStore.setState({ currentTime: 101 }))
    raf.flushAll(200)

    // 初次(1)+ 两帧未改善 → 停滞退出,共 3 次,远小于帧上限 31。
    expect(scrollSpy).toHaveBeenCalledTimes(3)
  })

  // masking 不变量:程序化收敛在途时,容器自身派发的 scroll(我们自己的瞬时滚动)绝不能被当成用户滚动。
  it("ignores container scroll events emitted during programmatic convergence (no pause, no second positioning)", () => {
    vi.useFakeTimers()
    const scrollSpy = vi.fn()
    Element.prototype.scrollIntoView = scrollSpy
    installRaf()
    const { container } = renderList({ transcript: farSegments() })
    const node = container.querySelector('[data-segment-id="p"]') as HTMLElement
    const sc = container.querySelector(".overflow-y-auto") as HTMLElement
    mockGeometry(sc, node, () => DRIFT(3448)) // 收敛在途(flag 保持真,不 flush rAF)

    act(() => useAudioStore.setState({ currentTime: 101 }))
    expect(scrollSpy).toHaveBeenCalledTimes(1)

    act(() => {
      sc.dispatchEvent(new Event("scroll"))
    })
    act(() => {
      vi.advanceTimersByTime(3500)
    })
    expect(scrollSpy).toHaveBeenCalledTimes(1) // 不暂停、不排恢复、不二次定位
    vi.useRealTimers()
  })

  // 不变量守卫:收敛结束清旗后,真实用户滚动仍要「暂停自动跟随 → 3s 后恢复」。
  it("after convergence clears the flag, a genuine user scroll pauses auto-follow and resumes after 3s", () => {
    vi.useFakeTimers()
    const scrollSpy = vi.fn()
    Element.prototype.scrollIntoView = scrollSpy
    const raf = installRaf()
    const { container } = renderList({ transcript: farSegments() })
    const node = container.querySelector('[data-segment-id="p"]') as HTMLElement
    const sc = container.querySelector(".overflow-y-auto") as HTMLElement
    mockGeometry(sc, node, () => DRIFT(4)) // 首帧即收敛清旗

    act(() => useAudioStore.setState({ currentTime: 101 }))
    raf.flushAll()
    expect(scrollSpy).toHaveBeenCalledTimes(1)

    act(() => {
      sc.dispatchEvent(new Event("scroll")) // 用户真实滚动(flag 已清)→ 暂停
    })
    act(() => useAudioStore.setState({ currentTime: 103 })) // 段 q,暂停窗口内不滚
    expect(scrollSpy).toHaveBeenCalledTimes(1)

    act(() => {
      vi.advanceTimersByTime(3000) // 3s 后恢复 → 滚到 q
    })
    expect(scrollSpy).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })

  // 用户手势(wheel)在收敛在途时直接中止循环(原生 smooth 会被用户输入打断,手写 rAF 须显式接线)。
  it("aborts an in-flight convergence when the user scrolls with a gesture (wheel)", () => {
    const scrollSpy = vi.fn()
    Element.prototype.scrollIntoView = scrollSpy
    const raf = installRaf()
    const { container } = renderList({ transcript: farSegments() })
    const node = container.querySelector('[data-segment-id="p"]') as HTMLElement
    const sc = container.querySelector(".overflow-y-auto") as HTMLElement
    let top = DRIFT(3448)
    mockGeometry(sc, node, () => top)

    act(() => useAudioStore.setState({ currentTime: 101 }))
    raf.flush() // 帧1:重定位(2),排帧2
    expect(scrollSpy).toHaveBeenCalledTimes(2)
    expect(raf.pending()).toBe(1)

    act(() => {
      sc.dispatchEvent(new Event("wheel")) // 用户手势 → 中止收敛
    })
    expect(raf.pending()).toBe(0)

    top = DRIFT(547)
    raf.flushAll()
    expect(scrollSpy).toHaveBeenCalledTimes(2) // 中止后无追加重定位
  })

  // 重入:活动段在收敛途中改变(新深链/播放推进)须先拆掉旧循环,绝不让两个循环争用 scrollTop。
  it("tears down the previous convergence loop when the active segment changes mid-flight (no two loops)", () => {
    const scrollSpy = vi.fn()
    Element.prototype.scrollIntoView = scrollSpy
    const raf = installRaf()
    const { container } = renderList({ transcript: farSegments() })
    const nodeP = container.querySelector('[data-segment-id="p"]') as HTMLElement
    const nodeQ = container.querySelector('[data-segment-id="q"]') as HTMLElement
    const sc = container.querySelector(".overflow-y-auto") as HTMLElement
    mockGeometry(sc, nodeP, () => DRIFT(3448)) // p 持续欠冲
    vi.spyOn(nodeQ, "getBoundingClientRect").mockReturnValue({
      top: DRIFT(1), left: 0, right: 0, bottom: DRIFT(1) + 100, width: 0, height: 100, x: 0, y: DRIFT(1), toJSON() {},
    } as DOMRect)

    act(() => useAudioStore.setState({ currentTime: 101 })) // 滚 p(1),收敛在途
    raf.flush() // 帧1 p:重定位(2),排 p 帧2
    expect(raf.pending()).toBe(1)

    act(() => useAudioStore.setState({ currentTime: 103 })) // 活动段切到 q → 取消旧 p 循环,滚 q(3)
    raf.flushAll()

    const pCalls = scrollSpy.mock.contexts.filter((c) => c === nodeP).length
    expect(pCalls).toBe(2) // p 仅:初次 + 帧1,之后被取消不再追加
  })

  // 卸载安全:在途 rAF 须被取消,即使强行 flush 也不滚动已脱离的节点、不抛错。
  it("cancels in-flight convergence on unmount without scrolling a detached node", () => {
    const scrollSpy = vi.fn()
    Element.prototype.scrollIntoView = scrollSpy
    const raf = installRaf()
    const { container, unmount } = renderList({ transcript: farSegments() })
    const node = container.querySelector('[data-segment-id="p"]') as HTMLElement
    const sc = container.querySelector(".overflow-y-auto") as HTMLElement
    mockGeometry(sc, node, () => DRIFT(3448))

    act(() => useAudioStore.setState({ currentTime: 101 }))
    expect(raf.pending()).toBe(1)

    unmount()
    const before = scrollSpy.mock.calls.length
    expect(() => raf.flushAll()).not.toThrow()
    expect(scrollSpy).toHaveBeenCalledTimes(before)
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
    // UX-13 后编辑按钮始终渲染(每行都在 DOM),须把查询限定到当前行,否则多行命中报错。
    fireEvent.click(within(firstRow).getByText("common.edit"))
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

  // 只读视图且无真实 onRetry(如管理员看他人任务,retry 仅退化为整页刷新)→ 不渲染「重试」按钮。
  it("hides retry in readOnly view with no real onRetry handler — error state (admin view)", () => {
    renderList({ transcript: [], transcriptError: true, onRetry: undefined, readOnly: true })
    expect(screen.getByText("task.transcriptLoadFailed")).not.toBeNull()
    expect(screen.queryByText("common.retry")).toBeNull()
  })

  it("hides retry in readOnly view with no real onRetry handler — neutral empty state (admin view)", () => {
    renderList({ transcript: [], transcriptError: false, onRetry: undefined, readOnly: true })
    expect(screen.getByText("task.transcriptEmpty")).not.toBeNull()
    expect(screen.queryByText("common.retry")).toBeNull()
  })

  // 只读但调用方显式接了真实 onRetry(如公开查看器 = 重新拉取转写,纯读动作)→ 保留「重试」。
  it("keeps a real onRetry in readOnly view (public viewer refetch)", () => {
    const onRetry = vi.fn()
    renderList({ transcript: [], transcriptError: true, onRetry, readOnly: true })
    fireEvent.click(screen.getByText("common.retry"))
    expect(onRetry).toHaveBeenCalledTimes(1)
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
