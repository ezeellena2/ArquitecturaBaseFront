import { screen } from "@testing-library/react";
import { beforeEach, expect, it } from "vitest";
import i18n from "@/shared/i18n";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { fixtureLifecycle } from "@/test/visual/formFixtures";
import { FormLifecycleNotice } from "./FormLifecycleNotice";
beforeEach(async()=>{await i18n.changeLanguage("es");});
for(const language of ["es","en"] as const) for(const state of ["Pending","Uncertain","Deprecated"] as const) {
 it("shows authoritative "+state+" WhatsApp evidence in "+language,async()=>{
  await i18n.changeLanguage(language);
  const lifecycle=fixtureLifecycle(1,{deactivatedAtUtc:"2026-10-20T12:00:00Z",deprecationState:state,lastOpenSessionExpiresAtUtc:state==="Pending"?"2026-10-22T18:00:00Z":null,deprecatedAtUtc:state==="Deprecated"?"2026-10-21T18:00:00Z":null});
  renderWithProviders(<FormLifecycleNotice lifecycle={lifecycle} timeZoneId="America/Argentina/Buenos_Aires"/>);
  expect(await screen.findByText(state==="Pending"?(language==="es"?/se deprecan cuando venzan los envíos abiertos/i:/they will be deprecated when open sends expire/i):state==="Uncertain"?(language==="es"?/Sin confirmar en WhatsApp/:/Unconfirmed on WhatsApp/):(language==="es"?/Deprecados el 21 oct 2026, 15:00/:/Deprecated on Oct 21, 2026, 3:00 PM/))).toBeVisible();
  if(state==="Pending") expect(screen.getByText(language==="es"?/22 oct 2026, 15:00/:/Oct 22, 2026, 3:00 PM/)).toBeVisible();
  expect(screen.queryByText(/2026-10-2[12]T18:00:00Z/)).not.toBeInTheDocument();
 });
}
it("does not invent deprecation evidence for a deactivated form without confirmed Flows",()=>{
 renderWithProviders(<FormLifecycleNotice lifecycle={fixtureLifecycle(1,{deactivatedAtUtc:"2026-10-20T12:00:00Z",deprecationState:null,deprecatedAtUtc:null})}/>);
 expect(screen.queryByText(/Deprecados|Sin confirmar|Se deprecan/)).not.toBeInTheDocument();
});
it("does not label an active form as deactivated when older deprecation evidence remains",()=>{
 renderWithProviders(<FormLifecycleNotice lifecycle={fixtureLifecycle(1,{deprecationState:"Deprecated",deprecatedAtUtc:"2026-10-21T18:00:00Z"})}/>);
 expect(screen.queryByRole("status")).not.toBeInTheDocument();
});
