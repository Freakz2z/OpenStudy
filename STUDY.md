# OpenStudy Skill

OpenStudy 是一个 Markdown-first 的 AI 学习工作台。本 Skill 让你能够在 Claude Code、Codex、OpenClaw 等 AI 编码助手中直接操作 OpenStudy 题库 — 导入资料、结构化题目、做题批改、导出记录，全部通过 CLI 完成。

**Skill 文件位置：** `.claude/skills/openstudy/` — 包含 10 个斜杠命令和一个主入口 Skill。CLI 入口为 `npx tsx src/cli/index.ts`（开发模式）或 `node bin/openstudy.mjs`（构建后）。

## 核心理念

OpenStudy **不生产知识**，只负责将知识结构化、可视化。它把静态文档（PDF/Word/PPT/Markdown）变成可练习、可追踪的题库。

## OpenStudy 标准格式

Skill 的核心能力是消费和产出 OpenStudy 标准格式。有两种等价格式：**Standard Markdown**（人类友好）和 **JSON**（机器友好）。

### Standard Markdown（推荐）

```markdown
## 单选题

### 1. 哪个注解用于控制层切片测试？
- A. @SpringBootTest
- B. @WebMvcTest
- C. @DataJpaTest
- D. @RestClientTest

Type: choice
Answer: B
Explanation: @WebMvcTest 用于控制层切片测试。
Topic: Spring Boot 测试

### 2. HTTP 状态码 404 表示什么？
- A. 服务器错误
- B. 资源未找到
- C. 请求超时
- D. 未授权

Type: choice
Answer: B

## 多选题

### 3. 以下哪些是 JVM 垃圾回收器？
- A. G1
- B. CMS
- C. Nginx
- D. ZGC

Type: multiple
Answer: ABD

## 判断题

### 4. TCP 是面向连接的协议。

Type: judge
Answer: 对

## 填空题

### 5. REST 的全称是 Representational State ______。

Type: fill
Answer: Transfer

## 简答题

### 6. 简述微服务架构的优势。

Type: short
Answer: 微服务架构将应用拆分为独立部署的小服务，每个服务围绕业务能力构建，可独立扩展、部署和升级，技术栈灵活，故障隔离性好。
```

**格式规则：**
- `## 题型标题` — 题型分隔（单选题/多选题/判断题/填空题/简答题/代码题）
- `### N. 题干` — 题目，N 从 1 开始
- `- A. 选项内容` — 选项必须硬编码为 A/B/C/D 前缀
- `Type: choice|multiple|judge|fill|short|code` — 题型元数据，必须放在选项和 Answer 之后
- `Answer: B` 或 `Answer: ABD` 或 `Answer: 对/错` — 参考答案
- `Explanation: ...` — 可选，解析
- `Topic: ...` — 可选，考点/章节
- `<!-- QUESTION_ID:xxx -->` — 可选，用于 LLM 批量匹配时的稳定 ID

**题型速查：**

| Type | 中文 | 选项 | Answer 示例 |
|------|------|------|------------|
| `choice` | 单选题 | A-D | `B` |
| `multiple` | 多选题 | A-D | `ABD` |
| `judge` | 判断题 | 无需选项 | `对` 或 `错` |
| `fill` | 填空题 | 无需选项 | `Transfer` |
| `short` | 简答题 | 无需选项 | 自由文本 |
| `code` | 代码题 | A-D（代码选项） | `C` |

### JSON 格式

```json
{
  "version": "openstudy.question-set.v1",
  "title": "Spring Boot 测试",
  "questions": [
    {
      "type": "choice",
      "stem": "哪个注解用于控制层切片测试？",
      "options": ["@SpringBootTest", "@WebMvcTest", "@DataJpaTest", "@RestClientTest"],
      "answer": "B",
      "explanation": "@WebMvcTest 用于控制层切片测试。"
    }
  ]
}
```

注意 JSON 格式中 `options` 数组不包含 A/B/C/D 前缀，answer 仍是字母。

---

## Slash Commands

在 Claude Code 中可使用以下命令操作 OpenStudy：

### /openstudy:ingest — 导入文档并识别题目

```
/openstudy:ingest <文件路径>
```

将 PDF/Word/PPT/Markdown 等文档导入 OpenStudy，自动提取文本并调用 AI 识别结构化题目。

支持的文件类型：txt, md, pdf, docx, pptx, html, csv, xlsx, epub

**参数：**
- `--title` 自定义标题
- `--lang zh|en` 文档语言（默认自动检测）
- `--skip-identify` 仅导入不识别题目

**实现：** `openstudy ingest <file> [--title TITLE] [--lang zh|en] [--skip-identify]`

### /openstudy:identify — 对已导入文档识别题目

```
/openstudy:identify <docId>
```

对已导入的文档运行 AI 题目识别。

**实现：** `openstudy questions identify <docId> [--lang zh|en]`

### /openstudy:exam — 将结构化题目导入到文档

```
/openstudy:exam <docId> <file.md|file.json>
```

将 Standard Markdown 或 OpenStudy JSON 题目集导入指定文档。支持 AI 先按标准格式生成题目，再一次性导入。

**实现：** `openstudy exam import <docId> <file.(md|json)> [--format markdown|json]`

### /openstudy:export — 导出题目

```
/openstudy:export <docId>
```

将文档的题目导出为 Standard Markdown 或 JSON。

**实现：** `openstudy questions export <docId> [--format json|markdown] [--output file]`

### /openstudy:validate — 校验题目格式

```
/openstudy:validate <file.md|file.json>
```

校验 Markdown 或 JSON 是否符合 OpenStudy 标准，返回题目数和格式问题。

**实现：** `openstudy validate <file.(md|json)> [--format markdown|json]`

### /openstudy:grade — AI 批改答案

```
/openstudy:grade <questionId> --answer "用户答案"
```

用 AI 批改简答题/填空题，自动判断正确性。

**实现：** `openstudy ai grade <questionId> --answer "..." [--save]`

### /openstudy:insights — 生成学习洞察

```
/openstudy:insights
```

基于最近错题生成学习建议和分析。

**实现：** `openstudy ai insights [--doc <docId>] [--limit 80] [--language zh|en]`

### /openstudy:stats — 查看统计

```
/openstudy:stats [overall|doc <docId>]
```

查看整体或单个文档的学习统计。

**实现：** `openstudy stats overall` | `openstudy stats doc <docId>`

### /openstudy:doctor — 环境诊断

```
/openstudy:doctor
```

检查 OpenStudy CLI 环境状态，包括 MarkItDown 安装情况、LLM 配置等。

**实现：** `openstudy doctor`

### /openstudy:settings — LLM 配置

```
/openstudy:settings [llm --provider openai --model gpt-4o --api-key sk-xxx]
```

查看或修改 LLM 配置。

**实现：** `openstudy settings show` | `openstudy settings llm --provider <name> --model <name> [--base-url URL] [--api-key KEY]`

---

## 典型工作流

### 工作流 1：把学习资料变成题库

```bash
# 1. 导入文档
openstudy ingest ~/notes/spring-boot.pdf --lang zh

# 2. 验证结果
openstudy questions list <docId> --format table

# 3. 导出为标准格式（可选）
openstudy questions export <docId> --format markdown --output spring-boot-questions.md
```

### 工作流 2：AI 直接生成题库导入

当用户说"帮我把这些内容做成 OpenStudy 题目"时：

1. 理解内容，按 OpenStudy Standard Markdown 格式生成题目
2. 将生成的 Markdown 写入临时文件
3. 创建文档 `openstudy docs import <source-file> --title "标题"`
4. 导入题目 `openstudy exam import <docId> <temp-markdown-file>`
5. 删除临时文件

### 工作流 3：批改开放题答案

```bash
# 对简答题/填空题用 AI 批改
openstudy ai grade <questionId> --answer "用户的简答文字" --save
```

### 工作流 4：生成学习报告

```bash
# 获取最近错题洞察
openstudy ai insights --language zh

# 查看统计
openstudy stats overall
```

---

## 关键约束

1. **选项前缀必须是 A/B/C/D** — Standard Markdown 中的选项必须硬编码为标准大写字母前缀。这是根除选项识别问题的设计决策：选项在进入 LLM 之前就被归一化为 A/B/C/D。

2. **Answer 使用字母不是内容** — 对于选择题，答案字段必须是 `A`/`B`/`C`/`D` 等字母，不能是选项内容。判断题用 `对`/`错`，填空题和简答题用实际内容。

3. **Type 字段在选项之后** — Standard Markdown 要求 Type 行出现在选项/答案之后，这是格式规范。

4. **完整性校验不静默失败** — 如果 AI 识别的题目数少于检测到的题块数，会抛出 `QuestionIntegrityError`。这不是 bug，是设计：宁可失败重试也不静默丢题。

5. **多题文档优先本地解析** — 对于格式规整的多题文档（如标准试卷），OpenStudy 会优先本地结构化，不消耗 LLM 调用。

---

## CLI 快速参考

```
导入文档：     openstudy ingest <file> [--title TITLE] [--lang zh|en] [--skip-identify]
题目识别：     openstudy questions identify <docId> [--lang zh|en]
导入题库：     openstudy exam import <docId> <file.(md|json)> [--format markdown|json]
题目列表：     openstudy questions list <docId> [--format json|table]
导出题目：     openstudy questions export <docId> [--format json|markdown] [--output file]
格式校验：     openstudy validate <file.(md|json)> [--format markdown|json]
AI 批改：      openstudy ai grade <questionId> --answer "..." [--save]
学习洞察：     openstudy ai insights [--doc <docId>] [--limit 80] [--language zh|en]
环境诊断：     openstudy doctor
整体统计：     openstudy stats overall
文档统计：     openstudy stats doc <docId>
LLM 配置：     openstudy settings llm --provider <name> --model <name> [--api-key KEY]
标准示例：     openstudy standards markdown [--lang zh|en]
Schema 路径：  openstudy standards schema [--print]
```

---

## Skill 文件结构

项目 `.claude/skills/openstudy/` 目录包含所有可执行的 Skill 文件：

| 文件 | 斜杠命令 | 用途 |
|------|----------|------|
| `SKILL.md` | `/openstudy` | 主入口，含全部工作流和题目生成规范 |
| `ingest/SKILL.md` | `/openstudy:ingest` | 导入文档并识别题目 |
| `identify/SKILL.md` | `/openstudy:identify` | 对已导入文档识别题目 |
| `exam/SKILL.md` | `/openstudy:exam` | 导入 Standard Markdown/JSON 题目集 |
| `export/SKILL.md` | `/openstudy:export` | 导出题目为 Standard Markdown/JSON |
| `validate/SKILL.md` | `/openstudy:validate` | 校验题目格式 |
| `grade/SKILL.md` | `/openstudy:grade` | AI 批改简答题/填空题 |
| `insights/SKILL.md` | `/openstudy:insights` | 生成学习洞察分析 |
| `stats/SKILL.md` | `/openstudy:stats` | 查看学习统计 |
| `doctor/SKILL.md` | `/openstudy:doctor` | 环境诊断 |
| `settings/SKILL.md` | `/openstudy:settings` | LLM 配置管理 |

主 Skill（`SKILL.md`）包含完整的题目生成规范：题型选择策略、各题型编写要求、质量检查清单、常见格式错误及修正。

## CLI 近期改进

- `docs list --format table` — 表格形式查看文档列表
- `questions list --format table` — 紧凑表格查看题目（ID、题型、题干截断、答案）
- `stats overall --format table` — 表格形式查看统计数据
- `stats doc <id> --format table` — 表格形式查看文档统计
- 错误输出包含针对性修复提示（LLM 配置、文件路径、文档 ID 等）
