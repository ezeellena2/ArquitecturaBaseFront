import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useCurrentUser } from "@/auth/useCurrentUser";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback, readErrorMessage } from "@/shared/api/errorFeedback";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import { Button } from "@/shared/ui/button";
import { DataTable, type Column } from "@/shared/ui/DataTable";
import { ForbiddenPage } from "@/shared/ui/ForbiddenPage";
import { Page } from "@/shared/ui/Page";
import { PlusIcon } from "@/shared/ui/icons";
import { Surface } from "@/shared/ui/Surface";
import { fetchFormLibrary, type FormStandard } from "../api/library";
import { FormStandardAddDialog } from "../components/FormStandardAddDialog";
import { treeOrder } from "../folderTree";
import { useFolderScope, useFolderTree } from "../hooks/useFormFolders";
import { useUnobservedQueryCleanup } from "../hooks/useUnobservedQueryCleanup";

// BI1-A: «Biblioteca», the standards the installed modules bring (as DOC1 without reading documents). «Diseñar formularios» reads it and
// «Administrar formularios» adds a copy: an own draft that opens in the editor.
export function FormLibraryPage() {
  const { data: user } = useCurrentUser();
  const { i18n } = useTranslation("forms");
  if (!user?.permissions.includes("formtemplates.read")) return <ForbiddenPage />;
  const culture = i18n.language.startsWith("en") ? "en" : "es";
  const permissionsKey = [...user.permissions].sort().join(",");
  return <FormLibrary key={JSON.stringify([user.id, culture, permissionsKey])} actorId={user.id} culture={culture} permissionsKey={permissionsKey}
    canAdd={user.permissions.includes("formtemplates.manage")} />;
}

function FormLibrary({ actorId, culture, permissionsKey, canAdd }: { actorId: string; culture: "es" | "en"; permissionsKey: string; canAdd: boolean }) {
  const { t } = useTranslation("forms");
  const client = useQueryClient();
  const root = useMemo(() => ["form-library", actorId, culture, permissionsKey] as const, [actorId, culture, permissionsKey]);
  useUnobservedQueryCleanup(root);
  const library = useQuery({ queryKey: root, queryFn: ({ signal }) => fetchFormLibrary(signal), gcTime: 0, staleTime: 0, retry: false, meta: { errorOwner: "local" } });
  const [adding, setAdding] = useState<FormStandard | null>(null);
  // «Agregar» offers the folders of «Diseñar formularios»; without the tree the copy goes to the standard's.
  const tree = useFolderTree(useFolderScope(), "designs");
  // On a phone each standard is a card with «Agregar» as wide as the screen (DOC1 at 390 px); loading, failing and empty keep the table.
  const phone = useMediaQuery("(max-width: 639px)");
  const folders = useMemo(() => treeOrder(tree.data?.folders ?? []).map(entry => ({ id: entry.folder.id, name: entry.folder.name, depth: entry.depth })), [tree.data]);
  const forbidden = library.error instanceof ApiError && (library.error.status === 403 || library.error.status === 401);
  useEffect(() => { if (forbidden) client.removeQueries({ queryKey: root }); }, [forbidden, client, root]);
  if (forbidden) return <ForbiddenPage />;

  const failure = library.error ? errorFeedback(library.error) : null;
  const meta = (standard: FormStandard) => [t("library.meta", { version: standard.version }), standard.source, t("library.copies", { count: standard.copies })]
    .filter(Boolean).join(" · ");
  const columns: Column<FormStandard>[] = [
    {
      id: "standard", header: t("library.standard"),
      cell: standard => <div className="flex min-w-0 flex-col gap-0.5">
        <span className="font-medium">{standard.name}</span>
        {standard.description ? <span className="text-muted-foreground">{standard.description}</span> : null}
      </div>,
    },
    // One piece of data per column (UD1): the version, the module that brings it and how many forms came from it.
    { id: "version", header: t("library.version"), align: "right", cell: standard => standard.version },
    { id: "source", header: t("library.source"), cell: standard => standard.source ?? "—" },
    { id: "forms", header: t("library.forms"), align: "right", cell: standard => standard.copies },
    ...canAdd ? [{
      id: "actions", header: t("actionsColumn"), align: "right" as const,
      cell: (standard: FormStandard) => <Button type="button" size="sm" onClick={() => setAdding(standard)} aria-label={t("library.addTitle", { name: standard.name })}>
        <PlusIcon className="size-4" aria-hidden="true" />{t("library.add")}
      </Button>,
    }] : [],
  ];

  const standards = library.data?.standards ?? [];
  if (phone && standards.length > 0) return <Page title={t("library.title")} help={t("library.help")}>
    <ul className="flex flex-col gap-2">
      {standards.map(standard => <li key={standard.key}><Surface padded>
        <div className="flex flex-col gap-2">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="font-medium">{standard.name}</span>
            {standard.description ? <span className="text-muted-foreground">{standard.description}</span> : null}
            <span className="text-muted-foreground">{meta(standard)}</span>
          </div>
          {canAdd ? <Button type="button" className="w-full" onClick={() => setAdding(standard)} aria-label={t("library.addTitle", { name: standard.name })}>
            <PlusIcon className="size-4" aria-hidden="true" />{t("library.add")}
          </Button> : null}
        </div>
      </Surface></li>)}
    </ul>
    {adding ? <FormStandardAddDialog standard={adding} folders={folders} onOpenChange={open => { if (!open) setAdding(null); }} /> : null}
  </Page>;

  return <Page title={t("library.title")} help={t("library.help")}>
    <Surface>
      <DataTable columns={columns} rows={standards} rowKey={standard => standard.key} isLoading={library.isPending}
        hasData={library.data !== undefined}
        error={failure && !["cancelled", "session"].includes(failure.kind) ? t("library.loadError") : undefined}
        errorDescription={library.error ? readErrorMessage(library.error, t) : undefined}
        onRetry={() => { void library.refetch(); }}
        emptyTitle={t("library.emptyTitle")} emptyDescription={t("library.emptyDescription")} />
    </Surface>
    {adding ? <FormStandardAddDialog standard={adding} folders={folders} onOpenChange={open => { if (!open) setAdding(null); }} /> : null}
  </Page>;
}
