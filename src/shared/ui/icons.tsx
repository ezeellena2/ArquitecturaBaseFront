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

export function LogOutIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9 20H5.5A1.5 1.5 0 0 1 4 18.5v-13A1.5 1.5 0 0 1 5.5 4H9" />
      <path d="M14 15.5 19 12l-5-3.5" />
      <path d="M19 12H9" />
    </Icon>
  );
}
