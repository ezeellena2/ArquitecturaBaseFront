import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import type { ArcaConnection } from "./api";
import { DelegationGuide } from "./DelegationGuide";

const connection: ArcaConnection = {
  status: "Unverified", mode: "PlatformDelegationAutomated", environment: "Production", cuit: "20000000060", platformCuit: "30719998883",
  platform: { cuit: "30719998883", name: "Plataforma Ejemplo S.A." }, enabledServices: ["ws_sr_constancia_inscripcion", "wsfe"], certificates: [],
  lastTestPassed: false, lastTestedAtUtc: null, revision: 3,
  installedServices: [{ code: "ws_sr_constancia_inscripcion", family: "Registry", required: true, delegated: false },
    { code: "wsfe", family: "Invoicing", required: false, delegated: true }],
};

describe("DelegationGuide", () => {
  it("marks what the robot did and where to continue, with the keys it shares", () => {
    renderWithProviders(<DelegationGuide connection={connection} alias="plataforma" startAt="platform.accept"
      done={["company.delegate.wsfe"]} doneLabel="Lo hizo el robot"
      familySteps={[{ key: "company.point-of-sale", textKey: "delegation.pointOfSale" }]} />);

    const delegate = document.querySelector('[data-guide-step="company.delegate.wsfe"]')!;
    expect(delegate).toHaveTextContent("Lo hizo el robot");
    expect(document.querySelector('[data-guide-step="platform.accept"]')).toHaveTextContent("Seguí desde acá");
    expect(document.querySelector('[data-guide-step="company.point-of-sale"]')).not.toHaveTextContent("Seguí desde acá");
    expect(screen.getByRole("button", { name: "Copiar la CUIT 30-71999888-3" })).toBeInTheDocument();
  });
});
