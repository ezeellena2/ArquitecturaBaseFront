import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { AppProviders } from "@/app/providers";

/// Renderiza con los mismos providers que la app: traducciones y, más adelante, datos y sesión.
export function renderWithProviders(ui: ReactElement) {
  return render(ui, { wrapper: AppProviders });
}
