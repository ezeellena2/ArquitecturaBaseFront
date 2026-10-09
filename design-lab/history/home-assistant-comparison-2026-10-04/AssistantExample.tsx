import { AssistantRuntimeProvider, useExternalStoreRuntime, type ThreadMessageLike } from '@assistant-ui/react';
import { Thread } from './vendor/assistant/thread.aui';
import { labels } from './copy';
import { useDemo } from './useDemo';

export default function AssistantExample({answer}:{answer:boolean}) {
  const demo=useDemo(answer);
  const runtime=useExternalStoreRuntime({
    messages:demo.messages,
    convertMessage:message=>({id:message.id,role:message.role,content:[{type:'text',text:message.content}]} as ThreadMessageLike),
    isRunning:demo.running,
    onNew:async message=>{ const text=message.content.filter(part=>part.type==='text').map(part=>part.text).join('\n'); await demo.submit(text); },
    onCancel:async()=>demo.stop(),
    suggestions:[{prompt:labels.users},{prompt:labels.roles},{prompt:labels.help}],
  });
  return <AssistantRuntimeProvider runtime={runtime}><Thread autoFocus={false}/></AssistantRuntimeProvider>;
}
