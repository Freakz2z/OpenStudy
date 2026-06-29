# Changelog

All notable changes to this project will be documented in this file.

The format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), but stays lightweight for a fast-moving desktop project.

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
