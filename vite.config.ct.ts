import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyDirOnBuild: false,
    emptyOutDir: false,
    rollupOptions: {
      input: resolve(__dirname, 'src/content/content.ts'),
      output: {
        format: 'iife',
        entryFileNames: 'content.js',
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
