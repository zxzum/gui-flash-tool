import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import path from 'path';

export default defineConfig({
  plugins: [preact()],
  root: path.resolve(__dirname),
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
