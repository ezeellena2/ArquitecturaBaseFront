import path from 'node:path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

const lab = import.meta.dirname;
const front = path.resolve(lab, '../../..');
export default defineConfig({
  root: front,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@lab': lab,
      '@': path.resolve(front, 'src'),
      'react': path.resolve(front, 'node_modules/react'),
      'react-dom': path.resolve(front, 'node_modules/react-dom'),
    },
    dedupe: ['react', 'react-dom'],
  },
  cacheDir: path.resolve(lab, 'node_modules/.vite'),
  server: { host:'127.0.0.1', port:5186, strictPort:true },
  build: { outDir:path.resolve(lab,'dist'), emptyOutDir:true, rollupOptions:{ input:path.resolve(lab,'index.html') } },
});
