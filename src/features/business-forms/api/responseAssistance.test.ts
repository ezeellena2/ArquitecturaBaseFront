import { expect, it } from "vitest";
import { responseDetailSchema } from "./responses";
import { assistedResponseFixture } from "@/test/responseAssistanceFixture";
it("accepts captured assistance and a chain of confirmed records without deriving their current configuration", () => {
 const detail = assistedResponseFixture(); const read = responseDetailSchema.parse(detail);
 expect(read).toMatchObject({ assistance: detail.assistance, chain: detail.chain });
});
it.each(["assistance", "chain"])("requires the %s property even when the response has no assistance", key => {
 const body: Record<string, unknown> = { ...assistedResponseFixture(), assistance: null, chain: [] }; delete body[key];
 expect(responseDetailSchema.safeParse(body).success).toBe(false);
});
it.each([
 ["missing suggestion", (body: ReturnType<typeof assistedResponseFixture>) => { Reflect.deleteProperty(body.assistance, "suggestion"); }],
 ["unknown mode", (body: ReturnType<typeof assistedResponseFixture>) => { Reflect.set(body.assistance.suggestion, "mode", "Current"); }],
 ["unknown sender", (body: ReturnType<typeof assistedResponseFixture>) => { Reflect.set(body.assistance, "senderKind", "Bot"); }],
 ["invalid date", (body: ReturnType<typeof assistedResponseFixture>) => { body.chain[0].submittedAtUtc = "yesterday"; }],
 ["unexpected provenance", (body: ReturnType<typeof assistedResponseFixture>) => { Reflect.set(body.assistance, "executionId", "private"); }],
] as const)("rejects an invalid closed assistance contract: %s", (_, change) => {
 const body = assistedResponseFixture(); change(body); expect(responseDetailSchema.safeParse(body).success).toBe(false);
});
