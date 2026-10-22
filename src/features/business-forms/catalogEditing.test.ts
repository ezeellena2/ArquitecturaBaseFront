import { expect, it } from "vitest";
import { catalogItemProblems, duplicateCatalogTexts, generateMissingCatalogCodes } from "./catalogEditing";
import type { CatalogManualItemValue } from "./catalogItemEdits";
const row: CatalogManualItemValue = { localId: "a", itemId: "saved", position: 2, label: { es: "De urgencia", en: null }, code: "URG", value: null, detail: {}, isActive: true };
it("blocks duplicate codes case-insensitively even for an inactive row, but only warns about repeated text", () => {
  const rows = [row, { ...row, localId: "b", itemId: "other", position: 4, code: " urg ", isActive: false }];
  expect(catalogItemProblems(rows)).toEqual([{ localId: "a", field: "code", kind: "duplicateCode", otherPosition: 4 }, { localId: "b", field: "code", kind: "duplicateCode", otherPosition: 2 }]);
  expect(duplicateCatalogTexts(rows, "es")).toEqual({a:4,b:2});
  expect(catalogItemProblems([{ ...row, label: { es: "Correctivo" } }, { ...row, localId: "b", code: "CORR", label: { es: "Correctivo" } }])).toEqual([]);
});
it("preserves overlong pasted text and reports the exact language instead of truncating it", () => {
  expect(catalogItemProblems([{ ...row, label: { es: "x".repeat(31), en: "y".repeat(32) } }])).toEqual([{ localId: "a", field: "text.es", kind: "textTooLong" }, { localId: "a", field: "text.en", kind: "textTooLong" }]);
});
it("generates only missing codes from Spanish text, keeps identity and values, and disambiguates known codes without changing them", () => {
  const rows = [row, { ...row, localId: "b", code: "DE-URGENCIA" }, { ...row, localId: "c", itemId: null, code: "", value: "1500.5" }, { ...row, localId: "d", itemId: null, code: "", label: { es: "Árbol / Norte" } }];
  const generated = generateMissingCatalogCodes(rows);
  expect(generated.map(item => item.code)).toEqual(["URG", "DE-URGENCIA", "DE-URGENCIA-2", "ARBOL-NORTE"]);
  expect(generated[2]).toMatchObject({ localId: "c", itemId: null, value: "1500.5" });
  expect(rows[2].code).toBe("");
});

it("groups repeated labels once rather than rereading every row for each warning",()=>{
 let reads=0;const rows=Array.from({length:100},(_,index)=>({...row,localId:"r"+index,get label(){reads++;return {es:"Texto "+index};}}));
 expect(duplicateCatalogTexts(rows,"es")).toEqual({});expect(reads).toBeLessThanOrEqual(rows.length*2);
});
it("keeps every warning and its other row for a ten-thousand-option catalog",()=>{
 const rows=Array.from({length:10_000},(_,index)=>({...row,localId:"r"+index,position:index+1,label:{es:"Grupo "+index%10}}));
 const result=duplicateCatalogTexts(rows,"es");expect(Object.keys(result)).toHaveLength(10_000);expect(result.r0).toBe(11);expect(result.r10).toBe(1);expect(result.r9999).toBe(10);
 expect(duplicateCatalogTexts([{...row,localId:"new-a",position:null},{...row,localId:"new-b",position:null},{...row,localId:"empty",label:{es:" "}}],"es")).toEqual({"new-a":null,"new-b":null});
});
