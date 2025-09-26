import { useState, useEffect, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Message, User } from "@shared/schema";
import { ArrowLeft, Send, Search, MessageSquare, Users } from "lucide-react";
import { format, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";

interface MessageWithSender extends Message {
  sender: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    profileImageUrl: string | null;
  };
}

interface Friend {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  profileImageUrl: string | null;
}

export default function ChatConversation() {
  const { id: conversationId } = useParams();
  const [, navigate] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const otherParticipantIdFromQuery = searchParams.get('with');
  
  const { user: authUser } = useAuth();
  const { toast } = useToast();
  
  const [messageText, setMessageText] = useState("");
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [otherParticipantId, setOtherParticipantId] = useState<string | null>(otherParticipantIdFromQuery);
  const [searchQuery, setSearchQuery] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Fetch conversation details to determine other participant if not provided
  const { data: conversation } = useQuery<any>({
    queryKey: ['/api/conversations', conversationId],
    enabled: !!conversationId && !otherParticipantIdFromQuery,
  });

  // Derive other participant ID from conversation data
  useEffect(() => {
    if (conversation && authUser && !otherParticipantIdFromQuery) {
      const otherId = conversation.user1Id === authUser.id 
        ? conversation.user2Id 
        : conversation.user1Id;
      setOtherParticipantId(otherId);
    }
  }, [conversation, authUser, otherParticipantIdFromQuery]);

  // Fetch conversation messages
  const { data: messages = [], isLoading } = useQuery<MessageWithSender[]>({
    queryKey: ['/api/conversations', conversationId, 'messages'],
    enabled: !!conversationId && !!authUser,
    refetchInterval: false, // We'll use WebSocket for real-time updates
  });

  // Fetch other participant info
  const { data: otherParticipant, isLoading: isLoadingParticipant, error: participantError } = useQuery<User>({
    queryKey: ['/api/users/by-id', otherParticipantId],
    queryFn: async () => {
      const response = await fetch(`/api/users/by-id/${otherParticipantId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch user');
      }
      return response.json();
    },
    enabled: !!otherParticipantId,
    retry: 2,
  });

  // Fetch friends for conversation selection - enable when no conversationId OR when participant loading fails
  const { data: friends = [] } = useQuery<Friend[]>({
    queryKey: ['/api/friends'],
    enabled: !!authUser && (!conversationId || !!participantError),
  });

  // Filter friends based on search query
  const filteredFriends = friends.filter(friend =>
    friend.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    friend.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    friend.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!conversationId || !otherParticipantId) throw new Error('Missing conversation or participant ID');
      
      return await apiRequest(`/api/conversations/${conversationId}/messages`, 'POST', {
        recipientId: otherParticipantId,
        content: content.trim(),
      });
    },
    onSuccess: (newMessage) => {
      setMessageText("");
      // Update messages cache if WebSocket is not available
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        queryClient.setQueryData(
          ['/api/conversations', conversationId, 'messages'],
          (oldMessages: MessageWithSender[] = []) => [...oldMessages, newMessage]
        );
        // Also invalidate conversations list to update last message
        queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      }
    },
    onError: (error) => {
      toast({
        title: "Erro ao enviar mensagem",
        description: error instanceof Error ? error.message : "Tente novamente",
        variant: "destructive",
      });
    },
  });

  // Mark messages as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (messageIds: string[]) => {
      return await apiRequest(`/api/conversations/${conversationId}/messages/read`, 'POST', {
        messageIds,
      });
    },
    onSuccess: () => {
      // Invalidate conversations list to update unread badges
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
    },
  });

  // Create new conversation mutation
  const createConversationMutation = useMutation({
    mutationFn: async (friendId: string) => {
      const response = await apiRequest('/api/conversations', 'POST', { friendId });
      return await response.json();
    },
    onSuccess: (conversation, friendId) => {
      navigate(`/chat/${conversation.id}?with=${friendId}`);
    },
    onError: (error) => {
      toast({
        title: "Erro ao criar conversa",
        description: error instanceof Error ? error.message : "Tente novamente",
        variant: "destructive",
      });
    },
  });

  // Setup WebSocket connection
  useEffect(() => {
    if (!authUser) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;
    
    const websocket = new WebSocket(wsUrl);
    
    websocket.onopen = () => {
      console.log('WebSocket connected');
      setWs(websocket);
    };

    websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'new_message':
            // Replace optimistic message or add new message
            queryClient.setQueryData(
              ['/api/conversations', conversationId, 'messages'],
              (oldMessages: MessageWithSender[] = []) => {
                // Remove any optimistic messages from the same sender
                const filtered = oldMessages.filter(msg => !msg.id.startsWith('temp-'));
                return [...filtered, data.message];
              }
            );
            
            // Invalidate conversations list to update last message and unread badges
            queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
            
            // Mark as read if it's from the other participant
            if (data.message?.senderId === otherParticipantId && data.message?.id) {
              markAsReadMutation.mutate([data.message.id]);
            }
            break;
            
          case 'messages_marked_read':
            // Update message read status
            queryClient.setQueryData(
              ['/api/conversations', conversationId, 'messages'],
              (oldMessages: MessageWithSender[] = []) =>
                oldMessages.map(msg => 
                  data.messageIds.includes(msg.id) 
                    ? { ...msg, readAt: new Date().toISOString() }
                    : msg
                )
            );
            break;
            
          case 'error':
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

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
      toast({
        title: "Erro de conexão",
        description: "Problema com a conexão em tempo real",
        variant: "destructive",
      });
    };

    websocket.onclose = () => {
      console.log('WebSocket disconnected');
      setWs(null);
    };

    return () => {
      websocket.close();
    };
  }, [authUser, conversationId, otherParticipantId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Mark unread messages as read when component mounts
  useEffect(() => {
    if (messages.length > 0 && authUser) {
      const unreadMessages = messages.filter(
        msg => !msg.readAt && msg.senderId !== authUser.id
      );
      
      if (unreadMessages.length > 0) {
        const messageIds = unreadMessages.map(msg => msg.id);
        markAsReadMutation.mutate(messageIds);
      }
    }
  }, [messages, authUser]);

  const handleSendMessage = () => {
    const content = messageText.trim();
    if (!content) return;
    
    if (ws && ws.readyState === WebSocket.OPEN) {
      // Optimistic UI update - add message immediately
      const optimisticMessage = {
        id: `temp-${Date.now()}`,
        conversationId: conversationId!,
        senderId: authUser!.id,
        content,
        readAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sender: {
          id: authUser!.id,
          username: authUser!.username || '',
          firstName: authUser!.firstName || '',
          lastName: authUser!.lastName || '',
          profileImageUrl: authUser!.profileImageUrl || null,
        }
      };
      
      // Update messages cache optimistically
      queryClient.setQueryData(
        ['/api/conversations', conversationId, 'messages'],
        (oldMessages: MessageWithSender[] = []) => [...oldMessages, optimisticMessage]
      );
      
      // Invalidate conversations list to update last message
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      
      // Send via WebSocket
      ws.send(JSON.stringify({
        type: 'chat_message',
        recipientId: otherParticipantId,
        content,
      }));
      setMessageText("");
    } else {
      // Fallback to HTTP request
      sendMessageMutation.mutate(content);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatMessageDate = (date: string) => {
    const messageDate = new Date(date);
    const now = new Date();
    
    if (isSameDay(messageDate, now)) {
      return format(messageDate, 'HH:mm');
    } else {
      return format(messageDate, 'dd/MM HH:mm', { locale: ptBR });
    }
  };

  if (isLoading || isLoadingParticipant) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="flex-1 animate-pulse">
          <div className="h-16 bg-muted"></div>
          <div className="flex-1 p-4 space-y-4">
            <div className="h-8 bg-muted rounded w-3/4"></div>
            <div className="h-8 bg-muted rounded w-1/2 ml-auto"></div>
            <div className="h-8 bg-muted rounded w-2/3"></div>
          </div>
        </div>
      </div>
    );
  }

  // Show error state for participant loading failure with retry option
  if (conversationId && otherParticipantId && participantError) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-border p-4 sticky top-0 z-30">
          <div className="flex items-center space-x-4">
            <Button
              onClick={() => navigate("/chat")}
              variant="ghost"
              size="sm"
              data-testid="button-back-to-chat"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h2 className="font-semibold text-foreground flex-1">Erro ao Carregar Conversa</h2>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <div className="text-muted-foreground mb-4 flex justify-center">
              <MessageSquare className="w-16 h-16" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">
              Erro ao carregar participante
            </h3>
            <p className="text-muted-foreground mb-6">
              Não foi possível carregar os dados do participante desta conversa.
            </p>
            <div className="space-y-3">
              <Button 
                onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/users', otherParticipantId] })}
                data-testid="button-retry-participant"
              >
                Tentar Novamente
              </Button>
              <Button 
                onClick={() => navigate("/chat")}
                variant="outline"
                data-testid="button-back-to-conversations"
              >
                Voltar às Conversas
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show friend selection interface when no conversation ID or no participant found
  if (!conversationId || !otherParticipant) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-border p-4 sticky top-0 z-30">
          <div className="flex items-center space-x-4">
            <Button
              onClick={() => navigate("/chat")}
              variant="ghost"
              size="sm"
              data-testid="button-back-to-chat"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h2 className="font-semibold text-foreground flex-1">Nova Conversa</h2>
          </div>
        </div>

        <div className="flex-1 p-4">
          {/* Search bar */}
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Buscar amigos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-friends"
            />
          </div>

          {/* Friends list */}
          {filteredFriends.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-muted-foreground mb-4 flex justify-center">
                <Users className="w-16 h-16" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">
                {friends.length === 0 ? "Nenhum amigo ainda" : "Nenhum amigo encontrado"}
              </h3>
              <p className="text-muted-foreground mb-4">
                {friends.length === 0 
                  ? "Adicione amigos para começar a conversar!" 
                  : "Tente buscar com um termo diferente"
                }
              </p>
              {friends.length === 0 && (
                <Button 
                  onClick={() => navigate("/friends")}
                  data-testid="button-go-to-friends"
                >
                  <Users className="w-4 h-4 mr-2" />
                  Ver Amigos
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center space-x-2 text-sm text-muted-foreground mb-4">
                <MessageSquare className="w-4 h-4" />
                <span>Selecione um amigo para iniciar conversa</span>
              </div>
              
              {filteredFriends.map((friend) => (
                <Card key={friend.id} className="cursor-pointer hover:bg-gray-50 transition-colors">
                  <CardContent className="p-4">
                    <div 
                      className="flex items-center space-x-3"
                      onClick={() => createConversationMutation.mutate(friend.id)}
                      data-testid={`button-start-chat-${friend.id}`}
                    >
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={friend.profileImageUrl || undefined} />
                        <AvatarFallback>
                          {friend.firstName?.[0]}
                          {friend.lastName?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-foreground truncate" data-testid={`friend-name-${friend.id}`}>
                          {friend.firstName} {friend.lastName}
                        </h4>
                        <p className="text-sm text-muted-foreground truncate" data-testid={`friend-username-${friend.id}`}>
                          @{friend.username}
                        </p>
                      </div>
                      <div className="text-muted-foreground">
                        <MessageSquare className="w-5 h-5" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {createConversationMutation.isPending && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 flex items-center space-x-3">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                <span className="text-foreground">Criando conversa...</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-border p-4 sticky top-0 z-30">
        <div className="flex items-center space-x-4">
          <Button
            onClick={() => navigate("/chat")}
            variant="ghost"
            size="sm"
            data-testid="button-back-to-chat"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <Avatar className="w-10 h-10">
            <AvatarImage src={otherParticipant.profileImageUrl || undefined} />
            <AvatarFallback>
              {otherParticipant.firstName?.[0]}{otherParticipant.lastName?.[0]}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h2 className="font-semibold text-foreground" data-testid="chat-participant-name">
              {otherParticipant.firstName} {otherParticipant.lastName}
            </h2>
            <p className="text-sm text-muted-foreground">
              @{otherParticipant.username}
            </p>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        <div className="space-y-4" data-testid="messages-container">
          {messages.map((message) => {
            const isOwnMessage = message.senderId === authUser?.id;
            
            return (
              <div
                key={message.id}
                className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                data-testid={`message-${message.id}`}
              >
                <div className={`flex items-start space-x-2 max-w-[80%] ${isOwnMessage ? 'flex-row-reverse space-x-reverse' : ''}`}>
                  {!isOwnMessage && (
                    <Avatar className="w-8 h-8 mt-1">
                      <AvatarImage src={message.sender.profileImageUrl || undefined} />
                      <AvatarFallback className="text-xs">
                        {message.sender.firstName?.[0]}{message.sender.lastName?.[0]}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  
                  <div className={`rounded-2xl px-4 py-2 ${
                    isOwnMessage 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-white border border-border'
                  }`}>
                    <p className="text-sm whitespace-pre-wrap" data-testid={`message-content-${message.id}`}>
                      {message.content}
                    </p>
                    <div className={`flex items-center justify-end mt-1 space-x-1 ${
                      isOwnMessage ? 'text-primary-foreground/70' : 'text-muted-foreground'
                    }`}>
                      <span className="text-xs" data-testid={`message-time-${message.id}`}>
                        {formatMessageDate(message.createdAt)}
                      </span>
                      {isOwnMessage && (
                        <span className="text-xs" data-testid={`message-read-status-${message.id}`}>
                          {message.readAt ? '✓✓' : '✓'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Message Input */}
      <div className="border-t border-border p-4 bg-white">
        <div className="flex space-x-2">
          <Textarea
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Digite sua mensagem..."
            className="min-h-[40px] max-h-[120px] resize-none"
            disabled={sendMessageMutation.isPending}
            data-testid="input-message"
          />
          <Button
            onClick={handleSendMessage}
            disabled={!messageText.trim() || sendMessageMutation.isPending}
            size="sm"
            className="shrink-0 h-[40px] w-[40px]"
            data-testid="button-send-message"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-muted-foreground">
            {ws?.readyState === WebSocket.OPEN 
              ? '🟢 Conectado' 
              : '🔴 Desconectado'
            }
          </span>
          {messageText.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {messageText.length}/1000
            </span>
          )}
        </div>
      </div>
    </div>
  );
}