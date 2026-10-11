import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { whatsappFormsHttpBody, whatsappFormsHttpJson } from '@/test/fixtures/whatsappFormsHttp';
import { server } from '@/test/mocks/server';
import { getThread, type Thread } from './chat';
import { buildTimeline } from '../lib/timeline';

// Raw controller captures from a green producer; neutral ports do not prove typed form persistence.
for (const culture of ['es', 'en'] as const) describe('actual received form HTTP ' + culture, () => {
  async function read(name: string) {
    const original = whatsappFormsHttpJson<Thread>(culture, name);
    server.use(http.get('/api/whatsapp/chats/:id/messages', () => new HttpResponse(whatsappFormsHttpBody(culture, name), {
      headers: { 'Content-Type': 'application/json' },
    })));
    return { original, parsed: await getThread(original.contact.id) };
  }
  it('preserves every historical typed value through the productive HTTP guard and timeline', async () => {
    const { original, parsed } = await read('reply-completed');
    const originalReply = original.messages.find(message => message.kind === 'FlowReply')!.formReply!;
    const reply = parsed.messages.find(message => message.kind === 'FlowReply')!.formReply!;
    expect(reply).toEqual(originalReply);
    expect(reply.state).toBe('Completed');
    if (reply.state !== 'Completed') throw new Error('The captured completed reply was discarded.');
    expect(reply.number).toBe('VIS-000024');
    expect(reply.values!.map(row => row.type)).toEqual(['shortText', 'longText', 'decimal', 'date', 'boolean', 'choice']);
    expect(reply.values!.map(row => row.value)).toEqual(['Equipo de prueba', null, '12345678901234567890.12345678',
      '2026-10-11', false, expect.objectContaining({ label: culture === 'es' ? 'Preventiva' : 'Preventive' })]);
    const item = buildTimeline(parsed.messages, parsed.outgoing).find(row => row.kind === 'FlowReply')!;
    expect(item.body).toBeNull();
    expect(item.formReply).toMatchObject({ state: 'Completed', name: originalReply.name, recordNumber: originalReply.number });
  });
  it('restores the exact historical reply after a fresh HTTP read', async () => {
    const first = await read('reply-completed');
    const reloaded = await read('reply-reloaded');
    expect(reloaded.parsed.messages.find(row => row.kind === 'FlowReply')!.formReply)
      .toEqual(first.parsed.messages.find(row => row.kind === 'FlowReply')!.formReply);
  });
  it('keeps the server-denied receipt and never returns questions or values', async () => {
    const { parsed } = await read('reply-without-read');
    expect(parsed.canReadFormRecords).toBe(false);
    const reply = parsed.messages.find(row => row.kind === 'FlowReply')!.formReply!;
    expect(reply).toMatchObject({ state: 'Completed', number: 'VIS-000024', values: null });
    expect(JSON.stringify(parsed)).not.toContain('Equipo de prueba');
    expect(JSON.stringify(parsed)).not.toContain('12345678901234567890.12345678');
  });
  it('consumes an actual older page using the exact cursor returned by the latest page', async () => {
    const latest = whatsappFormsHttpJson<Thread>(culture, 'reply-latest-page');
    const older = whatsappFormsHttpJson<Thread>(culture, 'reply-older-page');
    const cursors: Array<{ at: string | null; id: string | null }> = [];
    server.use(http.get('/api/whatsapp/chats/:id/messages', ({ request }) => {
      const query = new URL(request.url).searchParams;
      const cursor = { at: query.get('beforeAtUtc'), id: query.get('beforeId') };
      cursors.push(cursor);
      return new HttpResponse(whatsappFormsHttpBody(culture, cursor.id ? 'reply-older-page' : 'reply-latest-page'), {
        headers: { 'Content-Type': 'application/json' },
      });
    }));
    const first = await getThread(latest.contact.id);
    const second = await getThread(latest.contact.id, { at: first.beforeAtUtc!, id: first.beforeId! });
    expect(cursors).toEqual([{ at: null, id: null }, { at: latest.beforeAtUtc, id: latest.beforeId }]);
    expect(first.messages.map(row => row.id)).toEqual(latest.messages.map(row => row.id));
    expect(second.messages.map(row => row.id)).toEqual(older.messages.map(row => row.id));
    expect(first.messages.some(row => second.messages.some(previous => previous.id === row.id))).toBe(false);
    expect(buildTimeline([...second.messages, ...first.messages], []).filter(row => row.kind === 'FlowReply').map(row => row.formReply!.state).sort())
      .toEqual(['Pending', 'Rejected', 'Unrecognized']);
  });
  it('preserves all processing states without fabricated receipts', async () => {
    const { parsed } = await read('reply-all-states');
    const replies = parsed.messages.filter(row => row.kind === 'FlowReply').map(row => row.formReply!);
    expect(replies.map(row => row.state).sort()).toEqual(['Completed', 'Pending', 'Rejected', 'Unrecognized']);
    for (const reply of replies.filter(row => row.state !== 'Completed')) {
      expect(reply).toMatchObject({ recordId: null, number: null, values: null });
    }
    expect(replies.find(row => row.state === 'Unrecognized')).toMatchObject({ definitionId: null, versionId: null, versionNumber: null, name: null });
  });
});
