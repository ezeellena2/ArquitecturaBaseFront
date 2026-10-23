import { act, renderHook } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { expect, it } from "vitest";
import { createQueryClient } from "@/shared/api/queryClient";
import { useCatalogDraftEditor } from "./useCatalogDraftEditor";
import { newCatalogField } from "../catalogFields";

it("tracks field and presentation edits as private changes and clears them when the owner changes", () => {
  const client = createQueryClient();
  function Wrapper({ children }: PropsWithChildren) { return <QueryClientProvider client={client}>{children}</QueryClientProvider>; }
  const scope = { actorId: "first", culture: "es" as const, permissions: ["formcatalogs.read", "formcatalogs.manage"] };
  const { result, rerender } = renderHook(({ actorId }) => useCatalogDraftEditor({ ...scope, actorId }), { wrapper: Wrapper, initialProps: { actorId: "first" } });
  act(() => result.current.changeFields([newCatalogField("new-field", 1)], []));
  expect(result.current.dirty).toBe(true);
  expect(result.current.draft?.fields[0]?.localId).toBe("new-field");
  act(() => result.current.changePresentation({ title: ["text", "code"], description: [] }));
  expect(result.current.draft?.presentation?.title).toEqual(["text", "code"]);
  rerender({ actorId: "second" });
  expect(result.current.draft?.fields).toEqual([]);
  expect(result.current.draft?.presentation).toBeNull();
  expect(result.current.dirty).toBe(false);
  expect(client.getMutationCache().getAll()).toEqual([]);
});
