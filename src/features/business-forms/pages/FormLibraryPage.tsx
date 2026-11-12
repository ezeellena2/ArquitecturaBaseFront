import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";
import { useCurrentUser } from "@/auth/useCurrentUser";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback } from "@/shared/api/errorFeedback";
import { useCountdown } from "@/shared/hooks/useCountdown";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import { useQueryUpdate } from "@/shared/hooks/useQueryUpdate";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { DataList } from "@/shared/ui/DataList";
import { DataTable, type Column } from "@/shared/ui/DataTable";
import { FilterBar } from "@/shared/ui/FilterBar";
import { ForbiddenPage } from "@/shared/ui/ForbiddenPage";
import { Page } from "@/shared/ui/Page";
import { LockIcon, PlusIcon } from "@/shared/ui/icons";
import { SearchInput } from "@/shared/ui/SearchInput";
import { SegmentedControl } from "@/shared/ui/SegmentedControl";
import { Surface } from "@/shared/ui/Surface";
import type { FormLibrary as Library, FormStandard } from "../api/library";
import { FormStandardAddDialog } from "../components/FormStandardAddDialog";
import { folderPath, treeOrder } from "../folderTree";
import { useFolderScope, useFolderTree } from "../hooks/useFormFolders";
import { formLibraryKey, useFormLibrary } from "../hooks/useFormLibrary";

// BI1-A: «Biblioteca», the standards the installed modules bring. «Diseñar formularios» reads it and «Administrar formularios» adds a
// copy: an own draft that opens in the editor. DOC1: what each one reads and validates without AI, and the standards of the next
// stages as «Próximamente», rows without an action. The search and «Todos · Disponibles · Próximamente» go in the address: they are
// not private.
export function FormLibraryPage() {
  const { data: user } = useCurrentUser();
  const { i18n } = useTranslation("forms");
  if (!user?.permissions.includes("formtemplates.read")) return <ForbiddenPage />;
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

function FormLibrary({ actorId, culture, permissions, canAdd }: { actorId: string; culture: "es" | "en"; permissions: readonly string[]; canAdd: boolean }) {
  const { t } = useTranslation("forms");
  const client = useQueryClient();
  const [params] = useSearchParams();
  const update = useQueryUpdate();
  const search = params.get("search") ?? "";
  const chosen = params.get("availability");
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
  const list = new Intl.ListFormat(culture, { type: "conjunction" });
  // Available or coming soon is a choice only when some standard is coming; until the library arrives, it may be.
  const coming = library.data ? (library.data.upcoming?.length ?? 0) > 0 : true;
  const availability: Availability = coming && (chosen === "Available" || chosen === "Upcoming") ? chosen : "All";
  const { standards, upcoming } = libraryRows(library.data, search, culture);
  const rows = availability === "Available" ? standards : availability === "Upcoming" ? upcoming : [...standards, ...upcoming];
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
  const addButton = (standard: FormStandard, wide = false) => <Button type="button" size={wide ? "default" : "sm"} className={wide ? "w-full" : undefined} onClick={() => setAdding(standard)}
    aria-label={t("library.addTitle", { name: standard.name })}><PlusIcon className="size-4" aria-hidden="true" />{t("library.add")}</Button>;
  // One piece of data per column (UD1): what it reads, what it validates, the version, the module that brings it and how many of
  // your forms came from it; whether it is available, only where both kinds are listed.
  const columns: Column<Row>[] = [
    {
      id: "standard", header: t("library.standard"),
      cell: row => <div className="flex min-w-48 flex-col gap-0.5 whitespace-normal">
        <span className="font-medium">{row.name}</span>
        {row.description ? <span className="text-muted-foreground">{row.description}</span> : null}
      </div>,
    },
    ...has(standard => standard.reads) ? [{ id: "reads", header: t("library.reads"),
      cell: (row: Row) => <div className="min-w-56 whitespace-normal">{row.kind === "standard" ? reads(row.standard) ?? none : none}</div> }] : [],
    ...has(standard => standard.validations) ? [{ id: "validations", header: t("library.validations"),
      cell: (row: Row) => <div className="min-w-40 whitespace-normal">{row.kind === "standard" ? validations(row.standard) ?? none : none}</div> }] : [],
    ...has(standard => standard.version) ? [{ id: "version", header: t("library.version"), numeric: true, cell: (row: Row) => row.kind === "standard" ? row.standard.version : none }] : [],
    ...has(standard => standard.source) ? [{ id: "source", header: t("library.source"), cell: (row: Row) => row.kind === "standard" ? row.standard.source ?? none : none }] : [],
    ...has(standard => standard.copies) ? [{ id: "forms", header: t("library.forms"), numeric: true, cell: (row: Row) => row.kind === "standard" ? row.standard.copies : none }] : [],
    ...availability === "All" && coming ? [{ id: "state", header: t("library.state"),
      cell: (row: Row) => <Badge variant="outline">{t(row.kind === "standard" ? "library.available" : "library.upcoming")}</Badge> }] : [],
    ...canAdd && has(standard => standard.key) ? [{ id: "actions", header: t("actionsColumn"), align: "right" as const,
      cell: (row: Row) => row.kind === "standard" ? addButton(row.standard) : null }] : [],
  ];
  // The (i) says what the library is, how a standard that reads documents validates and, only to whoever can, invites to add one (premise 4.4).
  const help = [t("library.help"), ...library.data?.standards.some(standard => standard.reads) ? [t("library.helpReading")] : [], ...canAdd ? [t("library.helpAdd")] : []].join(" ");
  const count = (value: number) => library.data ? value : "…";
  const filters = <FilterBar><div className="flex flex-wrap items-center gap-3">
    <div className="w-full sm:w-72"><SearchInput value={search} onChange={value => update({ search: value })} label={t("search")} /></div>
    {/* On the phone the three options go apart and the one that does not fit goes to the next line, never out of sight. Without
        upcoming standards every one is available: there is nothing to choose. */}
    {coming ? <div className="max-w-full"><SegmentedControl wrap aria-label={t("library.state")} options={(["All", "Available", "Upcoming"] as const).map(key => ({ key,
      label: `${t(key === "All" ? "all" : key === "Available" ? "library.availableFilter" : "library.upcoming")} (${count(key === "All" ? standards.length + upcoming.length : key === "Available" ? standards.length : upcoming.length)})`,
      pressed: availability === key, onSelect: () => update({ availability: key === "All" ? undefined : key }) }))} /></div> : null}
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
          {canAdd && row.kind === "standard" ? addButton(row.standard, true) : null}
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
        onRetry={() => { void library.refetch(); }} retryReason={wait.isRunning ? t("common:code.retryIn", { seconds: wait.seconds }) : null}
        emptyTitle={filtered ? t("library.noMatches") : t("library.emptyTitle")}
        emptyAction={filtered ? <Button type="button" variant="outline" onClick={() => update({ search: undefined, availability: undefined })}>{t("clearFilters")}</Button> : undefined} />
    </Surface>
    {dialog}
  </Page>;
}
