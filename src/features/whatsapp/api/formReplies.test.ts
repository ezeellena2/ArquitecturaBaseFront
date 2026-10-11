import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/mocks/server';
import { getThread } from './chat';

// Simulated agreed projection, never a captured producer response.
const id = '01a120d4-1415-7ca1-a73d-cabbfa72e695';
const otherId = '01a120d3-7f84-7471-ae4f-fa71986768f5';
function completed(values: unknown = [{ fieldId: id, key: 'notes', type: 'longText', label: 'Historical notes', value: '  private entered text\n' }]) {
  return { state: 'Completed', definitionId: id, versionId: otherId, versionNumber: 2, name: 'Historical form',
    recordId: id, number: 'VIS-000001', values };
}
function install(reply: unknown, allow = true) {
  server.use(http.get('/api/whatsapp/chats/' + id + '/messages', () => HttpResponse.json({
    canReadFormRecords: allow,
    contact: { id, profileName: 'Recipient', phoneNumber: null, mode: 'Manual', modeRevision: 1, lastInboundAtUtc: '2026-10-11T12:00:00Z', lastInboundSequence: 1, unreadCount: 0, preview: null },
    messages: [{ id, direction: 'Inbound', kind: 'FlowReply', body: 'private raw reply body', occurredAtUtc: '2026-10-11T12:00:00Z', inboundSequence: 1, operatorUserId: null, status: null, errorCode: null, purpose: 'Business', formReply: reply }],
    outgoing: [], beforeAtUtc: null, beforeId: null,
  })));
}
describe('simulated form reply HTTP projection', () => {
  it('drops values and raw body before returning a server-denied response, without validating private values', async () => {
    install(completed({ malformed: 'private response payload' }), false);
    const result = await getThread(id);
    expect(result.messages[0].body).toBeNull();
    expect(result.messages[0].formReply).toEqual(completed(null));
    expect(JSON.stringify(result)).not.toContain('private');
  });
  it('preserves canonical tiny decimal, false, absence, calendar day and historical choice without trimming entered text', async () => {
    const rows = [
      { fieldId: id, key: 'notes', type: 'longText', label: 'Historical notes', value: '  Entered English text\n' },
      { fieldId: otherId, key: 'amount', type: 'decimal', label: 'Historical amount', value: '0.0000000000000000000000000001' },
      { fieldId: '01a125cf-b2a7-70ee-b027-9a7e8e4c4031', key: 'confirmed', type: 'boolean', label: 'Historical confirmation', value: false },
      { fieldId: '01a126ba-327a-7d80-9fa6-b5a6b5e7733c', key: 'date', type: 'date', label: 'Historical day', value: '2026-10-08' },
      { fieldId: '01a10cf6-23c4-7641-b084-a486091df430', key: 'choice', type: 'choice', label: 'Historical choice', value: { choiceId: id, label: 'Retired choice label' } },
      { fieldId: '01a11b83-6aec-7031-836b-a9592b396409', key: 'optional', type: 'shortText', label: 'Optional historical text', value: null },
    ];
    install(completed(rows));
    const result = await getThread(id);
    expect(result.messages[0].body).toBeNull();
    expect(result.messages[0].formReply).toEqual(completed(rows));
  });
  it.each([
    completed([{ fieldId: id, key: 'amount', type: 'decimal', label: 'Amount', value: 0 }]),
    completed([{ fieldId: id, key: 'amount', type: 'decimal', label: 'Amount', value: '1E-28' }]),
    completed([{ fieldId: id, key: 'date', type: 'date', label: 'Day', value: '2026-02-30' }]),
    completed([{ fieldId: id, key: 'choice', type: 'choice', label: 'Choice', value: 'private fabricated label' }]),
    { ...completed(), number: 1 },
    { ...completed(), number: 'VIS-9223372036854775808' },
    { ...completed(), number: '1' },
    { ...completed(), prefix: 'VIS' },
    { ...completed(), number: null },
    { ...completed(), state: 'Pending' },
  ])('returns a metadata-free fallback for an invalid projection without errors or private payload %#', async reply => {
    install(reply);
    const result = await getThread(id);
    expect(result.messages[0].formReply).toBeNull();
    expect(result.messages[0].body).toBeNull();
    expect(JSON.stringify(result)).not.toContain('private');
  });
  it.each(['Pending', 'Rejected'])('preserves %s with unavailable historical metadata', async state => {
    const reply = { state, definitionId: null, versionId: null, versionNumber: null, name: null,
      recordId: null, number: null, values: null };
    install(reply);
    expect((await getThread(id)).messages[0].formReply).toEqual(reply);
  });
  it.each(['Pending', 'Rejected', 'Unrecognized'])('preserves durable %s without inventing a record or answers', async state => {
    const reply = { state, definitionId: state === 'Unrecognized' ? null : id, versionId: state === 'Unrecognized' ? null : otherId,
      versionNumber: state === 'Unrecognized' ? null : 2, name: state === 'Unrecognized' ? null : 'Historical form',
      recordId: null, number: null, values: null };
    install(reply);
    expect((await getThread(id)).messages[0].formReply).toEqual(reply);
  });
});
