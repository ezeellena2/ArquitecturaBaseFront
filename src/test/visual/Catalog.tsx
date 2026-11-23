import { MessageCard } from "@/shared/ui/MessageCard";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Page } from "@/shared/ui/Page";
import { Surface } from "@/shared/ui/Surface";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { FormField } from "@/shared/ui/FormField";
import { Picker } from "@/shared/ui/Picker";
import { FilterBar } from "@/shared/ui/FilterBar";
import { FilterChip } from "@/shared/ui/FilterChip";
import { DataTable } from "@/shared/ui/DataTable";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { notify } from "@/shared/ui/notifications";
import { Textarea } from "@/shared/ui/textarea";
import { CheckboxField } from "@/shared/ui/CheckboxField";
import { SearchInput } from "@/shared/ui/SearchInput";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/Tabs";
import { IconButton } from "@/shared/ui/IconButton";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { FormIcon, PencilIcon } from "@/shared/ui/icons";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { MessageBubble, MessageDateDivider, type MessageDeliveryState } from "@/shared/ui/MessageBubble";
import { MessageHistory } from "@/shared/ui/MessageHistory";
import { AssistantProposalCard } from "@/shared/ui/assistant/AssistantProposalCard";
import { AssistantRecorder } from "@/shared/ui/assistant/AssistantRecorder";
import { CatalogDisabledReasons } from "./CatalogDisabledReasons";
import { CatalogItemTable } from "./CatalogItemTable";
import { CatalogAssistantAttachment } from "./CatalogAssistantAttachment";
import { CatalogCharts } from "./CatalogCharts";
import { CatalogPickers } from "./CatalogPickers";

// Referencia local con componentes reales, no una segunda implementación visual.
export function Catalog() {
  const { t, i18n } = useTranslation(["common", "whatsapp"]);
  const mobileDialog = new URLSearchParams(location.search).get("scenario") === "mobile-dialog";
  const formPieces = new URLSearchParams(location.search).get("scenario") === "form-controls";
  const tabPieces = new URLSearchParams(location.search).get("scenario") === "tabs";
  const itemPieces = new URLSearchParams(location.search).get("scenario") === "item-table";
  const reasonPieces = new URLSearchParams(location.search).get("scenario") === "disabled-reasons";
  const attachmentPieces = new URLSearchParams(location.search).get("scenario") === "assistant-attachment";
  const chartPieces = new URLSearchParams(location.search).get("scenario") === "charts";
  const pickerPieces = new URLSearchParams(location.search).get("scenario") === "pickers";
  const [confirm, setConfirm] = useState(false);
  const [recording] = useState(() => new Blob([new Uint8Array([0x1a, 0x45, 0xdf, 0xa3])], { type: "audio/webm" }));
  const [formOpen, setFormOpen] = useState(false);
  const [selection, setSelection] = useState<string[]>(["User"]);
  const [role, setRole] = useState("User");
  const [choice, setChoice] = useState("InviteOnly");
  const [checked, setChecked] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const restoreFocus = useRestoreFocusOnClose(formOpen);
  const english = i18n.language === "en";
  const notices = new URLSearchParams(location.search).get("scenario") === "notices";
  // Los cuatro tipos de aviso a la vez, para ver el filo y el ícono de cada uno (AV1-A).
  useEffect(() => {
    if (!notices) return;
    const copy = english
      ? { success: "Changes saved.", info: "Meta's preview can take a few minutes to update.", warning: "We couldn't confirm it was saved. Check before trying again.", review: "Check", error: "Couldn't save the connection.", trace: "Trace: 00-4bf92f3577b34da6" }
      : { success: "Se guardaron los cambios.", info: "La vista de Meta puede tardar unos minutos en actualizarse.", warning: "No sabemos si se guardó. Revisá antes de volver a intentar.", review: "Revisar", error: "No se pudo guardar la conexión.", trace: "Seguimiento: 00-4bf92f3577b34da6" };
    // Sonner muestra los tres más nuevos: la información, el tipo menos usado, va primero y queda detrás.
    notify({ id: "catalog:notice:info", kind: "info", message: copy.info });
    notify({ id: "catalog:notice:success", kind: "success", message: copy.success });
    notify({ id: "catalog:notice:warning", kind: "warning", message: copy.warning, action: { label: copy.review, onClick: () => {} } });
    notify({ id: "catalog:notice:error", kind: "error", message: copy.error, description: copy.trace });
  }, [notices, english]);
  const text = english
    ? { title: "UI catalog", actions: "Actions", controls: "Fields", tables: "Table", states: "States", name: "Name", hint: "Use a name people can recognize.", invalid: "Enter a name.", status: "Status", empty: "No records yet", problem: "Content is unavailable", notice: "Changes saved", chip: "Active", remove: "Remove status filter", badgeSuccess: "Success", badgeWarning: "Attention", badgeDanger: "Problem" }
    : { title: "Catálogo de UI", actions: "Acciones", controls: "Campos", tables: "Tabla", states: "Estados", name: "Nombre", hint: "Usá un nombre que las personas reconozcan.", invalid: "Ingresá un nombre.", status: "Estado", empty: "Todavía no hay registros", problem: "No pudimos cargar el contenido", notice: "Guardamos los cambios", chip: "Activos", remove: "Quitar filtro de estado", badgeSuccess: "Éxito", badgeWarning: "Atención", badgeDanger: "Problema" };
  const columns = [{ id: "name", header: text.name, cell: (row: { id: string; name: string }) => row.name }];
  const pieces = english
    ? { description: "Description", role: "Role", roles: "Roles", choose: "Choose roles", registration: "Account registration", invited: "Invitation only", open: "Open registration", checkbox: "Send an invitation", disabled: "Unavailable action", reason: "This example is read-only.", export: "Export example", edit: "Edit example", modal: "Open form", modalTitle: "Example form", modalDescription: "A short form using the shared dialog.", search: "Search by name", status: "Filter by status", all: "All", active: "Active", filters: "Filters", selection: "Selection", dialogs: "Dialogs and tooltips", remove: "Remove example" }
    : { description: "Descripción", role: "Rol", roles: "Roles", choose: "Elegí roles", registration: "Registro de cuentas", invited: "Solo por invitación", open: "Registro abierto", checkbox: "Mandar una invitación", disabled: "Acción no disponible", reason: "Este ejemplo es de solo lectura.", export: "Exportar ejemplo", edit: "Editar ejemplo", modal: "Abrir formulario", modalTitle: "Formulario de ejemplo", modalDescription: "Un formulario corto con el diálogo compartido.", search: "Buscar por nombre", status: "Filtrar por estado", all: "Todos", active: "Activos", filters: "Filtros", selection: "Selección", dialogs: "Modales y tooltips", remove: "Quitar ejemplo" };
  return <Page title={text.title} actions={<Button onClick={() => notify({ id: "catalog:notice", kind: "success", message: text.notice })}>{text.notice}</Button>}>
    <div className="flex flex-col gap-5">
      <Surface title={text.actions} padded>
        <div className="flex flex-wrap gap-2">
          <Button>{t("actions.save")}</Button><Button variant="outline">{t("actions.cancel")}</Button>
          <Button variant="ghost">{t("actions.close")}</Button><Button variant="destructive" onClick={() => setConfirm(true)}>{t("users:actions.delete")}</Button>
          <Button variant="destructive-outline">{pieces.remove}</Button>
          <Button disabled>{t("actions.save")}</Button>
          <Badge variant="success">{text.badgeSuccess}</Badge><Badge variant="warning">{text.badgeWarning}</Badge><Badge variant="danger">{text.badgeDanger}</Badge>
        </div>
      </Surface>
      <Surface title={text.controls} padded>
        <div className="grid gap-4 md:grid-cols-3">
          <FormField label={text.name} hint={text.hint}><Input defaultValue="Ana Pérez" /></FormField>
          <FormField label={text.status}><Picker label={text.status} options={[{ id: "chip", label: text.chip }]} value="chip" onChange={() => undefined} /></FormField>
          <FormField label={text.name} error={text.invalid}><Input defaultValue="" /></FormField>
          <FormField label={pieces.description}><Textarea defaultValue={english ? "Account details." : "Datos de la cuenta."} /></FormField>
          <FormField label={pieces.role}><Picker label={pieces.role} options={[{ id: "Admin", label: "Admin" }, { id: "User", label: "User" }]} value={role} onChange={setRole} /></FormField>
          <FormField label={pieces.roles}><Picker label={pieces.roles} multiple options={[{ id: "Admin", label: "Admin" }, { id: "User", label: "User" }]} value={selection} onChange={setSelection} placeholder={pieces.choose} /></FormField>
        </div>
      </Surface>
      <Surface title={pieces.selection} padded>
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label={pieces.registration}><Picker label={pieces.registration} options={[{ id: "InviteOnly", label: pieces.invited }, { id: "Open", label: pieces.open }]} value={choice} onChange={setChoice} /></FormField>
          <CheckboxField label={pieces.checkbox} checked={checked} onCheckedChange={setChecked} />
        </div>
      </Surface>
      <section aria-label={pieces.filters}>
        <FilterBar className="flex flex-wrap items-center gap-2">
          <div className="w-80 max-w-full"><SearchInput value={search} onChange={setSearch} label={pieces.search} /></div>
          <Picker trigger="button" label={pieces.status} first={{ id: "all", label: pieces.all }} options={[{ id: "active", label: pieces.active }]} value={filter} onChange={setFilter} />
        </FilterBar>
      </section>
      <Surface title={english ? "Conversation messages" : "Mensajes de conversación"}>
        <MessageHistory label={english ? "Message examples" : "Ejemplos de mensajes"}>
          <MessageDateDivider date="2026-10-02" label={english ? "10/02/2026" : "02/10/2026"} />
          <MessageBubble direction="incoming" text={english ? "Hi, can you help me?" : "Hola, ¿me ayudás?"} timestamp="2026-10-02T12:00:00Z" timeLabel="9:00" dateLabel={english ? "10/02/2026, 9:00 AM" : "02/10/2026, 9:00"} />
          {(["pending", "sent", "delivered", "read", "failed", "uncertain", "reviewed", "unknown"] satisfies MessageDeliveryState[]).map(state =>
            <MessageBubble key={state} direction="outgoing" text={english ? "An example reply." : "Una respuesta de ejemplo."}
              timestamp="2026-10-02T12:01:00Z" timeLabel="9:01" dateLabel={english ? "10/02/2026, 9:01 AM" : "02/10/2026, 9:01"}
              delivery={{ state, label: ({ pending: t("whatsapp:status.Pending"), sent: t("whatsapp:status.Sent"), delivered: t("whatsapp:status.Delivered"),
                read: t("whatsapp:status.Read"), failed: t("whatsapp:status.Failed"), uncertain: t("whatsapp:status.Uncertain"),
                reviewed: t("whatsapp:status.Reviewed"), unknown: t("whatsapp:status.Unknown") })[state] }} />)}
        </MessageHistory>
      </Surface>
      {/* IA1-A (2026-11-04): the proposal card, open and folded as replaced or created; the module brings its content. */}
      <Surface title={english ? "Assistant proposal" : "Propuesta del asistente"} padded>
        <AssistantProposalCard kind={english ? "Form" : "Formulario"} title={english ? "Truck load control" : "Control de carga de camiones"}
          summary={english ? "CCC · 2 questions" : "CCC · 2 preguntas"}
          actions={<><Button size="sm" variant="outline">{english ? "See how it looks" : "Ver cómo queda"}</Button><Button size="sm">{english ? "Create draft" : "Crear borrador"}</Button></>}>
          <ol className="flex flex-col gap-2"><li>1. {english ? "License plate" : "Patente"}</li><li>2. {english ? "Net kilos" : "Kilos netos"}</li></ol>
        </AssistantProposalCard>
        <AssistantProposalCard kind={english ? "Form" : "Formulario"} title={english ? "Truck load control" : "Control de carga de camiones"}
          folded={{ state: english ? "Replaced" : "Reemplazada" }} />
        <AssistantProposalCard kind={english ? "Catalog" : "Catálogo"} title={english ? "Carriers" : "Transportistas"}
          folded={{ state: english ? "Catalog created" : "Catálogo creado", action: <Button size="sm" variant="link">{english ? "Open the catalog" : "Abrir el catálogo"}</Button> }} />
      </Surface>
      {/* IA4 (2026-11-04): the recording in the composer, while recording and stopped to listen to before sending. */}
      <Surface title={english ? "Recording" : "Grabación"} padded>
        <AssistantRecorder status={english ? "Recording · 0:12" : "Grabando · 0:12"} audioLabel={english ? "Your recording" : "Tu audio"}
          discardLabel={english ? "Discard" : "Descartar"} stopLabel={english ? "Stop" : "Detener"} onDiscard={() => {}} onStop={() => {}} takeFocus={false} />
        <AssistantRecorder recording={recording} status="" audioLabel={english ? "Your recording" : "Tu audio"}
          discardLabel={english ? "Discard" : "Descartar"} stopLabel={english ? "Stop" : "Detener"} onDiscard={() => {}} onStop={() => {}} takeFocus={false} />
      </Surface>
      {formPieces ? <Surface title={english ? "Form controls" : "Controles de formularios"} padded>
        <div className="flex flex-col gap-4">
          <MessageBubble direction="outgoing" text={english ? "An attached card." : "Una tarjeta adjunta."} attachment={<MessageCard icon={<FormIcon className="size-4" />} title={english ? "Example attachment" : "Adjunto de ejemplo"} description={english ? "A title and description inside the message." : "Título y descripción dentro del mensaje."} />} timestamp="2026-10-02T12:00:00Z" timeLabel="9:00" dateLabel={english ? "10/02/2026, 9:00 AM" : "02/10/2026, 9:00"} delivery={{state:"pending",label:t("whatsapp:status.Pending")}} />
        </div>
      </Surface> : null}
      {tabPieces ? <Surface title={english ? "Content tabs" : "Pestañas de contenido"} padded>
        <Tabs defaultValue="response">
          <TabsList aria-label={english ? "Response content" : "Contenido de la respuesta"}>
            <TabsTrigger value="response">{english ? "Response" : "Respuesta"}</TabsTrigger>
            <TabsTrigger value="photos">{english ? "Photos" : "Fotos"}<span aria-hidden="true">3</span></TabsTrigger>
            <TabsTrigger value="activity">{english ? "Activity" : "Actividad"}</TabsTrigger>
            <TabsTrigger value="pdf">PDF</TabsTrigger>
          </TabsList>
          <TabsContent value="response">{english ? "The selected response appears here." : "Acá se muestra la respuesta elegida."}</TabsContent>
          <TabsContent value="photos">{english ? "Response photos appear here." : "Acá se muestran las fotos de la respuesta."}</TabsContent>
          <TabsContent value="activity">{english ? "Observed activity appears here." : "Acá se muestra la actividad observada."}</TabsContent>
          <TabsContent value="pdf"><Button type="button" variant="outline">{english ? "Open PDF" : "Abrir PDF"}</Button></TabsContent>
        </Tabs>
      </Surface> : null}
      {/* RG2-A (2026-11-07): the table of items and its boxes, empty, at the maximum, with errors and in one column. */}
      {itemPieces ? <CatalogItemTable /> : null}
      {/* MA1-A (2026-11-09): the reason of what is off, on the control, with the mouse, a click or a touch. */}
      {reasonPieces ? <CatalogDisabledReasons /> : null}
      {/* IA4 (Stage 2): the clip and the file, in the composer and in a message. */}
      {attachmentPieces ? <CatalogAssistantAttachment /> : null}
      {/* DOC7-A: the pieces of a chart, the number with its change, the bars by period and the bars of a distribution. */}
      {chartPieces ? <CatalogCharts /> : null}
      {/* DS1-A and DS2-A (2026-11-19): the only piece to choose one or several options from a list. */}
      {pickerPieces ? <CatalogPickers /> : null}
      <Surface title={pieces.dialogs} padded actions={<>
        <Button variant="outline" onClick={() => setFormOpen(true)}>{pieces.modal}</Button>
        <DisabledReason reason={pieces.reason}><Button variant="outline" disabled>{pieces.export}</Button></DisabledReason>
      </>}>
        <div className="flex flex-wrap items-center gap-2">
          <IconButton label={pieces.edit} onClick={() => setFormOpen(true)}><PencilIcon className="size-4" /></IconButton>
          <IconButton label={pieces.disabled} disabledLabel={pieces.reason} disabled><PencilIcon className="size-4" /></IconButton>
        </div>
      </Surface>
      <section aria-label={text.tables}>
        <FilterBar><FilterChip removeLabel={text.remove} onRemove={() => {}}>{text.chip}</FilterChip></FilterBar>
        <Surface><DataTable columns={columns} rows={[{ id: "1", name: "Ana Pérez" }, { id: "2", name: "Juan Gómez" }]} rowKey={row => row.id} /></Surface>
      </section>
      <section aria-label={text.states} className="grid gap-4 md:grid-cols-3">
        <Surface><DataTable columns={columns} rows={[]} rowKey={row => row.id} isLoading /></Surface>
        <Surface><DataTable columns={columns} rows={[]} rowKey={row => row.id} emptyTitle={text.empty} /></Surface>
        <Surface><DataTable columns={columns} rows={[]} rowKey={row => row.id} error={text.problem} onRetry={() => {}} /></Surface>
      </section>
    </div>
    <ConfirmDialog open={confirm} onOpenChange={setConfirm} title={t("users:actions.delete")} description={text.name} confirmLabel={t("users:actions.delete")} onConfirm={() => {}} />
    {formOpen ? <Dialog open onOpenChange={setFormOpen}>
      <DialogContent mobileFullscreen={mobileDialog} onCloseAutoFocus={restoreFocus}>
        <DialogHeader><DialogTitle>{pieces.modalTitle}</DialogTitle><DialogDescription>{pieces.modalDescription}</DialogDescription></DialogHeader>
        <form className={mobileDialog ? "flex min-h-0 flex-1 flex-col gap-4" : "flex flex-col gap-4"} onSubmit={event => { event.preventDefault(); setFormOpen(false); notify({ id: "catalog:form", kind: "success", message: text.notice }); }}>
          <div className={mobileDialog ? "min-h-0 flex-1 space-y-4 overflow-y-auto" : "contents"}>
          <FormField label={text.name}><Input defaultValue="Ana Pérez" /></FormField>
          <FormField label={pieces.description}><Textarea defaultValue="" /></FormField>
          {mobileDialog ? Array.from({length:12},(_,index)=><p key={index} className="text-sm">{text.hint}</p>) : null}
          </div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => setFormOpen(false)}>{t("actions.cancel")}</Button><Button type="submit">{t("actions.save")}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog> : null}
  </Page>;
}
