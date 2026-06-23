import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CompareModelDialog } from "./CompareModelDialog";
import type { LLMModel } from "@/types/api";

const t = (key: string, vars?: Record<string, string | number>) =>
  vars ? `${key} ${Object.values(vars).join(" ")}` : key;

function model(over: Partial<LLMModel> = {}): LLMModel {
  return {
    provider: "gemini",
    model_id: "gemini-pro",
    display_name: "Gemini Pro",
    provider_display: "Google",
    is_available: true,
    is_recommended: false,
    cost_tier: null,
    ...over,
  } as LLMModel;
}

function groups(): { label: string; models: LLMModel[] }[] {
  return [
    {
      label: "Google",
      models: [
        model({ provider: "gemini", model_id: "gemini-pro", display_name: "Gemini Pro" }),
        model({ provider: "deepseek", model_id: "deepseek-chat", display_name: "DeepSeek Chat" }),
        model({ provider: "off", model_id: "off-model", display_name: "Offline", is_available: false }),
      ],
    },
  ];
}

function setup(over: Partial<React.ComponentProps<typeof CompareModelDialog>> = {}) {
  const props = {
    open: true,
    onOpenChange: vi.fn(),
    modelGroups: groups(),
    selectedModels: [] as string[],
    onToggleModel: vi.fn(),
    compareError: null as string | null,
    compareLoading: false,
    onStart: vi.fn(),
    t,
    ...over,
  };
  render(<CompareModelDialog {...props} />);
  return props;
}

describe("CompareModelDialog", () => {
  it("渲染标题/说明与各分组模型复选框", () => {
    setup();
    expect(screen.getByText("task.compareTitle")).toBeInTheDocument();
    expect(screen.getByText("task.compareHint")).toBeInTheDocument();
    expect(screen.getByText("Google")).toBeInTheDocument();
    expect(screen.getByText("Gemini Pro")).toBeInTheDocument();
    expect(screen.getByText("DeepSeek Chat")).toBeInTheDocument();
  });

  it("不可用模型的复选框 disabled,文案追加 unavailable", () => {
    setup();
    expect(screen.getByText(/Offline · task.summaryModelUnavailable/)).toBeInTheDocument();
    const checkboxes = screen.getAllByRole("checkbox") as HTMLInputElement[];
    // 第三个(Offline)不可用
    expect(checkboxes[2].disabled).toBe(true);
  });

  it("勾选复选框调 onToggleModel(value),value=model_id||provider", () => {
    const props = setup();
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    expect(props.onToggleModel).toHaveBeenCalledWith("gemini-pro");
  });

  it("选中模型时复选框 checked", () => {
    setup({ selectedModels: ["gemini-pro"] });
    const checkboxes = screen.getAllByRole("checkbox") as HTMLInputElement[];
    expect(checkboxes[0].checked).toBe(true);
  });

  it("Start 在选中 <2 时禁用", () => {
    setup({ selectedModels: ["gemini-pro"] });
    expect((screen.getByText("task.compareStart").closest("button"))!).toBeDisabled();
  });

  it("Start 在 compareLoading 时禁用并显示 loading 文案", () => {
    setup({ selectedModels: ["gemini-pro", "deepseek-chat"], compareLoading: true });
    expect((screen.getByText("task.compareLoadingButton").closest("button"))!).toBeDisabled();
  });

  it("Start 在 ≥2 选中且非 loading 时可点,点击调 onStart", () => {
    const props = setup({ selectedModels: ["gemini-pro", "deepseek-chat"] });
    const startBtn = screen.getByText("task.compareStart").closest("button")!;
    expect(startBtn).not.toBeDisabled();
    fireEvent.click(startBtn);
    expect(props.onStart).toHaveBeenCalledTimes(1);
  });

  it("Cancel 调 onOpenChange(false)", () => {
    const props = setup();
    fireEvent.click(screen.getByText("common.cancel"));
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("compareError 渲染在 danger 色", () => {
    setup({ compareError: "出错了" });
    expect(screen.getByText("出错了")).toBeInTheDocument();
  });
});
