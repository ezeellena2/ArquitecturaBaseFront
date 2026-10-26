import { notify, dismissNotification } from "@/shared/ui/notifications";
import {act,screen,waitFor,within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {http,HttpResponse} from "msw";
import {beforeEach,expect,it,vi} from "vitest";
import {renderWithProviders} from "@/test/utils/renderWithProviders";
import {server} from "@/test/mocks/server";
import {responseRecordId} from "@/test/responseFixtures";
import {savePrivateBlob} from "@/shared/hooks/usePrivateFormFile";
import {useResponseDocumentDownloads} from "../hooks/useResponseDocumentDownloads";
import {ResponseDocuments, ResponseDocumentDownloads} from "./ResponseDocuments";
vi.mock("@/shared/hooks/usePrivateFormFile",async()=>({...await vi.importActual<typeof import("@/shared/hooks/usePrivateFormFile")>("@/shared/hooks/usePrivateFormFile"),savePrivateBlob:vi.fn()}));
function DocumentsHarness(props: { owner: string; recordId: string; documents: Parameters<typeof ResponseDocuments>[0]["documents"]; onForbidden: () => void; menu?: boolean; disabled?: boolean }) { const downloads = useResponseDocumentDownloads(props.owner, props.recordId, props.onForbidden, props.disabled); return props.menu ? <ResponseDocumentDownloads documents={props.documents} downloads={downloads}/> : <ResponseDocuments {...props} downloads={downloads}/>; }
const document={id:"0199a0c0-0000-7000-8000-000000000080",runId:"0199a0c0-0000-7000-8000-000000000090",culture:"es" as const,name:"Visita aprobada.pdf",size:40,createdAtUtc:"2026-10-16T12:00:00Z"};
beforeEach(()=>{vi.clearAllMocks();Object.defineProperty(URL,"createObjectURL",{configurable:true,value:vi.fn().mockReturnValue("blob:fixed-pdf")});Object.defineProperty(URL,"revokeObjectURL",{configurable:true,value:vi.fn()});});
it("opens and downloads only the issued fixed document and revokes the preview URL",async()=>{const requests:string[]=[];server.use(http.get("/api/forms/records/:recordId/documents/:documentId/content",({request,params})=>{expect(params.recordId).toBe(responseRecordId);expect(params.documentId).toBe(document.id);requests.push(new URL(request.url).searchParams.get("download")!);return new HttpResponse(new Uint8Array([37,80,68,70]),{headers:{"content-type":"application/pdf","content-language":"es","content-disposition":"attachment; filename=\"Visita aprobada.pdf\""}});}));renderWithProviders(<DocumentsHarness owner="document-test-owner" recordId={responseRecordId} documents={[document]} onForbidden={vi.fn()}/>);await userEvent.click(screen.getByRole("button",{name:"Ver PDF"}));const dialog=await screen.findByRole("dialog");await waitFor(()=>expect(within(dialog).getByTitle("Vista previa del PDF")).toHaveAttribute("src","blob:fixed-pdf"));expect(within(dialog).getByTitle("Vista previa del PDF")).not.toHaveAttribute("sandbox");const alternative=within(dialog).getByRole("link",{name:"Descargar"});expect(alternative).toHaveAttribute("href","blob:fixed-pdf");expect(alternative).toHaveAttribute("download","Visita aprobada.pdf");expect(requests).toEqual(["false"]);await userEvent.click(within(dialog).getAllByRole("button",{name:"Cerrar"})[0]);expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:fixed-pdf");await userEvent.click(screen.getByRole("button",{name:"Descargar"}));await waitFor(()=>expect(savePrivateBlob).toHaveBeenCalledWith(expect.anything(),"Visita aprobada.pdf"));expect(requests).toEqual(["false","true"]);});
it("removes the issued document view when read permission is revoked",async()=>{const deny=vi.fn();server.use(http.get("/api/forms/records/:recordId/documents/:documentId/content",()=>HttpResponse.json({code:"Authorization.Forbidden"},{status:403})));renderWithProviders(<DocumentsHarness owner="document-test-owner" recordId={responseRecordId} documents={[document]} onForbidden={deny}/>);await userEvent.click(screen.getByRole("button",{name:"Ver PDF"}));await waitFor(()=>expect(deny).toHaveBeenCalledOnce());expect(URL.createObjectURL).not.toHaveBeenCalled();});

vi.mock("@/shared/ui/notifications", async () => ({ ...await vi.importActual<typeof import("@/shared/ui/notifications")>("@/shared/ui/notifications"), notify: vi.fn(), dismissNotification: vi.fn() }));

it("notifies a PDF preview read failure once while keeping recovery in the view", async () => {
  server.use(http.get("/api/forms/records/:recordId/documents/:documentId/content", () => HttpResponse.json({ code: "Test.Pdf", detail: "No pudimos leer esta copia." }, { status: 400 })));
  const view = renderWithProviders(<DocumentsHarness owner="document-test-owner" recordId={responseRecordId} documents={[document]} onForbidden={vi.fn()}/>);
  await userEvent.click(screen.getByRole("button", { name: "Ver PDF" }));
  await waitFor(() => expect(notify).toHaveBeenCalledOnce());
  const notice = vi.mocked(notify).mock.calls[0][0];
  expect(notice).toMatchObject({ kind: "error", message: "No pudimos leer esta copia." });
  expect(screen.queryByText(notice.message)).not.toBeInTheDocument();
  expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  view.unmount();
  expect(dismissNotification).toHaveBeenCalledWith(notice.id);
});
// The wait is the reason of Ver PDF and Descargar (`DisabledReason`), not a text at the foot of the surface.
it("notifies one document download wait and gives it as the reason of each disabled action", async () => {
  server.use(http.get("/api/forms/records/:recordId/documents/:documentId/content", () => HttpResponse.json({ code: "RateLimit.Exceeded", detail: "Esperá para descargar esta copia.", retryAfter: 60 }, { status: 429 })));
  renderWithProviders(<DocumentsHarness owner="document-test-owner" recordId={responseRecordId} documents={[document]} onForbidden={vi.fn()}/>);
  await userEvent.click(screen.getByRole("button", { name: "Descargar" }));
  await waitFor(() => expect(notify).toHaveBeenCalledOnce());
  expect(screen.queryByText("Esperá para descargar esta copia.")).not.toBeInTheDocument();
  const wait = /^Esperá \d+ segundos para volver a intentar\.$/;
  for (const name of ["Ver PDF", "Descargar"]) {
    await waitFor(() => expect(screen.getByRole("button", { name })).toHaveAccessibleDescription(wait));
    expect(screen.getByRole("button", { name })).toBeDisabled();
  }
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  for (const text of screen.getAllByText(wait)) expect(text).not.toBeVisible();
  expect(savePrivateBlob).not.toHaveBeenCalled();
});
// In the «Descargar ▾» menu the items keep their reason inside, as every menu does.
it("tells the download wait inside the disabled items of the download menu", async () => {
  server.use(http.get("/api/forms/records/:recordId/documents/:documentId/content", () => HttpResponse.json({ code: "RateLimit.Exceeded", retryAfter: 60 }, { status: 429 })));
  renderWithProviders(<DocumentsHarness menu owner="document-test-owner" recordId={responseRecordId} documents={[document]} onForbidden={vi.fn()}/>);
  await act(async () => screen.getByRole("button", { name: "Descargar" }).focus());
  await userEvent.keyboard("{Enter}");
  await userEvent.click(await screen.findByRole("menuitem", { name: document.name }));
  await waitFor(() => expect(notify).toHaveBeenCalledOnce());
  await act(async () => screen.getByRole("button", { name: "Descargar" }).focus());
  await userEvent.keyboard("{Enter}");
  const item = await screen.findByRole("menuitem", { name: /^Visita aprobada\.pdf/ });
  expect(item).toHaveAttribute("data-disabled");
  expect(item).toHaveTextContent(/Esperá \d+ segundos para volver a intentar\.$/);
});

it("keeps a requested download alive after the menu closes without loading bytes on open", async () => {
  let release: (() => void) | undefined;
  let requests = 0;
  server.use(http.get("/api/forms/records/:recordId/documents/:documentId/content", async () => {
    requests++; await new Promise<void>(resolve => { release = resolve; });
    return new HttpResponse(new Uint8Array([37,80,68,70]), { headers: { "content-type": "application/pdf", "content-language": "es" } });
  }));
  renderWithProviders(<DocumentsHarness menu owner="document-test-owner" recordId={responseRecordId} documents={[document]} onForbidden={vi.fn()}/>);
  await act(async () => screen.getByRole("button", { name: "Descargar" }).focus());
  await userEvent.keyboard("{Enter}");
  const item = await screen.findByRole("menuitem", { name: document.name });
  expect(requests).toBe(0);
  await userEvent.click(item);
  await waitFor(() => expect(requests).toBe(1));
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("menuitem")).not.toBeInTheDocument());
  await act(async () => release?.());
  await waitFor(() => expect(savePrivateBlob).toHaveBeenCalledOnce());
});

it("blocks viewing and downloading the previous fixed PDF until the navigation target is confirmed", async () => {
  let reads = 0;
  server.use(http.get("/api/forms/records/:recordId/documents/:documentId/content", () => { reads++; return new HttpResponse(new Uint8Array([37,80,68,70]), { headers: { "content-type": "application/pdf", "content-language": "es" } }); }));
  const props = { owner: "document-target-owner", recordId: responseRecordId, documents: [document], onForbidden: vi.fn() };
  const view = renderWithProviders(<DocumentsHarness {...props} disabled/>);
  const preview = screen.getByRole("button", { name: "Ver PDF" });
  expect(preview).toBeDisabled();
  expect(screen.getByRole("button", { name: "Descargar" })).toBeDisabled();
  await userEvent.click(preview);
  expect(reads).toBe(0);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  view.rerender(<DocumentsHarness {...props} disabled={false}/>);
  await userEvent.click(screen.getByRole("button", { name: "Ver PDF" }));
  await waitFor(() => expect(reads).toBe(1));
  expect(await screen.findByRole("dialog")).toBeInTheDocument();
});
