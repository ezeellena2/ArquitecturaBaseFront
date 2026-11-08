import { expect, it } from "vitest";
import { http } from "msw";
import { httpCohort } from "@/test/httpCohort";
import { server } from "@/test/mocks/server";
import { readRuleSet, readRuleOptions, fetchFormRules, fetchRuleOptions, fetchRuleHistory, fetchRuleRevision, saveFormRules } from "./rules";
import { parseRuleMessage, ruleMessageData } from "../ruleMessage";
import { conditionColumns } from "../rules";
it("reads saved rules and their original-only text from unchanged backend bodies", () => {
  const cohort = httpCohort("rules"); const provenance = cohort.verify(); expect(provenance.producer).toContain("FormRuleHttpTests");
  expect(readRuleSet(cohort.json("empty-es.json")).revision).toBe(0);
  const saved = readRuleSet(cohort.json("saved-es.json")); expect(saved.revision).toBe(1);
  // Saved with the question's name, the message is read with its identity (MD1-A).
  const question = readRuleOptions(cohort.json("options-es.json")).questions[0];
  expect(question.label.es).toBe("Nombre");
  expect(saved.rules[0].actions[0].text).toEqual({ es: "Recibimos {número}: {" + question.fieldId + "}" });
  expect(readRuleSet(cohort.json("revision-es.json"))).toEqual(saved);
  for (const culture of ["es", "en"]) expect(readRuleOptions(cohort.json("options-" + culture + ".json")).definitionId).toBe(saved.definitionId);
});
it("reads a message that references its question by identity, also after the question is renamed", () => {
  const cohort = httpCohort("rules");
  for (const file of ["saved-reference-es.json", "current-reference-es.json"])
    expect(parseRuleMessage(readRuleSet(cohort.json(file)).rules[0].actions[0].text!.es)).toEqual([
      { kind: "text", text: "Recibimos " }, { kind: "number" }, { kind: "text", text: ": " }, { kind: "question", fieldId: expect.stringMatching(/^[0-9a-f-]{36}$/) }]);
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
it("reads the options with the block of rows and a rule saved on it from the bodies of FormRowsRuleHttpTests", () => {
  const cohort = httpCohort("rules");
  expect(cohort.verify().sources.map(source => source.path)).toEqual(expect.arrayContaining([expect.stringMatching(/FormRowsRuleHttpTests\.cs$/)]));
  for (const culture of ["es", "en"] as const) {
    const options = readRuleOptions(cohort.json("rows-options-" + culture + ".json"));
    expect(options.questions.map(question => question.type)).toEqual(["shortText", "group", "choice", "decimal", "longText"]);
    // The block is a column with its questions, and a datum of the message without them (RG5-A).
    const columns = conditionColumns(options.questions, options.conditionChoices, culture, options.originalCulture);
    expect(columns.map(column => column.type)).toEqual(["shortText", "group"]);
    expect(columns[1].questions?.map(question => question.label)).toEqual(culture === "en" ? ["Product", "Quantity", "Note"] : ["Artículo", "Cantidad", "Observación"]);
    expect(columns[1].questions?.[0].options.map(option => option.label)).toEqual(culture === "en" ? ["Seed", "Fertilizer"] : ["Semilla", "Fertilizante"]);
    expect(ruleMessageData(options.questions, "Received")).toEqual([{ kind: "number" }, ...options.questions.slice(0, 2).map(question => ({ kind: "question", fieldId: question.fieldId }))]);
  }
  const saved = readRuleSet(cohort.json("rows-saved-es.json"));
  expect(saved.rules[0].conditions.map(condition => [condition.operator, condition.values])).toEqual([["in", [expect.stringMatching(/^[0-9a-f-]{36}$/)]], ["gte", ["200"]]]);
  expect(parseRuleMessage(saved.rules[0].actions[0].text!.es)).toEqual([{ kind: "text", text: "Llegó: " }, { kind: "question", fieldId: expect.stringMatching(/^[0-9a-f-]{36}$/) }]);
});
