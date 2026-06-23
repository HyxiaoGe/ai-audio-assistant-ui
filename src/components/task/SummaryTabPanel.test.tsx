import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createRef } from "react";
import { SummaryTabPanel } from "./SummaryTabPanel";
import type { LLMModel, SummaryRegenerateType, StreamingImage } from "@/types/api";
import type { ActionItem } from "@/lib/summary-parse";

// MarkdownContent stub: 直接吐 content 以断言渲染路径。
// 因为 SummaryTabPanel 通过 next/dynamic 懒加载 MarkdownContent,
// vi.mock 会被 hoisted 到顶部,所以 stub 必须也 hoisted。
const stubs = vi.hoisted(() => ({
  MarkdownContent: ({ content }: { content: string }) => <div data-testid="md">{content}</div>,
}));

vi.mock("next/dynamic", () => ({
  // 返回 MarkdownContent stub(忽略 loader),让 MarkdownContent 在叶子测试中同步渲染。
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  default: (..._args: unknown[]) => stubs.MarkdownContent,
}));

// 也 mock 真实路径以防组件在其他地方直接 import
vi.mock("@/components/task/MarkdownContent", () => ({
  MarkdownContent: stubs.MarkdownContent,
}));
vi.mock("@/components/task/SummaryModelSelect", () => ({
  SummaryModelSelect: ({ onChange }: { onChange: (v: string | null) => void }) => (
    <button data-testid="model-select" onClick={() => onChange("gemini-pro")}>
      model-select
    </button>
  ),
}));

const t = (key: string, vars?: Record<string, string | number>) =>
  vars ? `${key} ${Object.values(vars).join(" ")}` : key;

const TRIPLE_NULL: Record<SummaryRegenerateType, string | null> = {
  overview: null, key_points: null, action_items: null,
};
const TRIPLE_FALSE = { overview: false, key_points: false, action_items: false };
const TRIPLE_EMPTY: Record<SummaryRegenerateType, string> = {
  overview: "", key_points: "", action_items: "",
};

function model(over: Partial<LLMModel> = {}): LLMModel {
  return {
    provider: "gemini", model_id: "gemini-pro", display_name: "Gemini Pro",
    provider_display: "Google", is_available: true, is_recommended: false, cost_tier: null, ...over,
  } as LLMModel;
}

function props(over: Partial<React.ComponentProps<typeof SummaryTabPanel>> = {}): React.ComponentProps<typeof SummaryTabPanel> {
  return {
    tabs: [
      { id: "summary", label: "task.tabs.summary" },
      { id: "keypoints", label: "task.tabs.keypoints" },
      { id: "actions", label: "task.tabs.actions" },
    ],
    activeTab: "summary",
    onTabChange: vi.fn(),
    scrollRef: createRef<HTMLDivElement>(),
    llmModels: [model({ model_id: "gemini-pro" }), model({ provider: "deepseek", model_id: "deepseek-chat" })],
    summaryModelUsed: { ...TRIPLE_NULL },
    summaryModelSelection: { ...TRIPLE_NULL },
    onModelSelectionChange: vi.fn(),
    summaryStreaming: { ...TRIPLE_FALSE },
    summaryStreamContent: { ...TRIPLE_EMPTY },
    summaryOverviewMarkdown: "",
    keyPointsMarkdown: "",
    actionItemsMarkdown: "",
    keyPoints: [] as { text: string; timeReference: string }[],
    actionItems: [] as ActionItem[],
    detectedStyleName: null,
    transcriptStageReached: false,
    summaryError: null,
    imageModelUsed: null,
    streamingImages: new Map<string, StreamingImage>(),
    mediaToken: null,
    compareMode: false,
    compareSummaryType: "overview" as SummaryRegenerateType,
    renderCompareView: () => <div data-testid="compare-view" />,
    renderModelProvenance: (p?: string | null) => <span data-testid="prov">{String(p)}</span>,
    compareDialog: <div data-testid="compare-dialog" />,
    onRegenerate: vi.fn(),
    onOpenCompare: vi.fn(),
    onTimeClick: vi.fn(),
    onToggleActionItem: vi.fn(),
    getSummaryEmptyText: (_t: SummaryRegenerateType, emptyKey: string) => emptyKey,
    t,
    ...over,
  };
}

describe("SummaryTabPanel — overview 分支顺序(不变量主战场)", () => {
  it("transcriptStageReached + 无 markdown + 非 streaming → 显示 summaryGenerating", () => {
    render(<SummaryTabPanel {...props({ transcriptStageReached: true })} />);
    expect(screen.getByText("task.summaryGenerating")).toBeInTheDocument();
    expect(screen.queryByTestId("md")).not.toBeInTheDocument();
  });

  it("summaryError + 无 markdown → 显示错误", () => {
    render(<SummaryTabPanel {...props({ summaryError: "加载失败" })} />);
    expect(screen.getByText("加载失败")).toBeInTheDocument();
    expect(screen.queryByTestId("md")).not.toBeInTheDocument();
  });

  it("【关键守卫】summaryError + 已有 markdown → 仍渲染 markdown,不渲染错误(失败不连带抹掉已展示摘要)", () => {
    render(<SummaryTabPanel {...props({ summaryError: "加载失败", summaryOverviewMarkdown: "概览正文" })} />);
    expect(screen.getByTestId("md")).toHaveTextContent("概览正文");
    expect(screen.queryByText("加载失败")).not.toBeInTheDocument();
  });

  it("streaming + 有 streamContent → 渲染流式 markdown", () => {
    render(<SummaryTabPanel {...props({
      summaryStreaming: { overview: true, key_points: false, action_items: false },
      summaryStreamContent: { overview: "流式中…", key_points: "", action_items: "" },
    })} />);
    expect(screen.getByTestId("md")).toHaveTextContent("流式中…");
  });

  it("compareMode + compareSummaryType=overview → 渲染 renderCompareView", () => {
    render(<SummaryTabPanel {...props({ compareMode: true, compareSummaryType: "overview" })} />);
    expect(screen.getByTestId("compare-view")).toBeInTheDocument();
  });

  it("有 overview markdown(无 error/streaming/compare)→ 渲染 markdown", () => {
    render(<SummaryTabPanel {...props({ summaryOverviewMarkdown: "正式概览" })} />);
    expect(screen.getByTestId("md")).toHaveTextContent("正式概览");
  });

  it("全空 → 渲染 getSummaryEmptyText(overview, task.summaryEmpty)", () => {
    render(<SummaryTabPanel {...props()} />);
    expect(screen.getByText("task.summaryEmpty")).toBeInTheDocument();
  });
});

describe("SummaryTabPanel — tab 切换与各 tab 渲染", () => {
  it("点击 keypoints tab 调 onTabChange('keypoints')", () => {
    const p = props();
    render(<SummaryTabPanel {...p} />);
    fireEvent.click(screen.getByText("task.tabs.keypoints"));
    expect(p.onTabChange).toHaveBeenCalledWith("keypoints");
  });

  it("activeTab=keypoints + keyPointsMarkdown → 渲染要点 markdown", () => {
    render(<SummaryTabPanel {...props({ activeTab: "keypoints", keyPointsMarkdown: "要点正文" })} />);
    expect(screen.getByTestId("md")).toHaveTextContent("要点正文");
  });

  it("activeTab=actions + actionItemsMarkdown → 渲染行动项 markdown", () => {
    render(<SummaryTabPanel {...props({ activeTab: "actions", actionItemsMarkdown: "行动项正文" })} />);
    expect(screen.getByTestId("md")).toHaveTextContent("行动项正文");
  });
});

describe("SummaryTabPanel — legacy 非-markdown 回落", () => {
  it("keypoints 无 markdown 但有 keyPoints 数组 → 渲染条目 + 时间跳播", () => {
    const p = props({
      activeTab: "keypoints",
      keyPoints: [{ text: "要点A", timeReference: "00:10" }],
    });
    render(<SummaryTabPanel {...p} />);
    expect(screen.getByText("要点A")).toBeInTheDocument();
    fireEvent.click(screen.getByText(/00:10/));
    expect(p.onTimeClick).toHaveBeenCalledWith("00:10");
  });

  it("actions 无 markdown 但有 actionItems 数组 → 渲染条目 + toggle", () => {
    const p = props({
      activeTab: "actions",
      actionItems: [{ id: "a1", task: "做事", assignee: "张三", deadline: "明天", completed: false } as ActionItem],
    });
    render(<SummaryTabPanel {...p} />);
    expect(screen.getByText("做事")).toBeInTheDocument();
  });
});

describe("SummaryTabPanel — 回调与 slot", () => {
  it("regenerate 按钮调 onRegenerate(type)", () => {
    const p = props();
    render(<SummaryTabPanel {...p} />);
    fireEvent.click(screen.getByText("task.summaryRetry"));
    expect(p.onRegenerate).toHaveBeenCalledWith("overview");
  });

  it("compare 按钮在可用模型 ≥2 时可点,调 onOpenCompare", () => {
    const p = props();
    render(<SummaryTabPanel {...p} />);
    const btn = screen.getByText("task.compareModels").closest("button")!;
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    expect(p.onOpenCompare).toHaveBeenCalled();
  });

  it("compare 按钮在可用模型 <2 时禁用", () => {
    render(<SummaryTabPanel {...props({ llmModels: [model()] })} />);
    expect(screen.getByText("task.compareModels").closest("button")!).toBeDisabled();
  });

  it("model-select onChange 调 onModelSelectionChange(type, value)", () => {
    const p = props();
    render(<SummaryTabPanel {...p} />);
    fireEvent.click(screen.getAllByTestId("model-select")[0]);
    expect(p.onModelSelectionChange).toHaveBeenCalledWith("overview", "gemini-pro");
  });

  it("compareDialog slot 原样渲染", () => {
    render(<SummaryTabPanel {...props()} />);
    expect(screen.getByTestId("compare-dialog")).toBeInTheDocument();
  });

  it("renderModelProvenance 在标题行渲染", () => {
    render(<SummaryTabPanel {...props()} />);
    expect(screen.getAllByTestId("prov").length).toBeGreaterThan(0);
  });
});
