# ClipNote - 极速双态剪贴笔记本 | Quick Notes & Markdown Notebook

> **Browser-native clipboard manager and Markdown notebook Chrome extension.**
>
> **网页原生极速剪贴板管理与浏览器侧边栏 Markdown 知识管理系统。**

---

## 📖 目录 | Table of Contents
- [✨ 功能特色 | Features](#-功能特色--features)
- [🛡️ 安全与沙箱隔离 | Security & Sandboxed Isolation](#️-安全与沙箱隔离--security--sandboxed-isolation)
- [⚡ 性能与架构优化 | Performance & Optimization](#-性能与架构优化--performance--optimization)
- [📂 目录结构 | Directory Structure](#-目录结构--directory-structure)
- [🛠️ 安装与开发调试 | Installation & Development](#️-安装与开发调试--installation--development)
- [📦 商店上架提审 | Chrome Web Store Publishing](#-商店上架提审--chrome-web-store-publishing)

---

## ✨ 功能特色 | Features

### 1. 双态协同交互 | Dual-State Interactive Workflow
* **网页端悬浮组件 (Webpage FAB & Panel)**:
  * **智能微动感应气泡 (Proximity Aware FAB)**: 轻量化驻扎在网页边缘。鼠标远离时低沉半透明隐藏（`opacity: 0.35`），靠近时自动发光苏醒，带来极度舒适的无干扰阅读体验。
  * **阻尼弹簧 Quick Notes 面板 (Elastic Spring Panel)**: 具备拖动定位并永久记住位置（Coordinates Persisted）能力。打开时拥有丝滑的物理过冲回弹动画。
  * **智能吸附 (Smart Snapping)**: 拖动 FAB 时，面板会自动清空记忆坐标，完美吸附回 FAB 周围。
* **侧边栏笔记本 (Side Panel Markdown Workspace)**:
  * 完美集成的系统级双栏 Markdown 笔记本，支持全屏预览与极客级文档编辑，支持通过快捷键 **`Ctrl+Shift+K`** (Mac: **`Command+Shift+K`**) 瞬间呼出或关闭。

### 2. 划词即存与全键盘友好 | Text Selection Capture & Keyboard Friendly
* **划词悬浮气泡 (Selection Toast Button)**: 选中网页任意文字自动在光标处唤起“保存至 ClipNote”按钮。
* **键盘一键打烊 (Escape Dismiss)**: 对于全键盘流效率达人，按下 **`Escape` 键** 可瞬间隐藏划词保存按钮或关闭 Quick Notes 搜索视图。

### 3. 三级汇总备份与个性美学 | Summaries & Visual Customization
* **周期汇总备份 (Day/Week/Month Backup)**: 后台服务线程自动整理历史剪贴，动态归档生成【日、周、月】三级 Markdown 汇总剪贴笔记并同步到 Inbox，让碎片知识化零为整。
* **Toolbar 专属主题色彩 (Action Icon Theme)**: 提供五种精心调配的 logo 渐变微主题（Indigo 靛蓝、Emerald 祖母绿、Crimson 玫瑰红、Sunset 琥珀橙、Ocean 蔚海蓝），一键切换，同步更改浏览器栏的插件 Logo。
* **自定义 FAB 图标与 GIF (Custom FAB Icon / GIF)**: 支持在后台设置面板上传您个人专属的 SVG, PNG, JPG 甚至 **动态 GIF** 作为网页悬浮气泡图标，网页侧实时响应，支持 2MB 内文件。

---

## 🛡️ 安全与沙箱隔离 | Security & Sandboxed Isolation

* **Visual Shield 隐私视觉防护盾**:
  * **主动正则探测 (Sensitive Detection)**: 自动识别剪贴记录中的高危敏感字段（如各种账户密码、OpenAI/Stripe 等 API 密钥、证书私钥、信用卡号等）。
  * **前台防窥遮罩 (Surveillance Shield)**: 默认以等宽小点 `••••••••••••` 呈现，并支持悬浮“小眼睛”图标随时一键明文切换，防止在视频会议、投屏、录屏时泄漏隐私。
  * **效率无损一键复制 (Copy-on-Click)**: 直接点击卡片本身，无论当前处于遮罩还是明文状态，**依然会直接复制无污染的原始明文**！
* **物理防泄漏沙箱 (Closed Mode Shadow DOM)**:
  * 所有的宿主网页代码（包括 ChatGPT 等高强度 SPA 页面）**完全无法跨域嗅探** 您的剪贴内容。我们利用 `attachShadow({ mode: 'closed' })` 机制建立了严密的 DOM 隔绝层。
  * 数据完全离线存储在 `chrome.storage.local` 沙箱与 IndexedDB 中，绝不上传任何服务器，安全百分百。

---

## ⚡ 性能与架构优化 | Performance & Optimization

* **水合防删 DOM 重生守卫 (SPA Hydration Recovery)**:
  * 针对 ChatGPT、Claude 等单页应用（SPA）极其激进的 React 客户端水合（Hydration）删除非 React 节点的问题，我们利用 **`MutationObserver`** 在 Microtask 级别建立了插回重绘守卫，一旦 React 将我们的插件容器节点从 body 中剔除，守卫会瞬间重新将其补回 body 底部，保证组件永久稳定显示。
* **毫秒级内存缓存检索 (Synchronous Caching Search)**:
  * 摒弃了在每次输入查询字符时都读写异步 `chrome.storage.local` API 的陈旧做法，我们构建了内存级 `allClips` 动态数组。打字搜索的响应时间缩短至 **<1ms**，完全解决打字时的 Stutter（掉帧）与延迟。
* **DOM 拦截防锁死机制 (Focus & Drag Separation)**:
  * 在 Header 的鼠标拖拽 `mousedown` 事件中实现了智能标签/容器过滤，对所有 `INPUT`、`BUTTON` 以及 `.clipnote-panel__search-container` 实施穿透释放，彻底解决了“一搜索输入框就被锁死无法编辑、卡顿”的交互冲突问题。
* **重载防污染净化 (Multi-Instance Clean Purge)**:
  * 初始化最前端强行检测并清除之前版本残留在 DOM 中的 Stale Nodes，杜绝开发热更新或插件升级带来的多事件绑定和死锁。

---

## 📂 目录结构 | Directory Structure

```
clipnote-extension/
├── src/
│   ├── background/      # 后台 Service Worker (广播通信与聚合备份流水线)
│   ├── content/         # 网页注入 Context 世界 (FAB, Quick Panel, 划词捕获)
│   ├── sidepanel/       # 侧边栏笔记本 (React + React Hooks Markdown Workspace)
│   ├── shared/          # 共享基础类、MessageBus 通信总线与类型定义
│   └── storage/         # 离线 IndexedDB 及 Settings 同步层
├── dist/                # 编译打包输出目录 (打包出厂产物)
├── manifest.json        # 谷歌 Manifest V3 核心声明配置文件
├── package.json         # 项目依赖与 Vite 编译脚本
└── tsconfig.json        # TypeScript 编译器规则
```

---

## 🛠️ 安装与开发调试 | Installation & Development

### 1. 克隆并安装依赖 | Clone and Install Dependencies
```bash
# 进入项目目录
cd clipnote-extension

# 安装模块
npm install
```

### 2. 编译打包 | Build
```bash
# 使用 TypeScript 与 Vite 进行三端生产级打包
npm run build
```
打包成功后，完整的插件内容将输出至 `dist/` 文件夹。

### 3. 加载到浏览器中 | Load in Browser
1. 打开 Chrome 浏览器，访问 **`chrome://extensions/`**。
2. 开启右上角的 **“开发者模式” (Developer Mode)**。
3. 点击左上角的 **“加载已解压的扩展程序” (Load unpacked)**。
4. 选择我们编译产出的 **`dist/`** 目录。

---

## 📦 商店上架提审 | Chrome Web Store Publishing

如果您想将该插件分享给所有人，可以直接使用项目根目录下的 **`clipnote-extension.zip`** 提审至谷歌商店。

提审时的**详细文案（中英详细说明）**与**Manifest V3 权限合规理由陈述**已为您完整拟定在本地提审指南中：
👉 [chrome_web_store_publishing_guide.md](file:///C:/Users/gro_e/.gemini/antigravity/brain/e8d91b1e-c7a9-45e0-b291-84a7930b200e/chrome_web_store_publishing_guide.md)

---

## 📄 开源许可证 | License

MIT License. Developed with ❤️ by groele.
