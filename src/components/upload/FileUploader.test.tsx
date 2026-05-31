import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { FileUploader } from "./FileUploader"

// audit a11y #18：默认状态拖拽区是 <div onClick> 触发隐藏 file input，无 role/tabIndex/键盘，
// input 无 label。键盘用户无法打开文件选择对话框上传文件。
vi.mock("@/lib/i18n-context", () => ({
  useI18n: () => ({ t: (k: string) => k, locale: "en" }),
}))

// 可变 mock：默认 idle；负向用例按需切换到 uploading / success 等状态。
const hook = vi.hoisted(() => ({
  current: {
    state: {
      stage: "idle" as string,
      file: null as File | null,
      progress: 0,
      error: null as string | null,
    },
    uploadFile: () => {},
    reset: () => {},
    isUploading: false,
  },
}))
const resetHook = () => {
  hook.current = {
    state: { stage: "idle", file: null, progress: 0, error: null },
    uploadFile: () => {},
    reset: () => {},
    isUploading: false,
  }
}
vi.mock("@/hooks/use-file-upload", () => ({
  useFileUpload: () => hook.current,
}))

afterEach(() => {
  vi.restoreAllMocks()
  resetHook()
})

describe("FileUploader a11y", () => {
  it("exposes the dropzone as a labelled, focusable button", () => {
    render(<FileUploader />)
    const zone = screen.getByRole("button", { name: "upload.selectFile" })
    expect(zone).toHaveAttribute("tabindex", "0")
  })

  it("opens the file picker on keyboard activation", () => {
    const clickSpy = vi
      .spyOn(HTMLInputElement.prototype, "click")
      .mockImplementation(() => {})
    render(<FileUploader />)
    const zone = screen.getByRole("button", { name: "upload.selectFile" })

    fireEvent.keyDown(zone, { key: "Enter" })
    expect(clickSpy).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(zone, { key: " " })
    expect(clickSpy).toHaveBeenCalledTimes(2)

    clickSpy.mockRestore()
  })

  it("does not open the file picker on non-activation keys", () => {
    const clickSpy = vi
      .spyOn(HTMLInputElement.prototype, "click")
      .mockImplementation(() => {})
    render(<FileUploader />)
    const zone = screen.getByRole("button", { name: "upload.selectFile" })

    fireEvent.keyDown(zone, { key: "Tab" })
    fireEvent.keyDown(zone, { key: "a" })
    fireEvent.keyDown(zone, { key: "Escape" })
    expect(clickSpy).not.toHaveBeenCalled()

    clickSpy.mockRestore()
  })

  it("removes the hidden file input from the tab order and a11y tree", () => {
    render(<FileUploader />)
    const input = document.querySelector('input[type="file"]')
    expect(input).toHaveAttribute("tabindex", "-1")
    expect(input).toHaveAttribute("aria-hidden", "true")
  })

  it("exposes no dropzone button while uploading", () => {
    hook.current.state = {
      stage: "uploading",
      file: new File(["x"], "clip.mp3", { type: "audio/mpeg" }),
      progress: 40,
      error: null,
    }
    hook.current.isUploading = true
    render(<FileUploader />)
    expect(
      screen.queryByRole("button", { name: "upload.selectFile" })
    ).toBeNull()
  })

  it("exposes no dropzone button after a successful upload", () => {
    hook.current.state = {
      stage: "success",
      file: new File(["x"], "clip.mp3", { type: "audio/mpeg" }),
      progress: 100,
      error: null,
    }
    render(<FileUploader />)
    expect(
      screen.queryByRole("button", { name: "upload.selectFile" })
    ).toBeNull()
  })
})
