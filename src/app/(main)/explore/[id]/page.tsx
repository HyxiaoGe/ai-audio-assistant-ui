import { notFound } from "next/navigation";
import { fetchPublicSummary, fetchPublicTaskDetail } from "@/lib/server-api";
import PublicTaskDetailPageClient from "./page-client";

/**
 * 公开详情页(async 服务器组件):服务端经容器内网 LAN 并发预取 detail/summary 两个公开接口
 * (<10ms),消掉浏览器经 cloudflared 隧道的两段 ~1.5s 往返;取数逻辑全部下沉在
 * src/lib/server-api.ts(可测),这里只做编排。
 *
 * - transcript 刻意不内嵌(硬约束):上千段转写进 RSC flight/SSR 会让 HTML 文档爆炸,
 *   仍走客户端拉取、与 hydration 并行;这也契合「摘要先显示、不等转写」的既有产品语义。
 * - 失败永不 500:预取失败(本地 dev 不在 docker 网络属常态)传 undefined,
 *   客户端既有 loader 静默兜底(无遥测,已接受取舍)。
 * - 唯一例外:detail 信封 40401(不存在/未公开/已收回)服务端直接 notFound(),
 *   比客户端闪一下 loading 再渲 notFound 态更对。
 * - 已接受取舍:Next Router Cache 默认 30s 内往返可见刚撤回任务(窗口极小,
 *   客户端 loader 重试仍会拉到 40401 纠正),别试图在此解决。
 */
export default async function PublicTaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [detail, summary] = await Promise.all([
    fetchPublicTaskDetail(id),
    fetchPublicSummary(id),
  ]);

  if (detail.status === "not_found") notFound();

  return (
    <PublicTaskDetailPageClient
      id={id}
      initialDetail={detail.status === "ok" ? detail.data : undefined}
      initialSummary={summary}
    />
  );
}
