# Changelog

All notable changes to this project will be documented in this file.

## [0.3.3] - 2026-07-05

### Added

- **Skills page** — new `/skills` route displaying all 11 OpenStudy Claude Code slash commands with icons, titles, command badges, and descriptions
- **CLI as standalone npm package** — `bin/openstudy.mjs` now imports the bundled CLI directly as plain Node.js instead of spawning Electron; `files` and `prepublishOnly` fields set up for `npm publish`
- **CLI one-click install** — `app:installCli` IPC handler runs `npm install -g openstudy` directly; About page button shows install → installing → installed states matching the Skill install pattern
- **Install detection** — `app:checkSkillInstalled` and `app:checkCliInstalled` IPC handlers with localStorage fallback so both install cards persist their state across sessions

### Changed

- **About page redesigned** — replaced philosophy/features sections with two main containers: brand card (logo, version, GitHub, changelog) and install tools grid (Skill, CLI, Templates, Skills links)
- **Version badge in About** — when outdated, the version badge becomes an "Update to vX.Y.Z" button; removed "last checked" timestamp
- **Settings shortcuts collapsed by default** — toggle with chevron icon, full keyboard shortcut audit included
- **Sidebar streamlined** — Templates and Skills entries moved into About page as navigation buttons; removed sidebar resize keyboard shortcuts
- **QuestionCard** — removed hardcoded A/B/C/D option letter selection keys
- **CSS design tokens** — unified `.about-link-btn`, `.about-install-grid`, `.about-install-item`, `.panel-card-header-toggle` patterns

### Fixed

- About page install grid button alignment — buttons now anchor to the bottom of each card regardless of description length
- CLI stats table output no longer crashes on null accuracy values
- Asset cleanup in public directory

## [0.3.0] - 2026-07-04

### Added

- **Exam mode** — new `/exam/:docId` route with timer, deferred grading, batch submission at submit, ability to change answers before submit, and localStorage persistence for recovery on accidental close
- **Document create from Markdown** — "+" button in Library to create a document by pasting Standard Markdown content with custom title and optional description
- **Document rename and description** — edit title and description on existing documents via modal, with DB migration adding a `description` column
- **Modal component** — reusable overlay modal with Escape and click-outside-to-close support
- **Claude Code Skill integration** — 11 Skill files under `.claude/skills/openstudy/` implementing 10 `/openstudy:*` slash commands plus a comprehensive main entry point with question-generation specification (type selection strategy, per-type writing guidelines, difficulty calibration, quality checklist)
- **CLI table output** — `--format table` for `docs list`, `questions list`, `stats overall`, and `stats doc` commands
- **CLI error hints** — actionable suggestions printed alongside error messages based on error type (LLM config, file path, document ID, etc.)

### Changed

- QuestionCard and QuestionNav components accept an `examMode` prop to suppress immediate feedback and adapt navigation state
- Library PageHeader now includes a "+" button alongside the import button for creating documents from Markdown
- CLI `stats` command accepts `--format json|table`
- CLI `docs list` command accepts `--format json|table`
- CLI error output now includes contextual fix hints
- CHANGELOG, README, and README.zh-CN updated with product pillars, Skill integration, and exam mode documentation

### Notes

- Exam mode and practice mode share the same grading pipeline; exam mode defers all grading to the submit step and batches attempts
- All Skill files use the Standard Markdown format documented in STUDY.md; the main skill includes a full question-generation specification
- DB migration V4 adds a `description TEXT` column to the `documents` table

## [0.2.1] - 2026-06-29

### Fixed

- Switched AI identification to a Markdown-first two-stage pipeline: the model now normalizes source material into the OpenStudy standard first, then the app locally structures questions from that standard Markdown
- Preserved `QUESTION_ID` metadata through the Markdown-to-question parsing path so batch matching and integrity checks continue to work after the pipeline change
- Added regression coverage for Markdown-first identification, source-id recovery, and provider-side standard-Markdown generation

## [0.2.0] - 2026-06-29

### Added

- MarkItDown-backed document ingestion for bringing PDF, Word, PowerPoint, HTML, CSV, Excel, EPUB, and other supported files into the Markdown-first workflow
- A shared OpenStudy CLI for doctor checks, conversion, ingestion, Markdown retrieval, question export, validation, attempts, stats, and AI-powered commands
- A two-layer standard with author-facing Markdown and a canonical JSON question-set schema at `schemas/openstudy-question-set.schema.json`
- Dedicated service layers for document import, Markdown workflow, question workflow, and runtime path management so desktop and CLI share the same business logic

### Changed

- Parsing now prefers MarkItDown for non-Markdown sources and falls back to native parsers where appropriate
- Persistence paths were normalized so database, settings, and audit data can be reused outside the Electron runtime
- README was expanded to document the Markdown-first plus MarkItDown model, CLI surface area, and the dual-standard contract

### Notes

- Markdown remains the canonical editable format even when the original source starts as PDF or Office content
- OCR- and vision-heavy conversion quality still depends on the surrounding MarkItDown and model environment

## [0.1.1] - 2026-06-29

### Fixed

- Disabled `electron-builder` auto-publish during CI builds so release jobs can finish successfully before assets are uploaded by the dedicated GitHub Actions publish step
- Kept installer artifact generation unchanged while preventing `GH_TOKEN`-related failures on Windows, Apple Silicon macOS, and Linux release builds

## [0.1.0] - 2026-06-29

### Added

- Markdown-first study workflow for structured and editable question-bank content
- AI-assisted cleanup for choice, fill-in-the-blank, short-answer, and code-oriented questions
- Practice workflow with previous/submit/next controls fixed to the bottom of the main workspace
- Ask AI side panel for per-question follow-up help
- Wrong-book review flow with retry support
- Keyboard shortcuts for answer navigation and practice interactions
- Insights page with manually generated AI study suggestions
- Multi-provider LLM support including DeepSeek, OpenAI-compatible endpoints, OpenAI, Anthropic, Ollama, and xAI-style setups
- Cross-platform packaging for Windows, Apple Silicon macOS, and Linux
- GitHub Actions workflow for building and publishing release artifacts when a new Release is published

### Changed

- README refreshed into a polished bilingual open-source landing page
- Release artifact names normalized across operating systems
- Repository collaboration setup completed with templates, contribution guide, and conduct policy

### Notes

- macOS builds currently target Apple Silicon only and are distributed as unsigned `.dmg` packages
- The repository direction is now explicitly Markdown-first
