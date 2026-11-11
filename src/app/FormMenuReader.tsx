import { useEffect, useMemo } from "react";
import { useFormMenu } from "@/features/business-forms/hooks/useFormFolders";
import type { FolderMenuState } from "./FormMenuShell";

/// Reads the folders of the side menu with the forms module's hook and hands them to the shell, which does not know the module.
/// Reintentar goes back to the loading block until the menu arrives.
export function FormMenuReader({ onState }: { onState: (value: FolderMenuState) => void }) {
  const { query, links } = useFormMenu();
  const { refetch } = query;
  const value = useMemo<FolderMenuState>(() => ({
    content: links,
    pending: query.isPending,
    failed: query.isError && !query.isFetching && links === undefined,
    retry: () => { void refetch(); },
  }), [links, query.isPending, query.isError, query.isFetching, refetch]);
  useEffect(() => onState(value), [onState, value]);
  return null;
}
