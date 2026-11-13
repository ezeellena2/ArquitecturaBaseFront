import type { DocumentFormProposal } from "@/features/business-forms/api/documentFormProposals";
import type { ReceivedDocument, ReceivedDocumentGroup } from "@/features/business-forms/api/receivedDocuments";
import { createReceivedDocumentVisualFixtures, receivedDocumentIds, receivedDocumentsPageFixture } from "./receivedDocumentFixtures";

// «Armar formulario con la IA» (DOC6) as the board draws it: five fuel tickets that no form takes, sent by Juan Gómez, Pablo Sosa and
// Marta Ruiz; the notice above the inbox, the request while the AI builds the form, its proposal with what it read in the first ticket,
// and a request that failed. Synthetic bodies on the backend's shape (task 14) for the scenes («document-form-*»): they do not accredit
// the grouping, the reading nor the proposal of the server. Every station, CUIT, amount and plate is invented.
const id = (n: number) => `0199b0c0-0000-7000-8000-${String(n).padStart(12, "0")}`;
export const documentFormProposalIds = { pending: id(901), completed: id(902), failed: id(903), topic: id(951), proposal: id(961) } as const;
const ticketIds = [id(921), id(922), id(923), id(924), id(925)] as const;

function tickets(language: "es" | "en"): ReceivedDocument[] {
  const items = receivedDocumentsPageFixture(language).items;
  const base = items.find(item => item.id === receivedDocumentIds.other)!;
  const [juan, pablo, marta] = ["Juan Gómez", "Pablo Sosa", "Marta Ruiz"].map(name => items.find(item => item.sender.displayName === name)!.sender);
  const ticket = (index: number, name: string, sender: ReceivedDocument["sender"], receivedAtUtc: string): ReceivedDocument => ({
    ...base, id: ticketIds[index]!, sender, receivedAtUtc, deleteAfterUtc: receivedAtUtc.replace("2026-10", "2027-01"),
    file: { ...base.file, name },
  });
  return [ticket(0, "ticket.jpg", juan!, "2026-10-22T11:50:00Z"), ticket(1, "ticket-ruta8.jpg", pablo!, "2026-10-21T14:47:00Z"),
    ticket(2, "ticket.jpg", juan!, "2026-10-19T20:20:00Z"), ticket(3, "ticket-estacion.jpg", marta!, "2026-10-18T13:10:00Z"),
    ticket(4, "ticket.jpg", pablo!, "2026-10-17T09:05:00Z")];
}

const topic = (language: "es" | "en") => ({ id: documentFormProposalIds.topic, name: language === "en" ? "fuel tickets" : "tickets de combustible" });

/** The notice of similar documents above the inbox: the five tickets, under the page's other filters. */
export const documentFormGroupsFixture = (language: "es" | "en"): ReceivedDocumentGroup[] =>
  [{ topic: topic(language), count: 5, documentIds: tickets(language).map(document => document.id) }];

/** The proposal of propose-form@2 for the tickets, with what it read in the first one (as it reads, not as the app writes). */
function content(language: "es" | "en") {
  const en = language === "en";
  const question = (label: string, type: string, required: boolean, sample: string | null, options: string[] = []) => ({ label, type, required, options, catalog: null, sample });
  return {
    culture: language, name: en ? "Fuel tickets" : "Tickets de combustible", prefix: "TCB", submitLabel: en ? "Load ticket" : "Cargar ticket",
    questions: [
      question(en ? "Station" : "Estación", "shortText", true, "Estación Ruta 8 S.R.L."),
      question(en ? "Station CUIT" : "CUIT de la estación", "shortText", true, "30-71122334-3"),
      question(en ? "Date" : "Fecha", "date", true, "22/10/2026"),
      question(en ? "Fuel" : "Combustible", "choice", true, "Nafta súper", en ? ["Regular gasoline", "Premium gasoline", "Diesel"] : ["Nafta súper", "Nafta premium", "Gasoil"]),
      question(en ? "Liters" : "Litros", "number", false, "38,50"),
      question(en ? "Amount" : "Importe", "number", true, "52.360,00"),
      question(en ? "Plate" : "Patente", "shortText", false, "AB 123 CD"),
      question("Ticket", "document", false, null),
    ],
    documentReading: { recognition: en
      ? "A service station ticket: the station's name and CUIT, the date and time, the fuel, the liters, the total amount and the vehicle's plate."
      : "Ticket de una estación de servicio: el nombre y el CUIT de la estación, la fecha y la hora, el combustible, los litros, el importe total y la patente del vehículo." },
    standard: null,
  };
}

/** A request of the scenes: building, with its proposal, or failed because the engine could not. */
export function documentFormProposalFixture(language: "es" | "en", requestId: string): DocumentFormProposal {
  const base = { requestId, failureCode: null, topic: topic(language), documents: tickets(language), proposal: null, definitionId: null };
  if (requestId === documentFormProposalIds.completed)
    return { ...base, state: "completed", proposal: { id: documentFormProposalIds.proposal, capability: "forms.authoring.propose-form", version: 2, content: content(language) } } as DocumentFormProposal;
  if (requestId === documentFormProposalIds.failed) return { ...base, state: "failed", failureCode: "Ai.Assistant.ProviderUnavailable" };
  return { ...base, state: "pending" };
}

/** A fuel ticket drawn as a photo (portrait), with the stamp «EJEMPLO». */
async function ticketPhoto(language: "es" | "en"): Promise<Blob> {
  const canvas = new OffscreenCanvas(600, 860);
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#f6f4ee"; context.fillRect(0, 0, 600, 860);
  context.fillStyle = "#1f2a24"; context.font = "bold 34px monospace"; context.fillText("Estación Ruta 8 S.R.L.", 48, 90);
  context.font = "24px monospace"; context.fillText("CUIT 30-71122334-3", 48, 132);
  ["22/10/2026 · 08:47", "Nafta súper      38,50 L", "Patente          AB 123 CD"].forEach((line, index) => context.fillText(line, 48, 220 + index * 52));
  context.font = "bold 40px monospace"; context.fillText("TOTAL  $ 52.360,00", 48, 420);
  context.strokeStyle = "#b5462f"; context.lineWidth = 4; context.strokeRect(330, 480, 230, 64);
  context.fillStyle = "#b5462f"; context.font = "bold 24px sans-serif"; context.fillText(language === "en" ? "SAMPLE" : "EJEMPLO", 372, 522);
  return canvas.convertToBlob({ type: "image/jpeg", quality: 0.85 });
}

/**
 * The scenes of DOC6 for whoever reviews documents and designs forms: «document-form-notice» (the inbox with the notice),
 * «document-form-pending», «document-form-proposal» and «document-form-failed» (the page of each request). The rest of the inbox
 * answers as its own scenes.
 */
export function createDocumentFormProposalVisualFixtures(language: "es" | "en", scenario: string) {
  const inbox = createReceivedDocumentVisualFixtures(language, "documents");
  return {
    permissions: ["formdocuments.read", "formdocuments.review", "formrecords.read", "formtemplates.read", "formtemplates.manage"],
    async handle(request: Request): Promise<Response | undefined> {
      const url = new URL(request.url);
      if (url.pathname === "/api/forms/documents/search" && scenario === "document-form-notice") {
        const page = await (await inbox.handle(request))!.json() as object;
        return Response.json({ ...page, groups: documentFormGroupsFixture(language) });
      }
      const asked = /^\/api\/forms\/documents\/form-proposals\/([^/]+)$/.exec(url.pathname);
      if (asked) return Response.json(documentFormProposalFixture(language, asked[1]!));
      if (ticketIds.some(ticket => url.pathname === `/api/forms/documents/${ticket}/file`))
        return new Response(await ticketPhoto(language), { headers: { "content-type": "image/jpeg" } });
      return inbox.handle(request);
    },
  };
}
