import fs from 'node:fs/promises';
import path from 'node:path';

async function visit(directory){
  for(const entry of await fs.readdir(directory,{withFileTypes:true})){
    const file=path.join(directory,entry.name);
    if(entry.isDirectory()){await visit(file);continue;}
    if(!/\.tsx?$/.test(file)) continue;
    let text=await fs.readFile(file,'utf8');
    text=text.replaceAll('@/registry/new-york/ui/','@lab/vendor/ui/')
      .replaceAll('@/hooks/','@lab/vendor/assistant/');
    if(entry.name==='thread.aui.tsx'&&!text.includes('from "@lab/copy"')){
      text=text.replace('"use client";','"use client";\nimport { labels } from "@lab/copy";')
        .replace('How can I help you today?','{labels.greeting}')
        .replace('placeholder="Send a message..."','placeholder={labels.placeholder}')
        .replaceAll('aria-label="Message input"','aria-label={labels.placeholder}')
        .replaceAll('tooltip="Send message"','tooltip={labels.send}')
        .replaceAll('aria-label="Send message"','aria-label={labels.send}')
        .replaceAll('tooltip="Stop generating"','tooltip={labels.stop}');
    }
    if(entry.name==='thread.aui.tsx'){
      for(const [english,expression] of [['Copy','labels.copy'],['Refresh','labels.retry'],['More',"(language === 'es' ? 'Más opciones' : 'More options')"],['Edit',"(language === 'es' ? 'Editar' : 'Edit')"],['Scroll to bottom',"(language === 'es' ? 'Ir al final' : 'Scroll to bottom')"]]) {
        text=text.replaceAll(`tooltip="${english}"`,`tooltip={${expression}}`);
      }
      text=text.replace('import { labels }','import { labels, language }');
    }
    await fs.writeFile(file,text);
  }
}
await visit('vendor');
