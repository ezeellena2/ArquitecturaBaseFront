import { createContext } from "react";
export interface FormsResponseNavigation {
  canRead: boolean;
  canApprove?: boolean;
  approvalCount?: number;
  approvalsPending?: boolean;
  approvalsFailed?: boolean;
  retryApprovals?: () => void;
  items: readonly { id: string; name: string }[];
  totalCount: number;
  setActive?: (active: boolean) => void;
  hasMore: boolean;
  pending: boolean;
  failed: boolean;
  retry: () => void;
}
export const FormsResponseNavigationContext =
  createContext<FormsResponseNavigation | null>(null);
