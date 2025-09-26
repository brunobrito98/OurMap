import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import BottomNavigation from "@/components/BottomNavigation";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Star, Users, MessageSquare } from "lucide-react";
import type { EventRating, UserWithStats } from "@shared/schema";

export default function MyRatings() {
  const [, navigate] = useLocation();
  const { user: authUser } = useAuth();

  // Get user details
  const { data: currentUser } = useQuery<UserWithStats>({
    queryKey: ['/api/auth/user'],
    enabled: !!authUser,
  });

  const { data: organizerRating, isLoading: isLoadingOrganizerRating } = useQuery({
    queryKey: ['organizer-rating', currentUser?.id],
    queryFn: async () => {
      const response = await fetch(`/api/users/${currentUser?.id}/organizer-rating`);
      if (!response.ok) {
        throw new Error('Failed to fetch organizer rating');
      }
      return response.json();
    },
    enabled: !!currentUser?.id,
  });

  const { data: ratings = [], isLoading: isLoadingRatings } = useQuery<EventRating[]>({
    queryKey: ['my-received-ratings', currentUser?.id],
    queryFn: async () => {
      const response = await fetch(`/api/users/${currentUser?.id}/received-ratings`);
      if (!response.ok) {
        if (response.status === 404) {
          return [];
        }
        throw new Error('Failed to fetch ratings');
      }
      return response.json();
    },
    enabled: !!currentUser?.id,
  });

  const isLoading = isLoadingOrganizerRating || isLoadingRatings;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="bg-white border-b border-border p-4 sticky top-0 z-30">
          <div className="flex items-center space-x-4">
            <Button
              onClick={() => navigate("/profile")}
              variant="ghost"
              size="sm"
              data-testid="button-back"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h2 className="font-semibold text-foreground flex-1">Avaliações Recebidas</h2>
          </div>
        </div>
        
        <div className="p-4 space-y-4">
          <div className="animate-pulse space-y-4">
            <div className="h-32 bg-muted rounded-lg"></div>
            <div className="h-24 bg-muted rounded-lg"></div>
            <div className="h-24 bg-muted rounded-lg"></div>
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
            onClick={() => navigate("/profile")}
            variant="ghost"
            size="sm"
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h2 className="font-semibold text-foreground flex-1">Avaliações Recebidas</h2>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Rating Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Star className="w-5 h-5 text-yellow-500" />
              <span>Resumo das Avaliações</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {organizerRating && organizerRating.totalRatings > 0 ? (
              <div className="text-center space-y-4">
                <div className="flex items-center justify-center space-x-2">
                  <Star className="w-8 h-8 text-yellow-500 fill-current" />
                  <span className="text-3xl font-bold" data-testid="text-average-rating">
                    {organizerRating.average.toFixed(1)}
                  </span>
                </div>
                <p className="text-muted-foreground">
                  Baseado em <span className="font-medium" data-testid="text-total-ratings">{organizerRating.totalRatings}</span> avaliações
                </p>
                <div className="flex justify-center">
                  <Badge variant="secondary" className="text-sm">
                    <Users className="w-4 h-4 mr-1" />
                    Organizador Avaliado
                  </Badge>
                </div>
              </div>
            ) : (
              <div className="text-center space-y-4 py-8">
                <Star className="w-12 h-12 text-muted-foreground mx-auto" />
                <div>
                  <h3 className="font-medium text-foreground">Nenhuma avaliação ainda</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Crie eventos para receber avaliações dos participantes
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Individual Ratings */}
        {ratings.length > 0 ? (
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground flex items-center space-x-2">
              <MessageSquare className="w-5 h-5" />
              <span>Comentários Recebidos</span>
            </h3>
            
            {ratings.map((rating) => (
              <Card key={rating.id}>
                <CardContent className="pt-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`w-4 h-4 ${
                              i < (rating.organizerRating || 0)
                                ? 'text-yellow-500 fill-current'
                                : 'text-muted-foreground'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {new Date(rating.createdAt!).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    
                    {rating.comment && (
                      <p className="text-sm text-foreground bg-muted p-3 rounded-lg">
                        "{rating.comment}"
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : organizerRating && organizerRating.totalRatings > 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-2">
                <MessageSquare className="w-8 h-8 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">
                  Você tem avaliações, mas nenhum comentário foi deixado ainda.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Call to Action */}
        {(!organizerRating || organizerRating.totalRatings === 0) && (
          <Card className="border-dashed">
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <div className="space-y-2">
                  <h3 className="font-medium text-foreground">Comece a organizar eventos!</h3>
                  <p className="text-sm text-muted-foreground">
                    Crie eventos incríveis e receba feedback valioso dos participantes.
                  </p>
                </div>
                <Button
                  onClick={() => navigate("/create")}
                  data-testid="button-create-event"
                >
                  Criar Evento
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <BottomNavigation activeTab="profile" />
    </div>
  );
}