import { Conversation, ConversationContent, ConversationEmptyState, ConversationScrollButton } from './vendor/elements/conversation';
import { Message, MessageContent, MessageResponse } from './vendor/elements/message';
import { PromptInput, PromptInputBody, PromptInputTextarea, PromptInputFooter, PromptInputSubmit } from './vendor/elements/prompt-input';
import { Button } from './vendor/ui/button';
import { labels } from './copy';
import { useDemo } from './useDemo';

export default function ElementsExample({answer}:{answer:boolean}) {
  const demo=useDemo(answer);
  return <div className="elements-example">
    <Conversation><ConversationContent>
      {demo.messages.length ? demo.messages.map(message=><Message key={message.id} from={message.role}><MessageContent><MessageResponse>{message.content}</MessageResponse></MessageContent></Message>) :
        <ConversationEmptyState title={labels.greeting} description={labels.intro}/>}
      {demo.running && <p role="status">{labels.send}…</p>}
    </ConversationContent><ConversationScrollButton aria-label={labels.answer}/></Conversation>
    <div className="elements-composer">
      {!demo.messages.length && <div className="elements-suggestions">{[labels.users,labels.roles,labels.help].map(prompt=><Button key={prompt} variant="outline" onClick={()=>demo.setDraft(prompt)}>{prompt}</Button>)}</div>}
      <PromptInput onSubmit={message=>demo.submit(message.text)}>
        <PromptInputBody><PromptInputTextarea placeholder={labels.placeholder} aria-label={labels.placeholder} value={demo.draft} disabled={demo.running} onChange={event=>demo.setDraft(event.target.value)}/></PromptInputBody>
        <PromptInputFooter><span className="text-muted-foreground text-xs">{labels.intro}</span><PromptInputSubmit status={demo.running?'streaming':'ready'} aria-label={demo.running?labels.stop:labels.send} onStop={demo.stop}/></PromptInputFooter>
      </PromptInput><p className="library-disclaimer">{labels.footer}</p>
    </div>
  </div>;
}
