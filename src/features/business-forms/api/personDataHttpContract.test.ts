import { expect, it } from "vitest";
import { http } from "msw";
import { z } from "zod";
import { httpCohort } from "@/test/httpCohort";
import { server } from "@/test/mocks/server";
import { fetchPersonAttributes, fetchPersonAttributeOptions, fetchPersonData, fetchPersonDataPage, readPersonAttribute, readPersonAttributes, readPersonData, readPersonDataPage } from "./personData";

// Raw bodies from the joint backend export are read unchanged.
const cohort = httpCohort("personData");
const names = ["attribute-created", "person-options", "person-data-empty", "person-data-saved", "person-data", "people", "conflict", "invalid-value", "attribute-updated", "attributes", "forbidden", "source-in-use", "attribute-value-removal-confirmation", "attribute-conflict"];
it("qualifies all 29 person data captures and their actual HTTP producer", () => {
  const provenance = cohort.verify();
  expect(provenance.captures.map(item => item.name).sort()).toEqual([...["es", "en"].flatMap(culture => names.map(name => name + "-" + culture + ".json")), "attribute-created-english-original-en.json"].sort());
  expect(provenance.sources.some(source => source.path.endsWith("/FormPersonDataHttpTests.cs"))).toBe(true);
  expect(provenance.sources.some(source => source.path.endsWith("/FormPersonDataContractCapture.cs"))).toBe(true);
});
it("reads an attribute created with the menu in English with only its original name, and its later Spanish translation", () => {
  const created = readPersonAttribute(cohort.json("attribute-created-english-original-en.json"));
  expect(created).toMatchObject({ originalCulture: "en", name: { en: "Branch" }, type: "Text", revision: 1, usedBy: [] });
  expect(Object.keys(created.name)).toEqual(["en"]);
  // The producer then translated it with the menu in Spanish: the list carries both names and keeps the English original.
  const listed = readPersonAttributes(cohort.json("attributes-es.json")).items.find(item => item.id === created.id);
  expect(listed).toMatchObject({ originalCulture: "en", name: { en: "Branch", es: "Sucursal" }, revision: 2 });
});
for (const culture of ["es", "en"]) {
  it("reads the intact " + culture + " metadata, private values, table and narrow options through the HTTP clients", async () => {
    const file = (name: string) => name + "-" + culture + ".json";
    const created = readPersonAttribute(cohort.json(file("attribute-created")));
    expect(created.revision).toBe(1);
    expect(readPersonAttribute(cohort.json(file("attribute-updated")), created.id, 1).revision).toBe(2);
    const metadata = readPersonAttributes(cohort.json(file("attributes")));
    expect(metadata.items.some(item => item.id === created.id)).toBe(true);
    const person = readPersonData(cohort.json(file("person-data")));
    expect(readPersonData(cohort.json(file("person-data-empty")), person.userId).revision).toBeNull();
    expect(readPersonData(cohort.json(file("person-data-saved")), person.userId, null).revision).toBe(1);
    expect(person.values[created.id]?.text).toBe(culture === "en" ? "Central" : "Centro");
    expect(readPersonDataPage(cohort.json(file("people"))).items.some(item => item.userId === person.userId)).toBe(true);
    server.use(
      http.get("*/api/forms/person-attributes", () => cohort.response(file("attributes"))),
      http.get("*/api/forms/person-attributes/:id/options", () => cohort.response(file("person-options"))),
      http.get("*/api/forms/person-data/:id", () => cohort.response(file("person-data"))),
      http.get("*/api/forms/person-data", () => cohort.response(file("people"))),
    );
    expect(await fetchPersonAttributes()).toEqual(cohort.json(file("attributes")));
    expect(await fetchPersonData(person.userId)).toEqual(cohort.json(file("person-data")));
    expect(await fetchPersonDataPage({ page: 1, pageSize: 20 })).toEqual(cohort.json(file("people")));
    expect(await fetchPersonAttributeOptions(created.id, { page: 1, pageSize: 20 })).toEqual(cohort.json(file("person-options")));
  });
  it("keeps the intact " + culture + " conflict, validation and permission codes", () => {
    const error = z.object({ code: z.string() });
    for (const [file, code] of [["conflict", "Forms.PersonData.RevisionConflict"], ["invalid-value", "Forms.PersonData.ValueInvalid"], ["source-in-use", "Forms.Catalog.SourceInUse"], ["attribute-conflict", "Forms.PersonAttribute.RevisionConflict"]]) {
      expect(error.parse(cohort.json(file + "-" + culture + ".json")).code).toBe(code);
    }
    expect(z.object({ status: z.literal(403) }).parse(cohort.json("forbidden-" + culture + ".json")).status).toBe(403);
    const removal = z.object({ code: z.literal("Forms.PersonAttribute.ValueRemovalNotConfirmed"), errors: z.object({ type: z.array(z.string()).min(1) }), count: z.number().int().min(1) }).parse(cohort.json("attribute-value-removal-confirmation-" + culture + ".json"));
    expect(removal.count).toBe(1);
  });
}
