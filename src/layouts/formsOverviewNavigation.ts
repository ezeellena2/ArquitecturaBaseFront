import { createContext } from "react";
/** A counter of the forms panel: its number, while it loads, whether it failed and how to read it again. */
export interface FormsNavigationCount {
  count?: number;
  pending: boolean;
  failed: boolean;
  retry: () => void;
}
export interface FormsOverviewNavigation extends FormsNavigationCount {
  setActive: (active: boolean) => void;
  /** «Documentos recibidos» (DOC5-A): the documents that wait for someone of the team, only with «Ver documentos recibidos». */
  documents?: FormsNavigationCount;
}
export const FormsOverviewNavigationContext = createContext<FormsOverviewNavigation | null>(null);
