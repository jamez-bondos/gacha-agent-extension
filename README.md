
# GachaAgent

GachaAgent 是一款 Chrome 插件工具，可在 Sora 平台上以“抽卡”的方式批量调用图像生成功能，助您高效获取灵感。

## ✨ 核心功能

- 🚀 **批量任务**：选择模式，设置提示词，发送批量任务
- 🖼️ **任务监控**：实时监控所有任务状态，直观展示进度
- 🔍 **任务状态**：监测每个任务的执行状态

## 🛠 技术栈

- **框架**：React 19 + TypeScript
- **样式**：Tailwind CSS + shadcn/ui
- **构建**：Vite · Rollup · Turborepo
- **标准**：Chrome Extensions Manifest V3

## 🚀 快速开始

### 开发环境

1. 克隆仓库：

```bash
git clone https://github.com/jamez-bondos/gacha-agent-extension.git
```

2. 安装依赖：

```bash
pnpm install
```

3. 启动开发服务器：

```bash
pnpm dev
```

### 安装扩展

1. 打开 Chrome 浏览器，访问 `chrome://extensions`
2. 开启右上角的 "开发者模式"
3. 点击左上角的 "加载已解压的扩展程序"
4. 选择项目目录中的 `dist` 文件夹

## 💡 使用指南

1. 登陆 [Sora](https://sora.chatgpt.com) 并切换至 `My media` 页面
2. 确保提示词窗口已显示，并设置为 `Image` 模式
3. 点击页面右侧的浮动图标，打开 GachaAgent
4. 填写`提示词` 与 `抽卡次数`，点击`发送批量任务`
5. 保持 Sora 页面前台，通过 Chat 窗口监测任务状态

**注意**：批量任务执行期间，请保持 Sora 页面在浏览器前台，避免切换标签页，以免影响批量任务运行。

## ⚠️ 特别注意

本工具仅供学习和研究 Sora 图像生成及提示词使用。请合理使用本工具，避免过度或非正常使用导致账号风险。请在自担风险的情况下使用。

## 🚀 未来计划

1. 优化批量任务执行机制，提升稳定性和可靠性
2. 提供提示词模板系统，支持批量生成不同提示词任务
3. 优化用户界面和使用体验

## 🤝 贡献指南

欢迎贡献！请随时提交 Pull Request 或提出 Issue。

## 📝 许可证

本项目基于 [MIT 许可证](LICENSE) 开源。

## 🙏 Credits

本项目基于 [chrome-extension-boilerplate-react-vite](https://github.com/Jonghakseo/chrome-extension-boilerplate-react-vite) 开发，感谢所有贡献者的工作。
