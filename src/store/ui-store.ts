import { create } from "zustand";

export interface NewTaskInitial {
  initialVideoUrl?: string;
  initialYouTubeVideoId?: string;
}

interface UIStore {
  loginOpen: boolean;
  newTaskOpen: boolean;
  newTaskInitial?: NewTaskInitial;
  openLogin: () => void;
  closeLogin: () => void;
  openNewTask: (initial?: NewTaskInitial) => void;
  closeNewTask: () => void;
}

/**
 * 全局瞬时 UI 态：登录 / 新建任务模态开关 + 新建初值（订阅频道触发转写时携带视频上下文）。
 * action 身份天然稳定，替代原先每个 page.tsx 为防拉取风暴手写的 useCallback/useRef 样板。
 * 纯 UI 态，不持久化。
 */
export const useUIStore = create<UIStore>((set) => ({
  loginOpen: false,
  newTaskOpen: false,
  newTaskInitial: undefined,
  openLogin: () => set({ loginOpen: true }),
  closeLogin: () => set({ loginOpen: false }),
  openNewTask: (initial) => set({ newTaskOpen: true, newTaskInitial: initial }),
  closeNewTask: () => set({ newTaskOpen: false, newTaskInitial: undefined }),
}));
