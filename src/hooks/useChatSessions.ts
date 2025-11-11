import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChatSession } from '@/lib/types';
import { listSessions, getSession } from '@/lib/lambda';

export const useChatSessions = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['chat-sessions', userId],
    queryFn: () => listSessions(userId || ''),
    enabled: !!userId,
  });
};

export const useSessionMessages = (sessionId: string | null) => {
  return useQuery({
    queryKey: ['session-messages', sessionId],
    queryFn: () => getSession(sessionId || ''),
    enabled: !!sessionId,
  });
};

export const useCreateSession = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (session: ChatSession) => {
      // This will be implemented when backend is ready
      return session;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
    },
  });
};
