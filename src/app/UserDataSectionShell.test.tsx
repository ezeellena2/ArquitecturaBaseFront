import { useContext } from "react";
import { act, screen } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { server } from "@/test/mocks/server";
import { currentUser } from "@/test/mocks/handlers";
import { initialAppearance } from "@/shared/lib/appearance";
import { UserDataSectionContext } from "@/shared/hooks/userDataSectionContext";
import { UserDataSectionShell } from "./UserDataSectionShell";
vi.mock("react-oidc-context", async () => { const actual = await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"); return { ...actual, useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "t" } }) }; });
function Probe() { const extension = useContext(UserDataSectionContext); return <p>{extension ? "extension" : "without extension"}</p>; }
async function mount(features: string[]) {
 server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["users.manage"] })), http.get("/api/settings/presentation", () => HttpResponse.json({ appearance: initialAppearance, defaultCulture: "es", defaultTimeZoneId: "UTC", defaultPageSize: 20, installedFeatures: features })));
 await act(async () => { renderWithProviders(<UserDataSectionShell><Probe /></UserDataSectionShell>); });
}
it("does not contribute data to accounts when the optional module is absent", async () => { await mount([]); expect(await screen.findByText("without extension")).toBeInTheDocument(); });
it("contributes a neutral account section only for an installed module", async () => { await mount(["forms"]); expect(await screen.findByText("extension")).toBeInTheDocument(); });
