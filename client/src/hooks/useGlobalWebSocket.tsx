import { useEffect, useRef, createContext, useContext, ReactNode, useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';

interface WebSocketContextType {
  isConnected: boolean;
  sendMessage: (message: any) => void;
}

const WebSocketContext = createContext<WebSocketContextType>({
  isConnected: false,
  sendMessage: () => {},
});

export const useGlobalWebSocket = () => useContext(WebSocketContext);

interface WebSocketProviderProps {
  children: ReactNode;
}

export function WebSocketProvider({ children }: WebSocketProviderProps) {
  const { user: authUser } = useAuth();
  const { toast } = useToast();
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connectWebSocket = () => {
    if (!authUser) return;

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/ws`;
      
      console.log('Connecting to WebSocket:', wsUrl);
      const websocket = new WebSocket(wsUrl);
      
      websocket.onopen = () => {
        console.log('Global WebSocket connected');
        wsRef.current = websocket;
        setIsConnected(true);
        reconnectAttempts.current = 0;
      };

      websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('WebSocket message received:', data.type);
          
          switch (data.type) {
            case 'new_notification':
              // Handle real-time notification updates
              console.log('New notification received:', data.notification);
              
              // Invalidate notifications query to refresh the list
              queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
              
              // Invalidate notification count to update the badge
              queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
              
              // Show a toast notification for immediate feedback
              if (data.notification?.type === 'chat_message') {
                toast({
                  title: data.notification.title,
                  description: data.notification.message,
                  duration: 3000,
                });
              }
              break;
              
            case 'new_message':
              // Handle chat messages - invalidate conversations
              queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
              
              // Update specific conversation messages if conversation is open
              if (data.message?.conversationId) {
                queryClient.invalidateQueries({ 
                  queryKey: ['/api/conversations', data.message.conversationId, 'messages'] 
                });
              }
              break;
              
            case 'messages_marked_read':
              // Update message read status
              queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
              if (data.conversationId) {
                queryClient.invalidateQueries({ 
                  queryKey: ['/api/conversations', data.conversationId, 'messages'] 
                });
              }
              break;
              
            case 'auth_success':
              console.log('WebSocket authentication successful');
              break;
              
            case 'error':
              console.error('WebSocket error:', data.message);
              toast({
                title: "Erro de conexão",
                description: data.message,
                variant: "destructive",
              });
              break;
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      websocket.onclose = (event) => {
        console.log('Global WebSocket disconnected:', event.code, event.reason);
        wsRef.current = null;
        setIsConnected(false);
        
        // Only attempt to reconnect if user is still authenticated and it wasn't a manual close
        if (authUser && event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 10000);
          console.log(`Attempting to reconnect in ${delay}ms (attempt ${reconnectAttempts.current + 1}/${maxReconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            connectWebSocket();
          }, delay);
        }
      };

      websocket.onerror = (error) => {
        console.error('Global WebSocket error:', error);
        setIsConnected(false);
      };
      
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
    }
  };

  const sendMessage = (message: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected, cannot send message:', message);
    }
  };

  // Setup WebSocket connection when user is authenticated
  useEffect(() => {
    if (authUser) {
      connectWebSocket();
    } else {
      // Clean up WebSocket when user logs out
      if (wsRef.current) {
        wsRef.current.close(1000, 'User logged out');
        wsRef.current = null;
      }
      setIsConnected(false);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      reconnectAttempts.current = 0;
    }

    // Cleanup on unmount
    return () => {
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounted');
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [authUser]);

  const contextValue = useMemo<WebSocketContextType>(() => ({
    isConnected,
    sendMessage,
  }), [isConnected]);

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
}