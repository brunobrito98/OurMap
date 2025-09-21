import React from 'react';
import { useQuery } from '@tanstack/react-query';
import Rating from '@/components/ui/rating';

interface OrganizerRatingProps {
  organizerId: string;
}

export default function OrganizerRating({ organizerId }: OrganizerRatingProps) {
  const { data: organizerRating, isLoading } = useQuery({
    queryKey: ['organizerRating', organizerId],
    queryFn: async () => {
      const response = await fetch(`/api/users/${organizerId}/organizer-rating`);
      if (!response.ok) {
        throw new Error('Failed to fetch organizer rating');
      }
      return response.json();
    },
    enabled: !!organizerId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center space-x-1">
        <div className="w-4 h-4 bg-gray-200 rounded animate-pulse"></div>
        <div className="w-8 h-4 bg-gray-200 rounded animate-pulse"></div>
      </div>
    );
  }

  if (!organizerRating || organizerRating.totalRatings === 0) {
    return (
      <div className="flex items-center space-x-1 text-gray-400">
        <i className="fas fa-star text-sm"></i>
        <span className="text-sm">Sem avaliações</span>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-1">
      <i className="fas fa-star text-yellow-400 text-sm"></i>
      <span className="text-sm font-medium" data-testid="text-organizer-rating">
        {organizerRating.average.toFixed(1)}
      </span>
      <span className="text-xs text-gray-500">
        ({organizerRating.totalRatings})
      </span>
    </div>
  );
}