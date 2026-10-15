import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/shared/api/ApiError";
import { readFormFile } from "@/shared/api/formFiles";

// Only mounted under an authorized record. Unmount cancels reads and discards private bytes.
export function usePrivateFormFile(actor:string,recordId:string,fileId:string,thumbnail:boolean,onForbidden:()=>void) {
  const {i18n}=useTranslation();
  const query=useQuery({queryKey:["form-files",actor,i18n.resolvedLanguage,recordId,fileId,thumbnail],
    queryFn:({signal})=>readFormFile(recordId,fileId,thumbnail,signal),gcTime:0,staleTime:Infinity,refetchOnMount:false,refetchOnWindowFocus:false,refetchOnReconnect:false});
  const denied=query.error instanceof ApiError && (query.error.status===403||query.error.status===401);
  useEffect(()=>{if(denied)onForbidden();},[denied,onForbidden]);
  return {...query,data:denied?undefined:query.data};
}
export function savePrivateBlob(blob:Blob,name:string) {
  const url=URL.createObjectURL(blob);const link=document.createElement("a");
  link.href=url;link.download=name;document.body.append(link);link.click();link.remove();
  // Keep the URL alive through the browser's download dispatch, then release it.
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
