import type { Chats, Thread } from '@/features/whatsapp/api/chat';
import type { CurrentUser } from '@/auth/useCurrentUser';

// Decorador exclusivo del arnés: los providers y hooks siguen siendo los reales.
export function installShapeFixtures(language: 'es' | 'en', scenario: string | null) {
  const fixtureFetch = globalThis.fetch;
  const offset = Date.now() - (scenario === 'closed' ? 25 * 60 * 60_000 : 10 * 60_000) - Date.parse('2026-10-02T12:00:00Z');
  const shift = (value: string) => new Date(Date.parse(value) + offset).toISOString();
  const readContacts = new Set<string>();
  const requestContacts = new Map<string, string>();
  const english = language === 'en';
  const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
  globalThis.fetch = async (input, init) => {
    const request = new Request(input instanceof Request ? input : new URL(String(input), location.origin), init);
    const url = new URL(request.url);
    if (url.origin !== location.origin) throw new Error('External requests are unavailable in the chat shape preview');
    const path = url.pathname;
    const contactId = path.split('/')[4];
    if (path.startsWith('/api/whatsapp/chats/')) {
      if (request.method === 'POST' && path.endsWith('/messages')) {
        const body = await request.clone().json() as { requestId: string };
        requestContacts.set(body.requestId, contactId);
      }
      if (request.method === 'PUT' && path.endsWith('/read')) readContacts.add(contactId);
    }
    if (scenario === 'loading' && path === '/api/whatsapp/chats') return new Promise<Response>(() => {});
    const response = await fixtureFetch(request);
    if (!response.headers.get('Content-Type')?.includes('application/json')) return response;
    if (path === '/api/me' && scenario === 'read-only') {
      const profile = await response.json() as CurrentUser;
      return json({ ...profile, permissions: profile.permissions.filter(permission => permission !== 'whatsapp.send') });
    }
    if (!path.startsWith('/api/whatsapp/chats')) return response;
    if (path === '/api/whatsapp/chats') {
      const list = await response.json() as Chats;
      const contacts = list.page.items.map(contact => ({ ...contact, lastInboundAtUtc: shift(contact.lastInboundAtUtc), unreadCount: readContacts.has(contact.id) ? 0 : contact.unreadCount }));
      const search = (url.searchParams.get('search') ?? '').toLocaleLowerCase(language);
      const items = scenario === 'empty' ? [] : contacts.filter(contact => `${contact.profileName} ${contact.phoneNumber}`.toLocaleLowerCase(language).includes(search) && (url.searchParams.get('unreadOnly') !== 'true' || contact.unreadCount > 0));
      return json({ ...list, allCount: scenario === 'empty' ? 0 : contacts.length, unreadCount: contacts.filter(contact => contact.unreadCount > 0).length,
        page: { ...list.page, items, totalCount: items.length, totalPages: items.length ? 1 : 0 } });
    }
    if (request.method === 'GET' && path.endsWith('/messages')) {
      const thread = await response.json() as Thread;
      if (contactId === 'chat-luis') {
        thread.contact = { ...thread.contact, id: contactId, profileName: 'Luis Pérez', phoneNumber: '+54 9 351 555-4321', unreadCount: 0 };
        thread.messages = thread.messages.slice(0, 2).map((message, index) => ({ ...message, id: `luis-${index}`, body: index === 0 ? english ? 'Thank you for the information.' : 'Gracias por la información.' : english ? 'You are welcome, Luis.' : 'De nada, Luis.' }));
      } else if (!scenario || ['conversation', 'read-only', 'closed'].includes(scenario)) {
        const incoming = thread.messages[0];
        const outgoing = thread.messages[1];
        thread.messages = [
          { ...incoming, body: english ? 'Can we arrange the order for tomorrow?' : '¿Podemos coordinar el pedido para mañana?' },
          { ...outgoing, body: english ? 'Hi Ana, yes. What time works for you?' : 'Hola Ana, sí. Decime qué horario te queda cómodo.' },
          { ...incoming, id: 'shape-message-3', body: english ? 'Around 17 works for me.\nCan I pick it up at the store?' : 'A las 17 me queda bien.\n¿Puedo pasar a retirarlo por el local?', occurredAtUtc: '2026-10-02T12:04:00Z', inboundSequence: 2 },
          { ...outgoing, id: 'shape-message-4', body: english ? 'Of course. We will have it ready for you.' : 'Sí, claro. Te lo dejamos preparado para esa hora.', occurredAtUtc: '2026-10-02T12:06:00Z', status: 'Read' },
          { ...incoming, id: 'shape-message-5', body: english ? 'Great, thank you!' : '¡Dale, muchas gracias!', occurredAtUtc: '2026-10-02T12:08:00Z', inboundSequence: 3 },
          { ...outgoing, id: 'shape-message-6', body: english ? 'See you tomorrow, Ana.' : 'Nos vemos mañana, Ana.', occurredAtUtc: '2026-10-02T12:09:00Z', status: 'Sent' },
        ];
        thread.contact = { ...thread.contact, lastInboundSequence: 3, lastInboundAtUtc: '2026-10-02T12:08:00Z' };
      }
      return json({ ...thread, contact: { ...thread.contact, lastInboundAtUtc: scenario === 'closed' ? new Date(Date.now() - 25 * 60 * 60_000).toISOString() : shift(thread.contact.lastInboundAtUtc) },
        messages: thread.messages.map(message => ({ ...message, occurredAtUtc: shift(message.occurredAtUtc) })),
        outgoing: thread.outgoing.filter(item => (requestContacts.get(item.requestId) ?? 'chat-ana') === contactId).map(item => ({ ...item, requestedAtUtc: shift(item.requestedAtUtc) })),
        beforeAtUtc: thread.beforeAtUtc ? shift(thread.beforeAtUtc) : null });
    }
    return response;
  };
}
