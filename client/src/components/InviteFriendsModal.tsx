import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Search, Users, Send, Loader2 } from "lucide-react";
import type { User } from "@shared/schema";

interface InviteFriendsModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  eventTitle: string;
}

export default function InviteFriendsModal({ isOpen, onClose, eventId, eventTitle }: InviteFriendsModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch user's friends
  const { data: friends = [], isLoading: isLoadingFriends } = useQuery<User[]>({
    queryKey: ['/api/friends'],
    enabled: isOpen,
  });

  // Filter friends based on search query
  const filteredFriends = friends.filter(friend =>
    friend.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    friend.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    friend.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Send invites mutation
  const inviteMutation = useMutation({
    mutationFn: async (friendIds: string[]) => {
      return apiRequest(`/api/events/${eventId}/invite`, 'POST', { friendIds });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Convites enviados!",
        description: `${data.invitedCount} amigos foram convidados para o evento.`,
      });
      setSelectedFriends([]);
      onClose();
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['/api/events', eventId, 'invites'] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao enviar convites",
        description: error.message || "Não foi possível enviar os convites. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const handleFriendToggle = (friendId: string) => {
    setSelectedFriends(prev => 
      prev.includes(friendId) 
        ? prev.filter(id => id !== friendId)
        : [...prev, friendId]
    );
  };

  const handleSendInvites = () => {
    if (selectedFriends.length === 0) {
      toast({
        title: "Nenhum amigo selecionado",
        description: "Selecione pelo menos um amigo para convidar.",
        variant: "destructive",
      });
      return;
    }

    inviteMutation.mutate(selectedFriends);
  };

  const handleClose = () => {
    setSelectedFriends([]);
    setSearchQuery("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[600px] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Convidar Amigos
          </DialogTitle>
          <DialogDescription>
            Selecione os amigos que você gostaria de convidar para "{eventTitle}".
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar amigos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-friends"
            />
          </div>

          {/* Friends List */}
          <ScrollArea className="flex-1 min-h-[300px] max-h-[350px] border rounded-md p-2">
            {isLoadingFriends ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="ml-2">Carregando amigos...</span>
              </div>
            ) : filteredFriends.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery ? 'Nenhum amigo encontrado' : 'Você ainda não tem amigos adicionados'}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredFriends.map((friend) => (
                  <div
                    key={friend.id}
                    className="flex items-center space-x-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                    onClick={() => handleFriendToggle(friend.id)}
                    data-testid={`friend-item-${friend.id}`}
                  >
                    <Checkbox
                      checked={selectedFriends.includes(friend.id)}
                      onChange={() => handleFriendToggle(friend.id)}
                      data-testid={`checkbox-friend-${friend.id}`}
                    />
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={friend.profileImageUrl || undefined} />
                      <AvatarFallback>
                        {friend.firstName?.[0]}{friend.lastName?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {friend.firstName} {friend.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        @{friend.username}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Selected Count */}
          {selectedFriends.length > 0 && (
            <div className="text-sm text-muted-foreground text-center">
              {selectedFriends.length} amigo{selectedFriends.length !== 1 ? 's' : ''} selecionado{selectedFriends.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} data-testid="button-cancel">
            Cancelar
          </Button>
          <Button 
            onClick={handleSendInvites}
            disabled={selectedFriends.length === 0 || inviteMutation.isPending}
            data-testid="button-send-invites"
          >
            {inviteMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Enviar Convites ({selectedFriends.length})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}