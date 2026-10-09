import { useEffect, useRef, useState } from 'react';
import { answerFor, exampleMessages, type LabMessage } from './copy';

export function useDemo(answer:boolean) {
  const [messages,setMessages]=useState<LabMessage[]>(answer ? exampleMessages : []);
  const [running,setRunning]=useState(false);
  const [draft,setDraft]=useState('');
  const timer=useRef<ReturnType<typeof setTimeout> | null>(null);
  const generation=useRef(0);
  useEffect(()=>()=>{ if(timer.current) clearTimeout(timer.current); },[]);
  async function submit(text:string) {
    if(!text.trim() || running) return;
    const id=++generation.current;
    setMessages(old=>[...old,{id:`user-${id+2}`,role:'user',content:text.trim()}]);
    setDraft(''); setRunning(true);
    await new Promise<void>(resolve=>{ timer.current=setTimeout(()=>{ if(generation.current===id) {
      setMessages(old=>[...old,{id:`assistant-${id+2}`,role:'assistant',content:answerFor(text)}]); setRunning(false);
    } resolve(); },900); });
  }
  function stop(){ ++generation.current; setRunning(false); }
  return {messages,running,draft,setDraft,submit,stop};
}
