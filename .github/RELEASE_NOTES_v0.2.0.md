# OpenStudy v0.2.0

## English

This release turns OpenStudy into a much more complete Markdown-first study platform: multi-format document ingestion now flows through MarkItDown, almost every key workflow has a CLI entry point, and the project now exposes a clear dual-standard contract for Markdown and canonical JSON.

### Highlights

- Added MarkItDown as the import gateway for PDF, Word, PowerPoint, HTML, CSV, Excel, EPUB, and other supported inputs
- Added the OpenStudy CLI for conversion, ingestion, validation, exports, attempts, stats, and AI-backed workflows
- Formalized the OpenStudy question-set JSON schema while keeping Markdown as the editable source of truth
- Unified desktop and CLI around the same service layer, database, and runtime paths

### Included In This Release

- New commands such as `doctor`, `setup markitdown`, `convert`, `ingest`, `validate`, `questions export`, `ai insights`, and more
- Canonical schema at `schemas/openstudy-question-set.schema.json`
- README updates covering MarkItDown, CLI usage, and the Markdown-first plus JSON-canonical model

### Notes

- Markdown remains the canonical format for authoring and review
- OCR- and vision-heavy imports still depend on the surrounding MarkItDown and model environment
- macOS builds continue to target Apple Silicon only and ship as unsigned `.dmg` packages

## 简体中文

这个版本让 OpenStudy 从“Markdown-first 学习应用”进一步走向“更完整的 Markdown-first 学习平台”：多格式文档现在可以通过 MarkItDown 导入，几乎所有关键流程都有了 CLI 入口，同时项目也正式明确了 Markdown 与 canonical JSON 的双层标准。

### 亮点

- 接入 MarkItDown，作为 PDF、Word、PowerPoint、HTML、CSV、Excel、EPUB 等输入格式的统一导入网关
- 新增 OpenStudy CLI，覆盖转换、导入、校验、导出、做题记录、统计与 AI 相关流程
- 正式定义 OpenStudy 的 question-set JSON schema，同时保留 Markdown 作为可编辑真源
- 桌面端与 CLI 统一复用同一套 service layer、数据库和运行时路径

### 本次包含内容

- 新增 `doctor`、`setup markitdown`、`convert`、`ingest`、`validate`、`questions export`、`ai insights` 等命令
- 新增 canonical schema：`schemas/openstudy-question-set.schema.json`
- README 补充了 MarkItDown、CLI 用法以及“Markdown-first + JSON canonical”这套模型

### 说明

- Markdown 仍然是最终用于编辑和审阅的 canonical 学习格式
- OCR 或强依赖视觉能力的导入效果，仍然取决于 MarkItDown 和外部模型环境
- macOS 仍然只提供 Apple Silicon 版本，并以未签名 `.dmg` 形式分发

**Full Changelog / 完整变更**: https://github.com/Freakz2z/OpenStudy/compare/v0.1.1...v0.2.0
