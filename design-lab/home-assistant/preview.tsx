import "@fontsource-variable/public-sans";
import "./preview.css";
import { User } from "oidc-client-ts";
import { createRoot } from "react-dom/client";
import { createMemoryRouter, RouterProvider } from "react-router";
import { AppProviders } from "@/app/providers";
import { authConfig } from "@/auth/authConfig";
import { AppLayout } from "@/layouts/AppLayout";
import i18n from "@/shared/i18n";
import { installVisualFixtures } from "@/test/visual/fixtures";
import { AssistantProposal, SetupProposal } from "./AssistantProposal";
import { copy } from "./copy";

// Only this entry intercepts API calls. No provider call or real session is used.
const language = new URLSearchParams(location.search).get("lang") === "en" ? "en" : "es";
installVisualFixtures(language, "chat");
const fixtureFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const response = await fixtureFetch(input, init);
  const url = new URL(input instanceof Request ? input.url : String(input), location.origin);
  if (url.pathname !== "/api/me") return response;
  const profile = await response.json() as { permissions: string[] };
  profile.permissions.push("ai.read", "ai.manage", "ai.assistant.use");
  return Response.json(profile);
};
await i18n.loadLanguages(["es", "en"]);
for (const lang of ["es", "en"] as const) i18n.addResourceBundle(lang, "assistantProposal", copy[lang]);
await i18n.changeLanguage(language);
const user = new User({ access_token: "home-design-lab-only", token_type: "Bearer", expires_at: 4102444800,
  profile: { sub: "visual-test", iss: location.origin, aud: "web", exp: 4102444800, iat: 1790800000 } });
await authConfig.userStore?.set(`user:${location.origin}:web`, user.toStorageString());
const router = createMemoryRouter([{ Component: AppLayout, children: [
  { path: "/", Component: AssistantProposal }, { path: "/configuracion/ia", Component: SetupProposal },
  { path: "*", Component: SetupProposal },
] }]);
createRoot(document.getElementById("root")!).render(<AppProviders><div className="assistant-lab"><RouterProvider router={router} /></div></AppProviders>);
