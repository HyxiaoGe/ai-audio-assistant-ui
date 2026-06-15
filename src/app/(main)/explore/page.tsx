import type { Metadata } from "next";
import { fetchPublicTaskList } from "@/lib/server-api";
import ExplorePageClient from "./page-client";

// 静态 metadata + canonical:探索广场是可收录的稳定入口页(canonical 指向自身相对路径)。
export const metadata: Metadata = {
  title: "探索广场 · AI 音视频助手",
  description: "浏览公开分享的音视频转写与智能摘要",
  alternates: { canonical: "/explore" },
};

const PAGE_SIZE = 20;

/**
 * 公开探索广场(async 服务器组件):服务端经容器内网 LAN 预取首屏列表(<10ms),
 * 消掉浏览器经 cloudflared 隧道的 ~1.5s 往返;预取失败(本地 dev 不在 docker 网络属常态)
 * 传 undefined,客户端 <PublicTaskList> 既有 loader 静默兜底。分页交互仍在客户端岛。
 */
export default async function ExplorePage() {
  const initial = await fetchPublicTaskList(1, PAGE_SIZE);
  return <ExplorePageClient initialItems={initial?.items} initialTotal={initial?.total} />;
}
