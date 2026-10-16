import { expect, it } from "vitest";
import { http } from "msw";
import { httpCohort } from "@/test/httpCohort";
import { server } from "@/test/mocks/server";
import { readRuleSet, readRuleOptions, fetchFormRules, fetchRuleOptions, fetchRuleHistory, fetchRuleRevision, saveFormRules } from "./rules";
it("reads saved rules and their original-only text from unchanged backend bodies", () => {
  const cohort = httpCohort("rules"); const provenance = cohort.verify(); expect(provenance.producer).toContain("FormRuleHttpTests");
  expect(readRuleSet(cohort.json("empty-es.json")).revision).toBe(0);
  const saved = readRuleSet(cohort.json("saved-es.json")); expect(saved.revision).toBe(1);
  expect(saved.rules[0].actions[0].text).toEqual({ es: "Recibimos {número}: {Nombre}" });
  expect(readRuleSet(cohort.json("revision-es.json"))).toEqual(saved);
  for (const culture of ["es", "en"]) expect(readRuleOptions(cohort.json("options-" + culture + ".json")).definitionId).toBe(saved.definitionId);
});
it("passes raw rules, options, history and revision bodies through their real HTTP adapters", async () => {
  const cohort = httpCohort("rules"); const saved = readRuleSet(cohort.json("saved-es.json")); const path = "/api/forms/definitions/" + saved.definitionId + "/rules";
  server.use(http.get(path, () => cohort.response("saved-es.json")), http.get(path + "/options", () => cohort.response("options-es.json")),
    http.get(path + "/revisions", () => cohort.response("history-es.json")), http.get(path + "/revisions/1", () => cohort.response("revision-es.json")),
    http.post(path, () => cohort.response("saved-es.json", 201)));
  expect(await fetchFormRules(saved.definitionId)).toEqual(saved); expect(await fetchRuleOptions(saved.definitionId)).toEqual(readRuleOptions(cohort.json("options-es.json")));
  expect(await fetchRuleHistory(saved.definitionId, 1)).toEqual(cohort.json("history-es.json")); expect(await fetchRuleRevision(saved.definitionId, 1)).toEqual(saved);
  expect(await saveFormRules(saved.definitionId, { expectedRevision: 0, rules: saved.rules })).toEqual(saved);
});
