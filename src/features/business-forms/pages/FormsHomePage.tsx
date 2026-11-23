import { Navigate, useSearchParams } from "react-router";
import { useCurrentUser } from "@/auth/useCurrentUser";
import { FormOverviewPage } from "./FormOverviewPage";
import { FormsPage } from "./FormsPage";

/// «Formularios» (FU2-A and FU3, 2026-11-23): one address for the whole list. Whoever designs gets the list of the forms with
/// «Cargar» and «Por aprobar»; whoever does not (reads, decides or only loads) gets what they had in «Formularios».
export function FormsHomePage() {
  const { data: user } = useCurrentUser();
  return user?.permissions.includes("formtemplates.read") ? <FormsPage /> : <FormOverviewPage />;
}

/// The old address of «Formularios» (`/formularios/respuestas`) leads to the list, with its filter and its search: a saved link
/// «con algo por aprobar» or of the deactivated ones opens that filter (FU4).
export function FormOverviewAddress() {
  const [params] = useSearchParams();
  const next = new URLSearchParams();
  const filter = params.get("pendingOnly") === "true" ? "Pending" : params.get("state") === "Deactivated" ? "Deactivated" : undefined;
  if (filter) next.set("publicationFilter", filter);
  for (const key of ["search", "pageSize"]) { const value = params.get(key); if (value) next.set(key, value); }
  const query = next.toString();
  return <Navigate to={"/formularios" + (query ? "?" + query : "")} replace />;
}
