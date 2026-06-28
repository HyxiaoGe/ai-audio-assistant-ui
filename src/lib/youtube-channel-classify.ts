// 后端 app/services/youtube/blocklist_service.py classify_channel_input + normalize_handle/query 的逐字 TS port。
// 与后端保持一致是契约:前端结构化去重的判型必须等于服务端唯一键的判型,否则前后端漂移。
// 后端正则用 Python \w(unicode);JS 端改用 \p{L}\p{N}_(u flag)对齐 unicode 语义。

const CHANNEL_ID_RE = /^UC[0-9A-Za-z_-]{22}$/
const CHANNEL_URL_RE = /\/channel\/(UC[0-9A-Za-z_-]{22})/
const HANDLE_URL_RE = /(?<![\p{L}\p{N}_.-])(?:www\.|m\.|music\.)?youtube\.com\/@([^/?#\s]+)/iu
const BARE_HANDLE_RE = /^@([^/?#\s]+)$/
const HANDLE_CHARS_RE = /^[\p{L}\p{N}_.-]+$/u

export type ChannelMatchField = "channel_id" | "channel_handle" | "channel_name"

export interface ChannelClassification {
  matchField: ChannelMatchField
  normalizedValue: string
}

// 后端 normalize_handle = unquote(raw).strip().lstrip("@").casefold()
// casefold≈toLowerCase:极少数 unicode(如 ß→ss)与 Python casefold 不同,对真实 handle 几乎无影响。
export function normalizeHandle(raw: string): string {
  let decoded: string
  try {
    decoded = decodeURIComponent(raw)
  } catch {
    decoded = raw // 非法百分号编码 → 尽力解码失败,保留原串(不抛)
  }
  return decoded.trim().replace(/^@+/, "").toLowerCase()
}

// 后端 normalize_query = " ".join(raw.split()).casefold()
export function normalizeQuery(raw: string): string {
  return raw.trim().split(/\s+/).join(" ").toLowerCase()
}

function extractHandle(s: string): string | null {
  const u = HANDLE_URL_RE.exec(s)
  if (u) return u[1]
  const b = BARE_HANDLE_RE.exec(s)
  if (b) return b[1]
  return null
}

export function classifyChannelInput(raw: string): ChannelClassification {
  const s = raw.trim()
  const urlMatch = CHANNEL_URL_RE.exec(s)
  if (urlMatch) return { matchField: "channel_id", normalizedValue: urlMatch[1] }
  if (CHANNEL_ID_RE.test(s)) return { matchField: "channel_id", normalizedValue: s }
  const handle = extractHandle(s)
  if (handle) {
    const normalizedHandle = normalizeHandle(handle)
    // 解码后含 / ? # 空格等非法字符 → 不是干净 handle,落回按名匹配(与后端一致)
    if (normalizedHandle && HANDLE_CHARS_RE.test(normalizedHandle)) {
      return { matchField: "channel_handle", normalizedValue: normalizedHandle }
    }
  }
  return { matchField: "channel_name", normalizedValue: normalizeQuery(s) }
}
