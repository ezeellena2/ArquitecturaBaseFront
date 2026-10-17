import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../api/chat';
import type { FormReply } from '../api/formReplies';
import { buildTimeline } from './timeline';

const completed: FormReply = { state: 'Completed', definitionId: 'historical-definition', versionId: 'historical-version', versionNumber: 1,
  name: 'Historical English form', recordId: 'record-a', number: 'VIS-000024', values: [
    { fieldId: 'old-choice', key: 'client', type: 'choice', label: 'Historical client', value: { choiceId: 'retired-choice', label: 'Retired English choice' } },
    { fieldId: 'bool', key: 'confirmed', type: 'boolean', label: 'Confirmed?', value: false },
    { fieldId: 'zero', key: 'returned', type: 'decimal', label: 'Returned', value: '0' },
    { fieldId: 'none', key: 'optional', type: 'shortText', label: 'Optional', value: null },
  ] };
function message(reply: FormReply, kind = 'FlowReply', purpose: ChatMessage['purpose'] = 'Business'): ChatMessage {
  return { origin: "Conversation" as const, id: 'message-a', direction: 'Inbound', kind, body: 'Opaque source body', occurredAtUtc: '2026-10-11T12:00:00Z',
    inboundSequence: 1, operatorUserId: null, status: null, errorCode: null, purpose, formReply: reply };
}
const presentation = (input: ChatMessage) => (buildTimeline([input], [])[0] as unknown as { formReply: unknown }).formReply;
describe('historical form reply timeline adapter', () => {
  it('maps the saved historical values without current catalog or culture lookup', () => {
    const result = buildTimeline([message(completed)], []);
    expect(result[0].body).toBeNull();
    expect(presentation(message(completed))).toEqual({ state: 'Completed', name: 'Historical English form', recordNumber: 'VIS-000024', recordId:'record-a', values: [
      { id: 'old-choice', label: 'Historical client', answer: { type: 'choice', value: 'Retired English choice' } },
      { id: 'bool', label: 'Confirmed?', answer: { type: 'boolean', value: false } },
      { id: 'zero', label: 'Returned', answer: { type: 'decimal', value: '0' } },
      { id: 'none', label: 'Optional', answer: { type: 'shortText', value: null } },
    ] });
  });
  it('preserves a denied receipt and every digit beyond the minimum six without numeric conversion', () => {
    expect(presentation(message({ ...completed, number: 'VISLONGNAME1-9223372036854775807', values: null }))).toEqual({
      state: 'Completed', name: 'Historical English form', recordNumber: 'VISLONGNAME1-9223372036854775807', recordId:'record-a', values: null,
    });
  });
  it.each(['Pending', 'Rejected', 'Unrecognized'] as const)('maps %s without a saved number or invented values', state => {
    const reply: FormReply = state === 'Unrecognized'
      ? { state, definitionId: null, versionId: null, versionNumber: null, name: null, recordId: null, number: null, values: null }
      : { state, definitionId: 'historical-definition', versionId: 'historical-version', versionNumber: 1, name: 'Historical English form', recordId: null, number: null, values: null };
    expect(presentation(message(reply))).toEqual({ state, name: reply.name });
  });
  it('does not infer a form reply from text or override Access', () => {
    expect(presentation(message(completed, 'Text'))).toBeNull();
    expect(presentation(message(completed, 'FlowReply', 'Access'))).toBeNull();
  });
});
