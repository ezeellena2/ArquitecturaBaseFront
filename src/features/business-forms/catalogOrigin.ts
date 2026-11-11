import type { CatalogFeed, CatalogKind } from "./api/catalogResponse";

// Where the options of a catalog come from, as the listing, its filter and the editor name it: written by hand, people from the
// base with filters, or kept by an installed module (External, read-only), which this feature does not name.
const originKeys: Readonly<Record<CatalogKind, string>> = { Manual: "catalogs.source.manual", Filters: "catalogs.source.database", External: "catalogs.source.external" };
export const catalogOriginKey = (kind: CatalogKind) => originKeys[kind];

const day = 24 * 60 * 60 * 1000;

/** When an External catalog was last updated: within a day, how long ago («hace 2 horas»); before, the day, with numbers. */
export function catalogFeedUpdate(feed: CatalogFeed | undefined, now = Date.now()):{ readonly at: string; readonly recent: boolean } | null {
  if (!feed?.refreshedAtUtc) return null;
  return { at: feed.refreshedAtUtc, recent: now - Date.parse(feed.refreshedAtUtc) < day };
}

/** The last update failed: the forms keep the copy of `copyAt`, and whether the source did not answer, by the end of its code. */
export function catalogFeedFailure(feed: CatalogFeed | undefined): { readonly unavailable: boolean; readonly copyAt: string | null } | null {
  if (!feed?.failedAtUtc || !feed.failureCode) return null;
  return { unavailable: /unavailable$/i.test(feed.failureCode), copyAt: feed.refreshedAtUtc };
}
