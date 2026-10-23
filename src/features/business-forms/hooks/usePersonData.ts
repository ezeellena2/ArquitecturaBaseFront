import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/shared/api/ApiError";
import { fetchPersonAttributes, fetchPersonData, fetchPersonDataPage, fetchPersonAttributeOptions, savePersonData, type PersonData, type PersonDataPageQuery } from "../api/personData";
import type { FormCulture } from "../model";
import { useUnobservedQueryCleanup } from "./useUnobservedQueryCleanup";

export interface PersonDataScope { readonly actorId: string | null; readonly culture: FormCulture; readonly permissions: readonly string[] }
export const personDataScopeKey = (scope: PersonDataScope) => ["forms-person-data", scope.actorId, [...new Set(scope.permissions)].sort().join(","), scope.culture] as const;
const attributeAccess = (scope: PersonDataScope) => !!scope.actorId && ["users.manage", "formpersondata.manage", "formtemplates.manage"].some(permission => scope.permissions.includes(permission));
export const personDataForbidden = (error: unknown) => error instanceof ApiError && (error.status === 401 || error.status === 403);
export function usePersonAttributes(scope: PersonDataScope, enabled = true) {
 const key = [...personDataScopeKey(scope), "attributes"] as const;
 useUnobservedQueryCleanup(key);
 return useQuery({ queryKey: key, queryFn: ({ signal }) => fetchPersonAttributes(signal), enabled: attributeAccess(scope) && enabled, staleTime: 0, gcTime: 0, meta: { errorOwner: "local" } });
}
export function usePersonDataPage(scope: PersonDataScope, query: PersonDataPageQuery, enabled = true) {
 const key = [...personDataScopeKey(scope), "page", query] as const;
 useUnobservedQueryCleanup(key);
 return useQuery({ queryKey: key, queryFn: ({ signal }) => fetchPersonDataPage(query, signal), enabled: enabled && !!scope.actorId && scope.permissions.includes("formpersondata.manage") && scope.permissions.includes("users.read"), staleTime: 0, gcTime: 0, meta: { errorOwner: "local" } });
}
export function usePersonAttributeOptions(scope: PersonDataScope, id: string, search: string, enabled = true) {
 const key = [...personDataScopeKey(scope), "options", id, search] as const;
 useUnobservedQueryCleanup(key);
 return useQuery({ queryKey: key, queryFn: ({ signal }) => fetchPersonAttributeOptions(id, { page: 1, pageSize: 20, search }, signal), enabled: attributeAccess(scope) && !!id && enabled, staleTime: 0, gcTime: 0, meta: { errorOwner: "local" } });
}
interface State { readonly owner: string; readonly baseline: PersonData | null; readonly values: Readonly<Record<string, string | null>> | null; readonly error: unknown; readonly busy: boolean; readonly conflict: boolean }
const fresh = (owner: string): State => ({ owner, baseline: null, values: null, error: null, busy: false, conflict: false });
const valuesOf = (data: PersonData) => Object.fromEntries(Object.entries(data.values).map(([id, entry]) => [id, entry.value]));
const changes = (state: State) => Object.fromEntries(Object.entries(state.values ?? {}).filter(([id, value]) => (state.baseline?.values[id]?.value ?? null) !== value));
export function usePersonData(scope: PersonDataScope, userId: string) {
 const client = useQueryClient();
 const permissionStamp = [...new Set(scope.permissions)].sort().join(",");
 const rootKey = useMemo(() => ["forms-person-data", scope.actorId, permissionStamp, scope.culture] as const, [scope.actorId, permissionStamp, scope.culture]);
 const key = [...rootKey, "person", userId] as const, owner = JSON.stringify(key);
 const [deniedOwner, setDeniedOwner] = useState<string | null>(null);
 const allowed = !!scope.actorId && scope.permissions.includes("users.manage") && deniedOwner !== owner;
 const attributes = usePersonAttributes(scope, allowed);
 useUnobservedQueryCleanup(key);
 const query = useQuery({ queryKey: key, queryFn: ({ signal }) => fetchPersonData(userId, signal), enabled: allowed && !!userId, staleTime: 0, gcTime: 0, meta: { errorOwner: "local" } });
 const [state, setState] = useState<State>(() => fresh(owner));
 const active = useRef(true), activeOwner = useRef(owner), stateRef = useRef(state), canWrite = useRef(allowed), operation = useRef<AbortController | null>(null);
 useLayoutEffect(() => { activeOwner.current = owner; stateRef.current = state; canWrite.current = allowed; }, [owner, state, allowed]);
 useEffect(() => { active.current = true; return () => { active.current = false; operation.current?.abort(); operation.current = null; }; }, [owner]);
 if (state.owner !== owner) setState(fresh(owner));
 else if (allowed && state.baseline === null && query.data && !query.isError) setState({ ...state, baseline: query.data, values: valuesOf(query.data) });
 const denied = personDataForbidden(query.error) || personDataForbidden(attributes.error) || personDataForbidden(state.error);
 if (denied && deniedOwner !== owner) { setDeniedOwner(owner); setState(fresh(owner)); }
 useEffect(() => {
  if (deniedOwner !== owner) return;
  operation.current?.abort(); operation.current = null;
  void client.cancelQueries({ queryKey: rootKey }); client.removeQueries({ queryKey: rootKey });
 }, [deniedOwner, owner, client, rootKey]);
 const owned = state.owner === owner && allowed && !denied;
 const current = useCallback(() => active.current && activeOwner.current === owner && canWrite.current, [owner]);
 const changeValue = useCallback((id: string, value: string | null) => {
  if (!current() || operation.current || !attributes.data?.items.some(attribute => attribute.id === id && attribute.isActive)) return;
  setState(previous => previous.owner === owner && previous.values ? { ...previous, error: null, values: { ...previous.values, [id]: value } } : previous);
 }, [owner, attributes.data, current]);
 const save = useCallback(async () => {
  const captured = stateRef.current;
  if (!current() || captured.owner !== owner || !captured.baseline || operation.current || captured.conflict) return false;
  const delta = changes(captured);
  if (!Object.keys(delta).length) return true;
  const controller = new AbortController(); operation.current = controller;
  setState(previous => ({ ...previous, busy: true, error: null }));
  try {
   const result = await savePersonData(userId, { expectedRevision: captured.baseline.revision, values: delta }, controller.signal);
   if (!current() || controller.signal.aborted || operation.current !== controller) return false;
   setState({ owner, baseline: result, values: valuesOf(result), error: null, busy: false, conflict: false });
   void client.invalidateQueries({ queryKey: rootKey });
   return true;
  } catch (error) {
   if (current() && !controller.signal.aborted && operation.current === controller) setState(previous => ({ ...previous, busy: false, error, conflict: error instanceof ApiError && error.code === "Forms.PersonData.RevisionConflict" }));
   return false;
  } finally { if (operation.current === controller) operation.current = null; }
 }, [owner, userId, client, rootKey, current]);
 const { refetch } = query;
 const { refetch: refetchAttributes } = attributes;
 const reload = useCallback(async () => {
  if (!current() || operation.current) return false;
  const [result, definitions] = await Promise.all([refetch(), refetchAttributes()]);
  if (!current() || !result.isSuccess || !definitions.isSuccess) return false;
  setState({ owner, baseline: result.data, values: valuesOf(result.data), error: null, busy: false, conflict: false });
  return true;
 }, [owner, refetch, refetchAttributes, current]);
 return { attributes, query, values: owned ? state.values : null, baseline: owned ? state.baseline : null, ready: owned && state.baseline !== null && attributes.isSuccess, dirty: owned && Object.keys(changes(state)).length > 0, busy: owned && state.busy, conflict: owned && state.conflict, error: owned ? state.error ?? query.error ?? attributes.error : null, denied: !allowed || denied, changeValue, save, reload };
}
