import { expect, it } from "vitest";
import { readFormReply } from "./formReplies";
const id="01999abc-1234-7000-8000-000000000001";
const base={state:"Completed",definitionId:id,versionId:id,versionNumber:1,name:"Visita",recordId:id,number:"VIS-000001",values:[{fieldId:id,key:"photo",label:"Fotos",type:"photo",value:[{fileId:id,name:"private.png",contentType:"image/png",size:123,hasThumbnail:true}]}]};
it("decodes only authorized file metadata and refuses public URLs or invalid types",()=>{
  expect(readFormReply(base,true)).toEqual(base);
  expect(readFormReply({...base,values:[{...base.values[0],value:[{...base.values[0].value[0],url:"https://external.test"}]}]},true)).toBeNull();
  expect(readFormReply(base,false)?.values).toBeNull();
});
it.each(["Downloading","RetryingFiles"])("decodes %s without any values",state=>{
  expect(readFormReply({...base,state,recordId:null,number:null,values:null},true)?.state).toBe(state);
});
