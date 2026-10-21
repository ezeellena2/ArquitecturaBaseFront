import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, expect, it, vi } from "vitest";
import { currentUser } from "@/test/mocks/handlers";
import { server } from "@/test/mocks/server";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import { queryClient } from "@/shared/api/queryClient";
import { approvalTaskFixture, approvalTaskId } from "@/test/approvalFixtures";
import { responseFormId, responseSecondId, responseSheetFixture, responseDetailFixture, responseWorkflowFixture } from "@/test/responseFixtures";

vi.mock("react-oidc-context", async () => ({ ...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"),
  useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "test" } }) }));
const secondTaskId = "0199a0c0-0000-7000-8000-000000000071";
function setup(read: boolean) {
 const tasks = [approvalTaskFixture(), { ...approvalTaskFixture(), id: secondTaskId, recordId: responseSecondId, number: "VIS-00002", requestedAtUtc: "2026-10-16T13:00:00Z" }];
 const reads = { records: 0, workflow: 0, options: 0, lists: [] as URL[] };
 server.use(http.get("/api/me",()=>HttpResponse.json({...currentUser,permissions:["formapprovals.decide",...(read?["formrecords.read"]:[])]})),
  http.get("/api/forms/approvals/count",()=>HttpResponse.json({count:2})),
  http.get("/api/forms/approvals/options",()=>{reads.options++;return HttpResponse.json({forms:[]});}),
  http.get("/api/forms/approvals",({request})=>{reads.lists.push(new URL(request.url));return HttpResponse.json({items:tasks,page:1,pageSize:20,totalCount:2,totalPages:1,hasPrevious:false,hasNext:false});}),
  http.get("/api/forms/approvals/:id",({params})=>HttpResponse.json(tasks.find(task=>task.id===params.id))),
  http.post("/api/forms/definitions/:id/records/search",()=>{reads.records++;return HttpResponse.json(responseSheetFixture());}),
  http.get("/api/forms/records/:id",({params})=>{reads.records++;return HttpResponse.json(responseDetailFixture(String(params.id)));}),
  http.get("/api/forms/records/:id/workflow",({params})=>{reads.workflow++;return HttpResponse.json(responseWorkflowFixture(String(params.id)));}));
 return {tasks,reads};
}
beforeEach(()=>queryClient.clear());

it("lets a decision-only user review that form's oldest-first queue without reading values or options",async()=>{
 const {reads}=setup(false);
 const {router}=renderRouteWithProviders("/formularios/"+responseFormId+"/respuestas");
 const pending=await screen.findByRole("region",{name:"Por aprobar · 2"});
 expect(screen.getByRole("heading", {name:"Visita", level:1})).toBeVisible();
 expect(within(screen.getByRole("navigation",{name:"Migas de pan"})).getByText("Visita")).toBeVisible();
 expect(within(pending).getAllByRole("link",{name:/Revisar VIS/}).map(link=>link.getAttribute("aria-label"))).toEqual(["Revisar VIS-00001","Revisar VIS-00002"]);
 await userEvent.click(within(pending).getByRole("link",{name:"Revisar VIS-00001"}));
 let panel=await screen.findByRole("region",{name:"Detalle de la respuesta"});
 expect(await within(panel).findByRole("button",{name:"Aprobar"})).toBeVisible();
 expect(panel).not.toHaveTextContent("Importe");
 expect(router.state.location.search).toContain("approval="+approvalTaskId);
 expect(within(panel).getByText("1 de 2 por aprobar")).toBeVisible();
 await userEvent.keyboard("{ArrowDown}");
 await waitFor(()=>expect(router.state.location.search).toContain("approval="+secondTaskId));
 panel=screen.getByRole("region",{name:"Detalle de la respuesta"});
 await waitFor(()=>expect(panel).toHaveTextContent("VIS-00002"));
 await userEvent.keyboard("{Escape}");
 await waitFor(()=>expect(screen.queryByRole("region",{name:"Detalle de la respuesta"})).not.toBeInTheDocument());
 expect(screen.getByRole("link",{name:"Revisar VIS-00002"})).toHaveFocus();
 expect(reads.records).toBe(0);expect(reads.workflow).toBe(0);expect(reads.options).toBe(0);
 expect(reads.lists.every(url=>url.searchParams.get("definitionId")===responseFormId&&url.searchParams.get("onlyMine")==="true")).toBe(true);
});

it("places the same pending section above the readable sheet and opens the real response owner",async()=>{
 const {reads}=setup(true);
 renderRouteWithProviders("/formularios/"+responseFormId+"/respuestas");
 const pending=await screen.findByRole("region",{name:"Por aprobar · 2"});
 expect(await screen.findByRole("columnheader",{name:"Importe"})).toBeVisible();
 await userEvent.click(within(pending).getByRole("link",{name:"Revisar VIS-00001"}));
 const panel=await screen.findByRole("region",{name:"Detalle de la respuesta"});
 expect(await within(panel).findByText("Importe")).toBeVisible();
 expect(reads.workflow).toBe(1);expect(reads.options).toBe(0);
});

it("does not expose per-form approval data to a response-only reader",async()=>{
 const {reads}=setup(false);
 server.use(http.get("/api/me",()=>HttpResponse.json({...currentUser,permissions:["formrecords.read"]})));
 renderRouteWithProviders("/formularios/"+responseFormId+"/respuestas");
 await screen.findByRole("columnheader",{name:"Importe"});
 expect(screen.queryByRole("region",{name:/Por aprobar/})).not.toBeInTheDocument();
 expect(reads.lists).toHaveLength(0);
});
