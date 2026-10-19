import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createInstance, type ReadCallback } from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { useState } from "react";
import { HttpResponse, http } from "msw";
import { expect, it } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { server } from "@/test/mocks/server";
import es from "@/locales/es/whatsapp.json";
import en from "@/locales/en/whatsapp.json";
import common from "@/locales/es/common.json";
import { ChatThread } from "./ChatThread";
import type { ChatDraft } from "./ChatComposer";
import type { Chat } from "../api/chat";
it("keeps the selected chat and both private drafts visible while English resources are still loading", async () => {
 const language = createInstance();
 let finish: ReadCallback | undefined;
 await language.use(initReactI18next).use({type:"backend" as const,init(){},read(lng:string,_ns:string,callback:ReadCallback){if(lng==="en"&&_ns==="whatsapp")finish=callback;else callback(null,common);}}).init({lng:"es",fallbackLng:"es",ns:["whatsapp","common"],defaultNS:"whatsapp",partialBundledLanguages:true,resources:{es:{whatsapp:es,common}},interpolation:{escapeValue:false}});
 const option={definitionId:"019abcde-1000-7000-8000-000000000001",versionId:"019abcde-1000-7000-8000-000000000002",versionNumber:1,prefix:"VIS",name:{es:"Registrar visita",en:"Register visit"},questionCount:4,submitLabel:{es:"Confirmar visita",en:"Confirm visit"}};
 const contact: Chat={id:"language-chat",profileName:"Juan",phoneNumber:"+5493515551234",mode:"Manual",modeRevision:7,lastInboundAtUtc:new Date().toISOString(),lastInboundSequence:1,unreadCount:0,preview:"Hola",linkedAccount:{userId:"employee",displayName:"Juan",email:null,isActive:true},formEligibility:{status:"Eligible",recipientCulture:"en",recipientContextRevision:"opaque-1"}};
 server.use(http.get("/api/whatsapp/chats/:id/messages",()=>HttpResponse.json({ assistantSuggestion: null, assistantAvailability: { state: "notInstalled" },contact,messages:[],outgoing:[],beforeAtUtc:null,beforeId:null})),http.put("/api/whatsapp/chats/:id/read",()=>new HttpResponse(null,{status:204})),http.get("/api/whatsapp/chats/:id/forms/:definitionId/versions/:versionId/preparation",()=>HttpResponse.json({culture:"en",recipientContextRevision:"opaque-1",preparation:{canSend:true,catalogs:[],issues:[]}})),http.get("/api/whatsapp/chats/:id/forms",()=>HttpResponse.json({page:{items:[option],page:1,pageSize:4,totalCount:1,totalPages:1,hasPrevious:false,hasNext:false},recipientCulture:"en",recipientContextRevision:"opaque-1"})));
 function SelectedChat(){const[draft,setDraft]=useState<ChatDraft>({body:"Borrador de respuesta",form:{message:"Mensaje de formulario editado",selection:option,recipientCulture:"en",recipientContextRevision:"opaque-1",modeRevision:7,touched:true,messageEdited:true}});return <I18nextProvider i18n={language}><ChatThread id={contact.id} actor="me" readPermissions={["whatsapp.read", "whatsapp.send"]} canSend canConfigureAssistant={false} draft={draft} updateDraft={setDraft} onBack={()=>{}} /></I18nextProvider>;}
 renderWithProviders(<SelectedChat />);
 const reply=await screen.findByLabelText("Respuesta al cliente");
 const heading=screen.getByRole("heading",{name:"Juan"});
 await waitFor(()=>expect(finish).toBeTypeOf("function"));
 expect(language.hasResourceBundle("en","whatsapp")).toBe(false);
 expect(reply).toBeVisible();expect(reply).toHaveValue("Borrador de respuesta");expect(reply).toBeEnabled();expect(heading).toBeVisible();
 expect(screen.getByRole("button",{name:"Enviar formulario"})).toBeDisabled();
 await act(async()=>{finish!(null,en);});
 await waitFor(()=>expect(screen.getByRole("button",{name:"Enviar formulario"})).toBeEnabled());
 expect(screen.getByLabelText("Respuesta al cliente")).toBe(reply);expect(reply).toHaveValue("Borrador de respuesta");expect(screen.getByRole("heading",{name:"Juan"})).toBe(heading);
 await userEvent.click(screen.getByRole("button",{name:"Enviar formulario"}));const dialog=await screen.findByRole("dialog");
 expect(within(dialog).getByRole("textbox",{name:"Mensaje que lo acompaña"})).toHaveValue("Mensaje de formulario editado");
 expect(await within(dialog).findByRole("radio",{name:"Register visit"})).toHaveAttribute("aria-checked","true");
});

it("waits for presentation resources when a Spanish account receives a complete English original", async () => {
 const language=createInstance(); let finish:ReadCallback|undefined;
 await language.use(initReactI18next).use({type:"backend" as const,init(){},read(lng:string,ns:string,callback:ReadCallback){if(lng==="en"&&ns==="whatsapp")finish=callback;else callback(null,common);}}).init({lng:"es",fallbackLng:"es",ns:["whatsapp","common"],defaultNS:"whatsapp",partialBundledLanguages:true,resources:{es:{whatsapp:es,common}},interpolation:{escapeValue:false}});
 const option={definitionId:"019abcde-1000-7000-8000-000000000001",versionId:"019abcde-1000-7000-8000-000000000002",versionNumber:1,prefix:"VIS",name:{es:"Registrar visita",en:"Register visit"},questionCount:1,submitLabel:{es:"Confirmar visita",en:"Confirm visit"}};
 const contact:Chat={id:"original-en-chat",profileName:"Juan",phoneNumber:"+5493515551234",mode:"Manual",modeRevision:7,lastInboundAtUtc:new Date().toISOString(),lastInboundSequence:1,unreadCount:0,preview:"Hola",linkedAccount:{userId:"employee",displayName:"Juan",email:null,isActive:true},formEligibility:{status:"Eligible",recipientCulture:"es",recipientContextRevision:"opaque-1"}};
 server.use(http.get("/api/whatsapp/chats/:id/messages",()=>HttpResponse.json({assistantSuggestion:null,assistantAvailability:{state:"notInstalled"},contact,messages:[],outgoing:[],beforeAtUtc:null,beforeId:null})),http.get("/api/whatsapp/chats/:id/forms",()=>HttpResponse.json({page:{items:[option],page:1,pageSize:4,totalCount:1,totalPages:1,hasPrevious:false,hasNext:false},recipientCulture:"es",recipientContextRevision:"opaque-1"})),http.get("/api/whatsapp/chats/:id/forms/:definitionId/versions/:versionId/preparation",()=>HttpResponse.json({culture:"en",recipientContextRevision:"opaque-1",preparation:{canSend:true,catalogs:[],issues:[]}})));
 function SelectedChat(){const[draft,setDraft]=useState<ChatDraft>({body:"Borrador del chat"});return <I18nextProvider i18n={language}><ChatThread id={contact.id} actor="me" readPermissions={["whatsapp.read","whatsapp.send"]} canSend canConfigureAssistant={false} draft={draft} updateDraft={setDraft} onBack={()=>{}}/></I18nextProvider>;}
 renderWithProviders(<SelectedChat/>); const ordinary=await screen.findByLabelText("Respuesta al cliente");
 await userEvent.click(screen.getByRole("button",{name:"Enviar formulario"})); const dialog=await screen.findByRole("dialog");
 await userEvent.click(await within(dialog).findByRole("radio",{name:"Registrar visita"}));
 await within(dialog).findByText("Le llega en inglés."); await waitFor(()=>expect(finish).toBeTypeOf("function"));
 expect(within(dialog).getByRole("button",{name:"Enviar formulario"})).toBeDisabled();
 expect(within(dialog).getByRole("textbox",{name:"Mensaje que lo acompaña"})).toHaveValue("Completá este formulario.");
 expect(within(dialog).queryByText(/^Es lo que lee arriba del botón/)).not.toBeInTheDocument();
 await act(async()=>{finish!(null,en);});
 await waitFor(()=>expect(within(dialog).getByRole("button",{name:"Enviar formulario"})).toBeEnabled());
 expect(within(dialog).getByRole("textbox",{name:"Mensaje que lo acompaña"})).toHaveValue("Complete this form.");
 expect(within(dialog).getByText(/Open form/)).toHaveTextContent("Confirm visit");
 expect(screen.getByLabelText("Respuesta al cliente")).toBe(ordinary); expect(ordinary).toHaveValue("Borrador del chat");
});
