import type { PersonAttribute, PersonData, PersonDataBody, PersonDataRow } from "@/features/business-forms/api/personData";
import type { UserDetail, UpdateUserBody } from "@/features/users/api/users";

const guid = (value: number) => "01990000-0000-7000-8000-" + String(value).padStart(12, "0");
export const personDataFixtureIds = { zone: guid(401), branch: guid(402), person: guid(412), center: guid(421), north: guid(422), west: guid(423) };

// Explicit synthetic CE4 data. HTTP guards are qualified by the joint backend export separately.
export function createPersonDataVisualFixtures(language: "es" | "en", scenario: string) {
  const en = language === "en";
  const ids = personDataFixtureIds;
  const permissions = ["formpersondata.manage", "users.read", "users.manage"];
  const calls: { method: string; path: string }[] = [];
  const writes: { method: string; path: string; body: unknown }[] = [];
  const zones = [{ id: ids.center, text: en ? "Central" : "Centro" }, { id: ids.north, text: en ? "North" : "Norte" }, { id: ids.west, text: en ? "West" : "Oeste" }];
  const branches = zones.map((zone, index) => ({ ...zone, id: guid(451 + index) }));
  const attributes: PersonAttribute[] = [
    { id: ids.zone, key: "zone", name: { es: "Zona", en: "Zone" }, type: "Catalog", sourceCatalogId: guid(431), sourceCatalogName: en ? "Zones" : "Zonas", position: 0, isActive: true, revision: 1, usedBy: [{ definitionId: guid(441), name: en ? "Request spare part" : "Pedir repuesto" }] },
    { id: ids.branch, key: "branch", name: { es: "Sucursal", en: "Branch" }, type: "Catalog", sourceCatalogId: guid(432), sourceCatalogName: en ? "Branches" : "Sucursales", position: 1, isActive: true, revision: 1, usedBy: [] },
  ];
  const users: UserDetail[] = ["Ana Pérez", "Juan Gómez", "Laura Ríos Fernández", "Carla Paz", "Pablo Sosa", "Marta Ruiz"].map((displayName, index) => ({
    id: guid(411 + index), displayName, email: ["ana", "juan", "laura", "carla", "pablo", "marta"][index] + "@example.invalid", emailConfirmed: true,
    phoneNumber: null, formattedPhoneNumber: null, phoneNumberConfirmed: false, isActive: true, createdAtUtc: "2026-10-21T12:00:00Z", roles: ["User"], lastInvitation: null,
  }));
  const records = new Map<string, PersonData>(users.map((user, index) => {
    const zone = index < 2 ? zones[0] : index === 2 ? zones[1] : index === 3 ? zones[2] : null;
    const branch = index === 4 ? null : branches[index === 5 ? 1 : index < 2 ? 0 : index - 1];
    return [user.id, { userId: user.id, revision: index === 4 ? null : 3, values: { ...(zone ? { [ids.zone]: { value: zone.id, text: zone.text } } : {}), ...(branch ? { [ids.branch]: { value: branch.id, text: branch.text } } : {}) } }];
  }));
  const page = <T,>(items: T[], pageNumber = 1, pageSize = 20) => ({ items: items.slice((pageNumber - 1) * pageSize, pageNumber * pageSize), page: pageNumber, pageSize, totalCount: items.length, totalPages: Math.ceil(items.length / pageSize), hasPrevious: pageNumber > 1, hasNext: pageNumber * pageSize < items.length });
  return { permissions, calls, writes, async handle(request: Request): Promise<Response | null> {
    const url = new URL(request.url), path = url.pathname;
    if (path.startsWith("/api/forms/catalogs")) {
      calls.push({ method: request.method, path });
      return Response.json({ status: 403, code: "Authorization.Forbidden" }, { status: 403 });
    }
    if (!path.startsWith("/api/forms/person-") && !users.some(user => path === "/api/users/" + user.id)) return null;
    calls.push({ method: request.method, path });
    if (request.method !== "GET") {
      const body: unknown = await request.json(); writes.push({ method: request.method, path, body });
      if (request.method === "PUT" && path.startsWith("/api/users/")) {
        const user = users.find(user => path.endsWith("/" + user.id))!, input = body as UpdateUserBody;
        Object.assign(user, { displayName: input.displayName, roles: input.roles });
        return new Response(null, { status: 204 });
      }
      if (request.method === "PUT" && path.startsWith("/api/forms/person-data/")) {
        if (scenario === "person-data-save-error") return Response.json({ status: 500, code: "Unexpected.Error", traceId: "synthetic-ce4-save" }, { status: 500 });
        const userId = path.split("/").at(-1)!, current = records.get(userId)!, delta = body as PersonDataBody;
        if (current.revision !== delta.expectedRevision) return Response.json({ status: 409, code: "Forms.PersonData.RevisionConflict" }, { status: 409 });
        const values = { ...current.values };
        for (const [key, value] of Object.entries(delta.values)) {
          if (!value) delete values[key];
          else values[key] = { value, text: [...zones, ...branches].find(option => option.id === value)?.text ?? value };
        }
        const saved = { userId, revision: (current.revision ?? 0) + 1, values }; records.set(userId, saved);
        return Response.json(saved);
      }
      return Response.json({ status: 405, code: "Test.UnsupportedSyntheticMutation" }, { status: 405 });
    }
    if (path === "/api/forms/person-attributes") return Response.json({ items: attributes });
    if (/^\/api\/forms\/person-attributes\/[^/]+\/options$/.test(path)) {
      const search = (url.searchParams.get("search") ?? "").toLocaleLowerCase(language);
      const options = path.includes("/" + ids.branch + "/") ? branches : zones;
      return Response.json(page(options.filter(option => option.text.toLocaleLowerCase(language).includes(search)), Number(url.searchParams.get("page") ?? 1), Number(url.searchParams.get("pageSize") ?? 20)));
    }
    if (path === "/api/forms/person-data") {
      const search = (url.searchParams.get("search") ?? "").toLocaleLowerCase(language);
      const rows: PersonDataRow[] = users.filter(user => (user.displayName ?? "").toLocaleLowerCase(language).includes(search)).map(user => ({ userId: user.id, displayName: user.displayName, values: records.get(user.id)!.values }));
      if (url.searchParams.get("sort") === "-displayName") rows.reverse();
      return Response.json(page(rows, Number(url.searchParams.get("page") ?? 1), Number(url.searchParams.get("pageSize") ?? 20)));
    }
    if (path.startsWith("/api/forms/person-data/")) return Response.json(records.get(path.split("/").at(-1)!)!);
    const user = users.find(user => path === "/api/users/" + user.id);
    return user ? Response.json(user) : null;
  } };
}
