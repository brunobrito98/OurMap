import { useLocation } from 'wouter';

interface BottomNavigationProps {
  activeTab: 'home' | 'search' | 'friends' | 'profile';
}

export default function BottomNavigation({ activeTab }: BottomNavigationProps) {
  const [, navigate] = useLocation();

  const tabs = [
    { id: 'home', icon: 'fas fa-home', label: 'Início', path: '/home' },
    { id: 'search', icon: 'fas fa-search', label: 'Buscar', path: '/search' },
    { id: 'friends', icon: 'fas fa-users', label: 'Amigos', path: '/friends' },
    { id: 'profile', icon: 'fas fa-user', label: 'Perfil', path: '/profile' },
  ];

  return (
    <div className="fixed bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-md bg-white border-t border-border z-40">
      <div className="flex">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => navigate(tab.path)}
            className={`flex-1 py-3 px-2 text-center transition-colors ${
              activeTab === tab.id ? 'text-primary' : 'text-muted-foreground'
            }`}
            data-testid={`nav-${tab.id}`}
          >
            <i className={`${tab.icon} text-xl mb-1 block`}></i>
            <span className={`text-xs ${activeTab === tab.id ? 'font-medium' : ''}`}>
              {tab.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
