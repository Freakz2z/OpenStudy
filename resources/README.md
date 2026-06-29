# Build Resources

`electron-builder` 在打包时会从这个目录读取图标：

- `icon.icns`（macOS，至少 512×512）
- `icon.ico`（Windows，至少 256×256）
- `icon.png`（Linux，512×512）
- `installerIcon.ico`（Windows NSIS 安装器）

如果未提供这些文件，electron-builder 会回退到默认 Electron 图标，但建议补齐以得到更好的安装体验。

## 临时占位

打包前请把对应平台的图标放到此目录。可以用 [electron-icon-builder](https://www.npmjs.com/package/electron-icon-builder) 一张 PNG 自动生成全套图标。

命令：

```bash
npx electron-icon-builder --input=resources/icon-source.png --output=resources
```