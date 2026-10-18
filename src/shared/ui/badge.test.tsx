import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { Badge } from "./badge";

it.each([
  ["success", "bg-[var(--color-success-50)]", "text-[var(--color-success-700)]"],
  ["warning", "bg-[var(--color-warning-50)]", "text-[var(--color-warning-700)]"],
  ["danger", "bg-danger/5", "text-[var(--color-danger-700)]"],
] as const)("presents a %s status using the shared semantic palette without an alert", (variant, background, foreground) => {
  render(<Badge variant={variant}>Estado confirmado</Badge>);
  const status = screen.getByText("Estado confirmado");
  expect(status).toHaveClass(background, foreground);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
