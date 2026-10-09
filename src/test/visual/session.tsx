import "@fontsource-variable/public-sans";
import "@/index.css";
import { StrictMode } from "react";
import { User } from "oidc-client-ts";
import { createRoot } from "react-dom/client";
import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { AppProviders } from "@/app/providers";
import { routes } from "@/app/routes";
import { authConfig } from "@/auth/authConfig";

// Test-only entry: start with an authenticated account, then exercise real logout, login and callback.
const path = new URLSearchParams(location.search).get("screen") ?? "/";
const user = new User({
  access_token: "session-admin", id_token: "session-admin-identity", token_type: "Bearer", expires_at: 4102444800,
  profile: { sub: "session-admin", iss: location.origin, aud: "web", exp: 4102444800, iat: 1790800000 },
});
await authConfig.userStore?.set(`user:${location.origin}:web`, user.toStorageString());
history.replaceState({}, "", path);
const router = createBrowserRouter(routes);
createRoot(document.getElementById("root")!).render(<StrictMode><AppProviders><RouterProvider router={router} /></AppProviders></StrictMode>);
