import { lazy, Suspense, useCallback, useState, type ReactNode } from "react";
import { useLocation } from "react-router";
import { useTranslation } from "react-i18next";
import { useCurrentUser } from "@/auth/useCurrentUser";
import { FormsOverviewNavigationContext, type FormsNavigationCount } from "@/layouts/formsOverviewNavigation";
import { isFormsPath } from "@/layouts/navigation";
const Count = lazy(() => import("./FormOverviewCount").then(module => ({ default: module.FormOverviewCount })));
const DocumentsCount = lazy(() => import("./ReceivedDocumentsCount").then(module => ({ default: module.ReceivedDocumentsCount })));
export function FormOverviewShell({ children }: { children: ReactNode }) {
  const { data: user } = useCurrentUser();
  const { i18n } = useTranslation();
  const owner = [user?.id ?? "", i18n.language, [...(user?.permissions ?? [])].sort().join(",")].join(":");
  const { pathname } = useLocation();
  const allowed = !!user?.permissions.includes("formapprovals.decide");
  const [active, setActive] = useState(false);
  const [loaded, setLoaded] = useState<{ owner: string; value: FormsNavigationCount } | null>(null);
  const enabled = allowed && (isFormsPath(pathname) || active);
  const onState = useCallback((value: FormsNavigationCount) => setLoaded({ owner, value }), [owner]);
  const value = loaded?.owner === owner && enabled ? loaded.value : { pending: enabled, failed: false, retry: () => setActive(true) };
  // «Documentos recibidos» (DOC5-A) is read the same way, only with «Ver documentos recibidos».
  const documentsAllowed = !!user?.permissions.includes("formdocuments.read");
  const documentsEnabled = documentsAllowed && (isFormsPath(pathname) || active);
  const [documents, setDocuments] = useState<{ owner: string; value: FormsNavigationCount } | null>(null);
  const onDocuments = useCallback((value: FormsNavigationCount) => setDocuments({ owner, value }), [owner]);
  const documentsValue = !documentsAllowed ? undefined : documents?.owner === owner && documentsEnabled ? documents.value
    : { pending: documentsEnabled, failed: false, retry: () => setActive(true) };
  return <FormsOverviewNavigationContext.Provider value={{ ...value, setActive, documents: documentsValue }}>
    <Suspense fallback={null}>{enabled ? <Count key={owner} onState={onState}/> : null}</Suspense>
    <Suspense fallback={null}>{documentsEnabled ? <DocumentsCount key={owner} onState={onDocuments}/> : null}</Suspense>{children}
  </FormsOverviewNavigationContext.Provider>;
}
