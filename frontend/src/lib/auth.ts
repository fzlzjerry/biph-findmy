import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { api } from "./api";
import type { User } from "./types";

export const ME_KEY = ["me"] as const;

export function useMe() {
  return useQuery({ queryKey: ME_KEY, queryFn: api.me, staleTime: 60_000 });
}

export function useUser(): { user: User | null; isLoading: boolean; isAdmin: boolean } {
  const query = useMe();
  const user = query.data?.user ?? null;
  return { user, isLoading: query.isPending, isAdmin: user?.role === "admin" };
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
  const reset = useResetUserData();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: api.logout,
    onSettled: () => {
      reset(null);
      navigate("/", { replace: true });
    },
  });
}
