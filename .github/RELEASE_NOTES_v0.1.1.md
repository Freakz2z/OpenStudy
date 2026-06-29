# OpenStudy v0.1.1

## English

This patch release focuses on stabilizing the public release pipeline.

### Highlights

- Fixed GitHub Release packaging so all platform installers can be built without `electron-builder` attempting a second publish step
- Preserved the normalized artifact naming for Windows, Apple Silicon macOS, and Linux installers
- Kept the release workflow trigger model unchanged: builds only run when a new GitHub Release is published

### Included In This Release

- CI packaging fix for `electron-builder --publish never`
- Patch version bump to `v0.1.1`

### Notes

- macOS builds still target Apple Silicon only and are distributed as unsigned `.dmg` packages

## 简体中文

这个补丁版本主要用于稳定公开 Release 的构建与发布链路。

### 亮点

- 修复了 GitHub Release 打包流程，避免 `electron-builder` 在构建后再次尝试发布而导致失败
- 保留了 Windows、Apple Silicon macOS 和 Linux 三个平台统一的安装包命名规范
- 继续保持当前触发策略不变：只有发布新的 GitHub Release 时才会执行构建

### 本次包含内容

- CI 打包修复：统一使用 `electron-builder --publish never`
- 版本提升到 `v0.1.1`

### 说明

- macOS 当前仍然只提供 Apple Silicon 版本，并以未签名 `.dmg` 形式分发

**Full Changelog / 完整变更**: https://github.com/Freakz2z/OpenStudy/compare/v0.1.0...v0.1.1
