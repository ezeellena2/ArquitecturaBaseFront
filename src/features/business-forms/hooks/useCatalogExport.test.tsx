import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ApiError } from "@/shared/api/ApiError";
import { savePrivateBlob } from "@/shared/hooks/usePrivateFormFile";
import * as imports from "../api/catalogImports";
import { useCatalogExport } from "./useCatalogExport";
vi.mock("@/shared/hooks/usePrivateFormFile",async()=>({...await vi.importActual<typeof import("@/shared/hooks/usePrivateFormFile")>("@/shared/hooks/usePrivateFormFile"),savePrivateBlob:vi.fn()}));
const scope={actorId:"actor",culture:"es" as const,permissions:["formcatalogs.read"]};
afterEach(()=>vi.restoreAllMocks());
it("downloads the server file under Read alone without keeping its bytes in cache",async()=>{
 const blob=new Blob(["xlsx"]);const fetch=vi.spyOn(imports,"exportCatalog").mockResolvedValue({blob,fileName:"Lista.xlsx",contentLanguage:"es"});
 const {result}=renderHook(()=>useCatalogExport(scope,"id"));await act(()=>result.current.download(false));
 expect(fetch).toHaveBeenCalledExactlyOnceWith("id",false,expect.any(AbortSignal));expect(savePrivateBlob).toHaveBeenCalledWith(blob,"Lista.xlsx");expect(result.current.busy).toBe(false);
});
it("cancels and ignores bytes from the prior owner when Read is removed",async()=>{
 let done!:(value:Awaited<ReturnType<typeof imports.exportCatalog>>)=>void;const fetch=vi.spyOn(imports,"exportCatalog").mockImplementation(()=>new Promise(resolve=>{done=resolve;}));
 const {result,rerender}=renderHook(({permissions})=>useCatalogExport({...scope,permissions},"id"),{initialProps:{permissions:scope.permissions}});
 let pending!:Promise<void>;act(()=>{pending=result.current.download(true);});const signal=fetch.mock.calls[0]![2]!;rerender({permissions:[]});expect(signal.aborted).toBe(true);
 await act(async()=>{done({blob:new Blob(["private"]),fileName:"Privado.xlsx",contentLanguage:"es"});await pending;});expect(savePrivateBlob).not.toHaveBeenCalled();
});
it("exposes a denied Read so the owner can remove the private editor",async()=>{
 const denied=new ApiError(403,{});vi.spyOn(imports,"exportCatalog").mockRejectedValue(denied);
 const {result}=renderHook(()=>useCatalogExport(scope,"id"));await act(()=>result.current.download(false));expect(result.current).toHaveProperty("error",denied);
});
