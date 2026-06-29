# Build Resources

OpenStudy 现在统一以 [`public/app_icon.png`](../public/app_icon.png) 作为应用图标源文件。

- Electron 运行时会直接使用 `app_icon.png`
- `electron-builder` 也会以同一张 PNG 作为默认打包图标输入
- 如果后续需要额外生成 `.icns`、`.ico` 等平台产物，也请从这张 PNG 派生，不再维护额外的命名分支

如果你需要生成平台图标，可以继续用 [electron-icon-builder](https://www.npmjs.com/package/electron-icon-builder) 从同一个源文件导出：

```bash
npx electron-icon-builder --input=public/app_icon.png --output=resources
```
