import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export default function FloatingCreateButton() {
  const [, navigate] = useLocation();

  return (
    <Button
      onClick={() => navigate('/create')}
      className="fixed bottom-20 right-4 w-14 h-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 z-50"
      data-testid="button-create-event"
    >
      <Plus className="w-6 h-6" />
    </Button>
  );
}
