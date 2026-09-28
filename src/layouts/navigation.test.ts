import { describe, expect, it } from "vitest";
import { branchOf, isAdministrationPath, parentLinkOf } from "./navigation";

describe("parentLinkOf", () => {
  it("finds the menu link a child route hangs from", () => {
    expect(parentLinkOf("/roles/abc")?.to).toBe("/roles");
    expect(parentLinkOf("/roles/nuevo")?.to).toBe("/roles");
  });

  it("is nothing for the menu link itself", () => {
    // `/roles` es la pantalla del enlace, no una hija: sus migas no cambian.
    expect(parentLinkOf("/roles")).toBeUndefined();
  });

  it("does not take a longer name for a child", () => {
    // Sin la barra, "/rolesviejos" empezaría con "/roles" y colgaría de un enlace que no es el suyo.
    expect(parentLinkOf("/rolesviejos")).toBeUndefined();
  });

  it("does not take the screen itself with a trailing slash for a child", () => {
    // "/roles/" es el listado con una barra de más: el router lo abre como "/roles". Si contara como hija,
    // las migas del listado terminarían en su propio enlace, esperando una hoja que nadie va a poner.
    expect(parentLinkOf("/roles/")).toBeUndefined();
  });

  it("does not count the dashboard as a parent", () => {
    // Todo empieza con "/": si el Inicio contara, cualquier ruta sin dueño colgaría de él.
    expect(parentLinkOf("/no-existe")).toBeUndefined();
  });
});

describe("branchOf", () => {
  it("finds the group of a screen of the menu", () => {
    expect(branchOf("/roles")?.labelKey).toBe("navigation.userManagement");
  });

  it("finds the group of a child route too", () => {
    // Así el menú se despliega solo también en /roles/abc, y las migas tienen su nivel del medio.
    expect(branchOf("/roles/abc")?.labelKey).toBe("navigation.userManagement");
  });

  it("finds the group of a screen with a trailing slash", () => {
    // El router abre "/roles/" como "/roles": el menú tiene que desplegarse igual.
    expect(branchOf("/roles/")?.labelKey).toBe("navigation.userManagement");
  });

  it("is nothing for a screen that is not inside a group", () => {
    expect(branchOf("/configuracion")).toBeUndefined();
    expect(branchOf("/configuracion/algo")).toBeUndefined();
    expect(branchOf("/rolesviejos")).toBeUndefined();
  });
});

describe("isAdministrationPath", () => {
  it("is true for a screen of the panel", () => {
    expect(isAdministrationPath("/usuarios")).toBe(true);
    expect(isAdministrationPath("/roles")).toBe(true);
    expect(isAdministrationPath("/configuracion")).toBe(true);
  });

  it("is true for a child route of one of its screens", () => {
    // /roles/abc es la pantalla de un rol: el panel tiene que quedarse abierto, no cerrarse al entrar.
    expect(isAdministrationPath("/roles/abc")).toBe(true);
  });

  it("is true for a screen with a trailing slash", () => {
    expect(isAdministrationPath("/roles/")).toBe(true);
  });

  it("is false outside the panel", () => {
    // El Inicio empieza con "/" como todo lo demás: si contara, el panel se abriría en cualquier ruta.
    expect(isAdministrationPath("/")).toBe(false);
    expect(isAdministrationPath("/perfil")).toBe(false);
    expect(isAdministrationPath("/rolesviejos")).toBe(false);
  });
});
