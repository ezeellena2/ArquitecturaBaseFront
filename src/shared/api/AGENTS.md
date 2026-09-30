# Shared API: transporte y contratos reutilizados

`httpClient` agrega token e idioma, coordina renovación y transforma ProblemDetails en `ApiError`. Los otros archivos comparten contratos y endpoints entre áreas.

## Al modificar

- Toda llamada al backend pasa por `api`; consultas y mutaciones se coordinan con TanStack Query.
- Los errores se deciden por `code`, nunca por el texto; conservá extensiones de ProblemDetails y errores por campo.
- Conservá tratamiento de respuestas sin cuerpo, errores de red, renovación única y expiración de sesión; no duplicar `fetch` en una pantalla.
- Un endpoint usado por varias features vive acá; uno exclusivo queda en `features/<área>/api`.
- Mantené claves de consultas e invalidaciones coherentes con listas, conteos, detalle y usuario actual.
- El transporte no notifica. La interpretación técnica y el dueño global/local de consultas
  siguen el contrato común; `silent` no autoriza ocultar un error operativo. Los tests de la
  política conservan el mismo manejador del QueryClient productivo.

## Referencias

- [Datos, errores y mutaciones](../../../docs/architecture.md).
- [Tests del transporte](httpClient.test.ts).
- [Error común](ApiError.ts).
- [Contrato de mensajes y estados](../../../docs/guides/mensajes-y-estados.md).
