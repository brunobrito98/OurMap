import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Settings, Bell, Users, Calendar, Star, UserPlus, MessageSquare } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

type NotificationPreferences = {
  notificarConviteAmigo?: boolean;
  notificarEventoAmigo?: boolean;
  notificarAvaliacaoAmigo?: boolean;
  notificarContatoCadastrado?: boolean;
  notificarConfirmacaoPresenca?: boolean;
  notificarAvaliacaoEventoCriado?: boolean;
};

type PreferenceConfig = {
  key: keyof NotificationPreferences;
  title: string;
  description: string;
  icon: React.ReactNode;
  category: 'general' | 'event_creator';
};

const preferencesConfig: PreferenceConfig[] = [
  {
    key: 'notificarConviteAmigo',
    title: 'Convites de conexão',
    description: 'Quando alguém te enviar uma solicitação de conexão',
    icon: <UserPlus className="h-4 w-4" />,
    category: 'general'
  },
  {
    key: 'notificarEventoAmigo',
    title: 'Novos eventos de amigos',
    description: 'Quando um amigo criar um novo evento',
    icon: <Calendar className="h-4 w-4" />,
    category: 'general'
  },
  {
    key: 'notificarAvaliacaoAmigo',
    title: 'Avaliações de amigos',
    description: 'Quando um amigo avaliar um evento',
    icon: <Star className="h-4 w-4" />,
    category: 'general'
  },
  {
    key: 'notificarContatoCadastrado',
    title: 'Contatos cadastrados',
    description: 'Quando um contato do seu telefone se cadastrar no app',
    icon: <MessageSquare className="h-4 w-4" />,
    category: 'general'
  },
  {
    key: 'notificarConfirmacaoPresenca',
    title: 'Confirmações de presença',
    description: 'Quando alguém confirmar presença nos seus eventos',
    icon: <Users className="h-4 w-4" />,
    category: 'event_creator'
  },
  {
    key: 'notificarAvaliacaoEventoCriado',
    title: 'Avaliações dos seus eventos',
    description: 'Quando alguém avaliar um evento que você criou',
    icon: <Star className="h-4 w-4" />,
    category: 'event_creator'
  },
];

export function NotificationSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: preferences = {}, isLoading } = useQuery<NotificationPreferences>({
    queryKey: ['/api/notifications/preferences'],
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const updatePreferenceMutation = useMutation({
    mutationFn: async ({ chave, valor }: { chave: keyof NotificationPreferences; valor: boolean }) => {
      return apiRequest('/api/notifications/preferences', {
        method: "PATCH",
        body: JSON.stringify({ chave, valor }),
        headers: {
          'Content-Type': 'application/json',
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/preferences'] });
      toast({
        title: "Sucesso",
        description: "Preferência de notificação atualizada",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar a preferência",
        variant: "destructive",
      });
      console.error('Error updating preference:', error);
    },
  });

  const handleToggle = (key: keyof NotificationPreferences, currentValue: boolean) => {
    updatePreferenceMutation.mutate({
      chave: key,
      valor: !currentValue,
    });
  };

  const generalPreferences = preferencesConfig.filter(p => p.category === 'general');
  const eventCreatorPreferences = preferencesConfig.filter(p => p.category === 'event_creator');

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 max-w-2xl">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <div className="h-6 bg-muted rounded w-1/4"></div>
              </CardHeader>
              <CardContent className="space-y-4">
                {[...Array(3)].map((_, j) => (
                  <div key={j} className="flex items-center justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="h-4 bg-muted rounded w-2/3"></div>
                      <div className="h-3 bg-muted rounded w-1/2"></div>
                    </div>
                    <div className="h-6 w-11 bg-muted rounded-full"></div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <div className="flex items-center space-x-2 mb-6">
        <Settings className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Configurações de Notificação</h1>
      </div>

      <div className="space-y-6">
        {/* Geral */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Bell className="h-5 w-5" />
              <span>Geral</span>
            </CardTitle>
            <CardDescription>
              Configure quando você deseja receber notificações sobre atividades gerais no app
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {generalPreferences.map((config, index) => {
              const isEnabled = preferences[config.key] ?? true;
              return (
                <div key={config.key}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      <div className="mt-1 text-muted-foreground">
                        {config.icon}
                      </div>
                      <div className="space-y-1 flex-1">
                        <Label 
                          htmlFor={config.key}
                          className="text-sm font-medium leading-none cursor-pointer"
                        >
                          {config.title}
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          {config.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {isEnabled && (
                        <Badge variant="secondary" className="text-xs">
                          Ativo
                        </Badge>
                      )}
                      <Switch
                        id={config.key}
                        checked={isEnabled}
                        onCheckedChange={() => handleToggle(config.key, isEnabled)}
                        disabled={updatePreferenceMutation.isPending}
                        data-testid={`switch-${config.key}`}
                      />
                    </div>
                  </div>
                  {index < generalPreferences.length - 1 && (
                    <Separator className="mt-6" />
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Como Criador de Evento */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="h-5 w-5" />
              <span>Como Criador de Evento</span>
            </CardTitle>
            <CardDescription>
              Configure quando você deseja ser notificado sobre atividades relacionadas aos eventos que você cria
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {eventCreatorPreferences.map((config, index) => {
              const isEnabled = preferences[config.key] ?? true;
              return (
                <div key={config.key}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      <div className="mt-1 text-muted-foreground">
                        {config.icon}
                      </div>
                      <div className="space-y-1 flex-1">
                        <Label 
                          htmlFor={config.key}
                          className="text-sm font-medium leading-none cursor-pointer"
                        >
                          {config.title}
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          {config.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {isEnabled && (
                        <Badge variant="secondary" className="text-xs">
                          Ativo
                        </Badge>
                      )}
                      <Switch
                        id={config.key}
                        checked={isEnabled}
                        onCheckedChange={() => handleToggle(config.key, isEnabled)}
                        disabled={updatePreferenceMutation.isPending}
                        data-testid={`switch-${config.key}`}
                      />
                    </div>
                  </div>
                  {index < eventCreatorPreferences.length - 1 && (
                    <Separator className="mt-6" />
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="border-muted">
          <CardContent className="pt-6">
            <div className="flex items-start space-x-3 text-sm text-muted-foreground">
              <Bell className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <p className="font-medium">Sobre as notificações</p>
                <p>
                  Essas configurações controlam as notificações que você recebe dentro do app. 
                  Você pode alterar essas preferências a qualquer momento.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}