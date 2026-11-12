import { describe, expect, it } from "vitest";
import { deliveryDefinition, deliveryIds } from "@/test/visual/locationContactFixtures";
import { draftReviewLines } from "./draftReviewLines";
import { openDraftSession } from "./draftSession";
import { withCondition } from "./conditions";
import { createDraftReview, newQuestion, replaceQuestionType, resolveDraftReview, type DraftReview } from "./editorModel";
import { assignReceives, canReceive, locationContactKinds, receivesOf, withoutDanglingReceives } from "./locationContact";
import type { DraftEditorValue, DraftQuestion } from "./model";
import { markRepeated } from "./rowsQuestions";
import { removeQuestionWithTitles } from "./sectionTitles";

// W3 (UC1-A): «Ubicación y contacto» in the editor. What a text question receives of what is shared in the chat lives on the question
// (`receives`), like a fixed validation: it travels with the draft and goes with the question.
const scope = { actorId: "actor", editorId: "editor" };
const ids = deliveryIds;
const opened = (location = false) => openDraftSession(scope, deliveryDefinition("es", { location })).value;
const received = (value: DraftEditorValue) => value.draft.fields.flatMap(question => receivesOf(question) ? [[question.localId, receivesOf(question)]] : []);
const replaced = (value: DraftEditorValue, fields: readonly DraftQuestion[]): DraftEditorValue => ({ ...value, draft: { ...value.draft, fields } });

describe("which question receives each datum", () => {
  it("takes a short or a long text outside the block, never another type or a question of the block", () => {
    const fields = opened().draft.fields;
    expect(fields.filter(canReceive).map(question => question.localId)).toEqual([ids.address, ids.receiver, ids.phone, ids.notes]);
    expect(canReceive({ ...fields[0]!, repeated: true } as DraftQuestion)).toBe(false);
    expect(canReceive(newQuestion("decimal", "es", "amount"))).toBe(false);
    expect(locationContactKinds).toEqual(["location", "contactName", "contactPhone"]);
  });

  it("never takes a text that shows by a condition, chosen or still being chosen: WhatsApp does not prefill it", () => {
    const notes = opened().draft.fields.find(question => question.localId === ids.notes)!;
    expect(canReceive({ ...notes, showWhen: { questionId: "delivered", values: ["false"] } })).toBe(false);
    expect(canReceive(withCondition(notes, true))).toBe(false);
    expect(canReceive(withCondition(withCondition(notes, true), false))).toBe(true);
    expect(received(assignReceives(replaced(opened(), opened().draft.fields.map(question => question.localId === ids.notes ? withCondition(question, true) : question)), "location", ids.notes)))
      .toEqual([[ids.receiver, "contactName"], [ids.phone, "contactPhone"]]);
  });

  it("never takes a text with the fixed validation of a library standard, and drops it if one had it", () => {
    const account = { ...newQuestion("shortText", "es", "account"), label: { es: "Cuenta de origen" }, validation: "bankAccount" } as DraftQuestion;
    expect(canReceive(account)).toBe(false);
    expect(canReceive({ ...account, validation: "taxId" } as DraftQuestion)).toBe(false);
    expect(received(assignReceives(replaced(opened(), [...opened().draft.fields, account]), "contactPhone", "account"))).toEqual([[ids.address, "location"], [ids.receiver, "contactName"]]);
    expect(received(withoutDanglingReceives(replaced(opened(), [...opened().draft.fields, { ...account, receives: "contactPhone" } as DraftQuestion]))))
      .toEqual([[ids.address, "location"], [ids.receiver, "contactName"], [ids.phone, "contactPhone"]]);
  });

  it("gives a datum to one question, takes it from the one that had it and «Ninguna» leaves it on none", () => {
    const moved = assignReceives(opened(), "location", ids.notes);
    expect(received(moved)).toEqual([[ids.receiver, "contactName"], [ids.phone, "contactPhone"], [ids.notes, "location"]]);
    expect(received(assignReceives(moved, "location", null))).toEqual([[ids.receiver, "contactName"], [ids.phone, "contactPhone"]]);
    // A question receives one datum: giving it another one frees the row it had.
    expect(received(assignReceives(opened(), "contactPhone", ids.receiver))).toEqual([[ids.address, "location"], [ids.receiver, "contactPhone"]]);
    // Only a text outside the block takes it.
    expect(received(assignReceives(opened(), "location", ids.photo))).toEqual([[ids.receiver, "contactName"], [ids.phone, "contactPhone"]]);
  });

  it("goes with the question: removed or with another type, its row goes back to «Ninguna»; renamed, it stays", () => {
    const value = opened();
    const [address, receiver] = value.draft.fields;
    expect(received(replaced(value, removeQuestionWithTitles(value.draft.fields, [], ids.address).fields))).toEqual([[ids.receiver, "contactName"], [ids.phone, "contactPhone"]]);
    // A long text is another question for the server, as any change of type.
    const longer = replaceQuestionType(receiver!, "longText", "receiver-again", "es");
    expect(receivesOf(longer)).toBeNull();
    expect(receivesOf({ ...address!, label: { es: "Domicilio" } })).toBe("location");
  });
});

describe("never a choice that no longer fits", () => {
  it("drops it from a question that goes into the block", () => {
    const value = opened();
    const block = replaced(value, markRepeated(value.draft.fields, ids.receiver, true, "es", "Bloque", { question: () => "receiver-row", choice: () => "choice", block: () => "block" }));
    expect(block.draft.fields.find(question => question.localId === "receiver-row")).toMatchObject({ repeated: true, receives: "contactName" });
    expect(received(withoutDanglingReceives(block))).toEqual([[ids.address, "location"], [ids.phone, "contactPhone"]]);
  });

  it("drops it from a question that gets a condition, and taking the condition away does not bring it back", () => {
    const value = opened();
    const conditioned = withoutDanglingReceives(replaced(value, value.draft.fields.map(question => question.localId === ids.receiver ? withCondition(question, true) : question)));
    expect(received(conditioned)).toEqual([[ids.address, "location"], [ids.phone, "contactPhone"]]);
    const always = replaced(conditioned, conditioned.draft.fields.map(question => question.localId === ids.receiver ? withCondition(question, false) : question));
    expect(received(withoutDanglingReceives(always))).toEqual([[ids.address, "location"], [ids.phone, "contactPhone"]]);
  });

  it("drops the location when the form gets a question «Ubicación», and keeps the contact", () => {
    const value = opened();
    const located = replaced(value, [...value.draft.fields, { ...newQuestion("location", "es", "where"), label: { es: "Ubicación" } }]);
    expect(received(withoutDanglingReceives(located))).toEqual([[ids.receiver, "contactName"], [ids.phone, "contactPhone"]]);
    // A question that becomes «Ubicación» does the same.
    const changed = replaced(value, value.draft.fields.map(question => question.localId === ids.notes ? replaceQuestionType(question, "location", "notes-place", "es") : question));
    expect(received(withoutDanglingReceives(changed))).toEqual([[ids.receiver, "contactName"], [ids.phone, "contactPhone"]]);
  });

  it("leaves the draft as it was when every choice fits", () => {
    const value = opened();
    expect(withoutDanglingReceives(value)).toBe(value);
    const located = opened(true);
    expect(withoutDanglingReceives(located)).toBe(located);
  });
});

// A 409 while saving: «Ubicación y contacto» is one change of the review, compared and kept as a whole, like the reading.
describe("the zone in a conflict", () => {
  const saved = deliveryDefinition("es");
  // Meanwhile someone else renamed the form.
  const current = { ...saved, revision: saved.revision + 1, name: { ...saved.name, es: "Entregas" } };
  const choose = (review: DraftReview, choices: Readonly<Record<string, "mine" | "current">>) => resolveDraftReview(review, Object.fromEntries(review.rows.map(row => [row.id, choices[row.id] ?? "current"])));
  const row = (review: DraftReview) => review.rows.find(item => item.kind === "locationContact");
  const named = (label: string, number: string) => ({ kind: "key", key: "locationContact.option", values: { label, number } });

  it("lists the questions chosen here as one change, says only what differs and «Conservar mis cambios» keeps them", () => {
    const mine = assignReceives(assignReceives(opened(), "location", ids.notes), "contactPhone", null);
    const review = createDraftReview(mine, current);
    expect(row(review)).toMatchObject({ id: "locationContact", canKeep: true, mine: { location: ids.notes, contactName: ids.receiver, contactPhone: null },
      current: { location: ids.address, contactName: ids.receiver, contactPhone: ids.phone } });
    expect(received(choose(review, { locationContact: "mine" })!)).toEqual([[ids.receiver, "contactName"], [ids.notes, "location"]]);
    expect(received(choose(review, { locationContact: "current" })!)).toEqual([[ids.address, "location"], [ids.receiver, "contactName"], [ids.phone, "contactPhone"]]);
    // Each question named as in the zone, with the numbers of its version.
    expect(draftReviewLines(review, row(review)!, { culture: "es", catalogs: true })).toEqual([
      { key: "location", label: { kind: "key", key: "locationContact.rows.location" }, before: named("Dirección de entrega", "1"), after: named("Observaciones", "5") },
      { key: "contactPhone", label: { kind: "key", key: "locationContact.rows.contactPhone" }, before: named("Teléfono de quien recibe", "3"), after: { kind: "key", key: "locationContact.none" } }]);
    expect(createDraftReview(opened(), current).rows.some(item => item.kind === "locationContact")).toBe(false);
  });

  it("shows the question «Ubicación» of a version on its location line, and names a question without a text by its number", () => {
    // Mine adds a question «Ubicación», which takes the location (W1-A), and gives the contact's name to a new question still without a text.
    const where = { ...newQuestion("location", "es", "where"), label: { es: "Ubicación" } };
    const mine = withoutDanglingReceives(assignReceives(replaced(opened(), [...opened().draft.fields, where, newQuestion("shortText", "es", "blank")]), "contactName", "blank"));
    const review = createDraftReview(mine, current);
    expect(row(review)).toMatchObject({ mine: { location: null, contactName: "new:blank", contactPhone: ids.phone } });
    expect(draftReviewLines(review, row(review)!, { culture: "es", catalogs: true })).toEqual([
      { key: "location", label: { kind: "key", key: "locationContact.rows.location" }, before: named("Dirección de entrega", "1"), after: named("Ubicación", "6") },
      { key: "contactName", label: { kind: "key", key: "locationContact.rows.contactName" }, before: named("Recibió", "2"),
        after: { kind: "key", key: "locationContact.unnamed", values: { number: "7" } } }]);
  });

  it("gives each question what it receives in the version chosen for the zone, whatever is chosen for the question", () => {
    // Mine made the address optional and gave the location to the notes; the saved version keeps it on the address.
    const mine = assignReceives(replaced(opened(), opened().draft.fields.map(question => question.localId === ids.address ? { ...question, required: false } : question)), "location", ids.notes);
    const review = createDraftReview(mine, current);
    expect(review.rows.map(item => item.id)).toEqual(["name:es", "field:" + ids.address, "locationContact"]);
    const result = choose(review, { ["field:" + ids.address]: "mine" })!;
    expect(result.draft.fields.find(question => question.localId === ids.address)).toMatchObject({ required: false, receives: "location" });
    expect(received(result)).toEqual([[ids.address, "location"], [ids.receiver, "contactName"], [ids.phone, "contactPhone"]]);
    // A new question of mine that is not kept takes its choice away.
    const added = { ...newQuestion("shortText", "es", "reference"), label: { es: "Referencia" } };
    const withNew = assignReceives(replaced(opened(), [...opened().draft.fields, added]), "location", "reference");
    const newReview = createDraftReview(withNew, current);
    expect(received(choose(newReview, { locationContact: "mine" })!)).toEqual([[ids.receiver, "contactName"], [ids.phone, "contactPhone"]]);
    expect(received(choose(newReview, { locationContact: "mine", ["field:new:reference"]: "mine" })!)).toEqual([[ids.receiver, "contactName"], [ids.phone, "contactPhone"], ["reference", "location"]]);
  });
});
