import { Suspense, type ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import i18n from "@/shared/i18n";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <I18nextProvider i18n={i18n}>
      <Suspense fallback={null}>{children}</Suspense>
    </I18nextProvider>
  );
}
