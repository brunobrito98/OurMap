import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Home, Search, Users, User } from 'lucide-react';

interface BottomNavigationProps {
  activeTab: 'home' | 'search' | 'friends' | 'profile';
}

export default function BottomNavigation({ activeTab }: BottomNavigationProps) {
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();


  const tabs = [
    { id: 'home', icon: Home, label: 'Início', path: '/', requiresAuth: false },
    { id: 'search', icon: Search, label: 'Buscar', path: '/search', requiresAuth: false },
    { id: 'friends', icon: Users, label: 'Amigos', path: '/friends', requiresAuth: true },
    { id: 'profile', icon: User, label: 'Perfil', path: '/profile', requiresAuth: true },
  ];
  
  const handleTabClick = (tab: typeof tabs[0]) => {
    if (tab.requiresAuth && !isAuthenticated) {
      toast({
        title: "Login necessário",
        description: `Faça login para acessar ${tab.label}!`,
        variant: "destructive",
      });
      navigate(`/login?redirect=${encodeURIComponent(tab.path)}`);
      return;
    }
    
    navigate(tab.path);
  };

  return (
    <div className="fixed bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-md bg-white border-t border-border z-40">
      <div className="flex">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab)}
            className={`flex-1 py-3 px-2 text-center transition-colors relative ${
              activeTab === tab.id ? 'text-primary' : 'text-muted-foreground'
            } ${tab.requiresAuth && !isAuthenticated ? 'opacity-60' : ''}`}
            data-testid={`nav-${tab.id}`}
          >
            <div className="relative inline-block">
              <tab.icon className="w-5 h-5 mb-1" />
            </div>
            <span className={`text-xs ${activeTab === tab.id ? 'font-medium' : ''}`}>
              {tab.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
