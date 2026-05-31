// 全局 WS 连接生命周期的两条不变量，从 use-global-websocket 抽出为纯函数便于单测。
// 网络抖动下若不守住它们，会叠出并行连接、或让被取代的旧 socket 破坏活连接。

/** React MutableRefObject 与裸对象都满足的最小可变引用形状。 */
interface MutableRef<T> {
  current: T
}

/**
 * 单飞定时器：调度前先清掉上一个未触发的定时器，保证同一 ref 上最多只有一个挂起回调。
 * reconnect() 在网络抖动下可能被连续触发，不去重会叠出多个并行 setTimeout，进而拉起多条
 * 并行连接。
 */
export function scheduleSingleFlightTimer(
  ref: MutableRef<ReturnType<typeof setTimeout> | undefined>,
  delay: number,
  run: () => void,
): void {
  if (ref.current !== undefined) {
    clearTimeout(ref.current)
  }
  ref.current = setTimeout(run, delay)
}

/**
 * 仅当关闭的 socket 仍是当前 socket 时，才清空引用并执行清理（含重连）。被 connect() 取代的
 * 旧 socket 的 onclose 可能在新 socket 建立之后才异步触发；无守卫地清空 wsRef 会把活连接的
 * 引用抹掉，并触发一次多余重连。引用在 onActiveClose 之前清空，使其内部的 reconnect() 写入的
 * 新引用不会被本次清空覆盖。
 */
export function closeIfCurrent(
  wsRef: MutableRef<WebSocket | null>,
  closedSocket: WebSocket,
  onActiveClose: () => void,
): void {
  if (wsRef.current !== closedSocket) {
    return
  }
  wsRef.current = null
  onActiveClose()
}
