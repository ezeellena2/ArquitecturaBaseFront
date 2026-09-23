"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { Toaster as Sonner, type ToasterProps } from "sonner"

// Ediciones nuestras sobre el archivo generado; son las únicas diferencias con lo que genera shadcn:
// - El tema. La CLI lo ata al del sistema con `useTheme` de next-themes, pero la app tiene un solo tema, el claro,
//   y ningún ThemeProvider. Con el sistema en oscuro, sonner tomaba su tema oscuro sobre el fondo blanco de
//   `--popover` y la descripción quedaba en un gris casi blanco. `sonner.theme.test.tsx` se pone en rojo si vuelve.
// - Los textos que sonner trae en inglés y lee un lector de pantalla: el nombre de la región de los avisos
//   ("Notifications alt+T"; el atajo lo agrega él) y el del botón de cerrar un aviso ("Close toast").
//   `toastOptions` se mezcla en vez de pisarse, para que pasar otras opciones no se lleve la traducción.
//   `sonner.i18n.test.tsx` se pone en rojo si vuelven.
const Toaster = ({ toastOptions, ...props }: ToasterProps) => {
  const { t } = useTranslation()

  return (
    <Sonner
      theme="light"
      containerAriaLabel={t("notifications.label")}
      toastOptions={{ closeButtonAriaLabel: t("notifications.close"), ...toastOptions }}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
