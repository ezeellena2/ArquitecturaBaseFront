import { describe, expect, it } from "vitest";
import { responseValueText, visibleResponseColumns, type ResponseColumn, type ResponseCell } from "./responses";
describe("response presentation", () => {
 it("distinguishes a missing question, an empty answer, zero and false", () => {
  const cell: ResponseCell = {fieldId:"a",type:"shortText",state:"NotAsked",value:null};
  expect(responseValueText(cell,"Sin respuesta","Sí","No")).toBe("—");
  expect(responseValueText({...cell,state:"Unanswered"},"Sin respuesta","Sí","No")).toBe("Sin respuesta");
  expect(responseValueText({...cell,state:"Answered",type:"decimal",value:"0"},"Sin respuesta","Sí","No")).toBe("0");
  expect(responseValueText({...cell,state:"Answered",type:"boolean",value:false},"Sin respuesta","Sí","No")).toBe("No");
 });
 it("preserves current column order and allows hiding all question columns", () => {
  const columns = ["a","b","c"].map(fieldId=>({fieldId,label:fieldId,type:"shortText",introducedInVersion:1,options:[]} satisfies ResponseColumn));
  expect(visibleResponseColumns(columns,null)).toEqual(columns);
  expect(visibleResponseColumns(columns,"c,a,unknown").map(column=>column.fieldId)).toEqual(["a","c"]);
  expect(visibleResponseColumns(columns,"")).toEqual([]);
 });
});
