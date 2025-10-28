import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Send, Paperclip } from 'lucide-react';
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
    <div className="bg-[#212121] border-t border-[#2f2f2f] p-4">
      {previewUrl && (
        <div className="mb-3 max-w-3xl mx-auto relative inline-block">
          <img
            src={previewUrl}
            alt="Preview"
            className="max-h-32 rounded-lg border border-[#444]"
          />
          <button
            className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center text-lg font-semibold"
            onClick={clearImage}
          >
            ×
          </button>
        </div>
      )}

      <div className="max-w-3xl mx-auto">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        <div className="flex items-end gap-2 bg-[#2f2f2f] rounded-3xl px-4 py-3 border border-[#444]">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="text-[#8e8e8e] hover:text-white transition-colors disabled:opacity-50 disabled:pointer-events-none p-1"
            aria-label="Attach file"
          >
            <Paperclip className="h-5 w-5" />
          </button>

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Message Calculus Agent"
            className="flex-1 bg-transparent border-0 outline-none text-white placeholder:text-[#8e8e8e] disabled:opacity-50 text-[15px]"
            disabled={disabled}
          />

          <button
            onClick={handleSubmit}
            disabled={disabled || (!input.trim() && !selectedImage)}
            className="shrink-0 h-8 w-8 rounded-full bg-white hover:bg-gray-200 disabled:bg-[#676767] disabled:opacity-50 flex items-center justify-center transition-colors"
            aria-label="Send message"
          >
            <Send className="h-4 w-4 text-black" />
          </button>
        </div>
      </div>
    </div>
  );
};
