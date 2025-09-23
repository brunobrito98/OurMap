import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Bell, BellOff, Check, CheckCheck, Users, Calendar, Star, UserPlus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

type NotificationWithDetails = {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  relatedUserId?: string;
  relatedEventId?: string;
  isRead: boolean;
  actionUrl?: string;
  createdAt: string;
  relatedUser?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
    username: string | null;
  };
  relatedEvent?: {
    id: string;
    title: string;
    imageUrl: string | null;
  };
};

function getNotificationIcon(type: string) {
  switch (type) {
    case 'friend_invite':
      return <UserPlus className="h-5 w-5 text-blue-500" />;
    case 'event_created':
      return <Calendar className="h-5 w-5 text-green-500" />;
    case 'event_attendance':
      return <Users className="h-5 w-5 text-purple-500" />;
    case 'event_rating':
      return <Star className="h-5 w-5 text-yellow-500" />;
    default:
      return <Bell className="h-5 w-5 text-gray-500" />;
  }
}

export function Notifications() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['/api/notifications'],
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const { data: unreadData } = useQuery({
    queryKey: ['/api/notifications/unread-count'],
    staleTime: 1000 * 30, // 30 seconds
  });

  const unreadCount = unreadData?.count || 0;

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      return apiRequest(`/api/notifications/${notificationId}/read`, 'PATCH');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível marcar a notificação como lida",
        variant: "destructive",
      });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/notifications/read-all', 'PATCH');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
      toast({
        title: "Sucesso",
        description: "Todas as notificações foram marcadas como lidas",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível marcar as notificações como lidas",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 max-w-2xl">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          {[...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-start space-x-3">
                  <div className="h-8 w-8 bg-muted rounded-full"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4"></div>
                    <div className="h-3 bg-muted rounded w-1/2"></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Bell className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Notificações</h1>
          {unreadCount > 0 && (
            <Badge variant="destructive" className="ml-2">
              {unreadCount}
            </Badge>
          )}
        </div>
        
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAllAsReadMutation.mutate()}
            disabled={markAllAsReadMutation.isPending}
            data-testid="button-mark-all-read"
          >
            <CheckCheck className="h-4 w-4 mr-2" />
            Marcar todas como lidas
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <BellOff className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground mb-2">
              Nenhuma notificação
            </h3>
            <p className="text-sm text-muted-foreground">
              Você não tem notificações no momento.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {(notifications as NotificationWithDetails[]).map((notification, index) => (
            <div key={notification.id}>
              <Card 
                className={`transition-all hover:shadow-md ${
                  !notification.isRead ? 'ring-2 ring-primary/20 bg-primary/5' : ''
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 mt-1">
                      {getNotificationIcon(notification.type)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-sm font-medium text-foreground mb-1">
                            {notification.title}
                          </h3>
                          <p className="text-sm text-muted-foreground mb-2">
                            {notification.message}
                          </p>
                          
                          <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                            <span>
                              {formatDistanceToNow(new Date(notification.createdAt), {
                                addSuffix: true,
                                locale: ptBR,
                              })}
                            </span>
                            
                            {notification.relatedUser && (
                              <div className="flex items-center space-x-1">
                                {notification.relatedUser.profileImageUrl ? (
                                  <img
                                    src={notification.relatedUser.profileImageUrl}
                                    alt={notification.relatedUser.firstName || ''}
                                    className="h-5 w-5 rounded-full"
                                  />
                                ) : (
                                  <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center">
                                    {(notification.relatedUser.firstName?.[0] || '?').toUpperCase()}
                                  </div>
                                )}
                                <span>
                                  {notification.relatedUser.firstName} {notification.relatedUser.lastName}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2 ml-4">
                          {!notification.isRead && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => markAsReadMutation.mutate(notification.id)}
                              disabled={markAsReadMutation.isPending}
                              data-testid={`button-mark-read-${notification.id}`}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                          )}
                          
                          {notification.actionUrl && (
                            <Link href={notification.actionUrl}>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  if (!notification.isRead) {
                                    markAsReadMutation.mutate(notification.id);
                                  }
                                }}
                                data-testid={`link-action-${notification.id}`}
                              >
                                Ver
                              </Button>
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {index < notifications.length - 1 && <Separator className="my-3" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}