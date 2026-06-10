/**
 * SSE 流式 delta 的帧合并节流器（按 key 各自独立计时）。
 *
 * 动机：摘要再生 SSE 期间每个 delta 都直接 setState，导致 2400+ 行详情页整页重渲染、
 * 右栏 MarkdownContent 对增长全文整篇重 parse（主要成本）、左栏长转写整列 reconcile。
 * 把「写 state」从每 delta 一次降到每 ~intervalMs 一次：delta 只追加进调用方自己的
 * buffer 并 schedule(key)，窗口到点才调一次 flush(key)（由调用方把 buffer 一次性写进
 * state）。渲染次数随 delta 频率砍 5-10x，且绝不丢字——buffer 是唯一事实源，flush 总是
 * 取其全量。
 *
 * flush 语义：
 * - schedule(key)：该 key 无在途定时器时启动一个；已有则什么都不做（同窗口内的 delta
 *   合并进同一次 flush）。
 * - flushNow(key)：取消在途定时器并立即同步调 flush——流结束（summary.completed）或
 *   出错收尾时调用，把 buffer 余量立刻清出去。
 * - cancel(key)：丢弃在途定时器、不 flush——新一轮流开始、buffer 即将被重置时调用。
 * - cancelAll()：丢弃全部在途定时器（组件卸载清理）。
 */
export interface StreamThrottle<K extends string> {
  schedule(key: K): void
  flushNow(key: K): void
  cancel(key: K): void
  cancelAll(): void
}

export function createStreamThrottle<K extends string>(
  flush: (key: K) => void,
  intervalMs = 100,
): StreamThrottle<K> {
  const timers = new Map<K, ReturnType<typeof setTimeout>>()

  const clear = (key: K) => {
    const timer = timers.get(key)
    if (timer !== undefined) {
      clearTimeout(timer)
      timers.delete(key)
    }
  }

  return {
    schedule(key) {
      if (timers.has(key)) return
      timers.set(
        key,
        setTimeout(() => {
          timers.delete(key)
          flush(key)
        }, intervalMs),
      )
    },
    flushNow(key) {
      clear(key)
      flush(key)
    },
    cancel(key) {
      clear(key)
    },
    cancelAll() {
      for (const timer of timers.values()) {
        clearTimeout(timer)
      }
      timers.clear()
    },
  }
}
