import { lazy, Suspense, useCallback, useMemo, useState, type ReactNode, type RefObject } from "react";
import { useLocation } from "react-router";
import { useTranslation } from "react-i18next";
import { useCurrentUser } from "@/auth/useCurrentUser";
import { useSystemPresentation } from "@/shared/api/presentation";
import { FolderMenuNavigationContext, isEntryPath, type FolderMenuAction, type FolderMenuEntry, type FolderMenuNavigation } from "@/layouts/folderMenuNavigation";

const Reader = lazy(() => import("./FormMenuReader").then(module => ({ default: module.FormMenuReader })));
const Dialogs = lazy(() => import("./FormMenuDialogs").then(module => ({ default: module.FormMenuDialogs })));
// Who reads the menu (CM1): whoever opens forms, and whoever administers them, who also sees the empty folders.
const menuReaders = ["formrecords.read", "formapprovals.decide", "formrecords.create", "formtemplates.manage"];
export type FolderMenuState = Pick<FolderMenuNavigation, "content" | "pending" | "failed" | "retry">;

/// The folders of the side menu (CM1) for the shell: with the forms module installed and a permission that reads the menu, the
/// reader of the module (loaded lazily) brings them; otherwise there is nothing to draw. It also keeps which form was opened
/// from the menu, until its screens are left, and, for whoever administers forms, draws the dialog of what the menu asks for a
/// folder (CM2, CM4), loaded lazily the first time; the folder created there opens in the menu.
export function FormMenuShell({ children }: { children: ReactNode }) {
  const { data: user, isPending: userPending } = useCurrentUser();
  const presentation = useSystemPresentation();
  const { i18n } = useTranslation();
  const { pathname } = useLocation();
  const owner = [user?.id ?? "", i18n.language, [...(user?.permissions ?? [])].sort().join(",")].join(":");
  const enabled = presentation.data?.installedFeatures?.includes("forms") === true && !!user?.permissions.some(permission => menuReaders.includes(permission));
  const [loaded, setLoaded] = useState<{ owner: string; value: FolderMenuState } | null>(null);
  // The entry is recorded on the click, before the router moves: it goes away once the path leaves the form's screens.
  const [entry, setEntry] = useState<{ owner: string; value: FolderMenuEntry; from: string } | null>(null);
  // Each action is a dialog of its own (`id`), and it belongs to whoever asked for it.
  const [action, setAction] = useState<{ id: number; owner: string; value: FolderMenuAction; returnFocus: RefObject<HTMLElement | null> } | null>(null);
  const [created, setCreated] = useState<{ owner: string; id: string } | null>(null);
  // Once its screens open, `from` no longer counts: going back where the click was also leaves them.
  if (entry && isEntryPath(pathname, entry.value) && entry.from !== "") setEntry({ ...entry, from: "" });
  else if (entry && pathname !== entry.from && !isEntryPath(pathname, entry.value)) setEntry(null);
  const onState = useCallback((value: FolderMenuState) => setLoaded({ owner, value }), [owner]);
  const enter = useCallback((value: FolderMenuEntry) => setEntry({ owner, value, from: pathname }), [owner, pathname]);
  const act = useCallback((value: FolderMenuAction, returnFocus: RefObject<HTMLElement | null>) =>
    setAction(previous => ({ id: (previous?.id ?? 0) + 1, owner, value, returnFocus })), [owner]);
  const unknown = userPending || presentation.isPending;
  const state = enabled && loaded?.owner === owner ? loaded.value : null;
  const canManage = state?.content?.canManage === true;
  const value = useMemo<FolderMenuNavigation>(() => ({
    ...(state ?? { content: undefined, pending: enabled || unknown, failed: false, retry: () => undefined }),
    entry: entry?.owner === owner ? entry.value : null,
    enter,
    ...(canManage ? { act, created: created?.owner === owner ? created.id : null } : {}),
  }), [state, enabled, unknown, entry, owner, enter, canManage, act, created]);
  const open = canManage && state?.content && action?.owner === owner ? action : null;
  return (
    <FolderMenuNavigationContext.Provider value={value}>
      <Suspense fallback={null}>{enabled ? <Reader key={owner} onState={onState} /> : null}</Suspense>
      {children}
      {open && state?.content ? (
        <Suspense fallback={null}>
          <Dialogs key={open.id} action={open.value} content={state.content} returnFocus={open.returnFocus} onCreated={id => setCreated({ owner, id })} onClose={() => setAction(null)} />
        </Suspense>
      ) : null}
    </FolderMenuNavigationContext.Provider>
  );
}
