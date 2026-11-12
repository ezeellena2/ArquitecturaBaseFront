// The grids of the dashboard (DOC7-A), measured by its own width and not the window's: the numbers, two in a row from a phone
// and four where they fit, and the cards, up to three, a period card across the whole row. The skeleton draws the same ones,
// and the page's wait the same frame: the bar, then the dashboard.
export const dashboardFrame = "flex flex-col";
export const dashboardStatGrid = "grid grid-cols-1 gap-3 @min-[20rem]:grid-cols-2 @min-[60rem]:grid-cols-4";
export const dashboardCardGrid = "grid grid-cols-1 gap-4 @min-[44rem]:grid-cols-2 @min-[66rem]:grid-cols-3";
