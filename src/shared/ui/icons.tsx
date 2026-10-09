import type { ReactNode } from "react";

// El acceso público conserva los dibujos Lucide de su diseño aprobado. También
// se consumen desde este módulo, para que una feature no arme otro set propio.
export { ArrowLeft as PublicBackIcon, Mail as PublicMailIcon, MessageCircle as PublicWhatsAppIcon } from "lucide-react";
export { FolderOpen as PublicInformationIcon, Users as PublicTeamIcon, ListChecks as PublicTrackingIcon } from "lucide-react";

interface IconProps {
  className?: string;
}

/// Íconos propios en SVG inline para el layout (sección 7.2): mismo trazo para todo el set, sin depender de
/// un paquete de íconos. Son decorativos (aria-hidden): el texto accesible lo pone quien los usa (el label
/// del ítem de navegación, el aria-label del botón).
function Icon({ className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

export function HomeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3.75 10.5 12 3.75l8.25 6.75" />
      <path d="M5.25 9v10.5h13.5V9" />
      <path d="M9.75 19.5V13.5h4.5v6" />
    </Icon>
  );
}

export function UsersIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19.5a5.5 5.5 0 0 1 11 0" />
      <path d="M16 8.25a2.75 2.75 0 1 1 0 5.5" />
      <path d="M14.75 14.75c2.7.2 4.75 2.1 5.25 4.75" />
    </Icon>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3.5 5 6v5.5C5 16 8 19.5 12 20.5c4-1 7-4.5 7-9V6l-7-2.5Z" />
      <path d="m9.25 12 2 2 3.5-4" />
    </Icon>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 6.5h16" />
      <path d="M4 12h16" />
      <path d="M4 17.5h16" />
    </Icon>
  );
}

export function ArrowUpIcon(props: IconProps) {
  return <Icon {...props}><path d="M12 19V5m-6 6 6-6 6 6" /></Icon>;
}

export function CopyIcon(props: IconProps) {
  return <Icon {...props}><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></Icon>;
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M14.5 5.5 8 12l6.5 6.5" />
    </Icon>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />
    </Icon>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5.5 8.5 12 15l6.5-6.5" />
    </Icon>
  );
}

export function RefreshIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
      <path d="M14 6h4v4" />
    </Icon>
  );
}

export function LogOutIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9 20H5.5A1.5 1.5 0 0 1 4 18.5v-13A1.5 1.5 0 0 1 5.5 4H9" />
      <path d="M14 15.5 19 12l-5-3.5" />
      <path d="M19 12H9" />
    </Icon>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="3.25" />
      <path d="M12 2.75v2" />
      <path d="M12 19.25v2" />
      <path d="M21.25 12h-2" />
      <path d="M4.75 12h-2" />
      <path d="m18.55 5.45-1.4 1.4" />
      <path d="m6.85 17.15-1.4 1.4" />
      <path d="m18.55 18.55-1.4-1.4" />
      <path d="m6.85 6.85-1.4-1.4" />
    </Icon>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  );
}

/// Preferencias generales: controles de ajuste, distintos del grupo Configuración.
export function PreferencesIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 6h4m4 0h8M4 12h10m4 0h2M4 18h2m4 0h10" />
      <circle cx="10" cy="6" r="2" />
      <circle cx="16" cy="12" r="2" />
      <circle cx="8" cy="18" r="2" />
    </Icon>
  );
}

/// Apariencia: paleta de colores del sistema.
export function PaletteIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3.5a8.5 8.5 0 1 0 0 17h1a2 2 0 0 0 1.5-3.3 1.5 1.5 0 0 1 1.1-2.5H18a3 3 0 0 0 3-3C21 7.1 17 3.5 12 3.5Z" />
      <circle cx="7.5" cy="11" r=".75" />
      <circle cx="10" cy="7.5" r=".75" />
      <circle cx="14" cy="7.5" r=".75" />
      <circle cx="17" cy="10.5" r=".75" />
    </Icon>
  );
}

export function PowerIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 4v7.5" />
      <path d="M17.7 7.3a8 8 0 1 1-11.4 0" />
    </Icon>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4.5 7h15" />
      <path d="M9.5 7V5.5A1.5 1.5 0 0 1 11 4h2a1.5 1.5 0 0 1 1.5 1.5V7" />
      <path d="m6.8 7 .8 11.1a1.5 1.5 0 0 0 1.5 1.4h5.8a1.5 1.5 0 0 0 1.5-1.4L17.2 7" />
    </Icon>
  );
}

export function PencilIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M15.5 5.5 18.5 8.5 9 18H6v-3z" />
      <path d="m13.75 7.25 3 3" />
    </Icon>
  );
}

/// Mirar sin cambiar: la acción de lo que se abre de solo lectura (Admin, en el listado de roles). Es el ojo del
/// tablero "Roles · Acciones del listado": el contorno en un solo trazo y la pupila, sin relleno.
export function EyeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2.75 12S6.25 5.75 12 5.75 21.25 12 21.25 12 17.75 18.25 12 18.25 2.75 12 2.75 12Z" />
      <circle cx="12" cy="12" r="2.75" />
    </Icon>
  );
}

/// Los filtros. Tres líneas de distinto largo: se lee como "acotar" sin depender de un embudo, que a este
/// tamaño queda como una mancha.
export function SlidersIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4.5 6.5h15" />
      <path d="M7.5 12h9" />
      <path d="M10.5 17.5h3" />
    </Icon>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 3.5 3.5" />
    </Icon>
  );
}

export function UserIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5.5 19.5a6.5 6.5 0 0 1 13 0" />
    </Icon>
  );
}

/// Algo que venció: el enlace del chat que ya no sirve (tablero "WhatsApp · El enlace del chat").
export function ClockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.25" />
      <path d="M12 7.5V12l3 2" />
    </Icon>
  );
}

/// Algo que no se puede hacer: una cuenta que no puede entrar (tablero "WhatsApp · El enlace del chat").
export function BanIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.25" />
      <path d="m6.2 6.2 11.6 11.6" />
    </Icon>
  );
}

/// El correo, en la fila de los medios de ingreso del perfil (tablero "WhatsApp · Perfil: correo y WhatsApp").
export function MailIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <path d="m4 7 8 6 8-6" />
    </Icon>
  );
}

/// Un celular: el número de WhatsApp, en la fila de los medios de ingreso del perfil.
export function SmartphoneIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="7" y="3" width="10" height="18" rx="2" />
      <path d="M11 17.5h2" />
    </Icon>
  );
}

/// Algo comprobado: la insignia "Verificado".
export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 12.5 10 17.5 19 7" />
    </Icon>
  );
}

/// Dos tildes: un mensaje de WhatsApp que llegó ("Entregada") o que se leyó ("Leída"), en la franja de la última
/// invitación (tablero "Editar usuario · B"). Es la marca que la persona ya conoce de WhatsApp.
export function CheckCheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m2.5 12.5 4.5 4.5 9-10" />
      <path d="m12 16 1 1 9-10" />
    </Icon>
  );
}

/// El avión de papel: un envío, como la invitación de una cuenta (tablero "Editar usuario · B").
export function SendIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M20.5 3.5 10.5 13.5" />
      <path d="M20.5 3.5 14 20.5l-3.5-7-7-3.5Z" />
    </Icon>
  );
}

/// Un aviso que informa (`Banner`): una condición que sigue vigente.
export function InfoIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.25" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </Icon>
  );
}

/// Un aviso de error (`Banner` con `tone="danger"`).
export function AlertCircleIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.25" />
      <path d="M12 8v5" />
      <path d="M12 16h.01" />
    </Icon>
  );
}

/// Una advertencia (`Banner` con `tone="warning"`): algo que se puede hacer igual, pero que tiene una consecuencia que
/// conviene saber antes. El triángulo del tablero "WhatsApp · Usuarios: alta con teléfono".
export function AlertTriangleIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 4 3 19.5h18Z" />
      <path d="M12 10v4" />
      <path d="M12 17h.01" />
    </Icon>
  );
}
