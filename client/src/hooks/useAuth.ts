import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { User } from "@shared/schema";

export function useAuth() {
  const queryClient = useQueryClient();
  
  const { data: user, isLoading } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  const logout = async () => {
    try {
      // Call backend logout endpoint
      await fetch("/api/auth/logout", { 
        method: "POST", 
        credentials: "same-origin" 
      });
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      // Always invalidate auth cache to clear user data
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.removeQueries({ queryKey: ["/api/auth/user"] });
    }
  };

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    logout,
  };
}
