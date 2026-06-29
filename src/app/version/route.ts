// 前端自有版本端点:由 Next standalone 服务器响应,返回当前运行构建的 SHA。
// force-dynamic + no-store 防止任何缓存层在重新部署后仍吐旧值。
export const dynamic = "force-dynamic"

export function GET(): Response {
  return Response.json(
    { version: process.env.NEXT_PUBLIC_BUILD_SHA || "dev" },
    { headers: { "Cache-Control": "no-store" } },
  )
}
