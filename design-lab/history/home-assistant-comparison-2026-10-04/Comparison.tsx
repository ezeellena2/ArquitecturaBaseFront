import { lazy, Suspense, useState } from 'react';
import { Button } from '@/shared/ui/button';
import { NativeSelect } from '@/shared/ui/NativeSelect';
import { Page } from '@/shared/ui/Page';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/shared/ui/dialog';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { Spinner } from '@/shared/ui/Spinner';
import { labels, language } from './copy';
import { loadChatkit } from './chatkitLoader';
import { PreviewBoundary } from './PreviewBoundary';

const variants={
  'assistant-ui':{name:'assistant-ui',Component:lazy(()=>import('./AssistantExample'))},
  'ai-elements':{name:'AI Elements',Component:lazy(()=>import('./ElementsExample'))},
  'copilotkit':{name:'CopilotKit',Component:lazy(()=>import('./CopilotExample'))},
  'chatkit':{name:'ChatKit',Component:lazy(async()=>{await loadChatkit();return import('./ChatkitExample');})},
};
export type Variant=keyof typeof variants;
export default function Comparison(){
  const query=new URLSearchParams(location.search);
  const [variant,setVariant]=useState<Variant>((query.get('library')??'assistant-ui') in variants?query.get('library') as Variant || 'assistant-ui':'assistant-ui');
  const [answer,setAnswer]=useState(query.get('scene')!=='empty');
  const [history,setHistory]=useState(false);
  const [confirm,setConfirm]=useState(false);
  const [revision,setRevision]=useState(0);
  const {Component}=variants[variant];
  function updateUrl(nextVariant:Variant,nextAnswer:boolean){const url=new URL(location.href);url.searchParams.set('library',nextVariant);url.searchParams.set('scene',nextAnswer?'answer':'empty');window.history.replaceState(null,'',url);}
  function select(next:Variant){setVariant(next);updateUrl(next,answer);}
  function scene(next:boolean){setAnswer(next);setRevision(old=>old+1);updateUrl(variant,next);}
  return <>
    <div className="comparison-toolbar"><div className="comparison-tabs" aria-label={labels.lab}>{(Object.keys(variants) as Variant[]).map(key=><Button key={key} variant={variant===key?'default':'ghost'} aria-pressed={variant===key} onClick={()=>select(key)}>{variants[key].name}</Button>)}</div>
      <div className="comparison-controls"><span>{labels.simulated}</span><NativeSelect aria-label={labels.lab} value={answer?'answer':'empty'} onChange={event=>scene(event.target.value==='answer')}><option value="empty">{labels.empty}</option><option value="answer">{labels.answer}</option></NativeSelect><a href={`?lang=${language==='es'?'en':'es'}&library=${variant}&scene=${answer?'answer':'empty'}`}>{language==='es'?'EN':'ES'}</a></div>
    </div>
    <Page title={labels.title} actions={<><Button variant="outline" onClick={()=>setHistory(true)}>{labels.history}</Button><Button variant="outline" onClick={()=>setConfirm(true)}>{labels.newChat}</Button></>}>
      <div className="comparison-stage"><div className="library-chat" data-library={variant}><PreviewBoundary key={`${variant}-${answer}-${revision}`}><Suspense fallback={<div className="comparison-loading"><Spinner/></div>}><Component answer={answer}/></Suspense></PreviewBoundary></div></div>
    </Page>
    <Dialog open={history} onOpenChange={setHistory}><DialogContent><DialogHeader><DialogTitle>{labels.historyTitle}</DialogTitle></DialogHeader><Button variant="ghost" onClick={()=>{scene(true);setHistory(false);}}>{labels.users}</Button><p>{labels.today}</p><DialogFooter><Button variant="outline" onClick={()=>setHistory(false)}>{labels.close}</Button></DialogFooter></DialogContent></Dialog>
    <ConfirmDialog open={confirm} onOpenChange={setConfirm} title={labels.clearTitle} description={labels.clearHelp} confirmLabel={labels.newChat} cancelLabel={labels.cancel} onConfirm={()=>{scene(false);setConfirm(false);}}/>
  </>;
}
