"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAPIClient } from "@/lib/use-api-client";

/**
 * 直达公开详情(/explore/[id])时,若命中本人内容则跳到私有详情(/tasks/[id])。
 *
 * 覆盖「直达链接 / 书签」入口:服务端预取与首屏都走匿名通道(is_owner 恒 false),登录用户在此
 * 带 token 再拉一次详情拿到真实 is_owner;为 true 则 router.replace 到私有详情(用 replace 不留
 * 历史栈,返回键不会卡在跳板)。匿名用户(isAuthenticated=false)不触发;刷新失败静默降级,
 * 留在公开详情(归属跳转是体验增强,绝不能因刷新失败把人挡在外面)。
 */
export function usePublicOwnerRedirect(id: string, isAuthenticated: boolean): void {
  const client = useAPIClient();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    void (async () => {
      try {
        const detail = await client.getPublicTask(id, { authenticated: true });
        if (!cancelled && detail.is_owner) router.replace(`/tasks/${id}`);
      } catch {
        // 静默降级:留在公开详情。
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, isAuthenticated, client, router]);
}
