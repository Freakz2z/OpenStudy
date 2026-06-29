<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/logo_white.png">
  <img src="public/logo_black.png" width="120" height="120" alt="OpenStudy">
</picture>

# OpenStudy

<p><strong>From Markdown notes to deliberate practice.</strong></p>

<p>OpenStudy is a Markdown-first AI study workspace for turning raw notes into structured questions, focused practice, explainable feedback, and a study loop you can keep using every day.</p>

[![Release](https://img.shields.io/github/v/release/Freakz2z/OpenStudy?include_prereleases&sort=semver)](https://github.com/Freakz2z/OpenStudy/releases)
[![Build](https://img.shields.io/github/actions/workflow/status/Freakz2z/OpenStudy/release.yml?label=release)](https://github.com/Freakz2z/OpenStudy/actions/workflows/release.yml)
[![License](https://img.shields.io/github/license/Freakz2z/OpenStudy)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%C2%B7%20macOS%20%C2%B7%20Linux-2ea44f)](https://github.com/Freakz2z/OpenStudy/releases)
[![Electron](https://img.shields.io/badge/Electron-32-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-18-149ECA?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

[English](README.md) · [简体中文](README.zh-CN.md) · [Contributing](CONTRIBUTING.md) · [Code of Conduct](CODE_OF_CONDUCT.md) · [Releases](https://github.com/Freakz2z/OpenStudy/releases) · [Changelog](CHANGELOG.md) · [Report an Issue](https://github.com/Freakz2z/OpenStudy/issues)

</div>

<p align="center">
  <img src=".github/assets/usage-flow.png" alt="OpenStudy workflow map for Markdown import, question cleanup, deliberate practice, wrong-book review, and manual insights" width="100%">
</p>

## Why OpenStudy

OpenStudy is built around a very specific frustration: we already have the notes, the excerpts, and the question drafts, but turning them into a repeatable practice system still feels too manual.

Instead of treating a Markdown note set as a dead asset, OpenStudy turns it into a structured practice space:

- Start from Markdown-first study material and editable question-bank content.
- Use AI to clean up and normalize multiple-choice, fill-in-the-blank, and short-answer questions.
- Practice inside a focused quiz flow with keyboard-friendly navigation.
- Ask AI in context when you need explanation instead of just an answer.
- Review mistakes, retry questions, and track progress over time.
- Generate study insights manually when you actually want them, not every time you open the page.

## What You Can Do

- **Markdown-first by default**: keep your source material editable, durable, and versionable.
- **AI cleanup, not AI chaos**: turn rough notes into usable questions without giving up structure.
- **Practice built for repetition**: move fast with shortcuts, retries, and bottom-pinned core actions.
- **Ask AI in the right moment**: get hints, explanations, and reasoning exactly where confusion appears.
- **Review that compounds**: revisit wrong answers, track weak spots, and generate insights only when needed.
- **Ready to distribute**: ship installers for Windows, Apple Silicon macOS, and Linux from one release flow.

## At A Glance

1. **Import Markdown**: start from a Markdown question bank and bring it straight into a durable study workspace.
2. **Review and practice**: inspect the source, launch a focused quiz flow, and use keyboard-friendly actions for repetition.
3. **Ask AI in context**: get hints or explanations without leaving the current question.
4. **Close the loop**: revisit mistakes in Wrong Book and generate Insights manually when you are ready to reflect.

## Demo

<p align="center">
  <img src=".github/assets/openstudy-workflow.gif" alt="OpenStudy real workflow demo from importing Markdown to practice, Ask AI, Wrong Book, and Insights" width="100%">
</p>

The demo above walks through the exact README flow: `Import Markdown -> Edit Source -> Practice -> Ask AI -> Wrong Book -> Redo -> Insights`.

## Standards

OpenStudy is Markdown-first, but it is not "anything goes" Markdown. We use one stable question standard so AI cleanup, parsing, retry flows, and review all behave predictably.

- Field labels stay ASCII: `Type:`, `Answer:`, `Explanation:`, optionally `Topic:` and `Tags:`.
- Allowed `Type` values are `choice`, `multiple`, `judge`, `fill`, `short`, and `code`.
- `Type:` should appear inside each question block before `Answer:`.
- For code-analysis questions, keep the code block with the stem and place `Type:` below the options, not above the code.

<details>
  <summary><strong>choice</strong> - Multiple Choice</summary>

```md
## Multiple Choice

### 1. Which JUnit 5 API is used to verify an exception?

- A. assertThrows
- B. assertAll
- C. assertEquals
- D. assertNotNull

Type: choice
Answer: A
Explanation: JUnit 5 uses assertThrows to verify exceptions.
```

</details>

<details>
  <summary><strong>multiple</strong> - Multiple Select</summary>

```md
## Multiple Select

### 1. Which of the following are JUnit 5 annotations?

- A. @Test
- B. @BeforeAll
- C. @Override
- D. @Disabled

Type: multiple
Answer: ABD
Explanation: @Override is a Java annotation, not a JUnit 5 annotation.
```

</details>

<details>
  <summary><strong>judge</strong> - True or False</summary>

```md
## True or False

### 1. @WebMvcTest is a full Spring integration testing annotation.

- [ ] True
- [ ] False

Type: judge
Answer: False
Explanation: @WebMvcTest only loads the web layer slice.
```

</details>

<details>
  <summary><strong>fill</strong> - Fill in the Blank</summary>

```md
## Fill in the Blank

### 1. The Spring Boot annotation used for controller tests is ____.

Type: fill
Answer: @WebMvcTest
Explanation: It is used for web-layer slice testing.
```

</details>

<details>
  <summary><strong>short</strong> - Short Answer</summary>

```md
## Short Answer

### 1. Briefly describe the basic TDD workflow.

Type: short
Answer: Red, green, refactor.
Explanation: A semantically equivalent answer is acceptable.
```

</details>

<details>
  <summary><strong>code</strong> - Code Analysis</summary>

````md
## Code Analysis

### 1. Read the code below. Which description is correct?

```java
@WebMvcTest(UserController.class)
public class UserApiTest {
    @Autowired
    private MockMvc mockMvc;
}
```

- A. It loads every Spring bean
- B. It is used for controller slice testing
- C. It automatically launches a browser
- D. It is only used for database migration

Type: code
Answer: B
Explanation: @WebMvcTest is used for controller slice testing.
````

</details>

## Downloads

Download platform builds from the [Releases page](https://github.com/Freakz2z/OpenStudy/releases).

| Platform | Package | Architecture | Notes |
| --- | --- | --- | --- |
| Windows | `.exe` installer | `x64` | Unsigned installers may show SmartScreen on first launch. |
| macOS | `.dmg` | `arm64` | Apple Silicon only. Unsigned apps may require right-click → Open on first launch. |
| Linux | `.AppImage`, `.deb` | `x64` | Pick the format that best fits your distribution. |

## AI Providers

OpenStudy supports multiple LLM backends for question extraction, grading, AI chat, and insights:

- DeepSeek
- OpenAI-compatible providers
- OpenAI
- Anthropic
- Ollama
- xAI-compatible setups through the OpenAI-style endpoint flow

DeepSeek is a practical default for Chinese study content because it works well with structured JSON output and keeps costs low.

## Development

Requirements: Node.js 20+ and a working desktop build environment for Electron.

```bash
npm install
npm run dev
```

Quality checks:

```bash
npm run typecheck
npm run test:unit
```

Production packaging:

```bash
npm run dist:win
npm run dist:mac
npm run dist:linux
```

Build outputs are written to `release/<version>/`.

## Release Automation

GitHub Actions builds platform installers on:

- `windows-2025` for Windows `x64`
- `macos-15` for Apple Silicon macOS `arm64`
- `ubuntu-24.04` for Linux `x64`

The workflow is triggered only when a new GitHub Release is published.

If a matching file such as `.github/RELEASE_NOTES_v0.1.0.md` exists, the release workflow uses it as the curated release body and appends GitHub's generated notes beneath it.

Generated installers are normalized to a consistent naming scheme:

- `OpenStudy-<version>-windows-x64-installer.exe`
- `OpenStudy-<version>-macos-arm64.dmg`
- `OpenStudy-<version>-linux-x64.AppImage`
- `OpenStudy-<version>-linux-x64.deb`

## Current Scope

OpenStudy is already useful, but it is still intentionally lean:

- The product direction is now firmly Markdown-first.
- Very large Markdown sets are not yet automatically restructured beyond model limits.
- The project is still evolving toward a more complete open-source study workflow.

## Contributing

Contributions, bug reports, UX suggestions, and packaging improvements are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

## License

[MIT](LICENSE)
