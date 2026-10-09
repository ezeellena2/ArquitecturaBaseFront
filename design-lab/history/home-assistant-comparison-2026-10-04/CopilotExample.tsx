import { CopilotChatView, CopilotChatConfigurationProvider, CopilotKitProvider } from '@copilotkit/react-core/v2';
import '@copilotkit/react-core/v2/styles.css';
import { labels } from './copy';
import { useDemo } from './useDemo';

export default function CopilotExample({answer}:{answer:boolean}) {
  const demo=useDemo(answer);
  return <CopilotKitProvider showDevConsole={false} enableInspector={false}><CopilotChatConfigurationProvider labels={{
    welcomeMessageText:labels.greeting, chatInputPlaceholder:labels.placeholder, chatDisclaimerText:labels.footer,
    assistantMessageToolbarCopyMessageLabel:labels.copy, userMessageToolbarCopyMessageLabel:labels.copy,
    assistantMessageToolbarThumbsUpLabel:languageLabel('Útil','Helpful'), assistantMessageToolbarThumbsDownLabel:languageLabel('No útil','Not helpful'),
    userMessageToolbarEditMessageLabel:languageLabel('Editar pregunta','Edit question'), assistantMessageToolbarRegenerateLabel:labels.retry,
  }}>
    <CopilotChatView messages={demo.messages} isRunning={demo.running} onSubmitMessage={demo.submit} onStop={demo.stop}
      inputValue={demo.draft} onInputChange={demo.setDraft} suggestions={[labels.users,labels.roles,labels.help].map(title=>({title,message:title,isLoading:false}))}
      onSelectSuggestion={suggestion=>demo.setDraft(suggestion.message ?? suggestion.title)} />
  </CopilotChatConfigurationProvider></CopilotKitProvider>;
}
function languageLabel(es:string,en:string){ return document.documentElement.lang==='en'?en:es; }
