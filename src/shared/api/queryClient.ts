import { QueryCache, QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import i18n from "@/shared/i18n";
import { ApiError } from "./ApiError";

export const queryClient = new QueryClient({
  // Errores que la pantalla no muestra por su cuenta: un aviso, y reintento si fue de red (sección 6.1 del spec).
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (query.meta?.silent === true || !(error instanceof ApiError)) {
        return;
      }

      // 401 y 403 los resuelven el cliente HTTP y las pantallas.
      if (error.status === 401 || error.status === 403) {
        return;
      }

      if (error.isNetworkError) {
        toast.error(i18n.t("errors.network"), {
          action: { label: i18n.t("actions.retry"), onClick: () => void query.fetch() },
        });

        return;
      }

      // Un 500 es un bug o una falla de infraestructura (GlobalExceptionHandler, sección 6.1 del spec): su
      // detail es un mensaje genérico sin valor propio, así que mostramos el traceId para que se pueda
      // reportar, en vez de inventar un texto. El resto son errores de negocio: su detail ya viene traducido.
      if (error.status >= 500) {
        toast.error(i18n.t("errors.unexpected", { traceId: error.traceId ?? "?" }));

        return;
      }

      toast.error(error.detail ?? i18n.t("states.error"));
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // No tiene sentido reintentar lo que el backend ya respondió con un error de negocio.
      retry: (failureCount, error) => !(error instanceof ApiError) || (error.isNetworkError && failureCount < 2),
    },
  },
});
