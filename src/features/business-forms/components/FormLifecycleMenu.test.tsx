import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { fixtureLifecycle } from "@/test/visual/formFixtures";
import { FormLifecycleMenu } from "./FormLifecycleMenu";
it("lets keyboard users read unavailable action reasons without executing or closing them",async()=>{
 const onDeactivate=vi.fn();const onDelete=vi.fn();renderWithProviders(<FormLifecycleMenu lifecycle={fixtureLifecycle(1,{canDeactivate:false,unavailableReason:"PublicationInProgress",canDelete:false,deletionUnavailableReason:"OpenSends"})} blocked={false} canManage canPublish onDeactivate={onDeactivate} onReactivate={vi.fn()} onDelete={onDelete}/>);
 const trigger=await screen.findByRole("button",{name:"Acciones del formulario"});act(()=>trigger.focus());await userEvent.keyboard("{Enter}");const menu=await screen.findByRole("menu");const deactivation=within(menu).getByRole("menuitem",{name:/Dar de baja/});const deletion=within(menu).getByRole("menuitem",{name:/Eliminar/});
 await userEvent.keyboard("{Home}");await waitFor(()=>expect(deactivation).toHaveFocus());expect(deactivation).toHaveAttribute("aria-disabled","true");expect(deactivation).toHaveTextContent("Hay una publicación en curso.");await userEvent.keyboard("{Enter}");expect(onDeactivate).not.toHaveBeenCalled();expect(menu).toBeVisible();
 await userEvent.keyboard("{End}");await waitFor(()=>expect(deletion).toHaveFocus());expect(deletion).toHaveAttribute("aria-disabled","true");expect(deletion).toHaveTextContent("Tiene envíos vigentes o respuestas en proceso.");await userEvent.keyboard("{Enter}");expect(onDelete).not.toHaveBeenCalled();expect(menu).toBeVisible();await userEvent.keyboard("{Escape}");await waitFor(()=>expect(trigger).toHaveFocus());
});
