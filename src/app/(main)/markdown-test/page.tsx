"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeSanitize from "rehype-sanitize"

const v11Content = `以下是会议的主要内容概述：

本次会议主要讨论了项目进度、资源分配和风险管理三个议题。团队就下一阶段的工作重点达成了共识，并确定了具体的时间节点和责任人。

**关键要点**
- 项目整体进度符合预期，预计下月中旬完成第一阶段
- 需要增加2名前端开发人员
- 市场部反馈用户增长率达到15%
- 技术债务问题需要尽快解决
- 下周三进行第二轮测试

**待办事项**
- [ ] 完成市场调研报告 @张三 (本周五前)
- [ ] 联系供应商确认报价 @李四
- [ ] 准备下次会议议程 @王五 (下周一)`

const v12Content = `# 会议概览

## 会议速览
本次会议主要讨论了项目进度、资源分配和风险管理三个议题。团队就下一阶段的工作重点达成了共识，并确定了具体的时间节点和责任人。

## 讨论议题
1. **项目进度回顾**：第一阶段开发进度符合预期，预计下月中旬完成
2. **资源分配调整**：需要增加2名前端开发人员，HR已启动招聘流程
3. **风险识别与应对**：技术债务问题需要优先处理，制定了重构计划

## 核心决策
- ✓ 批准增加前端人力预算，本周内发布招聘需求
- ✓ 确定技术债务重构优先级，从支付模块开始
- ✓ 下周三进行第二轮集成测试

## 关键信息速查

| 类别 | 内容 |
|-----|------|
| 讨论议题数 | 3个 |
| 核心决策 | 3项 |
| 待办事项 | 5个 |

---

# 会议关键要点

## 【决策与共识】
- ✓ 批准增加前端人力预算，本周内发布招聘需求
- ✓ 确定技术债务重构优先级，从支付模块开始

## 【重要信息与数据】
- 📊 项目整体进度符合预期，第一阶段完成度85%
- 📊 市场部反馈用户月增长率达到15%，超出预期目标

## 【核心观点】
- 💡 技术负责人建议优先解决支付模块的代码质量问题
- 💡 产品经理提出简化新用户引导流程的方案

## 【问题与挑战】
- ⚠️ 技术债务累积影响开发效率，需要分配专门时间重构
- ⚠️ 测试环境不稳定，影响联调进度

---

# 待办事项与行动计划

## 【待办事项】

### 高优先级（紧急重要）
- [ ] 完成支付模块重构方案 @技术负责人 (本周五前)
- [ ] 发布前端开发招聘需求 @HR (本周内)

### 普通优先级
- [ ] 完成市场调研报告 @张三 (下周三)
- [ ] 联系供应商确认报价 @李四
- [ ] 准备第二轮测试用例 @测试组长 (下周二)

### 低优先级（可选）
- [ ] 调研新的代码审查工具

## 【未解决问题】
⚠️ **测试环境不稳定问题**
- 需跟进人：@运维负责人
- 建议行动：本周内排查原因并制定解决方案

## 【后续计划】
- 📅 下周三进行第二轮集成测试
- 🎯 下月中旬完成第一阶段开发`

export default function MarkdownTestPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8" style={{ color: "var(--app-text)" }}>
        摘要格式对比测试 (V1.1 vs V1.2)
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* V1.1 Format */}
        <div>
          <div className="mb-4">
            <h2 className="text-xl font-semibold mb-2" style={{ color: "var(--app-text)" }}>
              V1.1 格式（旧版 - 简单 Markdown）
            </h2>
            <div className="text-sm" style={{ color: "var(--app-text-muted)" }}>
              简单段落和列表，基础 Markdown 标记
            </div>
          </div>
          <div className="glass-panel p-6 rounded-lg">
            <div className="prose prose-sm max-w-none markdown-summary">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeSanitize]}
                components={{
                  input: ({ ...props }) => {
                    if (props.type === "checkbox") {
                      return (
                        <input
                          {...props}
                          className="mr-2 align-middle"
                          readOnly
                          style={{ cursor: "default" }}
                        />
                      )
                    }
                    return <input {...props} />
                  },
                  table: ({ ...props }) => (
                    <div className="overflow-x-auto my-4">
                      <table
                        {...props}
                        className="min-w-full border-collapse"
                        style={{
                          border: "1px solid var(--app-glass-border)",
                        }}
                      />
                    </div>
                  ),
                  th: ({ ...props }) => (
                    <th
                      {...props}
                      className="px-4 py-2 text-left font-semibold"
                      style={{
                        backgroundColor: "var(--app-glass-bg)",
                        borderBottom: "2px solid var(--app-glass-border)",
                      }}
                    />
                  ),
                  td: ({ ...props }) => (
                    <td
                      {...props}
                      className="px-4 py-2"
                      style={{
                        borderBottom: "1px solid var(--app-glass-border)",
                      }}
                    />
                  ),
                  ul: ({ ...props }) => <ul {...props} className="space-y-2 my-4" />,
                  ol: ({ ...props }) => <ol {...props} className="space-y-2 my-4" />,
                  li: ({ children, ...props }) => {
                    const content = String(children)
                    const isHighPriority = content.includes("高优先级") || content.includes("紧急")
                    const isLowPriority = content.includes("低优先级") || content.includes("可选")

                    return (
                      <li
                        {...props}
                        className="leading-relaxed"
                        style={
                          isHighPriority
                            ? { color: "var(--app-danger)" }
                            : isLowPriority
                            ? { color: "var(--app-text-subtle)" }
                            : undefined
                        }
                      >
                        {children}
                      </li>
                    )
                  },
                  h1: ({ ...props }) => (
                    <h1
                      {...props}
                      className="text-2xl font-bold mt-6 mb-4"
                      style={{ color: "var(--app-text)" }}
                    />
                  ),
                  h2: ({ ...props }) => (
                    <h2
                      {...props}
                      className="text-xl font-semibold mt-5 mb-3"
                      style={{ color: "var(--app-text)" }}
                    />
                  ),
                  h3: ({ ...props }) => (
                    <h3
                      {...props}
                      className="text-lg font-semibold mt-4 mb-2"
                      style={{ color: "var(--app-text)" }}
                    />
                  ),
                  p: ({ ...props }) => <p {...props} className="my-3 leading-relaxed" />,
                  code: ({ className, children, ...props }) => {
                    const isInline = !className
                    if (isInline) {
                      return (
                        <code
                          {...props}
                          className="px-1.5 py-0.5 rounded text-sm"
                          style={{
                            backgroundColor: "var(--app-glass-bg)",
                            color: "var(--app-primary)",
                          }}
                        >
                          {children}
                        </code>
                      )
                    }
                    return (
                      <code
                        {...props}
                        className={`block p-3 rounded text-sm overflow-x-auto ${className || ""}`}
                        style={{
                          backgroundColor: "var(--app-glass-bg)",
                        }}
                      >
                        {children}
                      </code>
                    )
                  },
                  blockquote: ({ ...props }) => (
                    <blockquote
                      {...props}
                      className="border-l-4 pl-4 my-4 italic"
                      style={{
                        borderColor: "var(--app-primary)",
                        color: "var(--app-text-muted)",
                      }}
                    />
                  ),
                }}
              >
                {v11Content}
              </ReactMarkdown>
            </div>
          </div>
        </div>

        {/* V1.2 Format */}
        <div>
          <div className="mb-4">
            <h2 className="text-xl font-semibold mb-2" style={{ color: "var(--app-text)" }}>
              V1.2 格式（新版 - 结构化 Markdown）
            </h2>
            <div className="text-sm" style={{ color: "var(--app-text-muted)" }}>
              多层级标题、表格、任务列表、Emoji、优先级标记
            </div>
          </div>
          <div className="glass-panel p-6 rounded-lg">
            <div className="prose prose-sm max-w-none markdown-summary">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeSanitize]}
                components={{
                  input: ({ ...props }) => {
                    if (props.type === "checkbox") {
                      return (
                        <input
                          {...props}
                          className="mr-2 align-middle"
                          readOnly
                          style={{ cursor: "default" }}
                        />
                      )
                    }
                    return <input {...props} />
                  },
                  table: ({ ...props }) => (
                    <div className="overflow-x-auto my-4">
                      <table
                        {...props}
                        className="min-w-full border-collapse"
                        style={{
                          border: "1px solid var(--app-glass-border)",
                        }}
                      />
                    </div>
                  ),
                  th: ({ ...props }) => (
                    <th
                      {...props}
                      className="px-4 py-2 text-left font-semibold"
                      style={{
                        backgroundColor: "var(--app-glass-bg)",
                        borderBottom: "2px solid var(--app-glass-border)",
                      }}
                    />
                  ),
                  td: ({ ...props }) => (
                    <td
                      {...props}
                      className="px-4 py-2"
                      style={{
                        borderBottom: "1px solid var(--app-glass-border)",
                      }}
                    />
                  ),
                  ul: ({ ...props }) => <ul {...props} className="space-y-2 my-4" />,
                  ol: ({ ...props }) => <ol {...props} className="space-y-2 my-4" />,
                  li: ({ children, ...props }) => {
                    const content = String(children)
                    const isHighPriority = content.includes("高优先级") || content.includes("紧急")
                    const isLowPriority = content.includes("低优先级") || content.includes("可选")

                    return (
                      <li
                        {...props}
                        className="leading-relaxed"
                        style={
                          isHighPriority
                            ? { color: "var(--app-danger)" }
                            : isLowPriority
                            ? { color: "var(--app-text-subtle)" }
                            : undefined
                        }
                      >
                        {children}
                      </li>
                    )
                  },
                  h1: ({ ...props }) => (
                    <h1
                      {...props}
                      className="text-2xl font-bold mt-6 mb-4"
                      style={{ color: "var(--app-text)" }}
                    />
                  ),
                  h2: ({ ...props }) => (
                    <h2
                      {...props}
                      className="text-xl font-semibold mt-5 mb-3"
                      style={{ color: "var(--app-text)" }}
                    />
                  ),
                  h3: ({ ...props }) => (
                    <h3
                      {...props}
                      className="text-lg font-semibold mt-4 mb-2"
                      style={{ color: "var(--app-text)" }}
                    />
                  ),
                  p: ({ ...props }) => <p {...props} className="my-3 leading-relaxed" />,
                  code: ({ className, children, ...props }) => {
                    const isInline = !className
                    if (isInline) {
                      return (
                        <code
                          {...props}
                          className="px-1.5 py-0.5 rounded text-sm"
                          style={{
                            backgroundColor: "var(--app-glass-bg)",
                            color: "var(--app-primary)",
                          }}
                        >
                          {children}
                        </code>
                      )
                    }
                    return (
                      <code
                        {...props}
                        className={`block p-3 rounded text-sm overflow-x-auto ${className || ""}`}
                        style={{
                          backgroundColor: "var(--app-glass-bg)",
                        }}
                      >
                        {children}
                      </code>
                    )
                  },
                  blockquote: ({ ...props }) => (
                    <blockquote
                      {...props}
                      className="border-l-4 pl-4 my-4 italic"
                      style={{
                        borderColor: "var(--app-primary)",
                        color: "var(--app-text-muted)",
                      }}
                    />
                  ),
                }}
              >
                {v12Content}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 glass-panel p-6 rounded-lg">
        <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--app-text)" }}>
          查看此测试页面
        </h3>
        <div style={{ color: "var(--app-text-muted)" }}>
          <p className="mb-2">访问: <code className="px-2 py-1 rounded" style={{ backgroundColor: "var(--app-glass-bg)", color: "var(--app-primary)" }}>http://localhost:3000/markdown-test</code></p>
          <p>对比两个版本的渲染效果，新版本应该显示：</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>更清晰的多层级标题</li>
            <li>带边框和斑马纹的表格</li>
            <li>可勾选的任务列表 checkbox</li>
            <li>Emoji 图标（✓ ⚠️ 💡 📊 📅 🎯）</li>
            <li>优先级颜色标记（高优先级红色，低优先级灰色）</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
