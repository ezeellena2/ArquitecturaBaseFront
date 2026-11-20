import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { timeZoneOptions } from "@/shared/lib/timeZones";
import { FormField } from "@/shared/ui/FormField";
import { Picker, type PickerOption } from "@/shared/ui/Picker";
import { Surface } from "@/shared/ui/Surface";

// DS1-A and DS2-A (2026-11-19): the only piece to choose from a list, with the states of the boards «DS1-A · Un botón que
// abre la lista; el buscador, adentro» and «DS2-A · Los nombres y «y 2 más» si no entran». Synthetic data, as in the boards.
const places = ["DON PEDRO", "EL OMBÚ", "EL TALA", "LA CELINA", "LA ESPERANZA", "LOS ÁLAMOS", "SAN JOSÉ", "SANTA ANA", "SANTA ROSA",
  "TRES ARROYOS", "VILLA ELISA", "ZAPALLAR", "EL CARDO", "EL CEIBO", "EL MOLINO", "EL PALENQUE", "EL RECREO", "LA AURORA", "LA BLANCA",
  "LA CHACRA", "LA DORMIDA", "LA ELENA", "LA FLORIDA", "LA GLORIA", "LA HERRADURA", "LA JUANITA", "LA LUCÍA", "LA MARÍA", "LA NEGRA",
  "LA PAZ", "LA QUERENCIA", "LA ROSADA", "LAS ACACIAS", "LAS LILAS", "LOS CARDALES", "LOS NOGALES", "MONTE GRANDE", "SAN MIGUEL"]
  .sort((a, b) => a.localeCompare(b, "es")).map(label => ({ id: label.toLowerCase(), label }));
const people = Array.from({ length: 50 }, (_, index) => ({ id: `p${index + 1}`, label: `Persona ${String(index + 1).padStart(2, "0")}`, description: `persona${index + 1}@ejemplo.com` }));

const copy = {
  es: {
    title: "Elegir de una lista", roles: "Roles", noRoles: "Sin roles", place: "Campo asignado", noPlace: "Sin campo asignado", zone: "Zona",
    noZone: "Sin zona", timeZone: "Zona horaria", value: "Valor", crop: "Cultivo", choose: "Elegí", role: "Rol", anyRole: "Cualquier rol",
    person: "Persona", status: "Estado", up: "Hasta 2",
    roleList: [
      ["Admin", null], ["Agrónomo", null], ["Asistente sin chats", "Configura el asistente de WhatsApp sin ver los chats."],
      ["Encargado de campo", "Carga los formularios desde el campo."], ["Mesa de ayuda", "Da de alta y edita cuentas, sin tocar los roles."],
      ["Reglas sin respuestas", "Administra las reglas y el PDF sin ver las respuestas."], ["Roles", "Crea y edita roles, sin administrar cuentas."], ["User", null],
    ],
    zones: ["Norte", "Sur", "Este", "Oeste"], crops: ["Soja 1ª", "Soja 2ª", "Maíz 1ª", "Maíz 2ª", "Trigo", "Girasol"],
    states: ["Activo", "Dado de baja", "Vencido"], retired: "No se puede elegir: ya no se usa.",
  },
  en: {
    title: "Choosing from a list", roles: "Roles", noRoles: "No roles", place: "Assigned field", noPlace: "No assigned field", zone: "Zone",
    noZone: "No zone", timeZone: "Time zone", value: "Value", crop: "Crop", choose: "Choose", role: "Role", anyRole: "Any role",
    person: "Person", status: "Status", up: "Up to 2",
    roleList: [
      ["Admin", null], ["Agronomist", null], ["Assistant without chats", "Sets up the WhatsApp assistant without seeing the chats."],
      ["Field manager", "Loads the forms from the field."], ["Help desk", "Adds and edits accounts, without touching the roles."],
      ["Rules without answers", "Manages the rules and the PDF without seeing the answers."], ["Roles", "Creates and edits roles, without managing accounts."], ["User", null],
    ],
    zones: ["North", "South", "East", "West"], crops: ["Soy 1st", "Soy 2nd", "Corn 1st", "Corn 2nd", "Wheat", "Sunflower"],
    states: ["Active", "Retired", "Expired"], retired: "It cannot be chosen: it is no longer used.",
  },
} as const;

const toOptions = (labels: readonly string[]) => labels.map((label, index) => ({ id: String(index), label }));

export function CatalogPickers() {
  const { i18n } = useTranslation();
  const text = i18n.language === "en" ? copy.en : copy.es;
  const roles = text.roleList.map(([label, description], index): PickerOption => ({ id: String(index), label, description }));
  const [chosenRoles, setChosenRoles] = useState<string[]>(["3", "7"]);
  const [place, setPlace] = useState<string | null>("la esperanza");
  const [zone, setZone] = useState<string | null>(null);
  const [timeZone, setTimeZone] = useState<string | null>("America/Montevideo");
  const zones = useMemo(() => timeZoneOptions(i18n.language, [timeZone]), [i18n.language, timeZone]);
  const [crops, setCrops] = useState<string[]>(["0", "2", "4"]);
  const [role, setRole] = useState<string | null>("");
  const [state, setState] = useState<string[]>(["0"]);
  const [search, setSearch] = useState("");
  const [person, setPerson] = useState<string | null>(null);
  const found = people.filter(item => item.label.toLowerCase().includes(search.trim().toLowerCase()));
  return <Surface title={text.title} padded>
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 md:grid-cols-3">
        <FormField label={text.roles}><Picker label={text.roles} multiple options={roles} value={chosenRoles} onChange={setChosenRoles} placeholder={text.noRoles}/></FormField>
        <FormField label={text.place}><Picker label={text.place} options={places} value={place} onChange={setPlace} first={{ id: "", label: text.noPlace }} placeholder={text.noPlace}/></FormField>
        <FormField label={text.zone}><Picker label={text.zone} options={toOptions(text.zones)} value={zone} onChange={setZone} placeholder={text.noZone}/></FormField>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <FormField label={text.timeZone}><Picker label={text.timeZone} options={zones} value={timeZone} onChange={setTimeZone}/></FormField>
        <div className="w-44"><FormField label={text.value}><Picker label={text.value} multiple options={toOptions(text.crops)} value={crops} onChange={setCrops} placeholder={text.choose}/></FormField></div>
        <FormField label={text.status}><Picker label={text.status} multiple max={2} value={state} onChange={setState} placeholder={text.choose}
          options={text.states.map((label, index) => ({ id: String(index), label, disabledReason: index === 2 ? text.retired : null }))}/></FormField>
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <Picker label={text.role} trigger="button" first={{ id: "", label: text.anyRole }} options={roles} value={role} onChange={setRole}/>
        <div className="w-72"><FormField label={text.person}><Picker label={text.person} options={found.slice(0, 20)} value={person} onChange={setPerson} search={search}
          onSearchChange={setSearch} total={found.length} onLoadMore={found.length > 20 ? () => {} : undefined} placeholder={text.choose}/></FormField></div>
      </div>
    </div>
  </Surface>;
}
