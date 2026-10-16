import { createContext } from "react";
export interface FormsResponseNavigation {
 canRead: boolean;
 items: readonly { id: string; name: string }[];
 hasMore: boolean;
 pending: boolean;
 failed: boolean;
 retry: () => void;
}
export const FormsResponseNavigationContext=createContext<FormsResponseNavigation|null>(null);
