---
name: codebuddy-pipeline
description: 触发 CodeBuddy 多 Agent 编排开发流水线（产品规划→需求拆解→架构→开发→审查→测试→部署 / GitHub Issue 自动修复闭环）。当用户提出「帮我开发 XX 项目」「拉取 git 仓库开始开发」「先做产品分析和需求拆解」「按我的意见改 PRD / 需求」「从 X 阶段继续跑」「只跑开发测试阶段」「先演练一遍看看会执行什么」「远程确认 / 驳回产物」「监听 GitHub 仓库 Issues 并自动修复」等涉及 CodeBuddy 驱动的开发、编码、仓库拉取、流水线编排、产物修订、Issue 修复的意图时，即使没有明说"流水线"，也必须加载本技能，按其中链路调用本技能 scripts 目录下的脚本执行，不要用通用 shell 命令自行拼装。
---

# CodeBuddy 多 Agent 编排流水线

通过本机已装的 CodeBuddy CLI（`@tencent-ai/codebuddy-code`）驱动多角色、多模型的完整开发流水线。Agent 负责识别意图并调用脚本，脚本负责编排 CodeBuddy 各子代理按阶段产出。

## 目录与脚本

本技能根目录即本 `SKILL.md` 所在目录（下称 `SKILL_ROOT`），所有脚本、配置、提示词均在其下：

- `SKILL_ROOT/scripts/run-pipeline.js` — 主编排器：按阶段序列逐阶段调用 CodeBuddy CLI
- `SKILL_ROOT/scripts/req-builder.js` — 需求构建器：引导用户按 7 维度描述需求，AI 整理为双版本提示词供选择
- `SKILL_ROOT/scripts/init-project.js` — 拉取 git 仓库到开发目录
- `SKILL_ROOT/scripts/set-project-root.js` — 设置开发目录（写入用户级配置，跨机器/重装后仍生效）
- `SKILL_ROOT/scripts/watch-issues.js` — GitHub Issues 监听 + 自动修复循环
- `SKILL_ROOT/scripts/lib/resolve-project-root.js` — 开发目录解析器（无固定路径）
- `SKILL_ROOT/config/agents.json` — 子代理定义（prompt/tools/model/fallbackModels）
- `SKILL_ROOT/config/pipeline.json` — 开发流水线阶段序列（01~07）
- `SKILL_ROOT/config/issue-pipeline.json` — Issue 修复流水线阶段序列（01~05）
- `SKILL_ROOT/config/github.json` — Issue 监听所需 owner/repo/token（由 `github.example.json` 复制而来，需自行填写）
- `SKILL_ROOT/config/settings.json` — 开发目录配置（由 `settings.example.json` 复制而来，可选）
- `SKILL_ROOT/prompts/` — 各阶段提示词模板
- `SKILL_ROOT/artifacts/` — 各阶段产物（运行时自动创建）；`artifacts/.confirm-state.json` 为远程暂停状态
- `SKILL_ROOT/logs/pipeline.log` — 运行日志

**路径约定**：脚本内部以自身文件位置解析上述目录，因此技能可安装在任意路径下，命令中不要写死绝对路径，用 `SKILL_ROOT` 拼接。

## 前置条件

1. 已安装 Node.js，并全局安装 CodeBuddy CLI：`npm install -g @tencent-ai/codebuddy-code`
2. 首次使用在终端执行 `codebuddy` 完成账号登录（后续复用登录态）。
3. 开发目录（项目根目录）由用户自定义，本技能不含任何固定机器路径。解析优先级：
   1. `--project-root <目录>`（`init-project.js` 亦可用 `--root`）
   2. 环境变量 `CODEBUDDY_PROJECT_ROOT`
   3. 用户级配置 `~/.codebuddy/settings.json` 的 `projectRoot` 字段（推荐用 `node SKILL_ROOT/scripts/set-project-root.js <目录>` 一次性设置）
   4. 本技能 `config/settings.json` 的 `projectRoot` 字段
   5. 当前工作目录（兜底）
   项目始终创建在 `<开发目录>/<项目名>` 的独立子文件夹下。

## 触发场景 → 执行动作

| 用户意图 | 执行动作 |
|---|---|
| 新项目从零开发 | 写需求到 `artifacts/00-requirement.md` → `node SKILL_ROOT/scripts/run-pipeline.js --project-name <项目名> --remote` |
| 引导式整理需求 | `node SKILL_ROOT/scripts/req-builder.js --guide` → `--build "<需求文本>"` → `--select A\|B --auto-run --project-name <项目名>` |
| 基于已有仓库开发 | `node SKILL_ROOT/scripts/init-project.js --url <git地址> [--name <项目名>]` → 写需求 → `run-pipeline.js --project-name <项目名> --remote` |
| 只做前期分析（PRD + 需求拆解） | `node SKILL_ROOT/scripts/run-pipeline.js --project-name <项目名> --remote --init-only` |
| 按意见修订产物 | `node SKILL_ROOT/scripts/run-pipeline.js --project-name <项目名> --from <当前阶段ID> --amend "<意见>" --remote` |
| 远程确认后续跑 | 读状态文件确认下一阶段 → `node SKILL_ROOT/scripts/run-pipeline.js --project-name <项目名> --from <下一阶段ID> --remote` |
| 断点续跑 | `node SKILL_ROOT/scripts/run-pipeline.js --project-name <项目名> --from <阶段ID>` |
| 指定阶段范围 | `node SKILL_ROOT/scripts/run-pipeline.js --project-name <项目名> --from 04-develop --to 06-test` |
| 先演练（不执行） | `node SKILL_ROOT/scripts/run-pipeline.js --project-name <项目名> --dry-run` |
| 监听 Issues 自动修复 | `node SKILL_ROOT/scripts/watch-issues.js --daemon` 或 `--once` |
| 设置/查看开发目录 | `node SKILL_ROOT/scripts/set-project-root.js <目录>`（不带参数则显示当前生效目录及来源） |

## 执行步骤

### 1. 新项目从零开发
1. 将用户需求写入 `SKILL_ROOT/artifacts/00-requirement.md`（保留用户原话，可整理为结构化需求）。
2. 运行 `node SKILL_ROOT/scripts/run-pipeline.js --project-name <项目名> --remote`
3. 项目目录自动创建在 `<project-root>/<项目名>` 下。

### 2. 引导式需求整理（推荐）
1. `node SKILL_ROOT/scripts/req-builder.js --guide` 输出 7 维度需求描述模板给用户。
2. 用户填写后，`node SKILL_ROOT/scripts/req-builder.js --build "<需求文本>"` 调用 AI 生成「精简通用版 / 高阶顶配版」双版本，写入 `artifacts/00-need-refined.md`。
3. 用户选定后，`node SKILL_ROOT/scripts/req-builder.js --select A --auto-run --project-name <项目名>` 写入 `artifacts/00-requirement.md` 并直接续跑流水线。

### 3. 基于已有仓库开发
1. 运行 `node SKILL_ROOT/scripts/init-project.js --url <git地址> --name <项目名>`（`--name` 缺省取仓库名）。
2. 写需求到 `artifacts/00-requirement.md`。
3. 运行 `node SKILL_ROOT/scripts/run-pipeline.js --project-name <项目名> --remote`。

### 4. 远程确认闭环（人不在电脑边，默认走此模式）
所有运行统一加 `--remote`。到达 `confirm: true` 的阶段（01 产品规划、02 需求拆解）时，脚本写 `artifacts/.confirm-state.json` 后以退出码 42 结束。
- **检测暂停**：shell 返回退出码 42，或 stdout 出现 `REMOTE_CONFIRM_NEEDED` 时，读取 `SKILL_ROOT/artifacts/.confirm-state.json`（含 projectName / 当前 stageId / 产物路径 / nextStageId）。
- **向用户转述**：读取当前阶段产物摘要，在对话框展示并询问「确认继续 / 修改意见」。
- **用户确认** → 运行 `node SKILL_ROOT/scripts/run-pipeline.js --project-name <项目名> --from <nextStageId> --remote`。
- **用户提意见** → 运行 `node SKILL_ROOT/scripts/run-pipeline.js --project-name <项目名> --from <当前stageId> --amend "<意见>" --remote`，重跑后再转述确认。
- 状态文件会被下一次运行覆盖，无需手动清理。

### 5. Issue 修复闭环
1. 确认 `SKILL_ROOT/config/github.json` 已配置 `owner / repo / token`（或设置 `GITHUB_TOKEN` 环境变量）。
2. 常驻监听：`node SKILL_ROOT/scripts/watch-issues.js --daemon`；单次检查：`--once`。
3. 首次运行建立基线，之后新 Issue 进入 01 分析 → 02 方案 → 03 修复 → 04 验证 → 05 PR 描述的修复流水线（使用 `config/issue-pipeline.json`）。

## 阶段 ID 速查

开发流水线（pipeline.json，01/02 带 confirm）：

| ID | 名称 | agent | 产出 |
|---|---|---|---|
| 01-product-plan | 产品规划 | product-manager | artifacts/01-prd.md |
| 02-requirements | 需求拆解 | product-manager | artifacts/02-tasks.md |
| 03-architecture | 架构设计 | architect | artifacts/03-architecture.md |
| 04-develop | 开发编码 | developer | 项目代码 |
| 05-code-review | 代码审查 | code-reviewer | artifacts/05-review.md |
| 06-test | 测试 | tester | artifacts/06-test-report.md |
| 07-deploy | 部署 | devops | artifacts/07-deploy.md |

Issue 修复流水线（issue-pipeline.json）：01-issue-analysis → 02-fix-plan → 03-fix-dev → 04-fix-test → 05-pr-summary

## 关键参数

`run-pipeline.js`：`--project-name`(必填) / `--project-dir` / `--project-root` / `--from`(默认 01-product-plan) / `--to`(默认 07-deploy) / `--remote` / `--interactive` / `--init-only` / `--amend "<意见>"` / `--dry-run` / `--pipeline-config`(默认 config/pipeline.json) / `--agents-config`(默认 config/agents.json)

`req-builder.js`：`--guide` / `--build "<需求文本>"` / `--select A|B` / `--auto-run` / `--project-name` / `--remote` / `--dry-run`

`init-project.js`：`--url`(必填) / `--name` / `--branch` / `--root`(= `--project-root`) / `--dir` / `--dry-run`

`set-project-root.js`：`<开发目录>`（位置参数；不传则仅查看当前生效目录与来源）

`watch-issues.js`：`--daemon`(常驻) / `--once` / `--owner` / `--repo` / `--token` / `--dir` / `--interval-ms` / `--process-existing`

## 注意事项

1. **CLI 就绪**：需本机已装 `@tencent-ai/codebuddy-code`；脚本会自动定位 CLI 入口（Windows 下以 node 直跑 JS 入口，规避 .cmd 的 EINVAL）。
2. **开发目录**：项目落在 `<开发目录>/<项目名>`。开发目录由用户自定义（优先级：`--project-root` > `CODEBUDDY_PROJECT_ROOT` > `~/.codebuddy/settings.json` > `config/settings.json` > 当前工作目录）；未配置时脚本会打印提示，并可用 `node SKILL_ROOT/scripts/set-project-root.js <目录>` 一次性设定。
3. **分支策略**：拉取仓库默认优先 `DEV` / `dev` / `develop`，其次取第 1 位远程分支，不用 MASTER。
4. **模型限额**：quota / 429 时按 `agents.json` 中 `fallbackModels` 自动切换，无需人工干预。运行时也会从 `~/.codebuddy/models.json` 读取自定义模型作为候选，链尾 `auto` 兜底。
5. **权限参数**：脚本默认带 `--dangerously-skip-permissions`，仅对可信项目使用；涉及删除/覆盖等敏感操作仍需遵守安全规则。
6. **日志与产物**：每次运行写 `logs/pipeline.log`；产物在 `artifacts/`，转述给用户时用真实路径。
7. **失败处理**：脚本非 42 退出码表示真实失败，读取 stderr/stdout 定位原因后再决定重试或调整参数，不要盲目重复同一命令。
