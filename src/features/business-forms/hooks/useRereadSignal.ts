import { useState } from "react";

/**
 * A list that reads again after something the person did (a decision, a save) keeps its rows in sight until the answer
 * arrives, and its table says so (`refreshing`, board LC2-A). `mark` is called by that action; a read on its own (on focus)
 * is not the person's and shows nothing. The signal ends with the new rows or with the failure.
 */
export function useRereadSignal(query: { isFetching: boolean; dataUpdatedAt: number }) {
  const [since, setSince] = useState<number | null>(null);
  return { rereading: since === query.dataUpdatedAt && query.isFetching, mark: () => setSince(query.dataUpdatedAt) };
}
