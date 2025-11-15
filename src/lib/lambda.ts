const LAMBDA_URL = 'https://cdyibmzy64skc2ikp74qebsicq0nggic.lambda-url.us-east-1.on.aws/';
const USER_ID = 'default-user'; // Replace with actual user ID from auth

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
export async function createChat(title: string = 'New Chat'): Promise<ChatSession> {
  const session_id = Date.now().toString();
  const response = await fetch(LAMBDA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'create',
      session_id,
      user_id: USER_ID,
      title
    }),
  });

  if (!response.ok) throw new Error(`Create chat error: ${response.status}`);
  return await response.json();
}

// List all chat sessions
export async function listChats(): Promise<ChatSession[]> {
  const response = await fetch(LAMBDA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'list',
      user_id: USER_ID
    }),
  });

  if (!response.ok) throw new Error(`List chats error: ${response.status}`);
  const data = await response.json();
  return data.sessions || [];
}

// Load specific chat session
export async function loadChat(sessionId: string): Promise<ChatSession> {
  const response = await fetch(LAMBDA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'load',
      session_id: sessionId,
      user_id: USER_ID
    }),
  });

  if (!response.ok) throw new Error(`Load chat error: ${response.status}`);
  return await response.json();
}

// Delete chat session
export async function deleteChat(sessionId: string): Promise<void> {
  const response = await fetch(LAMBDA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'delete',
      session_id: sessionId,
      user_id: USER_ID
    }),
  });

  if (!response.ok) throw new Error(`Delete chat error: ${response.status}`);
}

// Solve problem and save to session
export async function solveProblem(
  sessionId: string,
  text: string,
  imageBase64?: string
): Promise<CalcResponse> {
  const response = await fetch(LAMBDA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'solve',
      session_id: sessionId,
      user_id: USER_ID,
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
