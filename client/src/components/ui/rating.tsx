import React from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RatingProps {
  value: number;
  onChange?: (value: number) => void;
  readonly?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showValue?: boolean;
  label?: string;
  className?: string;
}

const sizeMap = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
};

export function Rating({
  value,
  onChange,
  readonly = false,
  size = 'md',
  showValue = false,
  label,
  className,
}: RatingProps) {
  const stars = Array.from({ length: 5 }, (_, index) => index + 1);

  const handleStarClick = (starValue: number) => {
    if (!readonly && onChange) {
      onChange(starValue);
    }
  };

  const handleStarHover = (starValue: number) => {
    if (!readonly) {
      // You could add hover state management here
    }
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {label && (
        <span className="text-sm font-medium text-gray-700">{label}</span>
      )}
      <div className="flex items-center gap-1">
        {stars.map((star) => {
          const isFilled = star <= value;
          return (
            <button
              key={star}
              type="button"
              onClick={() => handleStarClick(star)}
              onMouseEnter={() => handleStarHover(star)}
              disabled={readonly}
              className={cn(
                'transition-colors duration-150',
                readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110',
                !readonly && 'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded'
              )}
            >
              <Star
                className={cn(
                  sizeMap[size],
                  'transition-colors duration-150',
                  isFilled
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'fill-gray-200 text-gray-200',
                  !readonly && 'hover:fill-yellow-300 hover:text-yellow-300'
                )}
              />
            </button>
          );
        })}
      </div>
      {showValue && (
        <span className="text-sm text-gray-600 ml-1">
          {value.toFixed(1)} / 5
        </span>
      )}
    </div>
  );
}

export default Rating;