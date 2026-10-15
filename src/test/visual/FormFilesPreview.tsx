import {useState} from "react";
import {useTranslation} from "react-i18next";
import {Page} from "@/shared/ui/Page";
import {Button} from "@/shared/ui/button";
import {FormReplyCard,type FormReplyPresentation} from "@/features/whatsapp/components/FormReplyCard";
const id=(n:number)=>"01990000-0000-7000-8000-"+String(n).padStart(12,"0");
export function FormFilesPreview(){
 const {i18n}=useTranslation();const en=i18n.language==="en";const [allowed,setAllowed]=useState(true);
 const completed:FormReplyPresentation={state:"Completed",name:en?"Register visit":"Registrar visita",recordNumber:"VIS-000032",recordId:id(40),values:allowed?[
 {id:id(41),label:en?"Site photos":"Fotos de la obra",answer:{type:"photo",value:Array.from({length:8},(_,i)=>({fileId:id(50+i),name:`obra-${i+1}.jpg`,contentType:"image/jpeg",size:3500000,hasThumbnail:true}))}},
 {id:id(42),label:en?"Signed delivery note":"Remito firmado",answer:{type:"document",value:[{fileId:id(60),name:"remito-0810.pdf",contentType:"application/pdf",size:1200000,hasThumbnail:false}]}},
 ]:null,valuesRevoked:!allowed};
 return <Page title={en?"F3–F5 · files":"F3–F5 · archivos"} actions={<Button variant="outline" onClick={()=>setAllowed(false)}>{en?"Revoke answer access":"Revocar lectura de respuestas"}</Button>}>
 <div className="grid gap-4 lg:grid-cols-2">
 <FormReplyCard actor="visual" reply={completed}/>
 <FormReplyCard reply={{...completed,values:null,recordNumber:"VIS-000033"}}/>
 <FormReplyCard reply={{state:"Downloading",name:completed.name}}/>
 <FormReplyCard reply={{state:"RetryingFiles",name:completed.name}}/>
 <FormReplyCard reply={{state:"Rejected",name:completed.name,rejectionCode:"Files.Content.Unavailable"}} onResend={()=>undefined}/>
 <FormReplyCard reply={{state:"Rejected",name:completed.name,rejectionCode:"Files.Content.InvalidType"}} onResend={()=>undefined}/>
 </div></Page>;
}
