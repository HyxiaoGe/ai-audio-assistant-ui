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
