import { useMemo, useState } from 'react';
import { ChatKit, useChatKit } from '@openai/chatkit-react';
import { labels, language } from './copy';
import { createChatkitMock } from './chatkitMock';
export default function ChatkitExample({answer}:{answer:boolean}) {
  const mock=useMemo(()=>createChatkitMock(answer),[answer]);
  const [error,setError]=useState('');
  const kit=useChatKit({api:{url:location.origin+'/mock-chatkit',domainKey:'localhost',fetch:mock},
    locale:language==='es'?'es-419':'en',initialThread:answer?'demo-thread':null,
    theme:{colorScheme:'light',radius:'round',density:'normal',typography:{fontFamily:'Public Sans, sans-serif',baseSize:15,
      fontSources:[{family:'Public Sans',src:'https://cdn.jsdelivr.net/npm/@fontsource-variable/public-sans@5.3.0/files/public-sans-latin-wght-normal.woff2',weight:'100 900',style:'normal',display:'swap'}]},color:{accent:{primary:'#285a3d',level:2}}},
    header:{enabled:false},history:{enabled:true,showDelete:true,showRename:false},
    composer:{placeholder:labels.placeholder,attachments:{enabled:false}},
    startScreen:{greeting:labels.greeting,prompts:[labels.users,labels.roles,labels.help].map(prompt=>({label:prompt,prompt}))},
    disclaimer:{text:labels.footer},thread:{autoScroll:true},
    onError:event=>{setError(event.error.message);console.error('ChatKit preview',event.error.message);},
  });
  return <><ChatKit control={kit.control} className="chatkit-example"/>{error&&<p className="library-runtime-error" role="status">ChatKit: {error}</p>}</>;
}
