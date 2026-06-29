# OpenStudy v0.1.1

This patch release focuses on stabilizing the public release pipeline.

## Highlights

- Fixed GitHub Release packaging so all platform installers can be built without `electron-builder` attempting a second publish step
- Preserved the normalized artifact naming for Windows, Apple Silicon macOS, and Linux installers
- Kept the release workflow trigger model unchanged: builds only run when a new GitHub Release is published

## Included In This Release

- CI packaging fix for `electron-builder --publish never`
- Patch version bump to `v0.1.1`

## Notes

- macOS builds still target Apple Silicon only and are distributed as unsigned `.dmg` packages
