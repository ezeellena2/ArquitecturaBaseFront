import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useCurrentUser } from "@/auth/useCurrentUser";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback } from "@/shared/api/errorFeedback";
import { useCountdown } from "@/shared/hooks/useCountdown";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import { Button } from "@/shared/ui/button";
import { DataTable, type Column } from "@/shared/ui/DataTable";
import { ForbiddenPage } from "@/shared/ui/ForbiddenPage";
import { Page } from "@/shared/ui/Page";
import { PlusIcon } from "@/shared/ui/icons";
import { Surface } from "@/shared/ui/Surface";
import type { FormStandard } from "../api/library";
import { FormStandardAddDialog } from "../components/FormStandardAddDialog";
import { folderPath, treeOrder } from "../folderTree";
import { useFolderScope, useFolderTree } from "../hooks/useFormFolders";
import { formLibraryKey, useFormLibrary } from "../hooks/useFormLibrary";

// BI1-A: «Biblioteca», the standards the installed modules bring (as DOC1 without reading documents). «Diseñar formularios» reads it and
// «Administrar formularios» adds a copy: an own draft that opens in the editor.
export function FormLibraryPage() {
  const { data: user } = useCurrentUser();
  const { i18n } = useTranslation("forms");
  if (!user?.permissions.includes("formtemplates.read")) return <ForbiddenPage />;
  const culture = i18n.language.startsWith("en") ? "en" : "es";
  const permissionsKey = [...user.permissions].sort().join(",");
  return <FormLibrary key={JSON.stringify([user.id, culture, permissionsKey])} actorId={user.id} culture={culture} permissions={user.permissions}
    canAdd={user.permissions.includes("formtemplates.manage")} />;
}

function FormLibrary({ actorId, culture, permissions, canAdd }: { actorId: string; culture: "es" | "en"; permissions: readonly string[]; canAdd: boolean }) {
  const { t } = useTranslation("forms");
  const client = useQueryClient();
  const scope = useMemo(() => ({ actorId, culture, permissions }), [actorId, culture, permissions]);
  // A failure goes to the common notice (premise 5.9); the table keeps «Reintentar», which waits what a 429 asks.
  const library = useFormLibrary(scope);
  const wait = useCountdown(0);
  const waitAsked = library.error instanceof ApiError ? library.error.retryAfterSeconds : undefined;
  const { restart } = wait;
  useEffect(() => { if (waitAsked !== undefined) restart(waitAsked); }, [waitAsked, library.errorUpdatedAt, restart]);
  const [adding, setAdding] = useState<FormStandard | null>(null);
  // «Agregar» offers the folders of «Diseñar formularios»; without the tree the copy goes to the standard's.
  const tree = useFolderTree(useFolderScope(), "designs");
  // On a phone each standard is a card with «Agregar» as wide as the screen (DOC1 at 390 px); loading, failing and empty keep the table.
  const phone = useMediaQuery("(max-width: 639px)");
  const folders = useMemo(() => { const all = tree.data?.folders ?? []; return treeOrder(all).map(entry => ({ id: entry.folder.id, path: folderPath(all, entry.folder.id).join(" / ") })); }, [tree.data]);
  const forbidden = library.error instanceof ApiError && (library.error.status === 403 || library.error.status === 401);
  useEffect(() => { if (forbidden) client.removeQueries({ queryKey: formLibraryKey(scope) }); }, [forbidden, client, scope]);
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
  // The (i) invites to add one only whoever can (premise 4.4).
  const help = canAdd ? t("library.help") + " " + t("library.helpAdd") : t("library.help");
  if (phone && standards.length > 0) return <Page title={t("library.title")} help={help}>
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

  return <Page title={t("library.title")} help={help}>
    <Surface>
      <DataTable columns={columns} rows={standards} rowKey={standard => standard.key} isLoading={library.isPending}
        hasData={library.data !== undefined}
        error={failure && !["cancelled", "session"].includes(failure.kind) ? t("library.loadError") : undefined}
        onRetry={() => { void library.refetch(); }} retryReason={wait.isRunning ? t("common:code.retryIn", { seconds: wait.seconds }) : null}
        emptyTitle={t("library.emptyTitle")} />
    </Surface>
    {adding ? <FormStandardAddDialog standard={adding} folders={folders} onOpenChange={open => { if (!open) setAdding(null); }} /> : null}
  </Page>;
}
