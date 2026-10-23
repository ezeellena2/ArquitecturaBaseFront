import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { ApiError } from "@/shared/api/ApiError";
import { createQueryClient } from "@/shared/api/queryClient";
import { fetchPersonAttributes, fetchPersonData, savePersonData } from "../api/personData";
import { usePersonData } from "./usePersonData";
vi.mock("../api/personData", () => ({ fetchPersonAttributes: vi.fn(), fetchPersonData: vi.fn(), savePersonData: vi.fn() }));
const attribute = { id: "01990000-0000-7000-8000-000000000001", key: "branch", name: { es: "Sucursal" }, type: "Text" as const, sourceCatalogId: null, sourceCatalogName: null, position: 1, isActive: true, revision: 1, usedBy: [] };
const userId = "01990000-0000-7000-8000-000000000002";
const initial = { userId, revision: 3, values: { [attribute.id]: { value: "Centro", text: "Centro" }, "01990000-0000-7000-8000-000000000003": { value: "sin tocar", text: "sin tocar" } } };
beforeEach(() => { vi.clearAllMocks(); vi.mocked(fetchPersonAttributes).mockResolvedValue({ items: [attribute, { ...attribute, id: "01990000-0000-7000-8000-000000000003", key: "other", name: { es: "Otro dato" }, position: 2 }] }); vi.mocked(fetchPersonData).mockResolvedValue(initial); });
function mount() {
 const client = createQueryClient(); client.setDefaultOptions({ queries: { retry: false } });
 function Wrapper({ children }: PropsWithChildren) { return <QueryClientProvider client={client}>{children}</QueryClientProvider>; }
 const scope = { actorId: "first", culture: "es" as const, permissions: ["users.manage"] };
 const hook = renderHook(({ actorId }) => usePersonData({ ...scope, actorId }, userId), { wrapper: Wrapper, initialProps: { actorId: "first" } });
 return { ...hook, client };
}
it("writes only changed person data with its captured revision outside MutationCache", async () => {
 const { result, client } = mount();
 await waitFor(() => expect(result.current.ready).toBe(true));
 expect(await result.current.save()).toBe(true);
 expect(savePersonData).not.toHaveBeenCalled();
 act(() => result.current.changeValue(attribute.id, "Norte"));
 vi.mocked(savePersonData).mockResolvedValue({ ...initial, revision: 4, values: { [attribute.id]: { value: "Norte", text: "Norte" } } });
 await act(async () => expect(await result.current.save()).toBe(true));
 expect(savePersonData).toHaveBeenCalledWith(userId, { expectedRevision: 3, values: { [attribute.id]: "Norte" } }, expect.any(AbortSignal));
 expect(result.current.dirty).toBe(false);
 expect(client.getMutationCache().getAll()).toEqual([]);
});
it("keeps its draft and revision after a conflict until the person explicitly reloads", async () => {
 const { result } = mount(); await waitFor(() => expect(result.current.ready).toBe(true));
 act(() => result.current.changeValue(attribute.id, "Norte"));
 vi.mocked(savePersonData).mockRejectedValue(new ApiError(409, { code: "Forms.PersonData.RevisionConflict" }));
 await act(async () => expect(await result.current.save()).toBe(false));
 expect(result.current.values?.[attribute.id]).toBe("Norte");
 expect(result.current.dirty).toBe(true);
 expect(result.current.conflict).toBe(true);
 vi.mocked(fetchPersonData).mockResolvedValue({ ...initial, revision: 5 });
 await act(async () => { await result.current.reload(); });
 expect(result.current.values?.[attribute.id]).toBe("Centro");
 expect(fetchPersonAttributes).toHaveBeenCalledTimes(2);
 expect(result.current.dirty).toBe(false);
});
it("clears private draft values when the actor changes and ignores a late save", async () => {
 const { result, rerender, client } = mount(); await waitFor(() => expect(result.current.ready).toBe(true));
 act(() => result.current.changeValue(attribute.id, "privado"));
 let finish!: (value: typeof initial) => void;
 vi.mocked(savePersonData).mockReturnValue(new Promise(resolve => { finish = resolve; }));
 let pending!: Promise<boolean>;
 act(() => { pending = result.current.save(); });
 rerender({ actorId: "second" });
 expect(result.current.values?.[attribute.id]).not.toBe("privado");
 await act(async () => { finish({ ...initial, revision: 4 }); await pending; });
 expect(result.current.values?.[attribute.id]).not.toBe("privado");
 expect(client.getMutationCache().getAll()).toEqual([]);
});

it("retires private values and query data when the server denies a save", async () => {
 const { result, client } = mount(); await waitFor(() => expect(result.current.ready).toBe(true));
 act(() => result.current.changeValue(attribute.id, "privado"));
 vi.mocked(savePersonData).mockRejectedValue(new ApiError(403, { code: "Forbidden" }));
 await act(async () => { await result.current.save(); });
 await waitFor(() => expect(result.current.denied).toBe(true));
 expect(result.current.values).toBeNull();
 expect(client.getQueryCache().findAll({ queryKey: ["forms-person-data"] }).every(query => query.state.data === undefined)).toBe(true);
});
