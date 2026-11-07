import { describe, expect, it } from 'vitest';
import { readFormReply } from './formReplies';

// Simulated agreed projection, never a captured producer response.
const id = (n: number) => '01990000-0000-7000-8000-' + String(n).padStart(12, '0');
const answer = (n: number, type: string, label: string, value: unknown) => ({ fieldId: id(n), key: 'field_' + n, type, label, value });
const completed = (block: unknown) => ({ state: 'Completed', definitionId: id(90), versionId: id(91), versionNumber: 1, name: 'Recepción',
  recordId: id(92), number: 'REC-000001', values: [answer(1, 'shortText', 'Proveedor', 'Proveedor del norte'), block] });
const item = (quantity: string | null) => ({ values: [answer(3, 'choice', 'Artículo', { choiceId: id(20), label: 'GLIFOSATO 64%' }),
  answer(4, 'decimal', 'Cantidad', quantity), answer(5, 'boolean', '¿Llegó bien?', true)] });

describe('a reply with a block of rows', () => {
  it('reads the block with its items, and a block without items', () => {
    const reply = readFormReply(completed(answer(2, 'group', 'Artículos', [item('200'), item(null)])), true);

    expect(reply?.state).toBe('Completed');
    const block = reply?.state === 'Completed' ? reply.values?.[1] : undefined;
    expect(block?.type).toBe('group');
    expect(block?.type === 'group' ? block.value.map(row => row.values[1].value) : []).toEqual(['200', null]);
    expect(readFormReply(completed(answer(2, 'group', 'Artículos', [])), true)?.state).toBe('Completed');
  });

  it.each([
    ['an item with a question that does not go in a block', () => completed(answer(2, 'group', 'Artículos', [{ values: [answer(3, 'photo', 'Foto', [])] }]))],
    ['a block that is not a list of items', () => completed(answer(2, 'group', 'Artículos', '3'))],
    ['an item that repeats a question', () => completed(answer(2, 'group', 'Artículos', [{ values: [answer(4, 'decimal', 'Cantidad', '1'), answer(4, 'decimal', 'Cantidad', '2')] }]))],
  ])('rejects %s', (_, body) => expect(readFormReply(body(), true)).toBeNull());
});
