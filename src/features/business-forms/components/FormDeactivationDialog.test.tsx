import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import i18n from "@/shared/i18n";
import { notify } from "@/shared/ui/notifications";
import { server } from "@/test/mocks/server";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { fixtureFormId, fixtureLifecycle } from "@/test/visual/formFixtures";
import type { FormDeactivation } from "../api/response";
import { FormDeactivationDialog } from "./FormDeactivationDialog";
vi.mock("@/shared/ui/notifications",async()=>({...await vi.importActual<typeof import("@/shared/ui/notifications")>("@/shared/ui/notifications"),notify:vi.fn()}));
const scope={actorId:"actor",culture:"es" as const,permissions:["formtemplates.read","formtemplates.publish"]};
const impact=(changes:Partial<FormDeactivation["lifecycle"]>={})=>({definitionId:fixtureFormId,revision:1,lifecycle:fixtureLifecycle(1,{canDeactivate:true,unavailableReason:null,deprecationState:"Pending",...changes}),affectedSuggestions:[]});
beforeEach(async()=>{await i18n.changeLanguage("es");vi.mocked(notify).mockClear();});
for(const language of ["es","en"] as const) it("explains immediate deprecation without claiming open sends or completed work in "+language,async()=>{
 await i18n.changeLanguage(language);server.use(http.get("/api/forms/definitions/:id/deactivation",()=>HttpResponse.json(impact())));
 renderWithProviders(<FormDeactivationDialog id={fixtureFormId} name="Registrar visita" scope={{...scope,culture:language}} onComplete={vi.fn()} onObserved={vi.fn()} onClose={vi.fn()}/>);
 const dialog=await screen.findByRole("dialog");
 expect(await within(dialog).findByText(language==="es"?"En WhatsApp no se deshace. No hay envíos abiertos: se deprecan ahora sus Flows. Para volver a usarlo, se reactiva con una versión nueva.":"This cannot be undone on WhatsApp. There are no open sends: its Flows will be deprecated immediately. Reactivating publishes a new version.")).toBeVisible();
 expect(within(dialog).queryByText(language==="es"?"Los envíos abiertos se pueden responder hasta que vencen.":"Open sends can still be answered until they expire.")).not.toBeInTheDocument();
 expect(within(dialog).queryByText(language==="es"?"Deprecación pendiente en WhatsApp.":"Deprecation pending on WhatsApp.")).not.toBeInTheDocument();
});

for(const failure of ["network","500"] as const) it("observes an applied deactivation after a lost "+failure+" result without claiming its revision",async()=>{
 let reads=0;const writes=vi.fn();const onComplete=vi.fn();const onObserved=vi.fn();const onClose=vi.fn();
 server.use(http.get("/api/forms/definitions/:id/deactivation",()=>{reads++;return HttpResponse.json(reads===1?impact():{...impact({deactivatedAtUtc:"2026-10-21T12:00:00Z",canDeactivate:false}),revision:3,lifecycle:{...impact().lifecycle,revision:3,deactivatedAtUtc:"2026-10-21T12:00:00Z",canDeactivate:false}});}),http.post("/api/forms/definitions/:id/deactivation",()=>{writes();return failure==="network"?HttpResponse.error():HttpResponse.json({traceId:"lost-write"},{status:500});}));
 renderWithProviders(<FormDeactivationDialog id={fixtureFormId} name="Registrar visita" scope={scope} expectedRevision={1} onComplete={onComplete} onObserved={onObserved} onClose={onClose}/>);
 const dialog=await screen.findByRole("dialog");await userEvent.click(await within(dialog).findByRole("button",{name:"Dar de baja"}));
 await waitFor(()=>expect(onObserved).toHaveBeenCalledOnce());expect(onComplete).not.toHaveBeenCalled();expect(onClose).toHaveBeenCalledOnce();expect(writes).toHaveBeenCalledOnce();expect(reads).toBe(2);
 expect(vi.mocked(notify).mock.calls.some(([notice])=>notice.kind==="success")).toBe(false);
 expect(vi.mocked(notify).mock.calls.some(([notice])=>notice.message.includes("Revisá el estado actual"))).toBe(true);
});
it("waits for a fresh impact after a network failure before allowing another decision",async()=>{
 let reads=0;let release!:()=>void;const reread=new Promise<void>(resolve=>{release=resolve;});const writes=vi.fn();const onObserved=vi.fn();
 server.use(http.get("/api/forms/definitions/:id/deactivation",async()=>{reads++;if(reads>1)await reread;return HttpResponse.json(impact());}),http.post("/api/forms/definitions/:id/deactivation",()=>{writes();return HttpResponse.error();}));
 renderWithProviders(<FormDeactivationDialog id={fixtureFormId} name="Registrar visita" scope={scope} onComplete={vi.fn()} onObserved={onObserved} onClose={vi.fn()}/>);
 const button=await screen.findByRole("button",{name:"Dar de baja"});await waitFor(()=>expect(button).toBeEnabled());await userEvent.click(button);await waitFor(()=>expect(reads).toBe(2));expect(screen.getByRole("button",{name:"Dando de baja…"})).toBeDisabled();
 await act(async()=>release());await waitFor(()=>expect(screen.getByRole("button",{name:"Dar de baja"})).toBeEnabled());expect(onObserved).not.toHaveBeenCalled();expect(writes).toHaveBeenCalledOnce();
});

it("requires a successful impact reread after a failed recovery read",async()=>{
 let reads=0;const writes=vi.fn();const onObserved=vi.fn();
 server.use(http.get("/api/forms/definitions/:id/deactivation",()=>{reads++;return reads===2?HttpResponse.error():HttpResponse.json(impact());}),http.post("/api/forms/definitions/:id/deactivation",()=>{writes();return HttpResponse.error();}));
 renderWithProviders(<FormDeactivationDialog id={fixtureFormId} name="Registrar visita" scope={scope} onComplete={vi.fn()} onObserved={onObserved} onClose={vi.fn()}/>);
 const button=await screen.findByRole("button",{name:"Dar de baja"});await waitFor(()=>expect(button).toBeEnabled());await userEvent.click(button);
 const retry=await screen.findByRole("button",{name:"Reintentar"});expect(screen.getByRole("button",{name:"Dar de baja"})).toBeDisabled();expect(writes).toHaveBeenCalledOnce();expect(onObserved).not.toHaveBeenCalled();
 await userEvent.click(retry);await waitFor(()=>expect(screen.getByRole("button",{name:"Dar de baja"})).toBeEnabled());expect(writes).toHaveBeenCalledOnce();
});

// Only the consequences stay, without explanations of how they work (2026-10-31): no description under the title, no note
// under «No se manda más desde el chat», about open sends or about the kept files. Where a request goes still says so.
it("keeps only the consequences of the deactivation",async()=>{
 server.use(http.get("/api/forms/definitions/:id/deactivation",()=>HttpResponse.json(impact({lastOpenSessionExpiresAtUtc:"2026-10-22T18:00:00Z",responseCount:24}))));
 renderWithProviders(<FormDeactivationDialog id={fixtureFormId} name="Registrar visita" scope={scope} timeZoneId="America/Argentina/Buenos_Aires" onComplete={vi.fn()} onObserved={vi.fn()} onClose={vi.fn()}/>);
 const dialog=await screen.findByRole("dialog",{name:"Dar de baja «Registrar visita»"});
 expect(await within(dialog).findByText("Si alguien lo pide, se anota en «Formularios que faltan».")).toBeVisible();
 expect(within(dialog).getByText(/El último envío abierto vence el/)).toBeVisible();
 for(const note of ["Revisá qué cambia antes de confirmar. Lo cargado se conserva.","Sale del selector «Enviar formulario».","Los envíos abiertos se pueden responder hasta que vencen.","Con sus fotos y documentos, en la planilla y en el Excel."])expect(within(dialog).queryByText(note)).not.toBeInTheDocument();
 expect(dialog).not.toHaveAccessibleDescription();
});

// Why it cannot be deactivated is the reason of the disabled button (tooltip and description), not a paragraph in the dialog.
it.each([
 [{canDeactivate:false,unavailableReason:"PublicationInProgress" as const},"Hay una publicación en curso."],
 [{canDeactivate:false,unavailableReason:null,deactivatedAtUtc:"2026-10-21T12:00:00Z"},"El formulario ya está dado de baja."],
])("gives why it cannot be deactivated as the reason of the button",async(changes,reason)=>{
 server.use(http.get("/api/forms/definitions/:id/deactivation",()=>HttpResponse.json(impact(changes))));
 renderWithProviders(<FormDeactivationDialog id={fixtureFormId} name="Registrar visita" scope={scope} onComplete={vi.fn()} onObserved={vi.fn()} onClose={vi.fn()}/>);
 const dialog=await screen.findByRole("dialog");
 await within(dialog).findByText("Qué deja de pasar");
 const button=within(dialog).getByRole("button",{name:"Dar de baja"});
 expect(button).toBeDisabled();
 expect(button).toHaveAccessibleDescription(reason);
 expect(within(dialog).getAllByText(reason).every(node=>node.closest("[hidden]"))).toBe(true);
});

// Every action that takes time shows it (2026-10-31): the confirmation and the retry after an uncertain result.
it("shows on its button that it deactivates and, after an uncertain result, that it retries",async()=>{
 let reads=0;let releaseWrite!:()=>void;const write=new Promise<void>(resolve=>{releaseWrite=resolve;});let releaseRead!:()=>void;const read=new Promise<void>(resolve=>{releaseRead=resolve;});
 server.use(http.get("/api/forms/definitions/:id/deactivation",async()=>{reads++;if(reads===2)return HttpResponse.error();if(reads===3)await read;return HttpResponse.json(impact());}),http.post("/api/forms/definitions/:id/deactivation",async()=>{await write;return HttpResponse.error();}));
 renderWithProviders(<FormDeactivationDialog id={fixtureFormId} name="Registrar visita" scope={scope} onComplete={vi.fn()} onObserved={vi.fn()} onClose={vi.fn()}/>);
 const button=await screen.findByRole("button",{name:"Dar de baja"});await waitFor(()=>expect(button).toBeEnabled());await userEvent.click(button);
 const working=await screen.findByRole("button",{name:"Dando de baja…"});
 expect(working).toHaveAttribute("aria-busy","true");expect(working).toBeDisabled();
 await act(async()=>releaseWrite());
 const retry=await screen.findByRole("button",{name:"Reintentar"});await waitFor(()=>expect(retry).toBeEnabled());
 await userEvent.click(retry);
 const retrying=await screen.findByRole("button",{name:"Reintentando…"});
 expect(retrying).toHaveAttribute("aria-busy","true");
 await act(async()=>releaseRead());
 await waitFor(()=>expect(screen.getByRole("button",{name:"Dar de baja"})).toBeEnabled());
 expect(screen.queryByRole("button",{name:/Reintent/})).not.toBeInTheDocument();
});
