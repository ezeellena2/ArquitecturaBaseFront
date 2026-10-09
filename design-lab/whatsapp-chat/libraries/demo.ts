import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MessageDeliveryState } from '@/shared/ui/MessageBubble';
import { notify, dismissNotification } from '@/shared/ui/notifications';

export const scenes = ['conversation', 'empty', 'loading', 'error', 'read-only', 'closed', 'states'] as const;
export type Scene = typeof scenes[number];
export interface DemoMessage {
  id: string; body: string; timestamp: string; direction: 'incoming' | 'outgoing'; state?: MessageDeliveryState;
}
export const contacts = [
  { id: 'ana', name: 'Ana Martínez', initials: 'AM', phone: '+54 9 351 555-1234', preview: 'anaPreview', unread: 2 },
  { id: 'juan', name: 'Juan Gómez', initials: 'JG', phone: '+54 9 351 555-2345', preview: 'juanPreview', unread: 0 },
  { id: 'laura', name: 'Laura Ríos', initials: 'LR', phone: '+54 9 351 555-3456', preview: 'lauraPreview', unread: 1 },
  { id: 'martin', name: 'Martín López', initials: 'ML', phone: '+54 9 351 555-4567', preview: 'martinPreview', unread: 0 },
] as const;

export function useDemo(initialScene: Scene) {
  const { t } = useTranslation('chatLibraryLab');
  const [scene, setScene] = useState(initialScene);
  const [selected, setSelected] = useState<string | undefined>('ana');
  const [search, setSearch] = useState('');
  const [unread, setUnread] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [extra, setExtra] = useState<Record<string, DemoMessage[]>>({});
  const [reviewed, setReviewed] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [older, setOlder] = useState(false);
  const [fieldError, setFieldError] = useState<string>();
  const contact = contacts.find(item => item.id === selected);
  const filtered = contacts.filter(item => (!unread || item.unread > 0) && `${item.name} ${item.phone}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const base: DemoMessage[] = contact?.id === 'ana' ? [1, 2, 3, 4, 5, 6].map((number, index) => ({
    id: `message-${number}`, body: t(`m${number}`), direction: index % 2 === 0 ? 'incoming' : 'outgoing',
    timestamp: `2026-10-04T12:${String(index * 2).padStart(2, '0')}:00Z`,
    state: index % 2 === 1 ? index === 5 ? 'delivered' : 'read' : undefined,
  })) : contact ? [
    { id: 'other-1', body: t(contact.preview), direction: 'incoming', timestamp: '2026-10-04T12:00:00Z' },
    { id: 'other-2', body: t('otherReply'), direction: 'outgoing', timestamp: '2026-10-04T12:02:00Z', state: 'read' },
  ] : [];
  const messages: DemoMessage[] = [
    ...(older ? [{ id: 'older', body: t('olderText'), direction: 'incoming' as const, timestamp: '2026-10-04T11:50:00Z' }] : []),
    ...base,
    ...(scene === 'states' ? [
      { id: 'failed', body: t('failedText'), direction: 'outgoing' as const, timestamp: '2026-10-04T12:12:00Z', state: 'failed' as const },
      { id: 'uncertain', body: t('uncertainText'), direction: 'outgoing' as const, timestamp: '2026-10-04T12:14:00Z', state: reviewed ? 'reviewed' as const : 'uncertain' as const },
    ] : []),
    ...(selected ? extra[selected] ?? [] : []),
  ];
  const reason = scene === 'read-only' ? 'readOnly' : scene === 'closed' ? 'windowClosed' :
    (scene === 'states' && !reviewed) || messages.some(item => item.state === 'pending') ? 'pendingHelp' : undefined;
  function draft(value: string) {
    if (!selected) return;
    setDrafts(current => ({ ...current, [selected]: value })); setFieldError(undefined);
  }
  function send(text?: string) {
    if (!selected || reason) return;
    const body = (text ?? drafts[selected] ?? '').trim();
    if (!body || body.length > 4096) { setFieldError(t('invalid')); return; }
    const message: DemoMessage = { id: crypto.randomUUID(), body, direction: 'outgoing', timestamp: '2026-10-04T12:20:00Z', state: 'pending' };
    setExtra(current => ({ ...current, [selected]: [...current[selected] ?? [], message] }));
    draft(''); notify({ id: `chat-library:send:${selected}`, kind: 'info', message: t('queuedNotice') });
  }
  function arrive() {
    if (!selected) return;
    const message: DemoMessage = { id: crypto.randomUUID(), body: t('arrivalText'), direction: 'incoming', timestamp: '2026-10-04T12:22:00Z' };
    setExtra(current => ({ ...current, [selected]: [...current[selected] ?? [], message] }));
  }
  function review() { setReviewed(true); setReviewOpen(false); notify({ id: 'chat-library:review', kind: 'info', message: t('reviewedNotice') }); }
  function changeScene(next: Scene) {
    dismissNotification('chat-library:load');
    setScene(next); setExtra({}); setDrafts({}); setReviewed(false); setOlder(false); setFieldError(undefined);
    if (next === 'error') notify({ id: 'chat-library:load', kind: 'error', message: t('errorNotice') });
  }
  return { scene, changeScene, selected, select: setSelected, search, setSearch, unread, setUnread, drafts,
    contact, filtered, messages, value: selected ? drafts[selected] ?? '' : '', draft, send, arrive, reason,
    reviewOpen, setReviewOpen, review, older, loadOlder: () => setOlder(true), fieldError };
}
export type Demo = ReturnType<typeof useDemo>;
