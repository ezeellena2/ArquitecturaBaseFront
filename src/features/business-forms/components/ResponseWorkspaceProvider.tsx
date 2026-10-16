import { useCallback, useState, type ReactNode } from "react";
import { useLocation } from "react-router";
import { ResponseWorkspaceContext } from "../hooks/useResponseWorkspace";
import type { ResponseFilter } from "../responses";
export function ResponseWorkspaceProvider({
  owner,
  children,
}: {
  owner: string;
  children: ReactNode;
}) {
  const [state, setState] = useState<{
    owner: string;
    formId: string;
    filter: ResponseFilter;
    denied: boolean;
  }>({ owner, formId: "", filter: {}, denied: false });
  const activeForm = /^\/formularios\/([^/]+)\/respuestas(?:\/|$)/.exec(
    useLocation().pathname,
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
  );
}
