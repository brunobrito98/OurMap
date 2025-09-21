import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Rating from '@/components/ui/rating';

interface EventRatingsDisplayProps {
  eventId: string;
}

export default function EventRatingsDisplay({ eventId }: EventRatingsDisplayProps) {
  const { data: ratingsAverage, isLoading } = useQuery({
    queryKey: ['eventRatingsAverage', eventId],
    queryFn: async () => {
      const response = await fetch(`/api/events/${eventId}/ratings/average`);
      if (!response.ok) {
        throw new Error('Failed to fetch ratings average');
      }
      return response.json();
    },
    enabled: !!eventId,
  });

  const { data: ratings } = useQuery({
    queryKey: ['eventRatings', eventId],
    queryFn: async () => {
      const response = await fetch(`/api/events/${eventId}/ratings`);
      if (!response.ok) {
        throw new Error('Failed to fetch ratings');
      }
      return response.json();
    },
    enabled: !!eventId,
  });

  if (isLoading) {
    return (
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-5 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!ratingsAverage || ratingsAverage.totalRatings === 0) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Avaliações</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500 text-center py-4">
            Este evento ainda não foi avaliado.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Avaliações do Evento</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-1">Evento</h4>
            <div className="flex items-center space-x-2">
              <Rating 
                value={ratingsAverage.eventAverage} 
                readonly 
                size="sm" 
              />
              <span className="text-sm font-medium">
                {ratingsAverage.eventAverage.toFixed(1)}
              </span>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-1">Organizador</h4>
            <div className="flex items-center space-x-2">
              <Rating 
                value={ratingsAverage.organizerAverage} 
                readonly 
                size="sm" 
              />
              <span className="text-sm font-medium">
                {ratingsAverage.organizerAverage.toFixed(1)}
              </span>
            </div>
          </div>
        </div>
        
        <div className="text-sm text-gray-600 text-center pt-2 border-t">
          Baseado em {ratingsAverage.totalRatings} avaliação{ratingsAverage.totalRatings !== 1 ? 'ões' : ''}
        </div>

        {/* Recent Reviews */}
        {ratings && ratings.length > 0 && (
          <div className="space-y-3 mt-4">
            <h4 className="font-medium text-gray-700">Comentários recentes</h4>
            {ratings
              .filter((rating: any) => rating.comment && rating.comment.trim())
              .slice(0, 3)
              .map((rating: any, index: number) => (
                <div key={index} className="bg-gray-50 p-3 rounded-lg">
                  <div className="flex items-center space-x-2 mb-1">
                    <Rating value={rating.eventRating} readonly size="sm" />
                    <span className="text-xs text-gray-500">
                      {new Date(rating.createdAt).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700">{rating.comment}</p>
                </div>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}