import {expect,it} from "vitest";
import {readPdfDesign} from "./pdf";
const id="0199a0c0-0000-7000-8000-000000000070";
it("reads a PDF design with its independent revision and optional translation",()=>{const body={id:null,definitionId:id,revision:0,originalCulture:"es",design:{name:{es:"Visita"},questionIds:[],includeApproval:true,footer:null,includePhotos:true},createdAtUtc:null,author:null};expect(readPdfDesign(body)).toEqual(body);expect(()=>readPdfDesign({...body,privateKey:"secret"})).toThrow("Invalid form PDF design contract.");});
