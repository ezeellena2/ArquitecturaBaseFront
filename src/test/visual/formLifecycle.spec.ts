import { expect, test, type Locator, type Page } from "@playwright/test";
import { fixtureFormId } from "./formFixtures";

// Approved BA scenes use synthetic configuration only; confirmations never submit a mutation.
async function openMenu(page: Page, es: boolean) {
 const trigger=page.getByRole("button",{name:es?"Acciones del formulario":"Form actions"});
 await trigger.focus();await trigger.press("Enter");
 return {trigger,menu:page.getByRole("menu")};
}
async function assertContained(page:Page,width:number) {
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
}
async function assertMobileDialog(dialog:Locator,width:number,height:number) {
 const bounds=(await dialog.boundingBox())!;
 expect(bounds.x).toBe(0);expect(bounds.y).toBe(0);expect(bounds.width).toBe(width);expect(bounds.height).toBe(height);
 const footer=dialog.locator('[data-slot="dialog-footer"]');
 const before=(await footer.boundingBox())!;
 const body=dialog.locator(".overflow-y-auto").first();
 await body.evaluate(node=>{node.scrollTop=node.scrollHeight;});
 const after=(await footer.boundingBox())!;
 expect(after.y).toBe(before.y);expect(after.y+after.height).toBeLessThanOrEqual(height);
 expect(await dialog.evaluate(node=>node.scrollWidth)).toBeLessThanOrEqual(width);
}
for(const language of ["es","en"] as const) for(const width of [390,320]) {
 const es=language==="es";
 test("BA1 lifecycle table and contained scrolling "+language+" "+width,async({page})=>{
  await page.setViewportSize({width,height:900});
  await page.goto("/src/test/visual/index.html?screen=/formularios&scenario=forms-lifecycle-table&lang="+language);
  const table=page.getByRole("table");await expect(table).toBeVisible();
  await expect(page.getByRole("button",{name:es?"Activos (2)":"Active (2)",exact:true})).toHaveAttribute("aria-pressed","true");
  const area=page.locator('[data-slot="table-container"]');
  expect(await area.evaluate(node=>node.scrollWidth)).toBeGreaterThan(await area.evaluate(node=>node.clientWidth));
  const segment=page.getByRole("group",{name:es?"Estado en WhatsApp":"WhatsApp status"});
  await expect(segment.getByRole("button")).toHaveCount(4);
  await assertContained(page,width);
  await page.screenshot({path:"test-results/form-lifecycle-ba1-active-"+language+"-"+width+".png",fullPage:true});
  await area.evaluate(node=>{node.scrollLeft=node.scrollWidth;});
  await expect(page.getByRole("button",{name:es?"Eliminar Registrar entrega":"Delete Register delivery",exact:true})).toBeVisible();
  const inactive=segment.getByRole("button",{name:es?"Dados de baja (1)":"Deactivated (1)",exact:true});
  await inactive.scrollIntoViewIfNeeded();await inactive.click();
  await expect(table.getByRole("link",{name:es?"Control anterior":"Previous inspection",exact:true})).toBeVisible();
  await expect(table.getByText(es?/se deprecan cuando venzan los envíos abiertos/:/they will be deprecated when open sends expire/)).toBeVisible();
  await assertContained(page,width);
  await page.screenshot({path:"test-results/form-lifecycle-ba1-deactivated-"+language+"-"+width+".png",fullPage:true});
 });
 for(const state of ["editor","deactivate","reactivate","delete"] as const) {
  test("BA lifecycle "+state+" "+language+" "+width,async({page})=>{
   await page.setViewportSize({width,height:900});
   const scenario=state==="editor"||state==="reactivate"?"forms-lifecycle-deactivated":state==="delete"?"forms-lifecycle-deletable":"forms-lifecycle-open";
   await page.goto("/src/test/visual/index.html?screen=/formularios/"+fixtureFormId+"&scenario="+scenario+"&lang="+language);
   await expect(page.getByRole("heading",{level:1,name:es?"Registrar visita":"Register visit",exact:true})).toBeVisible();
   if(state==="editor") {
    await expect(page.getByText(es?/Dado de baja por/:/Deactivated by/)).toBeVisible();
    await expect(page.getByText(es?/se deprecan cuando venzan los envíos abiertos/:/they will be deprecated when open sends expire/)).toBeVisible();
    const {menu}=await openMenu(page,es);
    await expect(menu.getByRole("menuitem",{name:es?/Eliminar/:/Delete/})).toHaveCount(0);
    await expect(menu.getByText(es?"Tiene respuestas: dalo de baja para conservarlas.":"It has responses: deactivate it to keep them.",{exact:true})).toBeVisible();
   } else {
    if(state==="reactivate") await page.getByRole("button",{name:es?"Reactivar":"Reactivate",exact:true}).click();
    else {const {menu}=await openMenu(page,es);await menu.getByRole("menuitem",{name:state==="delete"?(es?/Eliminar/:/Delete/):(es?/Dar de baja/:/Deactivate/)}).click();}
    const dialog=page.getByRole("dialog");await expect(dialog).toBeVisible();
    const confirm=dialog.getByRole("button",{name:state==="reactivate"?(es?"Reactivar con la versión 2":"Reactivate with version 2"):state==="delete"?(es?"Eliminar":"Delete"):(es?"Dar de baja":"Deactivate"),exact:true});
    await expect(confirm).toBeEnabled();
    await assertMobileDialog(dialog,width,900);
    await page.screenshot({path:"test-results/form-lifecycle-"+state+"-end-"+language+"-"+width+".png",fullPage:true});
    await dialog.locator(".overflow-y-auto").first().evaluate(node=>{node.scrollTop=0;});
    await dialog.getByRole("button",{name:es?"Cancelar":"Cancel",exact:true}).focus();
   }
   await page.evaluate(()=>document.fonts.ready);await assertContained(page,width);
   await page.screenshot({path:"test-results/form-lifecycle-"+state+"-"+language+"-"+width+".png",fullPage:true});
   if(state!=="editor") {await page.getByRole("dialog").press("Escape");await expect(page.getByRole("dialog")).toHaveCount(0);await expect(page.getByRole("button",{name:state==="reactivate"?(es?"Reactivar":"Reactivate"):(es?"Acciones del formulario":"Form actions"),exact:true})).toBeFocused();}
   expect(await page.evaluate(()=>(window as typeof window & {formsFixture:{calls:{method:string;path:string}[]}}).formsFixture.calls.filter(call=>["POST","PUT","DELETE"].includes(call.method)&&!call.path.endsWith("/publication-checks")))).toEqual([]);
  });
 }
 test("BA6 unavailable suggestion can only be removed "+language+" "+width,async({page})=>{
  await page.setViewportSize({width,height:900});
  await page.goto("/src/test/visual/index.html?screen=/formularios/"+fixtureFormId+"&scenario=forms-lifecycle-suggestions&lang="+language);
  const row=page.getByRole("region",{name:es?"Sugerencia 2":"Suggestion 2",exact:true});await row.scrollIntoViewIfNeeded();
  await expect(row.getByRole("button")).toHaveCount(1);
  await expect(row.getByText(es?"Dado de baja":"Deactivated",{exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:es?"Guardar sugerencias":"Save suggestions",exact:true})).toBeDisabled();
  await assertContained(page,width);await page.screenshot({path:"test-results/form-lifecycle-ba6-"+language+"-"+width+".png",fullPage:true});
  await row.getByRole("button",{name:es?"Quitar sugerencia 2":"Remove suggestion 2",exact:true}).click();
  await expect(page.getByRole("button",{name:es?"Editar sugerencia 1":"Edit suggestion 1",exact:true})).toBeFocused();
  await expect(page.getByRole("button",{name:es?"Guardar sugerencias":"Save suggestions",exact:true})).toBeEnabled();
  expect(await page.evaluate(()=>(window as typeof window & {formsFixture:{calls:{method:string}[]}}).formsFixture.calls.some(call=>["POST","PUT","DELETE"].includes(call.method)))).toBe(false);
 });
}

// Pending is covered by BA1/BA2 above; these add the two other authoritative states.
for(const language of ["es","en"] as const) for(const width of [390,320]) for(const state of ["uncertain","deprecated"] as const) for(const surface of ["list","editor"] as const) {
 test("BA WhatsApp "+state+" "+surface+" "+language+" "+width,async({page})=>{
  const es=language==="es";
  await page.setViewportSize({width,height:900});
  const screen=surface==="list"?"/formularios?publicationFilter=Deactivated":"/formularios/"+fixtureFormId;
  await page.goto("/src/test/visual/index.html?screen="+encodeURIComponent(screen)+"&scenario=forms-lifecycle-deactivated-"+state+"&lang="+language);
  const message=page.getByText(state==="uncertain"?(es?/Sin confirmar en WhatsApp/:/Unconfirmed on WhatsApp/):(es?/Deprecados el 21 oct 2026, 15:00/:/Deprecated on Oct 21, 2026, 3:00 PM/));
  await expect(message).toBeVisible();await message.scrollIntoViewIfNeeded();
  if(surface==="editor") await expect(page.getByRole("button",{name:es?"Reactivar":"Reactivate",exact:true})).toBeEnabled();
  else await expect(page.getByRole("table").getByText(es?"Dado de baja · versión 1":"Deactivated · version 1",{exact:true})).toBeVisible();
  await page.evaluate(()=>document.fonts.ready);
  await assertContained(page,width);
  await page.screenshot({path:"test-results/form-lifecycle-status-"+state+"-"+surface+"-"+language+"-"+width+".png",fullPage:true});
 });
}
