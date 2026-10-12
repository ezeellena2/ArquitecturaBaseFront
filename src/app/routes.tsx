import { Navigate, type RouteObject } from "react-router";
import { ProtectedRoute } from "@/auth/ProtectedRoute";
import { SessionRecovery } from "@/auth/SessionRecovery";
import { CallbackPage } from "@/features/auth/pages/CallbackPage";
import { LoginCodePage } from "@/features/auth/pages/LoginCodePage";
import { LoginLinkPage } from "@/features/auth/pages/LoginLinkPage";
import { LoginPage } from "@/features/auth/pages/LoginPage";
import { AuthLayout } from "@/layouts/AuthLayout";
import { HomeLayout } from "@/layouts/HomeLayout";
import { Spinner } from "@/shared/ui/Spinner";
import { RouteErrorPage } from "./RouteErrorPage";

// Las rutas del SPA están en español, porque son parte de la interfaz.
// Cada página se carga cuando se visita: `lazy` parte el bundle por ruta.
// `Component` en lugar de `element` evita crear el elemento (y su JSX) donde no hace falta pasarle props: la
// sesión (`ProtectedRoute` sin permiso) y el layout no necesitan ninguna. `/usuarios` sí (el permiso), así
// que esa rama usa `element` con el `<ProtectedRoute permission="..." />` de la sección 7.3 del spec.
//
// Las pantallas de ingreso quedan afuera de la regla de `lazy`: son la puerta de entrada de cualquier
// visita sin sesión (sección 5.2), así que separarlas en su propio chunk solo suma una ida y vuelta antes de
// poder mostrar el formulario. Un router de datos como este, además, no pinta nada de toda la rama que
// matchea (acá, tampoco el `AuthLayout` de afuera) hasta que se resuelve el `lazy` de la hoja.
export const routes: RouteObject[] = [
  {
    // `SessionRecovery` envuelve a `ProtectedRoute`, y solo esta rama: son las pantallas que necesitan sesión.
    // Al recargar cualquiera de ellas hay que intentar recuperarla antes de que `ProtectedRoute` concluya que
    // no hay. Las del ingreso, que cuelgan de `AuthLayout`, no tienen nada que recuperar.
    Component: SessionRecovery,
    ErrorBoundary: RouteErrorPage,
    HydrateFallback: Spinner,
    children: [
      {
        Component: HomeLayout,
        children: [
          { path: "/", lazy: async () => ({ Component: (await import("@/app/AuthenticatedHome")).AuthenticatedHome }) },
          {
            Component: ProtectedRoute,
            ErrorBoundary: RouteErrorPage,
            children: [
              {
                element: <ProtectedRoute permission="formcatalogs.read" />,
                children: [
                  { path: "/catalogos", lazy: async () => ({ Component: (await import("@/features/business-forms/pages/CatalogsPage")).CatalogsPage }) },
                  { element: <ProtectedRoute permission="formcatalogs.manage" />, children: [
                    { path: "/catalogos/nuevo", lazy: async () => ({ Component: (await import("@/features/business-forms/pages/CatalogEditorPage")).CatalogEditorPage }) },
                  ] },
                  { path: "/catalogos/:catalogId", lazy: async () => ({ Component: (await import("@/features/business-forms/pages/CatalogEditorPage")).CatalogEditorPage }) },
                ],
              },
              {
                element: <ProtectedRoute permission="formtemplates.read" />,
                children: [
                  { path: "/formularios", lazy: async () => ({ Component: (await import("@/features/business-forms/pages/FormsPage")).FormsPage }) },
                  { element: <ProtectedRoute permission="formtemplates.manage" />, children: [
                    { path: "/formularios/nuevo", lazy: async () => ({ Component: (await import("@/features/business-forms/pages/FormEditorPage")).FormEditorPage }) },
                  ] },
                  { path: "/formularios/:formId", lazy: async () => ({ Component: (await import("@/features/business-forms/pages/FormEditorPage")).FormEditorPage }) },
                ],
              },
              {
                // Sin permiso: alcanza con tener sesión, que ya la exige el ProtectedRoute de arriba. Cada
                // quien edita el suyo, y el backend no mira más que el token.
                path: "/perfil",
                lazy: async () => ({ Component: (await import("@/features/profile/pages/ProfilePage")).ProfilePage }),
              },
              {
                element: <ProtectedRoute permission="whatsapp.read" />,
                children: [{ path: "/whatsapp/chat", lazy: async () => ({ Component: (await import("@/features/whatsapp/pages/WhatsAppChatPage")).WhatsAppChatPage }) }],
              },
              {
                element: <ProtectedRoute permission="users.read" />,
                children: [
                  {
                    path: "/usuarios",
                    lazy: async () => ({ Component: (await import("@/features/users/pages/UsersPage")).UsersPage }),
                  },
                ],
              },
              {
                element: <ProtectedRoute permission="roles.read" />,
                children: [
                  {
                    path: "/roles",
                    lazy: async () => ({ Component: (await import("@/features/roles/pages/RolesPage")).RolesPage }),
                  },
                ],
              },
              {
                // El alta y la edición de un rol piden `roles.manage`, no el `roles.read` del listado: con ese
                // solo se ve, y entrar a mano a una de estas rutas lleva a la pantalla de sin permiso.
                element: <ProtectedRoute permission="roles.manage" />,
                children: [
                  {
                    // Antes que `/:roleId` solo por legibilidad: react-router rankea las rutas y un segmento
                    // estático le gana a uno dinámico en cualquier orden, así que "nuevo" nunca se lee como un id.
                    path: "/roles/nuevo",
                    lazy: async () => ({
                      Component: (await import("@/features/roles/pages/RoleEditorPage")).RoleEditorPage,
                    }),
                  },
                  {
                    path: "/roles/:roleId",
                    lazy: async () => ({
                      Component: (await import("@/features/roles/pages/RoleEditorPage")).RoleEditorPage,
                    }),
                  },
                ],
              },
              {
                element: <ProtectedRoute permission="settings.manage" />,
                children: [
                  {
                    path: "/configuracion",
                    lazy: async () => ({
                      Component: (await import("@/features/settings/pages/SettingsPage")).SettingsPage,
                    }),
                  },
                  {
                    path: "/configuracion/apariencia",
                    lazy: async () => ({ Component: (await import("@/features/settings/pages/AppearancePage")).AppearancePage }),
                  },
                  ...["idioma", "zona-horaria", "listados", "registro"].map(topic => ({
                    path: `/configuracion/${topic}`, element: <Navigate to="/configuracion" replace />,
                  })),
                ],
              },
              {
                element: <ProtectedRoute permission="ai.read" />,
                children: [{ path: "/configuracion/ia", lazy: async () => ({ Component: (await import("@/features/artificial-intelligence/pages/AiSettingsPage")).AiSettingsPage }) }],
              },
              {
                element: <ProtectedRoute permission="ai.business.read" />,
                children: [{ path: "/configuracion/negocio", lazy: async () => ({ Component: (await import("@/features/artificial-intelligence/pages/BusinessInformationPage")).BusinessInformationPage }) }],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    Component: AuthLayout,
    ErrorBoundary: RouteErrorPage,
    children: [
      { path: "/login", Component: LoginPage },
      { path: "/registro", Component: LoginPage },
      { path: "/registro/codigo", Component: LoginCodePage },
      { path: "/login/codigo", Component: LoginCodePage },
      // La entrada con el enlace que manda el bot al chat de WhatsApp (`/ingresar#t=…`).
      { path: "/ingresar", Component: LoginLinkPage },
      { path: "/auth/callback", Component: CallbackPage },
    ],
  },
  {
    path: "/sin-permiso",
    ErrorBoundary: RouteErrorPage,
    lazy: async () => ({ Component: (await import("@/shared/ui/ForbiddenPage")).ForbiddenPage }),
  },
  {
    path: "*",
    ErrorBoundary: RouteErrorPage,
    lazy: async () => ({ Component: (await import("@/features/errors/pages/NotFoundPage")).NotFoundPage }),
  },
];
