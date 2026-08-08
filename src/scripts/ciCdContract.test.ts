import { mkdtempSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, isAbsolute, join, relative, resolve } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { parse } from "yaml"

const ROOT = resolve(import.meta.dirname, "../..")
const WORKFLOWS = join(ROOT, ".github/workflows")
const PR_CI = join(WORKFLOWS, "pr-ci.yml")
const RELEASE = join(WORKFLOWS, "build-and-deploy.yml")
const DRIFT_AUDIT = join(WORKFLOWS, "baseline-drift-audit.yml")

const CHECKOUT_SHA = "d23441a48e516b6c34aea4fa41551a30e30af803"
const SETUP_NODE_SHA = "249970729cb0ef3589644e2896645e5dc5ba9c38"
const LOGIN_SHA = "dbcb813823bdd20940b903addbd779551569679f"

const USES_LINE = /^\s*(?:-\s*)?uses\s*:\s*(?:(?<single>'[^']+')|(?<double>"[^"]+")|(?<bare>[^#\s]+))\s*(?<comment>#.*)?$/
const USES_CANDIDATE = /^\s*(?:-\s*)?uses\b/
const USES_KEY_TOKEN = /(?<![A-Za-z0-9_-])(?:uses|"uses"|'uses')\s*:/
const PURE_COMMENT = /^\s*#/
const EXTERNAL_ACTION = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.\-/]+)?@([0-9a-f]{40})$/
const PR_FORBIDDEN_DOCKER_COMMAND = /\bdocker\b[^\n]*(?:\blogin\b|\bpush\b|\bcompose\b)/i
const KNOWN_ACTION_PINS = new Map([
  ["actions/checkout", [CHECKOUT_SHA, "# v6"]],
  ["actions/setup-node", [SETUP_NODE_SHA, "# v6"]],
  ["docker/login-action", [LOGIN_SHA, "# v4.6.0"]],
])

type UsesOccurrence = {
  lineNumber: number
  value: string
  comment: string
}

type YamlRecord = Record<string, unknown>
type WorkflowStep = YamlRecord & {
  name?: unknown
  run?: unknown
  uses?: unknown
  with?: unknown
}

const temporaryRoots: string[] = []

afterEach(() => {
  for (const root of temporaryRoots) {
    rmSync(root, { recursive: true, force: true })
  }
  temporaryRoots.length = 0
})

function read(path: string): string {
  try {
    return normalizeNewlines(readFileSync(path, "utf8"))
  } catch {
    throw new Error(`缺少文件：${relative(ROOT, path)}`)
  }
}

function normalizeNewlines(value: string): string {
  return value.replace(/\r\n?/g, "\n")
}

function portablePath(value: string): string {
  return value.replace(/\\/g, "/")
}

function directoryLinkType(platform: string = process.platform): "dir" | "junction" {
  return platform === "win32" ? "junction" : "dir"
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function indentedBlock(text: string, key: string, indent: number): string {
  const lines = normalizeNewlines(text).split("\n")
  const prefix = " ".repeat(indent)
  const startPattern = new RegExp(`^${escapeRegExp(prefix + key)}:\\s*(?:#.*)?$`)
  const siblingPattern = new RegExp(`^${escapeRegExp(prefix)}\\S[^:]*:\\s*(?:.*)$`)
  const start = lines.findIndex((line) => startPattern.test(line))
  if (start === -1) {
    throw new Error(`找不到 YAML 块：${key}（缩进 ${indent}）`)
  }

  let end = start + 1
  while (end < lines.length && !siblingPattern.test(lines[end])) {
    end += 1
  }
  return lines.slice(start, end).join("\n")
}

function triggerNames(text: string): Set<string> {
  const onBlock = indentedBlock(text, "on", 0)
  return new Set(Array.from(onBlock.matchAll(/^  ([A-Za-z_][\w-]*):\s*(?:.*)$/gm), (match) => match[1]))
}

function jobBlock(text: string, jobId: string): string {
  return indentedBlock(indentedBlock(text, "jobs", 0), jobId, 2)
}

function jobIds(text: string): string[] {
  const jobs = indentedBlock(text, "jobs", 0)
  return Array.from(jobs.matchAll(/^  ([A-Za-z_][\w-]*):\s*(?:.*)$/gm), (match) => match[1])
}

function isRecord(value: unknown): value is YamlRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function parseYamlRecord(text: string, context: string): YamlRecord {
  const parsed: unknown = parse(text)
  if (!isRecord(parsed)) {
    throw new Error(`${context} 必须是 YAML mapping`)
  }
  return parsed
}

function parseWorkflowStep(value: unknown, context: string): WorkflowStep {
  if (!isRecord(value)) {
    throw new Error(`${context} 必须是 YAML step mapping`)
  }
  return value
}

function parseStepBlock(step: string): WorkflowStep {
  const dedented = step
    .split("\n")
    .map((line) => line.startsWith("      ") ? line.slice(6) : line)
    .join("\n")
  const parsed: unknown = parse(dedented)
  if (!Array.isArray(parsed) || parsed.length !== 1) {
    throw new Error("步骤文本必须只包含一个 YAML step")
  }
  return parseWorkflowStep(parsed[0], "步骤")
}

function parsedJobSteps(job: string): WorkflowStep[] {
  const dedented = job
    .split("\n")
    .map((line) => line.startsWith("  ") ? line.slice(2) : line)
    .join("\n")
  const parsed = parseYamlRecord(dedented, "job 文本")
  const entries = Object.entries(parsed)
  if (entries.length !== 1 || !isRecord(entries[0][1])) {
    throw new Error("job 文本必须只包含一个 YAML job")
  }
  const steps = entries[0][1].steps
  if (steps === undefined) {
    return []
  }
  if (!Array.isArray(steps)) {
    throw new Error("job.steps 必须是 YAML sequence")
  }
  return steps.map((step, index) => parseWorkflowStep(step, `job.steps[${index}]`))
}

function documentSteps(text: string, context: string): WorkflowStep[] {
  const document = parseYamlRecord(text, context)
  const steps: WorkflowStep[] = []
  if (document.jobs !== undefined) {
    if (!isRecord(document.jobs)) {
      throw new Error(`${context}.jobs 必须是 YAML mapping`)
    }
    for (const [jobId, job] of Object.entries(document.jobs)) {
      if (!isRecord(job)) {
        throw new Error(`${context}.jobs.${jobId} 必须是 YAML mapping`)
      }
      if (job.steps === undefined) {
        continue
      }
      if (!Array.isArray(job.steps)) {
        throw new Error(`${context}.jobs.${jobId}.steps 必须是 YAML sequence`)
      }
      steps.push(...job.steps.map((step, index) => parseWorkflowStep(step, `${context}.jobs.${jobId}.steps[${index}]`)))
    }
  }
  if (document.runs !== undefined) {
    if (!isRecord(document.runs)) {
      throw new Error(`${context}.runs 必须是 YAML mapping`)
    }
    if (document.runs.steps !== undefined) {
      if (!Array.isArray(document.runs.steps)) {
        throw new Error(`${context}.runs.steps 必须是 YAML sequence`)
      }
      steps.push(...document.runs.steps.map((step, index) => parseWorkflowStep(step, `${context}.runs.steps[${index}]`)))
    }
  }
  return steps
}

function stepBlocks(job: string): string[] {
  const structuredSteps = parsedJobSteps(job)
  const matches = Array.from(job.matchAll(/^      -(?:\s|$).*$/gm))
  const blocks = matches.map((match, index) => {
    const start = match.index
    const end = matches[index + 1]?.index ?? job.length
    return job.slice(start, end)
  })
  if (blocks.length !== structuredSteps.length) {
    throw new Error(`YAML steps 数量 ${structuredSteps.length} 与文本步骤块 ${blocks.length} 不一致`)
  }
  return blocks
}

function stepName(step: string): string {
  const name = parseStepBlock(step).name
  return typeof name === "string" ? name : "(unnamed step)"
}

function stepByName(job: string, name: string): string {
  const matches = stepBlocks(job).filter((step) => stepName(step) === name)
  expect(matches, `步骤 ${name} 应恰好出现一次`).toHaveLength(1)
  return matches[0]
}

function normalizedStepRun(step: string): string {
  const run = parseStepBlock(step).run
  if (typeof run !== "string") {
    return ""
  }
  return run.replace(/\\\s*\n/g, " ").replace(/\s+/g, " ")
}

function prStepViolations(step: string): string[] {
  const run = normalizedStepRun(step)
  const label = `${stepName(step)} ${run}`
  const violations: string[] = []
  if (PR_FORBIDDEN_DOCKER_COMMAND.test(run)) {
    violations.push("Docker publish/login/compose command")
  }
  if (/\b(?:kubectl|helm|ssh|scp|rsync)\b/i.test(run)) {
    violations.push("deployment tool command")
  }
  if (/\bdeploy(?:ment)?\b/i.test(label)) {
    violations.push("deploy behavior")
  }
  return violations
}

function parseUsesLine(line: string): Omit<UsesOccurrence, "lineNumber"> | null {
  if (PURE_COMMENT.test(line)) {
    return null
  }
  if (!USES_CANDIDATE.test(line) && !USES_KEY_TOKEN.test(line)) {
    return null
  }

  const parsed = USES_LINE.exec(line)
  if (!parsed?.groups) {
    throw new Error(`uses 键必须使用独立 block-style 行：${JSON.stringify(line)}`)
  }
  const rawValue = parsed.groups.single ?? parsed.groups.double ?? parsed.groups.bare
  const value = rawValue.startsWith("\"") || rawValue.startsWith("'")
    ? rawValue.slice(1, -1)
    : rawValue
  return { value, comment: parsed.groups.comment ?? "" }
}

function usesOccurrences(text: string): UsesOccurrence[] {
  return normalizeNewlines(text).split("\n").flatMap((line, index) => {
    const parsed = parseUsesLine(line)
    return parsed ? [{ lineNumber: index + 1, ...parsed }] : []
  })
}

function isInside(root: string, target: string): boolean {
  const child = relative(root, target)
  return child === "" || (!child.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) && child !== ".." && !isAbsolute(child))
}

function localActionTargets(repoRoot: string, value: string): string[] {
  const root = realpathSync(resolve(repoRoot))
  const target = resolve(root, value)
  if (!isInside(root, target)) {
    throw new Error(`本地 Action 不能逃逸仓库根目录：${value}`)
  }

  let targetStat
  try {
    targetStat = statSync(target)
  } catch {
    throw new Error(`本地 Action 目标不存在：${value}`)
  }
  const realTarget = realpathSync(target)
  if (!isInside(root, realTarget)) {
    throw new Error(`本地 Action 真实路径不能逃逸仓库根目录：${value}`)
  }
  if (targetStat.isFile()) {
    return [realTarget]
  }

  const manifests = ["action.yml", "action.yaml"]
    .map((name) => join(realTarget, name))
    .filter((path) => {
      try {
        return statSync(path).isFile()
      } catch {
        return false
      }
    })
  if (manifests.length === 0) {
    throw new Error(`本地 Action 目录缺少 action.yml/action.yaml：${value}`)
  }
  return manifests.map((manifest) => {
    const realManifest = realpathSync(manifest)
    if (!isInside(root, realManifest)) {
      throw new Error(`本地 Action 真实路径不能逃逸仓库根目录：${value}`)
    }
    return realManifest
  })
}

function walkActionManifests(path: string): string[] {
  try {
    return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
      const target = join(path, entry.name)
      if (entry.isDirectory()) {
        return walkActionManifests(target)
      }
      return entry.isFile() && (entry.name === "action.yml" || entry.name === "action.yaml") ? [target] : []
    })
  } catch {
    return []
  }
}

function collectActionFiles(repoRoot: string): string[] {
  const root = realpathSync(resolve(repoRoot))
  const workflows = join(root, ".github/workflows")
  const pending = new Set<string>()
  try {
    for (const entry of readdirSync(workflows, { withFileTypes: true })) {
      if (entry.isFile() && (/\.ya?ml$/.test(entry.name) || entry.name.endsWith(".disabled"))) {
        pending.add(resolve(workflows, entry.name))
      }
    }
  } catch {
    // 缺少 workflows 目录时，仍允许只扫描本地 Action manifest。
  }
  for (const manifest of walkActionManifests(join(root, ".github/actions"))) {
    pending.add(resolve(manifest))
  }

  const scanned = new Set<string>()
  while (pending.size > 0) {
    const path = pending.values().next().value as string
    pending.delete(path)
    if (scanned.has(path)) {
      continue
    }
    let content: string
    try {
      content = readFileSync(path, "utf8")
    } catch {
      throw new Error(`待扫描 Action 文件不存在：${path}`)
    }
    scanned.add(path)
    for (const { value } of usesOccurrences(content)) {
      if (value.startsWith("./")) {
        for (const target of localActionTargets(root, value)) {
          pending.add(resolve(target))
        }
      }
    }
  }
  return Array.from(scanned).sort()
}

function assertExternalActionPin(value: string, comment: string): void {
  if (!EXTERNAL_ACTION.test(value)) {
    throw new Error(`外部 Action 必须锁定 40 位小写 SHA：${value}`)
  }
  const separator = value.lastIndexOf("@")
  const actionName = value.slice(0, separator)
  const sha = value.slice(separator + 1)
  const expected = KNOWN_ACTION_PINS.get(actionName)
  if (expected) {
    if (sha !== expected[0] || comment !== expected[1]) {
      throw new Error(`已知 Action pin 不匹配：${actionName} 需要 ${expected[0]} ${expected[1]}`)
    }
    return
  }
  if (!/^# v\S+$/.test(comment)) {
    throw new Error(`外部 Action 缺少版本注释：${value}`)
  }
}

function validateActionFiles(repoRoot: string): string[] {
  const root = realpathSync(resolve(repoRoot))
  const scanned = collectActionFiles(root)
  for (const path of scanned) {
    const content = readFileSync(path, "utf8")
    documentSteps(content, relative(root, path))
    for (const { lineNumber, value, comment } of usesOccurrences(content)) {
      if (value.startsWith("./")) {
        continue
      }
      try {
        assertExternalActionPin(value, comment)
      } catch (error) {
        throw new Error(`${portablePath(relative(root, path))}:${lineNumber}: ${(error as Error).message}`)
      }
    }
  }
  return scanned
}

function writeFixture(root: string, path: string, content: string): void {
  const target = join(root, path)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, content, "utf8")
}

function temporaryRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "audio-ui-cicd-contract-"))
  temporaryRoots.push(root)
  return root
}

describe("Engineering baseline drift audit", () => {
  it("只按计划或人工触发并使用调用仓库的只读令牌", () => {
    const text = read(DRIFT_AUDIT)
    expect(triggerNames(text)).toEqual(new Set(["schedule", "workflow_dispatch"]))
    expect(indentedBlock(text, "permissions", 0).trimEnd().split("\n")).toEqual([
      "permissions:",
      "  actions: read",
      "  contents: read",
    ])
    expect(jobIds(text)).toEqual(["audit"])
    const job = jobBlock(text, "audit")
    expect(job).toMatch(/^    runs-on: ubuntu-latest\s*$/m)
    expect(text).toContain("cancel-in-progress: false")
    expect(job).toContain(
      "HyxiaoGe/engineering-baseline/.github/actions/audit@a87c78c4ff6594b4351678bea354ff1f171645e9 # v1.1.0",
    )
    expect(job).toContain("repository: ${{ github.repository }}")
    expect(text).not.toMatch(/\bsecrets\s*(?:\.|\[)/)
    expect(text).not.toMatch(/^\s*environment\s*:/m)
    expect(text).not.toContain("self-hosted")
  })
})

describe("PR CI workflow", () => {
  it("只监听指向 master 的 pull_request 并按 PR 取消旧任务", () => {
    const text = read(PR_CI)
    expect(triggerNames(text)).toEqual(new Set(["pull_request"]))
    expect(indentedBlock(indentedBlock(text, "on", 0), "pull_request", 2)).toMatch(/^    branches:\s*\[master\]\s*$/m)
    expect(text).not.toContain("pull_request_target")
    expect(indentedBlock(text, "concurrency", 0).trimEnd().split("\n")).toEqual([
      "concurrency:",
      "  group: ai-audio-ui-pr-${{ github.event.pull_request.number }}",
      "  cancel-in-progress: true",
    ])
  })

  it("只有只读权限、唯一 GitHub 托管校验 job 且无发布能力", () => {
    const text = read(PR_CI)
    expect(indentedBlock(text, "permissions", 0).trimEnd().split("\n")).toEqual(["permissions:", "  contents: read"])
    expect(jobIds(text)).toEqual(["validate"])
    expect(text).not.toMatch(/^\s*environment\s*:/m)
    expect(text).not.toMatch(/^\s*secrets\s*:/m)
    expect(text).not.toMatch(/\bsecrets\s*(?:\.|\[)/)

    const job = jobBlock(text, "validate")
    expect(job).toMatch(/^    name: PR container validation\s*$/m)
    expect(job).toMatch(/^    runs-on: ubuntu-latest\s*$/m)
    expect(job).not.toMatch(/self-hosted/i)
    expect(usesOccurrences(job).map(({ value, comment }) => [value, comment])).toEqual([
      [`actions/checkout@${CHECKOUT_SHA}`, "# v6"],
      [`actions/setup-node@${SETUP_NODE_SHA}`, "# v6"],
    ])
    for (const step of stepBlocks(job)) {
      expect(prStepViolations(step), `PR step: ${stepName(step)}`).toEqual([])
    }
  })

  it("无名 run 步骤也必须进入 PR 安全检查", () => {
    const job = [
      "  validate:",
      "    steps:",
      "      - name: Named safe step",
      "        run: npm ci",
      "      - run: docker push example.invalid/app:test",
    ].join("\n")
    const steps = stepBlocks(job)
    expect(steps).toHaveLength(2)
    expect(prStepViolations(steps[1])).toContain("Docker publish/login/compose command")
  })

  it("拒绝 docker buildx build --push", () => {
    const step = "      - run: docker buildx build --push -t example.invalid/app:test ."
    expect(prStepViolations(step)).toContain("Docker publish/login/compose command")
  })

  it("拒绝 docker image push", () => {
    const step = "      - run: docker image push example.invalid/app:test"
    expect(prStepViolations(step)).toContain("Docker publish/login/compose command")
  })

  it("执行完整 Node 校验、构建临时容器镜像并始终清理", () => {
    const text = read(PR_CI)
    expect(text).toMatch(/^\s+PR_IMAGE:\s*[^\n]*-pr:[^\n]*$/m)
    expect(text).toMatch(/npm ci/)
    expect(text).toMatch(/npm run lint/)
    expect(text).toMatch(/npm (?:run )?test/)
    expect(text).toMatch(/npm run build/)
    expect(text).toMatch(/docker build .*--build-arg NEXT_PUBLIC_BUILD_SHA="\$\{GITHUB_SHA\}".*-t "\$\{PR_IMAGE\}"/)
    const cleanup = stepByName(jobBlock(text, "validate"), "Cleanup temporary Docker image")
    expect(cleanup).toMatch(/^        if: always\(\)\s*$/m)
    expect(cleanup).toContain('docker image rm "${PR_IMAGE}" || true')
  })
})

describe("master release workflow", () => {
  it("只允许 master push 和手动触发，且发布并发不取消", () => {
    const text = read(RELEASE)
    expect(triggerNames(text)).toEqual(new Set(["push", "workflow_dispatch"]))
    expect(indentedBlock(indentedBlock(text, "on", 0), "push", 2)).toMatch(/^    branches:\s*\[master\]\s*$/m)
    expect(indentedBlock(text, "on", 0)).not.toMatch(/^  pull_request:/m)
    expect(text).toMatch(/^  cancel-in-progress: false\s*$/m)
  })

  it("publish、deploy 与 finalize 使用正确 runner、依赖和 Environment 边界", () => {
    const text = read(RELEASE)
    expect(jobIds(text)).toEqual(["publish", "deploy", "finalize"])
    const publish = jobBlock(text, "publish")
    expect(publish).toMatch(/^    name: Publish master image on Windows runner\s*$/m)
    expect(publish).toMatch(/^    if: github\.ref == 'refs\/heads\/master'\s*$/m)
    expect(publish).toMatch(/^    runs-on: \[self-hosted, Windows, X64\]\s*$/m)
    expect(publish).toMatch(/^    environment:\s*\n      name: dev\s*\n      deployment: false\s*$/m)

    const deploy = jobBlock(text, "deploy")
    expect(deploy).toMatch(/^    needs: publish\s*$/m)
    expect(deploy).toMatch(/^    if: github\.ref == 'refs\/heads\/master'\s*$/m)
    expect(deploy).toMatch(/^    runs-on: \[self-hosted, Linux, X64\]\s*$/m)
    expect(deploy).toMatch(/^    environment: dev\s*$/m)

    const finalize = jobBlock(text, "finalize")
    expect(finalize).toMatch(/^    needs: \[publish, deploy\]\s*$/m)
    expect(finalize).toMatch(/^    if: \$\{\{ always\(\) && github\.ref == 'refs\/heads\/master' \}\}\s*$/m)
    expect(finalize).toMatch(/^    runs-on: \[self-hosted, Linux, X64\]\s*$/m)
    expect(finalize).toMatch(/^    environment:\s*\n      name: dev\s*\n      deployment: false\s*$/m)
  })

  it("publish 开始阶段精确上报 master dev active metric 且 PR 无此能力", () => {
    const publish = jobBlock(read(RELEASE), "publish")
    const activeMetric = stepByName(publish, "Push CI/CD active metric")
    const names = stepBlocks(publish).map(stepName)
    expect(names.indexOf("Record pipeline start")).toBeLessThan(names.indexOf("Push CI/CD active metric"))
    expect(names.indexOf("Push CI/CD active metric")).toBeLessThan(names.indexOf("Checkout"))
    expect(activeMetric).toMatch(/^        continue-on-error: true\s*$/m)
    expect(activeMetric).toMatch(/^        timeout-minutes: 1\s*$/m)
    expect(activeMetric).toContain("PUSHGW_AUTH: ${{ secrets.PUSHGW_BASIC_AUTH }}")
    expect(activeMetric).toContain('cicd_pipeline_active{project="ai-audio-assistant-ui",branch="master",environment="dev",runner="${{ runner.name }}"} 1')
    expect(activeMetric).toContain('cicd_pipeline_active_timestamp_seconds{project="ai-audio-assistant-ui",branch="master",environment="dev",runner="${{ runner.name }}"} $now')
    expect(activeMetric).toContain("-TimeoutSec 5")
    expect(read(PR_CI)).not.toContain("cicd_pipeline_active")
    expect(read(PR_CI)).not.toContain("PUSHGW_BASIC_AUTH")
  })

  it("publish 与 deploy 各自只登录一次并严格隔离和清理凭据", () => {
    const text = read(RELEASE)
    expect(text).not.toMatch(/(?:~|\$HOME|\$env:USERPROFILE)[/\\]\.docker/)
    for (const jobId of ["publish", "deploy"]) {
      const job = jobBlock(text, jobId)
      const loginSteps = stepBlocks(job).filter((step) => usesOccurrences(step).some(({ value }) => value === `docker/login-action@${LOGIN_SHA}`))
      expect(loginSteps, `${jobId} 只能有一次 login-action`).toHaveLength(1)
      expect(loginSteps[0]).toMatch(/^          logout:\s*false\s*$/m)
      for (const step of stepBlocks(job)) {
        expect(normalizedStepRun(step)).not.toMatch(/\bdocker\s+login\b/i)
      }

      const steps = stepBlocks(job)
      const names = steps.map(stepName)
      expect(names.indexOf("Isolate Docker credentials")).toBeLessThan(names.indexOf("Login to ACR"))
      const isolate = stepByName(job, "Isolate Docker credentials")
      const cleanup = steps.at(-1) ?? ""
      const suffix = jobId === "publish"
        ? ".docker-$env:GITHUB_RUN_ID-$env:GITHUB_RUN_ATTEMPT-$env:GITHUB_JOB"
        : ".docker-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}-${GITHUB_JOB}"
      for (const token of ["DOCKER_CONFIG", "RUNNER_TEMP", "GITHUB_RUN_ID", "GITHUB_RUN_ATTEMPT", "GITHUB_JOB"]) {
        expect(job).toContain(token)
      }
      expect(isolate).toContain(suffix)
      expect(cleanup).toContain(suffix)
      expect(cleanup).toMatch(/^      - name: Cleanup Docker credentials\s*$/m)
      expect(cleanup).toMatch(/^        if: always\(\)\s*$/m)
      const expected = cleanup.search(/^(?!\s*#).*expected.*RUNNER_TEMP.*$/im)
      const exact = cleanup.search(/^(?!\s*#).*DOCKER_CONFIG.*(?:!=|-ne).*expected.*$/im)
      const boundary = cleanup.search(/^(?!\s*#).*(?:StartsWith\(\$runnerTemp|case "\$DOCKER_CONFIG").*$/im)
      const deletion = cleanup.search(/^(?!\s*#).*(?:Remove-Item.*configPath|rm -rf --.*DOCKER_CONFIG).*$/im)
      expect(expected).toBeGreaterThanOrEqual(0)
      expect(exact).toBeGreaterThanOrEqual(0)
      expect(boundary).toBeGreaterThanOrEqual(0)
      expect(deletion).toBeGreaterThan(Math.max(expected, exact, boundary))
    }
  })

  it("deploy 验证镜像身份和容器内版本，失败时输出日志", () => {
    const deploy = jobBlock(read(RELEASE), "deploy")
    expect(deploy).toContain("docker inspect --format '{{.Config.Image}}' ai-audio-assistant-ui")
    expect(deploy).toContain("${{ env.IMAGE_NAME }}:${{ github.sha }}")
    expect(deploy).toMatch(/actual_image.*!=.*expected_image/)
    expect(deploy).toMatch(/docker exec ai-audio-assistant-ui[^\n]*(?:\\\n[^\n]*)*http:\/\/127\.0\.0\.1:3000\/version/)
    expect(deploy).toMatch(/version.*GITHUB_SHA|GITHUB_SHA.*version/)
    expect(deploy).toContain("docker logs --tail=")
  })

  it("finalize 集中副作用、联合结果并在任一前置失败时最终失败", () => {
    const text = read(RELEASE)
    for (const jobId of ["publish", "deploy"]) {
      const job = jobBlock(text, jobId)
      expect(job).not.toContain("push-cicd-metrics.sh")
      expect(job).not.toContain("FEISHU_INFRA_WEBHOOK")
    }

    const finalize = jobBlock(text, "finalize")
    expect(stepBlocks(finalize).filter((step) => stepName(step) === "Push CI/CD metrics")).toHaveLength(1)
    expect(stepBlocks(finalize).filter((step) => stepName(step) === "通知飞书(部署结果)")).toHaveLength(0)
    expect(text).not.toContain("FEISHU_INFRA_WEBHOOK")
    const resolveStatus = stepByName(finalize, "Resolve final release status")
    expect(resolveStatus).toContain("PUBLISH_RESULT: ${{ needs.publish.result }}")
    expect(resolveStatus).toContain("DEPLOY_RESULT: ${{ needs.deploy.result }}")
    expect(resolveStatus).toMatch(/if \[ "\$PUBLISH_RESULT" = "success" \] && \[ "\$DEPLOY_RESULT" = "success" \]; then/)
    expect(resolveStatus).toContain("final_status=failure")

    const metrics = stepByName(finalize, "Push CI/CD metrics")
    expect(metrics).toMatch(/^        if: always\(\)\s*$/m)
    expect(metrics).toMatch(/^        continue-on-error: true\s*$/m)
    expect(metrics).toMatch(/^        timeout-minutes: 2\s*$/m)
    expect(finalize).toContain("${{ steps.final_status.outputs.status }}")
    expect(stepByName(finalize, "Fail unsuccessful release")).toMatch(/exit 1/)
    expect(finalize).not.toMatch(/deployment:\s*true/)
  })

  it("旧手动部署仅作为 disabled 归档存在", () => {
    expect(() => statSync(join(WORKFLOWS, "deploy.yml"))).toThrow()
    expect(statSync(join(WORKFLOWS, "deploy.legacy.disabled")).isFile()).toBe(true)
  })
})

describe("Action pin scanner", () => {
  it("支持标准 uses 行并拒绝所有无法解析的非注释 uses 键", () => {
    const sha = "a".repeat(40)
    for (const line of [
      `uses: owner/action@${sha} # v1`,
      `  - uses: owner/action@${sha} # v1.2.3`,
      `    uses: 'owner/action@${sha}' # v2`,
      `      - uses: "owner/action/path@${sha}" # v3`,
    ]) {
      expect(parseUsesLine(line)).not.toBeNull()
    }
    for (const line of [
      "uses owner/action@v1",
      "- uses:",
      "uses:: owner/action@v1",
      `- {name: Checkout, uses: owner/action@${sha}}`,
      `"uses": owner/action@${sha} # v1`,
      `'uses': owner/action@${sha} # v1`,
      `- "uses": owner/action@${sha} # v1`,
      `- {'uses': owner/action@${sha}}`,
    ]) {
      expect(() => parseUsesLine(line)).toThrow("独立 block-style")
    }
    for (const line of ["# uses: owner/action@v1", "  # \"uses\": owner/action@v1", "\t# - {uses: owner/action@v1}"]) {
      expect(parseUsesLine(line)).toBeNull()
    }
  })

  it("解析 Windows CRLF workflow 时不把回车带入 uses 与顶层块", () => {
    const text = [
      "permissions:",
      "  contents: read",
      "jobs:",
      "  validate:",
      "    steps:",
      `      - uses: actions/checkout@${CHECKOUT_SHA} # v6`,
      "",
    ].join("\r\n")

    expect(indentedBlock(text, "permissions", 0).trimEnd().split("\n")).toEqual([
      "permissions:",
      "  contents: read",
    ])
    expect(usesOccurrences(text).map(({ value, comment }) => [value, comment])).toEqual([
      [`actions/checkout@${CHECKOUT_SHA}`, "# v6"],
    ])
  })

  it("递归解析本地 Action、纳入未引用 manifest 并安全终止循环", () => {
    const root = temporaryRoot()
    writeFixture(root, ".github/workflows/ci.yml", "steps:\n  - uses: ./custom/entry\n")
    writeFixture(root, "custom/entry/action.yml", "steps:\n  - uses: ./custom/loop\n")
    writeFixture(root, "custom/loop/action.yaml", "steps:\n  - uses: ./custom/file-action.yml\n")
    writeFixture(root, "custom/file-action.yml", `steps:\n  - uses: ./custom/entry\n  - uses: owner/action@${"a".repeat(40)} # v1\n`)
    writeFixture(root, ".github/actions/unreferenced/action.yaml", "runs:\n  using: composite\n")
    expect(validateActionFiles(root).map((path) => portablePath(relative(realpathSync(root), path)))).toEqual([
      ".github/actions/unreferenced/action.yaml",
      ".github/workflows/ci.yml",
      "custom/entry/action.yml",
      "custom/file-action.yml",
      "custom/loop/action.yaml",
    ])
  })

  it("将 Windows 路径统一为可审计的 POSIX 相对路径", () => {
    expect(portablePath(".github\\workflows\\ci.yml")).toBe(".github/workflows/ci.yml")
    expect(portablePath("custom/entry/action.yml")).toBe("custom/entry/action.yml")
  })

  it("Windows 使用无需符号链接权限的目录 junction 验证真实路径逃逸", () => {
    expect(directoryLinkType("win32")).toBe("junction")
    expect(directoryLinkType("darwin")).toBe("dir")
  })

  it("拒绝本地 Action 缺失、逃逸及目录无 manifest", () => {
    const root = temporaryRoot()
    writeFixture(root, ".github/workflows/ci.yml", "steps:\n  - uses: ./missing\n")
    expect(() => collectActionFiles(root)).toThrow("目标不存在")
    mkdirSync(join(root, "empty-action"))
    writeFixture(root, ".github/workflows/ci.yml", "steps:\n  - uses: ./empty-action\n")
    expect(() => collectActionFiles(root)).toThrow("缺少 action.yml/action.yaml")
    writeFixture(root, ".github/workflows/ci.yml", "steps:\n  - uses: ./../outside\n")
    expect(() => collectActionFiles(root)).toThrow("不能逃逸仓库根目录")
  })

  it("按真实路径拒绝仓内 symlink 指向仓外 Action 文件或目录", () => {
    const root = temporaryRoot()
    const outside = temporaryRoot()
    if (process.platform !== "win32") {
      writeFixture(outside, "file-action.yml", "runs:\n  using: composite\n")
      symlinkSync(join(outside, "file-action.yml"), join(root, "linked-action.yml"), "file")
      writeFixture(root, ".github/workflows/ci.yml", "steps:\n  - uses: ./linked-action.yml\n")
      expect(() => collectActionFiles(root)).toThrow("真实路径不能逃逸仓库根目录")
    }

    writeFixture(outside, "directory-action/action.yml", "runs:\n  using: composite\n")
    symlinkSync(join(outside, "directory-action"), join(root, "linked-action"), directoryLinkType())
    writeFixture(root, ".github/workflows/ci.yml", "steps:\n  - uses: ./linked-action\n")
    expect(() => collectActionFiles(root)).toThrow("真实路径不能逃逸仓库根目录")
  })

  it("扫描所有 active、disabled 与 action manifest 并锁定外部 Action", () => {
    const scanned = validateActionFiles(ROOT)
    expect(scanned.length).toBeGreaterThan(0)
  })

  it("每次已知 Action 出现都要求精确 SHA 和版本注释", () => {
    for (const [actionName, [sha, comment]] of KNOWN_ACTION_PINS) {
      expect(() => assertExternalActionPin(`${actionName}@${sha}`, comment)).not.toThrow()
      expect(() => assertExternalActionPin(`${actionName}@${"a".repeat(40)}`, comment)).toThrow("已知 Action pin 不匹配")
      expect(() => assertExternalActionPin(`${actionName}@${sha}`, "# v0")).toThrow("已知 Action pin 不匹配")
    }
  })

  it("每个 checkout 步骤都关闭 persist-credentials", () => {
    for (const path of collectActionFiles(ROOT)) {
      const context = relative(ROOT, path)
      for (const [index, step] of documentSteps(readFileSync(path, "utf8"), context).entries()) {
        if (typeof step.uses !== "string" || step.uses.slice(0, step.uses.lastIndexOf("@")) !== "actions/checkout") {
          continue
        }
        expect(isRecord(step.with), `${context}:steps[${index}].with`).toBe(true)
        expect(isRecord(step.with) ? step.with["persist-credentials"] : undefined, `${context}:steps[${index}]`).toBe(false)
      }
    }
  })

  it("checkout 不接受 env 或 run 中伪造的 persist-credentials 文本", () => {
    const fixtures = [
      [
        `      - uses: actions/checkout@${CHECKOUT_SHA} # v6`,
        "        env:",
        "          SPOOF: |",
        "            persist-credentials: false",
      ].join("\n"),
      [
        `      - uses: actions/checkout@${CHECKOUT_SHA} # v6`,
        "        run: |",
        "          echo 'persist-credentials: false'",
      ].join("\n"),
    ]
    for (const fixture of fixtures) {
      const step = parseStepBlock(fixture)
      expect(isRecord(step.with) ? step.with["persist-credentials"] : undefined).not.toBe(false)
    }
  })
})
