import {act,fireEvent,screen,waitFor} from "@testing-library/react";
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import {StrictMode} from "react";
import {renderWithProviders} from "@/test/utils/renderWithProviders";
import {queryClient} from "@/shared/api/queryClient";
import {ApiError} from "@/shared/api/ApiError";
import {fetchFormPreview} from "../api/forms";
import {OfficialFormPreview} from "./OfficialFormPreview";
vi.mock("../api/forms",()=>({fetchFormPreview:vi.fn()}));
const url="https://www.facebook.com/whatsapp/flows/preview/fictional-private-url";
type Culture="es"|"en";
function preview({cultures=["es","en"],culture="es",originalCulture="es",versionId="v"}:{cultures?:Culture[];culture?:Culture;originalCulture?:Culture;versionId?:string}={}){return <StrictMode><OfficialFormPreview definitionId="d" versionId={versionId} versionNumber={1} culture={culture} originalCulture={originalCulture} cultures={cultures} onClose={()=>{}} /></StrictMode>;}
function renderPreview(options?:Parameters<typeof preview>[0]){return renderWithProviders(preview(options));}
beforeEach(()=>{vi.mocked(fetchFormPreview).mockReset();queryClient.clear();});
afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();});
describe("Official preview dialog",()=>{
 it("loads the menu language when it is published and the original otherwise, without a language selector",async()=>{
  vi.mocked(fetchFormPreview).mockResolvedValue({url,expiresAtUtc:"2099-10-10T12:00:00Z"});
  const published=renderPreview({cultures:["es","en"],culture:"en",originalCulture:"es"});
  await screen.findByTitle("Vista oficial del formulario en WhatsApp");
  expect(screen.queryAllByRole("button",{name:/^(Español|Inglés|Spanish|English)\b/})).toHaveLength(0);
  expect(fetchFormPreview).toHaveBeenCalledTimes(1);
  expect(fetchFormPreview).toHaveBeenLastCalledWith("d","v","en",expect.any(AbortSignal));
  published.unmount();vi.mocked(fetchFormPreview).mockClear();
  renderPreview({cultures:["es"],culture:"en",originalCulture:"es"});
  await screen.findByTitle("Vista oficial del formulario en WhatsApp");
  expect(screen.queryAllByRole("button",{name:/^(Español|Inglés|Spanish|English)\b/})).toHaveLength(0);
  expect(fetchFormPreview).toHaveBeenCalledTimes(1);
  expect(fetchFormPreview).toHaveBeenLastCalledWith("d","v","es",expect.any(AbortSignal));
 });
 it("requests an English original when the Spanish menu language is not published",async()=>{
  vi.mocked(fetchFormPreview).mockResolvedValue({url,expiresAtUtc:"2099-10-10T12:00:00Z"});
  renderPreview({cultures:["en"],culture:"es",originalCulture:"en"});
  await screen.findByTitle("Vista oficial del formulario en WhatsApp");
  expect(fetchFormPreview).toHaveBeenCalledTimes(1);
  expect(fetchFormPreview).toHaveBeenCalledWith("d","v","en",expect.any(AbortSignal));
 });
 it("loads once on opening and keeps the private URL out of QueryCache",async()=>{vi.mocked(fetchFormPreview).mockResolvedValue({url,expiresAtUtc:"2099-10-10T12:00:00Z"});renderPreview();const frame=await screen.findByTitle("Vista oficial del formulario en WhatsApp");expect(frame).toHaveAttribute("sandbox","allow-scripts allow-same-origin allow-forms");expect(frame).toHaveAttribute("referrerpolicy","no-referrer");expect(fetchFormPreview).toHaveBeenCalledTimes(1);expect(fetchFormPreview).toHaveBeenLastCalledWith("d","v","es",expect.any(AbortSignal));expect(screen.getByRole("link",{name:"Abrir en otra pestaña"})).toHaveAttribute("href",url);expect(JSON.stringify(queryClient.getQueryCache().getAll())).not.toContain("fictional-private-url");});
 it("removes expired frame and link without automatically renewing the URL",async()=>{vi.useFakeTimers();vi.mocked(fetchFormPreview).mockImplementation(async()=>({url,expiresAtUtc:new Date(Date.now()+2000).toISOString()}));renderPreview();await act(()=>vi.advanceTimersByTimeAsync(0));expect(screen.getByTitle("Vista oficial del formulario en WhatsApp")).toBeInTheDocument();await act(()=>vi.advanceTimersByTimeAsync(3000));expect(screen.queryByTitle("Vista oficial del formulario en WhatsApp")).not.toBeInTheDocument();expect(screen.queryByRole("link",{name:"Abrir en otra pestaña"})).not.toBeInTheDocument();expect(fetchFormPreview).toHaveBeenCalledTimes(1);fireEvent.click(screen.getByRole("button",{name:"Volver a pedir la vista"}));await act(()=>vi.advanceTimersByTimeAsync(0));expect(fetchFormPreview).toHaveBeenCalledTimes(2);});
 it("hides renewal after a forbidden preview response",async()=>{vi.mocked(fetchFormPreview).mockRejectedValue(new ApiError(403,{code:"General.Forbidden"}));renderPreview();await screen.findByText("Ya no tenés permiso para ver esta vista previa.");expect(screen.queryByRole("button",{name:"Cargar vista"})).not.toBeInTheDocument();expect(screen.queryByRole("link")).not.toBeInTheDocument();});
 it("discards a response from a withdrawn culture even when abort is ignored",async()=>{
  const pending:((value:{url:string;expiresAtUtc:string})=>void)[]=[];
  vi.mocked(fetchFormPreview).mockImplementation(()=>new Promise(resolve=>{pending.push(resolve);}));
  const view=renderPreview({cultures:["es","en"],culture:"en"});
  await waitFor(()=>expect(fetchFormPreview).toHaveBeenCalledTimes(1));
  view.rerender(preview({cultures:["es"],culture:"en"}));
  await waitFor(()=>expect(fetchFormPreview).toHaveBeenCalledTimes(2));
  expect(fetchFormPreview).toHaveBeenLastCalledWith("d","v","es",expect.any(AbortSignal));
  await act(()=>pending[0]!({url,expiresAtUtc:"2099-10-10T12:00:00Z"}));
  expect(screen.queryByTitle("Vista oficial del formulario en WhatsApp")).not.toBeInTheDocument();
  await act(()=>pending[1]!({url,expiresAtUtc:"2099-10-10T12:00:00Z"}));
  expect(screen.getByTitle("Vista oficial del formulario en WhatsApp")).toBeInTheDocument();
 });
});

it.each(["v", "new-version"])("retires a withdrawn menu language and renews only a published culture for %s", async versionId => {
 vi.mocked(fetchFormPreview).mockResolvedValue({url,expiresAtUtc:"2099-10-10T12:00:00Z"});
 const view = renderPreview({cultures:["es","en"],culture:"en"});
 await screen.findByTitle("Vista oficial del formulario en WhatsApp");
 expect(fetchFormPreview).toHaveBeenLastCalledWith("d","v","en",expect.any(AbortSignal));
 vi.mocked(fetchFormPreview).mockClear();
 view.rerender(preview({cultures:["es"],culture:"en",versionId}));
 await waitFor(()=>expect(fetchFormPreview).toHaveBeenCalledWith("d",versionId,"es",expect.any(AbortSignal)));
 await screen.findByTitle("Vista oficial del formulario en WhatsApp");
 fireEvent.click(screen.getByRole("button",{name:"Volver a pedir la vista"}));
 await waitFor(()=>expect(fetchFormPreview).toHaveBeenCalledTimes(2));
 expect(vi.mocked(fetchFormPreview).mock.calls.every(call=>call[2]==="es")).toBe(true);
});

// The wait of a 429 is the reason of the disabled load button, like the other dialog footers: never a text in the dialog.
it("gives the wait of a 429 as the reason of the disabled load button",async()=>{
 vi.mocked(fetchFormPreview).mockRejectedValue(new ApiError(429,{code:"RateLimit.Exceeded",detail:"Demasiados pedidos.",retryAfter:30}));
 renderPreview();
 const wait=/^Esperá [0-9]+ segundos para volver a intentar\.$/;
 await waitFor(()=>expect(screen.getByRole("button",{name:"Cargar vista"})).toHaveAccessibleDescription(wait));
 expect(screen.getByRole("button",{name:"Cargar vista"})).toBeDisabled();
 for(const text of screen.getAllByText(wait))expect(text).not.toBeVisible();
 expect(fetchFormPreview).toHaveBeenCalledTimes(1);
});

// The title says what it is and «Abrir en otra pestaña» is in the footer: no description and no note (2026-10-31). Meta's
// page takes a moment to draw: the region says it is loading until its frame loads.
it("says the official view is loading until its frame loads, without notes",async()=>{
 vi.mocked(fetchFormPreview).mockResolvedValue({url,expiresAtUtc:"2099-10-10T12:00:00Z"});
 renderPreview();
 const frame=await screen.findByTitle("Vista oficial del formulario en WhatsApp");
 expect(screen.getByRole("dialog")).not.toHaveAccessibleDescription();
 expect(screen.queryByText("La vista de WhatsApp corresponde a la versión publicada.")).not.toBeInTheDocument();
 expect(screen.queryByText("Si no ves la vista, abrila en otra pestaña.")).not.toBeInTheDocument();
 expect(screen.getByText("Cargando la vista de WhatsApp…").closest("[role=status]")).not.toBeNull();
 fireEvent.load(frame);
 await waitFor(()=>expect(screen.queryByText("Cargando la vista de WhatsApp…")).not.toBeInTheDocument());
 expect(frame).toBeInTheDocument();
});

// VO1-A (2026-11-06): the dialog takes the size Meta lays its preview out for (430 × 800) and the page scales whole to fit. The backend
// gives the link ready to be gone through (Meta's interactive mode, with sample options of each list): it is used as it comes, also
// in another tab, so nothing the backend put in it is lost.
it("shows Meta's preview as the backend gives it, at the size Meta lays it out for", async () => {
 const interactive = "https://business.facebook.com/wa/manage/flows/123/preview/?token=private&interactive=true&flow_action=navigate&flow_action_payload=%7B%22screen%22%3A%22FORM%22%2C%22data%22%3A%7B%22articulo_options%22%3A%5B%5D%7D%7D";
 vi.mocked(fetchFormPreview).mockResolvedValue({url:interactive,expiresAtUtc:"2099-10-10T12:00:00Z"});
 renderPreview();
 const frame = await screen.findByTitle("Vista oficial del formulario en WhatsApp");
 expect(frame.getAttribute("src")).toBe(interactive);
 expect(frame).toHaveStyle({ width: "430px", height: "800px" });
 expect(screen.getByRole("link", { name: "Abrir en otra pestaña" }).getAttribute("href")).toBe(interactive);
});
