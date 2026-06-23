import { render, screen } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import type { TaskDetail } from "@/types/api"
import { TaskProcessingPanel } from "./TaskProcessingPanel"

vi.mock("@/lib/i18n-context", () => ({
  useI18n: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars ? `${key} ${Object.values(vars).join(" ")}` : key,
  }),
}))

describe("TaskProcessingPanel", () => {
  const task = { title: "处理中任务", status: "extracting", source_type: "upload" } as unknown as TaskDetail

  it("渲染文件标题、infoItems 与处理提示", () => {
    render(
      <TaskProcessingPanel
        task={task}
        infoItems={["大小 1MB", "时长 3:00"]}
        progress={20}
        estimatedTime="约3分钟"
      />
    )
    expect(screen.getByText("处理中任务")).toBeInTheDocument()
    expect(screen.getByText("大小 1MB")).toBeInTheDocument()
    expect(screen.getByText("时长 3:00")).toBeInTheDocument()
    expect(screen.getByText("task.error.processingTips")).toBeInTheDocument()
  })

  it("infoItems 为空时不渲染信息列表项", () => {
    render(
      <TaskProcessingPanel task={task} infoItems={[]} progress={0} estimatedTime="" />
    )
    expect(screen.getByText("处理中任务")).toBeInTheDocument()
    expect(screen.queryByText("大小 1MB")).toBeNull()
  })
})
