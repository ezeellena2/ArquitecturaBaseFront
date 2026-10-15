import { api } from "./httpClient";
export interface PrivateFormFile { readonly fileId:string; readonly name:string; readonly contentType:string; readonly size:number; readonly hasThumbnail:boolean }
export function readFormFile(recordId:string,fileId:string,thumbnail:boolean,signal:AbortSignal) {
  return api.blob(`/api/forms/records/${encodeURIComponent(recordId)}/files/${encodeURIComponent(fileId)}/${thumbnail?"thumbnail":"content"}`,{signal});
}
