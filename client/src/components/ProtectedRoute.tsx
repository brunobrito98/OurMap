import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [location, navigate] = useLocation();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      // Preserve full URL including query and hash for deep links
      const fullPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      navigate(`/login?redirect=${encodeURIComponent(fullPath)}`);
    }
  }, [isAuthenticated, isLoading, navigate, location]);

  // Mostra loading enquanto verifica autenticação
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Se não estiver autenticado, mostra spinner enquanto redireciona
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Se houver um usuário logado, renderiza a página filha (conteúdo protegido)
  return <>{children}</>;
}