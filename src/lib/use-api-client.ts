/**
 * API 客户端 React Hook
 * 在客户端组件中使用 API 客户端
 */

"use client"

import { useMemo } from "react"
import { createAPIClient, APIClient } from "./api-client"

/**
 * 使用 API 客户端的 Hook
 *
 * Note: Token management is handled by api-client.ts using JWT signing
 * (see src/lib/jwt.ts and src/lib/auth-token.ts).
 */
export function useAPIClient(): APIClient {
  const client = useMemo(() => {
    return createAPIClient()
  }, [])

  return client
}

/**
 * Note: 建议使用 React Server Components 进行数据获取
 * 客户端组件中如需状态管理，推荐使用 SWR 或 React Query
 *
 * 示例（客户端组件）：
 * ```tsx
 * const client = useAPIClient()
 * const [data, setData] = useState(null)
 * const [loading, setLoading] = useState(false)
 *
 * const fetchData = async () => {
 *   setLoading(true)
 *   try {
 *     const result = await client.getTasks()
 *     setData(result)
 *   } catch (error) {
 *     toast.error(error.message)
 *   } finally {
 *     setLoading(false)
 *   }
 * }
 * ```
 */
