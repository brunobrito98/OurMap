import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';

interface ImageUploadProps {
  onImageSelect: (file: File | null) => void;
  currentImageUrl?: string;
  className?: string;
}

export default function ImageUpload({ 
  onImageSelect, 
  currentImageUrl, 
  className = "" 
}: ImageUploadProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImageUrl || null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((file: File) => {
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      alert('Tipo de arquivo inválido. Apenas JPEG, PNG e WebP são permitidos.');
      return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      alert('Arquivo muito grande. O tamanho máximo é 5MB.');
      return;
    }

    // Create preview URL
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    onImageSelect(file);
  }, [onImageSelect]);

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
    setPreviewUrl(null);
    onImageSelect(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className={className}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleInputChange}
        className="hidden"
        data-testid="input-image-upload"
      />
      
      {previewUrl ? (
        <div className="relative">
          <img
            src={previewUrl}
            alt="Preview"
            className="w-full h-48 object-cover rounded-2xl"
            data-testid="img-preview"
          />
          <div className="absolute inset-0 bg-black/40 rounded-2xl flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
            <div className="flex space-x-2">
              <Button
                onClick={handleClick}
                variant="secondary"
                size="sm"
                data-testid="button-change-image"
              >
                <i className="fas fa-edit mr-2"></i>Alterar
              </Button>
              <Button
                onClick={handleRemove}
                variant="destructive"
                size="sm"
                data-testid="button-remove-image"
              >
                <i className="fas fa-trash mr-2"></i>Remover
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div
          className={`border-2 border-dashed rounded-2xl p-8 text-center transition-colors cursor-pointer ${
            dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleClick}
          data-testid="div-upload-area"
        >
          <div className="space-y-3">
            <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto">
              <i className="fas fa-camera text-2xl text-muted-foreground"></i>
            </div>
            <div>
              <p className="text-muted-foreground">Adicione uma foto de capa</p>
              <p className="text-xs text-muted-foreground">
                Arraste e solte ou clique para selecionar
              </p>
              <p className="text-xs text-muted-foreground">JPG, PNG, WebP até 5MB</p>
            </div>
            <Button type="button" className="mt-3 flex items-center space-x-2" data-testid="button-select-image">
              <i className="fas fa-image"></i>
              <span>Selecionar foto</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
