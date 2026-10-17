import {expect,test} from "@playwright/test";
for(const language of ["es","en"] as const)for(const width of [1440,390,320]){
 test("missing request board and discard decision in "+language+" at "+width+"px",async({page})=>{
  await page.setViewportSize({width,height:900});await page.clock.install({time:new Date("2026-10-17T14:00:00Z")});
  await page.goto("/src/test/visual/index.html?screen=/formularios/faltantes&scenario=forms-missing&lang="+language);
  const name=language==="es"?"Reclamos de clientes":"Customer complaints";
  await expect(page.getByRole("heading",{name:language==="es"?"Formularios que faltan":"Missing forms",exact:true})).toBeVisible();
  await expect(page.getByText(name,{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);
  await page.screenshot({path:"test-results/visual/forms-missing-"+language+"-"+width+".png",fullPage:true});
  await page.getByRole("button",{name:(language==="es"?"Descartar ":"Discard ")+name,exact:true}).click();
  const dialog=page.getByRole("dialog",{name:language==="es"?"Descartar pedido":"Discard request",exact:true});await expect(dialog).toBeVisible();
  await page.screenshot({path:"test-results/visual/forms-missing-discard-"+language+"-"+width+".png",fullPage:true});
  await dialog.getByRole("button",{name:language==="es"?"Cancelar":"Cancel",exact:true}).click();
  await page.getByRole("button",{name:language==="es"?"Descartados (2)":"Discarded (2)",exact:true}).click();
  await expect(page.getByText(language==="es"?"Devoluciones":"Returns",{exact:true})).toBeVisible();
  await page.screenshot({path:"test-results/visual/forms-missing-history-"+language+"-"+width+".png",fullPage:true});
 });
}
