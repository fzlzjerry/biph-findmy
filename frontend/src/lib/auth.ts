import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type { User } from "./types";

export const ME_KEY = ["me"] as const;

export function useMe() {
  return useQuery({ queryKey: ME_KEY, queryFn: api.me, staleTime: 60_000 });
}

export function useUser(): { user: User | null; isLoading: boolean; isAdmin: boolean; isSuperAdmin: boolean } {
  const query = useMe();
  const user = query.data?.user ?? null;
  return {
    user,
    isLoading: query.isPending,
    isAdmin: user?.role === "admin" || user?.role === "superadmin",
    isSuperAdmin: user?.role === "superadmin",
  };
}

/** Drops everything cached for the previous account (is_mine flags, my items, admin data). */
export function useResetUserData() {
  const queryClient = useQueryClient();
  return (user: User | null) => {
    queryClient.setQueryData(ME_KEY, { user });
    queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== "meta" && q.queryKey[0] !== "me" });
  };
}

export function useLogout() {
  return useMutation({
    mutationFn: api.logout,
    // A fresh load of the home page drops every cached query. Clearing the user in place instead would
    // let RequireAuth on a signed-in-only page redirect to /login?next=… before a client-side navigation lands.
    onSettled: () => window.location.replace("/"),
  });
}
