# Changelog

All notable changes to this project will be documented in this file.

The format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), but stays lightweight for a fast-moving desktop project.

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
