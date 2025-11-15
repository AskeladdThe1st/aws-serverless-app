import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Send, Paperclip, Camera } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ChatInputProps {
  onSend: (text: string, image?: File) => void;
  disabled?: boolean;
}

export const ChatInput = ({ onSend, disabled }: ChatInputProps) => {
  const [input, setInput] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleImageSelect = (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'Image too large',
        description: 'Please select an image under 10MB',
        variant: 'destructive',
      });
      return;
    }

    setSelectedImage(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageSelect(file);
  };

  const clearImage = () => {
    setSelectedImage(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = () => {
    if ((!input.trim() && !selectedImage) || disabled) return;

    onSend(input, selectedImage || undefined);
    setInput('');
    clearImage();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="bg-card border-t border-border p-4 md:p-6">
      {previewUrl && (
        <div className="mb-3 max-w-4xl mx-auto relative inline-block">
          <img
            src={previewUrl}
            alt="Preview"
            className="max-h-32 rounded-xl border border-border"
          />
          <button
            className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive hover:bg-destructive/90 text-destructive-foreground flex items-center justify-center text-lg font-semibold"
            onClick={clearImage}
          >
            ×
          </button>
        </div>
      )}

      <div className="max-w-4xl mx-auto">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
        />

        <div className="flex items-center gap-3 bg-input rounded-xl px-5 py-4 border border-border focus-within:border-primary transition-colors">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Message Calculus Agent"
            className="flex-1 bg-transparent border-0 outline-none text-foreground placeholder:text-muted-foreground disabled:opacity-50 text-base"
            disabled={disabled}
          />

          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={disabled}
            className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 disabled:pointer-events-none p-1 md:hidden"
            aria-label="Take photo"
          >
            <Camera className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 disabled:pointer-events-none p-1"
            aria-label="Attach file"
          >
            <Paperclip className="h-5 w-5" />
          </button>

          <button
            onClick={handleSubmit}
            disabled={disabled || (!input.trim() && !selectedImage)}
            className="shrink-0 h-10 w-10 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50 flex items-center justify-center transition-colors"
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
