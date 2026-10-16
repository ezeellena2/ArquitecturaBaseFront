import { useEffect, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { PrivateFormFilesScopeContext } from "./privateFormFilesScopeContext";

export function PrivateFormFilesScopeProvider({ scope, children }: { scope: string | null; children: ReactNode }) {
  const client = useQueryClient();
  useEffect(() => () => {
    if (!scope) return;
    void client.cancelQueries({ queryKey: ["form-files", scope] });
    client.removeQueries({ queryKey: ["form-files", scope] });
  }, [client, scope]);
  return <PrivateFormFilesScopeContext.Provider value={scope}>{children}</PrivateFormFilesScopeContext.Provider>;
}
