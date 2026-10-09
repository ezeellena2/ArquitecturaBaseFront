import "@fontsource-variable/public-sans";
import "./preview.css";
import { User } from "oidc-client-ts";
import { createRoot } from "react-dom/client";
import { createMemoryRouter, Navigate, RouterProvider } from "react-router";
import { AppProviders } from "@/app/providers";
import { authConfig } from "@/auth/authConfig";
import { administration, isBranch, navigationLinks } from "@/layouts/navigation";
import { AppLayout } from "@/layouts/AppLayout";
import { SettingsPage } from "@/features/settings/pages/SettingsPage";
import { AppearancePage } from "@/features/settings/pages/AppearancePage";
import { WhatsAppChatPage } from "@/features/whatsapp/pages/WhatsAppChatPage";
import { PublicWhatsAppIcon, SettingsIcon } from "@/shared/ui/icons";
import i18n from "@/shared/i18n";
import { installVisualFixtures } from "@/test/visual/fixtures";
import { AiReviewChatProposal } from "./AiReviewChatProposal";
import { aiReviewCopy } from "./aiReviewCopy";
import { copy } from "./copy";
import { aiCopy } from "./aiCopy";
import { AiConnectionProposal } from "./AiConnectionProposal";
import { BusinessInformationProposal } from "./BusinessInformationProposal";
import { BusinessPlaceProposal } from "./BusinessPlaceProposal";
import { businessPlaceCopy } from "./businessPlaceCopy";
import { businessInformationCopy } from "./businessInformationCopy";
import { finalCopy } from "./finalCopy";
import { ContactsProposal } from "./ContactsProposal";
import { TemplatesProposal } from "./TemplatesProposal";
import { AccessProposal } from "./AccessProposal";
import { ConnectionProposal } from "./ConnectionProposal";
import { OutsideProposal, PanelProposalLayout } from "./PanelProposalLayout";

// Entrada aislada: el arnés intercepta la API, la sesión vive en memoria y los
// mensajes solo existen en React. Nunca se envía un mensaje a WhatsApp.
const language = new URLSearchParams(location.search).get("lang") === "en" ? "en" : "es";
const guidedBusiness = new URLSearchParams(location.search).get("screen") === "negocio-guiado";
const placeProposal = new URLSearchParams(location.search).get("screen") === "ubicacion-lugar";
if (guidedBusiness) {
  location.replace(`/src/test/visual/index.html?screen=/configuracion/negocio&scenario=business-guided&lang=${language}`);
} else {
installVisualFixtures(language, "chat");
// Load complete namespaces before extending common; a partial bundle would hide
// the English navigation resources and fall back to Spanish.
await i18n.loadLanguages(["es", "en"]);
for (const lang of ["es", "en"] as const) {
  i18n.addResourceBundle(lang, "chatProposal", copy[lang]);
  i18n.addResourceBundle(lang, "llmProposal", aiCopy[lang]);
  i18n.addResourceBundle(lang, "finalProposal", finalCopy[lang]);
  i18n.addResourceBundle(lang, "aiReviewProposal", aiReviewCopy[lang]);
  i18n.addResourceBundle(lang, "businessInformationProposal", businessInformationCopy[lang]);
  i18n.addResourceBundle(lang, "businessPlaceProposal", businessPlaceCopy[lang]);
  i18n.addResourceBundle(lang, "common", { navigation: { whatsappProposal: "WhatsApp", artificialIntelligence: lang === "es" ? "Inteligencia artificial" : "Artificial intelligence", businessInformation: lang === "es" ? "Información del negocio" : "Business information" } }, true, true);
}
await i18n.changeLanguage(language);
const link = { labelKey: "navigation.whatsappProposal", icon: PublicWhatsAppIcon, to: "/whatsapp" };
navigationLinks.push(link);
// Only this isolated entry extends the real settings menu; product navigation is unchanged.
const aiLink = { labelKey: "navigation.artificialIntelligence", to: "/configuracion/ia", exact: true, icon: SettingsIcon, permission: "settings.manage" };
const businessLink = { labelKey: "navigation.businessInformation", to: "/configuracion/negocio", exact: true, icon: SettingsIcon, permission: "settings.manage" };
// The fixture profile only has settings.manage. Keep one AI entry in this mock menu.
const existingAiLink = navigationLinks.find(item => item.to === aiLink.to);
if (existingAiLink) existingAiLink.permission = aiLink.permission;
const existingBusinessLink = navigationLinks.find(item => item.to === businessLink.to);
if (existingBusinessLink) existingBusinessLink.permission = businessLink.permission;
const settingsBranch = administration.items.find(item => isBranch(item) && item.children.some(child => child.to === "/configuracion"));
if (settingsBranch && isBranch(settingsBranch)) {
  if (!settingsBranch.children.some(item => item.to === aiLink.to)) settingsBranch.children.push(aiLink);
  if (!settingsBranch.children.some(item => item.to === businessLink.to)) settingsBranch.children.push(businessLink);
}
if (!navigationLinks.some(item => item.to === aiLink.to)) navigationLinks.push(aiLink);
if (!navigationLinks.some(item => item.to === businessLink.to)) navigationLinks.push(businessLink);
const user = new User({ access_token: "design-lab-only", token_type: "Bearer", expires_at: 4102444800,
  profile: { sub: "visual-test", iss: location.origin, aud: "web", exp: 4102444800, iat: 1790800000 } });
await authConfig.userStore?.set(`user:${location.origin}:web`, user.toStorageString());
const router = createMemoryRouter([{ Component: PanelProposalLayout, children: [
  { path: "/whatsapp/sugerencias", Component: AiReviewChatProposal },
  { path: "/whatsapp/ia", element: <Navigate to="/configuracion/ia" replace /> },
  { path: "/whatsapp/contactos", Component: ContactsProposal },
  { path: "/whatsapp/plantillas", Component: TemplatesProposal },
  { path: "/whatsapp/conexion", Component: ConnectionProposal },
  { path: "/roles", Component: AccessProposal },
  { path: "*", Component: OutsideProposal },
] }, { Component: AppLayout, children: [
  { path: "/whatsapp/chat", Component: WhatsAppChatPage },
  { path: "/whatsapp/chats", Component: WhatsAppChatPage },
  { path: "/configuracion/ia", Component: AiConnectionProposal },
  { path: "/configuracion/negocio", Component: placeProposal ? BusinessPlaceProposal : BusinessInformationProposal },
  { path: "/configuracion", Component: SettingsPage },
  { path: "/configuracion/apariencia", Component: AppearancePage },
] }], { initialEntries: [({ ia: "/configuracion/ia", negocio: "/configuracion/negocio", "negocio-guiado": "/configuracion/negocio", "ubicacion-lugar": "/configuracion/negocio", sugerencias: "/whatsapp/sugerencias", contactos: "/whatsapp/contactos", plantillas: "/whatsapp/plantillas", conexion: "/whatsapp/conexion", permisos: "/roles" } as Record<string, string>)[new URLSearchParams(location.search).get("screen") ?? ""] ?? "/whatsapp/chats"] });
createRoot(document.getElementById("root")!).render(<AppProviders><RouterProvider router={router} /></AppProviders>);
}
