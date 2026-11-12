/** The dashboards of a form (DOC7-A), under the reader of responses: its actor, culture and permissions. Apart from the hook, so
 * the sheet can read them again without loading the dashboard. */
export const formDashboardKeyRoot = (owner: string, formId: string) => ["form-responses", owner, "dashboard", formId] as const;
