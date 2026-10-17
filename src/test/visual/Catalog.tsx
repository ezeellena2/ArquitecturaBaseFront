import { MessageCard } from "@/shared/ui/MessageCard";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Page } from "@/shared/ui/Page";
import { Surface } from "@/shared/ui/Surface";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { FormField } from "@/shared/ui/FormField";
import { NativeSelect } from "@/shared/ui/NativeSelect";
import { FilterBar } from "@/shared/ui/FilterBar";
import { FilterChip } from "@/shared/ui/FilterChip";
import { DataTable } from "@/shared/ui/DataTable";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { notify } from "@/shared/ui/notifications";
import { Textarea } from "@/shared/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { MultiSelect } from "@/shared/ui/MultiSelect";
import { CheckboxField } from "@/shared/ui/CheckboxField";
import { RadioGroupField } from "@/shared/ui/RadioGroupField";
import { SearchInput } from "@/shared/ui/SearchInput";
import { SegmentedControl } from "@/shared/ui/SegmentedControl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/Tabs";
import { IconButton } from "@/shared/ui/IconButton";
import { FormIcon, PencilIcon } from "@/shared/ui/icons";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { MessageBubble, MessageDateDivider, type MessageDeliveryState } from "@/shared/ui/MessageBubble";
import { MessageHistory } from "@/shared/ui/MessageHistory";

// Referencia local con componentes reales, no una segunda implementación visual.
export function Catalog() {
  const { t, i18n } = useTranslation(["common", "whatsapp"]);
  const formPieces = new URLSearchParams(location.search).get("scenario") === "form-controls";
  const tabPieces = new URLSearchParams(location.search).get("scenario") === "tabs";
  const [confirm, setConfirm] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [selection, setSelection] = useState<string[]>(["User"]);
  const [choice, setChoice] = useState("InviteOnly");
  const [checked, setChecked] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const restoreFocus = useRestoreFocusOnClose(formOpen);
  const english = i18n.language === "en";
  const text = english
    ? { title: "UI catalog", actions: "Actions", controls: "Fields", tables: "Table", states: "States", name: "Name", hint: "Use a name people can recognize.", invalid: "Enter a name.", status: "Status", empty: "No records yet", problem: "Content is unavailable", notice: "Changes saved", chip: "Active", remove: "Remove status filter" }
    : { title: "Catálogo de UI", actions: "Acciones", controls: "Campos", tables: "Tabla", states: "Estados", name: "Nombre", hint: "Usá un nombre que las personas reconozcan.", invalid: "Ingresá un nombre.", status: "Estado", empty: "Todavía no hay registros", problem: "No pudimos cargar el contenido", notice: "Guardamos los cambios", chip: "Activos", remove: "Quitar filtro de estado" };
  const columns = [{ id: "name", header: text.name, cell: (row: { id: string; name: string }) => row.name }];
  const pieces = english
    ? { description: "Description", role: "Role", roles: "Roles", choose: "Choose roles", registration: "Account registration", invited: "Invitation only", open: "Open registration", checkbox: "Send an invitation", disabled: "Unavailable action", reason: "This example is read-only.", edit: "Edit example", modal: "Open form", modalTitle: "Example form", modalDescription: "A short form using the shared dialog.", search: "Search by name", status: "Filter by status", all: "All", active: "Active", filters: "Filters", selection: "Selection", dialogs: "Dialogs and tooltips" }
    : { description: "Descripción", role: "Rol", roles: "Roles", choose: "Elegí roles", registration: "Registro de cuentas", invited: "Solo por invitación", open: "Registro abierto", checkbox: "Mandar una invitación", disabled: "Acción no disponible", reason: "Este ejemplo es de solo lectura.", edit: "Editar ejemplo", modal: "Abrir formulario", modalTitle: "Formulario de ejemplo", modalDescription: "Un formulario corto con el diálogo compartido.", search: "Buscar por nombre", status: "Filtrar por estado", all: "Todos", active: "Activos", filters: "Filtros", selection: "Selección", dialogs: "Modales y tooltips" };
  return <Page title={text.title} actions={<Button onClick={() => notify({ id: "catalog:notice", kind: "success", message: text.notice })}>{text.notice}</Button>}>
    <div className="flex flex-col gap-5">
      <Surface title={text.actions} padded>
        <div className="flex flex-wrap gap-2">
          <Button>{t("actions.save")}</Button><Button variant="outline">{t("actions.cancel")}</Button>
          <Button variant="ghost">{t("actions.close")}</Button><Button variant="destructive" onClick={() => setConfirm(true)}>{t("users:actions.delete")}</Button>
          <Button disabled>{t("actions.save")}</Button>
        </div>
      </Surface>
      <Surface title={text.controls} padded>
        <div className="grid gap-4 md:grid-cols-3">
          <FormField label={text.name} hint={text.hint}><Input defaultValue="Ana Pérez" /></FormField>
          <FormField label={text.status}><NativeSelect><option>{text.chip}</option></NativeSelect></FormField>
          <FormField label={text.name} error={text.invalid}><Input defaultValue="" /></FormField>
          <FormField label={pieces.description}><Textarea defaultValue={english ? "Account details." : "Datos de la cuenta."} /></FormField>
          <Select defaultValue="User"><FormField label={pieces.role}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger></FormField><SelectContent><SelectItem value="Admin">Admin</SelectItem><SelectItem value="User">User</SelectItem></SelectContent></Select>
          <FormField label={pieces.roles}><MultiSelect options={[{ value: "Admin", label: "Admin" }, { value: "User", label: "User" }]} value={selection} onChange={setSelection} placeholder={pieces.choose} /></FormField>
        </div>
      </Surface>
      <Surface title={pieces.selection} padded>
        <div className="grid gap-4 md:grid-cols-2">
          <RadioGroupField label={pieces.registration} value={choice} onValueChange={setChoice} options={[{ value: "InviteOnly", label: pieces.invited }, { value: "Open", label: pieces.open }]} />
          <CheckboxField label={pieces.checkbox} checked={checked} onCheckedChange={setChecked} />
        </div>
      </Surface>
      <section aria-label={pieces.filters}>
        <FilterBar className="flex flex-wrap items-center gap-2">
          <div className="w-80 max-w-full"><SearchInput value={search} onChange={setSearch} label={pieces.search} /></div>
          <SegmentedControl aria-label={pieces.status} options={[{ key: "all", label: pieces.all, pressed: filter === "all", onSelect: () => setFilter("all") }, { key: "active", label: pieces.active, pressed: filter === "active", onSelect: () => setFilter("active") }]} />
        </FilterBar>
      </section>
      <Surface title={english ? "Conversation messages" : "Mensajes de conversación"}>
        <MessageHistory label={english ? "Message examples" : "Ejemplos de mensajes"}>
          <MessageDateDivider date="2026-10-02" label={english ? "Oct 2, 2026" : "2 oct 2026"} />
          <MessageBubble direction="incoming" text={english ? "Hi, can you help me?" : "Hola, ¿me ayudás?"} timestamp="2026-10-02T12:00:00Z" timeLabel="9:00" dateLabel={english ? "Oct 2, 2026, 9:00 AM" : "2 oct 2026, 9:00"} />
          {(["pending", "sent", "delivered", "read", "failed", "uncertain", "reviewed", "unknown"] satisfies MessageDeliveryState[]).map(state =>
            <MessageBubble key={state} direction="outgoing" text={english ? "An example reply." : "Una respuesta de ejemplo."}
              timestamp="2026-10-02T12:01:00Z" timeLabel="9:01" dateLabel={english ? "Oct 2, 2026, 9:01 AM" : "2 oct 2026, 9:01"}
              delivery={{ state, label: ({ pending: t("whatsapp:status.Pending"), sent: t("whatsapp:status.Sent"), delivered: t("whatsapp:status.Delivered"),
                read: t("whatsapp:status.Read"), failed: t("whatsapp:status.Failed"), uncertain: t("whatsapp:status.Uncertain"),
                reviewed: t("whatsapp:status.Reviewed"), unknown: t("whatsapp:status.Unknown") })[state] }} />)}
        </MessageHistory>
      </Surface>
      {formPieces ? <Surface title={english ? "Form controls" : "Controles de formularios"} padded>
        <div className="flex flex-col gap-4">
          <RadioGroupField label={english ? "Choose a card" : "Elegí una tarjeta"} variant="cards" value={choice} onValueChange={setChoice} options={[{value:"InviteOnly",label:english ? "First card" : "Primera tarjeta",description:english ? "A shared selectable row." : "Una fila seleccionable común."},{value:"Open",label:english ? "Second card" : "Segunda tarjeta",description:english ? "Keyboard keeps the same radio behavior." : "Conserva el teclado del control de opción."}]} />
          <MessageBubble direction="outgoing" text={english ? "An attached card." : "Una tarjeta adjunta."} attachment={<MessageCard icon={<FormIcon className="size-4" />} title={english ? "Example attachment" : "Adjunto de ejemplo"} description={english ? "A title and description inside the message." : "Título y descripción dentro del mensaje."} />} timestamp="2026-10-02T12:00:00Z" timeLabel="9:00" dateLabel={english ? "Oct 2, 2026, 9:00 AM" : "2 oct 2026, 9:00"} delivery={{state:"pending",label:t("whatsapp:status.Pending")}} />
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
      <Surface title={pieces.dialogs} padded>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setFormOpen(true)}>{pieces.modal}</Button>
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
      <DialogContent onCloseAutoFocus={restoreFocus}>
        <DialogHeader><DialogTitle>{pieces.modalTitle}</DialogTitle><DialogDescription>{pieces.modalDescription}</DialogDescription></DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={event => { event.preventDefault(); setFormOpen(false); notify({ id: "catalog:form", kind: "success", message: text.notice }); }}>
          <FormField label={text.name}><Input defaultValue="Ana Pérez" /></FormField>
          <FormField label={pieces.description}><Textarea defaultValue="" /></FormField>
          <DialogFooter><Button type="button" variant="outline" onClick={() => setFormOpen(false)}>{t("actions.cancel")}</Button><Button type="submit">{t("actions.save")}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog> : null}
  </Page>;
}
