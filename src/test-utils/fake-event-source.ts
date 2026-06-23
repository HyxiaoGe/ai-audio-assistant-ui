// 测试用可控 EventSource 替身。jsdom 无 EventSource 全局,SSE 路径(TaskDetail 的
// regenerate / compare 两条流)一触发就 ReferenceError;本 fake 经 installFakeEventSource()
// 装到 globalThis,让测试能手动派发命名事件并断言 url / 关流。无 .test 后缀,vitest 不当测试收集。
type SseListener = (event: { data: string }) => void;

export class FakeEventSource {
  static instances: FakeEventSource[] = [];

  /** 取最近一次构造的实例(被测代码 new EventSource(url) 后用它拿句柄)。 */
  static last(): FakeEventSource | undefined {
    return FakeEventSource.instances[FakeEventSource.instances.length - 1];
  }

  static reset(): void {
    FakeEventSource.instances = [];
  }

  readonly url: string;
  closed = false;
  onerror: ((event?: unknown) => void) | null = null;
  onmessage: SseListener | null = null;
  private readonly listeners = new Map<string, Set<SseListener>>();

  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: SseListener): void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(listener);
  }

  removeEventListener(type: string, listener: SseListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  close(): void {
    this.closed = true;
  }

  /** 手动派发一个命名事件(connected / summary.started / summary.delta / summary.completed / error)。 */
  emit(type: string, data: unknown = {}): void {
    const event = { data: typeof data === "string" ? data : JSON.stringify(data) };
    this.listeners.get(type)?.forEach((listener) => listener(event));
  }

  /** 模拟传输层错误(触发 onerror,非服务端命名 error 事件)。 */
  emitTransportError(): void {
    this.onerror?.();
  }
}

/** 装 FakeEventSource 到 globalThis.EventSource,返回还原函数。beforeEach 装、afterEach 还原。 */
export function installFakeEventSource(): () => void {
  const holder = globalThis as { EventSource?: unknown };
  const original = holder.EventSource;
  FakeEventSource.reset();
  holder.EventSource = FakeEventSource as unknown;
  return () => {
    holder.EventSource = original;
    FakeEventSource.reset();
  };
}
