import { expect, test } from "./test";
for (const language of ["es","en"] as const) for (const width of [1440,390,320]) {
  test(`guided business editor ${language} at ${width}px saves location, hours and FAQ`,async({ page, baseURL }) => {
    if (!baseURL) throw new Error("A base URL is required for the visual suite.");
    const localOrigin = new URL(baseURL).origin;
    const es=language==="es"; const external:string[]=[];
    page.on("request",request => { if(new URL(request.url()).origin !== localOrigin) external.push(request.url()); });
    await page.setViewportSize({ width,height:900 });
    await page.goto(`/src/test/visual/index.html?screen=/configuracion/negocio&scenario=business-guided&lang=${language}`);
    await expect(page.getByRole("heading",{name:es?"Información del negocio":"Business information",exact:true})).toBeVisible();
    const end=page.getByRole("combobox",{name:es?"Lunes 1 · Hasta":"Monday 1 · Until",exact:true});
    await expect(end).toHaveValue("18:00");
    const hours=page.getByRole("region",{name:es?"Horario de atención":"Opening hours",exact:true});
    await end.scrollIntoViewIfNeeded();
    const box=await end.boundingBox(),bounds=await hours.boundingBox();
    expect(box!.x+box!.width).toBeLessThanOrEqual(bounds!.x+bounds!.width);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const search = page.getByRole("combobox", { name: es ? "Buscar un lugar" : "Search for a place", exact: true });
    await search.fill(es ? "Sanatorio, Ciudad de ejemplo" : "Clinic, Example City");
    const option = page.getByRole("option", { name: es ? "Sanatorio de ejemplo, Ciudad de ejemplo" : "Example Clinic, Example City", exact: true });
    await expect(option).toBeVisible();
    await expect(page.getByRole("listbox").getByText("Google Maps", { exact: true })).toBeVisible();
    const optionBox = await option.boundingBox();
    expect(optionBox!.x).toBeGreaterThanOrEqual(0);
    expect(optionBox!.x + optionBox!.width).toBeLessThanOrEqual(width);
    await search.press("ArrowDown"); await search.press("Enter");
    await expect(search).toBeFocused();
    await expect(page.getByRole("textbox",{name:es?"Enlace de la ubicación":"Location link",exact:true})).toHaveValue(/query_place_id=ChIJ_fictionalClinic$/);
    await expect(page.getByRole("link", { name: es ? "Ver ubicación" : "View location", exact: true })).toHaveAttribute("href", /query_place_id=ChIJ_fictionalClinic$/);
    await expect(page.locator('[data-sonner-toast][data-type="success"]')).toHaveCount(0);
    await end.selectOption("08:00");await page.getByRole("button",{name:es?"Guardar":"Save",exact:true}).click();
    await expect(page.getByRole("alert")).toContainText(es?"El cierre debe ser posterior":"Closing must be after");
    await expect(page.locator('[data-sonner-toast][data-type="success"]')).toHaveCount(0);
    await end.selectOption("18:00");await expect(page.getByRole("alert")).toHaveCount(0);
    await page.getByRole("combobox",{name:es?"Domingo · Atención":"Sunday · Opening",exact:true}).selectOption("allDay");
    await page.getByRole("button",{name:es?"Agregar fecha especial":"Add special date",exact:true}).click();
    await page.getByRole("dialog").getByLabel(es?"Fecha":"Date",{exact:true}).fill("2026-10-10");
    await page.getByRole("dialog").getByRole("button",{name:es?"Agregar fecha":"Add date",exact:true}).click();
    await page.getByRole("combobox",{name:es?"Agregar una pregunta predefinida":"Add a predefined question",exact:true}).selectOption("delivery");
    const answer=page.getByRole("textbox",{name:es?"Respuesta del negocio":"Business answer",exact:true});
    await expect(answer).toHaveValue("");await answer.fill(es?"Consultar antes de confirmar el pedido.":"Ask before confirming the order.");
    await expect(page.getByText(es?"1 respuesta completa":"1 complete answer",{exact:true})).toBeVisible();
    await page.getByRole("button",{name:es?"Guardar":"Save",exact:true}).click();
    await expect(page.getByRole("button",{name:es?"Guardar":"Save",exact:true})).toBeDisabled();
    await expect(page.locator('[data-sonner-toast][data-type="success"]')).toHaveCount(1);
    await expect(answer).toHaveValue(es?"Consultar antes de confirmar el pedido.":"Ask before confirming the order.");
    await expect(page.getByRole("combobox",{name:es?"Domingo · Atención":"Sunday · Opening",exact:true})).toHaveValue("allDay");
    expect(external).toEqual([]);
    await page.screenshot({path:`test-results/business-guided-${language}-${width}.png`,fullPage:true});
  });
}

test("the chosen place is cleared when the address changes", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/src/test/visual/index.html?screen=/configuracion/negocio&scenario=business-guided&lang=es");
  await page.getByRole("combobox", { name: "Buscar un lugar", exact: true }).fill("Sanatorio de ejemplo");
  await page.getByRole("option", { name: "Sanatorio de ejemplo, Ciudad de ejemplo", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Enlace de la ubicación", exact: true })).toHaveValue(/query_place_id=ChIJ_fictionalClinic$/);
  await page.getByRole("textbox", { name: "Dirección del local", exact: true }).fill("Otra dirección confirmada");
  await expect(page.getByRole("textbox", { name: "Enlace de la ubicación", exact: true })).toHaveValue("");
  await expect(page.getByRole("link", { name: "Ver ubicación", exact: true })).toHaveCount(0);
});

