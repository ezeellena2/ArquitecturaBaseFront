import { screen, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import i18n from "@/shared/i18n";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { fixtureFormId } from "@/test/visual/formFixtures";
import { FormDeletionDialog } from "./FormDeletionDialog";
beforeEach(async()=>{await i18n.changeLanguage("es");});
for(const language of ["es","en"] as const) for(const published of [false,true]) it("names the reserved prefix and limits the WhatsApp warning to a published form in "+language+" "+published,async()=>{
 await i18n.changeLanguage(language);renderWithProviders(<FormDeletionDialog id={fixtureFormId} name="Registrar visita" prefix="VIS" hasPublishedVersion={published} revision={1} scope={{actorId:"actor",culture:language,permissions:["formtemplates.read","formtemplates.manage"]}} onDeleted={vi.fn()} onClose={vi.fn()}/>);
 const dialog=await screen.findByRole("dialog");expect(within(dialog).getByText(language==="es"?"El prefijo VIS queda reservado.":"The VIS prefix remains reserved.")).toBeVisible();
 const warning=within(dialog).queryByText(language==="es"?"En WhatsApp no se deshace. Sus Flows se deprecan cuando no quedan envíos abiertos.":"This cannot be undone on WhatsApp. Its Flows are deprecated once no open sends remain.");
 if(published)expect(warning).toBeVisible();else expect(warning).not.toBeInTheDocument();
});
