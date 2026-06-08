import { render } from "@testing-library/react"
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import GlobalAudioPlayer from "./GlobalAudioPlayer"
import { setEnsureCurrentMedia, useAudioStore } from "@/store/audio-store"

// audit MEDIUM [bugs]：播放进度恢复曾是死代码——持久化写 DOM 的 audio.src（绝对+token），
// 恢复时和 store.src（相对、无 token）直接比较，永不相等。这条用例锁定修复后的往返：
// 用「绝对+token」的持久值恢复「相对」的 store.src 应当成功（在旧代码上会失败/为死代码）。

beforeAll(() => {
  // jsdom 不真正实现媒体；把 currentTime 变成可读写属性，让测试只考验本组件逻辑。
  let current = 0
  Object.defineProperty(window.HTMLMediaElement.prototype, "currentTime", {
    configurable: true,
    get() {
      return current
    },
    set(value: number) {
      current = value
    },
  })
  window.HTMLMediaElement.prototype.load = vi.fn()
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)
  window.HTMLMediaElement.prototype.pause = vi.fn()
})

beforeEach(() => {
  localStorage.clear()
  useAudioStore.setState({
    audioEl: null,
    src: null,
    taskId: null,
    currentTime: 0,
    duration: 0,
    isPlaying: false,
  })
})

afterEach(() => {
  localStorage.clear()
})

describe("GlobalAudioPlayer progress restore", () => {
  it("restores a persisted position saved under the absolute+token src against the relative store src", () => {
    useAudioStore.setState({ src: "/api/v1/media/xyz", taskId: "task-1" })
    localStorage.setItem(
      "audio:progress:task-1",
      JSON.stringify({
        time: 42,
        updatedAt: Date.now(),
        src: "https://host.example/api/v1/media/xyz?token=OLD_TOKEN",
      })
    )

    render(<GlobalAudioPlayer />)

    expect(useAudioStore.getState().currentTime).toBe(42)
  })

  it("does not restore progress saved for different media", () => {
    useAudioStore.setState({ src: "/api/v1/media/xyz", taskId: "task-1" })
    localStorage.setItem(
      "audio:progress:task-1",
      JSON.stringify({
        time: 42,
        updatedAt: Date.now(),
        src: "https://host.example/api/v1/media/DIFFERENT?token=OLD_TOKEN",
      })
    )

    render(<GlobalAudioPlayer />)

    expect(useAudioStore.getState().currentTime).toBe(0)
  })
})

// 顶部播放条载着任务 A 的音频时，用户进入任务 B 详情页按空格，应播任务 B 而非 A。
// 详情页登记 ensureCurrentMedia，全局键盘处理在 toggle/seek 前调用它，必要时切到本页任务。
describe("GlobalAudioPlayer keyboard targets the viewed task", () => {
  afterEach(() => {
    setEnsureCurrentMedia(null) // 防止上下文泄漏到其他用例
  })

  function pressSpace() {
    const evt = new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true })
    window.dispatchEvent(evt)
  }

  it("space switches the store to the viewed task when a detail page is active", () => {
    useAudioStore.setState({ src: "/api/v1/media/taskA", taskId: "A" })
    render(<GlobalAudioPlayer />)
    // 模拟停留在任务 B 详情页：登记切到任务 B 的上下文
    setEnsureCurrentMedia(() => {
      useAudioStore.getState().setSource("/api/v1/media/taskB", "B")
    })

    pressSpace()

    expect(useAudioStore.getState().src).toBe("/api/v1/media/taskB")
    expect(useAudioStore.getState().taskId).toBe("B")
  })

  it("space acts on the loaded playbar audio when no detail page is active", () => {
    useAudioStore.setState({ src: "/api/v1/media/taskA", taskId: "A" })
    render(<GlobalAudioPlayer />)
    setEnsureCurrentMedia(null) // 列表页等：无上下文，不应切源

    pressSpace()

    expect(useAudioStore.getState().src).toBe("/api/v1/media/taskA")
  })
})
