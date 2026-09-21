import type { ReactNode } from "react";

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

export function ChevronLeftIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M14.5 5.5 8 12l6.5 6.5" />
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
