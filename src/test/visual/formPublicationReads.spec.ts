import {test,expect} from "@playwright/test";
import {fixtureFormId,responseBudgetDefinition} from "./formFixtures";
for(const lang of ["es","en"] as const)for(const width of [1440,390,320]){
 test(`A2 blocked publication locates the question with keyboard focus ${lang} at ${width}px`,async({page})=>{
 const es=lang==="es";const definition=responseBudgetDefinition(lang);await page.setViewportSize({width,height:900});await page.goto(`/src/test/visual/index.html?screen=/formularios/${definition.id}&scenario=forms-publication-budget-http&lang=${lang}`);
 const trigger=page.getByRole("button",{name:es?"Publicar en WhatsApp":"Publish on WhatsApp",exact:true});await trigger.click();
 const dialog=page.getByRole("dialog");await expect(dialog.getByRole("button",{name:es?"Publicar versión 1":"Publish version 1",exact:true})).toBeDisabled();
 await dialog.getByRole("button",{name:es?"Cancelar":"Cancel",exact:true}).click();await expect(trigger).toBeFocused();await trigger.click();
 await expect(dialog.getByRole("button",{name:es?"Publicar versión 1":"Publish version 1",exact:true})).toBeDisabled();await dialog.press("Escape");await expect(trigger).toBeFocused();await trigger.click();
 const jump=dialog.getByRole("button",{name:es?"Ir a la pregunta":"Go to the question",exact:true}).first();await jump.click();await expect(dialog).toHaveCount(0);
 // No language selector: the question opens in the menu language, with the other language's problem under it.
 const question=page.getByRole("textbox",{name:es?"Pregunta":"Question",exact:true});await expect(question).toHaveValue(es?"Respuesta 0":"Response 0");await expect(question).toBeFocused();
 await page.evaluate(()=>document.fonts.ready);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);await page.screenshot({path:`test-results/forms-budget-located-${lang}-${width}.png`,fullPage:true});
 });

 // EP1-A (2026-11-06): the label says it is unconfirmed; why Publish is off is its reason, and consulting goes in the header.
 test(`uncertain publication says why Publish is off and offers consulting ${lang} at ${width}px`,async({page})=>{
 const es=lang==="es";await page.setViewportSize({width,height:900});await page.goto(`/src/test/visual/index.html?screen=/formularios/${fixtureFormId}&scenario=forms-publication-uncertain-reload&lang=${lang}`);
 await page.getByRole("heading",{name:es?"Registrar visita":"Register visit",level:1,exact:true}).waitFor({state:"visible"});
 const hint=es?"Esta publicación necesita revisión. No inicies otra para intentar resolverla.":"This publication needs review. Do not start another one to try to resolve it.";
 await expect(page.getByText(es?"Publicación sin confirmar":"Publication unconfirmed",{exact:true})).toBeVisible();
 const publish=page.getByRole("button",{name:es?"Publicar en WhatsApp":"Publish on WhatsApp",exact:true});await expect(publish).toBeDisabled();await expect(publish).toHaveAccessibleDescription(hint);
 await expect(page.getByText(hint,{exact:true})).not.toBeVisible();await expect(page.getByText(es?"Aceptada":"Accepted",{exact:true})).toHaveCount(0);
 const consult=page.getByRole("button",{name:es?"Consultar publicación":"Check publication",exact:true});await expect(consult).toBeEnabled();await consult.click();await expect(publish).toHaveAccessibleDescription(hint);
 await expect(page.getByRole("button",{name:es?"Repetir el mismo intento":"Repeat the same attempt",exact:true})).toHaveCount(0);
 await page.evaluate(()=>document.fonts.ready);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);await page.screenshot({path:`test-results/forms-publication-review-${lang}-${width}.png`,fullPage:true});
 });
 test(`failed publication recovers translated diagnostics ${lang} at ${width}px`,async({page})=>{
 const es=lang==="es";await page.setViewportSize({width,height:900});await page.goto(`/src/test/visual/index.html?screen=/formularios/${fixtureFormId}&scenario=forms-publication-failed-reload&lang=${lang}`);
 // EP1-A (2026-11-06): the label says it did not go through; its problems go in «Problemas», with the rows of the check.
 await expect(page.getByText(es?"No se pudo publicar · versión 1":"Could not publish · version 1",{exact:true})).toBeVisible();
 const panel=page.getByRole("region",{name:es?"Problemas":"Problems",exact:true});
 await expect(panel.getByText(es?"WhatsApp rechazó la validación del formulario.":"WhatsApp rejected the form validation.",{exact:true})).toHaveCount(1);
 // NI1-A (2026-11-03): the diagnostic is in English, so it names its language only with the menu in Spanish.
 await expect(panel.getByText(es?"El canal de publicación · Inglés":"The publication channel",{exact:true})).toBeVisible();
 await expect(page.getByText(es?"Pendiente de confirmación de WhatsApp":"Awaiting WhatsApp confirmation",{exact:true})).toHaveCount(0);
 await expect(page.getByRole("button",{name:es?"Consultar publicación":"Check publication",exact:true})).toHaveCount(0);
 await expect(page.getByRole("button",{name:es?"Publicar en WhatsApp":"Publish on WhatsApp",exact:true})).toBeEnabled();
 await expect(page.getByRole("button",{name:es?"Repetir el mismo intento":"Repeat the same attempt",exact:true})).toHaveCount(0);
 await page.evaluate(()=>document.fonts.ready);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
 await page.screenshot({path:`test-results/forms-publication-failed-${lang}-${width}.png`,fullPage:true});
 await page.getByRole("link",{name:es?"Diseñar formularios":"Design forms",exact:true}).last().click();
 await expect(page.getByRole("table").getByText(es?"No se pudo publicar":"Could not publish",{exact:true})).toBeVisible();
 });
 test(`official preview in the menu language and expiry ${lang} at ${width}px`,async({page})=>{
 // It loads the menu language without a language selector; renewing asks for the same language.
 const es=lang==="es";const cultures:string[]=[];const title={es:"Registrar visita",en:"Register visit"};
 await page.route("https://www.facebook.com/whatsapp/flows/preview/fixture**",async route=>{const culture=new URL(route.request().url()).searchParams.get("culture")!;cultures.push(culture);await route.fulfill({contentType:"text/html",body:`<!doctype html><html lang="${culture}"><body><p>Simulated official preview</p><h1>${culture==="es"?"Registrar visita":"Register visit"}</h1><label>${culture==="es"?"Contacto":"Contact"}<input></label><button>${culture==="es"?"Confirmar visita":"Confirm visit"}</button></body></html>`});});
 await page.setViewportSize({width,height:900});await page.goto(`/src/test/visual/index.html?screen=/formularios/${fixtureFormId}&scenario=forms-publication-preview&lang=${lang}`);
 const trigger=page.getByRole("button",{name:es?"Ver vista oficial":"View official preview",exact:true});await trigger.click();
 const dialog=page.getByRole("dialog");await expect(dialog.locator("iframe")).toBeVisible();await expect.poll(()=>cultures.length).toBe(1);
 await expect(page.frameLocator("iframe").getByRole("heading",{name:title[lang],exact:true})).toBeVisible();expect(cultures).toEqual([lang]);
 await expect(dialog.getByRole("button",{name:/^(Español|Inglés|Spanish|English)\b/})).toHaveCount(0);
 await page.evaluate(()=>document.fonts.ready);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
 // VO1-A (2026-11-06): Meta's page keeps its 430 × 800 layout, in its interactive mode, and the frame scales whole to fit the
 // dialog, which fits the window: nothing cut and no scroll bars.
 const frame=dialog.locator("iframe");expect(new URL((await frame.getAttribute("src"))!).searchParams.get("interactive")).toBe("true");
 const layout=await frame.evaluate((element:HTMLIFrameElement)=>({width:element.offsetWidth,height:element.offsetHeight,scale:new DOMMatrix(getComputedStyle(element).transform).a}));
 expect(layout.width).toBe(430);expect(layout.height).toBe(800);expect(layout.scale).toBeGreaterThan(0.5);expect(layout.scale).toBeLessThanOrEqual(1);
 const box=(await frame.locator("..").boundingBox())!;const bounds=(await dialog.boundingBox())!;
 expect(box.width).toBeCloseTo(430*layout.scale,0);expect(box.height).toBeCloseTo(800*layout.scale,0);
 expect(box.x).toBeGreaterThanOrEqual(bounds.x);expect(box.x+box.width).toBeLessThanOrEqual(bounds.x+bounds.width);expect(box.y+box.height).toBeLessThanOrEqual(bounds.y+bounds.height);
 expect(bounds.x).toBeGreaterThanOrEqual(0);expect(bounds.x+bounds.width).toBeLessThanOrEqual(width);expect(bounds.y).toBeGreaterThanOrEqual(0);expect(bounds.y+bounds.height).toBeLessThanOrEqual(900);
 expect(await dialog.evaluate(element=>element.scrollHeight<=element.clientHeight&&element.scrollWidth<=element.clientWidth)).toBe(true);
 await page.screenshot({path:`test-results/forms-official-preview-${lang}-${width}.png`,fullPage:true});
 await expect(dialog.locator("iframe")).toHaveCount(0,{timeout:8000});await expect(dialog.getByRole("link")).toHaveCount(0);expect(cultures).toEqual([lang]);
 await dialog.getByRole("button",{name:es?"Volver a pedir la vista":"Request a new preview",exact:true}).click();await expect(dialog.locator("iframe")).toBeVisible();await expect.poll(()=>cultures.length).toBe(2);expect(cultures).toEqual([lang,lang]);
 await dialog.press("Escape");await expect(trigger).toBeFocused();
 });
}

for(const lang of ["es","en"] as const)for(const width of [1440,390,320]){
 // The wait of a 429 is the reason of the disabled Retry (tooltip and description), not a text in the dialog.
 test("normal publication wait is the reason of Retry after a 429 "+lang+" "+width,async({page})=>{
  const es=lang==="es";await page.setViewportSize({width,height:900});await page.goto("/src/test/visual/index.html?screen=/formularios/"+fixtureFormId+"&scenario=forms-publication-ready&lang="+lang);
  await page.getByRole("heading",{name:es?"Registrar visita":"Register visit",level:1,exact:true}).waitFor({state:"visible"});await page.evaluate(()=>document.fonts.ready);
  await page.evaluate(()=>{const previous=window.fetch;window.fetch=(input,init)=>{const request=input instanceof Request?input:new Request(new URL(String(input),location.origin),init);if(request.method==="POST"&&new URL(request.url).pathname.endsWith("/publication-checks"))return Promise.resolve(new Response(JSON.stringify({code:"General.RateLimited",retryAfter:60}),{status:429,headers:{"Content-Type":"application/problem+json","Retry-After":"60"}}));return previous(input,init);};});
  const trigger=page.getByRole("button",{name:es?"Publicar en WhatsApp":"Publish on WhatsApp",exact:true});await trigger.focus();await trigger.press("Enter");const dialog=page.getByRole("dialog");
  const result=dialog.getByRole("heading",{name:es?"Comprobación pendiente":"Check pending",exact:true}).locator("..");await expect(result).toBeVisible();
  const wait=es?/^Esperá \d+ segundos para volver a intentar\.$/:/^Wait \d+ seconds before trying again\.$/;const retry=dialog.getByRole("button",{name:es?"Reintentar":"Retry",exact:true});
  await expect(retry).toBeDisabled();await expect(retry).toHaveAccessibleDescription(wait);await expect(dialog.locator('p[role="status"]').filter({hasText:wait})).toHaveCount(0);
  // The disabled button does not receive the pointer: its wrapper does, and shows the wait as help.
  await retry.locator("..").hover();await expect(page.getByRole("tooltip")).toHaveText(wait);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);await page.screenshot({path:"test-results/forms-publication-wait-normal-"+lang+"-"+width+".png",fullPage:true});
  // Radix closes a hoverable tooltip on a pointer move outside its grace area, not on the move that leaves the trigger.
  await page.mouse.move(0,0,{steps:4});await expect(page.getByRole("tooltip")).toHaveCount(0);
  await dialog.press("Escape");await expect(trigger).toBeFocused();
 });
}
