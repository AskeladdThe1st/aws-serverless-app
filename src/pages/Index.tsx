import { useState, useEffect, useRef, useCallback } from 'react';
import { ChatMessage, Message } from '@/components/ChatMessage';
import { ChatInput } from '@/components/ChatInput';
import { ChatSidebar, Chat } from '@/components/ChatSidebar';
import { SettingsDialog } from '@/components/SettingsDialog';
import { PricingModal } from '@/components/PricingModal';
import { LoginModal } from '@/components/LoginModal';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { fileToBase64, createChat, listChats, loadChat, deleteChat as deleteSessionChat, getOrCreateUserId, updateChatTitle, fetchUsage, createCheckoutSession, getProfile, updateProfile } from '@/lib/lambda';
import { MODEL_OPTIONS, ModelAccessState } from '@/components/ModelSelector';
import { DEFAULT_PERSONA_ID, PERSONA_OPTIONS, PRESET_AVATARS } from '@/components/personas';
import { ModeStatus } from '@/components/ModeStatus';
import { AnalysisModeId } from '@/components/ModeSelector';
import { Calculator, Settings } from 'lucide-react';

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  awaitingClarification?: boolean; // Track if we're waiting for user clarification
  clarificationImages?: string[]; // Store base64 images for clarification
  clarificationImagePreview?: string; // Store the image_preview from backend response
}


const Index = () => {
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingChats, setIsFetchingChats] = useState(true);
  const [mode, setMode] = useState<AnalysisModeId>('auto');
  const [selectedModel, setSelectedModel] = useState('gpt-4o-mini');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPricingOpen, setIsPricingOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [showMoreSteps, setShowMoreSteps] = useState(false);
  const [conciseAnswers, setConciseAnswers] = useState(false);
  const [sympyVerification, setSympyVerification] = useState(true);
  const [usage, setUsage] = useState<any>(null);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);
  const [profile, setProfile] = useState<{ persona: string; avatarUrl?: string }>({ persona: DEFAULT_PERSONA_ID });
  const [isAvatarUploading, setIsAvatarUploading] = useState(false);
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const activeRequestRef = useRef<{ sessionId: string; requestId: string } | null>(null);

  /**
   * Normalize messages coming from the backend. The Lambda payload may use
   * slightly different field names or content encodings depending on the
   * deployed version. This guarantees the UI always receives Message objects
   * with a string `content` and optional metadata we can render.
   */
  const normalizeMessages = useCallback((payload: any): Message[] => {
    const rawMessages =
      payload?.messages ||
      payload?.Messages ||
      payload?.chat?.messages ||
      payload?.session?.messages ||
      [];

    if (!Array.isArray(rawMessages)) return [];

    return rawMessages.map((msg: any): Message => {
      const role: 'user' | 'assistant' = msg?.role === 'assistant' ? 'assistant' : 'user';
      const contentRaw = msg?.content ?? msg?.message ?? msg?.text ?? '';

      let content = '';
      let imageUrls: string[] | undefined;

      if (Array.isArray(contentRaw)) {
        // Handle OpenAI multi-part messages that include text + images
        const textParts = contentRaw
          .filter(part => part?.type === 'text' && typeof part.text === 'string')
          .map(part => part.text);
        const imageParts = contentRaw
          .filter(part => part?.type === 'image_url' && part.image_url?.url)
          .map(part => part.image_url.url as string);
        content = textParts.join('\n\n');
        imageUrls = imageParts.length ? imageParts : undefined;
      } else if (typeof contentRaw === 'object' && contentRaw !== null) {
        content = contentRaw.text || contentRaw.content || JSON.stringify(contentRaw);
      } else {
        content = String(contentRaw ?? '');
      }

      // Prefer explicit message-level images, but fall back to images embedded in content
      const mergedImageUrls =
        msg?.imageUrls ||
        (msg?.images && Array.isArray(msg.images) ? msg.images : undefined) ||
        (msg?.imageUrl ? [msg.imageUrl] : undefined) ||
        imageUrls;

      return {
        role,
        content,
        expression: msg?.expression || msg?.code || '',
        result: msg?.result || msg?.answer || '',
        steps: msg?.steps || msg?.explanation || '',
        image_preview: msg?.image_preview,
        imageUrls: mergedImageUrls,
      };
    });
  }, []);

  const LAMBDA_URL = 'https://cdyibmzy64skc2ikp74qebsicq0nggic.lambda-url.us-east-1.on.aws/';

  const getIdentity = useCallback(() => {
    const userId = user ? (user as any).sub || user.email : getOrCreateUserId();
    const userRole: 'guest' | 'user' = user ? 'user' : 'guest';
    return { userId, userRole };
  }, [user]);

  const getPlan = useCallback((): 'guest' | 'free' | 'student' | 'pro' => {
    const status = (usage?.subscription_status || '').toLowerCase();
    let plan = (usage?.plan || (user ? 'free' : 'guest')).toLowerCase();
    if (plan === 'guest' && user) plan = 'free';
    if (!['guest', 'free', 'student', 'pro'].includes(plan)) {
      plan = user ? 'free' : 'guest';
    }
    if (!['pro', 'student'].includes(plan) && ['active', 'trialing', 'past_due'].includes(status)) {
      plan = 'student';
    }
    return plan as 'guest' | 'free' | 'student' | 'pro';
  }, [usage?.plan, usage?.subscription_status, user]);

  const getModelAccess = useCallback((modelId: string): ModelAccessState => {
    const plan = getPlan();
    const model = MODEL_OPTIONS.find(m => m.id === modelId) || MODEL_OPTIONS[0];
    if (model.tier === 'pro') {
      return { locked: plan !== 'pro', reason: plan === 'guest' ? 'login' : 'upgrade', tier: model.tier };
    }
    if (model.tier === 'student' && plan === 'guest') {
      return { locked: true, reason: 'login', tier: model.tier };
    }
    return { locked: false, tier: model.tier };
  }, [getPlan]);

  const getPersonaAccess = useCallback((personaId: string): { locked: boolean; reason?: 'login' | 'upgrade'; tier: string } => {
    const plan = getPlan();
    const persona = PERSONA_OPTIONS.find(p => p.id === personaId) || PERSONA_OPTIONS[0];
    if (persona.tier === 'pro') {
      return { locked: plan !== 'pro', reason: plan === 'guest' ? 'login' as const : 'upgrade' as const, tier: persona.tier };
    }
    if (persona.tier === 'student' && plan === 'guest') {
      return { locked: true, reason: 'login' as const, tier: persona.tier };
    }
    if (persona.tier === 'student' && plan === 'free') {
      return { locked: true, reason: 'upgrade' as const, tier: persona.tier };
    }
    return { locked: false, tier: persona.tier };
  }, [getPlan]);

  const guestLimitReached = getPlan() === 'guest' && usage?.limit !== null && (usage?.problems_left ?? 0) <= 0;
  const freeLimitReached = getPlan() === 'free' && usage?.limit !== null && (usage?.problems_left ?? 0) <= 0;

  const refreshUsage = useCallback(async () => {
    try {
      const { userId, userRole } = getIdentity();
      const usagePayload = await fetchUsage(userId, userRole);
      const payload = (usagePayload as any)?.usage ?? usagePayload;
      setUsage(payload);
      return payload;
    } catch (error) {
      console.error('Failed to load usage', error);
      return null;
    }
  }, [getIdentity]);

  const parseLambdaResponse = async (res: Response) => {
    let data: any = null;
    try {
      data = await res.json();
    } catch (e) {
      // ignore
    }
    const parsed = data?.body ? JSON.parse(data.body) : data;
    if (parsed?.usage) {
      setUsage(parsed.usage);
    }
    if (!res.ok) {
      throw new Error(parsed?.message || parsed?.error || 'Request failed');
    }
    return parsed;
  };

  const startNewChatDraft = useCallback(() => {
    const draftId = crypto.randomUUID();
    setPendingSessionId(draftId);
    setActiveChatId(draftId);
    localStorage.setItem('cgpt_session_id', draftId);
    setInputValue('');
    activeRequestRef.current = null;
    setIsLoading(false);
  }, []);

  const normalizeProfile = useCallback((data: any) => {
    const personaId = data?.persona;
    const personaValid = PERSONA_OPTIONS.some(p => p.id === personaId);
    return {
      persona: personaValid ? personaId : DEFAULT_PERSONA_ID,
      avatarUrl: data?.avatar_url || data?.avatarUrl,
    };
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      const { userId, userRole } = getIdentity();
      const profilePayload = await getProfile(userId, userRole);
      const payload = (profilePayload as any)?.profile ?? profilePayload;
      const normalized = normalizeProfile(payload || {});
      setProfile(normalized);
      return normalized;
    } catch (error) {
      console.error('Failed to load profile', error);
      return null;
    }
  }, [getIdentity, normalizeProfile]);

  const activeChat = chatSessions.find(chat => chat.id === activeChatId);
  const messages = activeChat?.messages || [];
  const activePersona = PERSONA_OPTIONS.find(p => p.id === profile.persona) || PERSONA_OPTIONS[0];
  const userAvatar = profile.avatarUrl || (user as any)?.picture || undefined;
  const userInitial = (user?.name || (user as any)?.email || 'You').charAt(0).toUpperCase();

  // Load chats from backend on mount
  useEffect(() => {
    if (authLoading) return;
    const init = async () => {
      try {
        setIsFetchingChats(true);
        const { userId, userRole } = getIdentity();
        const sessions = await listChats(userId, userRole);

        const rawSessions = Array.isArray(sessions) ? sessions : sessions.sessions || [];
        const formattedSessions: ChatSession[] = rawSessions.map(s => ({
          id: s.session_id || s.id,
          title: s.title || s.name || 'New Chat',
          messages: normalizeMessages(s),
          createdAt: s.created_at || s.createdAt || Date.now()
        }));
        setChatSessions(formattedSessions);

        await refreshUsage();

        const savedSessionId = localStorage.getItem('cgpt_session_id');
        const savedSessionExists = formattedSessions.some(s => s.id === savedSessionId);

        if (savedSessionId && savedSessionExists) {
          setPendingSessionId(null);
          setActiveChatId(savedSessionId);
          const chatData = await loadChat(savedSessionId, userId, userRole);
          setChatSessions(prev => prev.map(c =>
            c.id === savedSessionId
              ? { ...c, messages: normalizeMessages(chatData) }
              : c
          ));
        } else if (formattedSessions.length > 0) {
          const firstSession = formattedSessions[0];
          setPendingSessionId(null);
          setActiveChatId(firstSession.id);
          localStorage.setItem('cgpt_session_id', firstSession.id);
          const chatData = await loadChat(firstSession.id, userId, userRole);
          setChatSessions(prev => prev.map(c =>
            c.id === firstSession.id
              ? { ...c, messages: normalizeMessages(chatData) }
              : c
          ));
        } else {
          startNewChatDraft();
        }
      } catch (error) {
        console.error('Error loading chats:', error);
        // Don't show error toast on initial load - just start a draft chat
        startNewChatDraft();
      } finally {
        setIsFetchingChats(false);
      }
    };

    init();
  }, [authLoading, getIdentity, refreshUsage, startNewChatDraft, normalizeMessages]);

  useEffect(() => {
    if (authLoading) return;
    refreshProfile();
  }, [authLoading, refreshProfile]);

  // Force KaTeX to re-render after new messages
  useEffect(() => {
    if (messagesContainerRef.current && typeof window !== 'undefined') {
      const renderMathInElement = (window as any).renderMathInElement;
      if (renderMathInElement) {
        renderMathInElement(messagesContainerRef.current, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false },
            { left: '\\[', right: '\\]', display: true },
            { left: '\\(', right: '\\)', display: false }
          ],
          throwOnError: false
        });
      }
    }
  }, [messages]);

  // Keyboard shortcut: ESC to cancel loading
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isLoading) {
        setIsLoading(false);
        activeRequestRef.current = null;
        toast({
          title: 'Request cancelled',
        });
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isLoading, toast]);

  useEffect(() => {
    const access = getModelAccess(selectedModel);
    if (access.locked) {
      const fallback = MODEL_OPTIONS.find(m => !getModelAccess(m.id).locked);
      if (fallback) {
        setSelectedModel(fallback.id);
      }
    }
  }, [getModelAccess, selectedModel]);

  useEffect(() => {
    const access = getPersonaAccess(profile.persona);
    if (access.locked) {
      const fallback = PERSONA_OPTIONS.find(p => !getPersonaAccess(p.id).locked);
      if (fallback) {
        setProfile(prev => ({ ...prev, persona: fallback.id }));
      }
    }
  }, [getPersonaAccess, profile.persona]);

  useEffect(() => {
    const handleFocus = () => {
      refreshUsage();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refreshUsage]);

  useEffect(() => {
    if (!isPricingOpen) {
      refreshUsage();
    }
  }, [isPricingOpen, refreshUsage]);

  const deleteChatSession = async (chatId: string) => {
    try {
      const { userId, userRole } = getIdentity();
      await deleteSessionChat(chatId, userId, userRole);

      // Reload chat history from backend
      const sessions = await listChats(userId, userRole);
      const rawSessions = Array.isArray(sessions) ? sessions : sessions.sessions || [];
      const formattedSessions: ChatSession[] = rawSessions.map(s => ({
        id: s.session_id || s.id,
        title: s.title || s.name || 'New Chat',
        messages: normalizeMessages(s),
        createdAt: s.created_at || s.createdAt || Date.now()
      }));
      
      setChatSessions(formattedSessions);

      if (chatId === activeChatId) {
        if (formattedSessions.length > 0) {
          const newActiveId = formattedSessions[0].id;
          setActiveChatId(newActiveId);
          localStorage.setItem('cgpt_session_id', newActiveId);
        } else {
          startNewChatDraft();
        }
      }
      
      toast({
        title: 'Chat deleted',
      });
    } catch (error) {
      console.error('Error deleting chat:', error);
      // Don't show toast for delete errors - just log them
    }
  };

  const selectChat = async (chatId: string) => {
    try {
      const { userId, userRole } = getIdentity();

      // Clear any active request tracking when switching chats
      activeRequestRef.current = null;
      setIsLoading(false);
      setPendingSessionId(null);

      setActiveChatId(chatId);
      localStorage.setItem('cgpt_session_id', chatId);

      // Always load from backend
      const chatData = await loadChat(chatId, userId, userRole);
      setChatSessions(prev => prev.map(c =>
        c.id === chatId
          ? { ...c, messages: normalizeMessages(chatData) || c.messages }
          : c
      ));

      // Scroll to bottom after loading messages
      setTimeout(() => {
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
      }, 100);
    } catch (error) {
      console.error('Error loading chat:', error);
    }
  };

  const generateChatTitle = (text: string, hasImage: boolean): string => {
    if (hasImage) {
      return 'Graph Analysis';
    }
    
    if (!text.trim()) {
      return 'New Chat';
    }
    
    // Take first 6-10 words
    const words = text.trim().split(/\s+/).filter(w => w.length > 0);
    const titleWords = words.slice(0, Math.min(10, words.length));
    let title = titleWords.join(' ');
    
    // Capitalize first letter
    if (title.length > 0) {
      title = title.charAt(0).toUpperCase() + title.slice(1);
    }
    
    // Truncate if too long
    if (title.length > 60) {
      title = title.substring(0, 57) + '...';
    }
    
    return title || 'New Chat';
  };

  const handleToolSelect = (text: string) => {
    setInputValue(text);
  };

  const handleLockedModelSelect = useCallback((modelId: string, access: ModelAccessState) => {
    const model = MODEL_OPTIONS.find(m => m.id === modelId);
    if (access.reason === 'login') {
      toast({
        title: 'Sign in required',
        description: 'Create a free account to use this model.',
        variant: 'destructive'
      });
      setIsLoginOpen(true);
      return;
    }
    toast({
      title: 'Upgrade required',
      description: model?.tier === 'pro'
        ? 'Upgrade to Pro to access GPT-5 models.'
        : 'Upgrade your plan to unlock this model.',
      variant: 'destructive'
    });
    setIsPricingOpen(true);
  }, [toast]);

  const handlePlanSelect = async (planId: string, priceId?: string) => {
    try {
      if (planId === 'free') {
        setIsPricingOpen(false);
        return;
      }

      if (!user) {
        setIsLoginOpen(true);
        setIsPricingOpen(false);
        return;
      }

      setIsCheckoutLoading(true);
      const { userId, userRole } = getIdentity();
      const selectedPlan = planId === 'pro' ? 'pro' : 'student';
      const result = await createCheckoutSession(userId, userRole, selectedPlan, priceId);
      const parsed = (result as any)?.body ? JSON.parse((result as any).body) : result;
      const checkoutUrl = (parsed as any)?.checkout_url;
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      } else {
        toast({ title: 'Checkout unavailable', description: 'Could not start checkout session.' });
      }
    } catch (error: any) {
      console.error('Failed to start checkout', error);
      toast({ title: 'Stripe error', description: error?.message || 'Unable to start checkout', variant: 'destructive' });
    } finally {
      setIsCheckoutLoading(false);
    }
  };

  const handleModelChange = (modelId: string) => {
    const access = getModelAccess(modelId);
    if (access.locked) {
      handleLockedModelSelect(modelId, access);
      return;
    }
    setSelectedModel(modelId);
  };

  const applyProfileUpdate = (payload: any) => {
    const normalized = normalizeProfile(payload || {});
    setProfile(normalized);
    return normalized;
  };

  const handlePersonaLockedSelect = (personaId: string, access?: { reason?: 'login' | 'upgrade' }) => {
    if (access?.reason === 'login') {
      setIsLoginOpen(true);
      return;
    }
    setIsPricingOpen(true);
  };

  const handlePersonaChange = async (personaId: string) => {
    const access = getPersonaAccess(personaId);
    if (access.locked) {
      handlePersonaLockedSelect(personaId, access);
      return;
    }

    applyProfileUpdate({ ...profile, persona: personaId });

    try {
      const { userId, userRole } = getIdentity();
      const result = await updateProfile(userId, userRole, { persona: personaId });
      const payload = (result as any)?.profile ?? result;
      applyProfileUpdate(payload);
    } catch (error: any) {
      console.error('Failed to update persona', error);
      toast({ title: 'Unable to save persona', description: error?.message || 'Please try again.', variant: 'destructive' });
    }
  };

  const handleAvatarSelect = async (avatarUrl: string) => {
    applyProfileUpdate({ ...profile, avatar_url: avatarUrl });
    try {
      const { userId, userRole } = getIdentity();
      const result = await updateProfile(userId, userRole, { avatar_url: avatarUrl });
      applyProfileUpdate((result as any)?.profile ?? result);
    } catch (error: any) {
      console.error('Failed to update avatar', error);
      toast({ title: 'Unable to save avatar', description: error?.message || 'Please try again.', variant: 'destructive' });
    }
  };

  const handleAvatarUpload = async (file: File) => {
    setIsAvatarUploading(true);
    try {
      const base64 = await fileToBase64(file);
      const { userId, userRole } = getIdentity();
      const result = await updateProfile(userId, userRole, { avatar_data: base64 });
      applyProfileUpdate((result as any)?.profile ?? result);
    } catch (error: any) {
      console.error('Failed to upload avatar', error);
      toast({ title: 'Upload failed', description: error?.message || 'Please try another image.', variant: 'destructive' });
    } finally {
      setIsAvatarUploading(false);
    }
  };

  const handleSend = async (text: string, images?: File[]) => {
    if ((!text.trim() && !images?.length) || isLoading) return;

    const { userId, userRole } = getIdentity();
    // Prefer the in-memory draft/active chat, fall back to stored session.
    let sessionId = pendingSessionId || activeChatId || localStorage.getItem('cgpt_session_id');
    if (!userId) return;

    const personaId = profile.persona || DEFAULT_PERSONA_ID;
    const previousAssistantCount = (chatSessions.find(c => c.id === sessionId)?.messages || [])
      .filter(m => m.role === 'assistant').length;

    // Capture backend payloads so we can render assistant replies immediately
    // even if DynamoDB write propagation lags or fails.
    let immediateResponse: any = null;
    let immediateAction: 'solve' | 'graph' | 'clarify' | null = null;

    if (!sessionId) {
      const generatedId = crypto.randomUUID();
      sessionId = generatedId;
      setActiveChatId(generatedId);
      setPendingSessionId(generatedId);
    }

    if (pendingSessionId && sessionId === pendingSessionId) {
      try {
        await createChat(sessionId, userId, 'New Chat', userRole);
        setPendingSessionId(null);
        localStorage.setItem('cgpt_session_id', sessionId);
        setChatSessions(prev => [
          { id: sessionId, title: 'New Chat', messages: [], createdAt: Date.now() },
          ...prev,
        ]);
      } catch (error) {
        console.error('Error creating chat:', error);
        toast({ title: 'Unable to start chat', description: 'Please try again.', variant: 'destructive' });
        return;
      }
    }

    const modelAccess = getModelAccess(selectedModel);
    if (modelAccess.locked) {
      handleLockedModelSelect(selectedModel, modelAccess);
      return;
    }

    const usageInfo = await refreshUsage();

    if (usageInfo?.plan === 'guest' && usageInfo?.limit !== null && (usageInfo?.problems_left ?? 0) <= 0) {
      toast({
        title: 'Sign in to keep going',
        description: 'Guests get 4 problems per day. Sign in for a bigger daily limit.',
        variant: 'destructive'
      });
      setIsLoginOpen(true);
      return;
    }

    if (usageInfo?.upgrade_required) {
      toast({
        title: 'Daily limit reached',
        description: 'Upgrade your plan to continue solving more problems today.',
        variant: 'destructive'
      });
      setIsPricingOpen(true);
      return;
    }

    // Generate unique request ID for tracking
    const requestId = crypto.randomUUID();
    activeRequestRef.current = { sessionId, requestId };

    // Store original text for title generation later
    const originalText = text;
    const hasImage = !!images?.length;

    // Check if we're responding to a clarification request
    const currentChat = chatSessions.find(c => c.id === sessionId);
    const isRespondingToClarification = currentChat?.awaitingClarification && !images;

    // Optimistically show user message immediately with all images
    const userMessage: Message = {
      role: 'user',
      content: text || 'Analyzing images...',
      imageUrls: images?.length ? images.map(img => URL.createObjectURL(img)) : undefined,
    };
    setChatSessions(prev => {
      const existing = prev.find(chat => chat.id === sessionId);
      if (existing) {
        return prev.map(chat =>
          chat.id === sessionId
            ? { ...chat, messages: [...chat.messages, userMessage] }
            : chat
        );
      }
      return [
        {
          id: sessionId,
          title: 'New Chat',
          messages: [userMessage],
          createdAt: Date.now(),
        },
        ...prev,
      ];
    });

    setIsLoading(true);

    try {
      // Handle clarification response
      if (isRespondingToClarification && currentChat?.clarificationImages?.length) {
        immediateResponse = await parseLambdaResponse(await fetch(LAMBDA_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'clarify_graph',
            mode: mode,
            model: selectedModel,
            user_id: userId,
            session_id: sessionId,
            user_role: userRole,
            persona: personaId,
            text: text,
            images: currentChat.clarificationImages,
          }),
        }));
        immediateAction = 'clarify';
        
        // Clear clarification state
        setChatSessions(prev =>
          prev.map(chat =>
            chat.id === sessionId
              ? { 
                  ...chat, 
                  awaitingClarification: false, 
                  clarificationImages: undefined,
                  clarificationImagePreview: undefined
                }
              : chat
          )
        );
      }
      // Route to correct backend action for new requests with images
      else if (images && images.length > 0) {
        // Convert all images to base64
        const imagesBase64 = await Promise.all(images.map(img => fileToBase64(img)));
        
        // Check for derivative keywords in user text
        const derivativeKeywords = ['derivative', 'd/dx', 'dp/dq', 'dy/dx', 'differentiate'];
        const hasDerivativeKeyword = derivativeKeywords.some(keyword => 
          text.toLowerCase().includes(keyword.toLowerCase())
        );
        
        // If derivative keywords present, always route to solve
        if (hasDerivativeKeyword) {
          immediateResponse = await parseLambdaResponse(await fetch(LAMBDA_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'solve',
              mode: mode,
              model: selectedModel,
              user_id: userId,
              session_id: sessionId,
              user_role: userRole,
              persona: personaId,
              text: text || 'Solve this problem',
              images: imagesBase64,
            }),
          }));
          immediateAction = 'solve';
        } else {
          // Use the new classify action
          const classifyResponse = await parseLambdaResponse(await fetch(LAMBDA_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'classify',
              mode: mode,
              model: selectedModel,
              user_id: userId,
              session_id: sessionId,
              user_role: userRole,
              persona: personaId,
              images: [imagesBase64[0]],
            }),
          }));

          const classification = (classifyResponse as any)?.classification || 'solve';
          
          if (classification === 'graph') {
            // It's a graph -> send graph action with first image only
            const payload: any = {
              action: "graph",
              mode: mode,
              model: selectedModel,
              user_id: userId,
              session_id: sessionId,
              user_role: userRole,
              persona: personaId,
              images: [imagesBase64[0]],
            };
            
            if (text.trim()) payload.text = text;
            
            const graphResponse = await parseLambdaResponse(await fetch(LAMBDA_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            }));
            immediateResponse = graphResponse;
            immediateAction = 'graph';
            
            console.log('[GRAPH RESPONSE]', {
              needs_clarification: graphResponse?.needs_clarification,
              has_question: !!graphResponse?.question,
              has_image_preview: !!graphResponse?.image_preview,
              mode: mode
            });
            
            // Check if backend needs clarification
            if (graphResponse?.needs_clarification && graphResponse?.question) {
              // Store images and image preview for clarification
              setChatSessions(prev =>
                prev.map(chat =>
                  chat.id === sessionId
                    ? { 
                        ...chat, 
                        awaitingClarification: true,
                        clarificationImages: imagesBase64,
                        clarificationImagePreview: graphResponse.image_preview
                      }
                    : chat
                )
              );
              
              console.log('[CLARIFICATION MODE]', {
                stored_images: imagesBase64.length,
                has_preview: !!graphResponse.image_preview
              });
              
              // Don't proceed to reload - let the backend messages handle it
              // The backend already stored the clarification question in messages
            } else {
              // Store images for potential future clarification
              if (mode === 'hybrid') {
                setChatSessions(prev =>
                  prev.map(chat =>
                    chat.id === sessionId
                      ? { ...chat, clarificationImages: imagesBase64 }
                      : chat
                  )
                );
              }
            }
          } else {
            // Not a graph -> send solve action with all images
            immediateResponse = await parseLambdaResponse(await fetch(LAMBDA_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'solve',
                mode: mode,
                model: selectedModel,
                user_id: userId,
                session_id: sessionId,
                user_role: userRole,
                persona: personaId,
                text: text || 'Solve this problem',
                images: imagesBase64,
              }),
            }));
            immediateAction = 'solve';
          }
        }
      } else {
        // Text only -> use solve action
        immediateResponse = await parseLambdaResponse(await fetch(LAMBDA_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'solve',
            mode: mode,
            model: selectedModel,
            user_id: userId,
            session_id: sessionId,
            user_role: userRole,
            persona: personaId,
            text: text,
          }),
        }));
        immediateAction = 'solve';
      }

      // CRITICAL: Check if still on the same chat after backend call
      if (activeRequestRef.current?.sessionId !== sessionId || 
          activeRequestRef.current?.requestId !== requestId) {
        console.log('Response ignored - user switched chats');
        return;
      }

      // Reload messages from DynamoDB after backend updates
      const chatData = await loadChat(sessionId, userId, userRole);
      const normalizedChatMessages = normalizeMessages(chatData);
      chatData.messages = normalizedChatMessages;

      // If the backend hasn't persisted the user turn yet, keep the optimistic local copy
      if (!chatData.messages?.length) {
        const localMessages = chatSessions.find(c => c.id === sessionId)?.messages || [];
        chatData.messages = localMessages.length ? localMessages : [userMessage];
      }
      
      // CRITICAL: Check again after loadChat
      if (activeRequestRef.current?.sessionId !== sessionId || 
          activeRequestRef.current?.requestId !== requestId) {
        console.log('Messages ignored - user switched chats');
        return;
      }

      // Check if backend returned needs_clarification from the stored messages
      const lastMessage = chatData.messages?.[chatData.messages.length - 1];
      const lastAssistantMessage = chatData.messages?.slice().reverse().find(m => m.role === 'assistant');
      const needsClarification = lastAssistantMessage?.content?.includes('?') && mode === 'hybrid';
      
      if (needsClarification) {
        // Set clarification state
        setChatSessions(prev =>
          prev.map(chat =>
            chat.id === sessionId
              ? { ...chat, awaitingClarification: true }
              : chat
          )
        );
      }

      // Process messages to attach images correctly
      if (chatData.messages) {
        const currentClarificationPreview = currentChat?.clarificationImagePreview;
        
        chatData.messages = chatData.messages.map((msg: Message, idx: number) => {
          // For assistant clarification messages (questions), attach the stored image preview
          if (msg.role === 'assistant' && 
              msg.content?.includes('?') && 
              currentClarificationPreview &&
              idx === chatData.messages.length - 1) {
            console.log('[ATTACHING IMAGE PREVIEW]', {
              message_index: idx,
              has_preview: !!currentClarificationPreview,
              preview_length: currentClarificationPreview.length
            });
            return { 
              ...msg, 
              image_preview: currentClarificationPreview,
              imageUrls: [`data:image/png;base64,${currentClarificationPreview}`]
            };
          }
          
          // Show image_preview from backend for assistant clarification messages (fallback)
          if (msg.role === 'assistant' && msg.image_preview) {
            return { ...msg, imageUrls: [`data:image/png;base64,${msg.image_preview}`] };
          }
          
          // Attach user's uploaded images to assistant responses
          if (msg.role === 'assistant' && idx > 0 && images?.length) {
            const prevMsg = chatData.messages[idx - 1];
            if (prevMsg.role === 'user' && prevMsg.imageUrls) {
              return { ...msg, imageUrls: prevMsg.imageUrls };
            }
          }
          
          return msg;
        });

        // If Dynamo didn't persist the assistant reply yet, synthesize it from the
        // immediate Lambda response so the UI always shows a reply.
        const assistantCount = chatData.messages.filter((m: Message) => m.role === 'assistant').length;
        if (assistantCount <= previousAssistantCount && immediateResponse) {
          const synthesized: Message = {
            role: 'assistant',
            content: '',
          };

          if (immediateAction === 'solve') {
            synthesized.content = immediateResponse.steps || immediateResponse.result || 'Solution ready.';
            synthesized.steps = immediateResponse.steps;
            synthesized.result = immediateResponse.result;
            synthesized.expression = immediateResponse.expression;
          } else if (immediateAction === 'graph' || immediateAction === 'clarify') {
            if (immediateResponse.needs_clarification && immediateResponse.question) {
              synthesized.content = immediateResponse.question;
            } else {
              synthesized.content = immediateResponse.analysis || 'Graph analyzed.';
            }
            if (immediateResponse.image_preview) {
              synthesized.image_preview = immediateResponse.image_preview;
              synthesized.imageUrls = [`data:image/png;base64,${immediateResponse.image_preview}`];
            }
          }

          if (!synthesized.content) {
            synthesized.content = 'Answer ready.';
          }

          chatData.messages = [...chatData.messages, synthesized];
        }
      }

      // Auto-name chat AFTER assistant reply (only if title is still "New Chat")
      console.log('[AUTO-TITLE] Loaded chat data:', { 
        sessionId, 
        currentTitle: chatData.title,
        hasMessages: !!chatData.messages?.length 
      });
      
      let shouldUpdateTitle = false;
      let autoTitle = '';
      
      // Check loaded chat data and local state for "New Chat" title
      const localChat = chatSessions.find((c) => c.id === sessionId);
      const isNewChatTitle =
        chatData.title === 'New Chat' ||
        localChat?.title === 'New Chat' ||
        !chatData.title;
      
      if (isNewChatTitle) {
        shouldUpdateTitle = true;
        
        // Determine text to use for title generation
        let titleText = originalText;
        
        // If no text was provided, find first user message in loaded data
        if (!titleText || !titleText.trim()) {
          const firstUserMsg = chatData.messages?.find((m: Message) => m.role === 'user' && m.content?.trim());
          titleText = firstUserMsg?.content || '';
        }
        
        console.log('[AUTO-TITLE] Will generate title from:', { 
          titleText: titleText?.substring(0, 50), 
          hasImage 
        });
        
        // Generate title
        if (hasImage && (!titleText || !titleText.trim())) {
          autoTitle = 'Graph Analysis';
        } else {
          autoTitle = generateChatTitle(titleText, hasImage);
        }
        
        console.log('[AUTO-TITLE] Generated title:', autoTitle);
      }

      // Persist auto-generated title to backend when needed
      if (shouldUpdateTitle && autoTitle && autoTitle !== 'New Chat') {
        await updateChatTitle(sessionId, userId, autoTitle, userRole);
      }

      // Refresh sidebar to show updated title and all sessions
      console.log('[AUTO-TITLE] Fetching fresh chat list...');
      const sessions = await listChats(userId, userRole);
      const rawSessions = Array.isArray(sessions) ? sessions : sessions.sessions || [];
      let formattedSessions: ChatSession[] = rawSessions.map(s => ({
        id: s.session_id || s.id,
        title: s.title || s.name || 'New Chat',
        messages: normalizeMessages(s),
        createdAt: s.created_at || s.createdAt || Date.now()
      }));
      
      console.log('[AUTO-TITLE] Fresh sessions from backend:', 
        formattedSessions.map(s => ({ id: s.id, title: s.title }))
      );
      
      // If backend list has not yet propagated the new title, force it locally
      if (shouldUpdateTitle && autoTitle && autoTitle !== 'New Chat') {
        formattedSessions = formattedSessions.map(chat =>
          chat.id === sessionId ? { ...chat, title: autoTitle } : chat
        );
      }
      
      // CRITICAL: Final check before updating state
      if (activeRequestRef.current?.sessionId !== sessionId || 
          activeRequestRef.current?.requestId !== requestId) {
        console.log('Final state update ignored - user switched chats');
        return;
      }
 
      // Update chat sessions with fresh data from backend
      setChatSessions(formattedSessions.map(chat =>
        chat.id === sessionId
          ? { ...chat, messages: chatData.messages || [] }
          : chat
      ));
      
      console.log('[AUTO-TITLE] State updated with new title');
    } catch (error: any) {
      console.error('Error processing request:', error);

      const payload = error?.payload;
      if (payload?.login_required) {
        setIsLoginOpen(true);
      }
      if (payload?.upgrade_required) {
        setIsPricingOpen(true);
      }

      // Only show error if still on the same chat
      if (activeRequestRef.current?.sessionId === sessionId &&
          activeRequestRef.current?.requestId === requestId) {
        toast({
          title: 'Error',
          description: payload?.message || payload?.error || (error instanceof Error ? error.message : 'Failed to process your request. Please try again.'),
          variant: 'destructive',
        });
      }
    } finally {
      // Only clear loading if still on the same chat
      if (activeRequestRef.current?.sessionId === sessionId && 
          activeRequestRef.current?.requestId === requestId) {
        setIsLoading(false);
      }
    }
  };

  // Check if this is the landing screen
  const isLandingScreen = messages.length === 0;
  const limitReached = usage?.limit !== null && (usage?.problems_left ?? 0) <= 0;

  // Convert chat sessions to sidebar format
  const chatsForSidebar: Chat[] = chatSessions.map(chat => ({
    id: chat.id,
    title: chat.title,
    createdAt: chat.createdAt,
  }));

  if (isFetchingChats) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <Calculator className="h-12 w-12 text-primary mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Loading chats...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col md:flex-row overflow-hidden bg-background">
      {/* Sidebar */}
      <ChatSidebar
        chats={chatsForSidebar}
        activeChat={activeChatId}
        onNewChat={startNewChatDraft}
        onSelectChat={selectChat}
        onDeleteChat={deleteChatSession}
        onOpenPricing={() => setIsPricingOpen(true)}
        usage={usage}
      />

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Header - Transparent */}
        <div className="bg-transparent px-4 py-4 space-y-3">
          <div className="flex items-center justify-between text-foreground">
            <div className="flex items-center gap-2">
              <Calculator className="h-6 w-6" />
              <h1 className="text-lg font-semibold">Math Tutor Agent</h1>
            </div>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 hover:opacity-70 rounded-lg transition-opacity text-foreground"
              aria-label="Settings"
            >
              <Settings className="h-5 w-5" />
            </button>
          </div>

          <div className="max-w-4xl w-full mx-auto">
            <ModeStatus
              value={mode}
              onValueChange={setMode}
              awaitingClarification={activeChat?.awaitingClarification}
            />
          </div>
        </div>

        {isLandingScreen ? (
          /* Landing Screen - Centered Input */
          <div className="flex-1 flex flex-col items-center justify-center px-6 pb-32">
            <div className="w-full max-w-4xl space-y-12">
              <div className="text-center">
                <h1 className="text-4xl md:text-5xl font-semibold text-foreground">
                  How can Math Tutor Agent help with your math today?
                </h1>
                <p className="mt-4 text-lg text-muted-foreground">
                  Your AI copilot for step-by-step insights, visual problem solving, and reliable math checks.
                </p>
              </div>

              {limitReached && (
                <div className="text-center text-sm text-destructive">
                  Daily limit reached. Upgrade to continue solving more problems.
                </div>
              )}

              <ChatInput
                onSend={handleSend}
                disabled={isLoading || limitReached}
                selectedModel={selectedModel}
                onModelChange={handleModelChange}
                modelAccess={getModelAccess}
                onModelLockedSelect={handleLockedModelSelect}
                mode={mode}
                onModeChange={setMode}
                onToolSelect={handleToolSelect}
                inputValue={inputValue}
                onInputChange={setInputValue}
              />
            </div>
          </div>
        ) : (
          /* Chat Mode */
          <>
            {/* Messages */}
            <div
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto"
            >
              <div className="max-w-4xl mx-auto py-6 px-4">
                {messages.map((msg, idx) => {
                  // Attach clarification image preview to the last assistant message if awaiting clarification
                  let messageToDisplay = msg;
                  if (msg.role === 'assistant' && idx === messages.length - 1 && activeChat?.awaitingClarification && activeChat?.clarificationImagePreview) {
                    messageToDisplay = {
                      ...messageToDisplay,
                      image_preview: activeChat.clarificationImagePreview
                    };
                  }
                  return (
                    <ChatMessage
                      key={idx}
                      message={messageToDisplay}
                      userAvatarUrl={userAvatar}
                      assistantAvatarUrl={activePersona?.avatar}
                      userFallback={userInitial}
                      assistantName={activePersona?.name}
                    />
                  );
                })}
                {isLoading && (
                  <div className="flex justify-start mb-4">
                    <div className="bg-muted rounded-2xl px-4 py-3 text-muted-foreground animate-pulse">
                      Analyzing...
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Input at bottom during chat */}
            {limitReached && (
              <div className="max-w-4xl mx-auto px-4 text-sm text-destructive">
                Daily limit reached. Upgrade to continue solving more problems.
              </div>
            )}
            <ChatInput
              onSend={handleSend}
              disabled={isLoading || limitReached}
              selectedModel={selectedModel}
              onModelChange={handleModelChange}
              modelAccess={getModelAccess}
              onModelLockedSelect={handleLockedModelSelect}
              mode={mode}
              onModeChange={setMode}
              onToolSelect={handleToolSelect}
              inputValue={inputValue}
              onInputChange={setInputValue}
            />
          </>
        )}
      </div>

      {/* Settings Dialog */}
      <SettingsDialog
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        selectedModel={selectedModel}
        onModelChange={handleModelChange}
        modelAccess={getModelAccess}
        onModelLockedSelect={handleLockedModelSelect}
        showMoreSteps={showMoreSteps}
        onShowMoreStepsChange={setShowMoreSteps}
        conciseAnswers={conciseAnswers}
        onConciseAnswersChange={setConciseAnswers}
        sympyVerification={sympyVerification}
        onSympyVerificationChange={setSympyVerification}
        personaOptions={PERSONA_OPTIONS}
        selectedPersona={profile.persona}
        onPersonaChange={handlePersonaChange}
        personaAccess={getPersonaAccess}
        onPersonaLockedSelect={handlePersonaLockedSelect}
        avatarOptions={PRESET_AVATARS}
        selectedAvatar={profile.avatarUrl}
        onAvatarSelect={handleAvatarSelect}
        onAvatarUpload={handleAvatarUpload}
        isUploadingAvatar={isAvatarUploading}
      />

      <LoginModal open={isLoginOpen} onClose={() => setIsLoginOpen(false)} />

      {/* Pricing Modal */}
      <PricingModal
        open={isPricingOpen}
        onOpenChange={setIsPricingOpen}
        onSelectPlan={handlePlanSelect}
        isProcessing={isCheckoutLoading}
      />
    </div>
  );
};

export default Index;
