import {test,expect,type Page} from "@playwright/test";
import es from "../../locales/es/whatsapp.json" with {type:"json"};
import en from "../../locales/en/whatsapp.json" with {type:"json"};
import type {createChatFormFixtures} from "./chatFormFixtures";
async function openChat(page:Page,lang:"es"|"en",scenario:string,width:number){
  await page.setViewportSize({width,height:900});
  await page.goto(`/src/test/visual/index.html?screen=/whatsapp/chat&scenario=forms-chat-catalog-${scenario}&lang=${lang}`);
  await page.getByRole("button",{name:"Juan Gómez",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Juan Gómez",exact:true})).toBeVisible();
  await page.evaluate(()=>document.fonts.ready);
}
async function screenshot(page:Page,name:string,width:number){
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await page.screenshot({path:`test-results/k7-${name}.png`,fullPage:true});
}
const attempts=(page:Page)=>page.evaluate(()=>(window as typeof window&{chatFormsFixture:ReturnType<typeof createChatFormFixtures>}).chatFormsFixture.attempts.length);
for(const lang of ["es","en"] as const)for(const width of [1440,390,320]){const text=lang==="es"?es:en;
  test(`K7 recipient options and sending blockers ${lang} ${width}px`,async({page})=>{
    await openChat(page,lang,"ready",width);
    const trigger=page.getByRole("button",{name:text.forms.action,exact:true});await trigger.click();
    const dialog=page.getByRole("dialog");await dialog.getByRole("radio",{name:"Registrar visita",exact:true}).click();
    const counts=lang==="es"?"Cliente: 2 opciones":"Cliente: 2 options";
    await expect(dialog.getByText(counts,{exact:true})).toBeVisible();
    await expect(dialog.getByRole("button",{name:text.forms.action,exact:true})).toBeEnabled();
    await screenshot(page,`prepared-${lang}-${width}`,width);
    await dialog.press("Escape");await expect(trigger).toBeFocused();expect(await attempts(page)).toBe(0);
  });
  for(const state of ["unavailable","large","empty"])test(`K7 ${state} catalog blocker ${lang} ${width}px`,async({page})=>{
      await openChat(page,lang,state,width);await page.getByRole("button",{name:text.forms.action,exact:true}).click();
      const dialog=page.getByRole("dialog");await dialog.getByRole("radio",{name:"Registrar visita",exact:true}).click();
      const input=dialog.getByRole("textbox",{name:text.forms.messageLabel});await input.fill("Private draft retained");
      await expect(dialog.getByRole("alert")).toBeVisible();
      await expect(dialog.getByRole("button",{name:text.forms.action,exact:true})).toBeDisabled();
      await expect(input).toHaveValue("Private draft retained");expect(await attempts(page)).toBe(0);
      await screenshot(page,`${state}-${lang}-${width}`,width);
  });
  test(`K7 historical reference reload and permissions ${lang} ${width}px`,async({page})=>{
    await openChat(page,lang,"completed",width);
    await expect(page.getByRole("definition").filter({hasText:"Pérez Hnos."})).toBeVisible();
    await expect(page.getByText("Clientes",{exact:true})).toBeVisible();
    await expect(page.getByText("Av. Colón 1234",{exact:true})).toBeVisible();
    await screenshot(page,`reference-${lang}-${width}`,width);
    await page.reload();await page.getByRole("button",{name:"Juan Gómez",exact:true}).click();await expect(page.getByRole("definition").filter({hasText:"Pérez Hnos."})).toBeVisible();
    await openChat(page,lang,"no-values",width);await expect(page.getByRole("definition").filter({hasText:"Pérez Hnos."})).toHaveCount(0);
    await expect(page.getByText(text.forms.reply.saved.replace("{{number}}","VIS-000031"),{exact:true})).toBeVisible();
    await screenshot(page,`no-values-${lang}-${width}`,width);
  });
  test(`K7 rejection and explicit resend ${lang} ${width}px`,async({page})=>{
    await openChat(page,lang,"inactive",width);
    await expect(page.getByText(text.forms.reply.catalogInactive.replace("{{label}}","Cliente"),{exact:true})).toBeVisible();
    await expect(page.getByRole("definition").filter({hasText:"Pérez Hnos."})).toHaveCount(0);
    await screenshot(page,`inactive-${lang}-${width}`,width);
    await page.getByRole("button",{name:text.forms.reply.resend,exact:true}).click();
    const dialog=page.getByRole("dialog");await expect(dialog).toBeVisible();expect(await attempts(page)).toBe(0);
    await dialog.getByRole("radio",{name:"Registrar visita",exact:true}).click();
    await expect(dialog.getByText(lang==="es"?"Cliente: 2 opciones":"Cliente: 2 options",{exact:true})).toBeVisible();
    await dialog.getByRole("button",{name:text.forms.action,exact:true}).click();await expect(dialog).toHaveCount(0);
    expect(await attempts(page)).toBe(1);
    await openChat(page,lang,"inactive-read",width);await expect(page.getByRole("button",{name:text.forms.reply.resend,exact:true})).toHaveCount(0);
    await screenshot(page,`read-only-${lang}-${width}`,width);
  });
}

for(const lang of ["es","en"] as const)test(`K7 rejection remains readable at intermediate width ${lang}`,async({page})=>{
  await openChat(page,lang,"inactive",900);
  // The notice must retain enough width to read at the sidebar breakpoint.
  const notice=page.getByText((lang==="es"?es:en).forms.reply.catalogInactive.replace("{{label}}","Cliente"),{exact:true});
  await expect(notice).toBeVisible();
  expect(await notice.evaluate(element=>element.getBoundingClientRect().width)).toBeGreaterThan(250);
  await expect(page.getByRole("button",{name:(lang==="es"?es:en).back,exact:true})).toBeVisible();
  await screenshot(page,`intermediate-${lang}`,900);
});
