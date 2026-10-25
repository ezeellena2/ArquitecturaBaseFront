import { fixtureLifecycle } from "@/test/visual/formFixtures";
import { StrictMode, useState, type PropsWithChildren } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/mocks/server";
import { createQueryClient } from "@/shared/api/queryClient";
import { useFormDraftEditor } from "./useFormDraftEditor";
import { useFormDefinitions, useFormDefinition } from "./useFormQueries";
import type { DraftEditorValue } from "../model";
import { readFormDetail } from "../api/response";
import type { FormReadScope } from "./useFormQueries";

const id = "01990000-0000-7000-8000-000000000001";
const fieldId = "01990000-0000-7000-8000-000000000003";
const secondId = "01990000-0000-7000-8000-000000000004";
const choiceId = "01990000-0000-7000-8000-000000000005";
const secondChoiceId = "01990000-0000-7000-8000-000000000006";
const audit = { createdAtUtc: "2026-10-09T12:00:00Z", modifiedAtUtc: null, lastChangedAtUtc: "2026-10-09T12:00:00Z", lastChangedBy: null };
const initial: DraftEditorValue = { offerWhen: null, name: { es: "Encuesta" }, prefix: "ENC", draft: { format: 1, culture: "es", submitLabel: { es: "Enviar", en: "Submit" }, fields: [
  { localId: "q", fieldId: null, replacesFieldId: null, type: "longText", label: { es: "Opinión", en: "Opinion" }, help: { es: null, en: "Details" }, required: false, maxLength: null },
] } };
const scope: FormReadScope = { actorId: "actor-a", culture: "es", permissions: ["formtemplates.read", "formtemplates.manage"] };
const key = (value: string) => `field_${value.replaceAll("-", "")}`;
function receipt(requestId: string, revision = 1) {
  return { requestId, definition: { offerWhen: null, id, name: { es: "Encuesta" }, prefix: "ENC", prefixLocked: false, revision,
    draft: { ...initial.draft, fields: [{ fieldId, key: key(fieldId), type: "longText" as const, label: initial.draft.fields[0]!.label,
      help: { en: "Details" }, required: false, maxLength: 600, options: null }] } },
    identityMap: { fields: [{ localId: "q", fieldId, key: key(fieldId), replacesFieldId: null }], choices: [] },
    recovery: { path: `/api/forms/draft-changes/${requestId}`, resultExpiresAtUtc: "2026-11-08T12:00:00Z" } };
}
function harness() {
  const client = createQueryClient();
  function Wrapper({ children }: PropsWithChildren) { return <QueryClientProvider client={client}>{children}</QueryClientProvider>; }
  return { client, wrapper: Wrapper };
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

describe("nonvisual form draft coordination", () => {
  it("requires explicit review decisions before adopting the current revision and never saves from review", async () => {
    const h = harness(); let writes = 0;
    const canonical = receipt("01990000-0000-7000-8000-000000000020", 2).definition;
    server.use(http.put(`/api/forms/definitions/${id}/draft`, () => { writes++; return HttpResponse.json({ code: "Forms.Draft.RevisionConflict" }, { status: 409 }); }),
      http.get(`/api/forms/definitions/${id}`, () => HttpResponse.json({ definition: { ...canonical, name: { es: "Current name" } }, lifecycle: fixtureLifecycle(2), capabilities: { canSave: true, canPublish: true, canPreview: false }, publication: { activeVersion: null, currentOperation: null, displayState: "Draft" }, audit })));
    const { result } = renderHook(() => useFormDraftEditor(scope, readFormDetail({ definition: { ...canonical, revision: 1 }, lifecycle: fixtureLifecycle(1), capabilities: { canSave: true, canPublish: true, canPreview: false }, publication: { activeVersion: null, currentOperation: null, displayState: "Draft" }, audit })), h);
    act(() => result.current.change({ ...result.current.session!.value, name: { es: "My name" } }));
    await act(() => result.current.save());
    await act(() => result.current.readCurrent());
    act(() => result.current.resolveReview({}));
    expect(result.current.canSave).toBe(false);
    act(() => result.current.resolveReview({ "name:es": "mine" }));
    expect(result.current.session?.value.name.es).toBe("My name");
    expect(result.current.session?.confirmed?.revision).toBe(2);
    expect(writes).toBe(1);
    expect(result.current.canSave).toBe(true);
  });
  it("applies a direct commit atomically without leaking the frozen draft into MutationCache", async () => {
    const h = harness(); let sent: unknown;
    server.use(http.post("/api/forms/definitions", async ({ request }) => { const body = await request.json() as { requestId: string }; sent = body; return HttpResponse.json(receipt(body.requestId), { status: 201 }); }));
    const { result } = renderHook(() => useFormDraftEditor(scope, initial), h);
    await act(() => result.current.save());
    expect(sent).toMatchObject({ name: { es: "Encuesta" }, draft: initial.draft });
    expect(result.current.session?.phase).toBe("Editing");
    expect(result.current.session?.pending).toBeNull();
    expect(result.current.session?.baseline.draft.fields[0]).toMatchObject({ localId: "q", fieldId, maxLength: 600, help: { en: "Details" } });
    expect(h.client.getMutationCache().getAll()).toEqual([]);
  });

  it.each(["network", "server", "cancel"])("retains the exact attempt after %s without retrying", async failure => {
    const h = harness(); const gate = deferred(); let calls = 0;
    server.use(http.post("/api/forms/definitions", async () => { calls++; if (failure === "cancel") await gate.promise; return failure === "network" ? HttpResponse.error() : HttpResponse.json({}, { status: 500 }); }));
    const { result } = renderHook(() => useFormDraftEditor(scope, initial), h);
    let operation!: Promise<unknown>;
    act(() => { operation = result.current.save(); });
    await waitFor(() => expect(calls).toBe(1));
    const pending = result.current.session?.pending;
    if (failure === "cancel") act(() => result.current.cancel());
    await act(async () => { gate.resolve(); await operation; });
    expect(result.current.session?.phase).toBe("Unconfirmed");
    expect(result.current.session?.pending).toBe(pending);
    await act(() => result.current.save());
    act(() => { result.current.change({ ...initial, name: { es: "Otra" } }); result.current.discard(); });
    expect(calls).toBe(1);
    expect(result.current.session?.pending).toBe(pending);
    expect(result.current.issue?.kind).not.toBe("cancelled");
    expect(h.client.getMutationCache().getAll()).toEqual([]);
  });

  it.each([[404, "Forms.Draft.ChangeNotFound", "missing"], [410, "Forms.Draft.ChangeExpired", "expired"]] as const)("keeps the UUID/body on recovery %s", async (status, code, kind) => {
    server.use(http.post("/api/forms/definitions", () => HttpResponse.error()), http.get("/api/forms/draft-changes/:requestId", () => HttpResponse.json({ code }, { status })));
    const { result } = renderHook(() => useFormDraftEditor(scope, initial), harness());
    await act(() => result.current.save()); const pending = result.current.session?.pending;
    await act(() => result.current.recover());
    expect(result.current.session?.pending).toBe(pending);
    expect(result.current.session?.phase).toBe("Unconfirmed");
    expect(result.current.issue?.kind).toBe(kind);
  });

  it("recovers the original snapshot/map and blocks overwrite when currentRevision is newer", async () => {
    server.use(http.post("/api/forms/definitions", () => HttpResponse.error()), http.get("/api/forms/draft-changes/:requestId", ({ params }) => {
      const requestId = String(params.requestId); return HttpResponse.json({ requestId, kind: "Create", status: "Committed", committedAtUtc: audit.createdAtUtc, currentRevision: 4, result: receipt(requestId) });
    }));
    const { result } = renderHook(() => useFormDraftEditor(scope, initial), harness());
    await act(() => result.current.save()); await act(() => result.current.recover());
    expect(result.current.session?.confirmed?.revision).toBe(1);
    expect(result.current.session?.currentRevision).toBe(4);
    expect(result.current.session?.phase).toBe("ReviewRequired");
    expect(result.current.canSave).toBe(false);
  });

  it("correlates identical option handles by their parent rather than response order", async () => {
    const value: DraftEditorValue = { ...initial, draft: { ...initial.draft, fields: ["q", "r"].map(localId => ({ ...initial.draft.fields[0]!, localId,
      type: "choice", source: null, options: [{ localId: "option", choiceId: null, label: { es: "Sí", en: "Yes" } }] })) } };
    server.use(http.post("/api/forms/definitions", async ({ request }) => {
      const { requestId } = await request.json() as { requestId: string };
      const result = receipt(requestId);
      return HttpResponse.json({ ...result, definition: { ...result.definition, draft: { ...value.draft, fields: [fieldId, secondId].map((fid, index) => ({ fieldId: fid, key: key(fid), type: "choice", label: value.draft.fields[index]!.label,
        help: { en: "Details" }, required: false, maxLength: null, options: [{ choiceId: index === 0 ? choiceId : secondChoiceId, label: { es: "Sí", en: "Yes" } }] })) } },
        identityMap: { fields: [fieldId, secondId].map((fid, index) => ({ localId: index === 0 ? "q" : "r", fieldId: fid, key: key(fid), replacesFieldId: null })),
          choices: [{ fieldLocalId: "r", localId: "option", fieldId: secondId, choiceId: secondChoiceId }, { fieldLocalId: "q", localId: "option", fieldId, choiceId }] } });
    }));
    const { result } = renderHook(() => useFormDraftEditor(scope, value), harness());
    await act(() => result.current.save());
    expect(result.current.session?.value.draft.fields).toMatchObject([{ localId: "q", options: [{ localId: "option", choiceId }] }, { localId: "r", options: [{ localId: "option", choiceId: secondChoiceId }] }]);
  });

  it.each(["actor", "read", "unmount"])("clears private data and ignores a late commit after %s changes", async change => {
    const h = harness(); const gate = deferred(); let received = false;
    server.use(http.post("/api/forms/definitions", async ({ request }) => { const { requestId } = await request.json() as { requestId: string }; received = true; await gate.promise; return HttpResponse.json(receipt(requestId)); }));
    const hook = renderHook(({ context }) => useFormDraftEditor(context, initial), { ...h, initialProps: { context: scope } });
    let operation!: Promise<unknown>;
    act(() => { operation = hook.result.current.save(); }); await waitFor(() => expect(received).toBe(true));
    if (change === "unmount") hook.unmount();
    else hook.rerender({ context: { ...scope, ...(change === "actor" ? { actorId: "actor-b" } : { permissions: [] }) } });
    await act(async () => { gate.resolve(); await operation; });
    if (change !== "unmount") expect(hook.result.current.session).toBeNull();
    expect(h.client.getQueryCache().getAll()).toEqual([]);
  });

  // Translating is changing the menu language and editing the same draft: the language is not part of its owner.
  it("keeps the draft and its save in flight when the menu language changes", async () => {
    const gate = deferred(); let received = false;
    server.use(http.post("/api/forms/definitions", async ({ request }) => { const { requestId } = await request.json() as { requestId: string }; received = true; await gate.promise; return HttpResponse.json(receipt(requestId)); }));
    const hook = renderHook(({ context }) => useFormDraftEditor(context, initial), { ...harness(), initialProps: { context: scope } });
    act(() => hook.result.current.change({ ...hook.result.current.session!.value, name: { es: "Encuesta", en: "Survey" } }));
    let operation!: Promise<unknown>;
    act(() => { operation = hook.result.current.save(); }); await waitFor(() => expect(received).toBe(true));
    hook.rerender({ context: { ...scope, culture: "en" } });
    expect(hook.result.current.session?.value.name).toEqual({ es: "Encuesta", en: "Survey" });
    await act(async () => { gate.resolve(); await operation; });
    expect(hook.result.current.session?.confirmed?.id).toBe(id);
    expect(hook.result.current.canSave).toBe(true);
  });

  it("revoking manage prevents new writes but allows the actor's pending recovery with read", async () => {
    server.use(http.post("/api/forms/definitions", () => HttpResponse.error()), http.get("/api/forms/draft-changes/:requestId", ({ params }) => {
      const requestId = String(params.requestId); return HttpResponse.json({ requestId, kind: "Create", status: "Committed", committedAtUtc: audit.createdAtUtc, currentRevision: 1, result: receipt(requestId) });
    }));
    const hook = renderHook(({ permissions }) => useFormDraftEditor({ ...scope, permissions }, initial), { ...harness(), initialProps: { permissions: scope.permissions } });
    await act(() => hook.result.current.save());
    hook.rerender({ permissions: ["formtemplates.read"] });
    expect(hook.result.current.canSave).toBe(false);
    await act(() => hook.result.current.recover());
    expect(hook.result.current.session?.confirmed?.revision).toBe(1);
    expect(hook.result.current.canSave).toBe(false);
  });

  it("maps backend validation paths to handles from the frozen request and keeps all translations", async () => {
    server.use(http.post("/api/forms/definitions", () => HttpResponse.json({ code: "Forms.Draft.IdentityInvalid", errors: {
      "draft.fields[0].label.es": ["Revisá la pregunta"], "draft.fields[0].help.en": ["Revisá la ayuda"], "prefix": ["Ya existe"], "draft.fields[99].label.es": ["Foreign"],
    } }, { status: 400 })));
    const { result } = renderHook(() => useFormDraftEditor(scope, initial), harness());
    await act(() => result.current.save());
    expect(result.current.session?.phase).toBe("Editing");
    expect(result.current.session?.value).toEqual(initial);
    expect(result.current.issue?.fields).toEqual([
      { path: "draft.fields[0].label.es", fieldLocalId: "q", messages: ["Revisá la pregunta"] },
      { path: "draft.fields[0].help.en", fieldLocalId: "q", messages: ["Revisá la ayuda"] },
      { path: "prefix", messages: ["Ya existe"] },
    ]);
  });

  it.each(["Forms.Draft.RevisionConflict", "Forms.Draft.IdentityRetired", "Forms.Definition.PrefixLocked", "Forms.Draft.RequestConflict"])("distinguishes the actual conflict code %s", async code => {
    server.use(http.post("/api/forms/definitions", () => HttpResponse.json({ code }, { status: 409 })));
    const { result } = renderHook(() => useFormDraftEditor(scope, initial), harness()); await act(() => result.current.save());
    expect(result.current.session?.phase).toBe(code === "Forms.Draft.RequestConflict" ? "Unconfirmed" : "ReviewRequired");
    expect(result.current.issue?.code).toBe(code);
  });

  it("does not notify globally before a visual owner is mounted", async () => {
    const { notify } = await import("@/shared/ui/notifications");
    const spy = vi.spyOn(await import("@/shared/ui/notifications"), "notify");
    server.use(http.post("/api/forms/definitions", () => HttpResponse.error()));
    const { result } = renderHook(() => useFormDraftEditor(scope, initial), harness()); await act(() => result.current.save());
    expect(spy).not.toHaveBeenCalled(); expect(notify).toBeDefined(); spy.mockRestore();
  });

  it("keeps the live editor usable after StrictMode's effect reconnect", async () => {
    const h = harness();
    function Wrapper({ children }: PropsWithChildren) { return <StrictMode><h.wrapper>{children}</h.wrapper></StrictMode>; }
    server.use(http.post("/api/forms/definitions", async ({ request }) => { const { requestId } = await request.json() as { requestId: string }; return HttpResponse.json(receipt(requestId)); }));
    const { result } = renderHook(() => useFormDraftEditor(scope, initial), { wrapper: Wrapper, reactStrictMode: true });
    await act(() => result.current.save());
    expect(result.current.session?.confirmed?.revision).toBe(1);
  });

  it("sends an existing definition with its confirmed revision and no canonical key", async () => {
    const existing = readFormDetail({ definition: receipt("01990000-0000-7000-8000-000000000002").definition, lifecycle: fixtureLifecycle(1), capabilities: { canSave: true, canPublish: true, canPreview: false }, publication: { activeVersion: null, currentOperation: null, displayState: "Draft" }, audit });
    let received: unknown;
    server.use(http.put(`/api/forms/definitions/${id}/draft`, async ({ request }) => {
      const body = await request.json() as { requestId: string }; received = body;
      const result = receipt(body.requestId, 2); return HttpResponse.json({ ...result, identityMap: { ...result.identityMap,
        fields: [{ ...result.identityMap.fields[0], localId: fieldId }] } });
    }));
    const { result } = renderHook(() => useFormDraftEditor(scope, existing), harness());
    await act(() => result.current.save());
    expect(received).toMatchObject({ expectedRevision: 1, draft: { fields: [{ localId: fieldId, fieldId, replacesFieldId: null, maxLength: 600, help: { en: "Details" } }] } });
    expect((received as { draft: { fields: unknown[] } }).draft.fields[0]).not.toHaveProperty("key");
    expect(result.current.session?.confirmed?.revision).toBe(2);
  });

  it("permits only explicit replay after a missing receipt, with the identical frozen body and UUID", async () => {
    const bodies: unknown[] = [];
    server.use(http.post("/api/forms/definitions", async ({ request }) => {
      const body = await request.json() as { requestId: string }; bodies.push(body);
      return bodies.length === 1 ? HttpResponse.json({}, { status: 500 }) : HttpResponse.json(receipt(body.requestId));
    }), http.get("/api/forms/draft-changes/:requestId", () => HttpResponse.json({ code: "Forms.Draft.ChangeNotFound" }, { status: 404 })));
    const { result } = renderHook(() => useFormDraftEditor(scope, initial), harness());
    await act(() => result.current.save()); await act(() => result.current.retry()); expect(bodies).toHaveLength(1);
    await act(() => result.current.recover()); await act(() => result.current.retry());
    expect(bodies).toHaveLength(2); expect(bodies[1]).toEqual(bodies[0]);
    expect(result.current.session?.confirmed?.revision).toBe(1);
  });

  it("treats a missing receipt while the aborted POST is still committing as unconfirmed", async () => {
    const gate = deferred(); let committing = false; let committed = false; let requestId = "";
    server.use(http.post("/api/forms/definitions", async ({ request }) => {
      ({ requestId } = await request.json() as { requestId: string }); committing = true;
      await gate.promise; committed = true; return HttpResponse.json(receipt(requestId));
    }), http.get("/api/forms/draft-changes/:requestId", () => committed
      ? HttpResponse.json({ requestId, kind: "Create", status: "Committed", committedAtUtc: audit.createdAtUtc, currentRevision: 1, result: receipt(requestId) })
      : HttpResponse.json({ code: "Forms.Draft.ChangeNotFound" }, { status: 404 })));
    const { result } = renderHook(() => useFormDraftEditor(scope, initial), harness());
    let operation!: Promise<unknown>; act(() => { operation = result.current.save(); }); await waitFor(() => expect(committing).toBe(true));
    act(() => result.current.cancel()); await act(() => operation);
    await act(() => result.current.recover()); expect(result.current.issue?.kind).toBe("missing");
    expect(result.current.session?.pending?.body.requestId).toBe(requestId);
    gate.resolve(); await waitFor(() => expect(committed).toBe(true));
    await act(() => result.current.recover()); expect(result.current.session?.confirmed?.revision).toBe(1);
  });

  it("reads a newer revision for review without replacing the recovered baseline", async () => {
    server.use(http.post("/api/forms/definitions", () => HttpResponse.error()), http.get("/api/forms/draft-changes/:requestId", ({ params }) => {
      const requestId = String(params.requestId); return HttpResponse.json({ requestId, kind: "Create", status: "Committed", committedAtUtc: audit.createdAtUtc, currentRevision: 4, result: receipt(requestId) });
    }), http.get(`/api/forms/definitions/${id}`, () => HttpResponse.json({ definition: { ...receipt("01990000-0000-7000-8000-000000000002", 4).definition, name: { es: "Later" } }, lifecycle: fixtureLifecycle(4), capabilities: { canSave: true, canPublish: true, canPreview: false }, publication: { activeVersion: null, currentOperation: null, displayState: "Draft" }, audit })));
    const { result } = renderHook(() => useFormDraftEditor(scope, initial), harness());
    await act(() => result.current.save()); await act(() => result.current.recover()); await act(() => result.current.readCurrent());
    expect(result.current.review?.definition.name.es).toBe("Later");
    expect(result.current.session?.baseline.name.es).toBe("Encuesta");
    expect(result.current.session?.confirmed?.revision).toBe(1);
    expect(result.current.canSave).toBe(false);
  });

  it("releases private state when the recovery route rejects the actor's read permission", async () => {
    server.use(http.post("/api/forms/definitions", () => HttpResponse.error()), http.get("/api/forms/draft-changes/:requestId", () => HttpResponse.json({ code: "Forms.Definition.Forbidden" }, { status: 403 })));
    const { result } = renderHook(() => useFormDraftEditor(scope, initial), harness());
    await act(() => result.current.save()); await act(() => result.current.recover());
    expect(result.current.session).toBeNull(); expect(result.current.issue).toBeNull(); expect(result.current.canSave).toBe(false);
  });

  it("keeps an expired write attempt and blocks replay when the write itself returns 410", async () => {
    let calls = 0;
    server.use(http.post("/api/forms/definitions", () => { calls++; return HttpResponse.json({ code: "Forms.Draft.ChangeExpired" }, { status: 410 }); }));
    const { result } = renderHook(() => useFormDraftEditor(scope, initial), harness());
    await act(() => result.current.save()); const pending = result.current.session?.pending;
    expect(result.current.issue?.kind).toBe("expired");
    await act(() => result.current.retry()); await act(() => result.current.save());
    expect(calls).toBe(1); expect(result.current.session?.pending).toBe(pending);
  });

  it("maps an option validation to its frozen parent/handle and preserves the prefix collision code", async () => {
    const value: DraftEditorValue = { ...initial, draft: { ...initial.draft, fields: [{ localId: "parent", fieldId: null, replacesFieldId: null, type: "choice",
      label: { es: "Pregunta", en: "Question" }, help: null, required: false, options: [{ localId: "option", choiceId: null, label: { es: "Sí", en: "Yes" } }] }] } };
    server.use(http.post("/api/forms/definitions", () => HttpResponse.json({ code: "Forms.Definition.PrefixTaken", errors: {
      prefix: ["Ya existe"], "draft.fields[0].options[0].choiceId": ["Identidad inválida"], "draft.fields[0].options[1].label.es": ["Foreign"],
    } }, { status: 400 })));
    const { result } = renderHook(() => useFormDraftEditor(scope, value), harness()); await act(() => result.current.save());
    expect(result.current.issue).toMatchObject({ kind: "validation", code: "Forms.Definition.PrefixTaken", fields: [
      { path: "prefix", messages: ["Ya existe"] }, { path: "draft.fields[0].options[0].choiceId", fieldLocalId: "parent", choiceLocalId: "option", messages: ["Identidad inválida"] },
    ] });
    expect(result.current.session?.value).toEqual(value);
  });

  it("isolates a new editor mount from an older mount's delayed commit", async () => {
    const h = harness(); const gate = deferred(); let received = false;
    server.use(http.post("/api/forms/definitions", async ({ request }) => { const { requestId } = await request.json() as { requestId: string }; received = true; await gate.promise; return HttpResponse.json(receipt(requestId)); }));
    const old = renderHook(() => useFormDraftEditor(scope, initial), h);
    const oldEditor = old.result.current.session?.scope.editorId;
    let operation!: Promise<unknown>; act(() => { operation = old.result.current.save(); }); await waitFor(() => expect(received).toBe(true));
    old.unmount(); const fresh = renderHook(() => useFormDraftEditor(scope, { ...initial, name: { es: "New mount" } }), h);
    await act(async () => { gate.resolve(); await operation; });
    expect(fresh.result.current.session?.scope.editorId).not.toBe(oldEditor);
    expect(fresh.result.current.session?.value.name.es).toBe("New mount");
    expect(fresh.result.current.session?.confirmed).toBeNull();
  });
});

describe("scoped form queries", () => {
  it("keeps the active read in QueryCache after StrictMode reconnects effects", async () => {
    const h = harness(); const response = receipt("01990000-0000-7000-8000-000000000002");
    server.use(http.get(`/api/forms/definitions/${id}`, () => HttpResponse.json({ definition: response.definition, lifecycle: fixtureLifecycle(response.definition.revision), capabilities: { canSave: true, canPublish: true, canPreview: false }, publication: { activeVersion: null, currentOperation: null, displayState: "Draft" }, audit })));
    const hook = renderHook(() => useFormDefinition(scope, id), { ...h, reactStrictMode: true });
    await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
    expect(h.client.getQueryCache().getAll()).toHaveLength(1);
    expect(h.client.getQueryCache().getAll()[0]?.state.data).toEqual(hook.result.current.data);
    hook.unmount(); await waitFor(() => expect(h.client.getQueryCache().getAll()).toEqual([]));
  });
  it("keys reads by actor, permissions and culture and cleans them on loss of read", async () => {
    const h = harness(); const requests: string[] = [];
    server.use(http.get("/api/forms/definitions", ({ request }) => { requests.push(request.url); return HttpResponse.json({ items: [], page: 1, pageSize: 20, totalCount: 0, totalPages: 0, hasPrevious: false, hasNext: false }); }),
      http.get("/api/forms/definitions/facets", () => HttpResponse.json({ active: 0, published: 0, drafts: 0, deactivated: 0 })));
    const query = { page: 1, pageSize: 20, publicationFilter: "Active" as const };
    const hook = renderHook(({ context }) => useFormDefinitions(context, query), { ...h, initialProps: { context: scope } });
    await waitFor(() => expect(hook.result.current.list.isSuccess).toBe(true));
    hook.rerender({ context: { ...scope, actorId: "actor-b" } });
    await waitFor(() => expect(requests).toHaveLength(2));
    expect(h.client.getQueryCache().getAll().every(q => q.queryKey.includes("actor-b"))).toBe(true);
    hook.rerender({ context: { ...scope, actorId: "actor-b", permissions: [] } });
    await waitFor(() => expect(h.client.getQueryCache().getAll().every(q => q.state.data === undefined)).toBe(true));
    expect(hook.result.current.list.data).toBeUndefined();
  });

  it("reads real detail and cleans it on editor unmount", async () => {
    const h = harness(); const response = receipt("01990000-0000-7000-8000-000000000002");
    server.use(http.get(`/api/forms/definitions/${id}`, () => HttpResponse.json({ definition: response.definition, lifecycle: fixtureLifecycle(response.definition.revision), capabilities: { canSave: true, canPublish: true, canPreview: false }, publication: { activeVersion: null, currentOperation: null, displayState: "Draft" }, audit })));
    const hook = renderHook(() => { const [definitionId] = useState(id); return useFormDefinition(scope, definitionId); }, h);
    await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
    expect(hook.result.current.data?.definition.draft.fields[0]).toMatchObject({ maxLength: 600 });
    hook.unmount(); await waitFor(() => expect(h.client.getQueryCache().getAll()).toEqual([]));
  });

  it("changes keys when culture or the permission set changes and leaves query feedback to its future local owner", async () => {
    const module = await import("@/shared/ui/notifications"); const spy = vi.spyOn(module, "notify");
    const h = harness(); const calls: string[] = [];
    server.use(http.get("/api/forms/definitions", ({ request }) => { calls.push(request.url); return HttpResponse.json({ code: "Server.Failure" }, { status: 500 }); }),
      http.get("/api/forms/definitions/facets", () => HttpResponse.json({ active: 0, published: 0, drafts: 0, deactivated: 0 })));
    const hook = renderHook(({ context }) => useFormDefinitions(context, { page: 1, pageSize: 20, publicationFilter: "Active" }), { ...h, initialProps: { context: scope } });
    await waitFor(() => expect(hook.result.current.list.isError).toBe(true));
    hook.rerender({ context: { ...scope, culture: "en" } }); await waitFor(() => expect(calls).toHaveLength(2));
    hook.rerender({ context: { ...scope, culture: "en", permissions: ["formtemplates.read"] } }); await waitFor(() => expect(calls).toHaveLength(3));
    expect(h.client.getQueryCache().getAll().every(q => q.queryKey.includes("en") && q.queryKey.includes("formtemplates.read"))).toBe(true);
    expect(spy).not.toHaveBeenCalled(); spy.mockRestore();
  });
});

it("rejects a deleted definition definitively without retaining or replaying its pending UUID",async()=>{
 const h=harness();const canonical=receipt("01990000-0000-7000-8000-000000000020").definition;
 const writes=vi.fn(),recoveries=vi.fn();
 server.use(http.put("/api/forms/definitions/"+id+"/draft",()=>{writes();return HttpResponse.json({code:"Forms.Definition.NotFound",detail:"El formulario ya fue eliminado."},{status:404});}),http.get("/api/forms/draft-changes/:id",()=>{recoveries();return HttpResponse.json({},{status:404});}));
 const data=readFormDetail({definition:canonical,lifecycle:fixtureLifecycle(1),capabilities:{canSave:true,canPublish:true,canPreview:false},publication:{activeVersion:null,currentOperation:null,displayState:"Draft"},audit});
 const {result}=renderHook(()=>useFormDraftEditor(scope,data),h);
 act(()=>result.current.change({...result.current.session!.value,name:{es:"Mi borrador"}}));
 await act(()=>result.current.save());
 expect(result.current.session).toMatchObject({phase:"Editing",pending:null,value:{name:{es:"Mi borrador"}}});
 expect(result.current.canSave).toBe(false);
 await act(()=>result.current.retry());await act(()=>result.current.recover());await act(()=>result.current.save());
 expect(writes).toHaveBeenCalledOnce();expect(recoveries).not.toHaveBeenCalled();
});
