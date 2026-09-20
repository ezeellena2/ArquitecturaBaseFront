import { createBrowserRouter } from "react-router";
import { ProtectedRoute } from "@/auth/ProtectedRoute";

// Las rutas del SPA están en español, porque son parte de la interfaz.
// Cada página se carga cuando se visita: `lazy` parte el bundle por ruta.
export const router = createBrowserRouter([
  {
    element: <ProtectedRoute />,
    children: [
      { path: "/", lazy: async () => ({ Component: (await import("@/features/home/pages/DashboardPage")).DashboardPage }) },
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
]);
