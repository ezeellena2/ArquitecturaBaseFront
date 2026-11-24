import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";
import { useCurrentUser } from "@/auth/useCurrentUser";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback } from "@/shared/api/errorFeedback";
import { useClientSort } from "@/shared/hooks/useClientSort";
import { useCountdown } from "@/shared/hooks/useCountdown";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import { useQueryUpdate } from "@/shared/hooks/useQueryUpdate";
import { useWaitText } from "@/shared/hooks/useWaitText";
import { toggledSort, type SortValue } from "@/shared/lib/sort";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { DataList } from "@/shared/ui/DataList";
import { DataTable, type Column } from "@/shared/ui/DataTable";
import { FilterBar } from "@/shared/ui/FilterBar";
import { ForbiddenPage } from "@/shared/ui/ForbiddenPage";
import { Page } from "@/shared/ui/Page";
import { Picker } from "@/shared/ui/Picker";
import { LockIcon, PlusIcon } from "@/shared/ui/icons";
import { RowActions } from "@/shared/ui/RowActions";
import { SearchInput } from "@/shared/ui/SearchInput";
import { SortMenu } from "@/shared/ui/SortMenu";
import { Surface } from "@/shared/ui/Surface";
import type { FormLibrary as Library, FormStandard } from "../api/library";
import { FormStandardAddDialog } from "../components/FormStandardAddDialog";
import { folderPath, treeOrder } from "../folderTree";
import { useFolderScope, useFolderTree } from "../hooks/useFormFolders";
import { formLibraryKey, useFormLibrary } from "../hooks/useFormLibrary";

// BI1-A: «Biblioteca», the standards the installed modules bring. «Diseñar formularios» reads it and «Administrar formularios» adds a
// copy: an own draft that opens in the editor. DOC1: what each one reads and validates without AI, and the standards of the next
// stages as «Próximamente», rows without an action. The search, the state («Todos», «Disponibles», «Próximamente») and the order go in
// the address: they are not private.
export function FormLibraryPage() {
  const { data: user } = useCurrentUser();
  const { t, i18n } = useTranslation("forms");
  if (!user?.permissions.includes("formtemplates.read")) return <ForbiddenPage title={t("library.title")} />;
  const culture = i18n.language.startsWith("en") ? "en" : "es";
  const permissionsKey = [...user.permissions].sort().join(",");
  return <FormLibrary key={JSON.stringify([user.id, culture, permissionsKey])} actorId={user.id} culture={culture} permissions={user.permissions}
    canAdd={user.permissions.includes("formtemplates.manage")} />;
}

type Availability = "All" | "Available" | "Upcoming";
type Row = { readonly kind: "standard"; readonly key: string; readonly name: string; readonly description: string; readonly standard: FormStandard }
  | { readonly kind: "upcoming"; readonly key: string; readonly name: string; readonly description: string };
// The search compares names without case or accents, over the whole library: it comes entire, without pages.
const folded = (text: string, culture: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase(culture);
function libraryRows(library: Library | undefined, search: string, culture: string) {
  const typed = folded(search.trim(), culture);
  const matches = (name: string) => !typed || folded(name, culture).includes(typed);
  const standards: Row[] = (library?.standards ?? []).filter(standard => matches(standard.name))
    .map(standard => ({ kind: "standard", key: standard.key, name: standard.name, description: standard.description, standard }));
  const upcoming: Row[] = (library?.upcoming ?? []).filter(item => matches(item.name)).map(item => ({ kind: "upcoming", ...item }));
  return { standards, upcoming };
}
// The library arrives whole, so it orders in the browser (OT1-C), by the id of each column. An upcoming standard has no version, module or
// copies: it goes last in both directions. The state goes in the order of the circuit, available first.
const sortValues: Readonly<Record<string, (row: Row) => SortValue>> = {
  name: row => row.name,
  version: row => row.kind === "standard" ? row.standard.version : null,
  source: row => row.kind === "standard" ? row.standard.source : null,
  copies: row => row.kind === "standard" ? row.standard.copies : null,
  availability: row => row.kind === "standard" ? 0 : 1,
};

function FormLibrary({ actorId, culture, permissions, canAdd }: { actorId: string; culture: "es" | "en"; permissions: readonly string[]; canAdd: boolean }) {
  const { t } = useTranslation("forms");
  const client = useQueryClient();
  const [params] = useSearchParams();
  const update = useQueryUpdate();
  const search = params.get("search") ?? "";
  const chosen = params.get("availability");
  const sort = params.get("sort") ?? undefined;
  const scope = useMemo(() => ({ actorId, culture, permissions }), [actorId, culture, permissions]);
  // A failure goes to the common notice (premise 5.9); the table keeps «Reintentar», which waits what a 429 asks.
  const library = useFormLibrary(scope);
  const wait = useCountdown(0);
  const waitText = useWaitText();
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
  // Available or coming soon is a choice only when some standard is coming; until the library arrives, it may be.
  const coming = library.data ? (library.data.upcoming?.length ?? 0) > 0 : true;
  const availability: Availability = coming && (chosen === "Available" || chosen === "Upcoming") ? chosen : "All";
  const { standards, upcoming } = libraryRows(library.data, search, culture);
  const rows = useClientSort(availability === "Available" ? standards : availability === "Upcoming" ? upcoming : [...standards, ...upcoming], sortValues);
  if (forbidden) return <ForbiddenPage title={t("library.title")} />;

  const failure = library.error ? errorFeedback(library.error) : null;
  const list = new Intl.ListFormat(culture, { type: "conjunction" });
  const filtered = !!search.trim() || availability !== "All";
  // A column only when a standard of the filter has its datum, whatever is searched: «Próximamente» lists only names and descriptions,
  // and no column goes full of «—». Until the library arrives, all of them.
  const listed = availability === "Upcoming" ? [] : library.data?.standards;
  const has = (datum: (standard: FormStandard) => unknown) => !listed || listed.some(standard => datum(standard) !== undefined);
  const reads = (standard: FormStandard) => standard.reads ? list.format(standard.reads.map(item => item.name)) : null;
  // The fixed validations name the data validated; that it is their check digits, without AI, the page's (i) says.
  const validations = (standard: FormStandard) => standard.validations ? <span className="inline-flex items-start gap-1">
    <LockIcon aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-[var(--color-content-muted)]" />{list.format(standard.validations.map(item => item.name))}</span> : null;
  const none = <span className="text-[var(--color-content-muted)]">—</span>;
  const meta = (standard: FormStandard) => [t("library.meta", { version: standard.version }), standard.source, t("library.copies", { count: standard.copies })]
    .filter(Boolean).join(" · ");
  // On the phone each standard is a card and «Agregar» takes its whole width; in the table it is an icon of the row (2026-11-20).
  const addButton = (standard: FormStandard) => <Button type="button" className="w-full" onClick={() => setAdding(standard)}
    aria-label={t("library.addTitle", { name: standard.name })}><PlusIcon className="size-4" aria-hidden="true" />{t("library.add")}</Button>;
  // One piece of data per column (UD1): what it reads, what it validates, the version, the module that brings it and how many of
  // your forms came from it; whether it is available, only where both kinds are listed. Each column with a datum orders (OT1-C) by its
  // id in `sortValues`; what it reads or validates are several values, and they do not.
  const columns: Column<Row>[] = [
    {
      id: "name", header: t("library.standard"), sortable: true, sortKind: "text",
      cell: row => <div className="flex min-w-48 flex-col gap-0.5 whitespace-normal">
        <span className="font-medium">{row.name}</span>
        {row.description ? <span className="text-muted-foreground">{row.description}</span> : null}
      </div>,
    },
    ...has(standard => standard.reads) ? [{ sortable: false as const, id: "reads", header: t("library.reads"),
      cell: (row: Row) => <div className="min-w-56 whitespace-normal">{row.kind === "standard" ? reads(row.standard) ?? none : none}</div> }] : [],
    ...has(standard => standard.validations) ? [{ sortable: false as const, id: "validations", header: t("library.validations"),
      cell: (row: Row) => <div className="min-w-40 whitespace-normal">{row.kind === "standard" ? validations(row.standard) ?? none : none}</div> }] : [],
    ...has(standard => standard.version) ? [{ id: "version", header: t("library.version"), sortable: true as const, sortKind: "number" as const, numeric: true, cell: (row: Row) => row.kind === "standard" ? row.standard.version : none }] : [],
    ...has(standard => standard.source) ? [{ id: "source", header: t("library.source"), sortable: true as const, sortKind: "text" as const, cell: (row: Row) => row.kind === "standard" ? row.standard.source ?? none : none }] : [],
    ...has(standard => standard.copies) ? [{ id: "copies", header: t("library.forms"), sortable: true as const, sortKind: "number" as const, numeric: true, cell: (row: Row) => row.kind === "standard" ? row.standard.copies : none }] : [],
    ...availability === "All" && coming ? [{ id: "availability", header: t("library.state"), sortable: true as const, sortKind: "state" as const,
      cell: (row: Row) => <Badge variant="outline">{t(row.kind === "standard" ? "library.available" : "library.upcoming")}</Badge> }] : [],
    ...canAdd && has(standard => standard.key) ? [{ sortable: false as const, id: "actions", header: t("actionsColumn"), align: "right" as const,
      cell: (row: Row) => row.kind === "standard" ? <RowActions actions={[{ label: t("library.add"), accessibleName: t("library.addTitle", { name: row.standard.name }),
        icon: PlusIcon, onSelect: () => setAdding(row.standard) }]} /> : null }] : [],
  ];
  // The (i) says what the library is, how a standard that reads documents validates and, only to whoever can, invites to add one (premise 4.4).
  const help = [t("library.help"), ...library.data?.standards.some(standard => standard.reads) ? [t("library.helpReading")] : [], ...canAdd ? [t("library.helpAdd")] : []].join(" ");
  const filters = <FilterBar><div className="flex flex-wrap items-center gap-3">
    <div className="w-full sm:w-72"><SearchInput value={search} onChange={value => update({ search: value })} label={t("search")} /></div>
    {/* The state is the only piece to choose with the button of the bar (DS1-A, also the filters since 2026-11-22), without counts
        (FO1-A): «Todos» first and apart. Without upcoming standards every one is available: there is nothing to choose. */}
    {coming ? <Picker trigger="button" label={t("library.state")} first={{ id: "", label: t("all") }}
      options={[{ id: "Available", label: t("library.availableFilter") }, { id: "Upcoming", label: t("library.upcoming") }]}
      value={availability === "All" ? "" : availability}
      onChange={id => { if (id !== (availability === "All" ? "" : availability)) update({ availability: id || undefined }); }} /> : null}
    {/* Last in the bar, apart from the filters: it takes no rows out (OT1-C). */}
    <SortMenu columns={columns} sort={sort} onSortChange={next => update({ sort: next })} />
  </div></FilterBar>;
  const dialog = adding ? <FormStandardAddDialog standard={adding} folders={folders} onOpenChange={open => { if (!open) setAdding(null); }} /> : null;

  if (phone && rows.length > 0) return <Page title={t("library.title")} help={help}>
    {filters}
    <ul className="flex flex-col gap-2">
      {rows.map(row => <li key={row.kind + ":" + row.key}><Surface padded>
        <div className="flex flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="font-medium">{row.name}</span>
              {row.description ? <span className="text-muted-foreground">{row.description}</span> : null}
              {row.kind === "standard" ? <span className="text-muted-foreground">{meta(row.standard)}</span> : null}
            </div>
            {row.kind === "upcoming" && availability === "All" ? <Badge variant="outline">{t("library.upcoming")}</Badge> : null}
          </div>
          {row.kind === "standard" && (row.standard.reads || row.standard.validations) ? <DataList items={[
            ...row.standard.reads ? [{ key: "reads", label: t("library.reads"), value: reads(row.standard) }] : [],
            ...row.standard.validations ? [{ key: "validations", label: t("library.validations"), value: validations(row.standard) }] : [],
          ]} /> : null}
          {canAdd && row.kind === "standard" ? addButton(row.standard) : null}
        </div>
      </Surface></li>)}
    </ul>
    {dialog}
  </Page>;

  return <Page title={t("library.title")} help={help}>
    {filters}
    <Surface>
      <DataTable columns={columns} rows={rows} rowKey={row => row.kind + ":" + row.key} isLoading={library.isPending}
        hasData={library.data !== undefined}
        error={failure && !["cancelled", "session"].includes(failure.kind) ? t("library.loadError") : undefined}
        onRetry={() => { void library.refetch(); }} retryReason={wait.isRunning ? t("common:code.retryIn", { wait: waitText(wait.seconds) }) : null}
        sort={sort} onSortChange={(field, kind) => update({ sort: toggledSort(sort, field, kind) })}
        emptyTitle={filtered ? t("library.noMatches") : t("library.emptyTitle")}
        emptyAction={filtered ? <Button type="button" variant="outline" onClick={() => update({ search: undefined, availability: undefined })}>{t("clearFilters")}</Button> : undefined} />
    </Surface>
    {dialog}
  </Page>;
}
