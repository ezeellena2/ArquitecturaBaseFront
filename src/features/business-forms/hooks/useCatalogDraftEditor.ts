import { parseCatalogValue, type CatalogValueType } from "../catalogValues";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/shared/api/ApiError";
import type { CatalogItemMove } from "../api/catalogs";
import { createManualCatalog, fetchCatalog, updateManualCatalog, createFiltersCatalog, updateFiltersCatalog, previewCatalogFilters, approveCatalogProposal, discardCatalogProposal } from "../api/catalogs";
import type { CatalogDetail, CatalogItem, CatalogSave, CatalogFilterPreview } from "../api/catalogResponse";
import { catalogDraftBody, catalogDraftUpdateBody, loadCatalogDraftItems, openCatalogDraft, stageCatalogDraftItem, stageCatalogDraftMove, type CatalogDraft } from "../catalogDraft";
import { catalogItemChanges, type CatalogManualItemValue } from "../catalogItemEdits";
import type { FormCulture } from "../model";

import { catalogFiltersBody } from "../catalogFilterDraft";
import type { CatalogFiltersEditorValue } from "../components/CatalogFiltersEditor";
import { catalogFieldsBody, parseCatalogFieldValue, type CatalogFieldDraft } from "../catalogFields";
import type { CatalogPresentation } from "../api/catalogResponse";

export interface CatalogReadScope { readonly actorId: string | null; readonly culture: FormCulture; readonly permissions: readonly string[] }
interface EditorState {
  readonly owner: string;
  readonly epoch: object;
  readonly draft: CatalogDraft;
  readonly baseline: Pick<CatalogDraft, "name" | "description" | "filters" | "isActive" | "fields" | "presentation">;
  readonly busy: boolean;
  readonly requiresReview: boolean;
  readonly current: CatalogDetail | null;
  readonly saved: CatalogSave | null;
  readonly previewResult: CatalogFilterPreview | null;
  readonly error: unknown;
}
function fresh(owner: string, initial?: CatalogDetail, kind: CatalogDraft["kind"] = "Manual", valueType: CatalogValueType = "Text", culture: FormCulture = "es"): EditorState {
  const draft = openCatalogDraft(initial, kind, valueType, culture);
  return { owner, epoch: {}, draft, baseline: { isActive: draft.isActive, name: draft.name, description: draft.description, filters: draft.filters, fields: draft.fields, presentation: draft.presentation }, busy: false, requiresReview: false, current: null, saved: null, previewResult: null, error: null };
}
export function useCatalogDraftEditor(scope: CatalogReadScope, initial?: CatalogDetail, kind: CatalogDraft["kind"] = "Manual", valueType: CatalogValueType = "Text") {
  const client = useQueryClient();
  const owner = JSON.stringify([scope.actorId, scope.culture, initial?.id ?? null, initial?.kind ?? kind, initial?.valueType ?? valueType]);
  const canRead = scope.actorId !== null && scope.permissions.includes("formcatalogs.read");
  const canManage = canRead && scope.permissions.includes("formcatalogs.manage");
  const ownerRef = useRef(owner);
  const permissionsRef = useRef({ canRead, canManage });
  const initialRef = useRef(initial);
  const active = useRef(true);
  const operation = useRef<AbortController | null>(null);
  const [state, setState] = useState(() => fresh(owner, initial, kind, valueType, scope.culture));
  const stateRef = useRef(state);
  useLayoutEffect(() => { ownerRef.current = owner; permissionsRef.current = { canRead, canManage }; initialRef.current = initial; stateRef.current = state; }, [owner, canRead, canManage, initial, state]);
  useEffect(() => {
    active.current = true;
    setState(fresh(owner, canRead ? initialRef.current : undefined, kind, valueType, scope.culture));
    return () => { active.current = false; operation.current?.abort(); operation.current = null; };
  }, [owner, canRead, kind, valueType, scope.culture]);
  const owned = state.owner === owner && canRead;
  const isCurrentOwner = useCallback(() => active.current && ownerRef.current === owner && permissionsRef.current.canRead
    && stateRef.current.epoch === state.epoch, [owner, state.epoch]);
  const accepts = useCallback((capturedOwner: string, controller: AbortController) => isCurrentOwner() && ownerRef.current === capturedOwner
    && operation.current === controller && !controller.signal.aborted, [isCurrentOwner]);
  const changeMetadata = useCallback((metadata: Partial<Pick<CatalogDraft, "name" | "description" | "isActive">>) => {
    if (!owned || !isCurrentOwner() || !canManage || !permissionsRef.current.canManage || operation.current || stateRef.current.busy || stateRef.current.requiresReview) return;
    setState(value => ({ ...value, error: null, draft: { ...value.draft, ...(metadata.isActive !== undefined ? { isActive: metadata.isActive } : {}), ...(metadata.name ? { name: { ...metadata.name } } : {}), ...(metadata.description ? { description: { ...metadata.description } } : {}) } }));
  }, [owned, canManage, isCurrentOwner]);
  const changeFilters = useCallback((filters: CatalogFiltersEditorValue) => {
    if (!owned || !isCurrentOwner() || !permissionsRef.current.canManage || operation.current || stateRef.current.busy || stateRef.current.requiresReview) return;
    setState(value => ({ ...value, error: null, previewResult: null, draft: { ...value.draft, filters: { ...filters, conditions: filters.conditions.map(condition => ({ ...condition })) } } }));
  }, [owned, isCurrentOwner]);
  const changeFields = useCallback((fields: readonly CatalogFieldDraft[], confirmFieldRemovals: readonly string[]) => {
    if (!owned || !isCurrentOwner() || !permissionsRef.current.canManage || operation.current || stateRef.current.busy || stateRef.current.requiresReview) return;
    setState(value => ({ ...value, error: null, draft: { ...value.draft, fields: fields.map(field => ({ ...field, name: { ...field.name }, usedBy: field.usedBy.map(use => ({ ...use })) })), confirmFieldRemovals: [...confirmFieldRemovals] } }));
  }, [owned, isCurrentOwner]);
  const changePresentation = useCallback((presentation: CatalogPresentation | null) => {
    if (!owned || !isCurrentOwner() || !permissionsRef.current.canManage || operation.current || stateRef.current.busy || stateRef.current.requiresReview) return;
    setState(value => ({ ...value, error: null, draft: { ...value.draft, presentation: presentation ? { title: [...presentation.title], description: [...presentation.description] } : null } }));
  }, [owned, isCurrentOwner]);
  const changeItem = useCallback((item: CatalogManualItemValue) => {
    if (!owned || !isCurrentOwner() || !canManage || !permissionsRef.current.canManage || operation.current || stateRef.current.busy || stateRef.current.requiresReview) return;
    setState(value => ({ ...value, error: null, draft: stageCatalogDraftItem(value.draft, item) }));
  }, [owned, canManage, isCurrentOwner]);
  const changeMove = useCallback((itemId: string, direction: CatalogItemMove["direction"]) => {
    if (!owned || !isCurrentOwner() || !permissionsRef.current.canManage || operation.current || stateRef.current.busy || stateRef.current.requiresReview) return;
    setState(value => ({ ...value, error: null, draft: stageCatalogDraftMove(value.draft, itemId, direction) }));
  }, [owned, isCurrentOwner]);
  const changeSort = useCallback((sortAlphabetically: boolean) => {
    if (!owned || !isCurrentOwner() || !permissionsRef.current.canManage || operation.current || stateRef.current.busy || stateRef.current.requiresReview || !stateRef.current.draft.id || stateRef.current.draft.moves.length) return;
    setState(value => ({ ...value, error: null, draft: { ...value.draft, sortAlphabetically } }));
  }, [owned, isCurrentOwner]);
  const clearMoves = useCallback(() => {
    if (!owned || !isCurrentOwner() || !permissionsRef.current.canManage || operation.current || stateRef.current.busy || stateRef.current.requiresReview) return;
    setState(value => ({ ...value, error: null, draft: { ...value.draft, moves: [] } }));
  }, [owned, isCurrentOwner]);
  const loadItems = useCallback((items: readonly CatalogItem[], revision = state.draft.revision) => {
    if (!owned || !isCurrentOwner() || operation.current || stateRef.current.busy || stateRef.current.requiresReview || revision !== stateRef.current.draft.revision) return;
    setState(value => ({ ...value, draft: loadCatalogDraftItems(value.draft, items) }));
  }, [owned, state.draft.revision, isCurrentOwner]);
  const save = useCallback(async (sampleUserId?: string) => {
    if (!owned || !isCurrentOwner() || !permissionsRef.current.canManage || operation.current || stateRef.current.requiresReview) return;
    const captured = stateRef.current.draft;
    if (captured.kind === "Manual" && catalogItemChanges(captured.items).some(item => !parseCatalogValue(captured.valueType, item.value, captured.culture).valid)) return;
    if (captured.kind === "Manual" && catalogItemChanges(captured.items).some(item => captured.fields.some(field => field.id && field.isActive && !parseCatalogFieldValue(field, item.fields?.[field.id], captured.culture).valid))) return;
    const pendingProposal = captured.proposal?.state === "Pending";
    if (captured.filters && (captured.isActive || pendingProposal) && !sampleUserId) return;
    let writing = false;
    const controller = new AbortController(); operation.current = controller;
    setState(value => ({ ...value, busy: true, error: null, saved: null }));
    try {
      if (captured.filters && captured.isActive && !pendingProposal) {
        const previewResult = await previewCatalogFilters({ sampleUserId: sampleUserId!, filters: catalogFiltersBody(captured.filters) }, controller.signal);
        if (!accepts(owner, controller) || !permissionsRef.current.canManage) return;
        setState(value => ({ ...value, previewResult }));
        if (previewResult.exceedsLimit) return;
      }
      writing = true;
      const filledTexts = (texts: Readonly<Record<"es" | "en", string>>) => Object.fromEntries(Object.entries(texts).filter(([, text]) => !!text.trim()));
      const saved = pendingProposal && captured.filters && captured.id && captured.revision !== null
        ? await approveCatalogProposal(captured.id, { expectedRevision: captured.revision, name: filledTexts(captured.name), description: filledTexts(captured.description), filters: catalogFiltersBody(captured.filters), sampleUserId: sampleUserId! }, controller.signal)
        : captured.filters
        ? captured.id && captured.revision !== null
          ? await updateFiltersCatalog(captured.id, { name: captured.name, description: captured.description, filters: catalogFiltersBody(captured.filters), expectedRevision: captured.revision, isActive: captured.isActive }, controller.signal)
          : await createFiltersCatalog({ name: captured.name, description: captured.description, filters: catalogFiltersBody(captured.filters) }, controller.signal)
        : captured.id && captured.revision !== null
          ? await updateManualCatalog(captured.id, catalogDraftUpdateBody(captured), controller.signal)
          : await createManualCatalog(catalogDraftBody(captured), controller.signal);
      if (!accepts(owner, controller) || !permissionsRef.current.canManage) return;
      const next = fresh(owner, saved.catalog, kind, valueType, scope.culture);
      setState({ ...next, saved });
      // The next revision loads canonical item pages afresh. No collection is reconstructed from a partial page.
      void client.invalidateQueries({ queryKey: ["form-catalogs", scope.actorId] });
      return saved;
    } catch (error) {
      if (!accepts(owner, controller)) return;
      const review = writing && captured.id !== null && error instanceof ApiError && error.status === 409;
      setState(value => ({ ...value, busy: false, error, requiresReview: review, ...(review ? { current: null } : {}) }));
    } finally {
      if (operation.current === controller) { operation.current = null; if (active.current && ownerRef.current === owner) setState(value => ({ ...value, busy: false })); }
    }
  }, [client, owned, owner, scope.actorId, scope.culture, kind, valueType, isCurrentOwner, accepts]);
  const discardProposal = useCallback(async () => {
    const captured = stateRef.current.draft;
    if (!owned || !isCurrentOwner() || !permissionsRef.current.canManage || operation.current || stateRef.current.requiresReview
      || captured.proposal?.state !== "Pending" || !captured.id || captured.revision === null) return;
    const controller = new AbortController(); operation.current = controller;
    setState(value => ({ ...value, busy: true, error: null, saved: null }));
    try {
      const discarded = await discardCatalogProposal(captured.id, captured.revision, controller.signal);
      if (!accepts(owner, controller) || !permissionsRef.current.canManage) return;
      setState(fresh(owner, discarded, kind, valueType, scope.culture));
      void client.invalidateQueries({ queryKey: ["form-catalogs", scope.actorId] });
      return discarded;
    } catch (error) {
      if (accepts(owner, controller)) setState(value => ({ ...value, busy: false, error, current: null, requiresReview: error instanceof ApiError && error.status === 409 }));
    } finally {
      if (operation.current === controller) { operation.current = null; if (isCurrentOwner()) setState(value => ({ ...value, busy: false })); }
    }
  }, [client, owned, owner, scope.actorId, scope.culture, kind, valueType, isCurrentOwner, accepts]);
  const clearPreview = useCallback(() => {
    if (owned && isCurrentOwner() && !operation.current) setState(value => ({ ...value, previewResult: null, error: null }));
  }, [owned, isCurrentOwner]);
  const preview = useCallback(async (sampleUserId: string) => {
    const filters = stateRef.current.draft.filters;
    if (!owned || !isCurrentOwner() || !permissionsRef.current.canManage || !filters || operation.current) return;
    const controller = new AbortController(); operation.current = controller;
    setState(value => ({ ...value, busy: true, error: null, previewResult: null }));
    try {
      const previewResult = await previewCatalogFilters({ sampleUserId, filters: catalogFiltersBody(filters) }, controller.signal);
      if (accepts(owner, controller) && permissionsRef.current.canManage) setState(value => ({ ...value, previewResult }));
    } catch (error) { if (accepts(owner, controller)) setState(value => ({ ...value, error })); }
    finally { if (operation.current === controller) { operation.current = null; if (isCurrentOwner()) setState(value => ({ ...value, busy: false })); } }
  }, [owned, owner, isCurrentOwner, accepts]);
  const readCurrent = useCallback(async () => {
    const id = stateRef.current.draft.id;
    if (!owned || !isCurrentOwner() || !id || operation.current) return;
    const controller = new AbortController(); operation.current = controller;
    setState(value => ({ ...value, busy: true, error: null }));
    try {
      const current = await fetchCatalog(id, controller.signal);
      if (accepts(owner, controller)) setState(value => ({ ...value, current, busy: false }));
    } catch (error) {
      if (accepts(owner, controller)) setState(value => ({ ...value, error, busy: false }));
    } finally { if (operation.current === controller) operation.current = null; }
  }, [owned, owner, isCurrentOwner, accepts]);
  const adoptCurrent = useCallback(() => {
    if (!owned || !isCurrentOwner() || operation.current || !stateRef.current.current) return;
    setState(fresh(owner, stateRef.current.current, kind, valueType, scope.culture));
  }, [owned, owner, kind, valueType, scope.culture, isCurrentOwner]);
  const observeCatalog = useCallback((catalog: CatalogDetail) => {
    const current = stateRef.current, draft = current.draft, baseline = current.baseline;
    if (!owned || !isCurrentOwner() || operation.current || current.busy || catalog.id !== draft.id || catalog.revision < (draft.revision ?? 0)
      || draft.sortAlphabetically || draft.moves.length || Object.keys(draft.items.changes).length
      || draft.isActive !== baseline.isActive || JSON.stringify(draft.name) !== JSON.stringify(baseline.name) || JSON.stringify(draft.description) !== JSON.stringify(baseline.description)
      || JSON.stringify(catalogFieldsBody(draft.fields, draft.culture)) !== JSON.stringify(catalogFieldsBody(baseline.fields, draft.culture)) || JSON.stringify(draft.presentation) !== JSON.stringify(baseline.presentation)) return;
    setState(fresh(owner, catalog, kind, valueType, scope.culture));
    void client.invalidateQueries({ queryKey: ["form-catalogs", scope.actorId] });
  }, [owned, isCurrentOwner, owner, kind, valueType, scope.culture, scope.actorId, client]);
  const draft = owned ? state.draft : null;
  const dirty = !!draft && (draft.isActive !== state.baseline.isActive || JSON.stringify(draft.name) !== JSON.stringify(state.baseline.name)
    || JSON.stringify(draft.description) !== JSON.stringify(state.baseline.description)
    || JSON.stringify(catalogFieldsBody(draft.fields, draft.culture)) !== JSON.stringify(catalogFieldsBody(state.baseline.fields, draft.culture)) || JSON.stringify(draft.presentation) !== JSON.stringify(state.baseline.presentation)
    || JSON.stringify(draft.filters ? catalogFiltersBody(draft.filters) : null) !== JSON.stringify(state.baseline.filters ? catalogFiltersBody(state.baseline.filters) : null) || Object.keys(draft.items.changes).length > 0 || draft.moves.length > 0 || draft.sortAlphabetically);
  return { draft, dirty, busy: owned && state.busy, requiresReview: owned && state.requiresReview, current: owned ? state.current : null,
    saved: owned ? state.saved : null, previewResult: owned && canManage ? state.previewResult : null, error: owned ? state.error : null, canSave: owned && canManage && !state.busy && !state.requiresReview,
    changeSort, observeCatalog, changeMetadata, changeFilters, changeFields, changePresentation, clearPreview, preview, changeItem, changeMove, clearMoves, loadItems, save, discardProposal, readCurrent, adoptCurrent };
}
