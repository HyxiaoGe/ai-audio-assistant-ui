import { describe, expect, it, vi } from "vitest"
import { resolveStreamToken } from "./stream-ticket"

// SSE(regenerate/compare)用短期 stream 票据拼进 EventSource 的 ?token=。Phase 3 起后端不再
// 双接受长效 access JWT，故签票失败时绝不能回退把长 JWT 写进 URL（那正是要消除的泄露向量）——
// 必须返回 null，让调用方走 HTTP+轮询兜底。这里锁定该契约。
describe("resolveStreamToken", () => {
  it("returns the minted stream-ticket token on success", async () => {
    const client = {
      mintStreamTicket: vi.fn(async () => ({ token: "st", expires_in: 300 })),
    }

    const token = await resolveStreamToken(client, "task1", "overview")

    expect(token).toBe("st")
    expect(client.mintStreamTicket).toHaveBeenCalledWith("task1", "overview")
  })

  it("returns null (NOT a long-lived access JWT) when minting fails, so the SSE URL carries no token", async () => {
    const client = {
      mintStreamTicket: vi.fn(async () => {
        throw new Error("mint failed")
      }),
    }

    const token = await resolveStreamToken(client, "task1", "overview")

    expect(token).toBeNull()
  })
})
