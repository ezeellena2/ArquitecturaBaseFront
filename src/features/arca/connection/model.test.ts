import { describe, expect, it } from "vitest";
import type { ArcaConnection } from "./api";
import { delegationStepsOf, expiryOf, formatCuit, isDelegation, isValidAlias, normalizeCuit, phaseOf, setupZonesOf } from "./model";

const connection = (status: ArcaConnection["status"]): ArcaConnection => ({
  status, mode: null, environment: null, cuit: null, platformCuit: null, platform: null, installedServices: [], enabledServices: [], certificates: [],
  lastTestPassed: null, lastTestedAtUtc: null, revision: status ? 1 : 0,
});

describe("ARCA connection model", () => {
  it("validates the cuit check digit like the server", () => {
    expect(normalizeCuit("20-00000006-0")).toBe("20000000060");
    expect(normalizeCuit("20 00000006 0")).toBe("20000000060");
    expect(normalizeCuit("20-00000006-1")).toBeNull();
    expect(normalizeCuit("2000000001")).toBeNull();
    // Un verificador 10 nunca es válido: ARCA cambia el prefijo.
    expect(normalizeCuit("20000000010")).toBeNull();
    expect(formatCuit("20000000060")).toBe("20-00000006-0");
  });

  it("accepts the aliases arca accepts", () => {
    expect(isValidAlias("plataforma-2028")).toBe(true);
    expect(isValidAlias("1-alias")).toBe(false);
    expect(isValidAlias("ab")).toBe(false);
    expect(isValidAlias("Plataforma")).toBe(false);
  });

  it("opens the zone in progress and folds the finished ones", () => {
    expect(phaseOf(connection(null))).toBe("empty");
    expect(phaseOf(connection("Unverified"))).toBe("setup");
    expect(phaseOf(connection("NeedsAttention"))).toBe("active");
    expect(setupZonesOf(connection(null), false)).toEqual({ data: "open", request: "off", certificate: "off", test: "off" });
    expect(setupZonesOf(connection("AwaitingCertificate"), false)).toEqual({ data: "done", request: "done", certificate: "open", test: "off" });
    expect(setupZonesOf(connection("AwaitingCertificate"), true).data).toBe("open");
    expect(setupZonesOf(connection("Unverified"), false)).toEqual({ data: "done", request: "done", certificate: "done", test: "open" });
  });

  it("folds the delegation zone when the delegation arrived, unless the guide is asked for", () => {
    const delegated: ArcaConnection = { ...connection("Unverified"), mode: "PlatformDelegation", lastTestPassed: true };
    expect(setupZonesOf(delegated, false).test).toBe("done");
    expect(setupZonesOf(delegated, false, true).test).toBe("open");
    expect(setupZonesOf({ ...delegated, lastTestPassed: false }, false).test).toBe("open");
    expect(setupZonesOf({ ...delegated, mode: "CompanyCertificate" }, false).test).toBe("open");
    expect(isDelegation("PlatformDelegationAutomated")).toBe(true);
    expect(isDelegation("CompanyCertificate")).toBe(false);
  });

  it("lists the delegation steps of the chosen services with the keys the robot shares", () => {
    const chosen = [{ code: "ws_sr_constancia_inscripcion", family: "Registry", required: true, delegated: false },
      { code: "wsfe", family: "Invoicing", required: false, delegated: true }];
    expect(delegationStepsOf(chosen, "Production")).toEqual({
      authorize: [{ key: "platform.authorize.ws_sr_constancia_inscripcion", service: "ws_sr_constancia_inscripcion" }],
      company: [{ key: "company.delegate.wsfe", service: "wsfe" }],
      platform: [{ key: "platform.accept" }, { key: "platform.assign.wsfe", service: "wsfe" }],
    });
    expect(delegationStepsOf(chosen, "Testing")).toMatchObject({ company: [], platform: [{ key: "platform.assign.wsfe", service: "wsfe" }] });
    expect(delegationStepsOf(chosen.slice(0, 1), "Production")).toMatchObject({ company: [], platform: [] });
  });

  it("warns thirty days before the certificate expires", () => {
    const now = Date.parse("2026-11-05T12:00:00Z");
    expect(expiryOf("2028-11-05T00:00:00Z", now)).toBe("valid");
    expect(expiryOf("2026-12-01T00:00:00Z", now)).toBe("soon");
    expect(expiryOf("2026-11-01T00:00:00Z", now)).toBe("expired");
    expect(expiryOf(null, now)).toBe("valid");
  });
});
