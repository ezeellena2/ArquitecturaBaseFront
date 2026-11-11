import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, expect, it, vi } from "vitest";
import { server } from "@/test/mocks/server";
import i18n from "@/shared/i18n";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { fixtureFormId } from "@/test/visual/formFixtures";
import { FormDeletionDialog } from "./FormDeletionDialog";
beforeEach(async()=>{await i18n.changeLanguage("es");});
// DL (2026-11-11): a confirmation like the others. One sentence with what it affects, «no se deshace» once, the WhatsApp warning
// only when a version was published there, and the button names the action.
const texts={
 es:{sentence:"No se deshace: deja de aparecer en los listados, no se puede volver a usar y el prefijo VIS queda reservado.",warning:"En WhatsApp tampoco: sus Flows se deprecan cuando no quedan envíos abiertos.",once:/no se deshace/i,action:"Eliminar formulario",
  gone:["Deja de aparecer en los listados y no se puede volver a usar.","El prefijo VIS queda reservado.","Esta acción no se deshace."]},
 en:{sentence:"This cannot be undone: it will no longer appear in lists, it cannot be used again and the VIS prefix remains reserved.",warning:"Not on WhatsApp either: its Flows are deprecated once no open sends remain.",once:/cannot be undone/i,action:"Delete form",
  gone:["It will no longer appear in lists and cannot be used again.","The VIS prefix remains reserved.","This action cannot be undone."]},
} as const;
for(const language of ["es","en"] as const) for(const published of [false,true]) it("says in one sentence what deleting affects and warns about WhatsApp only for a published form in "+language+" "+published,async()=>{
 const text=texts[language];
 await i18n.changeLanguage(language);renderWithProviders(<FormDeletionDialog id={fixtureFormId} name="Registrar visita" prefix="VIS" hasPublishedVersion={published} revision={1} scope={{actorId:"actor",culture:language,permissions:["formtemplates.read","formtemplates.manage"]}} onDeleted={vi.fn()} onClose={vi.fn()}/>);
 const dialog=await screen.findByRole("dialog");
 expect(within(dialog).getByText(text.sentence)).toBeVisible();
 expect(within(dialog).getAllByText(text.once)).toHaveLength(1);
 for(const loose of text.gone)expect(within(dialog).queryByText(loose)).not.toBeInTheDocument();
 // The one warning, in its notice.
 if(published)expect(within(dialog).getByRole("status")).toHaveTextContent(new RegExp("^"+text.warning+"$"));else expect(within(dialog).queryByRole("status")).not.toBeInTheDocument();
 expect(within(dialog).getByRole("button",{name:text.action})).toBeEnabled();
});
// The wait of a 429 is not written in the dialog: it is the help (tooltip and description) of the disabled Delete.
it("explains the server wait as help of Delete",async()=>{
 const wait="Esperá 30 segundos para volver a intentar.";let deletes=0;
 server.use(http.delete("/api/forms/definitions/:id",()=>{deletes++;return HttpResponse.json({code:"RateLimit.Exceeded",detail:"Esperá antes de eliminar.",retryAfter:30},{status:429});}));
 renderWithProviders(<FormDeletionDialog id={fixtureFormId} name="Registrar visita" prefix="VIS" hasPublishedVersion={false} revision={1} scope={{actorId:"actor",culture:"es",permissions:["formtemplates.read","formtemplates.manage"]}} onDeleted={vi.fn()} onClose={vi.fn()}/>);
 const dialog=await screen.findByRole("dialog");
 await userEvent.click(within(dialog).getByRole("button",{name:"Eliminar formulario"}));
 const remove=within(dialog).getByRole("button",{name:"Eliminar formulario"});
 await waitFor(()=>expect(remove).toHaveAccessibleDescription(wait));
 expect(remove).toHaveAttribute("aria-disabled", "true");
 for(const text of within(dialog).getAllByText(wait))expect(text).not.toBeVisible();
 await userEvent.hover(remove);
 expect(await screen.findByRole("tooltip")).toHaveTextContent(wait);
 expect(deletes).toBe(1);
});

// Deleting shows on its button that it works, without dimming, until the answer arrives (2026-10-31).
it("shows on Delete that it deletes while the request works",async()=>{
 let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});const onDeleted=vi.fn();
 server.use(http.delete("/api/forms/definitions/:id",async()=>{await gate;return new HttpResponse(null,{status:204});}));
 renderWithProviders(<FormDeletionDialog id={fixtureFormId} name="Registrar visita" prefix="VIS" hasPublishedVersion={false} revision={1} scope={{actorId:"actor",culture:"es",permissions:["formtemplates.read","formtemplates.manage"]}} onDeleted={onDeleted} onClose={vi.fn()}/>);
 const dialog=await screen.findByRole("dialog");
 await userEvent.click(within(dialog).getByRole("button",{name:"Eliminar formulario"}));
 const working=await within(dialog).findByRole("button",{name:"Eliminando…"});
 expect(working).toHaveAttribute("aria-busy","true");expect(working).toBeDisabled();
 await act(async()=>release());
 await waitFor(()=>expect(onDeleted).toHaveBeenCalledOnce());
});
