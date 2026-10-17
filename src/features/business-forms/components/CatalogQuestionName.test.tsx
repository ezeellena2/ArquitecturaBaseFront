import { act, screen, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { createQueryClient } from "@/shared/api/queryClient";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { server } from "@/test/mocks/server";
import { proposalCatalog } from "@/test/mocks/catalogProposal";
import { CatalogQuestionName } from "./CatalogQuestionName";

it("withdraws a cached catalog label when its own read becomes forbidden", async () => {
 const catalog = proposalCatalog(); const client = createQueryClient();
 server.use(http.get("/api/forms/catalogs/" + catalog.id, () => HttpResponse.json(catalog)));
 await act(async () => { renderWithProviders(<QueryClientProvider client={client}><CatalogQuestionName scope={{ actorId: "author", culture: "es", permissions: ["formcatalogs.read"] }} id={catalog.id} /></QueryClientProvider>); });
 await screen.findByText("· Supervisores activos");
 server.use(http.get("/api/forms/catalogs/" + catalog.id, () => HttpResponse.json({ code: "General.Forbidden" }, { status: 403 })));
 await act(async () => { await client.refetchQueries({ queryKey: ["form-catalogs", "author"] }); });
 await waitFor(() => expect(screen.queryByText("· Supervisores activos")).not.toBeInTheDocument());
});
