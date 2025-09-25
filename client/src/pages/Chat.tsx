import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import BottomNavigation from "@/components/BottomNavigation";
import { useAuth } from "@/hooks/useAuth";
import type { Conversation, Message } from "@shared/schema";
import { ArrowLeft, MessageSquare, Search } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ConversationWithLastMessage extends Conversation {
  lastMessage?: Message;
  unreadCount: number;
  otherParticipant: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    profileImageUrl: string | null;
  };
}

export default function Chat() {
  const [, navigate] = useLocation();
  const { user: authUser } = useAuth();
  const searchParams = new URLSearchParams(window.location.search);
  const startChatWithUserId = searchParams.get('start');

  // Fetch conversations
  const { data: conversations = [], isLoading } = useQuery<ConversationWithLastMessage[]>({
    queryKey: ['/api/conversations'],
    enabled: !!authUser,
    refetchInterval: 5000, // Refresh every 5 seconds to show new messages
  });

  // Mutation to create or get conversation
  const createConversationMutation = useMutation({
    mutationFn: async (otherUserId: string) => {
      return await apiRequest('/api/conversations', 'POST', { userId: otherUserId });
    },
    onSuccess: (conversation, otherUserId) => {
      navigate(`/chat/${conversation.id}?with=${otherUserId}`);
    },
    onError: (error) => {
      console.error('Failed to create conversation:', error);
      navigate('/friends');
    },
  });

  // Handle starting a new chat
  useEffect(() => {
    if (startChatWithUserId && authUser && !createConversationMutation.isPending) {
      // Try to find existing conversation first
      const existingConversation = conversations.find(conv => 
        conv.otherParticipant.id === startChatWithUserId
      );
      
      if (existingConversation) {
        // Navigate to existing conversation
        navigate(`/chat/${existingConversation.id}?with=${startChatWithUserId}`);
      } else {
        // Create new conversation
        createConversationMutation.mutate(startChatWithUserId);
      }
    }
  }, [startChatWithUserId, conversations, authUser, navigate]);

  const handleOpenConversation = (conversationId: string, otherParticipantId: string) => {
    navigate(`/chat/${conversationId}?with=${otherParticipantId}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="animate-pulse">
          <div className="h-16 bg-muted"></div>
          <div className="p-4 space-y-4">
            <div className="h-20 bg-muted rounded"></div>
            <div className="h-20 bg-muted rounded"></div>
            <div className="h-20 bg-muted rounded"></div>
          </div>
        </div>
        <BottomNavigation activeTab="friends" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-white border-b border-border p-4 sticky top-0 z-30">
        <div className="flex items-center space-x-4">
          <Button
            onClick={() => navigate("/friends")}
            variant="ghost"
            size="sm"
            data-testid="button-back-to-friends"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h2 className="font-semibold text-foreground flex-1">Mensagens</h2>
          <Button
            onClick={() => navigate("/friends")}
            variant="ghost"
            size="sm"
            data-testid="button-new-chat"
          >
            <Search className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <div className="p-4">
        {conversations.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-muted-foreground mb-4 flex justify-center">
              <MessageSquare className="w-16 h-16" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">
              Nenhuma conversa ainda
            </h3>
            <p className="text-muted-foreground mb-4">
              Comece uma conversa enviando uma mensagem para um amigo!
            </p>
            <Button 
              onClick={() => navigate("/friends")}
              data-testid="button-start-chatting"
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Iniciar Conversa
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {conversations.map((conversation) => (
              <div
                key={conversation.id}
                className="bg-white rounded-lg border border-border p-4 shadow-sm cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => handleOpenConversation(conversation.id, conversation.otherParticipant.id)}
                data-testid={`conversation-${conversation.id}`}
              >
                <div className="flex items-center space-x-3">
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={conversation.otherParticipant.profileImageUrl || undefined} />
                    <AvatarFallback>
                      {conversation.otherParticipant.firstName?.[0]}
                      {conversation.otherParticipant.lastName?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-foreground truncate" data-testid={`conversation-name-${conversation.id}`}>
                        {conversation.otherParticipant.firstName} {conversation.otherParticipant.lastName}
                      </h4>
                      <div className="flex items-center space-x-2">
                        {conversation.lastMessage && conversation.lastMessage.createdAt && (
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(conversation.lastMessage.createdAt), {
                              addSuffix: true,
                              locale: ptBR,
                            })}
                          </span>
                        )}
                        {conversation.unreadCount > 0 && (
                          <Badge variant="destructive" data-testid={`unread-count-${conversation.id}`}>
                            {conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}
                          </Badge>
                        )}
                      </div>
                    </div>
                    {conversation.lastMessage && (
                      <p className="text-sm text-muted-foreground truncate mt-1" data-testid={`last-message-${conversation.id}`}>
                        {conversation.lastMessage.senderId === authUser?.id ? 'Você: ' : ''}
                        {conversation.lastMessage.content}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomNavigation activeTab="friends" />
    </div>
  );
}