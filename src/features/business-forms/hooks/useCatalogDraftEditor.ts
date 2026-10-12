import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/shared/api/ApiError";
import { createManualCatalog, fetchCatalog, updateManualCatalog } from "../api/catalogs";
import type { CatalogDetail, CatalogItem, CatalogSave } from "../api/catalogResponse";
import { catalogDraftBody, loadCatalogDraftItems, openCatalogDraft, stageCatalogDraftItem, type CatalogDraft } from "../catalogDraft";
import type { CatalogManualItemValue } from "../catalogItemEdits";
import type { FormCulture } from "../model";

export interface CatalogReadScope { readonly actorId: string | null; readonly culture: FormCulture; readonly permissions: readonly string[] }
interface EditorState {
  readonly owner: string;
  readonly draft: CatalogDraft;
  readonly baseline: Pick<CatalogDraft, "name" | "description">;
  readonly busy: boolean;
  readonly requiresReview: boolean;
  readonly current: CatalogDetail | null;
  readonly saved: CatalogSave | null;
  readonly error: unknown;
}
function fresh(owner: string, initial?: CatalogDetail): EditorState {
  const draft = openCatalogDraft(initial);
  return { owner, draft, baseline: { name: draft.name, description: draft.description }, busy: false, requiresReview: false, current: null, saved: null, error: null };
}
export function useCatalogDraftEditor(scope: CatalogReadScope, initial?: CatalogDetail) {
  const client = useQueryClient();
  const owner = JSON.stringify([scope.actorId, scope.culture, initial?.id ?? null]);
  const canRead = scope.actorId !== null && scope.permissions.includes("formcatalogs.read");
  const canManage = canRead && scope.permissions.includes("formcatalogs.manage") && (initial?.kind ?? "Manual") === "Manual";
  const ownerRef = useRef(owner);
  const permissionsRef = useRef({ canRead, canManage });
  const initialRef = useRef(initial);
  const active = useRef(true);
  const operation = useRef<AbortController | null>(null);
  const [state, setState] = useState(() => fresh(owner, initial));
  const stateRef = useRef(state);
  useLayoutEffect(() => { ownerRef.current = owner; permissionsRef.current = { canRead, canManage }; initialRef.current = initial; stateRef.current = state; }, [owner, canRead, canManage, initial, state]);
  useEffect(() => {
    active.current = true;
    setState(fresh(owner, canRead ? initialRef.current : undefined));
    return () => { active.current = false; operation.current?.abort(); operation.current = null; };
  }, [owner, canRead]);
  const owned = state.owner === owner && canRead;
  const accepts = (capturedOwner: string, controller: AbortController) => active.current && ownerRef.current === capturedOwner
    && permissionsRef.current.canRead && operation.current === controller && !controller.signal.aborted;
  const changeMetadata = useCallback((metadata: Partial<Pick<CatalogDraft, "name" | "description">>) => {
    if (!owned || !canManage || operation.current || stateRef.current.busy || stateRef.current.requiresReview) return;
    setState(value => ({ ...value, error: null, draft: { ...value.draft, ...(metadata.name ? { name: { ...metadata.name } } : {}), ...(metadata.description ? { description: { ...metadata.description } } : {}) } }));
  }, [owned, canManage]);
  const changeItem = useCallback((item: CatalogManualItemValue) => {
    if (!owned || !canManage || operation.current || stateRef.current.busy || stateRef.current.requiresReview) return;
    setState(value => ({ ...value, error: null, draft: stageCatalogDraftItem(value.draft, item) }));
  }, [owned, canManage]);
  const loadItems = useCallback((items: readonly CatalogItem[], revision = state.draft.revision) => {
    if (!owned || operation.current || stateRef.current.busy || stateRef.current.requiresReview || revision !== stateRef.current.draft.revision) return;
    setState(value => ({ ...value, draft: loadCatalogDraftItems(value.draft, items) }));
  }, [owned, state.draft.revision]);
  const save = useCallback(async () => {
    if (!owned || !permissionsRef.current.canManage || operation.current || stateRef.current.requiresReview) return;
    const captured = stateRef.current.draft;
    const body = catalogDraftBody(captured);
    const controller = new AbortController(); operation.current = controller;
    setState(value => ({ ...value, busy: true, error: null, saved: null }));
    try {
      const saved = captured.id && captured.revision !== null
        ? await updateManualCatalog(captured.id, { ...body, expectedRevision: captured.revision }, controller.signal)
        : await createManualCatalog(body, controller.signal);
      if (!accepts(owner, controller) || !permissionsRef.current.canManage) return;
      const next = fresh(owner, saved.catalog);
      setState({ ...next, saved });
      // The next revision loads canonical item pages afresh. No collection is reconstructed from a partial page.
      void client.invalidateQueries({ queryKey: ["form-catalogs", scope.actorId] });
      return saved;
    } catch (error) {
      if (!accepts(owner, controller)) return;
      const review = error instanceof ApiError ? error.status === 409 || error.isNetworkError || error.status >= 500 : true;
      setState(value => ({ ...value, busy: false, error, requiresReview: review }));
    } finally {
      if (operation.current === controller) { operation.current = null; if (active.current && ownerRef.current === owner) setState(value => ({ ...value, busy: false })); }
    }
  }, [client, owned, owner, scope.actorId]);
  const readCurrent = useCallback(async () => {
    const id = stateRef.current.draft.id;
    if (!owned || !id || operation.current) return;
    const controller = new AbortController(); operation.current = controller;
    setState(value => ({ ...value, busy: true, error: null }));
    try {
      const current = await fetchCatalog(id, controller.signal);
      if (accepts(owner, controller)) setState(value => ({ ...value, current, busy: false }));
    } catch (error) {
      if (accepts(owner, controller)) setState(value => ({ ...value, error, busy: false }));
    } finally { if (operation.current === controller) operation.current = null; }
  }, [owned, owner]);
  const adoptCurrent = useCallback(() => {
    if (!owned || operation.current || !stateRef.current.current) return;
    setState(fresh(owner, stateRef.current.current));
  }, [owned, owner]);
  const draft = owned ? state.draft : null;
  const dirty = !!draft && (JSON.stringify(draft.name) !== JSON.stringify(state.baseline.name)
    || JSON.stringify(draft.description) !== JSON.stringify(state.baseline.description) || Object.keys(draft.items.changes).length > 0);
  return { draft, dirty, busy: owned && state.busy, requiresReview: owned && state.requiresReview, current: owned ? state.current : null,
    saved: owned ? state.saved : null, error: owned ? state.error : null, canSave: owned && canManage && !state.busy && !state.requiresReview,
    changeMetadata, changeItem, loadItems, save, readCurrent, adoptCurrent };
}
