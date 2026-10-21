import { createContext, useContext } from "react";
import type { ResponseFilter } from "../responses";
export interface ResponseNavigationContext {
  origin: "sheet" | "pending";
  selection: { recordId: string; taskId?: string };
  search: string;
  pending?: { tasks: { id: string; recordId: string }[]; page: number; pageSize: number; totalCount: number };
}
export interface ResponseFullEntry { formId: string; recordId: string; locationKey: string | null; intent?: "pdf" }
export interface ResponseWorkspace {
  fullEntry: ResponseFullEntry | null;
  prepareFull: (formId: string, recordId: string, intent?: "pdf") => void;
  enterFull: (formId: string, recordId: string, locationKey: string, search: string) => void;
  finishFull: () => void;
  denied: boolean;
  deny: () => void;
  formId: string;
  filter: ResponseFilter;
  setFilter: (formId: string, filter: ResponseFilter) => void;
  navigation: (ResponseNavigationContext & { formId: string }) | null;
  setNavigation: (formId: string, navigation: ResponseNavigationContext | null) => void;
}
export const ResponseWorkspaceContext = createContext<ResponseWorkspace | null>(
  null,
);
export function useResponseWorkspace(formId: string) {
  const context = useContext(ResponseWorkspaceContext);
  if (!context) throw new Error("The response workspace is missing.");
  return {
    deny: context.deny,
    fullEntry: context.fullEntry?.formId === formId ? context.fullEntry : null,
    prepareFull: (recordId: string, intent?: "pdf") => context.prepareFull(formId, recordId, intent),
    enterFull: (recordId: string, key: string, search: string) => context.enterFull(formId, recordId, key, search),
    finishFull: context.finishFull,
    filter: context.formId === formId ? context.filter : {},
    setFilter: (filter: ResponseFilter) => context.setFilter(formId, filter),
    navigation: context.navigation?.formId === formId ? context.navigation : null,
    setNavigation: (navigation: ResponseNavigationContext | null) => context.setNavigation(formId, navigation),
  };
}
