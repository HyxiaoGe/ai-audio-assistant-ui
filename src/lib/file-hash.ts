/**
 * 文件 Hash 计算工具
 * 用于在客户端计算文件的 SHA256 哈希值
 */

import { translateStatic } from "@/lib/i18n-static"

/**
 * 计算文件的 SHA256 哈希值
 * @param file 文件对象
 * @param onProgress 进度回调（可选）
 * @returns Promise<string> 十六进制格式的哈希值
 */
export async function calculateFileHash(
  file: File,
  onProgress?: (progress: number) => void
): Promise<string> {
  // 检查浏览器是否支持 Web Crypto API
  if (!crypto.subtle) {
    throw new Error(translateStatic("errors.cryptoUnavailable"))
  }

  // 分块读取文件（避免大文件一次性读入内存）
  const chunkSize = 2 * 1024 * 1024 // 2MB per chunk
  const chunks = Math.ceil(file.size / chunkSize)
  let offset = 0

  // 创建 SHA-256 哈希上下文
  const hashBuffer: number[] = []

  for (let i = 0; i < chunks; i++) {
    // 读取分块
    const chunk = file.slice(offset, offset + chunkSize)
    const arrayBuffer = await chunk.arrayBuffer()

    // 计算分块哈希
    const chunkHashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer)
    hashBuffer.push(...new Uint8Array(chunkHashBuffer))

    offset += chunkSize

    // 报告进度
    if (onProgress) {
      const progress = Math.round(((i + 1) / chunks) * 100)
      onProgress(progress)
    }
  }

  // 对所有分块哈希再做一次哈希（如果有多个分块）
  let finalHash: ArrayBuffer
  if (chunks > 1) {
    const combinedBuffer = new Uint8Array(hashBuffer)
    finalHash = await crypto.subtle.digest("SHA-256", combinedBuffer)
  } else {
    // 只有一个分块，直接使用
    const arrayBuffer = await file.arrayBuffer()
    finalHash = await crypto.subtle.digest("SHA-256", arrayBuffer)
  }

  // 转换为十六进制字符串
  const hashArray = Array.from(new Uint8Array(finalHash))
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")

  return hashHex
}

/**
 * 验证文件类型
 * @param file 文件对象
 * @param allowedTypes 允许的 MIME 类型列表
 * @returns boolean
 */
export function validateFileType(
  file: File,
  allowedTypes: string[]
): boolean {
  return allowedTypes.some((type) => {
    if (type.endsWith("/*")) {
      // 通配符匹配，如 "audio/*"
      const prefix = type.slice(0, -2)
      return file.type.startsWith(prefix)
    }
    return file.type === type
  })
}

/**
 * 验证文件大小
 * @param file 文件对象
 * @param maxSizeBytes 最大大小（字节）
 * @returns boolean
 */
export function validateFileSize(file: File, maxSizeBytes: number): boolean {
  return file.size <= maxSizeBytes
}

/**
 * 格式化文件大小
 * @param bytes 字节数
 * @returns 格式化后的字符串（如 "1.5 MB"）
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes"

  const k = 1024
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

/**
 * 常用的文件类型配置
 */
const AUDIO_TYPES = [
  "audio/mpeg", // mp3
  "audio/mp4", // m4a
  "audio/wav",
  "audio/webm",
  "audio/ogg",
]

const VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime", // mov
  "video/x-msvideo", // avi
]

export const FILE_TYPES = {
  AUDIO: AUDIO_TYPES,
  VIDEO: VIDEO_TYPES,
  MEDIA: [...AUDIO_TYPES, ...VIDEO_TYPES],
} as const

/**
 * 文件大小限制（字节）
 */
export const FILE_SIZE_LIMITS = {
  MAX_FILE_SIZE: 500 * 1024 * 1024, // 500 MB
  MAX_AUDIO_DURATION: 2 * 60 * 60, // 2 hours (in seconds)
} as const
