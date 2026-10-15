import {PrivateImage} from "@/shared/ui/PrivateImage";
import {PhotoThumbnail} from "@/shared/ui/PhotoThumbnail";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { type PrivateFormFile } from "@/shared/api/formFiles";
import { usePrivateFormFile, savePrivateBlob } from "@/shared/hooks/usePrivateFormFile";
import { Button } from "@/shared/ui/button";
import { PhotoViewer } from "@/shared/ui/PhotoViewer";

function fileSize(bytes:number,language:string) {return new Intl.NumberFormat(language,{maximumFractionDigits:1}).format(bytes/(1024*1024))+" MB";}
function Thumbnail({actor,recordId,file,selected,onOpen,onForbidden}:{actor:string;recordId:string;file:PrivateFormFile;selected?:boolean;onOpen:()=>void;onForbidden:()=>void}) {
 const {t}=useTranslation();const query=usePrivateFormFile(actor,recordId,file.fileId,true,onForbidden);
 return <PhotoThumbnail label={t("files.openPhoto",{name:file.name})} selected={selected} onClick={onOpen}>
 {query.data?<PrivateImage blob={query.data} alt="" className="h-full w-full object-cover"/>:<span className="text-xs">{t(query.isPending?"files.loading":"files.unavailable")}</span>}</PhotoThumbnail>;
}
function Original({actor,recordId,files,index,label,number,onIndex,onClose,onForbidden}:{actor:string;recordId:string;files:readonly PrivateFormFile[];index:number;label:string;number:string;onIndex:(index:number)=>void;onClose:()=>void;onForbidden:()=>void}) {
 const {i18n}=useTranslation();const file=files[index];const query=usePrivateFormFile(actor,recordId,file.fileId,false,onForbidden);
 return <PhotoViewer title={label} description={number} name={file.name} size={fileSize(file.size,i18n.resolvedLanguage??"es")} index={index} count={files.length} loading={query.isPending} blob={query.data} onIndex={onIndex} onClose={onClose}
 onDownload={()=>{if(query.data)savePrivateBlob(query.data,file.name);}} thumbnails={files.map((item,i)=><Thumbnail key={item.fileId} actor={actor} recordId={recordId} file={item} selected={i===index} onOpen={()=>onIndex(i)} onForbidden={onForbidden}/>)}/>;
}
function DocumentDownload({actor,recordId,file,onForbidden}:{actor:string;recordId:string;file:PrivateFormFile;onForbidden:()=>void}) {
 const {t,i18n}=useTranslation();const [requested,setRequested]=useState(false);
 return <div className="flex items-center gap-2 rounded-[var(--radius-control)] border border-[var(--color-border)] p-2"><div className="min-w-0 flex-1"><p className="break-words">{file.name}</p><p className="text-xs text-[var(--color-content-muted)]">{fileSize(file.size,i18n.resolvedLanguage??"es")}</p></div>
 <Button type="button" variant="outline" size="sm" disabled={requested} onClick={()=>setRequested(true)}>{t("files.download")}</Button>
 {requested?<DownloadRequest actor={actor} recordId={recordId} file={file} onDone={()=>setRequested(false)} onForbidden={onForbidden}/>:null}</div>;
}
function DownloadRequest({actor,recordId,file,onDone,onForbidden}:{actor:string;recordId:string;file:PrivateFormFile;onDone:()=>void;onForbidden:()=>void}) {
 const query=usePrivateFormFile(actor,recordId,file.fileId,false,onForbidden);const consumed=useRef(false);
 useEffect(()=>{if(query.data&&!consumed.current){consumed.current=true;savePrivateBlob(query.data,file.name);onDone();}else if(query.isError)onDone();},[query.data,query.isError,file.name,onDone]);
 return null;
}
export function FormReplyFiles({actor,recordId,files,photo,label,number,onForbidden}:{actor:string;recordId:string;files:readonly PrivateFormFile[];photo:boolean;label:string;number:string;onForbidden:()=>void}) {
 const {t}=useTranslation();const [index,setIndex]=useState<number|null>(null);
 if(files.length===0)return <span>{t("files.none")}</span>;
 if(!photo)return <div className="flex flex-col gap-2">{files.map(file=><DocumentDownload key={file.fileId} actor={actor} recordId={recordId} file={file} onForbidden={onForbidden}/>)}</div>;
 return <><div className="flex flex-wrap gap-1">{files.slice(0,4).map((file,i)=><Thumbnail key={file.fileId} actor={actor} recordId={recordId} file={file} onOpen={()=>setIndex(i)} onForbidden={onForbidden}/>)}
 {files.length>4?<PhotoThumbnail label={t("files.morePhotos",{count:files.length-4})} onClick={()=>setIndex(4)}>+{files.length-4}</PhotoThumbnail>:null}</div>
 {index!==null?<Original actor={actor} recordId={recordId} files={files} index={index} label={label} number={number} onIndex={setIndex} onClose={()=>setIndex(null)} onForbidden={onForbidden}/>:null}</>;
}
