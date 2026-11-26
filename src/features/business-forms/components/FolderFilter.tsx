import { useTranslation } from "react-i18next";
import { Picker, type PickerOption } from "@/shared/ui/Picker";
import { folderParamOf, folderPath, treeOrder, withoutFolderParam } from "../folderTree";
import type { ListingFolders } from "../hooks/useFormFolders";

/// The «Carpeta» filter of Diseñar formularios and Catálogos (CM3), like Estado: the only piece to choose with the button of the
/// bar (DS1-A), «Todas las carpetas» first and apart, then «Sin carpeta» and the folders with their subfolders indented under them,
/// the tick on the left. What is chosen goes in the address (`useListingFolders`); a folder shows what is in it and in its
/// subfolders. While the folders cannot be read the listing goes on with «Todas» and the list says so with Reintentar (CP4).
export function FolderFilter({ folders }: { folders: ListingFolders }) {
  const { t } = useTranslation("formFolders");
  const { tree, selection, select, label } = folders;
  const value = folderParamOf(selection) ?? "";
  const options: PickerOption[] = tree.data === undefined ? [] : [{ id: withoutFolderParam, label: t("withoutFolder") },
    // O57: a subfolder is indented on the screen, and the reader hears the folder it goes in («Norte, en Repartos»).
    ...treeOrder(tree.data.folders).map(({ folder, depth }) => ({ id: folder.id, label: folder.name, depth: depth - 1,
      ownerLabel: depth > 1 && folder.parentId ? t("filterInside", { path: folderPath(tree.data!.folders, folder.parentId).join(" / ") }) : undefined }))];
  return <Picker trigger="button" label={t("filter")} first={{ id: "", label: t("allFolders") }} options={options} value={value}
    // The folder of the address keeps its name while the folders arrive.
    selectedOptions={selection.kind === "folder" && label ? [{ id: selection.id, label }] : undefined}
    loading={tree.data === undefined && tree.isFetching} failed={tree.data === undefined && tree.isError && !tree.isFetching}
    onRetry={() => void tree.refetch()}
    onChange={id => {
      // Choosing the one it has changes nothing: it would go back to page 1.
      if (id === value) return;
      select(id === "" ? { kind: "all" } : id === withoutFolderParam ? { kind: "none" } : { kind: "folder", id });
    }} />;
}
