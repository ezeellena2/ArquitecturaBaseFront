# Src: aplicación React

`app` compone la aplicación; `auth` maneja sesión y permisos; `layouts` contiene el caparazón; `features` agrupa producto; `shared` comparte mecanismos y UI; `locales` traduce; `test` contiene el arnés.

## Al modificar

- Leé la guía canónica y las instrucciones de la carpeta antes de programar. Un área no importa otra feature; lo reutilizable sube a `shared`.
- `index.css` define tokens globales y tipografía; ninguna feature trae una paleta propia.
- Usá TypeScript estricto e imports de tipos. Datos del servidor con TanStack Query y el cliente común; textos con i18next.
- Un cambio visual sigue primero el diseño aprobado y la biblioteca; no introducir componentes locales equivalentes a los compartidos.

## Referencias

- [Reglas canónicas del front](../docs/architecture.md).
- [Contrato visual](../docs/design/visual-baseline.md).
- [Mapa de instrucciones](../docs/mapa-de-instrucciones.md).
