import { beforeEach, describe, expect, it } from "vitest";
import { useUIStore } from "./ui-store";

beforeEach(() => {
  useUIStore.setState({ loginOpen: false, newTaskOpen: false, newTaskInitial: undefined });
});

describe("ui-store login modal", () => {
  it("opens and closes the login modal", () => {
    useUIStore.getState().openLogin();
    expect(useUIStore.getState().loginOpen).toBe(true);
    useUIStore.getState().closeLogin();
    expect(useUIStore.getState().loginOpen).toBe(false);
  });
});

describe("ui-store new-task modal", () => {
  it("opens with no initial payload", () => {
    useUIStore.getState().openNewTask();
    expect(useUIStore.getState().newTaskOpen).toBe(true);
    expect(useUIStore.getState().newTaskInitial).toBeUndefined();
  });

  it("carries a YouTube video context payload", () => {
    useUIStore.getState().openNewTask({ initialYouTubeVideoId: "abc123" });
    expect(useUIStore.getState().newTaskInitial).toEqual({ initialYouTubeVideoId: "abc123" });
  });

  it("clears the initial payload on close", () => {
    useUIStore.getState().openNewTask({ initialVideoUrl: "https://youtu.be/x" });
    useUIStore.getState().closeNewTask();
    expect(useUIStore.getState().newTaskOpen).toBe(false);
    expect(useUIStore.getState().newTaskInitial).toBeUndefined();
  });
});
