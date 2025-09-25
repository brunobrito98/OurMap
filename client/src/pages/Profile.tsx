import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import BottomNavigation from "@/components/BottomNavigation";
import ProfileImageUpload from "@/components/ProfileImageUpload";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { apiRequest } from "@/lib/queryClient";
import type { UserWithStats } from "@shared/schema";
import { 
  ArrowLeft, 
  Settings, 
  Users, 
  Calendar, 
  Trophy, 
  Save, 
  X, 
  LogOut,
  MapPin,
  Camera,
  Loader2,
  Star,
  Heart,
  ChevronRight
} from "lucide-react";

export default function Profile() {
  const [, navigate] = useLocation();
  const { user: authUser, logout } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditingProfileImage, setIsEditingProfileImage] = useState(false);
  const [imageAction, setImageAction] = useState<{ action: 'none' | 'upload' | 'remove'; file?: File }>({ action: 'none' });

  const { data: user, isLoading } = useQuery<UserWithStats>({
    queryKey: ['/api/auth/user'],
    enabled: !!authUser,
  });

  // Profile image upload mutation
  const profileImageMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('profileImage', file);
      
      const response = await fetch('/api/user/profile-image', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(`Resposta inválida do servidor: ${text.substring(0, 100)}...`);
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      setIsEditingProfileImage(false);
      setImageAction({ action: 'none' });
      toast({
        title: "Sucesso",
        description: "Foto de perfil atualizada com sucesso!",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: "Falha ao atualizar foto de perfil",
        variant: "destructive",
      });
      console.error("Error uploading profile image:", error);
    },
  });

  // Profile image delete mutation
  const deleteProfileImageMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/user/profile-image', {
        method: 'DELETE',
        credentials: 'include',
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(`Resposta inválida do servidor: ${text.substring(0, 100)}...`);
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      setIsEditingProfileImage(false);
      setImageAction({ action: 'none' });
      toast({
        title: "Sucesso",
        description: "Foto de perfil removida com sucesso!",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: "Falha ao remover foto de perfil",
        variant: "destructive",
      });
      console.error("Error removing profile image:", error);
    },
  });

  const handleProfileImageSelect = (file: File | null) => {
    if (file) {
      setImageAction({ action: 'upload', file });
    } else {
      setImageAction({ action: 'remove' });
    }
  };

  const handleSaveProfileImage = () => {
    if (imageAction.action === 'upload' && imageAction.file) {
      profileImageMutation.mutate(imageAction.file);
    } else if (imageAction.action === 'remove') {
      deleteProfileImageMutation.mutate();
    } else {
      // No action needed, just exit edit mode
      setIsEditingProfileImage(false);
      setImageAction({ action: 'none' });
    }
  };

  const handleCancelEditImage = () => {
    setImageAction({ action: 'none' });
    setIsEditingProfileImage(false);
  };

  const handleLogout = async () => {
    try {
      // Use the logout function from useAuth hook
      await logout();
      
      // Primeiro, tenta encerrar a sessão do Supabase de forma segura
      try {
        await supabase.auth.signOut();
      } catch (supabaseError) {
        console.log("Supabase logout não disponível:", supabaseError);
      }
      
      // Redireciona para a tela de login após o logout
      navigate("/");
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
      // Mesmo com erro, redireciona para garantir que o usuário saia da conta
      navigate("/");
    }
  };

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-background">
        <div className="animate-pulse">
          <div className="h-64 bg-gradient-to-r from-primary to-accent"></div>
          <div className="p-4 space-y-4">
            <div className="h-8 bg-muted rounded"></div>
            <div className="h-32 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-white border-b border-border p-4 sticky top-0 z-30">
        <div className="flex items-center space-x-4">
          <Button
            onClick={() => navigate("/")}
            variant="ghost"
            size="sm"
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h2 className="font-semibold text-foreground flex-1">Perfil</h2>
        </div>
      </div>

      <div>
        {/* Profile Header */}
        <div className="bg-gradient-to-r from-primary to-accent p-6 text-center">
          {isEditingProfileImage ? (
            <div className="mb-4">
              <ProfileImageUpload
                onImageSelect={handleProfileImageSelect}
                currentImageUrl={user.profileImageUrl || undefined}
                size="lg"
                className="flex justify-center"
              />
              <div className="flex justify-center space-x-2 mt-4">
                <Button
                  onClick={handleCancelEditImage}
                  variant="secondary"
                  size="sm"
                  disabled={profileImageMutation.isPending || deleteProfileImageMutation.isPending}
                  data-testid="button-cancel-edit-photo"
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancelar
                </Button>
                <Button
                  onClick={handleSaveProfileImage}
                  variant="default"
                  size="sm"
                  disabled={profileImageMutation.isPending || deleteProfileImageMutation.isPending || imageAction.action === 'none'}
                  data-testid="button-save-profile-photo"
                >
                  {profileImageMutation.isPending || deleteProfileImageMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Salvar
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="relative inline-block mb-4">
              <Avatar className="w-24 h-24 mx-auto border-4 border-white shadow-lg">
                <AvatarImage src={user.profileImageUrl || undefined} />
                <AvatarFallback className="text-xl">
                  {user.firstName?.[0]}{user.lastName?.[0]}
                </AvatarFallback>
              </Avatar>
              <Button
                onClick={() => setIsEditingProfileImage(true)}
                size="sm"
                className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full p-0 bg-white text-primary border-2 border-white shadow-lg hover:bg-gray-50"
                data-testid="button-edit-profile-photo"
              >
                <Camera className="w-4 h-4" />
              </Button>
            </div>
          )}
          <h1 className="text-2xl font-bold text-white mb-1" data-testid="text-user-name">
            {user.firstName} {user.lastName}
          </h1>
          {user.username && (
            <p className="text-white/80 text-lg mb-1" data-testid="text-user-username">
              @{user.username}
            </p>
          )}
          <p className="text-white/90" data-testid="text-user-email">{user.email}</p>
          <div className="flex items-center justify-center space-x-1 mt-2">
            <Star className="w-4 h-4 text-yellow-300 fill-current" />
            <span className="text-white font-medium" data-testid="text-user-rating">
              {user.averageRating?.toFixed(1) || "N/A"}
            </span>
            <span className="text-white/80 text-sm">(avaliação geral)</span>
          </div>
        </div>

        {/* Stats */}
        <div className="bg-white -mt-6 mx-4 rounded-2xl shadow-lg p-6 mb-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-foreground" data-testid="text-events-created">
                {user.eventsCreated}
              </p>
              <p className="text-sm text-muted-foreground">Eventos criados</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground" data-testid="text-events-attended">
                {user.eventsAttended}
              </p>
              <p className="text-sm text-muted-foreground">Participações</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground" data-testid="text-friends-count">
                {user.friendsCount}
              </p>
              <p className="text-sm text-muted-foreground">Amigos</p>
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <div className="px-4 space-y-3">
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <Button
              onClick={() => navigate("/my-events")}
              variant="ghost"
              className="w-full flex items-center space-x-4 p-4 h-auto justify-start"
              data-testid="button-my-events"
            >
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                <Calendar className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-medium text-foreground">Meus Eventos</p>
                <p className="text-sm text-muted-foreground">Eventos que você criou</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Button>
            
            <div className="border-t border-border"></div>
            
            <Button
              onClick={() => navigate("/search?tab=saved")}
              variant="ghost"
              className="w-full flex items-center space-x-4 p-4 h-auto justify-start"
              data-testid="button-saved-events"
            >
              <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center">
                <Heart className="w-5 h-5 text-accent" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-medium text-foreground">Eventos Salvos</p>
                <p className="text-sm text-muted-foreground">Seus eventos favoritos</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Button>
            
            <div className="border-t border-border"></div>
            
            <Button
              onClick={() => navigate("/friends")}
              variant="ghost"
              className="w-full flex items-center space-x-4 p-4 h-auto justify-start"
              data-testid="button-friends"
            >
              <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                <Users className="w-5 h-5 text-green-600" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-medium text-foreground">Amigos</p>
                <p className="text-sm text-muted-foreground">Gerenciar suas conexões</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Button>
          </div>

          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <Button
              onClick={() => navigate("/profile/my-ratings")}
              variant="ghost"
              className="w-full flex items-center space-x-4 p-4 h-auto justify-start"
              data-testid="button-ratings"
            >
              <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                <i className="fas fa-star text-purple-600"></i>
              </div>
              <div className="flex-1 text-left">
                <p className="font-medium text-foreground">Avaliações Recebidas</p>
                <p className="text-sm text-muted-foreground">Feedback dos participantes</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Button>
            
            <div className="border-t border-border"></div>
            
            <Button
              onClick={() => navigate("/notifications")}
              variant="ghost"
              className="w-full flex items-center space-x-4 p-4 h-auto justify-start"
              data-testid="button-notifications"
            >
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <i className="fas fa-bell text-blue-600"></i>
              </div>
              <div className="flex-1 text-left">
                <p className="font-medium text-foreground">Notificações</p>
                <p className="text-sm text-muted-foreground">Configurar alertas</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Button>
            
            <div className="border-t border-border"></div>
            
            <Button
              onClick={() => navigate("/settings/profile")}
              variant="ghost"
              className="w-full flex items-center space-x-4 p-4 h-auto justify-start"
              data-testid="button-account-settings"
            >
              <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                <i className="fas fa-cog text-gray-600"></i>
              </div>
              <div className="flex-1 text-left">
                <p className="font-medium text-foreground">Configurações</p>
                <p className="text-sm text-muted-foreground">Privacidade e conta</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Button>
          </div>

          {/* Logout Button */}
          <Button
            onClick={handleLogout}
            variant="destructive"
            className="w-full bg-destructive/10 text-destructive hover:bg-destructive/20 py-4 rounded-2xl font-medium mt-6"
            data-testid="button-logout"
          >
            <i className="fas fa-sign-out-alt mr-2"></i>Sair da conta
          </Button>
        </div>
      </div>

      <BottomNavigation activeTab="profile" />
    </div>
  );
}
