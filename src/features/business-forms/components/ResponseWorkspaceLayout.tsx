import { Outlet } from "react-router";
import { useResponseScope } from "../hooks/useResponseQueries";
import { ResponseWorkspaceProvider } from "./ResponseWorkspaceProvider";
export function ResponseWorkspaceLayout() {
  const scope = useResponseScope();
  return <ResponseWorkspaceProvider owner={scope.owner}><Outlet /></ResponseWorkspaceProvider>;
}
