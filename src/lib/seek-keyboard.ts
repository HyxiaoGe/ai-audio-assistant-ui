// 音频进度条键盘操作的纯逻辑，供 PlayerBar / Header 两个 slider 复用。

/** 方向键的步长（秒）。 */
export const SEEK_STEP_SECONDS = 5;
/** PageUp/PageDown 的页步长（秒）。 */
export const SEEK_PAGE_SECONDS = 10;

/**
 * 根据按键算出键盘 seek 后的新时间（已 clamp 到 `[0, duration]`）。
 *
 * @returns 新时间；若该按键不是 seek 键、或 duration 非法（0 / NaN / Infinity），返回 `null`。
 *          调用方应仅在返回非 null 时执行 seek 并 `preventDefault`（避免拦截 Tab 等导航键）。
 */
export function seekKeyToTime(
  key: string,
  currentTime: number,
  duration: number,
  step: number = SEEK_STEP_SECONDS,
  pageStep: number = SEEK_PAGE_SECONDS,
): number | null {
  if (!(duration > 0) || !Number.isFinite(duration)) return null;
  const clamp = (t: number) => Math.max(0, Math.min(duration, t));
  switch (key) {
    case "ArrowRight":
    case "ArrowUp":
      return clamp(currentTime + step);
    case "ArrowLeft":
    case "ArrowDown":
      return clamp(currentTime - step);
    case "PageUp":
      return clamp(currentTime + pageStep);
    case "PageDown":
      return clamp(currentTime - pageStep);
    case "Home":
      return 0;
    case "End":
      return duration;
    default:
      return null;
  }
}
