import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import * as icons from "./icons";

type Icono = (props: { className?: string }) => ReactElement;

const todos = Object.entries(icons).filter(
  (entrada): entrada is [string, Icono] => typeof entrada[1] === "function",
);

describe("el set de íconos", () => {
  it("exporta más de uno", () => {
    // Si el archivo dejara de exportar componentes, los `it.each` de abajo no correrían y el archivo pasaría
    // en verde sin haber probado nada.
    expect(todos.length).toBeGreaterThan(10);
  });

  it.each(todos)("%s se oculta del lector de pantalla", (_nombre, Icono) => {
    // El fundamento visual: el SVG es decorativo y el nombre accesible lo pone el control que lo contiene.
    // Un ícono que se etiquete a sí mismo hace que el botón se anuncie dos veces.
    const { container } = render(<Icono />);
    const svg = container.querySelector("svg");

    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it.each(todos)("%s dibuja algo", (_nombre, Icono) => {
    // Un `d` con un typo no rompe nada: el SVG renderiza vacío y el botón queda en blanco. Esto lo atrapa.
    const { container } = render(<Icono />);

    expect(container.querySelectorAll("svg > *").length).toBeGreaterThan(0);
  });

  it.each(todos)("%s usa el trazo del set", (_nombre, Icono) => {
    const { container } = render(<Icono />);

    // Un ícono con otro trazo se nota al lado de los demás, y es lo primero que se cuela cuando alguien copia
    // uno de otra librería.
    expect(container.querySelector("svg")).toHaveAttribute("stroke-width", "1.75");
  });
});
