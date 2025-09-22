import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface ProfileImageUploadProps {
  onImageSelect: (file: File | null) => void;
  currentImageUrl?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function ProfileImageUpload({ 
  onImageSelect, 
  currentImageUrl, 
  className = "",
  size = 'md'
}: ProfileImageUploadProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImageUrl || null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Size configurations
  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-24 h-24',
    lg: 'w-32 h-32'
  };

  const iconSizes = {
    sm: 'text-sm',
    md: 'text-base', 
    lg: 'text-xl'
  };

  const handleFileSelect = useCallback((file: File) => {
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Tipo de arquivo inválido",
        description: "Apenas JPEG, PNG e WebP são permitidos.",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "O tamanho máximo é 5MB.",
        variant: "destructive",
      });
      return;
    }

    // Revoke old URL if exists
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }

    // Create preview URL
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    onImageSelect(file);
  }, [onImageSelect, previewUrl, toast]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    
    const file = event.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleRemove = () => {
    // Revoke URL if it's a blob URL
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    onImageSelect(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Cleanup effect to revoke object URLs on unmount
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  return (
    <div className={className}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleInputChange}
        className="hidden"
        data-testid="input-profile-image-upload"
      />
      
      <div className="flex flex-col items-center space-y-3">
        {previewUrl ? (
          <div className="relative group">
            <img
              src={previewUrl}
              alt="Foto de perfil"
              className={`${sizeClasses[size]} object-cover rounded-full border-2 border-border`}
              data-testid="img-profile-preview"
            />
            <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                 onClick={handleClick}>
              <i className={`fas fa-camera text-white ${iconSizes[size]}`}></i>
            </div>
          </div>
        ) : (
          <div
            className={`${sizeClasses[size]} border-2 border-dashed rounded-full flex items-center justify-center transition-colors cursor-pointer ${
              dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleClick}
            data-testid="div-profile-upload-area"
          >
            <i className={`fas fa-user text-muted-foreground ${iconSizes[size]}`}></i>
          </div>
        )}

        <div className="text-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClick}
            className="flex items-center space-x-2"
            data-testid="button-select-profile-image"
          >
            <i className="fas fa-camera"></i>
            <span>{previewUrl ? 'Alterar foto' : 'Adicionar foto'}</span>
          </Button>
          
          {previewUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              className="mt-2 text-destructive hover:text-destructive hover:bg-destructive/10"
              data-testid="button-remove-profile-image"
            >
              <i className="fas fa-trash mr-2"></i>
              Remover foto
            </Button>
          )}
        </div>

        <p className="text-xs text-muted-foreground text-center">
          JPG, PNG, WebP até 5MB
        </p>
      </div>
    </div>
  );
}