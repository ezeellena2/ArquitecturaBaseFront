import { createContext, useContext } from "react";
import type { ResponseFilter } from "../responses";
export interface ResponseWorkspace {
  denied: boolean;
  deny: () => void;
  formId: string;
  filter: ResponseFilter;
  setFilter: (formId: string, filter: ResponseFilter) => void;
}
export const ResponseWorkspaceContext = createContext<ResponseWorkspace | null>(
  null,
);
export function useResponseWorkspace(formId: string) {
  const context = useContext(ResponseWorkspaceContext);
  if (!context) throw new Error("The response workspace is missing.");
  return {
    deny: context.deny,
    filter: context.formId === formId ? context.filter : {},
    setFilter: (filter: ResponseFilter) => context.setFilter(formId, filter),
  };
}
