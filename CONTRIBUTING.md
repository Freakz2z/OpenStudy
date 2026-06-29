# Contributing to OpenStudy

Thanks for helping make OpenStudy better.

This document keeps contribution expectations lightweight and practical so people can move fast without creating review chaos.

## Before You Start

- Search existing [issues](https://github.com/Freakz2z/OpenStudy/issues) before opening a new one.
- For larger feature work, open an issue first so the direction can be aligned before implementation.
- Keep pull requests focused. Small and reviewable changes are much easier to merge.

## Local Setup

Requirements:

- Node.js 20+
- npm
- A desktop environment capable of running Electron builds

Install and start the app:

```bash
npm install
npm run dev
```

Run checks before opening a PR:

```bash
npm run typecheck
npm run test:unit
npm run build
```

If your change affects packaging or native modules, also test the relevant installer build:

```bash
npm run dist:win
npm run dist:mac
npm run dist:linux
```

## Development Guidelines

- Respect the existing product direction: OpenStudy is a study workflow tool, not a general note-taking app.
- Prefer incremental changes over broad rewrites unless the rewrite is clearly justified.
- Keep UI changes intentional and consistent with the current desktop experience.
- Preserve keyboard accessibility and practice flow ergonomics.
- Avoid unrelated refactors in the same pull request.

## Pull Request Checklist

Before submitting:

- Confirm the change solves a real user-facing problem or meaningful maintenance issue.
- Update docs when behavior, setup, packaging, or workflows change.
- Add or adjust tests when the change affects logic that can be verified automatically.
- Include screenshots or short recordings for visible UI changes when helpful.
- Mention platform-specific impact if the change affects Windows, macOS, or Linux differently.

## Commit Style

You do not need a strict commit convention, but clear commit messages help a lot.

Good examples:

- `feat: improve practice shortcut handling`
- `fix: keep ask-ai enter behavior isolated`
- `docs: refresh readme and release workflow`

## Reporting Bugs

When reporting a bug, please include:

- What you expected to happen
- What actually happened
- Steps to reproduce
- Your platform and app version
- Screenshots, recordings, or logs when available

## Suggesting Features

Feature requests are welcome, especially when they include:

- The learning problem you are trying to solve
- The current workaround, if any
- Why the proposed change should belong in OpenStudy
- Any constraints around UX, AI cost, or platform behavior

## Community Expectations

Please be respectful, specific, and collaborative. If you are unsure about tone or behavior expectations, follow [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Simplified Chinese

欢迎贡献代码、提 Bug、提需求或帮助完善文档。

- 大功能建议先提 Issue 对齐方向。
- PR 尽量聚焦，不要把无关重构混在一起。
- 提交前至少跑 `npm run typecheck` 和 `npm run build`。
- 涉及界面改动时，附截图或录屏会明显提升合并效率。
