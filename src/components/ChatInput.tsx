import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Send, Paperclip, Camera, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ChatInputProps {
  onSend: (text: string, images?: File[]) => void;
  disabled?: boolean;
}

export const ChatInput = ({ onSend, disabled }: ChatInputProps) => {
  const [input, setInput] = useState('');
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  // Handle paste events for images
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const imageFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) imageFiles.push(file);
        }
      }

      if (imageFiles.length > 0) {
        e.preventDefault();
        handleImageSelect(imageFiles);
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + Enter to send
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
      
      // Focus input with Cmd/Ctrl + K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        textareaRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [input, selectedImages, disabled]);

  const handleImageSelect = (files: File[]) => {
    const validFiles: File[] = [];
    const urls: string[] = [];

    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: 'Image too large',
          description: `${file.name} is over 10MB`,
          variant: 'destructive',
        });
        continue;
      }
      validFiles.push(file);
      urls.push(URL.createObjectURL(file));
    }

    setSelectedImages(prev => [...prev, ...validFiles]);
    setPreviewUrls(prev => [...prev, ...urls]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleImageSelect(Array.from(files));
    }
  };

  const removeImage = (index: number) => {
    URL.revokeObjectURL(previewUrls[index]);
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  const clearImages = () => {
    previewUrls.forEach(url => URL.revokeObjectURL(url));
    setSelectedImages([]);
    setPreviewUrls([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = () => {
    if ((!input.trim() && selectedImages.length === 0) || disabled) return;

    onSend(input, selectedImages.length > 0 ? selectedImages : undefined);
    setInput('');
    clearImages();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !(e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="bg-card border-t border-border p-4 md:p-6">
      {previewUrls.length > 0 && (
        <div className="mb-3 max-w-4xl mx-auto flex flex-wrap gap-2">
          {previewUrls.map((url, index) => (
            <div key={index} className="relative inline-block">
              <img
                src={url}
                alt={`Preview ${index + 1}`}
                className="max-h-32 rounded-xl border border-border"
              />
              <button
                className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive hover:bg-destructive/90 text-destructive-foreground flex items-center justify-center"
                onClick={() => removeImage(index)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="max-w-4xl mx-auto">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
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

        <div className="flex items-center gap-3 bg-input rounded-xl px-5 py-4 border border-border focus-within:border-ring transition-colors">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Message Calculus Agent (⌘K to focus, ⌘⏎ or ⏎ to send, ⌘V to paste images)"
            className="flex-1 bg-transparent border-0 outline-none text-foreground placeholder:text-muted-foreground disabled:opacity-50 text-base resize-none min-h-[24px] max-h-[200px]"
            disabled={disabled}
            rows={1}
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
            disabled={disabled || (!input.trim() && selectedImages.length === 0)}
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
