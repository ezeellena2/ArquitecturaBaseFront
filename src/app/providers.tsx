import { QueryClientProvider } from "@tanstack/react-query";
import { Suspense, type ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import { AppAuthProvider } from "@/auth/AuthProvider";
import { queryClient } from "@/shared/api/queryClient";
import i18n from "@/shared/i18n";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <AppAuthProvider>
          <Suspense fallback={null}>{children}</Suspense>
        </AppAuthProvider>
      </QueryClientProvider>
    </I18nextProvider>
  );
}
