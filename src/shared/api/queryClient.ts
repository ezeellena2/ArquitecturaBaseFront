import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./ApiError";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // No tiene sentido reintentar lo que el backend ya respondió con un error de negocio.
      retry: (failureCount, error) => !(error instanceof ApiError) || (error.isNetworkError && failureCount < 2),
    },
  },
});
