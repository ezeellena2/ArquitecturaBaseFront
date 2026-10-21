import { lazy, Suspense, useCallback, useState, type ReactNode } from "react";
import { useLocation } from "react-router";
import { useTranslation } from "react-i18next";
import { useCurrentUser } from "@/auth/useCurrentUser";
import { FormsOverviewNavigationContext, type FormsOverviewNavigation } from "@/layouts/formsOverviewNavigation";
import { isFormsPath } from "@/layouts/navigation";
const Count = lazy(() => import("./FormOverviewCount").then(module => ({ default: module.FormOverviewCount })));
export function FormOverviewShell({ children }: { children: ReactNode }) {
  const { data: user } = useCurrentUser();
  const { i18n } = useTranslation();
  const owner = [user?.id ?? "", i18n.language, [...(user?.permissions ?? [])].sort().join(",")].join(":");
  const { pathname } = useLocation();
  const allowed = !!user?.permissions.includes("formapprovals.decide");
  const [active, setActive] = useState(false);
  const [loaded, setLoaded] = useState<{ owner: string; value: Omit<FormsOverviewNavigation, "setActive"> } | null>(null);
  const enabled = allowed && (isFormsPath(pathname) || active);
  const onState = useCallback((value: Omit<FormsOverviewNavigation, "setActive">) => setLoaded({ owner, value }), [owner]);
  const value = loaded?.owner === owner && enabled ? loaded.value : { pending: enabled, failed: false, retry: () => setActive(true) };
  return <FormsOverviewNavigationContext.Provider value={{ ...value, setActive }}>
    <Suspense fallback={null}>{enabled ? <Count key={owner} onState={onState}/> : null}</Suspense>{children}
  </FormsOverviewNavigationContext.Provider>;
}
