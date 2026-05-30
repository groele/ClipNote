# ClipNote

Browser-native clipboard and Markdown notebook Chrome extension.

## Setup

```bash
npm install
```

## Development

```bash
npm run dev
```

## Build

```bash
npm run build
```

Output will be in the `dist/` directory.

## Load in Chrome

1. Open `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked**
4. Select the `dist/` folder

## Features

- **Floating button** - Quick access to clip content from any webpage
- **Quick panel** - Fast clipboard operations and note-taking
- **Side panel notebook** - Full-featured Markdown editor in the browser sidebar
- **Markdown support** - Write and preview Markdown notes
- **Context menu integration** - Right-click to clip selected text

## Architecture

```
clipnote-extension/
├── src/
│   ├── background/      # Service worker for extension lifecycle
│   ├── content/         # Content script injected into web pages
│   ├── sidepanel/       # Side panel UI (React)
│   ├── shared/          # Shared utilities and types
│   └── storage/         # Storage abstraction layer
├── public/
│   └── icons/           # Extension icons (16, 48, 128px)
├── manifest.json        # Chrome extension manifest (MV3)
├── sidepanel.html       # Side panel entry point
├── vite.config.ts       # Build configuration
└── tsconfig.json        # TypeScript configuration
```

### Components

- **Content Script** (`src/content/`) - Injected into web pages to handle clipping and display the floating button
- **Side Panel** (`src/sidepanel/`) - React-based UI for the notebook interface
- **Service Worker** (`src/background/`) - Handles extension events, context menus, and coordination
- **Shared** (`src/shared/`) - Common types, utilities, and constants
- **Storage** (`src/storage/`) - Chrome storage API abstraction for persisting notes and settings

## License

MIT
