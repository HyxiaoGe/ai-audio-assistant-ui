import { describe, it, expect } from "vitest";
import zh from "@/locales/zh.json";
import en from "@/locales/en.json";

type Tree = Record<string, unknown>;

function get(tree: Tree, key: string): string | undefined {
  let cur: unknown = tree;
  for (const part of key.split(".")) {
    if (typeof cur !== "object" || cur === null) return undefined;
    cur = (cur as Tree)[part];
  }
  return typeof cur === "string" ? cur : undefined;
}

function interpolate(tpl: string, vars: Record<string, string | number>) {
  return tpl.replace(/\{(\w+)\}/g, (m, k) =>
    vars[k] === undefined ? m : String(vars[k])
  );
}

const TYPES = [
  "task_completed",
  "task_failed",
  "quota_alert",
  "youtube_reauth_required",
  "visual_failed",
];

describe("notif i18n keys", () => {
  it.each(TYPES)("zh has notif.%s.title and .body", (type) => {
    expect(get(zh as Tree, `notif.${type}.title`)).toBeTruthy();
    expect(get(zh as Tree, `notif.${type}.body`)).toBeTruthy();
  });

  it.each(TYPES)("en has notif.%s.title and .body", (type) => {
    expect(get(en as Tree, `notif.${type}.title`)).toBeTruthy();
    expect(get(en as Tree, `notif.${type}.body`)).toBeTruthy();
  });

  it("task_completed body interpolates {task_title}", () => {
    const tpl = get(zh as Tree, "notif.task_completed.body")!;
    expect(tpl).toContain("{task_title}");
    expect(interpolate(tpl, { task_title: "我的会议" })).toContain("我的会议");
  });

  it("task_failed title interpolates {task_title}", () => {
    const tpl = get(en as Tree, "notif.task_failed.title")!;
    expect(interpolate(tpl, { task_title: "Meeting" })).toContain("Meeting");
  });
});
