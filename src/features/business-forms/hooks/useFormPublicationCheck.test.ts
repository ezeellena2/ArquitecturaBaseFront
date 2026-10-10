import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkFormPublication } from "../api/forms";
import { fixtureDefinition } from "@/test/visual/formFixtures";
import { openDraftSession } from "../draftSession";
import { useFormPublicationCheck } from "./useFormPublicationCheck";
vi.mock("../api/forms", () => ({ checkFormPublication: vi.fn() }));
const definition = fixtureDefinition();
const body = { ...openDraftSession({ actorId: "a", editorId: "check" }, definition).value, expectedRevision: definition.revision };
const scope = { actorId: "a", culture: "es" as const, permissions: ["formtemplates.read", "formtemplates.publish"] };
const checked = { definitionId: definition.id, draftRevision: 1, compatibility: "LocallyValidated" as const, canAccept: false as const,
  acceptanceAvailability: "Unavailable" as const, checkToken: null, checkExpiresAtUtc: null, channels: [], issues: [], diff: { baseVersionId: null, added: [], changed: [], removed: [] } };
beforeEach(() => { vi.mocked(checkFormPublication).mockReset(); });
describe("owned publication check", () => {
  it("checks only after an explicit action and needs no Manage permission", async () => {
    vi.mocked(checkFormPublication).mockResolvedValue(checked);
    const { result } = renderHook(() => useFormPublicationCheck(scope));
    expect(checkFormPublication).not.toHaveBeenCalled();
    await act(() => result.current.check(definition.id, body));
    expect(result.current.result).toEqual(checked);
    expect(checkFormPublication).toHaveBeenCalledTimes(1);
  });
  it("does not retry a failed check automatically", async () => {
    vi.mocked(checkFormPublication).mockRejectedValue(new Error("Unavailable."));
    const { result } = renderHook(() => useFormPublicationCheck(scope));
    await act(() => result.current.check(definition.id, body));
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.busy).toBe(false);
    expect(checkFormPublication).toHaveBeenCalledTimes(1);
  });
  it("suppresses duplicate checks and cancels the read on teardown", async () => {
    let signal: AbortSignal | undefined;
    vi.mocked(checkFormPublication).mockImplementation((_id, _body, currentSignal) => { signal = currentSignal; return new Promise(() => {}); });
    const { result, unmount } = renderHook(() => useFormPublicationCheck(scope));
    act(() => { void result.current.check(definition.id, body); void result.current.check(definition.id, body); });
    expect(checkFormPublication).toHaveBeenCalledTimes(1);
    unmount();
    expect(signal?.aborted).toBe(true);
  });
  it("drops results from another actor even if the transport ignores cancellation", async () => {
    let resolve: (value: typeof checked) => void = () => {};
    vi.mocked(checkFormPublication).mockImplementation(() => new Promise(done => { resolve = done; }));
    const { result, rerender } = renderHook(({ actorId }) => useFormPublicationCheck({ ...scope, actorId }), { initialProps: { actorId: "a" } });
    act(() => { void result.current.check(definition.id, body); });
    rerender({ actorId: "b" });
    await act(async () => resolve(checked));
    await waitFor(() => expect(result.current.result).toBeNull());
    expect(result.current.error).toBeNull();
  });
  it.each(["formtemplates.read", "formtemplates.publish"])("requires %s before sending private content", async permission => {
    const { result } = renderHook(() => useFormPublicationCheck({ ...scope, permissions: scope.permissions.filter(p => p !== permission) }));
    await act(() => result.current.check(definition.id, body));
    expect(checkFormPublication).not.toHaveBeenCalled();
  });
});
