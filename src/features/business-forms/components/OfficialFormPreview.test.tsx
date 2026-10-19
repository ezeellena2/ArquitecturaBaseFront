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
function renderPreview(cultures: ("es"|"en")[] = ["es","en"], initialCulture: "es"|"en" = "es"){return renderWithProviders(<StrictMode><OfficialFormPreview definitionId="d" versionId="v" versionNumber={1} initialCulture={initialCulture} cultures={cultures} onClose={()=>{}} /></StrictMode>);}
beforeEach(()=>{vi.mocked(fetchFormPreview).mockReset();queryClient.clear();});
afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();});
describe("Official preview dialog",()=>{
 it("loads once on explicit opening, then waits for an explicit request after changing content culture",async()=>{vi.mocked(fetchFormPreview).mockResolvedValue({url,expiresAtUtc:"2099-10-10T12:00:00Z"});renderPreview();const frame=await screen.findByTitle("Vista oficial del formulario en WhatsApp");expect(frame).toHaveAttribute("sandbox","allow-scripts allow-same-origin allow-forms");expect(frame).toHaveAttribute("referrerpolicy","no-referrer");expect(fetchFormPreview).toHaveBeenCalledTimes(1);expect(fetchFormPreview).toHaveBeenLastCalledWith("d","v","es",expect.any(AbortSignal));fireEvent.click(screen.getByRole("button",{name:"Inglés"}));expect(screen.queryByTitle("Vista oficial del formulario en WhatsApp")).not.toBeInTheDocument();expect(screen.queryByRole("link",{name:"Abrir en otra pestaña"})).not.toBeInTheDocument();expect(fetchFormPreview).toHaveBeenCalledTimes(1);fireEvent.click(screen.getByRole("button",{name:"Cargar vista"}));await screen.findByTitle("Vista oficial del formulario en WhatsApp");expect(fetchFormPreview).toHaveBeenLastCalledWith("d","v","en",expect.any(AbortSignal));expect(JSON.stringify(queryClient.getQueryCache().getAll())).not.toContain("fictional-private-url");});
 it("removes expired frame and link without automatically renewing the URL",async()=>{vi.useFakeTimers();vi.mocked(fetchFormPreview).mockImplementation(async()=>({url,expiresAtUtc:new Date(Date.now()+2000).toISOString()}));renderPreview();await act(()=>vi.advanceTimersByTimeAsync(0));expect(screen.getByTitle("Vista oficial del formulario en WhatsApp")).toBeInTheDocument();await act(()=>vi.advanceTimersByTimeAsync(3000));expect(screen.queryByTitle("Vista oficial del formulario en WhatsApp")).not.toBeInTheDocument();expect(screen.queryByRole("link",{name:"Abrir en otra pestaña"})).not.toBeInTheDocument();expect(fetchFormPreview).toHaveBeenCalledTimes(1);fireEvent.click(screen.getByRole("button",{name:"Volver a pedir la vista"}));await act(()=>vi.advanceTimersByTimeAsync(0));expect(fetchFormPreview).toHaveBeenCalledTimes(2);});
 it("hides renewal after a forbidden preview response",async()=>{vi.mocked(fetchFormPreview).mockRejectedValue(new ApiError(403,{code:"General.Forbidden"}));renderPreview();await screen.findByText("Ya no tenés permiso para ver esta vista previa.");expect(screen.queryByRole("button",{name:"Cargar vista"})).not.toBeInTheDocument();expect(screen.queryByRole("link")).not.toBeInTheDocument();});
 it("discards a response from the previous culture even when abort is ignored",async()=>{let finish:(value:{url:string;expiresAtUtc:string})=>void=()=>{};vi.mocked(fetchFormPreview).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));renderPreview();await waitFor(()=>expect(fetchFormPreview).toHaveBeenCalledTimes(1));fireEvent.click(screen.getByRole("button",{name:"Inglés"}));await act(()=>finish({url,expiresAtUtc:"2099-10-10T12:00:00Z"}));expect(screen.queryByTitle("Vista oficial del formulario en WhatsApp")).not.toBeInTheDocument();});
});

it.each(["es", "en"] as const)("only offers published %s and never requests an absent initial culture", async original => {
 vi.mocked(fetchFormPreview).mockResolvedValue({url,expiresAtUtc:"2099-10-10T12:00:00Z"});
 renderPreview([original], original === "es" ? "en" : "es");
 await screen.findByTitle("Vista oficial del formulario en WhatsApp");
 expect(fetchFormPreview).toHaveBeenCalledTimes(1);
 expect(fetchFormPreview).toHaveBeenCalledWith("d","v",original,expect.any(AbortSignal));
 expect(screen.queryByRole("button",{name:original === "es" ? "Inglés" : "Español"})).not.toBeInTheDocument();
});

it.each(["v", "new-version"])("retires a removed preview culture and renews only a published culture for %s", async versionId => {
 vi.mocked(fetchFormPreview).mockResolvedValue({url,expiresAtUtc:"2099-10-10T12:00:00Z"});
 const view = renderPreview();
 await screen.findByTitle("Vista oficial del formulario en WhatsApp");
 fireEvent.click(screen.getByRole("button",{name:"Inglés"}));
 fireEvent.click(screen.getByRole("button",{name:"Cargar vista"}));
 await screen.findByTitle("Vista oficial del formulario en WhatsApp");
 vi.mocked(fetchFormPreview).mockClear();
 view.rerender(<StrictMode><OfficialFormPreview definitionId="d" versionId={versionId} versionNumber={2} initialCulture="es" cultures={["es"]} onClose={()=>{}} /></StrictMode>);
 await waitFor(()=>expect(fetchFormPreview).toHaveBeenCalledWith("d",versionId,"es",expect.any(AbortSignal)));
 await screen.findByTitle("Vista oficial del formulario en WhatsApp");
 fireEvent.click(screen.getByRole("button",{name:"Volver a pedir la vista"}));
 await waitFor(()=>expect(fetchFormPreview).toHaveBeenCalledTimes(2));
 expect(vi.mocked(fetchFormPreview).mock.calls.every(call=>call[2]==="es")).toBe(true);
 expect(screen.queryByRole("button",{name:"Inglés"})).not.toBeInTheDocument();
});
