import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, expect, it, vi } from "vitest";
import { server } from "@/test/mocks/server";
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
// The wait of a 429 is not written in the dialog: it is the help (tooltip and description) of the disabled Delete.
it("explains the server wait as help of Delete",async()=>{
 const wait="Esperá 30 segundos para volver a intentar.";let deletes=0;
 server.use(http.delete("/api/forms/definitions/:id",()=>{deletes++;return HttpResponse.json({code:"RateLimit.Exceeded",detail:"Esperá antes de eliminar.",retryAfter:30},{status:429});}));
 renderWithProviders(<FormDeletionDialog id={fixtureFormId} name="Registrar visita" prefix="VIS" hasPublishedVersion={false} revision={1} scope={{actorId:"actor",culture:"es",permissions:["formtemplates.read","formtemplates.manage"]}} onDeleted={vi.fn()} onClose={vi.fn()}/>);
 const dialog=await screen.findByRole("dialog");
 await userEvent.click(within(dialog).getByRole("button",{name:"Eliminar"}));
 const remove=within(dialog).getByRole("button",{name:"Eliminar"});
 await waitFor(()=>expect(remove).toHaveAccessibleDescription(wait));
 expect(remove).toBeDisabled();
 for(const text of within(dialog).getAllByText(wait))expect(text).not.toBeVisible();
 await userEvent.hover(remove);
 expect(await screen.findByRole("tooltip")).toHaveTextContent(wait);
 expect(deletes).toBe(1);
});
