import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/mocks/server";
import {
  responseSheetSchema,
  responseDetailSchema,
  responseNavigationSchema,
  responseFacetSchema,
  fetchResponseSheet,
  fetchResponseDetail,
} from "./responses";
const directory = resolve("src/test/fixtures/forms-responses-http");
const raw = (name: string) => readFileSync(resolve(directory, name), "utf8");
it("qualifies unchanged HTTP bodies and workbook from the backend producer", () => {
  const source = JSON.parse(raw("provenance.json")) as {
    producer: string;
    captures: { name: string; length: number; sha256: string }[];
  };
  expect(source.producer).toContain("FormResponseHttpTests");
  expect(source.captures.length).toBeGreaterThanOrEqual(10);
  for (const entry of source.captures) {
    const bytes = readFileSync(resolve(directory, entry.name));
    expect(bytes.length, entry.name).toBe(entry.length);
    expect(createHash("sha256").update(bytes).digest("hex"), entry.name).toBe(
      entry.sha256,
    );
  }
  for (const name of [
    "sheet-es.json",
    "sheet-en.json",
    "filtered-es.json",
    "files-sheet-es.json",
  ])
    expect(
      responseSheetSchema.safeParse(JSON.parse(raw(name))).success,
      name,
    ).toBe(true);
  for (const name of ["detail-es.json", "files-detail-es.json"])
    expect(
      responseDetailSchema.safeParse(JSON.parse(raw(name))).success,
      name,
    ).toBe(true);
  for (const culture of ["es", "en"])
    expect(
      responseNavigationSchema.safeParse(
        JSON.parse(raw(`navigation-${culture}.json`)),
      ).success,
    ).toBe(true);
  expect(
    responseFacetSchema.safeParse(JSON.parse(raw("counts-es.json"))).success,
  ).toBe(true);
  expect(
    readFileSync(resolve(directory, "export.xlsx")).subarray(0, 2).toString(),
  ).toBe("PK");
});
it("reads the actual backend sheet and private file detail without replacing their shape", async () => {
  const sheet = JSON.parse(raw("sheet-es.json")) as { definitionId: string };
  const detail = JSON.parse(raw("files-detail-es.json")) as { id: string };
  server.use(
    http.post(
      `/api/forms/definitions/${sheet.definitionId}/records/search`,
      () =>
        new HttpResponse(raw("sheet-es.json"), {
          headers: { "content-type": "application/json" },
        }),
    ),
    http.get(
      `/api/forms/records/${detail.id}`,
      () =>
        new HttpResponse(raw("files-detail-es.json"), {
          headers: { "content-type": "application/json" },
        }),
    ),
  );
  expect(
    await fetchResponseSheet(
      sheet.definitionId,
      { page: 1, pageSize: 20 },
      new AbortController().signal,
    ),
  ).toEqual(JSON.parse(raw("sheet-es.json")));
  expect(
    await fetchResponseDetail(detail.id, new AbortController().signal),
  ).toEqual(JSON.parse(raw("files-detail-es.json")));
});
