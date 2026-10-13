# CodeBuddy Pipeline Skill

一个可安装的 Agent Skill：用 CodeBuddy Code CLI 的多 Agent / 多模型能力，把「产品规划 → 需求拆解 → 架构设计 → 开发编码 → 代码审查 → 测试 → 部署」拆成七个阶段自动执行，并支持 GitHub Issue 自动修复闭环。

## 仓库结构

```
codebuddy-pipeline-skill/
├── README.md
├── LICENSE
├── .gitignore
└── skills/
    └── codebuddy-pipeline/
        ├── SKILL.md              # 技能定义（frontmatter + 指令）
        ├── scripts/
        │   ├── run-pipeline.js   # 主编排器
        │   ├── req-builder.js    # 需求构建器（双版本提示词）
        │   ├── init-project.js   # 拉取 git 仓库
        │   └── watch-issues.js   # GitHub Issues 监听 + 自动修复
        ├── prompts/              # 各阶段提示词模板
        ├── config/
        │   ├── agents.json       # 子代理定义（角色/提示词/模型/工具）
        │   ├── pipeline.json     # 开发流水线阶段序列
        │   ├── issue-pipeline.json
        │   └── github.example.json
        └── references/
            ├── marvis-trigger.md # 触发链路与话术说明
            └── pipeline-guide.md # 流水线原理与完整参数
```

## 分支与发布流程

| 分支 | 用途 |
|---|---|
| `dev` | 日常开发分支，所有改动**先提交到这里** |
| `master` | 稳定分支，仅接受来自 `dev` 且**验证通过**的合并 |

发布节奏：`dev` 开发 → 验证通过后合并到 `master` → 在 `master` 上打 release tag。

```bash
# 1. 日常开发：提交并推送 dev
git checkout dev
git add . && git commit -m "feat: xxx"
git push origin dev

# 2. 验证通过后同步到 master（不使用 fast-forward，保留合并记录）
git checkout master
git merge --no-ff dev
git push origin master

# 3. 打 release tag 并推送
git tag -a v0.1.0 -m "release v0.1.0"
git push origin master --tags
```

## 安装

### 方式一：Skills CLI（推荐）

```bash
npx skills add <owner>/<repo>
```

- 全局安装到用户级技能目录：`npx skills add <owner>/<repo> -g -y`
- 仅装某技能：`npx skills add <owner>/<repo>@codebuddy-pipeline`
- 技能处于深层目录时：追加 `--full-depth`

### 方式二：手动安装

把 `skills/codebuddy-pipeline/` 整个目录复制到目标 Agent 的技能目录即可（例如 Claude Code 的 `~/.claude/skills/`、OpenCode 的 `~/.config/opencode/skills/`，或 Marvis 的 `skills/custom/`）。

## 前置条件

1. Node.js（建议 18+）
2. CodeBuddy CLI：
   ```bash
   npm install -g @tencent-ai/codebuddy-code
   codebuddy   # 首次登录
   ```

## 快速开始

```bash
SKILL=<技能安装目录>/codebuddy-pipeline

# 演练：只打印每阶段将执行的命令，不真正调用 CLI
node "$SKILL/scripts/run-pipeline.js" --project-name demo-app --dry-run

# 远程确认模式：confirm 阶段产出后写状态文件并以退出码 42 暂停，由 Agent 转述确认
node "$SKILL/scripts/run-pipeline.js" --project-name demo-app --remote

# 引导式需求整理 → 选版 → 自动续跑
node "$SKILL/scripts/req-builder.js" --guide
node "$SKILL/scripts/req-builder.js" --build "<需求文本>"
node "$SKILL/scripts/req-builder.js" --select A --auto-run --project-name demo-app
```

开发目录默认 `D:\nodejs\code`（Windows）/ `~/codebuddy-projects`（macOS、Linux），可用 `--project-root` 或环境变量 `CODEBUDDY_PROJECT_ROOT` 覆盖。

## 配置

- `config/agents.json`：各角色 Agent 的提示词、工具白名单、模型与 `fallbackModels`（模型限额时自动切换）。
- `config/pipeline.json`：阶段序列，阶段加 `"confirm": true` 表示产出后需人工确认（默认 01/02）。
- `config/github.json`：Issue 监听所需 `owner / repo / token`（从 `github.example.json` 复制，token 请勿提交到仓库）。

## 文档

- 技能入口与触发规则：`skills/codebuddy-pipeline/SKILL.md`
- 流水线原理与完整参数：`skills/codebuddy-pipeline/references/pipeline-guide.md`
- 触发链路与话术映射：`skills/codebuddy-pipeline/references/marvis-trigger.md`

## License

MIT
