import { api } from "@/shared/api/httpClient";
import type { PagedResult } from "@/shared/api/pagedResult";

export interface UserListItem {
  readonly id: string;
  readonly email: string;
  readonly displayName: string | null;
  readonly isActive: boolean;
  readonly createdAtUtc: string;
}

export interface UsersQuery {
  readonly page: number;
  readonly pageSize: number;
  readonly sort?: string;
  readonly search?: string;
}

export const usersQueryKey = (query: UsersQuery) => ["users", query] as const;

export function fetchUsers(query: UsersQuery): Promise<PagedResult<UserListItem>> {
  const params = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize) });

  if (query.sort) {
    params.set("sort", query.sort);
  }

  if (query.search) {
    params.set("search", query.search);
  }

  return api.get<PagedResult<UserListItem>>(`/api/users?${params.toString()}`);
}
