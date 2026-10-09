import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar, MainContainer, Sidebar, ConversationList, ChatContainer, ConversationHeader,
  Message, MessageList, MessageSeparator, MessageInput } from '@chatscope/chat-ui-kit-react';
import { ChatUIComponent, type MessageModel, type MessageSendEventArgs } from '@syncfusion/ej2-react-interactive-chat';
import { L10n } from '@syncfusion/ej2-base';
import { Button } from '@/shared/ui/button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { formatTimeInZone } from '@/shared/lib/dateTime';
import { DeliveryLabel, KitConversations } from './ChatKits';
import { type Demo, type DemoMessage } from './demo';
import { language } from './copy';

export type NativeLibrary = 'chatscope' | 'syncfusion';
const zone = 'America/Argentina/Buenos_Aires';
function escapeText(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('\n', '<br>');
}

// Only strings used by this native widget; application notifications remain shared.
L10n.load({ es: { 'chat-ui': { send: 'Enviar', attachments: 'Adjuntar archivo', close: 'Cerrar',
  noRecordsTemplate: 'No hay coincidencias', forwarded: 'Reenviado', download: 'Descargar',
  unpin: 'Desfijar', viewChat: 'Ver en el chat' } } });

function DraftHelp({ demo }: { demo: Demo }) {
  const { t } = useTranslation('chatLibraryLab');
  return <>
    {demo.reason ? <p id="native-reply-help" className="native-reply-help">{t(demo.reason)}</p> : null}
    {demo.fieldError ? <p id="native-reply-error" role="alert" className="kit-field-error">{demo.fieldError}</p> : null}
  </>;
}

function ReviewActions({ demo }: { demo: Demo }) {
  const { t } = useTranslation('chatLibraryLab');
  return demo.scene === 'states' ? <div className="native-review-actions">
    <Button variant="muted-link" size="inline" disabled={Boolean(demo.value)} onClick={() => demo.draft(t('failedText'))}>{t('reuse')}</Button>
    <Button variant="outline" size="sm" disabled={!demo.messages.some(message => message.state === 'uncertain')}
      onClick={() => demo.setReviewOpen(true)}>{t('review')}</Button>
  </div> : null;
}

function SyncfusionThread({ demo }: { demo: Demo }) {
  const { t } = useTranslation('chatLibraryLab');
  const wrapper = useRef<HTMLDivElement>(null);
  const widget = useRef<ChatUIComponent>(null);
  const serialized = JSON.stringify(demo.messages);
  const contact = demo.contact;
  const messages = useMemo<MessageModel[]>(() => {
    const source: DemoMessage[] = JSON.parse(serialized);
    return source.map(message => ({
      id: message.id, text: escapeText(message.body), timeStamp: new Date(message.timestamp),
      author: message.direction === 'outgoing' ? { id: 'operator', user: t('you') } : { id: contact?.id, user: contact?.name },
      status: message.state ? { text: t(message.state) } : undefined,
    }));
  }, [serialized, contact, t]);

  // Chat UI owns an imperative contenteditable and has no controlled draft prop.
  // Synchronize only plain text; keep the queue/model in the shared mock state.
  function synchronizeEditor() {
    const editable = wrapper.current?.querySelector<HTMLElement>('[contenteditable]');
    const send = wrapper.current?.querySelector<HTMLElement>('.e-chat-send');
    const avatar = wrapper.current?.querySelector<HTMLElement>('.native-contact-initials');
    if (avatar) { avatar.textContent = contact?.initials ?? ''; avatar.setAttribute('aria-hidden', 'true'); }
    if (!editable || !send) return;
    editable.id = 'kit-reply';
    editable.setAttribute('role', 'textbox');
    editable.setAttribute('aria-label', t('reply'));
    editable.setAttribute('aria-multiline', 'true');
    editable.setAttribute('aria-invalid', String(Boolean(demo.fieldError)));
    editable.setAttribute('aria-disabled', String(Boolean(demo.reason)));
    editable.setAttribute('contenteditable', demo.reason ? 'false' : 'true');
    if (demo.fieldError || demo.reason) editable.setAttribute('aria-describedby', demo.fieldError ? 'native-reply-error' : 'native-reply-help');
    else editable.removeAttribute('aria-describedby');
    if (editable.innerText !== demo.value) {
      editable.innerText = demo.value;
      editable.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const disabled = Boolean(demo.reason) || !demo.value.trim();
    send.setAttribute('aria-label', t('send'));
    send.setAttribute('aria-disabled', String(disabled));
    send.classList.toggle('disabled', disabled);
    send.classList.toggle('enabled', !disabled);
  }
  useEffect(synchronizeEditor, [demo.value, demo.reason, demo.fieldError, contact?.initials, t]);
  useEffect(() => {
    const viewport = wrapper.current?.querySelector<HTMLElement>('.e-message-wrapper');
    if (!viewport) return;
    let following = true;
    let previousHeight = viewport.clientHeight;
    const trackScroll = () => {
      if (viewport.clientHeight === previousHeight) following = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 36;
    };
    // The native widget follows new messages but does not follow viewport resizing.
    // Keep the latest visible only when the person was already at the bottom.
    const observer = new ResizeObserver(() => {
      if (following) widget.current?.scrollToBottom();
      previousHeight = viewport.clientHeight;
    });
    observer.observe(viewport); viewport.addEventListener('scroll', trackScroll);
    return () => { observer.disconnect(); viewport.removeEventListener('scroll', trackScroll); };
  }, []);

  function sendMessage(event: MessageSendEventArgs) {
    // Cancel the kit's automatic append/date/status. The mock queue owns the result.
    event.cancel = true;
    demo.send(event.message?.text ?? '');
  }
  return <div ref={wrapper} className="native-syncfusion-thread"
    onClickCapture={event => { if (demo.reason && (event.target as HTMLElement).closest('.e-chat-send')) { event.preventDefault(); event.stopPropagation(); } }}
    onKeyDownCapture={event => { if (demo.reason && event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); } }}>
    <ChatUIComponent ref={widget} user={{ id: 'operator', user: t('you') }} messages={messages}
      headerText={contact?.name} headerIconCss="native-contact-initials" width="100%" height="100%"
      locale={language} placeholder={t('placeholder')} enableAttachments={false}
      showTimeBreak showTimeStamp timeStampFormat="HH:mm" autoScrollToBottom
      messageToolbarSettings={{ items: [] }} created={synchronizeEditor}
      timeBreakTemplate={() => <span>{t('today')}</span>}
      userTyping={event => { if (!demo.reason) demo.draft(event.message ?? ''); }} messageSend={sendMessage}/>
    <DraftHelp demo={demo}/><ReviewActions demo={demo}/>
  </div>;
}

export function NativeStage({ library, demo, filters }: { library: NativeLibrary; demo: Demo; filters: ReactNode }) {
  const { t } = useTranslation('chatLibraryLab');
  const stage = useRef<HTMLDivElement>(null);
  const contact = demo.contact;
  useEffect(() => {
    if (library !== 'chatscope') return;
    const back = stage.current?.querySelector<HTMLButtonElement>('.native-mobile-back button');
    back?.setAttribute('aria-label', t('chats'));
    const editable = stage.current?.querySelector<HTMLElement>('[contenteditable]');
    const send = stage.current?.querySelector<HTMLButtonElement>('.cs-button--send');
    if (!editable || !send) return;
    editable.id = 'kit-reply'; editable.setAttribute('role', 'textbox'); editable.setAttribute('aria-label', t('reply'));
    editable.setAttribute('aria-multiline', 'true'); editable.setAttribute('aria-invalid', String(Boolean(demo.fieldError)));
    if (demo.fieldError || demo.reason) editable.setAttribute('aria-describedby', demo.fieldError ? 'native-reply-error' : 'native-reply-help');
    else editable.removeAttribute('aria-describedby');
    send.setAttribute('aria-label', t('send'));
  }, [library, contact, demo.fieldError, demo.reason, t]);

  const history = <MessageList key={contact?.id} autoScrollToBottom autoScrollToBottomOnMount>
    <div className="native-older">{!demo.older ? <Button size="sm" variant="muted-link" onClick={demo.loadOlder}>{t('older')}</Button> : null}</div>
    <MessageSeparator content={t('today')}/>
    {demo.messages.map((message, index) => {
      const previous = demo.messages[index - 1]?.direction === message.direction;
      const next = demo.messages[index + 1]?.direction === message.direction;
      return <Message key={message.id} model={{ direction: message.direction, type: 'text',
        position: previous ? next ? 'normal' : 'last' : next ? 'first' : 'single' }}>
        <Message.TextContent text={message.body}/>
        <Message.Footer><time dateTime={message.timestamp}>{formatTimeInZone(message.timestamp, language, zone)}</time>
          {message.state ? <DeliveryLabel state={message.state}/> : null}</Message.Footer>
      </Message>;
    })}
    <DraftHelp demo={demo}/><ReviewActions demo={demo}/>
  </MessageList>;

  const empty = <div className="native-no-selection"><EmptyState embedded title={t('selectTitle')} description={t('selectHelp')}/></div>;
  return <div ref={stage} className="kit-native-stage" data-library={library} data-selected={Boolean(contact)}>
    {library === 'chatscope' ? <MainContainer>
      <Sidebar position="left" scrollable={false}>
        {filters}<ConversationList><KitConversations library="chatscope-adapted" demo={demo}/>
          {!demo.filtered.length ? <EmptyState embedded title={t('noResults')} action={<Button variant="outline" onClick={() => demo.setSearch('')}>{t('clear')}</Button>}/> : null}
        </ConversationList>
      </Sidebar>
      <ChatContainer>
        {contact ? <ConversationHeader>
          <ConversationHeader.Back className="native-mobile-back" aria-label={t('chats')} onClick={() => demo.select(undefined)}/>
          <Avatar name={contact.name}><span className="native-avatar" aria-hidden>{contact.initials}</span></Avatar>
          <ConversationHeader.Content userName={contact.name} info={contact.phone}/>
          <ConversationHeader.Actions><span className="kit-manual">{t('manual')}</span></ConversationHeader.Actions>
        </ConversationHeader> : null}
        {contact ? history : empty}
        {contact ? <MessageInput value={escapeText(demo.value)} placeholder={t('placeholder')} attachButton={false}
          disabled={Boolean(demo.reason)} sendDisabled={Boolean(demo.reason) || !demo.value.trim()}
          onChange={(_html, _text, innerText) => demo.draft(innerText)} onSend={(_html, _text, innerText) => demo.send(innerText)}/> : null}
      </ChatContainer>
    </MainContainer> : <div className="native-syncfusion-grid">
      <aside className="native-inbox" aria-label={t('chats')}>
        {filters}<div className="native-contact-list">{demo.filtered.map(item => <Button key={item.id} variant="ghost"
          aria-label={item.name} aria-pressed={demo.selected === item.id} onClick={() => demo.select(item.id)}>
          <span className="kit-avatar" aria-hidden>{item.initials}</span><span className="native-contact-copy"><strong>{item.name}</strong>
            <span>{demo.drafts[item.id] ? `${t('draft')}: ${demo.drafts[item.id]}` : t(item.preview)}</span></span>
          {item.unread ? <span className="native-unread">{item.unread}</span> : null}
        </Button>)}{!demo.filtered.length ? <EmptyState embedded title={t('noResults')} action={<Button variant="outline" onClick={() => demo.setSearch('')}>{t('clear')}</Button>}/> : null}</div>
      </aside>
      <section className="native-thread" aria-label={contact?.name ?? t('selectTitle')}>
        {contact ? <><div className="native-thread-context"><Button className="native-mobile-back" variant="outline" size="sm" onClick={() => demo.select(undefined)}>{t('chats')}</Button>
          <span>{contact.phone}</span><span>{t('manual')}</span>
          {!demo.older ? <Button variant="muted-link" size="inline" onClick={demo.loadOlder}>{t('older')}</Button> : null}</div>
          <SyncfusionThread key={contact.id} demo={demo}/></> : empty}
      </section>
    </div>}
  </div>;
}
