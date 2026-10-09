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
      '@': path.resolve(front, 'src'),
      'react': path.resolve(lab, 'node_modules/react'),
      'react-dom': path.resolve(lab, 'node_modules/react-dom'),
    },
    dedupe: ['react', 'react-dom'],
  },
  cacheDir: path.resolve(lab, 'node_modules/.vite'),
  server: { host: '127.0.0.1', port: 5185, strictPort: true },
  build: {
    outDir: path.resolve(lab, 'dist'), emptyOutDir: true,
    rollupOptions: {
      preserveEntrySignatures: false,
      input: { libraries: path.resolve(lab, 'index.html'), shapes: path.resolve(lab, 'shapes.html') },
      output: { strictExecutionOrder: true, codeSplitting: { includeDependenciesRecursively: false, groups: [
        { name: 'syncfusion-inputs', test: /node_modules[\\/]@syncfusion[\\/](ej2-inputs|ej2-dropdowns)[\\/]/, priority: 13 },
        { name: 'syncfusion-runtime', test: /node_modules[\\/]@syncfusion[\\/](ej2-base|ej2-react-base|ej2-buttons|ej2-popups)[\\/]/, priority: 12 },
        { name: 'syncfusion-chat', test: /node_modules[\\/]@syncfusion[\\/]/, priority: 11 },
        { name: 'chat-kits', test: /node_modules[\\/](@chatscope|react-chat-elements|@hugeicons|@fortawesome|timeago\.js|progressbar\.js|react-spinkit)/, priority: 10 },
        { name: 'ui-primitives', test: /node_modules[\\/](radix-ui|@radix-ui|sonner|lucide-react)/, priority: 8 },
        { name: 'react-runtime', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 9 },
      ] } },
    },
  },
});
