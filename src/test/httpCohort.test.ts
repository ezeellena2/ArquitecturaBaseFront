import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { httpCohort } from "./httpCohort";

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) {
    expect(dirname(directory)).toBe(resolve(tmpdir()));
    rmSync(directory, { recursive: true, force: true });
  }
  vi.unstubAllEnvs();
});

// Synthetic envelopes qualify the helper's IO only; these are never backend captures.
function syntheticCohort(artifactSet = "workflow", environment = "FORMS_WORKFLOW_HTTP_CONTRACT_INPUT", nested = true) {
  const directory = mkdtempSync(resolve(tmpdir(), "http-cohort-unit-"));
  directories.push(directory);
  const captures = ["es", "en"].map(culture => {
    if (nested) mkdirSync(resolve(directory, culture));
    const name = culture + (nested ? "/" : "-") + "synthetic.json";
    const bytes = Buffer.from(JSON.stringify({ synthetic: true, culture }) + "\r\n");
    writeFileSync(resolve(directory, name), bytes);
    return { name, length: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
  });
  writeFileSync(resolve(directory, "provenance.json"), JSON.stringify({
    schemaVersion: 1, artifactSet, runId: "synthetic-unit-fixture", generatedAtUtc: "2026-10-17T00:00:00Z",
    repositoryHead: "0".repeat(40), sourceState: ["synthetic"], command: "synthetic helper unit test only",
    producer: "SyntheticUnitFixture", sources: [{ path: "synthetic-source", sha256: "0".repeat(64) }], transport: "synthetic",
    captures,
  }));
  vi.stubEnv(environment, directory);
  return directory;
}

it.each([
  ["workflow", "FORMS_WORKFLOW_HTTP_CONTRACT_INPUT", "workflow", false],
  ["workflow", "FORMS_WORKFLOW_HTTP_CONTRACT_INPUT", "workflow", true],
  ["whatsappForms", "WHATSAPP_FORMS_HTTP_CONTRACT_INPUT", "whatsapp-forms", true],
] as const)("qualifies synthetic %s files with exact bytes (nested=%s)", async (name, environment, artifactSet, nested) => {
  const directory = syntheticCohort(artifactSet, environment, nested);
  const cohort = httpCohort(name);
  const file = nested ? "es/synthetic.json" : "es-synthetic.json";
  const original = readFileSync(resolve(directory, file));
  const manifest = cohort.verify();
  expect(manifest.artifactSet).toBe(artifactSet);
  expect(manifest.captures.map(capture => capture.name)).toEqual(nested ? ["es/synthetic.json", "en/synthetic.json"] : ["es-synthetic.json", "en-synthetic.json"]);
  expect(Buffer.from(await cohort.response(file).arrayBuffer())).toEqual(original);
  expect(cohort.bytes(file)).toEqual(original);
});
it("rejects changed nested bytes before qualifying a synthetic cohort", () => {
  const directory = syntheticCohort();
  writeFileSync(resolve(directory, "es/synthetic.json"), "changed synthetic bytes");
  expect(() => httpCohort("workflow").verify()).toThrow();
});
it("rejects an unlisted nested file in a synthetic cohort", () => {
  const directory = syntheticCohort();
  writeFileSync(resolve(directory, "es/extra.txt"), "synthetic extra file");
  expect(() => httpCohort("workflow").verify()).toThrow();
});
