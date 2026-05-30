import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, existsSync, readdirSync, mkdirSync } from 'fs';

function copyDir(src: string, dest: string) {
  if (!existsSync(dest)) {
    mkdirSync(dest, { recursive: true });
  }
  const entries = readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = `${src}/${entry.name}`;
    const destPath = `${dest}/${entry.name}`;
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

export default defineConfig({
  plugins: [
    {
      name: 'copy-extension-files',
      writeBundle() {
        copyFileSync('manifest.json', 'dist/manifest.json');
        if (existsSync('public/icons')) {
          copyDir('public/icons', 'dist/icons');
        }
        if (existsSync('src/content/content.css')) {
          copyFileSync('src/content/content.css', 'dist/content.css');
        }
      },
    },
  ],
  build: {
    outDir: 'dist',
    emptyDirOnBuild: true,
    rollupOptions: {
      input: resolve(__dirname, 'src/background/service-worker.ts'),
      output: {
        format: 'iife',
        entryFileNames: 'service-worker.js',
      },
    },
    target: 'es2020',
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
