import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/mocks/server";
import { fetchFormOverview, readFormOverview } from "./overview";

// Synthetic DTO examples for decoder behavior; the HTTP contract test consumes the backend export separately.
function syntheticOverview() {
  return {
    forms: { items: [{ id: "0199a0c0-0000-7000-8000-000000000001", name: "Registrar visita", prefix: "VIS",
      deactivatedAtUtc: null as string | null, pendingApprovalCount: 2 as number | null, responseCount: 24 as number | null,
      lastResponse: { id: "0199a0c0-0000-7000-8000-000000000002", number: "VIS-000024",
        submittedAtUtc: "2026-10-21T12:30:00Z", state: "PendingApproval" } as { id: string; number: string; submittedAtUtc: string; state: string } | null,
    }], page: 1, pageSize: 20, totalCount: 1, totalPages: 1, hasPrevious: false, hasNext: false },
    filterCounts: { active: 1, deactivated: 1, deactivatedPending: 1 as number | null },
  };
}

describe("form overview contract", () => {
  it("keeps read and decision metadata separate without inventing unknown counts", () => {
    const both = syntheticOverview();
    expect(readFormOverview(both)).toEqual(both);
    const readOnly = syntheticOverview();
    readOnly.forms.items[0].pendingApprovalCount = null;
    readOnly.filterCounts.deactivatedPending = null;
    expect(readFormOverview(readOnly).forms.items[0].pendingApprovalCount).toBeNull();
    const decideOnly = syntheticOverview();
    decideOnly.forms.items[0].responseCount = null;
    decideOnly.forms.items[0].lastResponse = null;
    expect(readFormOverview(decideOnly).forms.items[0].responseCount).toBeNull();
    expect(readFormOverview(decideOnly).forms.items[0].lastResponse).toBeNull();
    const inactive = syntheticOverview();
    inactive.forms.items[0].deactivatedAtUtc = "2026-10-21T12:00:00Z";
    expect(readFormOverview(inactive).forms.items[0].deactivatedAtUtc).toBe(inactive.forms.items[0].deactivatedAtUtc);
  });

  it.each([
    (body: ReturnType<typeof syntheticOverview>) => ({ ...body, unknown: "PRIVATE_MARKER" }),
    (body: ReturnType<typeof syntheticOverview>) => ({ ...body, forms: { ...body.forms, unknown: "PRIVATE_MARKER" } }),
    (body: ReturnType<typeof syntheticOverview>) => ({ ...body, forms: { ...body.forms, items: [{ ...body.forms.items[0], unknown: "PRIVATE_MARKER" }] } }),
    (body: ReturnType<typeof syntheticOverview>) => ({ ...body, filterCounts: { ...body.filterCounts, unknown: "PRIVATE_MARKER" } }),
    (body: ReturnType<typeof syntheticOverview>) => ({ ...body, forms: { ...body.forms, items: [{ ...body.forms.items[0], lastResponse: { ...body.forms.items[0].lastResponse, unknown: "PRIVATE_MARKER" } }] } }),
  ])("rejects unknown members without disclosing their values", change => {
    const read = () => readFormOverview(change(syntheticOverview()));
    expect(read).toThrowError("Invalid form overview contract.");
    try { read(); } catch (error) { expect(String(error)).not.toContain("PRIVATE_MARKER"); }
  });

  it.each([undefined, -1, Number.MAX_SAFE_INTEGER + 1])("rejects missing, negative or unsafe response counters: %s", value => {
    const body = syntheticOverview();
    expect(() => readFormOverview({ ...body, forms: { ...body.forms,
      items: [{ ...body.forms.items[0], responseCount: value }] } })).toThrowError("Invalid form overview contract.");
  });

  it("requires explicit nullable decision counts and a recognized last response state", () => {
    const body = syntheticOverview();
    expect(() => readFormOverview({ ...body, filterCounts: { ...body.filterCounts, deactivatedPending: undefined } })).toThrow();
    expect(() => readFormOverview({ ...body, forms: { ...body.forms,
      items: [{ ...body.forms.items[0], pendingApprovalCount: undefined }] } })).toThrow();
    expect(() => readFormOverview({ ...body, forms: { ...body.forms,
      items: [{ ...body.forms.items[0], lastResponse: { ...body.forms.items[0].lastResponse, state: "Unknown" } }] } })).toThrow();
  });

  it("uses the overview read endpoint with public filters and no-store", async () => {
    const calls: { path: string; params: Record<string, string>; cache: RequestCache }[] = [];
    server.use(http.get("/api/forms/overview", ({ request }) => {
      const url = new URL(request.url);
      calls.push({ path: url.pathname, params: Object.fromEntries(url.searchParams), cache: request.cache });
      return HttpResponse.json(syntheticOverview());
    }));
    await fetchFormOverview({ page: 2, pageSize: 10, state: "Deactivated", search: "Visita & entrega", pendingOnly: true }, new AbortController().signal);
    expect(calls).toEqual([{ path: "/api/forms/overview", params: { page: "2", pageSize: "10", state: "Deactivated",
      search: "Visita & entrega", pendingOnly: "true" }, cache: "no-store" }]);
  });
});
