import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import UploadZone from "@/components/task/UploadZone";

vi.mock("@/lib/i18n-context", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

const createFile = (name: string, type: string) =>
  new File(["file"], name, { type });

describe("UploadZone", () => {
  it("calls onFileSelect when a file is chosen via input", () => {
    const onFileSelect = vi.fn();
    render(<UploadZone onFileSelect={onFileSelect} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = createFile("audio.mp3", "audio/mpeg");

    fireEvent.change(input, { target: { files: [file] } });
    expect(onFileSelect).toHaveBeenCalledWith(file);
  });

  it("calls onFileSelect on valid drop", () => {
    const onFileSelect = vi.fn();
    render(<UploadZone onFileSelect={onFileSelect} />);

    const file = createFile("video.mp4", "video/mp4");
    const dropZone = screen.getByText("upload.dropHere").closest("div");

    fireEvent.drop(dropZone as HTMLElement, {
      dataTransfer: { files: [file] },
    });

    expect(onFileSelect).toHaveBeenCalledWith(file);
  });

  it("shows uploaded file info when uploadedFile is set", () => {
    const file = new File(["1234567890"], "clip.wav", { type: "audio/wav" });
    render(<UploadZone onFileSelect={() => {}} uploadedFile={file} />);

    expect(screen.getByText("clip.wav")).toBeInTheDocument();
    expect(screen.getByText("10 B")).toBeInTheDocument();
  });
});

// audit a11y #17：拖拽区是 <div onClick> 触发隐藏 file input，但无 role/tabIndex/键盘。
describe("UploadZone a11y", () => {
  it("exposes the dropzone as a labelled, focusable button", () => {
    render(<UploadZone onFileSelect={vi.fn()} />);
    const zone = screen.getByRole("button", { name: "upload.selectFile" });
    expect(zone).toHaveAttribute("tabindex", "0");
  });

  it("opens the file picker on Enter and Space", () => {
    const clickSpy = vi
      .spyOn(HTMLInputElement.prototype, "click")
      .mockImplementation(() => {});
    render(<UploadZone onFileSelect={vi.fn()} />);
    const zone = screen.getByRole("button", { name: "upload.selectFile" });

    fireEvent.keyDown(zone, { key: "Enter" });
    expect(clickSpy).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(zone, { key: " " });
    expect(clickSpy).toHaveBeenCalledTimes(2);

    clickSpy.mockRestore();
  });

  it("does not open the file picker on non-activation keys", () => {
    const clickSpy = vi
      .spyOn(HTMLInputElement.prototype, "click")
      .mockImplementation(() => {});
    render(<UploadZone onFileSelect={vi.fn()} />);
    const zone = screen.getByRole("button", { name: "upload.selectFile" });

    fireEvent.keyDown(zone, { key: "Tab" });
    fireEvent.keyDown(zone, { key: "a" });
    fireEvent.keyDown(zone, { key: "Escape" });
    expect(clickSpy).not.toHaveBeenCalled();

    clickSpy.mockRestore();
  });

  it("removes the hidden file input from the tab order and a11y tree", () => {
    render(<UploadZone onFileSelect={vi.fn()} />);
    const input = document.querySelector('input[type="file"]');
    expect(input).toHaveAttribute("tabindex", "-1");
    expect(input).toHaveAttribute("aria-hidden", "true");
  });

  it("exposes no dropzone button while uploading", () => {
    render(
      <UploadZone onFileSelect={vi.fn()} isUploading uploadProgress={40} />
    );
    expect(
      screen.queryByRole("button", { name: "upload.selectFile" })
    ).toBeNull();
  });

  it("exposes no dropzone button once a file is uploaded", () => {
    const file = new File(["1234"], "clip.wav", { type: "audio/wav" });
    render(<UploadZone onFileSelect={vi.fn()} uploadedFile={file} />);
    expect(
      screen.queryByRole("button", { name: "upload.selectFile" })
    ).toBeNull();
  });
});
