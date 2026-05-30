<div align="center">

# ClipNote

**浏览器原生的快速剪贴笔记与 Markdown 工作台**  
*Browser-native quick capture, clipboard notes, and Markdown workspace for research reading.*

![Type](https://img.shields.io/badge/type-Chrome%20Extension-blue?style=flat-square)
![Manifest](https://img.shields.io/badge/manifest-MV3-green?style=flat-square)
![Language](https://img.shields.io/badge/language-TypeScript%20%2B%20React-blueviolet?style=flat-square)
![Architecture](https://img.shields.io/badge/architecture-browser--native-purple?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-yellow?style=flat-square)

Part of **ResearchFlow Lab** — a local-first research productivity ecosystem for literature, manuscripts, data, and scientific visualization.

</div>

---

## 01. Overview

**ClipNote** is a Chrome extension for fast capture inside the browser. It combines webpage text selection, quick clipboard snippets, floating notes, and a side-panel Markdown workspace into a local-first note-taking layer.

**ClipNote** 是一个浏览器原生的剪贴笔记插件，面向论文阅读、网页资料整理、AI 对话摘录和临时想法捕获。它的目标不是替代完整知识库，而是让“看到一句有价值的话 → 保存 → 归档 → 汇总”这条路径足够轻。

---

## 02. Why this project exists

Research reading often happens in small fragments: a sentence from a paper, a method description from a webpage, a useful prompt from an AI chat, or a temporary note during manuscript writing. These fragments are easy to lose when they are copied into scattered editors, chat boxes, or temporary files.

ClipNote provides a browser-side capture layer for those fragments.

核心目标：

- Reduce friction between reading and note capture.
- Keep quick notes available without leaving the browser.
- Support Markdown-based organization for research snippets.
- Protect sensitive clipboard content through local-first storage and visual masking.
- Provide a future bridge into ResearchFlow projects and literature records.

---

## 03. Key features

| Module | What it does | 中文说明 |
|---|---|---|
| Floating FAB | Provides a low-interruption floating entry point on webpages | 在网页侧边提供低干扰悬浮入口 |
| Quick Notes Panel | Captures and searches short clipboard notes without switching apps | 快速保存、搜索和复制剪贴片段 |
| Selection Capture | Saves selected webpage text through a contextual capture button | 网页划词后直接保存为剪贴笔记 |
| Side Panel Workspace | Provides a Markdown notebook inside the browser side panel | 浏览器侧边栏 Markdown 笔记本 |
| Periodic Summaries | Generates daily, weekly, and monthly Markdown summaries | 自动生成日、周、月剪贴汇总 |
| Sensitive Masking | Detects and visually masks keys, passwords, and high-risk snippets | 对密钥、密码等敏感内容进行视觉遮罩 |
| Local Storage | Stores data in browser-local storage and IndexedDB | 使用浏览器本地存储和 IndexedDB 保存数据 |
| Theme Customization | Supports theme colors and custom FAB icons | 支持主题色和自定义悬浮图标 |

---

## 04. Product philosophy

ClipNote follows four design principles:

1. **Capture first** — saving a useful fragment should be faster than opening a separate note app.
2. **Browser-native** — the tool should live where reading and copying happen.
3. **Local-first** — snippets should remain private unless the user explicitly exports or syncs them.
4. **Composable** — quick notes should be able to flow into ResearchFlow, Zotero, Markdown, or manuscript workflows.

---

## 05. Architecture

```text
ClipNote
├── Manifest V3 Extension
│   ├── background service worker
│   ├── content script / floating FAB
│   ├── side panel / Markdown workspace
│   └── shared message bus
├── Capture Layer
│   ├── clipboard notes
│   ├── webpage text selection
│   ├── quick search
│   └── periodic summaries
├── Data Layer
│   ├── chrome.storage.local
│   ├── IndexedDB
│   └── exportable Markdown records
└── Privacy Layer
    ├── sensitive-pattern detection
    ├── visual masking
    └── closed Shadow DOM isolation
```

---

## 06. Quick start

```bash
git clone https://github.com/groele/ClipNote.git
cd ClipNote
npm install
npm run build
```

Then load the extension in Chrome:

1. Open `chrome://extensions/`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the generated `dist/` folder.

---

## 07. Recommended workflow

```text
Read webpage / paper → Select useful text → Save to ClipNote
                     → Search / reuse snippets
                     → Generate daily or weekly Markdown summaries
                     → Move important notes into ResearchFlow or manuscript drafts
```

Typical use cases:

- Capture useful sentences while reading papers.
- Store temporary AI prompts and responses.
- Keep reusable manuscript phrases or methods descriptions.
- Build lightweight daily research logs.

---

## 08. Project structure

```text
ClipNote
├── src/
│   ├── background/
│   ├── content/
│   ├── sidepanel/
│   ├── shared/
│   └── storage/
├── dist/
├── manifest.json
├── package.json
├── tsconfig.json
└── README.md
```

---

## 09. Roadmap

- [ ] Project-level folders and uncategorized inbox
- [ ] Better Markdown export and import
- [ ] Optional ResearchFlow project linking
- [ ] Zotero note export bridge
- [ ] Conflict-safe backup format
- [ ] More precise sensitive-content detection
- [ ] Keyboard-first capture workflow

---

## 10. Privacy and data ownership

ClipNote is designed as a **local-first** browser tool. Notes are stored locally unless the user explicitly exports or syncs them. Sensitive-content masking is a visual protection layer and should not be treated as cryptographic encryption.

---

## 11. Related projects

- **ResearchFlow Companion** — research workflow operating system
- **PaperPilot Pro** — academic search and publisher-page enhancement
- **ManuGuide** — Microsoft Word manuscript formatting and style checker
- **Witec-Matlab** — spectroscopy data analysis workflow
- **Scientific Color Lab** — scientific color and visualization workspace

---

## 12. License

MIT License.

Developed by **Shikun Hou / groele**.
