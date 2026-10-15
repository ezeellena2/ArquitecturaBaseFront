import {PrivateImage} from "./PrivateImage";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { Button } from "./button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./dialog";
import { IconButton } from "./IconButton";
import { ChevronLeftIcon, ChevronRightIcon } from "./icons";

// Presentation only: the authorized consumer owns content, loading and downloads.
export function PhotoViewer({title,description,name,size,index,count,blob,loading,thumbnails,onIndex,onClose,onDownload,downloading}: {
 title:string;description:string;name:string;size:string;index:number;count:number;blob?:Blob;loading:boolean;thumbnails:ReactNode;
 onIndex:(index:number)=>void;onClose:()=>void;onDownload:()=>void;downloading?:boolean;
}) {
 const {t}=useTranslation();const restoreFocus=useRestoreFocusOnClose();
 return <Dialog open onOpenChange={open=>{if(!open)onClose();}}><DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-5xl" onCloseAutoFocus={restoreFocus}
  onKeyDown={event=>{if(event.key==="Escape"){event.preventDefault();onClose();}if(event.key==="ArrowLeft"&&index>0){event.preventDefault();onIndex(index-1);}if(event.key==="ArrowRight"&&index<count-1){event.preventDefault();onIndex(index+1);}}}>
  <DialogHeader className="border-b bg-[var(--color-surface-header)] px-5 py-4 pr-12"><DialogTitle>{title}</DialogTitle><DialogDescription>{t("files.photoPosition",{index:index+1,count})} · {description}</DialogDescription></DialogHeader>
  <div className="relative flex min-h-48 items-center justify-center bg-[var(--color-sidebar)] px-12 py-4 sm:min-h-80">
   {blob?<PrivateImage blob={blob} alt={name} className="max-h-[55svh] max-w-full object-contain"/>:<p role="status" className="text-sm text-[var(--color-sidebar-foreground)]">{t(loading?"files.loading":"files.unavailable")}</p>}
   <div className="absolute inset-y-0 left-1 flex items-center"><IconButton variant="outline" label={t("files.previous")} disabled={index===0} onClick={()=>onIndex(index-1)}><ChevronLeftIcon className="size-5"/></IconButton></div>
   <div className="absolute inset-y-0 right-1 flex items-center"><IconButton variant="outline" label={t("files.next")} disabled={index===count-1} onClick={()=>onIndex(index+1)}><ChevronRightIcon className="size-5"/></IconButton></div>
  </div>
  <div className="flex justify-start gap-2 overflow-x-auto sm:justify-center border-b p-3">{thumbnails}</div>
  <DialogFooter className="flex-col items-center gap-3 p-4 sm:flex-row"><div className="min-w-0 flex-1 text-sm"><p className="break-words">{name}</p><p className="text-xs text-[var(--color-content-muted)]">{size}</p></div><Button type="button" variant="outline" disabled={downloading||!blob} onClick={onDownload}>{t("files.download")}</Button></DialogFooter>
 </DialogContent></Dialog>;
}
