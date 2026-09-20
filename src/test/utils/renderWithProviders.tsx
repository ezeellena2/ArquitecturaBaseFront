import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { AppProviders } from "@/app/providers";

/// Renderiza con los mismos providers que la app: traducciones, sesión y datos.
/// Cada render anida su propio QueryClient adentro de AppProviders para que la caché no se filtre de un
/// test al siguiente, y sin reintentos para que un error llegue derecho a la aserción.
export function renderWithProviders(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <AppProviders>
        <QueryClientProvider client={queryClient}>
          <div data-testid="ready">{children}</div>
        </QueryClientProvider>
      </AppProviders>
    );
  }

  return render(ui, { wrapper: Wrapper });
}
