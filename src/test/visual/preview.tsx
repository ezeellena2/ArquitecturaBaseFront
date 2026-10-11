import "@fontsource-variable/public-sans";
import "@/index.css";
import { User } from "oidc-client-ts";
import { createRoot } from "react-dom/client";
import { createMemoryRouter, RouterProvider } from "react-router";
import { AppProviders } from "@/app/providers";
import { routes } from "@/app/routes";
import { authConfig } from "@/auth/authConfig";
import { AppLayout } from "@/layouts/AppLayout";
import i18n from "@/shared/i18n";
import { Catalog } from "./Catalog";
import { FormReplyPreview } from "./FormReplyPreview";
import { installVisualFixtures } from "./fixtures";

// Entrada exclusiva de desarrollo/pruebas, fuera de las entradas del build.
// Usa layouts, providers y rutas reales. El navegador de pruebas intercepta el HTTP.
const parameters = new URLSearchParams(location.search);
const screen = parameters.get("screen") ?? "/catalogo";
const language = parameters.get("lang") === "en" ? "en" : "es";
installVisualFixtures(language, parameters.get("scenario"));
await i18n.changeLanguage(language);
if ((screen !== "/" || parameters.get("scenario")?.startsWith("assistant-")) && !screen.startsWith("/login") && !screen.startsWith("/registro")) {
  const user = new User({
    access_token: "visual-test-only", token_type: "Bearer", expires_at: 4102444800,
    profile: { sub: "visual-test", iss: location.origin, aud: "web", exp: 4102444800, iat: 1790800000 },
  });
  await authConfig.userStore?.set(`user:${location.origin}:web`, user.toStorageString());
}
const router = createMemoryRouter([...routes, { Component: AppLayout, children: [{ path: "/catalogo", Component: Catalog }, { path: "/form-replies", Component: FormReplyPreview }] }], {
  initialEntries: [screen],
});
createRoot(document.getElementById("root")!).render(<AppProviders><RouterProvider router={router} /></AppProviders>);

