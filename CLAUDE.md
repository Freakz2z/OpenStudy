# OpenStudy — Markdown-first AI 学习工作台

电子书阅读 + 做题练习 + AI 辅助学习的桌面应用。Electron + React + TypeScript + SQLite。

## 核心理念

OpenStudy **不生产知识**，只将知识结构化、可视化。把静态文档变成可练习、可追踪的题库。

## 产品形态

| 形态 | 说明 | 进度 |
|------|------|------|
| Desktop | Electron 桌面应用（题库管理 + 做题 + 考试） | ~90% |
| CLI | `openstudy` 命令行工具 | ~85% |
| Skill | Claude Code 斜杠命令（`.claude/skills/openstudy/`） | ~80% |
| Standard | OpenStudy 标准格式（Markdown/JSON） | ~80% |

## 技术栈

- **前端**: Electron + React + TypeScript + React Router
- **样式**: CSS Variables + 自定义组件
- **数据库**: SQLite（`better-sqlite3`）
- **AI**: 多 LLM 支持（OpenAI / Anthropic / DeepSeek / Ollama）
- **文档解析**: MarkItDown（PDF/Word/PPT/Excel → Markdown）
- **国际化**: i18next（中/英）

## 关键目录

| 目录 | 说明 |
|------|------|
| `src/main/` | Electron 主进程（IPC、DB、LLM 服务） |
| `src/renderer/` | React 渲染进程（页面、组件） |
| `src/shared/` | 共享类型和工具函数 |
| `src/cli/` | `openstudy` CLI 实现 |
| `src/preload/` | Electron preload 桥接 |
| `tests/` | 单元测试 + E2E 测试 |

## 关键文件

| 文件 | 说明 |
|------|------|
| `src/shared/types.ts` | 全部 TypeScript 类型定义 |
| `src/shared/openstudy-standard.ts` | OpenStudy Standard Markdown/JSON 格式转换 |
| `src/main/services/db.ts` | SQLite 数据库操作和 Schema |
| `src/renderer/App.tsx` | 前端路由定义 |
| `STUDY.md` | 完整的 Skill 文档（斜杠命令、格式规范、工作流） |
| `.claude/skills/openstudy/` | Claude Code 斜杠命令 Skill 定义 |

## 常用命令

```bash
npm run dev          # 启动 Electron 开发模式
npm run test:unit    # 运行单元测试
npm run test:e2e     # 运行 E2E 测试
npm run typecheck    # 全部类型检查

# CLI 在 Electron 之外独立运行：
npx tsx src/cli/index.ts <command>
```

## Skill 体系

项目提供了 10 个 Claude Code 斜杠命令（见 `STUDY.md` 和 `.claude/skills/openstudy/`）。当用户提出学习相关需求时，优先使用对应 Skill 完成：

- `/openstudy:ingest` — 导入文档
- `/openstudy:exam` — 将 AI 生成的题目导入题库
- `/openstudy:validate` — 校验题目格式
- `/openstudy:insights` — 学习分析
- `/openstudy:export` — 导出题目
- （完整列表见 STUDY.md）

## 代码约定

- 不写 JSDoc/注释说明 WHAT，只写 WHY（当不显而易见时）
- 优先编辑已有文件而非新建
- 不要为假想需求添加功能
- 在 UI 变更后启动 dev server 并在浏览器中实际验证
