import type {FormPdfDesign} from "@/features/business-forms/api/pdf";
import {responseFormId} from "./responseFixtures";
export const pdfQuestionId="0199a0c0-0000-7000-8000-000000000030";
export const pdfDesignFixture=():FormPdfDesign=>({id:null,definitionId:responseFormId,revision:0,originalCulture:"es",design:{name:{es:"Comprobante de visita",en:""},questionIds:[pdfQuestionId],includeApproval:true,footer:null,includePhotos:true},createdAtUtc:null,author:null});
export const pdfOptionsFixture=()=>({definitionId:responseFormId,name:{es:"Visita",en:"Visit"},originalCulture:"es",questions:[{fieldId:pdfQuestionId,key:"field_"+pdfQuestionId.replaceAll("-",""),type:"shortText",label:{es:"Dirección",en:"Address"},help:null,required:false,maxLength:100,options:null}],roles:[],conditionChoices:{}});
