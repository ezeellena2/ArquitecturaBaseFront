import { useTranslation } from "react-i18next";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator } from "@/shared/ui/dropdown-menu";
import { FilterMenuTrigger } from "@/shared/ui/FilterMenuTrigger";
import { ChevronDownIcon } from "@/shared/ui/icons";
import { folderParamOf, treeOrder, withoutFolderParam } from "../folderTree";
import type { ListingFolders } from "../hooks/useFormFolders";

/// The «Carpeta» filter of Diseñar formularios and Catálogos (CM3), like Estado: «Todas» apart, «Sin carpeta» and the folders
/// with their subfolders under them, the tick on the left. What is chosen goes in the address (`useListingFolders`); a folder
/// shows what is in it and in its subfolders. While the folders cannot be read the listing goes on with «Todas» and the filter
/// says so with Reintentar (CP4).
export function FolderFilter({ folders }: { folders: ListingFolders }) {
  const { t } = useTranslation("formFolders");
  const { tree, selection, select, label } = folders;
  const failed = tree.isError && tree.data === undefined;
  return (
    <DropdownMenu>
      <FilterMenuTrigger>{t("selector", { name: label ?? t("all") })}<ChevronDownIcon aria-hidden="true" className="size-3.5" /></FilterMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuRadioGroup value={folderParamOf(selection) ?? ""}>
          <DropdownMenuRadioItem value="" onSelect={() => select({ kind: "all" })}>{t("all")}</DropdownMenuRadioItem>
          <DropdownMenuSeparator />
          {failed ? null : <>
            <DropdownMenuRadioItem value={withoutFolderParam} onSelect={() => select({ kind: "none" })}>{t("withoutFolder")}</DropdownMenuRadioItem>
            {treeOrder(tree.data?.folders ?? []).map(({ folder, depth }) => (
              <DropdownMenuRadioItem key={folder.id} value={folder.id} className={depth > 1 ? "pl-12" : undefined} onSelect={() => select({ kind: "folder", id: folder.id })}>
                {folder.name}
              </DropdownMenuRadioItem>
            ))}
          </>}
        </DropdownMenuRadioGroup>
        {failed ? <>
          <p className="px-2 py-1.5 text-sm text-[var(--color-content-muted)]">{t("loadFailed")}</p>
          {/* Reading again keeps the menu open: the folders take the place of the notice once they arrive. */}
          <DropdownMenuItem disabled={tree.isFetching} onSelect={event => { event.preventDefault(); void tree.refetch(); }}>
            {tree.isFetching ? t("retrying") : t("common:actions.retry")}
          </DropdownMenuItem>
        </> : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
