import { lazy, Suspense, useCallback, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useCurrentUser } from "@/auth/useCurrentUser";
import { fetchUser, userQueryKey } from "@/features/users/api/users";
import { useSystemPresentation } from "@/shared/api/presentation";
import { UserDataSectionContext, type UserDataSectionProps } from "@/shared/hooks/userDataSectionContext";
import { Button } from "@/shared/ui/button";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Spinner } from "@/shared/ui/Spinner";
const LazySection = lazy(() => import("@/features/business-forms/components/PersonDataSection").then(module => ({ default: module.PersonDataSection })));
function Section(props: UserDataSectionProps) { return <Suspense fallback={<Spinner />}><LazySection {...props} /></Suspense>; }
const UserDialog = lazy(() => import("@/features/users/components/UserEditDialog").then(module => ({ default: module.UserEditDialog })));
function Target({ userId, onClose }: { userId: string; onClose: () => void }) {
 const { t } = useTranslation();
 const query = useQuery({ queryKey: userQueryKey(userId), queryFn: () => fetchUser(userId) });
 if (query.isError && !query.data) return <EmptyState title={t("states.loadFailed")} action={<Button variant="outline" onClick={onClose}>{t("actions.close")}</Button>} />;
 return query.data ? <Suspense fallback={<Spinner />}><UserDialog user={query.data} onClose={onClose} /></Suspense> : <Spinner />;
}
export function UserDataSectionShell({ children }: { children: ReactNode }) {
 const { data: presentation } = useSystemPresentation();
 const { data: user } = useCurrentUser();
 const { i18n } = useTranslation();
 const owner = JSON.stringify([user?.id, i18n.language, [...(user?.permissions ?? [])].sort()]);
 const enabled = presentation?.installedFeatures?.includes("forms") === true && user?.permissions.includes("users.manage") === true;
 const canOpen = user?.permissions.includes("users.read") === true;
 const [target, setTarget] = useState<{ owner: string; userId: string } | null>(null);
 const close = useCallback(() => setTarget(null), []);
 const openUser = useCallback((userId: string) => { if (enabled && canOpen) setTarget({ owner, userId }); }, [enabled, canOpen, owner]);
 const value = useMemo(() => enabled ? { Section, openUser } : null, [enabled, openUser]);
 return <UserDataSectionContext.Provider value={value}>{children}{enabled && target?.owner === owner ? <Target key={owner + target.userId} userId={target.userId} onClose={close} /> : null}</UserDataSectionContext.Provider>;
}
