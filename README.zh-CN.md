<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/logo_white.png">
  <img src="public/logo_black.png" width="120" height="120" alt="OpenStudy">
</picture>

# OpenStudy

<p><strong>从 Markdown 笔记，到可持续复用的刻意练习。</strong></p>

<p>OpenStudy 是一个 Markdown-first 的 AI 学习工作台：把原始笔记和导入文档整理成结构化题目，在专注的做题流程里练习，在卡住的地方直接追问 AI，再把错题、反馈和洞察串成真正能长期使用的学习闭环。</p>

[![Release](https://img.shields.io/github/v/release/Freakz2z/OpenStudy?include_prereleases&sort=semver)](https://github.com/Freakz2z/OpenStudy/releases)
[![Build](https://img.shields.io/github/actions/workflow/status/Freakz2z/OpenStudy/release.yml?label=release)](https://github.com/Freakz2z/OpenStudy/actions/workflows/release.yml)
[![License](https://img.shields.io/github/license/Freakz2z/OpenStudy)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%C2%B7%20macOS%20%C2%B7%20Linux-2ea44f)](https://github.com/Freakz2z/OpenStudy/releases)
[![Electron](https://img.shields.io/badge/Electron-32-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-18-149ECA?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

[English](README.md) · [简体中文](README.zh-CN.md) · [参与贡献](CONTRIBUTING.md) · [行为准则](CODE_OF_CONDUCT.md) · [Releases](https://github.com/Freakz2z/OpenStudy/releases) · [更新日志](CHANGELOG.md) · [反馈问题](https://github.com/Freakz2z/OpenStudy/issues)

</div>

<p align="center">
  <img src=".github/assets/usage-flow.png" alt="OpenStudy 的 Markdown-first 学习流程总览图，覆盖导入、清洗、练习、错题复盘与手动洞察生成" width="100%">
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

## 你可以用它做什么

- **Markdown-first**：源内容可编辑、可维护、可版本化，不会越用越乱。
- **先把文档转成 Markdown，而不是丢进黑箱**：可通过 MarkItDown 导入 PDF、Word、PowerPoint、HTML、CSV 等格式，再继续走统一的 Markdown 工作流。
- **AI 帮你清洗，不替你失控**：把粗糙笔记整理成可真正拿来练的结构化题目。
- **练习流为重复训练而设计**：快捷键、重做、底部固定操作区，减少做题摩擦。
- **在最该问的时候问 AI**：不是跳出当前语境，而是在困住你的那一题里直接追问。
- **复盘能力会累积**：错题、薄弱点和 AI 洞察都围绕长期进步服务，而不是一次性展示。
- **发布链路也完整**：支持 Windows、Apple Silicon macOS 和 Linux 的统一构建与分发。

## 快速总览

1. **导入 Markdown**：从 Markdown 题库出发，直接进入一个可持续维护的学习工作台。
2. **检查并做题**：先检查源码，再进入专注的练习流程，配合快捷键进行高频重复训练。
3. **在题目里问 AI**：不离开当前上下文，直接获得提示、解释和思路纠偏。
4. **完成学习闭环**：错题进入错题本重做，需要复盘时再手动生成洞察。

## 演示

<p align="center">
  <img src=".github/assets/openstudy-workflow.gif" alt="OpenStudy 从导入 Markdown 到做题、问 AI、错题本和洞察的真实流程演示 GIF" width="100%">
</p>

上面的演示展示的就是这条完整链路：`导入 Markdown -> 编辑源码 -> 开始做题 -> 问 AI -> 错题本 -> 重做 -> 洞察`。

## Markdown-first，而不是只认 Markdown

OpenStudy 会把 Markdown 作为可编辑的真源格式，但并不要求所有原始资料一开始就必须是 Markdown。

MarkItDown 负责充当导入网关，可以把 PDF、Word、PowerPoint、HTML、CSV、Excel、EPUB 以及部分图片类输入转换成 Markdown，再回到同一条 Markdown-first 的检查、识题、做题和重做流程里。

关键 CLI 命令：

```bash
node bin/openstudy.mjs doctor
node bin/openstudy.mjs setup markitdown
node bin/openstudy.mjs convert ./notes.pdf -o ./notes.md
node bin/openstudy.mjs ingest ./slides.pptx --title "Algorithms Review"
```

## 标准

OpenStudy 采用双层标准：

- **面向作者的 Markdown**：用于编辑、审阅、版本管理，也是你最常接触的格式。
- **内部 canonical JSON**：用于结构化校验、自动化处理，以及后续的生态扩展。

canonical schema 位于 [`schemas/openstudy-question-set.schema.json`](schemas/openstudy-question-set.schema.json)，CLI 也可以通过 `openstudy standards schema --print` 直接输出或定位它。

同时，Markdown 本身也不是“随便写都行”。我们约定了一套稳定的题目布局，这样 AI 清洗、结构化识别、做题、重做和复盘才能始终一致。

- 字段名统一使用 ASCII：`Type:`、`Answer:`、`Explanation:`，可选 `Topic:`、`Tags:`
- `Type` 只允许六种取值：`choice`、`multiple`、`judge`、`fill`、`short`、`code`
- `Type:` 需要写在每道题自己的题块里，并位于 `Answer:` 之前
- 对于代码题，代码块跟在题干后，`Type:` 放在选项后面，不要顶到代码块上方

<details>
  <summary><strong>choice</strong> - 选择题</summary>

```md
## 单选题

### 1. JUnit 5 中用于校验异常的方法是哪个？

- A. assertThrows
- B. assertAll
- C. assertEquals
- D. assertNotNull

Type: choice
Answer: A
Explanation: JUnit 5 使用 assertThrows 校验异常。
```

</details>

<details>
  <summary><strong>multiple</strong> - 多选题</summary>

```md
## 多选题

### 1. 以下哪些是 JUnit 5 的注解？

- A. @Test
- B. @BeforeAll
- C. @Override
- D. @Disabled

Type: multiple
Answer: ABD
Explanation: @Override 是 Java 注解，不是 JUnit 5 注解。
```

</details>

<details>
  <summary><strong>judge</strong> - 判断题</summary>

```md
## 判断题

### 1. @WebMvcTest 属于完整的 Spring 集成测试注解。

- [ ] 正确
- [ ] 错误

Type: judge
Answer: 错误
Explanation: @WebMvcTest 只加载 Web 层相关组件。
```

</details>

<details>
  <summary><strong>fill</strong> - 填空题</summary>

```md
## 填空题

### 1. Spring Boot 中用于 Controller 测试的注解是 ____。

Type: fill
Answer: @WebMvcTest
Explanation: 它用于 Web 层切片测试。
```

</details>

<details>
  <summary><strong>short</strong> - 简答题</summary>

```md
## 简答题

### 1. 简述 TDD 的基本流程。

Type: short
Answer: 红，绿，重构。
Explanation: 语义等价即可，不要求逐字一致。
```

</details>

<details>
  <summary><strong>code</strong> - 代码题</summary>

````md
## 代码题

### 1. 阅读以下代码，哪个描述是正确的？

```java
@WebMvcTest(UserController.class)
public class UserApiTest {
    @Autowired
    private MockMvc mockMvc;
}
```

- A. 它会加载全部 Spring Bean
- B. 它用于控制层切片测试
- C. 它会自动启动浏览器
- D. 它只用于数据库迁移

Type: code
Answer: B
Explanation: @WebMvcTest 用于控制层切片测试。
````

</details>

## CLI

桌面端和 CLI 共用同一套 service layer、数据库和题目标准。CLI 的目标是覆盖转换、导入、校验、导出、自动化，以及基于 LLM 的关键学习操作。

常用命令：

```bash
node bin/openstudy.mjs doctor
node bin/openstudy.mjs docs list
node bin/openstudy.mjs markdown get 12 -o ./document.md
node bin/openstudy.mjs questions export 12 --format json -o ./question-set.json
node bin/openstudy.mjs validate ./question-set.json --format json
node bin/openstudy.mjs ai insights --doc 12 --limit 80 --language zh
```

标准相关辅助命令：

```bash
node bin/openstudy.mjs standards markdown --lang zh
node bin/openstudy.mjs standards schema --print
```

## 下载

可从 [Releases 页面](https://github.com/Freakz2z/OpenStudy/releases) 下载各平台构建产物。

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

- 即使原始资料来自 PDF、Office 或 HTML，Markdown 仍然是最终的 canonical 学习格式。
- OCR 或强依赖视觉能力的导入效果，仍然取决于 MarkItDown 与外部模型环境。
- 超大规模学习内容暂未自动重组到模型上下文上限以内。

## 参与贡献

欢迎提交 Bug、功能建议、体验优化和打包改进。发起 PR 前建议先阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 许可证

[MIT](LICENSE)
