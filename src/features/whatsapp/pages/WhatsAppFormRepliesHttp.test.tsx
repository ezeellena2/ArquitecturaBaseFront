import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { whatsappFormsHttpBody, whatsappFormsHttpJson } from '@/test/fixtures/whatsappFormsHttp';
import { currentUser } from '@/test/mocks/handlers';
import { server } from '@/test/mocks/server';
import { renderRouteWithProviders } from '@/test/utils/renderWithProviders';
import { queryClient } from '@/shared/api/queryClient';
import type { Chats, Thread } from '../api/chat';

vi.mock('react-oidc-context', async () => ({ ...(await vi.importActual<typeof import('react-oidc-context')>('react-oidc-context')),
  useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: 't' } }) }));

for (const culture of ['es', 'en'] as const) describe('received forms in real pages with captured HTTP ' + culture, () => {
  let threadName: string;
  function install(name: string) {
    threadName = name;
    const thread = whatsappFormsHttpJson<Thread>(culture, name);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(thread.contact.lastInboundAtUtc));
    server.use(
      http.get('/api/me', () => HttpResponse.json({ ...currentUser, permissions: ['whatsapp.read', 'formrecords.read'] })),
      http.get('/api/whatsapp/chats', () => HttpResponse.json({ page: { items: [thread.contact], page: 1, pageSize: 20, totalPages: 1, totalCount: 1 }, allCount: 1, unreadCount: 0 })),
      http.get('/api/whatsapp/chats/:id/messages', ({ request }) => {
        const older = threadName === 'reply-latest-page' && new URL(request.url).searchParams.has('beforeId');
        return new HttpResponse(whatsappFormsHttpBody(culture, older ? 'reply-older-page' : threadName), { headers: { 'Content-Type': 'application/json' } });
      }),
      http.put('/api/whatsapp/chats/:id/read', () => new HttpResponse(null, { status: 204 })),
    );
    return thread;
  }
  async function open(name: string) {
    const thread = install(name);
    const view = renderRouteWithProviders('/whatsapp/chat');
    await userEvent.click(await screen.findByRole('button', { name: thread.contact.profileName! }));
    await screen.findByLabelText('Respuesta al cliente');
    return view;
  }
  const saved = () => screen.findByRole('group', { name: 'Respuesta del formulario ' + (culture === 'es' ? 'Visita de prueba' : 'Test visit') + ', guardada como VIS-000024' });
  async function expand() {
    const card = await saved();
    await userEvent.click(within(card).getByRole('button', { name: 'Ver las 6 respuestas' }));
    return card;
  }
  beforeEach(() => queryClient.clear());
  afterEach(() => { queryClient.clear(); vi.useRealTimers(); vi.restoreAllMocks(); });
  it.each(['reply-completed', 'reply-reloaded'])('presents every exact answer from %s without a catalog lookup', async name => {
    await open(name);
    const card = await expand();
    expect(within(card).getByText('Equipo de prueba')).toBeInTheDocument();
    expect(within(card).getByText('Sin respuesta')).toBeInTheDocument();
    expect(within(card).getByText('12.345.678.901.234.567.890,12345678')).toBeInTheDocument();
    expect(within(card).getByText('11/10/2026')).toBeInTheDocument();
    expect(within(card).getByText('No')).toBeInTheDocument();
    expect(within(card).getByText(culture === 'es' ? 'Preventiva' : 'Preventive')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Usar este texto en el borrador' })).not.toBeInTheDocument();
  });
  it('honors a denied server read even when the current user still lists the permission', async () => {
    await open('reply-without-read');
    const card = await saved();
    expect(within(card).getByText('No tenés permiso para ver las respuestas de este formulario.')).toBeInTheDocument();
    expect(screen.queryByText('Equipo de prueba')).not.toBeInTheDocument();
    expect(within(card).queryByRole('button', { name: 'Ver las 6 respuestas' })).not.toBeInTheDocument();
  });
  it('retires expanded answers from DOM and cache on an authoritative captured denial', async () => {
    await open('reply-completed');
    await expand();
    threadName = 'reply-without-read';
    await queryClient.invalidateQueries({ queryKey: ['whatsapp-chat'] });
    await screen.findByText('Ya no tenés permiso para ver estas respuestas.');
    expect(screen.queryByText('Equipo de prueba')).not.toBeInTheDocument();
    expect(screen.queryByText('12.345.678.901.234.567.890,12345678')).not.toBeInTheDocument();
    await waitFor(() => expect(JSON.stringify(queryClient.getQueryCache().findAll({ queryKey: ['whatsapp-chat'] }).map(query => query.state.data))).not.toContain('Equipo de prueba'));
    expect(await saved()).toBeInTheDocument();
  });
  it('prepends the actual older page while preserving the pending response', async () => {
    await open('reply-latest-page');
    await screen.findByText('Llegó una respuesta de formulario. La estamos guardando…');
    expect(screen.queryByText('Llegó una respuesta de formulario que no pudimos relacionar con un envío. No se guardó.')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cargar mensajes anteriores' }));
    expect(await screen.findByText('Llegó una respuesta de formulario que no pudimos relacionar con un envío. No se guardó.')).toBeInTheDocument();
    expect(screen.getByText('No pudimos guardar la respuesta del formulario. Podés escribirle o mandárselo de nuevo.')).toBeInTheDocument();
    expect(screen.getByText('Llegó una respuesta de formulario. La estamos guardando…')).toBeInTheDocument();
    expect(screen.queryByText(/Guardada como/)).not.toBeInTheDocument();
  });
  it('shows captured processing states with no invented saved status', async () => {
    await open('reply-all-states');
    expect(await saved()).toBeInTheDocument();
    expect(screen.getByText('Llegó una respuesta de formulario. La estamos guardando…')).toBeInTheDocument();
    expect(screen.getByText('No pudimos guardar la respuesta del formulario. Podés escribirle o mandárselo de nuevo.')).toBeInTheDocument();
    expect(screen.getByText('Llegó una respuesta de formulario que no pudimos relacionar con un envío. No se guardó.')).toBeInTheDocument();
    expect(screen.getAllByText('Guardada como VIS-000024')).toHaveLength(1);
  });
  it.each(['reply-inbox-read', 'reply-inbox-without-read'])('uses the fixed server preview from actual inbox %s', async inboxName => {
    const allowed = inboxName === 'reply-inbox-read';
    const thread = install(allowed ? 'reply-completed' : 'reply-without-read');
    const inbox = whatsappFormsHttpJson<Chats>(culture, inboxName);
    const matching = inbox.page.items.filter(item => item.profileName === thread.contact.profileName);
    const contactIndex = matching.findIndex(item => item.id === thread.contact.id);
    const summary = culture === 'es' ? 'Respuesta del formulario' : 'Form response';
    expect(contactIndex).toBeGreaterThanOrEqual(0);
    expect(matching[contactIndex]!.preview).toBe(summary);
    expect(thread.contact.preview).toBe(summary);
    server.use(
      http.get('/api/me', () => HttpResponse.json({ ...currentUser, permissions: allowed ? ['whatsapp.read', 'formrecords.read'] : ['whatsapp.read'] })),
      http.get('/api/whatsapp/chats', () => new HttpResponse(whatsappFormsHttpBody(culture, inboxName), { headers: { 'Content-Type': 'application/json' } })),
    );
    renderRouteWithProviders('/whatsapp/chat');
    const contacts = await screen.findAllByRole('button', { name: thread.contact.profileName! });
    expect(contacts).toHaveLength(matching.length);
    const target = contacts[contactIndex]!;
    const row = target.parentElement!;
    expect(within(row).getByText(summary, { exact: true })).toBeInTheDocument();
    expect(row).not.toHaveTextContent('Equipo de prueba');
    expect(row).not.toHaveTextContent('12345678901234567890.12345678');
    expect(row).not.toHaveTextContent('Visita de prueba');
    expect(row).not.toHaveTextContent('Test visit');
    await userEvent.click(target);
    await screen.findByLabelText('Respuesta al cliente');
    const card = await saved();
    if (!allowed) {
      expect(within(card).getByText('No tenés permiso para ver las respuestas de este formulario.')).toBeInTheDocument();
      expect(screen.queryByText('Equipo de prueba')).not.toBeInTheDocument();
    }
  });
});
