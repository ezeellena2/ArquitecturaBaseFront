import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Page } from "@/shared/ui/Page";
import { Button } from "@/shared/ui/button";
import { MessageHistory } from "@/shared/ui/MessageHistory";
import { MessageBubble } from "@/shared/ui/MessageBubble";
import { FormReplyCard } from "@/features/whatsapp/components/FormReplyCard";
import type { FormReplyDisplayRow } from "@/features/whatsapp/components/FormReplyValues";
import { useChatHistoryViewport } from "@/features/whatsapp/hooks/useChatHistoryViewport";

// Presentation-only synthetic examples, not HTTP contracts, persistence or a Meta response.
export function FormReplyPreview() {
  const { i18n } = useTranslation("whatsapp");
  const en = i18n.resolvedLanguage === "en";
  const [allowed, setAllowed] = useState(true);
  const [atBottom, setAtBottom] = useState(false);
  const { viewport, onScroll, preserveViewport } = useChatHistoryViewport([], atBottom, setAtBottom);
  const name = en ? "Register visit" : "Registrar visita";
  const rows: readonly FormReplyDisplayRow[] = [
    { id: "client", label: en ? "Client" : "Cliente", answer: { type: "choice", value: en ? "North distributor" : "Distribuidora Norte" } },
    { id: "date", label: en ? "Visit date" : "Fecha de la visita", answer: { type: "date", value: "2026-10-08" } },
    { id: "note", label: en ? "Notes" : "Observaciones", answer: { type: "longText", value: "All good, the client signed." } },
    { id: "bool", label: en ? "Everything delivered?" : "¿Se entregó todo?", answer: { type: "boolean", value: false } },
    { id: "zero", label: en ? "Returned packages" : "Bultos devueltos", answer: { type: "decimal", value: "0" } },
    { id: "amount", label: en ? "Amount received" : "Importe cobrado", answer: { type: "decimal", value: "125500.00" } },
    { id: "none", label: en ? "Contact phone" : "Teléfono de contacto", answer: { type: "shortText", value: null } },
  ];
  const long = [{ id: "long", label: en ? "Notes" : "Observaciones", answer: { type: "longText" as const, value: "Private long answer\n" + "The client signed, please deliver the remaining boxes on Monday. ".repeat(24) } }];
  const bubble = (key: string, attachment: ReactNode) => <MessageBubble key={key} direction="incoming" text="" timestamp="2026-10-11T12:00:00Z" timeLabel="9:00" dateLabel="11 oct 2026" author="Juan" attachment={attachment} />;
  return <Page title={en ? "R1–R3 · simulated presentation" : "R1–R3 · presentación simulada"}
    actions={<Button variant="outline" onClick={() => setAllowed(false)}>{en ? "Revoke answer access" : "Revocar lectura de respuestas"}</Button>}>
    <div className="flex h-[calc(100svh-12rem)] min-h-0 flex-col">
      <MessageHistory ref={viewport} label={en ? "Form reply examples" : "Ejemplos de respuestas"} onScroll={onScroll}>
        {(["Pending", "Rejected", "Unrecognized"] as const).map(state => bubble(state, <FormReplyCard reply={{ state, name: state === "Unrecognized" ? null : name }} />))}
        {bubble("completed", <FormReplyCard reply={{ state: "Completed", name, recordNumber: "VIS-000001", values: allowed ? rows : null, valuesRevoked: !allowed }} preserveViewport={preserveViewport} />)}
        {bubble("long", <FormReplyCard reply={{ state: "Completed", name, recordNumber: "VIS-000002", values: allowed ? long : null, valuesRevoked: !allowed }} preserveViewport={preserveViewport} />)}
        {bubble("readonly", <FormReplyCard reply={{ state: "Completed", name, recordNumber: "VIS-000003", values: null }} />)}
        {bubble("removed", <FormReplyCard reply={{ state: "Completed", name, recordNumber: "VIS-000004", values: allowed ? rows : null, messageRemoved: true }} />)}
        {Array.from({length: 15}, (_, n) => bubble("following"+n, <p>{en ? "Following message" : "Mensaje siguiente"} {n+1}</p>))}
      </MessageHistory>
    </div>
  </Page>;
}
