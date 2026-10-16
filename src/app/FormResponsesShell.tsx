import type { ReactNode } from "react";
import { ApiError } from "@/shared/api/ApiError";
import { useResponseNavigation } from "@/features/business-forms/hooks/useResponseQueries";
import { FormsResponseNavigationContext } from "@/layouts/formsNavigation";
export function FormResponsesShell({children}:{children:ReactNode}) {
 const {query,scope}=useResponseNavigation();
 const denied=query.error instanceof ApiError&&(query.error.status===403||query.error.status===401);
 return <FormsResponseNavigationContext.Provider value={{canRead:scope.allowed&&!denied,items:denied?[]:query.data?.items??[],hasMore:!denied&&(query.data?.hasNext??false),pending:query.isPending,failed:query.isError&&!query.data,retry:()=>{void query.refetch();}}}>{children}</FormsResponseNavigationContext.Provider>;
}
