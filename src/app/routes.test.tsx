import { isValidElement } from "react";
import type { RouteObject } from "react-router";
import { describe, expect, it } from "vitest";
import { ProtectedRoute } from "@/auth/ProtectedRoute";
import { screenLinkOf } from "@/layouts/navigation";
import { routes } from "./routes";

function asksForPermission(route: RouteObject): boolean {
  return isValidElement<{ permission?: unknown }>(route.element) && route.element.type === ProtectedRoute && route.element.props.permission !== undefined;
}

function protectedPaths(list: readonly RouteObject[], parent = "", guarded = false): string[] {
  return list.flatMap(route => {
    const path = route.path === undefined ? parent : route.path.startsWith("/") ? route.path : `${parent}/${route.path}`;
    const inside = guarded || asksForPermission(route);
    return [...(inside && route.path !== undefined ? [path] : []), ...protectedPaths(route.children ?? [], path, inside)];
  });
}

// SP1-B (2026-11-24): without the permission, the screen keeps its address and its band says which screen it is.
describe("the routes", () => {
  it("name every screen that asks for a permission", () => {
    const paths = protectedPaths(routes);
    const unnamed = paths.filter(path => screenLinkOf(path) === undefined);

    expect(paths.length).toBeGreaterThan(20);
    expect(unnamed, unnamed.join("\n")).toEqual([]);
  });

  it("have no address of their own for the lack of permission", () => {
    expect(protectedPaths(routes, "", true)).not.toContain("/sin-permiso");
  });
});
