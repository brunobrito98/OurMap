import { useState } from "react";
import { 
  FacebookShareButton, 
  TwitterShareButton, 
  WhatsappShareButton, 
  TelegramShareButton, 
  LinkedinShareButton,
  FacebookIcon,
  TwitterIcon,
  WhatsappIcon,
  TelegramIcon,
  LinkedinIcon
} from "react-share";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Share2, Copy, Check } from "lucide-react";

interface SocialShareModalProps {
  title: string;
  description?: string;
  imageUrl?: string;
  eventId: string;
  isPrivate?: boolean;
  shareableLink?: string;
}

export default function SocialShareModal({ 
  title, 
  description, 
  imageUrl, 
  eventId,
  isPrivate = false,
  shareableLink
}: SocialShareModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  // Construir URL completa do evento - use link compartilhável para eventos privados
  const eventUrl = isPrivate && shareableLink 
    ? `${window.location.origin}/invite/${shareableLink}`
    : `${window.location.origin}/event/${eventId}`;
  
  // Se é evento privado sem link compartilhável, não permitir compartilhamento
  const canShare = !isPrivate || (isPrivate && shareableLink);
  
  // Texto de compartilhamento com call-to-action
  const shareText = `${title} - Vem comigo para este evento incrível!`;
  const shareDescription = description 
    ? `${description.substring(0, 150)}...`
    : "Descubra este evento incrível na nossa plataforma!";

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(eventUrl);
      setCopied(true);
      toast({
        title: "Link copiado!",
        description: isPrivate ? "O link de convite foi copiado." : "O link do evento foi copiado para a área de transferência.",
      });
      setTimeout(() => {
        setCopied(false);
        setIsOpen(false); // Fechar modal após copiar
      }, 1500);
    } catch (err) {
      console.error('Erro ao copiar link:', err);
      toast({
        title: "Erro ao copiar",
        description: "Não foi possível copiar o link. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const shareOptions = [
    {
      Component: WhatsappShareButton,
      Icon: WhatsappIcon,
      label: "WhatsApp",
      color: "#25D366",
      props: { 
        url: eventUrl, 
        title: shareText,
        separator: " - "
      }
    },
    {
      Component: FacebookShareButton,
      Icon: FacebookIcon,
      label: "Facebook",
      color: "#1877F2",
      props: { 
        url: eventUrl, 
        quote: shareText,
        hashtag: "#eventos"
      }
    },
    {
      Component: TwitterShareButton,
      Icon: TwitterIcon,
      label: "Twitter/X",
      color: "#1DA1F2",
      props: { 
        url: eventUrl, 
        title: shareText,
        hashtags: ["eventos", "diversao"]
      }
    },
    {
      Component: LinkedinShareButton,
      Icon: LinkedinIcon,
      label: "LinkedIn",
      color: "#0A66C2",
      props: { 
        url: eventUrl,
        title: title,
        summary: shareDescription,
        source: "Event Platform"
      }
    },
    {
      Component: TelegramShareButton,
      Icon: TelegramIcon,
      label: "Telegram",
      color: "#0088CC",
      props: { 
        url: eventUrl, 
        title: shareText
      }
    }
  ];

  return (
    <>
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={() => {
          if (!canShare) {
            toast({
              title: "Compartilhamento não disponível",
              description: "Este evento privado não possui um link de convite configurado.",
              variant: "destructive",
            });
            return;
          }
          setIsOpen(true);
        }}
        data-testid="button-share"
        title="Compartilhar evento"
      >
        <Share2 className="w-5 h-5" />
      </Button>

      <Dialog open={isOpen && canShare} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="w-5 h-5" />
              Compartilhar Evento
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Pré-visualização do evento */}
            <div className="bg-accent/5 border border-border rounded-lg p-3">
              <h3 className="font-semibold text-sm truncate">{title}</h3>
              {description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2 break-words">
                  {shareDescription}
                </p>
              )}
            </div>

            {/* Botões de redes sociais */}
            <div className="grid grid-cols-2 gap-3">
              {shareOptions.map(({ Component, Icon, label, color, props }) => (
                <Component 
                  key={label} 
                  {...props}
                  onShareWindowClose={() => {
                    // Fechar modal após compartilhar (com pequeno delay)
                    setTimeout(() => setIsOpen(false), 500);
                  }}
                >
                  <div 
                    className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent/5 transition-colors cursor-pointer group"
                    data-testid={`button-share-${label.toLowerCase().replace('/', '-').replace(' ', '-')}`}
                  >
                    <Icon size={24} round />
                    <span className="text-sm font-medium group-hover:text-primary">
                      {label}
                    </span>
                  </div>
                </Component>
              ))}
            </div>

            {/* Botão copiar link */}
            <div className="border-t pt-4">
              <Button 
                onClick={handleCopyLink}
                variant="outline" 
                className="w-full"
                data-testid="button-copy-link"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 mr-2 text-green-600" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Copiar link do evento
                  </>
                )}
              </Button>
            </div>

            {/* Informação sobre o link */}
            <div className="text-xs text-muted-foreground text-center">
              {isPrivate 
                ? "Compartilhe este convite com pessoas específicas"
                : "Compartilhe este evento com seus amigos e familiares"}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}