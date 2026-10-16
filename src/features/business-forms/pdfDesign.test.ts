import {expect,it} from "vitest";
import {preparePdfDesign,type PdfDesign} from "./pdfDesign";
const draft=():PdfDesign=>({name:{es:"  Visita  ",en:""},questionIds:[],includeApproval:true,footer:null,includePhotos:true});
it("requires only the original title and preserves optional translations without filling them",()=>{expect(preparePdfDesign(draft(),"es")).toEqual({design:{...draft(),name:{es:"Visita"}},errors:{}});expect(preparePdfDesign({...draft(),name:{en:"Visit"}},"es").errors["name.es"]).toBeDefined();});
it("requires an original footer only when a footer is supplied and limits both texts",()=>{expect(preparePdfDesign({...draft(),footer:{en:"Text"}},"es").errors["footer.es"]).toBeDefined();expect(preparePdfDesign({...draft(),name:{es:"x".repeat(161)}},"es").design).toBeNull();expect(preparePdfDesign({...draft(),footer:{es:"x".repeat(1001)}},"es").design).toBeNull();expect(preparePdfDesign({...draft(),footer:{es:"  Pie  ",en:""}},"es").design?.footer).toEqual({es:"Pie"});});
