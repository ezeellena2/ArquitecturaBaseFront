import { createContext } from "react";
export interface FormsOverviewNavigation {
  count?: number;
  pending: boolean;
  failed: boolean;
  retry: () => void;
  setActive: (active: boolean) => void;
}
export const FormsOverviewNavigationContext = createContext<FormsOverviewNavigation | null>(null);
