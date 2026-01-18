# 可视化摘要功能 - 前端集成完成 ✅

> **状态**: 前端集成已完成，使用 Mermaid.js 客户端渲染
> **最后更新**: 2026-01-18

---

## 🎯 重要提示

**服务端图片渲染在本地环境不可用**（ARM Mac Docker 限制），前端已配置为使用 **Mermaid.js 客户端渲染**，性能更好且支持交互。

---

## ✅ 已完成的工作

### 1. 核心组件实现

- ✅ **VisualSummaryView.tsx** - 展示组件
  - Mermaid.js 客户端渲染（默认模式）
  - 自动加载和错误处理
  - 全屏查看和源代码查看

- ✅ **VisualSummaryGenerator.tsx** - 生成器组件（可选）
  - 三种可视化类型选择
  - 内容风格自动检测
  - SSE 实时进度跟踪
  - **默认关闭服务端图片生成**

- ✅ **SummaryView.tsx 集成**
  - 已添加思维导图、时间轴、流程图标签页
  - 与现有文本摘要标签页共存

### 2. API 客户端集成

已在 `src/lib/api-client.ts` 中实现：

```typescript
// 1. 生成可视化摘要
await client.generateVisualSummary(taskId, {
  visual_type: "mindmap",
  generate_image: false  // 推荐关闭
})

// 2. 获取可视化摘要
const result = await client.getVisualSummary(taskId, "mindmap")

// 3. 轮询生成状态（推荐）
const visualSummary = await client.pollVisualSummary(taskId, "mindmap", {
  maxAttempts: 30,
  interval: 2000,
  onProgress: (attempt, max) => console.log(`${attempt}/${max}`)
})
```

### 3. 类型定义

已在 `src/types/api.ts` 中定义：
- `VisualType` - 可视化类型 (mindmap | timeline | flowchart)
- `ContentStyle` - 内容风格 (meeting | lecture | podcast | video | general)
- `VisualSummaryRequest` - 生成请求类型
- `VisualSummaryResponse` - 响应类型（包含 Mermaid 代码）

### 4. UI 组件

已创建 `src/components/ui/alert.tsx`（shadcn/ui Alert 组件）

---

## 🚀 使用方法

### 用户视角

1. 进入任务详情页（任务必须已完成转写）
2. 在摘要区域点击"思维导图"、"时间轴"或"流程图"标签页
3. 如果可视化摘要已存在，自动加载并渲染
4. 如果不存在，显示"暂无可视化摘要"提示

### 开发者视角

**在页面中使用 VisualSummaryView：**

```tsx
import { VisualSummaryView } from "@/components/task/VisualSummaryView"

function TaskDetail({ taskId }) {
  return (
    <VisualSummaryView
      taskId={taskId}
      visualType="mindmap"
      renderMode="mermaid"  // 推荐使用客户端渲染
      autoLoad={true}
    />
  )
}
```

**使用生成器组件（可选）：**

```tsx
import { VisualSummaryGenerator } from "@/components/task/VisualSummaryGenerator"

function GeneratePanel({ taskId }) {
  return (
    <VisualSummaryGenerator
      taskId={taskId}
      onGenerated={(visualType) => {
        console.log('生成完成:', visualType)
      }}
    />
  )
}
```

---

## 📋 API 端点

### 1. 生成可视化摘要

```
POST /api/v1/summaries/{task_id}/visual
```

**请求体：**
```json
{
  "visual_type": "mindmap",
  "content_style": null,
  "generate_image": false,
  "provider": "deepseek"
}
```

**响应 (202 Accepted)：**
```json
{
  "code": 0,
  "message": "可视化摘要生成任务已提交",
  "data": {
    "task_id": "uuid",
    "visual_type": "mindmap",
    "content_style": "general",
    "generate_image": false,
    "status": "queued"
  }
}
```

**说明：**
- `status: "queued"` - 任务已加入队列，等待后台 Celery 处理
- 可视化摘要生成是**异步任务**，通常耗时 10-30 秒
- 后端**没有 SSE 实时推送**，需要通过轮询检查生成状态

### 2. 获取可视化摘要

```
GET /api/v1/summaries/{task_id}/visual/{visual_type}
```

**响应：**
```json
{
  "code": 0,
  "data": {
    "id": "uuid",
    "content": "mindmap\n  root((主题))\n    分支1\n    分支2",
    "format": "mermaid",
    "visual_type": "mindmap",
    "model_used": "deepseek-chat",
    "created_at": "2026-01-18T08:00:00"
  }
}
```

### 3. 轮询生成状态（推荐方式）

由于后端没有实现 SSE 实时推送，前端使用**轮询**方式检查生成状态：

```typescript
// 使用 API Client 的轮询方法
const result = await client.pollVisualSummary(taskId, visualType, {
  maxAttempts: 30,  // 最多尝试 30 次（60 秒）
  interval: 2000,   // 每 2 秒轮询一次
  onProgress: (attempt, maxAttempts) => {
    console.log(`轮询中... ${attempt}/${maxAttempts}`)
  }
})
```

**工作原理：**
1. POST 请求提交生成任务，后端返回 `status: "queued"`
2. 前端开始轮询 GET 端点
3. 如果返回 `code: 40402`（未找到），继续轮询
4. 如果返回 `code: 0`（成功），生成完成
5. 超过最大尝试次数，抛出超时错误

**错误码说明：**
- `40402` - 可视化摘要不存在（还在生成中，继续轮询）
- `40401` - 任务不存在（停止轮询）
- `0` - 成功获取（停止轮询，显示结果）

---

## 🔧 配置说明

### Mermaid.js 初始化

在 `VisualSummaryView.tsx` 中：

```typescript
mermaid.initialize({
  startOnLoad: false,
  theme: "default",
  securityLevel: "loose",
  fontFamily: "ui-sans-serif, system-ui, sans-serif",
})
```

### 默认配置

```typescript
// VisualSummaryGenerator 默认值
generateImage: false      // 不生成服务端图片（推荐）
contentStyle: "auto"      // 自动检测内容风格
imageFormat: "png"        // 仅在 generateImage=true 时有效

// VisualSummaryView 默认值
renderMode: "mermaid"     // 客户端渲染（推荐）
autoLoad: true            // 自动加载
```

---

## 🧪 测试建议

### 本地测试

1. 确保后端服务运行（包括可视化摘要生成功能）
2. 启动前端开发服务器：`npm run dev`
3. 上传音频文件，等待转写完成
4. 进入任务详情页，点击可视化标签页

### 测试用例

- ✅ 任务未完成时显示提示
- ✅ 可视化摘要不存在时显示空状态
- ✅ Mermaid 渲染成功后正确显示
- ✅ Mermaid 语法错误时显示错误提示
- ✅ 加载状态正确显示
- ✅ 重试功能正常工作
- ✅ 全屏功能正常
- ✅ 源代码查看功能正常

---

## 🐛 故障排查

### 问题 1: 可视化标签页显示空白

**可能原因：**
- 任务未完成转写
- 后端未生成可视化摘要
- Mermaid 渲染错误

**解决方法：**
1. 检查任务状态是否为 "completed"
2. 查看浏览器控制台是否有错误
3. 检查网络请求是否成功（Network 面板）
4. 点击"查看 Mermaid 源代码"检查内容

### 问题 2: Mermaid 渲染失败

**可能原因：**
- Mermaid 语法错误
- 浏览器不支持

**解决方法：**
1. 查看控制台错误信息
2. 复制 Mermaid 代码到 [Mermaid Live Editor](https://mermaid.live/) 测试
3. 确保使用最新版本的 Chrome/Firefox/Safari

### 问题 3: 生成进度卡住

**可能原因：**
- 后端任务失败
- LLM API 超时
- SSE 连接断开

**解决方法：**
1. 等待 30 秒超时后重试
2. 检查后端日志
3. 尝试使用不同的 LLM provider

---

## 📦 依赖项

```json
{
  "dependencies": {
    "mermaid": "^10.0.0",
    "react-markdown": "^10.1.0",
    "remark-gfm": "^4.0.1",
    "rehype-sanitize": "^6.0.0"
  }
}
```

所有依赖已在 `package.json` 中添加并安装。

---

## 📊 性能优化建议

### 1. 缓存策略

可视化摘要内容不会频繁变化，建议使用 SWR 或 React Query 缓存：

```typescript
import useSWR from 'swr'

const { data } = useSWR(
  `/api/v1/summaries/${taskId}/visual/${visualType}`,
  fetcher,
  { revalidateOnFocus: false }
)
```

### 2. 懒加载

只在用户点击标签页时才加载：

```typescript
{activeTab === 'mindmap' && (
  <VisualSummaryView taskId={taskId} visualType="mindmap" />
)}
```

### 3. 异步渲染

对于复杂图表，考虑在 Web Worker 中渲染。

---

## 🔮 未来改进

### 短期优化
- [ ] 客户端导出功能（SVG/PNG）
- [ ] Mermaid 主题跟随系统暗色/亮色模式
- [ ] 图表交互功能（缩放、平移）
- [ ] 移动端优化

### 长期规划
- [ ] 支持更多可视化类型（甘特图、序列图）
- [ ] 用户手动编辑 Mermaid 代码
- [ ] 多版本对比
- [ ] 协作功能

---

## 📚 参考资料

- [Mermaid.js 官方文档](https://mermaid.js.org/)
- [Mermaid Live Editor](https://mermaid.live/)
- 后端 API 文档：`docs/API_VISUAL_SUMMARY.md`（如可访问）
- [Next.js 文档](https://nextjs.org/docs)

---

## ✅ 验证清单

前端集成已完成，以下功能已验证：

- [x] TypeScript 类型定义完整
- [x] API Client 方法实现
- [x] VisualSummaryView 组件
- [x] VisualSummaryGenerator 组件
- [x] SummaryView 集成
- [x] Mermaid.js 客户端渲染
- [x] 错误处理和重试机制
- [x] 加载状态显示
- [x] TypeScript 编译通过
- [x] ESLint 检查通过
- [x] Next.js 生产构建成功

---

## 💬 联系方式

如有问题或建议，请提交 Issue 或联系开发团队。

**前端工作已全部完成，可以开始测试和使用了！** 🎉
