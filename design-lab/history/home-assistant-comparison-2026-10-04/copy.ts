export const language = new URLSearchParams(location.search).get('lang') === 'en' ? 'en' : 'es';
export const labels = language === 'es' ? {
  title:'Inicio', lab:'Comparación de bibliotecas', simulated:'Datos ficticios', empty:'Primera consulta', answer:'Conversación',
  history:'Historial', newChat:'Nueva conversación', greeting:'¿Qué querés consultar?', intro:'Datos, permisos y ayuda de tu sistema.',
  placeholder:'Preguntale al sistema…', send:'Enviar', stop:'Detener', footer:'Las respuestas de esta maqueta son simuladas.',
  users:'¿Cuántos usuarios activos hay?', roles:'¿Qué permisos tiene Soporte?', help:'¿Cómo asigno un rol?',
  source:'Usuarios · datos ficticios · consultado a las 10:24', close:'Cerrar', today:'Hoy', historyTitle:'Tus conversaciones',
  copy:'Copiar respuesta', copied:'Copiada', sourceAction:'Ver datos', check:'Consultar estado', retry:'Generar otra respuesta',
  failure:'No pudimos cargar la conversación', uncertain:'La respuesta quedó sin confirmar', uncertainHelp:'Consultá el estado antes de generar otra respuesta.',
  unavailable:'Vista no disponible', loadError:'No pudimos cargar este ejemplo.', retryLoad:'Reintentar',
  clearTitle:'¿Empezar otra conversación?', clearHelp:'Se perderá la pregunta que todavía no enviaste.', cancel:'Seguir escribiendo',
  followup:'¿Y qué permisos tiene el rol Soporte?',
  usersAnswer:'Hay **3 usuarios activos** de un total de 4.\n\n- **Activos:** 3\n- **Inactivos:** 1\n- **Total:** 4\n\nConsulté las cuentas visibles para tu usuario, excluyendo las eliminadas.\n\n**Fuente:** Usuarios · consulta simulada a las 10:24.',
  rolesAnswer:'El rol **Soporte** tiene estos permisos:\n\n- Ver usuarios\n- Ver roles\n\nPuede consultar esas secciones. Para modificarlas necesita permisos adicionales.\n\n**Fuente:** Roles y permisos · datos ficticios.',
  helpAnswer:'Abrí **Usuarios**, elegí la cuenta y editá sus roles. Seleccioná el rol y guardá. Necesitás permiso para administrar usuarios.',
  clarify:'¿Qué dato necesitás consultar? En esta maqueta podés probar usuarios, permisos de Soporte o ayuda para asignar roles.',
} : {
  title:'Home', lab:'Chat library comparison', simulated:'Fictional data', empty:'First question', answer:'Conversation',
  history:'History', newChat:'New conversation', greeting:'What would you like to know?', intro:'Your system’s data, permissions and help.',
  placeholder:'Ask your system…', send:'Send', stop:'Stop', footer:'Answers in this prototype are simulated.',
  users:'How many active users are there?', roles:'What permissions does Support have?', help:'How do I assign a role?',
  source:'Users · fictional data · checked at 10:24', close:'Close', today:'Today', historyTitle:'Your conversations',
  copy:'Copy answer', copied:'Copied', sourceAction:'View data', check:'Check status', retry:'Generate another answer',
  failure:'We could not load the conversation', uncertain:'The answer could not be confirmed', uncertainHelp:'Check its status before generating another answer.',
  unavailable:'Preview unavailable', loadError:'We could not load this example.', retryLoad:'Try again',
  clearTitle:'Start another conversation?', clearHelp:'The question you have not sent yet will be lost.', cancel:'Keep writing',
  followup:'And what permissions does the Support role have?',
  usersAnswer:'There are **3 active users** out of 4 accounts.\n\n- **Active:** 3\n- **Inactive:** 1\n- **Total:** 4\n\nI checked the accounts visible to your user, excluding deleted accounts.\n\n**Source:** Users · simulated query at 10:24.',
  rolesAnswer:'The **Support** role has these permissions:\n\n- View users\n- View roles\n\nIt can view these sections. Changes require additional permissions.\n\n**Source:** Roles and permissions · fictional data.',
  helpAnswer:'Open **Users**, select an account and edit its roles. Select the role and save. You need permission to manage users.',
  clarify:'What would you like to check? In this prototype you can try users, Support permissions or help with assigning roles.',
};
export type LabMessage = { id:string; role:'user'|'assistant'; content:string };
export const exampleMessages: LabMessage[] = [
  {id:'user-1',role:'user',content:labels.users},
  {id:'assistant-1',role:'assistant',content:labels.usersAnswer},
];
export function answerFor(text:string) {
  return /soporte|support|permiso|permission/i.test(text) ? labels.rolesAnswer : /cuánt|many|activ/i.test(text) ? labels.usersAnswer : /asign|assign|rol|role/i.test(text) ? labels.helpAnswer : labels.clarify;
}
