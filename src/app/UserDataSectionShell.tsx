import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useCurrentUser } from "@/auth/useCurrentUser";
import { fetchUser, userQueryKey } from "@/features/users/api/users";
import { errorFeedback } from "@/shared/api/errorFeedback";
import { useSystemPresentation } from "@/shared/api/presentation";
import { UserDataSectionContext, type UserDataSectionProps } from "@/shared/hooks/userDataSectionContext";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Spinner } from "@/shared/ui/Spinner";
const LazySection = lazy(() => import("@/features/business-forms/components/PersonDataSection").then(module => ({ default: module.PersonDataSection })));
function Section(props: UserDataSectionProps) { return <Suspense fallback={<Spinner />}><LazySection {...props} /></Suspense>; }
const UserDialog = lazy(() => import("@/features/users/components/UserEditDialog").then(module => ({ default: module.UserEditDialog })));
/** The editor opened from another screen loads inside its own dialog: the opener is behind the overlay. */
function PendingUserDialog({ error, onRetry, onClose }: { error: unknown; onRetry?: () => void; onClose: () => void }) {
 const { t } = useTranslation();
 return <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogContent aria-describedby={undefined}><DialogHeader><DialogTitle>{t("users:edit.title")}</DialogTitle></DialogHeader>
  {!error ? <Spinner /> : errorFeedback(error).kind === "forbidden" ? <p role="alert" className="text-sm">{t("errors.forbidden.title")}</p> : <EmptyState embedded title={t("states.loadFailed")} action={<Button type="button" variant="outline" onClick={onRetry}>{t("actions.retry")}</Button>} />}
  <DialogFooter><Button type="button" variant="outline" onClick={onClose}>{t("actions.close")}</Button></DialogFooter>
 </DialogContent></Dialog>;
}
function Target({ userId, onClose }: { userId: string; onClose: () => void }) {
 const query = useQuery({ queryKey: userQueryKey(userId), queryFn: () => fetchUser(userId) });
 // The editor that replaces the pending dialog mounts after that dialog took the focus away from the opener, so its own restore has nothing to return to: the opener is restored here when focus was left on the page body.
 const opener = useRef<HTMLElement | null>(null);
 useLayoutEffect(() => { opener.current ??= document.activeElement instanceof HTMLElement ? document.activeElement : null; }, []);
 useEffect(() => () => { if (document.activeElement === document.body) opener.current?.focus(); }, []);
 if (!query.data) return <PendingUserDialog error={query.isError ? query.error : null} onRetry={() => void query.refetch()} onClose={onClose} />;
 return <Suspense fallback={<PendingUserDialog error={null} onClose={onClose} />}><UserDialog user={query.data} onClose={onClose} /></Suspense>;
}
export function UserDataSectionShell({ children }: { children: ReactNode }) {
 const { data: presentation } = useSystemPresentation();
 const { data: user } = useCurrentUser();
 const { i18n } = useTranslation();
 const owner = JSON.stringify([user?.id, i18n.language, [...(user?.permissions ?? [])].sort()]);
 const enabled = presentation?.installedFeatures?.includes("forms") === true && user?.permissions.includes("users.manage") === true;
 const canOpen = user?.permissions.includes("users.read") === true;
 const [target, setTarget] = useState<{ owner: string; userId: string } | null>(null);
 // The opener's notice belongs to the open editor; it is taken before calling it, so a second close never repeats it.
 const closed = useRef<(() => void) | undefined>(undefined);
 const close = useCallback(() => { const notify = closed.current; closed.current = undefined; setTarget(null); notify?.(); }, []);
 const openUser = useCallback((userId: string, onClosed?: () => void) => { if (enabled && canOpen) { closed.current = onClosed; setTarget({ owner, userId }); } }, [enabled, canOpen, owner]);
 const value = useMemo(() => enabled ? { Section, openUser } : null, [enabled, openUser]);
 return <UserDataSectionContext.Provider value={value}>{children}{enabled && target?.owner === owner ? <Target key={owner + target.userId} userId={target.userId} onClose={close} /> : null}</UserDataSectionContext.Provider>;
}
