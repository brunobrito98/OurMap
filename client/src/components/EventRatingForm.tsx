import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import Rating from '@/components/ui/rating';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/hooks/useAuth';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, AlertCircle } from 'lucide-react';

interface EventRatingFormProps {
  eventId: string;
  eventTitle: string;
  organizerName: string;
}

interface RatingSubmission {
  eventRating: number;
  organizerRating: number;
  comment: string;
}

export default function EventRatingForm({ eventId, eventTitle, organizerName }: EventRatingFormProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [eventRating, setEventRating] = useState(0);
  const [organizerRating, setOrganizerRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Check if user can rate this event
  const { data: canRate, isLoading: checkingPermission } = useQuery({
    queryKey: ['canRate', eventId],
    queryFn: async () => {
      if (!user) return null;
      const response = await fetch(`/api/events/${eventId}/can-rate`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to check rating permission');
      }
      return response.json();
    },
    enabled: !!user,
  });

  // Get existing rating if any
  const { data: existingRating } = useQuery({
    queryKey: ['myRating', eventId],
    queryFn: async () => {
      if (!user) return null;
      const response = await fetch(`/api/events/${eventId}/my-rating`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch rating');
      }
      return response.json();
    },
    enabled: !!user,
  });

  // Submit rating mutation
  const submitRatingMutation = useMutation({
    mutationFn: async (data: RatingSubmission) => {
      const response = await fetch(`/api/events/${eventId}/rate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to submit rating');
      }
      return response.json();
    },
    onSuccess: () => {
      setIsSubmitted(true);
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['canRate', eventId] });
      queryClient.invalidateQueries({ queryKey: ['myRating', eventId] });
      queryClient.invalidateQueries({ queryKey: ['eventRatings', eventId] });
      queryClient.invalidateQueries({ queryKey: ['eventRatingsAverage', eventId] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (eventRating === 0 || organizerRating === 0) {
      alert('Por favor, avalie tanto o evento quanto o organizador');
      return;
    }

    submitRatingMutation.mutate({
      eventRating,
      organizerRating,
      comment,
    });
  };

  if (checkingPermission) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-gray-500">Verificando permissões...</div>
        </CardContent>
      </Card>
    );
  }

  if (!user) {
    return (
      <Card>
        <CardContent className="p-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Você precisa estar logado para avaliar eventos.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (existingRating) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            Sua Avaliação
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Rating 
              value={existingRating.eventRating} 
              readonly 
              label="Evento:" 
              showValue 
            />
          </div>
          <div>
            <Rating 
              value={existingRating.organizerRating} 
              readonly 
              label="Organizador:" 
              showValue 
            />
          </div>
          {existingRating.comment && (
            <div>
              <h4 className="font-medium text-gray-700 mb-2">Seu comentário:</h4>
              <p className="text-gray-600 bg-gray-50 p-3 rounded-lg">
                {existingRating.comment}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  if (!canRate?.canRate) {
    return (
      <Card>
        <CardContent className="p-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {canRate?.reason || 'Você não pode avaliar este evento no momento.'}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (isSubmitted) {
    return (
      <Card>
        <CardContent className="p-6">
          <Alert>
            <CheckCircle className="h-4 w-4 text-green-500" />
            <AlertDescription className="text-green-700">
              Obrigado pela sua avaliação! Sua opinião é muito importante para a comunidade.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Deixe sua avaliação</CardTitle>
        <p className="text-sm text-gray-600">
          Ajude outros usuários avaliando este evento e seu organizador
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Rating
              value={eventRating}
              onChange={setEventRating}
              label="Avalie o evento:"
              size="md"
            />
          </div>

          <div>
            <Rating
              value={organizerRating}
              onChange={setOrganizerRating}
              label={`Avalie ${organizerName}:`}
              size="md"
            />
          </div>

          <div>
            <label htmlFor="comment" className="block text-sm font-medium text-gray-700 mb-2">
              Comentário (opcional)
            </label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Compartilhe sua experiência sobre o evento..."
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-gray-500 mt-1">
              {comment.length}/500 caracteres
            </p>
          </div>

          <Button 
            type="submit" 
            className="w-full"
            disabled={submitRatingMutation.isPending || eventRating === 0 || organizerRating === 0}
          >
            {submitRatingMutation.isPending ? 'Enviando...' : 'Enviar Avaliação'}
          </Button>

          {submitRatingMutation.error && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-red-700">
                {submitRatingMutation.error.message}
              </AlertDescription>
            </Alert>
          )}
        </form>
      </CardContent>
    </Card>
  );
}