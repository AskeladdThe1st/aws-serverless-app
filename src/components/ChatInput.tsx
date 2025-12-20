import { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Camera, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ModelAccessState, ModelSelector } from './ModelSelector';
import { ModeSelector, AnalysisModeId } from './ModeSelector';
import { ToolsMenu } from './ToolsMenu';

interface ChatInputProps {
  onSend: (text: string, images?: File[]) => void;
  disabled?: boolean;
  selectedModel: string;
  onModelChange: (model: string) => void;
  modelAccess?: (modelId: string) => ModelAccessState;
  onModelLockedSelect?: (modelId: string, access: ModelAccessState) => void;
  mode: AnalysisModeId;
  onModeChange: (mode: AnalysisModeId) => void;
  onToolSelect: (text: string) => void;
  inputValue?: string;
  onInputChange?: (value: string) => void;
}

export const ChatInput = ({ 
  onSend,
  disabled,
  selectedModel,
  onModelChange,
  modelAccess,
  onModelLockedSelect,
  mode,
  onModeChange,
  onToolSelect,
  inputValue,
  onInputChange
}: ChatInputProps) => {
  const [input, setInput] = useState('');
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  // Sync external input value
  useEffect(() => {
    if (inputValue !== undefined) {
      setInput(inputValue);
    }
  }, [inputValue]);

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
    const newValue = '';
    setInput(newValue);
    if (onInputChange) onInputChange(newValue);
    clearImages();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !(e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInputChange = (value: string) => {
    setInput(value);
    if (onInputChange) onInputChange(value);
  };

  const handleToolSelection = (text: string) => {
    const newValue = text;
    setInput(newValue);
    if (onInputChange) onInputChange(newValue);
    // Auto-focus and place cursor at the end
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newValue.length, newValue.length);
      }
    }, 0);
  };

  return (
    <div className="w-full p-4 md:p-6">
      {previewUrls.length > 0 && (
        <div className="mb-3 max-w-4xl mx-auto flex flex-wrap gap-2">
          {previewUrls.map((url, index) => (
            <div key={index} className="relative">
              <div className="w-24 h-24 rounded-lg border border-border overflow-hidden bg-muted">
                <img
                  src={url}
                  alt={`Preview ${index + 1}`}
                  className="w-full h-full object-contain"
                />
              </div>
              <button
                className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive hover:opacity-80 text-destructive-foreground flex items-center justify-center shadow-sm transition-opacity"
                onClick={() => removeImage(index)}
              >
                <X className="h-3 w-3" />
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

        <div className="flex flex-col gap-2 bg-card rounded-2xl px-4 py-3 border border-border shadow-lg">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Ask anything about math..."
            className="flex-1 bg-transparent border-0 outline-none text-foreground placeholder:text-muted-foreground disabled:opacity-50 text-base resize-none min-h-[24px] max-h-[200px]"
            disabled={disabled}
            rows={1}
          />

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled}
                className="text-muted-foreground hover:opacity-70 transition-opacity disabled:opacity-50 disabled:pointer-events-none p-1.5"
                aria-label="Attach file"
              >
                <Paperclip className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                disabled={disabled}
                className="text-muted-foreground hover:opacity-70 transition-opacity disabled:opacity-50 disabled:pointer-events-none p-1.5 md:hidden"
                aria-label="Take photo"
              >
                <Camera className="h-4 w-4" />
              </button>

              <ModeSelector value={mode} onValueChange={onModeChange} />
              <ToolsMenu onSelectTool={handleToolSelection} />
            </div>

            <div className="flex items-center gap-2">
              <ModelSelector
                value={selectedModel}
                onValueChange={onModelChange}
                accessForModel={modelAccess}
                onLockedSelect={onModelLockedSelect}
                variant="compact"
              />
              <button
                onClick={handleSubmit}
                disabled={disabled || (!input.trim() && selectedImages.length === 0)}
                className="shrink-0 h-9 w-9 rounded-full bg-primary hover:opacity-90 text-primary-foreground disabled:opacity-30 flex items-center justify-center transition-opacity"
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
