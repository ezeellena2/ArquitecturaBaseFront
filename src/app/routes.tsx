import type { RouteObject } from "react-router";
import { ProtectedRoute } from "@/auth/ProtectedRoute";
import { SessionRecovery } from "@/auth/SessionRecovery";
import { CallbackPage } from "@/features/auth/pages/CallbackPage";
import { LoginCodePage } from "@/features/auth/pages/LoginCodePage";
import { LoginPage } from "@/features/auth/pages/LoginPage";
import { AppLayout } from "@/layouts/AppLayout";
import { AuthLayout } from "@/layouts/AuthLayout";

// Las rutas del SPA están en español, porque son parte de la interfaz.
// Cada página se carga cuando se visita: `lazy` parte el bundle por ruta.
// `Component` en lugar de `element` evita crear el elemento (y su JSX) donde no hace falta pasarle props: la
// sesión (`ProtectedRoute` sin permiso) y el layout no necesitan ninguna. `/usuarios` sí (el permiso), así
// que esa rama usa `element` con el `<ProtectedRoute permission="..." />` de la sección 7.3 del spec.
//
// Las tres pantallas de ingreso quedan afuera de la regla de `lazy`: son la puerta de entrada de cualquier
// visita sin sesión (sección 5.2), así que separarlas en su propio chunk solo suma una ida y vuelta antes de
// poder mostrar el formulario. Un router de datos como este, además, no pinta nada de toda la rama que
// matchea (acá, tampoco el `AuthLayout` de afuera) hasta que se resuelve el `lazy` de la hoja.
export const routes: RouteObject[] = [
  {
    // `SessionRecovery` envuelve a `ProtectedRoute`, y solo esta rama: son las pantallas que necesitan sesión.
    // Al recargar cualquiera de ellas hay que intentar recuperarla antes de que `ProtectedRoute` concluya que
    // no hay. Las del ingreso, que cuelgan de `AuthLayout`, no tienen nada que recuperar.
    Component: SessionRecovery,
    children: [
      {
        Component: ProtectedRoute,
        children: [
          {
            Component: AppLayout,
            children: [
              {
                path: "/",
                lazy: async () => ({ Component: (await import("@/features/home/pages/DashboardPage")).DashboardPage }),
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
            ],
          },
        ],
      },
    ],
  },
  {
    Component: AuthLayout,
    children: [
      { path: "/login", Component: LoginPage },
      { path: "/login/codigo", Component: LoginCodePage },
      { path: "/auth/callback", Component: CallbackPage },
    ],
  },
  {
    path: "/sin-permiso",
    lazy: async () => ({ Component: (await import("@/features/errors/pages/ForbiddenPage")).ForbiddenPage }),
  },
  {
    path: "*",
    lazy: async () => ({ Component: (await import("@/features/errors/pages/NotFoundPage")).NotFoundPage }),
  },
];
