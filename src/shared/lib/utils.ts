// Los componentes que baja la CLI de shadcn importan cn del paquete del mismo nombre (shadcn-ui/cn), así que
// acá se reexporta en vez de mantener una segunda implementación con clsx + tailwind-merge: una sola forma de
// combinar clases en todo el proyecto. El alias @/shared/lib/utils queda como el punto de entrada de siempre.
export { cn } from "cn";
