const LAMBDA_URL = 'https://cdyibmzy64skc2ikp74qebsicq0nggic.lambda-url.us-east-1.on.aws/';

// Get or create user ID from localStorage
export function getOrCreateUserId(): string {
  const key = 'calculus_user_id';
  let userId = localStorage.getItem(key);
  if (!userId) {
    userId = crypto.randomUUID();
    localStorage.setItem(key, userId);
  }
  return userId;
}

export interface CalcResponse {
  expression: string;
  result: string;
  steps: string;
}

export interface ChatSession {
  session_id: string;
  title: string;
  messages: any[];
  created_at: number;
}

// Create new chat session
export async function createChat(sessionId: string, userId: string, title: string = 'New Chat'): Promise<ChatSession> {
  const response = await fetch(LAMBDA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'create',
      session_id: sessionId,
      user_id: userId,
      title
    }),
  });

  if (!response.ok) throw new Error(`Create chat error: ${response.status}`);
  return await response.json();
}

// List all chat sessions
export async function listChats(userId: string): Promise<ChatSession[]> {
  const response = await fetch(LAMBDA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'list',
      user_id: userId
    }),
  });

  if (!response.ok) throw new Error(`List chats error: ${response.status}`);
  const data = await response.json();
  return data.sessions || [];
}

// Load specific chat session
export async function loadChat(sessionId: string, userId: string): Promise<ChatSession> {
  const response = await fetch(LAMBDA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'load',
      session_id: sessionId,
      user_id: userId
    }),
  });

  if (!response.ok) throw new Error(`Load chat error: ${response.status}`);
  return await response.json();
}

// Update chat title
export async function updateChatTitle(sessionId: string, userId: string, title: string): Promise<void> {
  const response = await fetch(LAMBDA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'update',
      session_id: sessionId,
      user_id: userId,
      title
    }),
  });

  if (!response.ok) throw new Error(`Update chat error: ${response.status}`);
}

// Delete chat session
export async function deleteChat(sessionId: string, userId: string): Promise<void> {
  const response = await fetch(LAMBDA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'delete',
      session_id: sessionId,
      user_id: userId
    }),
  });

  if (!response.ok) throw new Error(`Delete chat error: ${response.status}`);
}

// Solve problem and save to session
export async function solveProblem(
  sessionId: string,
  userId: string,
  text: string,
  imageBase64?: string
): Promise<CalcResponse> {
  const response = await fetch(LAMBDA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'solve',
      session_id: sessionId,
      user_id: userId,
      text,
      image: imageBase64
    }),
  });

  if (!response.ok) throw new Error(`Solve error: ${response.status}`);
  return await response.json();
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
