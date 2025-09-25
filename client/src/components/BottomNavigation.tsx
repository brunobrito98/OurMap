import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { Home, Search, Users, User, Bell } from 'lucide-react';

interface BottomNavigationProps {
  activeTab: 'home' | 'search' | 'friends' | 'notifications' | 'profile';
}

export default function BottomNavigation({ activeTab }: BottomNavigationProps) {
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();

  // Fetch unread notifications count for authenticated users
  const { data: unreadData } = useQuery({
    queryKey: ['/api/notifications/unread-count'],
    enabled: isAuthenticated,
    staleTime: 1000 * 30, // 30 seconds
    refetchInterval: 1000 * 60, // 1 minute
  });
  
  const unreadCount = (unreadData as any)?.count || 0;

  const tabs = [
    { id: 'home', icon: Home, label: 'Início', path: '/', requiresAuth: false },
    { id: 'search', icon: Search, label: 'Buscar', path: '/search', requiresAuth: false },
    { id: 'friends', icon: Users, label: 'Amigos', path: '/friends', requiresAuth: true },
    { id: 'notifications', icon: Bell, label: 'Notificações', path: '/notifications', requiresAuth: true, hasNotification: unreadCount > 0 },
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
              {tab.id === 'notifications' && unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
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
