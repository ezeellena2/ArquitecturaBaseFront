import { expect, it } from "vitest";
import { delay, http, HttpResponse } from "msw";
import { server } from "@/test/mocks/server";
import { fetchResponseRecordNavigation, responseRecordNavigationSchema } from "./responses";

const formId = "0199a0c0-0000-7000-8000-000000000001";
const recordId = "0199a0c0-0000-7000-8000-000000000002";
const previousId = "0199a0c0-0000-7000-8000-000000000003";
const nextId = "0199a0c0-0000-7000-8000-000000000004";
// Synthetic navigation projection; actual HTTP bodies are qualified separately.
const middle = { recordId, previousId, nextId, position: 21, totalCount: 43 };
const path = `/api/forms/definitions/${formId}/records/${recordId}/navigation`;
const signal = () => new AbortController().signal;

it("keeps the anchored record position outside the first page", () => {
  expect(responseRecordNavigationSchema.parse(middle)).toEqual(middle);
});
it.each([
  { ...middle, previousId: null, position: 1 },
  { ...middle, nextId: null, position: 43 },
  { recordId, previousId: null, nextId: null, position: 1, totalCount: 1 },
])("represents both boundaries without invented neighbors", value => {
  expect(responseRecordNavigationSchema.parse(value)).toEqual(value);
});
it.each([
  { ...middle, position: 0 },
  { ...middle, position: 44 },
  { ...middle, totalCount: 0 },
  { ...middle, previousId: null },
  { ...middle, nextId: null },
  { ...middle, previousId: recordId },
  { ...middle, nextId: previousId },
  { ...middle, extra: true },
  { ...middle, recordId: undefined },
])("rejects an incomplete or contradictory navigation projection", value => {
  expect(responseRecordNavigationSchema.safeParse(value).success).toBe(false);
});
it("posts the search contract with no private query string and bypasses HTTP caching", async () => {
  let observed: { url: string; cache: string; body: unknown } | undefined;
  const query = { page: 1, pageSize: 20, sort: "-number", versionIds: [nextId] };
  server.use(http.post(path, async ({ request }) => {
    observed = { url: request.url, cache: request.cache, body: await request.json() };
    return HttpResponse.json(middle);
  }));
  expect(await fetchResponseRecordNavigation(formId, recordId, query, signal())).toEqual(middle);
  expect(observed).toEqual({ url: expect.stringMatching(/\/navigation$/), cache: "no-store", body: query });
});
it("rejects a response anchored on a different record without retaining its body", async () => {
  server.use(http.post(path, () => HttpResponse.json({ ...middle, recordId: formId })));
  const error = await fetchResponseRecordNavigation(formId, recordId, { page: 1, pageSize: 20 }, signal()).catch(value => value as unknown);
  expect(error).toBeInstanceOf(Error);
  expect(error).not.toHaveProperty("issues");
  expect((error as Error).message).not.toContain(formId);
});
it("compares valid UUID route identities independently of letter casing", async () => {
  server.use(http.post("/api/forms/definitions/:formId/records/:recordId/navigation", () => HttpResponse.json(middle)));
  expect(await fetchResponseRecordNavigation(formId.toUpperCase(), recordId.toUpperCase(), { page: 1, pageSize: 20 }, signal())).toEqual(middle);
});
it("rejects invalid route identities before making a request", async () => {
  let requests = 0;
  server.use(http.post("*", () => { requests++; return HttpResponse.json(middle); }));
  await expect(fetchResponseRecordNavigation("../private", recordId, { page: 1, pageSize: 20 }, signal())).rejects.toThrow();
  await expect(fetchResponseRecordNavigation(formId, "../private", { page: 1, pageSize: 20 }, signal())).rejects.toThrow();
  expect(requests).toBe(0);
});
it("cancels a delayed navigation when its detail owner is withdrawn", async () => {
  server.use(http.post(path, async () => { await delay(50); return HttpResponse.json(middle); }));
  const controller = new AbortController();
  const request = fetchResponseRecordNavigation(formId, recordId, { page: 1, pageSize: 20 }, controller.signal);
  controller.abort();
  await expect(request).rejects.toMatchObject({ name: "AbortError" });
});
