import "@fontsource-variable/public-sans";
import "./styles.css";
import { User } from "oidc-client-ts";
import { createRoot } from "react-dom/client";
import { createMemoryRouter, RouterProvider } from "react-router";
import { AppProviders } from "@/app/providers";
import { authConfig } from "@/auth/authConfig";
import { AppLayout } from "@/layouts/AppLayout";
import i18n from "@/shared/i18n";
import { installVisualFixtures } from "@/test/visual/fixtures";
import { ConversationsBoard } from "./ConversationsBoard";
import { copy } from "./copy";

const language = new URLSearchParams(location.search).get("lang") === "en" ? "en" : "es";
document.documentElement.lang = language;
// The preview has a fictional session. No chat request reaches the real API.
installVisualFixtures(language, "chat");
const fixtureFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input), location.origin);
  if (url.pathname.startsWith("/api/ai/assistant"))
    throw new Error("The conversation preview must not call the assistant API.");
  return fixtureFetch(input, init);
};
await i18n.loadLanguages(["es", "en"]);
for (const lang of ["es", "en"] as const)
  i18n.addResourceBundle(lang, "conversationPreview", copy[lang]);
await i18n.changeLanguage(language);
const user = new User({
  access_token: "conversation-preview-only",
  token_type: "Bearer",
  expires_at: 4102444800,
  profile: { sub: "visual-test", iss: location.origin, aud: "web", exp: 4102444800, iat: 1790800000 },
});
await authConfig.userStore?.set(`user:${location.origin}:web`, user.toStorageString());
const router = createMemoryRouter([{ Component: AppLayout, children: [{ path: "*", Component: ConversationsBoard }] }]);
createRoot(document.getElementById("root")!).render(<AppProviders><RouterProvider router={router} /></AppProviders>);
