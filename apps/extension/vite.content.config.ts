import { defineConfig } from 'vite';
import { resolve } from 'path';

// Manifest-declared content scripts run as classic scripts. Build this entry
// separately as one IIFE so Rollup cannot leave ESM imports in content.js.
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/content/index.ts'),
      name: 'TidyGPTContent',
      formats: ['iife'],
      fileName: () => 'assets/content.js'
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true
      }
    }
  }
});
