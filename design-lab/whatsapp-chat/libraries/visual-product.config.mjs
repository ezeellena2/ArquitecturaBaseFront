import path from 'node:path';
import { defineConfig } from '../../../node_modules/@playwright/test/index.mjs';
import product from '../../../playwright.config.ts';

// Same product cases/reference images. Separate output/port avoid concurrent-run
// artifact deletion in this shared checkout; do not relax assertions or warnings.
const front = path.resolve(import.meta.dirname, '../../..');
export default defineConfig({
  ...product,
  testDir: path.join(front, 'src/test/visual'),
  snapshotPathTemplate: path.join(front, 'src/test/visual/screenshots/{arg}{ext}'),
  outputDir: path.join(front, '.test-artifacts/whatsapp-native-2026-10-04'),
  use: { ...product.use, baseURL: 'http://127.0.0.1:5187' },
  webServer: { ...product.webServer, cwd: front,
    command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5187',
    url: 'http://127.0.0.1:5187/src/test/visual/index.html' },
});
