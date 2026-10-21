import type { FormOverview, FormOverviewRow } from "@/features/business-forms/api/overview";
import { responseFormId, responseRecordId } from "../responseFixtures";

const id = (value: number) => "0199a0c0-0000-7000-8000-" + String(value).padStart(12, "0");
export const formOverviewFixtureIds = { visit: responseFormId, deactivated: id(220) };

// Explicit synthetic MF1 data; backend exports qualify the HTTP contract separately.
export function createFormOverviewVisualFixtures(language: "es" | "en", scenario: string) {
  const en = language === "en";
  const canRead = scenario !== "forms-overview-decide";
  const canDecide = scenario !== "forms-overview-read";
  const permissions = [...(canRead ? ["formrecords.read"] : []), ...(canDecide ? ["formapprovals.decide"] : [])];
  const names = en
    ? ["Register visit", "Register delivery", "Site survey", "Register maintenance", "Safety checklist", "Invoice delivery", "Vehicle inspection", "Previous inspection"]
    : ["Registrar visita", "Registrar entrega", "Relevamiento de obra", "Registrar mantenimiento", "Checklist de seguridad", "Facturar entrega", "Control de vehículo", "Control anterior"];
  const prefixes = ["VIS", "ENT", "REL", "MAN", "SEG", "FAC", "VEH", "ANT"];
  const counts = [24, 12, 31, 18, 7, 0, 9, 4];
  const pending = [2, 1, 0, 0, 0, 0, 1, 0];
  const states: NonNullable<FormOverviewRow["lastResponse"]>["state"][] = ["PendingApproval", "PendingApproval", "Received", "Approved", "Rejected", "Received", "PendingApproval", "Approved"];
  const rows: FormOverviewRow[] = names.map((name, index) => ({
    id: index === 0 ? responseFormId : index === 6 ? formOverviewFixtureIds.deactivated : id(220 + index),
    name, prefix: prefixes[index], deactivatedAtUtc: index >= 6 ? "2026-10-20T15:00:00Z" : null,
    pendingApprovalCount: canDecide ? pending[index] : null,
    responseCount: canRead ? counts[index] : null,
    lastResponse: canRead && counts[index] > 0 ? {
      id: index === 0 ? responseRecordId : id(250 + index),
      number: prefixes[index] + "-" + String(counts[index]).padStart(6, "0"),
      submittedAtUtc: "2026-10-" + String(21 - index).padStart(2, "0") + "T14:47:00Z",
      state: states[index],
    } : null,
  }));
  const calls: { method: string; path: string }[] = [];
  return { permissions, calls, async handle(request: Request): Promise<Response | null> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/forms/")) return null;
    calls.push({ method: request.method, path: url.pathname });
    if (request.method !== "GET") return Response.json({ code: "Test.ReadOnlyScenario" }, { status: 405 });
    if (url.pathname === "/api/forms/approvals/count") {
      if (!canDecide) return Response.json({ code: "Authorization.Forbidden" }, { status: 403 });
      const definitionId = url.searchParams.get("definitionId");
      return Response.json({ count: rows.filter(row => !definitionId || row.id === definitionId)
        .reduce((sum, row) => sum + (row.pendingApprovalCount ?? 0), 0) });
    }
    if (url.pathname !== "/api/forms/overview") return null;
    const search = (url.searchParams.get("search") ?? "").toLocaleLowerCase(language);
    const pendingOnly = url.searchParams.get("pendingOnly") === "true";
    const matching = rows.filter(row => (!search || (row.name + " " + row.prefix).toLocaleLowerCase(language).includes(search))
      && (canRead && !pendingOnly || (row.pendingApprovalCount ?? 0) > 0));
    const state = url.searchParams.get("state") ?? "Active";
    const selected = matching.filter(row => canRead && canDecide && pendingOnly
      || (state === "Deactivated" ? row.deactivatedAtUtc !== null : row.deactivatedAtUtc === null));
    const page = Number(url.searchParams.get("page") ?? 1);
    const pageSize = Number(url.searchParams.get("pageSize") ?? 20);
    const totalPages = Math.ceil(selected.length / pageSize);
    const body: FormOverview = {
      forms: { items: selected.slice((page - 1) * pageSize, page * pageSize), page, pageSize,
        totalCount: selected.length, totalPages, hasPrevious: page > 1, hasNext: page < totalPages },
      filterCounts: { active: matching.filter(row => row.deactivatedAtUtc === null).length,
        deactivated: matching.filter(row => row.deactivatedAtUtc !== null).length,
        deactivatedPending: canDecide ? matching.filter(row => row.deactivatedAtUtc !== null && (row.pendingApprovalCount ?? 0) > 0).length : null },
    };
    return Response.json(body);
  } };
}
