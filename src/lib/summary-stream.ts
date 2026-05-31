// 摘要 SSE 流的共享脚手架，从 TaskDetail 的 regenerate / compare 两套引擎抽出
// （audit #8 子步骤 ④）。两套引擎的 payload 处理逻辑各异（单缓冲+图片 vs 多模型
// upsert），不强行合并；这里只收敛它们逐字复制的连接/错误脚手架，消除漂移风险。

/**
 * 把后端 API base URL 归一化到带 `/api/v1` 后缀且无尾斜杠的形式。
 * 行为与原 regenerate / compare 引擎内联的归一化逻辑完全一致。
 */
export function normalizeApiBaseUrl(rawBaseUrl: string): string {
  return /\/api\/v1\/?$/.test(rawBaseUrl)
    ? rawBaseUrl.replace(/\/$/, '')
    : `${rawBaseUrl.replace(/\/$/, '')}/api/v1`;
}

/**
 * 解析当前环境的摘要流 API base URL（读 env 后归一化）。
 * 等价于原两处内联的 `rawBaseUrl = NEXT_PUBLIC_API_URL || NEXT_PUBLIC_API_BASE_URL || ''` + 归一化。
 */
export function resolveSummaryStreamBaseUrl(): string {
  const rawBaseUrl =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    '';
  return normalizeApiBaseUrl(rawBaseUrl);
}

/** EventSource 中实际被用到的最小接口，便于注入假实现做单测。 */
type SseErrorTarget = {
  addEventListener(type: 'error', listener: (event: MessageEvent) => void): void;
};

/**
 * 注册服务端 `error` 命名事件的监听：尝试解析 JSON 取 `message` 转交 onError，
 * 解析失败则以无参形式调用 onError。两套引擎里逐字相同的那段。
 */
export function attachSseServerErrorListener(
  source: SseErrorTarget,
  onError: (message?: string) => void,
): void {
  source.addEventListener('error', (event) => {
    try {
      const payload = JSON.parse((event as MessageEvent).data);
      onError(payload?.message);
    } catch {
      onError();
    }
  });
}
