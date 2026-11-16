import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { ApiError } from "@/shared/api/ApiError";
import type { FormEntry } from "../api/entries";
import type { EntryDraft } from "../entryForm";
import { useFormEntrySubmit } from "./useFormEntry";

const submitFormEntry = vi.fn();
vi.mock("../api/entries", async importOriginal => ({ ...(await importOriginal<object>()), submitFormEntry: (...args: unknown[]) => submitFormEntry(...args) }));
vi.mock("../entryForm", async importOriginal => ({
  ...(await importOriginal<object>()),
  entrySignature: () => "same",
  toEntrySend: (_entry: unknown, _draft: unknown, requestId: string) => ({ requestId }),
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ i18n: { language: "es" } }) }));

const entry = {} as FormEntry, draft = {} as EntryDraft;
const ids = () => submitFormEntry.mock.calls.map(call => (call[1] as { requestId: string }).requestId);

beforeEach(() => submitFormEntry.mockReset());

it("keeps the request id after a cut, and makes another one after a 400 that names no question", async () => {
  submitFormEntry.mockRejectedValueOnce(new ApiError(0, {}, true))
    .mockRejectedValueOnce(new ApiError(400, { code: "Forms.Record.InvalidResponse" }))
    .mockResolvedValue({});
  const { result } = renderHook(() => useFormEntrySubmit("form"));
  await act(async () => { await result.current.submit(entry, draft).catch(() => undefined); });
  await act(async () => { await result.current.submit(entry, draft).catch(() => undefined); });
  await act(async () => { await result.current.submit(entry, draft); });
  const [first, second, third] = ids();
  expect(second).toBe(first);
  expect(third).not.toBe(second);
});

it("keeps the request id after a 400 that names a question", async () => {
  submitFormEntry.mockRejectedValueOnce(new ApiError(400, { code: "Forms.Record.InvalidResponse", errors: { "answers.x": ["no"] } })).mockResolvedValue({});
  const { result } = renderHook(() => useFormEntrySubmit("form"));
  await act(async () => { await result.current.submit(entry, draft).catch(() => undefined); });
  await act(async () => { await result.current.submit(entry, draft); });
  const [first, second] = ids();
  expect(second).toBe(first);
});
