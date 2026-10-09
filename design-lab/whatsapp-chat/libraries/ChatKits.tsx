import { useEffect, useRef, type ChangeEvent, type KeyboardEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar, Conversation, ConversationHeader, Message, MessageInput, MessageList } from '@chatscope/chat-ui-kit-react';
import { ChatItem, MessageBox, Input as ElementsInput } from 'react-chat-elements';
import { Button } from '@/shared/ui/button';
import { Textarea } from '@/shared/ui/textarea';
import { MessageBubble, MessageDateDivider, type MessageDeliveryState } from '@/shared/ui/MessageBubble';
import { MessageHistory } from '@/shared/ui/MessageHistory';
import { CheckIcon, CheckCheckIcon, ClockIcon, AlertCircleIcon, InfoIcon } from '@/shared/ui/icons';
import { formatTimeInZone, formatDateTimeInZone } from '@/shared/lib/dateTime';
import { type Demo, type DemoMessage } from './demo';
import { language } from './copy';

export type Library = 'current' | 'chatscope-adapted' | 'elements' | 'chatscope' | 'syncfusion';
const zone = 'America/Argentina/Buenos_Aires';
const iconByState = { pending: ClockIcon, sent: CheckIcon, delivered: CheckCheckIcon, read: CheckCheckIcon,
  failed: AlertCircleIcon, uncertain: AlertCircleIcon, reviewed: InfoIcon, unknown: InfoIcon };

export function DeliveryLabel({ state }: { state: MessageDeliveryState }) {
  const { t } = useTranslation('chatLibraryLab');
  const Icon = iconByState[state];
  return <span className="kit-delivery" data-delivery={state}><Icon className="size-3.5"/>{t(state)}</span>;
}

export function KitConversations({ library, demo }: { library: Library; demo: Demo }) {
  const { t } = useTranslation('chatLibraryLab');
  return demo.filtered.map((contact, index) => {
    const preview = demo.drafts[contact.id] ? `${t('draft')}: ${demo.drafts[contact.id]}` : t(contact.preview);
    if (library === 'chatscope-adapted') return <Conversation key={contact.id} name={contact.name} info={preview}
      active={demo.selected === contact.id} unreadCnt={contact.unread} lastActivityTime={`09:${String(index * 7).padStart(2, '0')}`}
      role="button" tabIndex={0} aria-label={contact.name} aria-pressed={demo.selected === contact.id}
      onClick={() => demo.select(contact.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); demo.select(contact.id); } }}>
      <Avatar name={contact.name}><span className="kit-avatar" aria-hidden>{contact.initials}</span></Avatar>
    </Conversation>;
    if (library === 'elements') return <div key={contact.id} className="elements-contact" data-selected={demo.selected === contact.id}
      role="button" tabIndex={0} aria-label={contact.name} aria-pressed={demo.selected === contact.id}
      onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); demo.select(contact.id); } }}>
      <ChatItem id={contact.id} avatar="" letterItem={{ id: contact.id, letter: <span className="kit-avatar" aria-hidden>{contact.initials}</span> }}
        title={contact.name} subtitle={preview} dateString={`09:${String(index * 7).padStart(2, '0')}`} unread={contact.unread}
        onClick={() => demo.select(contact.id)}/>
    </div>;
    return <div key={contact.id} className="current-contact" data-selected={demo.selected === contact.id}>
      <Button variant="ghost" className="w-full justify-start" aria-label={contact.name} aria-pressed={demo.selected === contact.id} onClick={() => demo.select(contact.id)}>
        <span className="kit-contact-name">{contact.name}</span>{contact.unread > 0 ? <span className="kit-unread">{contact.unread}</span> : null}
      </Button><p>{preview}</p>
    </div>;
  });
}

export function KitHeader({ library, demo }: { library: Library; demo: Demo }) {
  const { t } = useTranslation('chatLibraryLab');
  const contact = demo.contact;
  if (!contact) return null;
  if (library === 'chatscope-adapted') return <ConversationHeader>
    <ConversationHeader.Back onClick={() => demo.select(undefined)} aria-label={t('chats')} className="kit-mobile-back"/>
    <Avatar name={contact.name}><span className="kit-avatar" aria-hidden>{contact.initials}</span></Avatar>
    <ConversationHeader.Content userName={contact.name} info={contact.phone}/>
    <ConversationHeader.Actions><span className="kit-manual">{t('manual')}</span></ConversationHeader.Actions>
  </ConversationHeader>;
  return <div className="kit-header">
    <div className="kit-mobile-back"><Button size="sm" variant="outline" onClick={() => demo.select(undefined)}>{t('chats')}</Button></div>
    {library === 'elements' ? <span className="kit-avatar" aria-hidden>{contact.initials}</span> : null}
    <div className="kit-header-person"><h2>{contact.name}</h2><p>{contact.phone}</p></div>
    <span className="kit-manual">{t('manual')}</span>
  </div>;
}

function MessageActions({ message, demo }: { message: DemoMessage; demo: Demo }) {
  const { t } = useTranslation('chatLibraryLab');
  return message.state === 'uncertain' ? <div className="kit-message-actions"><Button variant="outline" size="sm" onClick={() => demo.setReviewOpen(true)}>{t('review')}</Button></div> :
    message.state === 'failed' ? <div className="kit-message-actions"><Button variant="muted-link" size="inline" disabled={Boolean(demo.value)} onClick={() => demo.draft(message.body)}>{t('reuse')}</Button></div> : null;
}

export function KitHistory({ library, demo }: { library: Library; demo: Demo }) {
  const { t } = useTranslation('chatLibraryLab');
  const header = <div className="kit-history-start">{!demo.older ? <Button size="sm" variant="muted-link" onClick={demo.loadOlder}>{t('older')}</Button> : null}<MessageDateDivider date="2026-10-04" label={t('today')}/></div>;
  let rows: ReactNode;
  if (library === 'current') rows = demo.messages.map(message => <MessageBubble key={message.id} direction={message.direction}
    text={message.body} timestamp={message.timestamp} timeLabel={formatTimeInZone(message.timestamp, language, zone)}
    dateLabel={formatDateTimeInZone(message.timestamp, language, zone)} author={message.direction === 'outgoing' ? t('you') : undefined}
    delivery={message.state ? { state: message.state, label: t(message.state) } : undefined}>
    {message.state === 'failed' || message.state === 'uncertain' ? <MessageActions message={message} demo={demo}/> : null}
  </MessageBubble>);
  else if (library === 'chatscope-adapted') rows = demo.messages.map(message => <div key={message.id} className="kit-message" data-direction={message.direction}>
    <Message model={{ direction: message.direction, position: 'single', type: 'text' }}>
      <Message.TextContent text={message.body}/>
      <Message.Footer><time dateTime={message.timestamp}>{formatTimeInZone(message.timestamp, language, zone)}</time>{message.state ? <DeliveryLabel state={message.state}/> : null}</Message.Footer>
    </Message><MessageActions message={message} demo={demo}/>
  </div>);
  else rows = demo.messages.map(message => <div key={message.id} className="elements-message" data-direction={message.direction} data-delivery={message.state}>
    <MessageBox id={message.id} type="text" position={message.direction === 'outgoing' ? 'right' : 'left'} text={message.body}
      title={message.direction === 'outgoing' ? t('you') : demo.contact?.name ?? ''} titleColor="var(--color-brand-600)"
      date={new Date(message.timestamp)} dateString={formatTimeInZone(message.timestamp, language, zone)} focus={false}
      forwarded={false} replyButton={false} removeButton={false} retracted={false} notch
      status={message.state === 'read' ? 'read' : message.state === 'delivered' ? 'received' : message.state === 'sent' ? 'sent' : 'waiting'}/>
    {message.state ? <div className="elements-delivery"><DeliveryLabel state={message.state}/></div> : null}
    <MessageActions message={message} demo={demo}/>
  </div>);
  return library === 'chatscope-adapted' ? <MessageList autoScrollToBottom={false} autoScrollToBottomOnMount={false}>{header}{rows}</MessageList> :
    library === 'current' ? <MessageHistory label={t('title')}>{header}{rows}</MessageHistory> :
      <div className="elements-history" aria-label={t('title')}>{header}{rows}</div>;
}

function ElementsComposer({ demo }: { demo: Demo }) {
  const { t } = useTranslation('chatLibraryLab');
  const input = useRef<HTMLTextAreaElement>(null);
  // This kit's multiline Input does not bind value or forward accessibility props.
  // Keep the adapter explicit; product adoption needs a proper React 19 replacement.
  useEffect(() => {
    const node = input.current;
    if (!node) return;
    if (node.value !== demo.value) node.value = demo.value;
    node.id = 'kit-reply'; node.maxLength = 4096;
    node.setAttribute('aria-invalid', String(Boolean(demo.fieldError)));
    if (demo.fieldError) node.setAttribute('aria-describedby', 'kit-reply-error');
    else node.removeAttribute('aria-describedby');
  }, [demo.value, demo.fieldError]);
  return <ElementsInput referance={input} multiline autoHeight minHeight={72} maxHeight={140} maxlength={4096}
    placeholder={t('placeholder')} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => demo.draft(event.target.value)}
    onKeyDown={(event: KeyboardEvent) => { if (event.ctrlKey && event.key === 'Enter') { event.preventDefault(); demo.send(); } }}/>
}

function ChatscopeComposer({ demo }: { demo: Demo }) {
  const { t } = useTranslation('chatLibraryLab');
  const wrapper = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const editable = wrapper.current?.querySelector('[contenteditable]');
    if (!editable) return;
    editable.id = 'kit-reply'; editable.setAttribute('role', 'textbox'); editable.setAttribute('aria-label', t('reply'));
    editable.setAttribute('aria-multiline', 'true'); editable.setAttribute('aria-invalid', String(Boolean(demo.fieldError)));
    if (demo.fieldError) editable.setAttribute('aria-describedby', 'kit-reply-error');
    else editable.removeAttribute('aria-describedby');
  }, [t, demo.fieldError]);
  const escaped = demo.value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('\n', '<br>');
  return <div ref={wrapper} onKeyDownCapture={event => { if (event.ctrlKey && event.key === 'Enter') { event.preventDefault(); demo.send(); } }}>
    <MessageInput value={escaped} onChange={(_html, _text, innerText) => demo.draft(innerText)}
      placeholder={t('placeholder')} disabled={Boolean(demo.reason)} sendOnReturnDisabled sendButton={false} attachButton={false}/>
  </div>;
}

export function KitComposer({ library, demo }: { library: Library; demo: Demo }) {
  const { t } = useTranslation('chatLibraryLab');
  return <div className="kit-composer">
    {demo.reason ? <p className="kit-composer-reason">{t(demo.reason)}</p> : null}
    <fieldset disabled={Boolean(demo.reason)}>
      <label htmlFor="kit-reply" className="kit-reply-label">{t('reply')}</label>
      {library === 'chatscope-adapted' ? <ChatscopeComposer demo={demo}/> : library === 'elements' ? <ElementsComposer demo={demo}/> :
        <Textarea id="kit-reply" value={demo.value} rows={3} maxLength={4096} placeholder={t('placeholder')}
          aria-invalid={Boolean(demo.fieldError)} aria-describedby={demo.fieldError ? 'kit-reply-error' : undefined}
          onChange={event => demo.draft(event.target.value)} onKeyDown={event => { if (event.ctrlKey && event.key === 'Enter') { event.preventDefault(); demo.send(); } }}/>
      }
      {demo.fieldError ? <p id="kit-reply-error" role="alert" className="kit-field-error">{demo.fieldError}</p> : null}
      <div className="kit-composer-actions"><Button size="sm" disabled={Boolean(demo.reason) || !demo.value.trim()} onClick={() => demo.send()}>{t('send')}</Button></div>
    </fieldset>
  </div>;
}
