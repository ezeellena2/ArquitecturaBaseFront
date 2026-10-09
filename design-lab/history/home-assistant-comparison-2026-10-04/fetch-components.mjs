import fs from 'node:fs/promises';
import path from 'node:path';

const seen = new Set();
const manifest = [];
const dependencies = new Set();
async function collect(url) {
  if (seen.has(url)) return;
  seen.add(url);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status}: ${url}`);
  const item = await response.json();
  const saved = [];
  for (const file of item.files ?? []) {
    if (!file.content || !file.path.endsWith('.tsx')) continue;
    const name = path.basename(file.path);
    const folder = url.includes('r.assistant-ui.com') ? 'assistant' : url.includes('elements.ai-sdk.dev') ? 'elements' : 'ui';
    const target = path.join('vendor', folder, name);
    let content = file.content
      .replaceAll('@/components/assistant-ui/elements/', '@lab/vendor/assistant/')
      .replaceAll('@/registry/default/ui/', '@lab/vendor/ui/')
      .replaceAll('@/components/ui/', '@lab/vendor/ui/')
      .replaceAll('@/lib/utils', '@lab/vendor/utils');
    await fs.mkdir(path.dirname(target), {recursive:true});
    await fs.writeFile(target, content);
    saved.push(target);
  }
  for (const dependency of item.dependencies ?? []) dependencies.add(dependency);
  manifest.push({url, name:item.name, files:saved});
  for (const dependency of item.registryDependencies ?? []) {
    if (dependency.startsWith('https://')) await collect(dependency);
    else await collect(`https://ui.shadcn.com/r/styles/new-york/${dependency}.json`);
  }
}
for (const url of [
  'https://r.assistant-ui.com/thread.json',
  'https://elements.ai-sdk.dev/api/registry/conversation.json',
  'https://elements.ai-sdk.dev/api/registry/message.json',
  'https://elements.ai-sdk.dev/api/registry/prompt-input.json',
]) await collect(url);
await fs.writeFile('vendor/manifest.json', JSON.stringify({sources:manifest,dependencies:[...dependencies]},null,2));
await fs.writeFile('vendor/utils.ts', 'import { clsx, type ClassValue } from "clsx";\nimport { twMerge } from "tailwind-merge";\nexport function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }\n');
process.stdout.write(JSON.stringify({files:manifest.length,dependencies:[...dependencies]},null,2));
