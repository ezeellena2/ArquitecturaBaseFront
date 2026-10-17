import { useCallback, useState, type ReactNode } from "react";
import { useLocation } from "react-router";
import { PrivateFormFilesScopeProvider } from "@/shared/hooks/PrivateFormFilesScope";
import { ResponseWorkspaceContext } from "../hooks/useResponseWorkspace";
import type { ResponseFilter } from "../responses";
export function ResponseWorkspaceProvider({
  owner,
  formId,
  children,
}: {
  owner: string;
  formId?: string;
  children: ReactNode;
}) {
  const [state, setState] = useState<{
    owner: string;
    formId: string;
    filter: ResponseFilter;
    denied: boolean;
  }>({ owner, formId: "", filter: {}, denied: false });
  const location = useLocation();
  const activeForm = formId ?? /^\/formularios\/([^/]+)\/respuestas(?:\/|$)/.exec(
    location.pathname,
  )?.[1];
  if (state.formId && state.formId !== activeForm)
    setState({ ...state, formId: "", filter: {} });
  if (state.owner !== owner)
    setState({ owner, formId: "", filter: {}, denied: false });
  const deny = useCallback(
    () =>
      setState((previous) =>
        previous.owner === owner && !previous.denied
          ? { owner, formId: "", filter: {}, denied: true }
          : previous,
      ),
    [owner],
  );
  return (
    <PrivateFormFilesScopeProvider scope={activeForm && !state.denied ? `${owner}:${activeForm}` : null}>
    <ResponseWorkspaceContext.Provider
      value={{
        denied: state.owner === owner && state.denied,
        deny,
        formId: state.owner === owner ? state.formId : "",
        filter: state.owner === owner ? state.filter : {},
        setFilter: (formId, filter) =>
          setState((previous) =>
            previous.owner === owner
              ? { ...previous, formId, filter }
              : previous,
          ),
      }}
    >
      {children}
    </ResponseWorkspaceContext.Provider>
    </PrivateFormFilesScopeProvider>
  );
}
