import { render } from "@testing-library/react"
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import GlobalAudioPlayer from "./GlobalAudioPlayer"
import { useAudioStore } from "@/store/audio-store"

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
