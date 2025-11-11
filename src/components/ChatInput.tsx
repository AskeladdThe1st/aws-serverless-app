import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Send, Paperclip, Camera, X } from 'lucide-react';
import { toast } from 'sonner';

interface ChatInputProps {
  onSend: (text: string, image?: File) => void;
  disabled?: boolean;
  initialValue?: string;
  onClear?: () => void;
}

export const ChatInput = ({ onSend, disabled, initialValue = '', onClear }: ChatInputProps) => {
  const [input, setInput] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Update input when initialValue changes (from example problems)
  useEffect(() => {
    if (initialValue) {
      setInput(initialValue);
      if (onClear) {
        onClear();
      }
    }
  }, [initialValue, onClear]);

  const handleImageSelect = (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image too large. Please select an image under 10MB');
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
    if (cameraInputRef.current) cameraInputRef.current.value = '';
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
    <div>
      {previewUrl && (
        <div className="mb-3 relative inline-block">
          <img
            src={previewUrl}
            alt="Preview"
            className="max-h-32 rounded-lg border border-[#444]"
          />
          <button
            className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center"
            onClick={clearImage}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

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

      <div className="flex items-center gap-2 bg-[#2f2f2f] rounded-3xl px-4 py-3 border border-[#444]">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder="Ask a calculus question..."
          className="flex-1 bg-transparent border-0 outline-none text-white placeholder:text-[#8e8e8e] disabled:opacity-50 text-[15px]"
          disabled={disabled}
        />

        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          disabled={disabled}
          className="text-[#8e8e8e] hover:text-white transition-colors disabled:opacity-50 disabled:pointer-events-none p-1 md:hidden"
          aria-label="Take photo"
        >
          <Camera className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="text-[#8e8e8e] hover:text-white transition-colors disabled:opacity-50 disabled:pointer-events-none p-1"
          aria-label="Attach file"
        >
          <Paperclip className="h-5 w-5" />
        </button>

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
  );
};
