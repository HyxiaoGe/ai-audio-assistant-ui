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

/**
 * 构造 regenerate 摘要流的错误处理器。关键保证：流在 connected 之前出错（onerror 或服务端
 * error 事件）时，必须先**幂等补发** triggerRegenerate，再 startPolling —— 否则 connected
 * 与 connectionTimeout 都没机会触发，后端从未收到 regenerate 请求，随后的轮询会永远等待一个
 * 不会出现的新版本。triggerRegenerate 的幂等性由调用方保证；补发失败交由轮询的超时兜底，
 * 这里只确保它被发起且不向外抛出。
 */
export function createSummaryStreamErrorHandler(opts: {
  cleanup: (message?: string) => void;
  triggerRegenerate: () => Promise<void> | void;
  startPolling: () => void;
}): (message?: string) => void {
  return (message) => {
    opts.cleanup(message);
    try {
      const pending = opts.triggerRegenerate();
      if (pending && typeof (pending as Promise<void>).then === 'function') {
        (pending as Promise<void>).catch(() => {
          /* 补发失败由轮询的 120s 超时兜底 */
        });
      }
    } catch {
      /* 同步异常同样交由轮询兜底，不阻断后续 startPolling */
    }
    opts.startPolling();
  };
}
