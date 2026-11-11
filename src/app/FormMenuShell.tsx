import { lazy, Suspense, useCallback, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "react-router";
import { useTranslation } from "react-i18next";
import { useCurrentUser } from "@/auth/useCurrentUser";
import { useSystemPresentation } from "@/shared/api/presentation";
import { FolderMenuNavigationContext, isEntryPath, type FolderMenuEntry, type FolderMenuNavigation } from "@/layouts/folderMenuNavigation";

const Reader = lazy(() => import("./FormMenuReader").then(module => ({ default: module.FormMenuReader })));
const openForms = ["formrecords.read", "formapprovals.decide", "formrecords.create"];
export type FolderMenuState = Pick<FolderMenuNavigation, "content" | "pending" | "failed" | "retry">;

/// The folders of the side menu (CP5-A) for the shell: with the forms module installed and a permission that opens forms, the
/// reader of the module (loaded lazily) brings them; otherwise there is nothing to draw. It also keeps which form was opened
/// from the menu, until its screens are left.
export function FormMenuShell({ children }: { children: ReactNode }) {
  const { data: user, isPending: userPending } = useCurrentUser();
  const presentation = useSystemPresentation();
  const { i18n } = useTranslation();
  const { pathname } = useLocation();
  const owner = [user?.id ?? "", i18n.language, [...(user?.permissions ?? [])].sort().join(",")].join(":");
  const enabled = presentation.data?.installedFeatures?.includes("forms") === true && !!user?.permissions.some(permission => openForms.includes(permission));
  const [loaded, setLoaded] = useState<{ owner: string; value: FolderMenuState } | null>(null);
  const [entry, setEntry] = useState<{ owner: string; value: FolderMenuEntry } | null>(null);
  if (entry && !isEntryPath(pathname, entry.value)) setEntry(null);
  const onState = useCallback((value: FolderMenuState) => setLoaded({ owner, value }), [owner]);
  const enter = useCallback((value: FolderMenuEntry) => setEntry({ owner, value }), [owner]);
  const unknown = userPending || presentation.isPending;
  const value = useMemo<FolderMenuNavigation>(() => ({
    ...(enabled && loaded?.owner === owner ? loaded.value : { content: undefined, pending: enabled || unknown, failed: false, retry: () => undefined }),
    entry: entry?.owner === owner ? entry.value : null,
    enter,
  }), [enabled, loaded, owner, unknown, entry, enter]);
  return (
    <FolderMenuNavigationContext.Provider value={value}>
      <Suspense fallback={null}>{enabled ? <Reader key={owner} onState={onState} /> : null}</Suspense>
      {children}
    </FolderMenuNavigationContext.Provider>
  );
}
