import { beforeEach, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/mocks/server";
import { queryClient } from "@/shared/api/queryClient";
import { approvalTaskFixture } from "@/test/approvalFixtures";
import { fetchApprovalContinuation, readApprovalContinuation } from "./approvals";

const id = (value: number) => "0199a0c0-0000-7000-8000-" + String(value).padStart(12, "0");
const anchor = approvalTaskFixture();
const path = "/api/forms/approvals/" + anchor.id + "/continuation";
const query = { definitionId: anchor.definitionId, direction: "Next" as const, pageSize: 2 };
// Explicit synthetic metadata. The real producer will be qualified after the joint export.
const body = () => ({ anchorTaskId: anchor.id, definitionId: anchor.definitionId, direction: "Next" as const,
  items: [4, 5].map((position, index) => ({ task: { ...approvalTaskFixture(), id: id(81 + index), recordId: id(91 + index) }, position })),
  totalCount: 6, hasMore: true });
beforeEach(() => queryClient.clear());

it("preserves the current positions and ascending task order in either continuation direction", () => {
  expect(readApprovalContinuation(body())).toEqual(body());
  const previous = { ...body(), direction: "Previous", items: body().items.map((item, index) => ({ ...item, position: index + 1 })), hasMore: false };
  expect(readApprovalContinuation(previous)).toEqual(previous);
});
it.each([0, 6])("accepts an empty continuation with an independently resolved anchor and total %s", totalCount => {
  const empty = { ...body(), items: [], totalCount, hasMore: false };
  expect(readApprovalContinuation(empty)).toEqual(empty);
});
it.each([
  () => ({ ...body(), extra: "private text" }),
  () => ({ ...body(), anchorTaskId: undefined }),
  () => ({ ...body(), definitionId: "not-an-id" }),
  () => ({ ...body(), direction: "Back" }),
  () => ({ ...body(), totalCount: -1 }),
  () => ({ ...body(), totalCount: Number.MAX_SAFE_INTEGER + 1 }),
  () => ({ ...body(), items: [], hasMore: true }),
  () => ({ ...body(), items: [{ ...body().items[0], extra: "private text" }] }),
  () => ({ ...body(), items: [{ ...body().items[0], position: 0 }] }),
  () => ({ ...body(), items: [{ ...body().items[0], position: 7 }] }),
  () => ({ ...body(), items: [body().items[1], body().items[0]] }),
  () => ({ ...body(), items: [body().items[0], { ...body().items[1], position: 6 }] }),
  () => ({ ...body(), items: [{ ...body().items[0], task: anchor }] }),
  () => ({ ...body(), items: [body().items[0], { ...body().items[1], task: body().items[0].task }] }),
  () => ({ ...body(), items: [{ ...body().items[0], task: { ...body().items[0].task, definitionId: id(99) } }] }),
  () => ({ ...body(), items: [{ ...body().items[0], task: { ...body().items[0].task, state: "Approved" } }] }),
  () => ({ ...body(), items: [{ ...body().items[0], task: { ...body().items[0].task, canDecide: false, cannotDecideReason: "OwnResponse" } }] }),
  () => ({ ...body(), items: [{ ...body().items[0], task: { ...body().items[0].task, values: "private answer" } }] }),
])("rejects a malformed, contradictory or unauthorized continuation without retaining its payload", malformed => {
  let failure: unknown;
  try { readApprovalContinuation(malformed()); } catch (error) { failure = error; }
  expect(failure).toBeInstanceOf(Error);
  expect((failure as Error).message).toBe("Invalid form approval contract.");
  expect(failure).not.toHaveProperty("issues");
  expect(failure).not.toHaveProperty("body");
});
it("reads only metadata with no-store and never places the body in a client cache", async () => {
  let observed: { search: Record<string, string>; cache: string; method: string } | undefined;
  server.use(http.get(path, ({ request }) => {
    observed = { search: Object.fromEntries(new URL(request.url).searchParams), cache: request.cache, method: request.method };
    return HttpResponse.json(body());
  }));
  expect(await fetchApprovalContinuation(anchor.id, query)).toEqual(body());
  expect(observed).toEqual({ search: { definitionId: anchor.definitionId, direction: "Next", pageSize: "2" }, cache: "no-store", method: "GET" });
  expect(queryClient.getQueryCache().getAll()).toEqual([]);
  expect(queryClient.getMutationCache().getAll()).toEqual([]);
});
it.each([
  () => ({ ...body(), anchorTaskId: id(99) }),
  () => ({ ...body(), definitionId: id(99), items: [], hasMore: false }),
  () => ({ ...body(), direction: "Previous" }),
  () => ({ ...body(), items: body().items.slice(0, 1), hasMore: true }),
  () => ({ ...body(), items: [...body().items, { task: { ...body().items[1].task, id: id(83) }, position: 6 }] }),
])("rejects a mismatched response or a batch outside the requested boundary", response => {
  server.use(http.get(path, () => HttpResponse.json(response())));
  return expect(fetchApprovalContinuation(anchor.id, query)).rejects.toThrow("Invalid form approval contract.");
});
it("compares the requested UUID identities without letter casing", async () => {
  server.use(http.get("/api/forms/approvals/:id/continuation", () => HttpResponse.json(body())));
  expect(await fetchApprovalContinuation(anchor.id.toUpperCase(), { ...query, definitionId: anchor.definitionId.toUpperCase() })).toEqual(body());
});
it.each([
  { taskId: "../private", query },
  { taskId: anchor.id, query: { ...query, definitionId: "../private" } },
  { taskId: anchor.id, query: { ...query, direction: "Back" } },
  { taskId: anchor.id, query: { ...query, pageSize: 0 } },
  { taskId: anchor.id, query: { ...query, pageSize: 101 } },
  { taskId: anchor.id, query: { ...query, privateText: "private query" } },
])("rejects invalid request identities and limits before transport", async invalid => {
  let requests = 0;
  server.use(http.get("*", () => { requests++; return HttpResponse.json(body()); }));
  await expect(fetchApprovalContinuation(invalid.taskId, invalid.query as typeof query)).rejects.toThrow();
  expect(requests).toBe(0);
});
it("aborts a retained request when its owner cancels the read", async () => {
  let started!: () => void;
  const ready = new Promise<void>(resolve => { started = resolve; });
  let finish!: () => void;
  const finished = new Promise<void>(resolve => { finish = resolve; });
  server.use(http.get(path, async () => { started(); await finished; return HttpResponse.json(body()); }));
  const controller = new AbortController();
  const reading = fetchApprovalContinuation(anchor.id, query, controller.signal);
  await ready; controller.abort(); finish();
  await expect(reading).rejects.toMatchObject({ name: "AbortError" });
});
