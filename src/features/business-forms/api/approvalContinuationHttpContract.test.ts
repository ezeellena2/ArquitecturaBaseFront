import { expect, it } from "vitest";
import { http } from "msw";
import { httpCohort } from "@/test/httpCohort";
import { server } from "@/test/mocks/server";
import { fetchApprovalContinuation, readApprovalContinuation } from "./approvals";

const cohort = httpCohort("approvals");
const cultures = ["es", "en"] as const;
const variants = ["next", "previous", "closed"] as const;
const capture = (variant: typeof variants[number], culture: typeof cultures[number]) =>
  `approval-continuation-${variant}-${culture}.json`;

it("qualifies all six unchanged continuation bodies and their producer provenance", () => {
  const provenance = cohort.verify();
  for (const file of ["FormApprovalContinuationHttpTests.cs", "FormApprovalContinuationFixture.cs"]) {
    expect(provenance.sources.some(source => source.path.endsWith("/" + file))).toBe(true);
  }
  expect(provenance.captures.map(entry => entry.name).filter(name => name.startsWith("approval-continuation-")).sort())
    .toEqual(cultures.flatMap(culture => variants.map(variant => capture(variant, culture))).sort());
  for (const culture of cultures) {
    for (const variant of variants) {
      const raw = cohort.json(capture(variant, culture));
      const result = readApprovalContinuation(raw);
      expect(result).toEqual(raw);
      expect(result.direction).toBe(variant === "previous" ? "Previous" : "Next");
      expect(result.items).toHaveLength(variant === "closed" ? 2 : 1);
      expect(result.totalCount).toBe(variant === "closed" ? 2 : 3);
      expect(result.hasMore).toBe(variant !== "closed");
      for (const item of result.items) {
        expect(item.task).toMatchObject({ definitionId: result.definitionId, state: "Open", canDecide: true,
          cannotDecideReason: null, decidedAtUtc: null, decidedBy: null, reason: null });
      }
    }
  }
});

it("relates the captured next previous and closed anchors without fixed identifiers", () => {
  for (const culture of cultures) {
    const next = readApprovalContinuation(cohort.json(capture("next", culture)));
    const previous = readApprovalContinuation(cohort.json(capture("previous", culture)));
    const closed = readApprovalContinuation(cohort.json(capture("closed", culture)));
    expect(previous.definitionId).toBe(next.definitionId);
    expect(closed.definitionId).toBe(next.definitionId);
    expect(next.items.map(item => item.position)).toEqual([1]);
    expect(previous.items.map(item => item.position)).toEqual([2]);
    expect(closed.items.map(item => item.position)).toEqual([1, 2]);
    expect(closed.anchorTaskId).toBe(next.items[0].task.id);
    expect(closed.items.map(item => item.task.id)).toEqual([previous.items[0].task.id, previous.anchorTaskId]);
    expect(next.anchorTaskId).not.toBe(closed.anchorTaskId);
    expect(next.items[0].task.id).not.toBe(previous.items[0].task.id);
    expect(next.items[0].task.requestedAtUtc).toBe(previous.items[0].task.requestedAtUtc);
  }
});

it("rejects open envelopes unknown task data and missing or mistyped required values from actual captures", () => {
  for (const culture of cultures) {
    const body = readApprovalContinuation(cohort.json(capture("closed", culture)));
    const first = body.items[0];
    const missingReason = { ...first.task };
    Reflect.deleteProperty(missingReason, "reason");
    const invalid: unknown[] = [
      { ...body, extra: "private capture value" },
      { ...body, items: [{ ...first, extra: "private capture value" }] },
      { ...body, items: [{ ...first, task: { ...first.task, values: "private capture value" } }] },
      { ...body, items: [{ ...first, task: missingReason }] },
      { ...body, items: [{ ...first, position: "1" }] },
      { ...body, items: [{ ...first, task: { ...first.task, id: null } }] },
      { ...body, items: [{ ...first, task: { ...first.task, author: null } }] },
      { ...body, items: [{ ...first, task: { ...first.task, number: 1 } }] },
      { ...body, items: [{ ...first, task: { ...first.task, reason: false } }] },
      { ...body, totalCount: "2" },
      { ...body, hasMore: "false" },
      { ...body, items: [first, first] },
      { ...body, items: [first, { ...body.items[1], position: first.position }] },
      { ...body, items: [{ ...first, task: { ...first.task, state: "Approved" } }] },
      { ...body, definitionId: first.task.recordId },
    ];
    for (const field of ["anchorTaskId", "definitionId", "direction", "items", "totalCount", "hasMore"] as const) {
      invalid.push({ ...body, [field]: null });
    }
    for (const value of invalid) {
      expect(() => readApprovalContinuation(value)).toThrow(/^Invalid form approval contract\.$/);
    }
  }
});

it("uses the real continuation client with unchanged bytes direction and batch", async () => {
  for (const culture of cultures) {
    for (const variant of variants) {
      const name = capture(variant, culture);
      const raw = cohort.json(name);
      const body = readApprovalContinuation(raw);
      const pageSize = variant === "closed" ? 2 : 1;
      server.use(http.get(`/api/forms/approvals/${body.anchorTaskId}/continuation`, ({ request }) => {
        const query = new URL(request.url).searchParams;
        expect(query.get("definitionId")).toBe(body.definitionId);
        expect(query.get("direction")).toBe(body.direction);
        expect(query.get("pageSize")).toBe(String(pageSize));
        return cohort.response(name);
      }));
      expect(await fetchApprovalContinuation(body.anchorTaskId,
        { definitionId: body.definitionId, direction: body.direction, pageSize }, new AbortController().signal)).toEqual(raw);
    }
  }
});

it("binds actual continuation bytes to the requested anchor definition direction and batch", async () => {
  const name = capture("closed", "es");
  const body = readApprovalContinuation(cohort.json(name));
  const mismatches = [
    { anchor: body.items[0].task.id, definition: body.definitionId, direction: body.direction, size: 2 },
    { anchor: body.anchorTaskId, definition: body.items[0].task.recordId, direction: body.direction, size: 2 },
    { anchor: body.anchorTaskId, definition: body.definitionId, direction: "Previous", size: 2 },
    { anchor: body.anchorTaskId, definition: body.definitionId, direction: body.direction, size: 1 },
  ] as const;
  for (const request of mismatches) {
    server.use(http.get(`/api/forms/approvals/${request.anchor}/continuation`, () => cohort.response(name)));
    await expect(fetchApprovalContinuation(request.anchor,
      { definitionId: request.definition, direction: request.direction, pageSize: request.size }))
      .rejects.toThrow(/^Invalid form approval contract\.$/);
  }
});
