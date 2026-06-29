<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/logo_white.png">
  <img src="public/logo_black.png" width="120" height="120" alt="OpenStudy">
</picture>

# OpenStudy

<p><strong>从 Markdown 笔记，到可持续复用的刻意练习。</strong></p>

<p>OpenStudy 是一个 Markdown-first 的 AI 学习工作台：把原始笔记整理成结构化题目，在专注的做题流程里练习，在卡住的地方直接追问 AI，再把错题、反馈和洞察串成真正能长期使用的学习闭环。</p>

[![Release](https://img.shields.io/github/v/release/Freakz3z/OpenStudy?include_prereleases&sort=semver)](https://github.com/Freakz3z/OpenStudy/releases)
[![Build](https://img.shields.io/github/actions/workflow/status/Freakz3z/OpenStudy/release.yml?label=release)](https://github.com/Freakz3z/OpenStudy/actions/workflows/release.yml)
[![License](https://img.shields.io/github/license/Freakz3z/OpenStudy)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%C2%B7%20macOS%20%C2%B7%20Linux-2ea44f)](https://github.com/Freakz3z/OpenStudy/releases)
[![Electron](https://img.shields.io/badge/Electron-32-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-18-149ECA?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

[English](README.md) · [简体中文](README.zh-CN.md) · [参与贡献](CONTRIBUTING.md) · [行为准则](CODE_OF_CONDUCT.md) · [Releases](https://github.com/Freakz3z/OpenStudy/releases) · [更新日志](CHANGELOG.md) · [反馈问题](https://github.com/Freakz3z/OpenStudy/issues)

</div>

<p align="center">
  <img src=".github/assets/usage-flow.svg" alt="OpenStudy 使用流程图" width="100%">
</p>

## 项目定位

OpenStudy 解决的是一个很具体的问题：我们其实已经有很多笔记、摘录和题目草稿，但要把它们真正整理成一套可反复练习的系统，通常还是太费手工。

它不会凭空“生产知识”，而是把已经存在的资料，转成可互动的学习工作台：

- 从 Markdown-first 的题库与笔记内容出发，持续维护可编辑的学习材料。
- 借助 AI 清洗并规范化选择题、填空题、简答题。
- 在专注的做题流程中练习，并支持键盘高频操作。
- 做题卡住时，直接结合上下文向 AI 追问。
- 自动维护错题、支持重做，并持续追踪学习进度。
- 洞察页的 AI 建议改为手动生成，避免每次进入页面都重复消耗。

## 核心亮点

- **Markdown-first**：源内容可编辑、可维护、可版本化，不会越用越乱。
- **AI 帮你清洗，不替你失控**：把粗糙笔记整理成可真正拿来练的结构化题目。
- **练习流为重复训练而设计**：快捷键、重做、底部固定操作区，减少做题摩擦。
- **在最该问的时候问 AI**：不是跳出当前语境，而是在困住你的那一题里直接追问。
- **复盘能力会累积**：错题、薄弱点和 AI 洞察都围绕长期进步服务，而不是一次性展示。
- **发布链路也完整**：支持 Windows、Apple Silicon macOS 和 Linux 的统一构建与分发。

## 使用流程

OpenStudy 的目标不是“把内容整理一下然后结束”，而是把整理、练习、复盘串成一个真正的学习闭环。上方这张流程图目前仍然只是占位视觉，后续会再替换。

## 产品截图

<p align="center">
  <img src=".github/assets/screenshots/openstudy-library.png" alt="OpenStudy 题库界面" width="32.5%">
  <img src=".github/assets/screenshots/openstudy-practice.png" alt="OpenStudy 做题界面" width="32.5%">
  <img src=".github/assets/screenshots/openstudy-insights.png" alt="OpenStudy 洞察界面" width="32.5%">
</p>

## 下载

可从 [Releases 页面](https://github.com/Freakz3z/OpenStudy/releases) 下载各平台构建产物。

| 平台 | 安装包 | 架构 | 说明 |
| --- | --- | --- | --- |
| Windows | `.exe` 安装器 | `x64` | 未签名安装器首次启动时可能触发 SmartScreen。 |
| macOS | `.dmg` | `arm64` | 仅 Apple Silicon。未签名应用首次打开可能需要右键后选择“打开”。 |
| Linux | `.AppImage`、`.deb` | `x64` | 可按发行版习惯选择格式。 |

## AI 提供方

OpenStudy 的题目识别、判分、问 AI 和学习洞察支持多种 LLM 后端：

- DeepSeek
- OpenAI 兼容协议服务
- OpenAI
- Anthropic
- Ollama
- 通过 OpenAI 风格端点接入的 xAI 类服务

如果以中文学习内容为主，DeepSeek 依然是一个很实用的默认选择：结构化 JSON 输出稳定，成本也更友好。

## 本地开发

要求：Node.js 20+，以及一套可正常打包 Electron 桌面应用的本机环境。

```bash
npm install
npm run dev
```

基础检查：

```bash
npm run typecheck
npm run test:unit
```

构建各平台安装包：

```bash
npm run dist:win
npm run dist:mac
npm run dist:linux
```

构建产物默认输出到 `release/<version>/`。

## 自动发布

仓库内置 GitHub Actions，用于构建三平台安装包：

- `windows-2025`：Windows `x64`
- `macos-15`：Apple Silicon macOS `arm64`
- `ubuntu-24.04`：Linux `x64`

触发方式：

- 只有当新的 GitHub Release 被发布时才会执行

如果仓库里存在匹配的 release notes 文件，例如 `.github/RELEASE_NOTES_v0.1.0.md`，工作流会优先把它作为正式发布说明，并在下方追加 GitHub 自动生成的变更记录。

安装包会被统一命名为：

- `OpenStudy-<version>-windows-x64-installer.exe`
- `OpenStudy-<version>-macos-arm64.dmg`
- `OpenStudy-<version>-linux-x64.AppImage`
- `OpenStudy-<version>-linux-x64.deb`

## 当前阶段

OpenStudy 已经可以稳定完成核心学习流程，但目前仍然保持轻量：

- 产品方向已经明确切到 Markdown-first。
- 超大 Markdown 内容暂未自动重组到模型上下文范围内。
- 整个项目还在逐步补齐更完整的开源协作体验。

## 开源整理中

当前仓库已经在朝更完整的开源形态推进，包括更正式的 README、多语言文档、跨平台打包和自动化发布流程。

## 参与贡献

欢迎提交 Bug、功能建议、体验优化和打包改进。发起 PR 前建议先阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 许可证

[MIT](LICENSE)
