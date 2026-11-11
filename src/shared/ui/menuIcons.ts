import type { ComponentType } from "react";
import { CalendarIcon, ChartIcon, ClipboardIcon, FileIcon, FolderIcon, LeafIcon, PackageIcon, ReceiptIcon, StoreIcon, TruckIcon, UsersIcon, WrenchIcon } from "./icons";

/// The twelve generic icons of a menu of its own (CP5-A, 2026-11-04), in the order they are offered: the folder first, which is
/// also the one by default. The names are the ones the server stores; what each one is called is up to whoever offers them.
export const menuIconNames = ["folder", "truck", "package", "receipt", "users", "calendar", "clipboard", "chart", "wrench", "store", "leaf", "file"] as const;
export type MenuIconName = (typeof menuIconNames)[number];

export const menuIcons: Readonly<Record<MenuIconName, ComponentType<{ className?: string }>>> = {
  folder: FolderIcon, truck: TruckIcon, package: PackageIcon, receipt: ReceiptIcon, users: UsersIcon, calendar: CalendarIcon,
  clipboard: ClipboardIcon, chart: ChartIcon, wrench: WrenchIcon, store: StoreIcon, leaf: LeafIcon, file: FileIcon,
};

export function isMenuIconName(value: string): value is MenuIconName {
  return (menuIconNames as readonly string[]).includes(value);
}
