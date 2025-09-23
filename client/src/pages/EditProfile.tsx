import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import ProfileImageUpload from "@/components/ProfileImageUpload";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { UserWithStats } from "@shared/schema";
import { 
  ArrowLeft, 
  Settings, 
  Lock, 
  Phone,
  ChevronRight,
  Camera,
  Save,
  X,
  Loader2
} from "lucide-react";

export default function EditProfile() {
  const [, navigate] = useLocation();
  const { user: authUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingProfileImage, setIsEditingProfileImage] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [imageAction, setImageAction] = useState<{ action: 'none' | 'upload' | 'remove'; file?: File }>({ action: 'none' });

  const { data: user, isLoading } = useQuery<UserWithStats>({
    queryKey: ['/api/auth/user'],
    enabled: !!authUser,
  });

  // Set initial values when user data is loaded
  useEffect(() => {
    if (user) {
      setFirstName(user.firstName || "");
      setLastName(user.lastName || "");
    }
  }, [user]);

  // Name update mutation
  const updateNameMutation = useMutation({
    mutationFn: async (data: { firstName: string; lastName: string }) => {
      return apiRequest('/api/user/profile', 'PATCH', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      setIsEditingName(false);
      toast({
        title: "Sucesso",
        description: "Nome atualizado com sucesso!",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao atualizar nome",
        variant: "destructive",
      });
    },
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
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao atualizar foto de perfil",
        variant: "destructive",
      });
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
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao remover foto de perfil",
        variant: "destructive",
      });
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
      setIsEditingProfileImage(false);
      setImageAction({ action: 'none' });
    }
  };

  const handleSaveName = () => {
    if (firstName.trim() && lastName.trim()) {
      updateNameMutation.mutate({
        firstName: firstName.trim(),
        lastName: lastName.trim()
      });
    }
  };

  const handleCancelEditImage = () => {
    setImageAction({ action: 'none' });
    setIsEditingProfileImage(false);
  };

  const handleCancelEditName = () => {
    if (user) {
      setFirstName(user.firstName || "");
      setLastName(user.lastName || "");
    }
    setIsEditingName(false);
  };

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-background">
        <div className="animate-pulse">
          <div className="h-16 bg-muted border-b"></div>
          <div className="p-4 space-y-4">
            <div className="h-32 bg-muted rounded-2xl"></div>
            <div className="h-48 bg-muted rounded-2xl"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-white border-b border-border p-4 sticky top-0 z-30">
        <div className="flex items-center space-x-4">
          <Button
            onClick={() => navigate("/profile")}
            variant="ghost"
            size="sm"
            data-testid="button-back-to-profile"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h2 className="font-semibold text-foreground flex-1">Editar Perfil</h2>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Seção: Informações Pessoais */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Settings className="w-5 h-5" />
              <span>Informações Pessoais</span>
            </CardTitle>
            <CardDescription>
              Gerencie suas informações básicas de perfil
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Foto de Perfil */}
            <div>
              <Label className="text-sm font-medium">Foto de Perfil</Label>
              <div className="mt-2">
                {isEditingProfileImage ? (
                  <div>
                    <ProfileImageUpload
                      onImageSelect={handleProfileImageSelect}
                      currentImageUrl={user.profileImageUrl || undefined}
                      size="lg"
                      className="flex justify-center"
                    />
                    <div className="flex justify-center space-x-2 mt-4">
                      <Button
                        onClick={handleCancelEditImage}
                        variant="outline"
                        size="sm"
                        disabled={profileImageMutation.isPending || deleteProfileImageMutation.isPending}
                        data-testid="button-cancel-edit-photo"
                      >
                        <X className="w-4 h-4 mr-2" />
                        Cancelar
                      </Button>
                      <Button
                        onClick={handleSaveProfileImage}
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
                  <div className="flex items-center space-x-4">
                    <div className="relative">
                      <Avatar className="w-16 h-16">
                        <AvatarImage src={user.profileImageUrl || undefined} />
                        <AvatarFallback className="text-lg">
                          {user.firstName?.[0]}{user.lastName?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <Button
                        onClick={() => setIsEditingProfileImage(true)}
                        size="sm"
                        variant="outline"
                        className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full p-0"
                        data-testid="button-edit-profile-photo"
                      >
                        <Camera className="w-3 h-3" />
                      </Button>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Clique no ícone da câmera para alterar sua foto de perfil
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Nome */}
            <div>
              <Label className="text-sm font-medium">Nome</Label>
              <div className="mt-2">
                {isEditingName ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="firstName" className="text-xs text-muted-foreground">
                          Primeiro Nome
                        </Label>
                        <Input
                          id="firstName"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          placeholder="Seu primeiro nome"
                          data-testid="input-first-name"
                        />
                      </div>
                      <div>
                        <Label htmlFor="lastName" className="text-xs text-muted-foreground">
                          Sobrenome
                        </Label>
                        <Input
                          id="lastName"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          placeholder="Seu sobrenome"
                          data-testid="input-last-name"
                        />
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        onClick={handleCancelEditName}
                        variant="outline"
                        size="sm"
                        disabled={updateNameMutation.isPending}
                        data-testid="button-cancel-edit-name"
                      >
                        <X className="w-4 h-4 mr-2" />
                        Cancelar
                      </Button>
                      <Button
                        onClick={handleSaveName}
                        size="sm"
                        disabled={updateNameMutation.isPending || !firstName.trim() || !lastName.trim()}
                        data-testid="button-save-name"
                      >
                        {updateNameMutation.isPending ? (
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
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium" data-testid="text-display-name">
                        {user.firstName} {user.lastName}
                      </p>
                      <p className="text-sm text-muted-foreground">Seu nome público</p>
                    </div>
                    <Button
                      onClick={() => setIsEditingName(true)}
                      variant="ghost"
                      size="sm"
                      data-testid="button-edit-name"
                    >
                      Editar
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* E-mail (não editável) */}
            <div>
              <Label className="text-sm font-medium">E-mail</Label>
              <div className="mt-2">
                <div className="p-3 border rounded-lg bg-muted/30">
                  <p className="font-medium" data-testid="text-display-email">
                    {user.email}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    O e-mail é usado como identificador da sua conta e não pode ser alterado
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Seção: Segurança da Conta */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Lock className="w-5 h-5" />
              <span>Segurança da Conta</span>
            </CardTitle>
            <CardDescription>
              Gerencie sua segurança e métodos de autenticação
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Alterar Senha */}
            <Button
              onClick={() => navigate("/settings/change-password")}
              variant="ghost"
              className="w-full flex items-center justify-between p-4 h-auto border rounded-lg hover:bg-muted/50"
              data-testid="button-change-password"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                  <Lock className="w-5 h-5 text-red-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-foreground">Alterar Senha</p>
                  <p className="text-sm text-muted-foreground">Modifique sua senha de acesso</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Button>

            {/* Atualizar Número de Telefone */}
            <Button
              onClick={() => navigate("/settings/change-phone")}
              variant="ghost"
              className="w-full flex items-center justify-between p-4 h-auto border rounded-lg hover:bg-muted/50"
              data-testid="button-change-phone"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Phone className="w-5 h-5 text-blue-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-foreground">Atualizar Número de Telefone</p>
                  <p className="text-sm text-muted-foreground">Altere seu número com verificação SMS</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}