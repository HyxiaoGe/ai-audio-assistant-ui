# 前端集成转写润色（Polishing）实现方案

> 给 Claude Code 的实现指令。改动量不大，一共 7 个文件。

---

## 背景

后端新增了 `polishing` 阶段（ASR 转写 → 润色 → 摘要），前端需要：
1. 识别 `polishing` 状态并正确展示
2. 润色过的转写片段显示"已校对"标识
3. 支持查看 ASR 原文对比（可选交互）

---

## Step 1: TaskStatus 类型加 polishing

### 1.1 `src/types/index.ts`

在 `TaskStatus` 联合类型中，`"transcribing"` 之后、`"summarizing"` 之前加入 `"polishing"`：

```typescript
export type TaskStatus =
  | "pending"
  | "processing"
  | "queued"
  | "resolving"
  | "downloading"
  | "downloaded"
  | "transcoding"
  | "uploading"
  | "uploaded"
  | "resolved"
  | "extracting"
  | "asr_submitting"
  | "asr_polling"
  | "transcribing"
  | "polishing"       // ← 新增
  | "summarizing"
  | "completed"
  | "failed"
```

### 1.2 `src/types/api.ts`

如果这个文件里也有 `TaskStatus` 类型定义，同样加入 `"polishing"`。搜索 `TaskStatus` 确认。

---

## Step 2: i18n 文案

### 2.1 `src/locales/zh.json`

在 `task.status` 对象中，`"transcribing"` 之后加：

```json
"polishing": "正在校对转写"
```

在 `task.stage` 对象中加：

```json
"polishingActive": "正在校对转写",
"polishingDone": "转写校对完成"
```

在 `processingState` 对象中加：

```json
"polishing": "转写校对",
"polishingDesc": "正在使用 AI 校对转写文本..."
```

在 `transcript` 对象中加（用于 TranscriptItem 的校对标识）：

```json
"aiPolished": "AI 已校对",
"showOriginal": "查看原文",
"hideOriginal": "收起原文"
```

### 2.2 `src/locales/en.json`

在 `task.status` 对象中加：

```json
"polishing": "Polishing transcript"
```

在 `task.stage` 对象中加：

```json
"polishingActive": "Polishing transcript",
"polishingDone": "Transcript polished"
```

在 `processingState` 对象中加：

```json
"polishing": "Transcript polishing",
"polishingDesc": "AI is reviewing and correcting the transcript..."
```

在 `transcript` 对象中加：

```json
"aiPolished": "AI polished",
"showOriginal": "Show original",
"hideOriginal": "Hide original"
```

---

## Step 3: StatusBadge 组件

**文件**: `src/components/common/StatusBadge.tsx`

在 `statusConfig` 对象中，`transcribing` 之后加：

```typescript
polishing: {
  label: t("task.status.polishing"),
  className: "bg-[var(--app-primary-soft)] text-[var(--app-primary)]"
},
```

用和 `transcribing`/`summarizing` 相同的 processing 样式。

---

## Step 4: ProcessingState 组件（两个文件）

### 4.1 `src/components/common/ProcessingState.tsx`（TaskDetail 页面用的）

**STATUS_GROUPS**：把 `"polishing"` 加入 transcribing 和 summarizing 之间。有两种策略，推荐第一种：

**策略 A（推荐）**：polishing 归入 transcribing 组，不增加步骤数量，因为用户不需要看到这么细的阶段：

```typescript
const STATUS_GROUPS = {
  "preparing": ["queued", "resolving"],
  "downloading": ["downloading", "downloaded", "transcoding", "uploading", "uploaded", "resolved"],
  "extracting": ["extracting"],
  "transcribing": ["asr_submitting", "asr_polling", "transcribing", "polishing"],  // ← 加入 polishing
  "summarizing": ["summarizing"],
  "completed": ["completed"],
};
```

这样进度步骤条还是 4 步，polishing 时"转写"步骤显示为 processing 状态，不需要改步骤渲染逻辑。

### 4.2 `src/components/task/ProcessingState.tsx`（简化版）

在 `isProcessing` 判断中加入 `polishing`：

```typescript
const isProcessing =
  status === "pending" ||
  status === "extracting" ||
  status === "transcribing" ||
  status === "polishing" ||    // ← 新增
  status === "summarizing"
```

在 `stageLabels` 中加：

```typescript
polishing: t("processingState.polishing"),
```

在 `stageDescriptions` 中加：

```typescript
polishing: t("processingState.polishingDesc"),
```

---

## Step 5: TaskCardNew 组件

**文件**: `src/components/task/TaskCardNew.tsx`

在 `STATUS_VARIANTS` 对象中加：

```typescript
polishing: "default",
```

---

## Step 6: TranscriptItem 组件 — 显示"AI 已校对"标识

**文件**: `src/components/task/TranscriptItem.tsx`

### 6.1 Props 扩展

在 `TranscriptItemProps` 接口中加两个可选字段：

```typescript
interface TranscriptItemProps {
  // ...现有字段...
  isPolished?: boolean;           // 是否经过 AI 校对
  originalContent?: string | null; // ASR 原始内容
}
```

在函数参数解构中加默认值：

```typescript
export default function TranscriptItem({
  // ...现有参数...
  isPolished = false,
  originalContent = null,
}: TranscriptItemProps) {
```

### 6.2 新增状态：控制原文展示

```typescript
const [showOriginal, setShowOriginal] = useState(false);
```

### 6.3 在时间戳旁边加"AI 已校对"标识

在 `{/* Time Range */}` 按钮之后，Edit 按钮之前，加一个小标识：

```tsx
{/* AI Polish Badge */}
{isPolished && (
  <span
    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs"
    style={{
      background: 'var(--app-success-bg)',
      color: 'var(--app-success)',
      fontSize: '11px',
    }}
  >
    ✓ {t("transcript.aiPolished")}
  </span>
)}
```

### 6.4 在内容区域下方加原文对比（可折叠）

在 content 渲染区域之后（`{/* Content */}` 部分之后），加：

```tsx
{/* Original Content Toggle (for polished segments) */}
{isPolished && originalContent && originalContent !== content && (
  <div style={{ marginTop: '6px' }}>
    <button
      onClick={() => setShowOriginal(!showOriginal)}
      className="text-xs hover:underline"
      style={{ color: 'var(--app-text-subtle)' }}
    >
      {showOriginal ? t("transcript.hideOriginal") : t("transcript.showOriginal")}
    </button>
    {showOriginal && (
      <div
        className="mt-2 px-3 py-2 rounded text-sm"
        style={{
          background: 'var(--app-glass-bg-strong)',
          color: 'var(--app-text-muted)',
          borderLeft: '3px solid var(--app-warning)',
          fontSize: '13px',
          lineHeight: '1.6',
        }}
      >
        {originalContent}
      </div>
    )}
  </div>
)}
```

---

## Step 7: TaskDetail 页面传递 polish 数据

**文件**: `src/components/pages/TaskDetail.tsx`

### 7.1 DisplayTranscriptSegment 接口扩展

```typescript
interface DisplayTranscriptSegment {
  // ...现有字段...
  isPolished: boolean;               // 新增
  originalContent: string | null;    // 新增
}
```

### 7.2 映射数据时传入

找到 `transcriptResult.items.map((segment: ApiTranscriptSegment) => {` 这段映射代码，在返回对象中加两个字段：

```typescript
const mappedTranscript = transcriptResult.items.map((segment: ApiTranscriptSegment) => {
  const speakerInfo = segment.speaker_id ? speakerMap.get(segment.speaker_id) : null;
  return {
    id: segment.id,
    speaker: speakerInfo?.name || unknownSpeakerLabel,
    startTime: formatTimestamp(segment.start_time),
    endTime: formatTimestamp(segment.end_time),
    startSeconds: segment.start_time,
    endSeconds: segment.end_time,
    content: segment.content,
    words: segment.words ?? null,
    avatarColor: speakerInfo?.color || 'var(--app-text-subtle)',
    isPolished: segment.is_edited,                    // ← 新增
    originalContent: segment.original_content,        // ← 新增
  };
});
```

### 7.3 TranscriptItem 调用处传递

找到渲染 `<TranscriptItem>` 的地方，加两个 props：

```tsx
<TranscriptItem
  speaker={segment.speaker}
  startTime={segment.startTime}
  endTime={segment.endTime}
  content={segment.content}
  words={segment.words}
  avatarColor={segment.avatarColor}
  isActive={segment.id === activeSegmentId}
  activeWordIndex={...}
  activeWordProgress={...}
  onTimeClick={handleTimeClick}
  onEdit={(newContent) => handleEditTranscript(segment.id, newContent)}
  isPolished={segment.isPolished}               // ← 新增
  originalContent={segment.originalContent}     // ← 新增
/>
```

---

## 不需要做的事情

- ❌ 不需要改 `src/types/api.ts` 中的 `TranscriptSegment` 接口（`is_edited` 和 `original_content` 已存在）
- ❌ 不需要改后端 API 调用逻辑（数据已经在返回）
- ❌ 不需要改 StatusFilter 组件（polishing 属于 processing 大类，筛选逻辑不受影响）

---

## 实现顺序 Checklist

```
[ ] 1. src/types/index.ts — TaskStatus 加 "polishing"
[ ] 2. src/types/api.ts — TaskStatus 加 "polishing"（如有）
[ ] 3. src/locales/zh.json — 加 polishing 相关中文文案
[ ] 4. src/locales/en.json — 加 polishing 相关英文文案
[ ] 5. src/components/common/StatusBadge.tsx — statusConfig 加 polishing
[ ] 6. src/components/common/ProcessingState.tsx — STATUS_GROUPS 加 polishing
[ ] 7. src/components/task/ProcessingState.tsx — isProcessing / stageLabels / stageDescriptions 加 polishing
[ ] 8. src/components/task/TaskCardNew.tsx — STATUS_VARIANTS 加 polishing
[ ] 9. src/components/task/TranscriptItem.tsx — 加 isPolished/originalContent props + UI
[ ] 10. src/components/pages/TaskDetail.tsx — DisplayTranscriptSegment 扩展 + 数据映射 + props 传递
[ ] 11. npm run lint 通过
[ ] 12. npm run dev 启动无报错
```

---

## 关键约束提醒

1. **polishing 对用户来说不是独立阶段** — 在进度步骤条中归入"转写"组，不加第 5 步。用户感知是：转写 → 摘要，中间的校对是透明的
2. **"AI 已校对"标识要轻量** — 小字 + 柔和颜色，不要喧宾夺主。用 `var(--app-success-bg)` + `var(--app-success)` 配色
3. **原文对比默认收起** — 点击"查看原文"才展开，不影响正常阅读流
4. **i18n 文案 key 命名一致** — 所有新增 key 都在现有的 namespace 下，不新建顶级 key
5. **类型安全** — `DisplayTranscriptSegment` 加的字段要传到 `TranscriptItem`，TypeScript 编译必须通过
