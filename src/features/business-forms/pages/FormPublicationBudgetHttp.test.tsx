import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import esRaw from "@/test/fixtures/forms-http/budget-http/es.json?raw";
import enRaw from "@/test/fixtures/forms-http/budget-http/en.json?raw";
import esText from "@/locales/es/forms.json";
import enText from "@/locales/en/forms.json";
import i18n from "@/shared/i18n";
import { queryClient } from "@/shared/api/queryClient";
import { currentUser } from "@/test/mocks/handlers";
import { server } from "@/test/mocks/server";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import { fixtureDefinition, wireDefinition } from "@/test/visual/formFixtures";
import { readFormPublicationCheck, type FormPublicationCheck } from "../api/response";
import { openDraftSession } from "../draftSession";
import type { FormDefinitionSnapshot } from "../model";

vi.mock("react-oidc-context", async () => ({ ...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"),
  useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "test" } }) }));

const input = process.env.FORMS_HTTP_CONTRACT_INPUT;
const rawByCulture = { es: esRaw, en: enRaw };
beforeEach(() => queryClient.clear());
afterEach(async () => { queryClient.clear(); await act(() => i18n.changeLanguage("es")); });

for (const culture of ["es", "en"] as const) describe("publication response budget with actual HTTP " + culture, () => {
  const raw = input ? readFileSync(resolve(input, "budget-http", culture + ".json"), "utf8") : rawByCulture[culture];
  const captured = JSON.parse(raw) as FormPublicationCheck;
  // The check response stays unchanged. Session and saved editor detail are doubles,
  // matching the producer's forty long-text questions and captured identities.
  const definition: FormDefinitionSnapshot = { ...fixtureDefinition(), id: captured.definitionId, revision: captured.draftRevision,
    draft: { format: 1, culture: "es", submitLabel: { es: "Enviar", en: "Submit" },
      fields: [...new Set(captured.issues.map(issue => issue.fieldId!))].map((fieldId, index) => ({
        fieldId, key: "field_" + fieldId.replaceAll("-", ""), type: "longText", required: true, maxLength: 10000,
        help: null, label: { es: "Respuesta " + index, en: "Response " + index },
      })) } };
  const editor = openDraftSession({ actorId: "actor", editorId: "budget-check" }, definition).value;
  const text = culture === "es" ? esText : enText;

  it("parses the unchanged localized blocker without inventing an acceptance ticket", () => {
    const checked = readFormPublicationCheck(JSON.parse(raw), definition.id, definition.revision, editor.draft.fields);
    expect(checked).toEqual(captured);
    expect(checked).toMatchObject({ compatibility: "Blocked", canAccept: false, checkToken: null, checkExpiresAtUtc: null });
    expect(checked.issues).toHaveLength(80);
    expect(new Set(checked.issues.map(issue => issue.culture))).toEqual(new Set(["es", "en"]));
    expect(checked.issues.every(issue => issue.code === "WhatsApp.Flow.ResponseTooLarge" && issue.fieldId && issue.path.endsWith(".maxLength"))).toBe(true);
    expect(checked.issues[0]!.message).toContain(culture === "es" ? "La respuesta máxima posible" : "The largest possible form response");
  });

  async function openBlockedPublication() {
    await act(() => i18n.changeLanguage(culture));
    const checks: { body: unknown; language: string | null }[] = [];
    let publications = 0;
    let writes = 0;
    server.use(
      http.get("/api/me", () => HttpResponse.json({ ...currentUser, culture, permissions: ["formtemplates.read", "formtemplates.manage", "formtemplates.publish"] })),
      http.get("/api/forms/definitions/:id", () => HttpResponse.json({ definition: wireDefinition(definition),
        capabilities: { canSave: true, canPublish: true, canPreview: false },
        audit: { createdAtUtc: "2026-10-11T12:00:00Z", modifiedAtUtc: null, lastChangedAtUtc: "2026-10-11T12:00:00Z", lastChangedBy: null },
        publication: { activeVersion: null, currentOperation: null, displayState: "Draft" } })),
      http.post("/api/forms/definitions/:id/publication-checks", async ({ request }) => {
        checks.push({ body: await request.json(), language: request.headers.get("Accept-Language") });
        return new HttpResponse(raw, { status: 200, headers: { "Content-Type": "application/json" } });
      }),
      http.post("/api/forms/definitions/:id/publications", () => { publications++; return HttpResponse.error(); }),
      http.put("/api/forms/definitions/:id/draft", () => { writes++; return HttpResponse.error(); }),
    );
    renderRouteWithProviders("/formularios/" + definition.id);
    await screen.findByLabelText(text.name);
    await userEvent.click(screen.getByRole("button", { name: text.publication.title }));
    const dialog = await screen.findByRole("dialog", { name: text.publication.versionTitle.replace("{{version}}", "1") });
    return { dialog, checks, getPublications: () => publications, getWrites: () => writes };
  }

  describe("blocked publication page", () => {
    let page: Awaited<ReturnType<typeof openBlockedPublication>>;
    beforeEach(async () => { page = await openBlockedPublication(); });

    it("blocks publication with every captured budget error and does not write", async () => {
      const { dialog, checks, getPublications, getWrites } = page;
      expect(within(dialog).getAllByText(captured.issues[0]!.message, { exact: true })).toHaveLength(captured.issues.length);
      const publish = within(dialog).getByRole("button", { name: text.publication.publishVersion.replace("{{version}}", "1") });
      expect(publish).toBeDisabled();
      await userEvent.click(publish);
      expect(getPublications()).toBe(0);
      expect(checks).toHaveLength(1);
      expect(checks[0]!.language).toBe(culture);
      expect(checks[0]!.body).not.toHaveProperty("requestId");
      expect(getWrites()).toBe(0);
    });

    it("locates a captured question in its own content language without publishing", async () => {
      const { dialog, getPublications, getWrites } = page;
      const firstFieldId = definition.draft.fields[0]!.fieldId;
      const issueIndex = captured.issues.findIndex(issue => issue.fieldId === firstFieldId && issue.culture !== culture);
      expect(issueIndex).toBeGreaterThanOrEqual(0);
      const jumps = within(dialog).getAllByRole("button", { name: text.publication.goToQuestion });
      expect(jumps).toHaveLength(captured.issues.length);
      await userEvent.click(jumps[issueIndex]!);
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      const question = screen.getByLabelText(text.question);
      expect(question).toHaveValue(captured.issues[issueIndex]!.culture === "en" ? "Response 0" : "Respuesta 0");
      await waitFor(() => expect(question).toHaveFocus());
      expect(screen.getByLabelText(text.maxLength)).toHaveValue(10000);
      expect(getPublications()).toBe(0);
      expect(getWrites()).toBe(0);
    });
  });
});
