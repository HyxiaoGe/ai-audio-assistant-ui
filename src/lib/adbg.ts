// 临时诊断追踪器：深链跳播「二次定位」。默认全程 no-op，
// 仅当 localStorage['audio:debug']==='1' 时记录。定位完成后整体删除。
//
// 开启：localStorage.setItem('audio:debug','1'); location.reload()
// 复现：点击搜索命中跳进详情，观察「滚两次」
// 导出：在控制台运行 copy(window.__adbgDump())（或直接 window.__adbgDump()）把整条时间线发回
// 清空：window.__adbgClear()（点击命中前先清，缩小噪声）

interface AdbgEntry {
  t: number // performance.now()，高精度相对时间（判「等一会」间隔）
  wall: number // Date.now()，与 3000ms 定时器交叉对齐
  label: string
  data: Record<string, unknown>
}

const RING_MAX = 2000 // 环形缓冲上界：timeupdate 是高频流，保留双滚动前后窗口即可

let enabled: boolean | null = null

function isOn(): boolean {
  if (enabled !== null) return enabled
  if (typeof window === "undefined") return (enabled = false)
  try {
    enabled = window.localStorage.getItem("audio:debug") === "1"
  } catch {
    enabled = false
  }
  if (enabled) installGlobals()
  return enabled
}

function installGlobals(): void {
  const w = window as unknown as {
    __adbg?: AdbgEntry[]
    __adbgDump?: () => string
    __adbgClear?: () => void
  }
  if (!w.__adbg) w.__adbg = []
  w.__adbgDump = () => JSON.stringify(w.__adbg ?? [], null, 2)
  w.__adbgClear = () => {
    w.__adbg = []
  }
}

export function adbg(label: string, data: Record<string, unknown> = {}): void {
  if (!isOn()) return // 关闭时零成本：仅一次已缓存的布尔判断
  const entry: AdbgEntry = {
    t: typeof performance !== "undefined" ? performance.now() : Date.now(),
    wall: Date.now(),
    label,
    data,
  }
  const w = window as unknown as { __adbg?: AdbgEntry[] }
  const buf = w.__adbg ?? (w.__adbg = [])
  buf.push(entry)
  if (buf.length > RING_MAX) buf.splice(0, buf.length - RING_MAX)
  // 同时打 console，便于 grep '[ADBG]'
  console.log(`[ADBG] ${entry.t.toFixed(1)} ${label}`, data)
}
