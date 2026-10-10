import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PhonePreview } from "./PhonePreview";
import { Input } from "./input";
import { Button } from "./button";

describe("Phone preview composition", () => {
  it("preserves the supplied content title, accessible controls and disabled final action", () => {
    render(<PhonePreview title="Formulario de visita"><Input aria-label="Cliente" defaultValue="Norte" /><Button disabled>Confirmar visita</Button></PhonePreview>);
    expect(screen.getByText("Formulario de visita")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Cliente" })).toHaveValue("Norte");
    expect(screen.getByRole("button", { name: "Confirmar visita" })).toBeDisabled();
  });
});
