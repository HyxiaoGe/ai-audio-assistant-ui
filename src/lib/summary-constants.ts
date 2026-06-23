// 摘要 SSE 流 / 轮询的时间参数（毫秒）。原散落在 TaskDetail.tsx 的模块级魔数，抽成共享命名常量，
// 供 TaskDetail / use-summary-compare / use-summary-regeneration 三处复用，避免副本漂移。
export const SUMMARY_POLL_INTERVAL_MS = 2000; // 轮询 getSummary 检测版本号变化的间隔
export const SUMMARY_STREAM_FLUSH_MS = 100; // SSE delta 帧合并窗口:每窗口最多写一次 state(整页重渲染+全文重 parse 的频率上限)
export const SUMMARY_CONNECTION_TIMEOUT_MS = 3000; // 等 SSE connected 事件，超时则回退轮询
export const SUMMARY_IMAGE_TIMEOUT_MS = 90000; // summary 完成后等 images.completed 的上限（60s/张 + 30s 缓冲）
export const SUMMARY_IMAGE_RECONCILE_INTERVAL_MS = 4000; // completed 后图集对账重拉间隔（补 WS image_ready 漏收）
export const SUMMARY_OVERALL_TIMEOUT_MS = 120000; // 整个摘要 / 对比流程的兜底总超时
