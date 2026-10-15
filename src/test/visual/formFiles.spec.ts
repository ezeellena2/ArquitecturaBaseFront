import {expect,test} from "@playwright/test";
import {fixtureFormId} from "./formFixtures";
for(const lang of ["es","en"] as const)for(const width of [1440,390,320]){
 test(`F3 F4 F5 private files ${lang} at ${width}px`,async({page})=>{
  const en=lang==="en";await page.setViewportSize({width,height:900});
  await page.goto(`/src/test/visual/index.html?screen=/form-files&scenario=file-cards&lang=${lang}`);
  await expect(page.getByRole("heading",{name:en?"F3–F5 · files":"F3–F5 · archivos"})).toBeVisible();await page.evaluate(()=>document.fonts.ready);
  const opener=page.getByRole("button",{name:en?"View obra-1.jpg":"Ver obra-1.jpg"});
  await expect(opener.locator("img")).toHaveAttribute("src",/^blob:/);
  await expect(page.getByRole("button",{name:en?"View 4 more photos":"Ver 4 fotos más"})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await page.screenshot({path:`test-results/form-files-cards-${lang}-${width}.png`,fullPage:true});
  await opener.click();const viewer=page.getByRole("dialog",{name:en?"Site photos":"Fotos de la obra"});await expect(viewer).toBeVisible();
  await expect(viewer.locator("img").first()).toHaveAttribute("src",/^blob:/);
  await page.keyboard.press("ArrowRight");await expect(viewer.getByText(en?"Photo 2 of 8 · VIS-000032":"Foto 2 de 8 · VIS-000032")).toBeVisible();
  await expect(viewer.getByRole("button",{name:en?"Download":"Descargar",exact:true})).toBeEnabled();
  const bounds=(await viewer.boundingBox())!;expect(bounds.x).toBeGreaterThanOrEqual(0);expect(bounds.x+bounds.width).toBeLessThanOrEqual(width);
  await page.screenshot({path:`test-results/form-files-viewer-${lang}-${width}.png`,fullPage:true});
  await page.keyboard.press("Escape");await expect(viewer).toHaveCount(0);await expect(opener).toBeFocused();
  await opener.click();await expect(viewer).toBeVisible();
  // Server permission changes are represented by the same authorized values becoming null.
  await page.getByRole("button",{name:en?"Close":"Cerrar",exact:true}).click();
  await page.getByRole("button",{name:en?"Revoke answer access":"Revocar lectura de respuestas"}).click();
  await expect(page.getByRole("button",{name:/obra-/})).toHaveCount(0);await expect(page.getByText("remito-0810.pdf")).toHaveCount(0);
 });
 test(`F1 native file questions ${lang} at ${width}px`,async({page})=>{
  const en=lang==="en";await page.setViewportSize({width,height:900});
  await page.goto(`/src/test/visual/index.html?screen=/formularios/${fixtureFormId}&scenario=forms-files&lang=${lang}`);
  await expect(page.getByRole("heading",{name:en?"Register visit":"Registrar visita"}).first()).toBeVisible();await page.evaluate(()=>document.fonts.ready);
  await expect(page.getByText(en?"Files: up to 7 of 10":"Archivos: hasta 7 de 10")).toBeVisible();
  await expect(page.getByText(en?"Each photo or document question starts its own screen. Following questions can share it.":"Cada pregunta de foto o documento abre su propia pantalla. Las preguntas siguientes pueden compartirla.")).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await page.screenshot({path:`test-results/form-files-editor-${lang}-${width}.png`,fullPage:true});
 });
}
