import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Builds the claude.ai Artifact version: one JS and one CSS file with fixed names, published beside artifact/page.html.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist-artifact',
    emptyOutDir: true,
    rollupOptions: {
      input: 'src/artifact-main.tsx',
      output: { entryFileNames: 'app.js', assetFileNames: 'app[extname]', inlineDynamicImports: true },
    },
  },
})
