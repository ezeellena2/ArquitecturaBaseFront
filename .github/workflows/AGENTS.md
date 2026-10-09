# Workflows del front

Un push a main solicita el workflow del backend, que obtiene ambos repositorios y publica una sola imagen. La guía operativa compartida está en [azure-dev.md](../../../ArquitecturaBase/docs/deploy/azure-dev.md).

## Al modificar

- Conservá un solo origen y un solo responsable del despliegue: el backend incluye todo dist en wwwroot, con silent-renew.html.
- DEV_DEPLOY_ENABLED es una variable de repositorio. BACKEND_WORKFLOW_TOKEN es un secret con Actions: write limitado al backend; el GITHUB_TOKEN propio no autoriza escrituras entre repositorios.
- No incluir credenciales en YAML ni logs. Una solicitud exitosa no acredita un despliegue: su resultado está en Actions del backend.
- No publicar desde pull requests. Actualizá la guía compartida y el mapa del front junto a cambios de responsabilidad.
