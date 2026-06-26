import { create } from "zustand";
import type { VideoHit } from "@/types/api";

interface DiscoverStore {
  query: string; // 上一次「执行过」的搜索词(非输入草稿)
  hits: VideoHit[]; // 上一次搜索结果快照
  searched: boolean; // 是否已发起过搜索(用于区分空结果 vs 初始态)
  saveSearch: (query: string, hits: VideoHit[]) => void;
  reset: () => void;
}

/**
 * /discover 搜索态的会话级缓存。
 *
 * 为什么需要它:/discover 是独立 route segment,侧栏切走会卸载组件、本地 useState 全丢,
 * 再切回搜索词与结果就没了。任务搜索靠 URL `?q=` 还原,但那依赖详情↔列表的 back 往返;
 * /discover 点「转写」开的是模态(不卸载),唯一卸载路径是侧栏切换,而侧栏链接是干净的
 * `/discover`(不带 q),URL 方案救不到。故把「上一次执行的搜索」快照提到模块单例 store:
 * 无论以何种方式切回都即时还原、零网络(后端本就有 6h 缓存,这里连那次重查都省了)。
 *
 * 仅缓存「执行过」的搜索(query+hits 一起存,保证还原后词与结果一致);输入草稿不入缓存。
 * 纯内存(SPA 会话内有效),不跨硬刷新持久化——「切 tab 再回来」无需到那一步。
 */
export const useDiscoverStore = create<DiscoverStore>((set) => ({
  query: "",
  hits: [],
  searched: false,
  saveSearch: (query, hits) => set({ query, hits, searched: true }),
  reset: () => set({ query: "", hits: [], searched: false }),
}));
