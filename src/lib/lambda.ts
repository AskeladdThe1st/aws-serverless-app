import { ChatSession, Message } from './types';

export interface CalcResponse {
  expression: string;
  result: string;
  steps: string;
}

export interface SolveProblemPayload {
  text: string;
  image?: string;
  session_id?: string;
  user_id?: string;
}

export async function solveProblem(
  text: string,
  imageBase64?: string,
  sessionId?: string,
  userId?: string
): Promise<CalcResponse> {
  const LAMBDA_URL = 'https://cdyibmzy64skc2ikp74qebsicq0nggic.lambda-url.us-east-1.on.aws/';

  try {
    const payload: SolveProblemPayload = {
      text,
      image: imageBase64,
      session_id: sessionId,
      user_id: userId,
    };

    const response = await fetch(LAMBDA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) throw new Error(`Lambda error: ${response.status}`);

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error calling Lambda:', error);
    throw error;
  }
}

// Future-ready stub functions for backend integration
export async function listSessions(userId: string): Promise<ChatSession[]> {
  // TODO: Replace with actual DynamoDB call
  // Mock data for now
  const mockSessions: ChatSession[] = [
    {
      id: 'session-1',
      user_id: userId,
      title: 'Limit of sin(x)/x as x approaches 0',
      created_at: new Date(Date.now() - 86400000).toISOString(),
      updated_at: new Date(Date.now() - 86400000).toISOString(),
      first_message: 'Find the limit: lim(x→0) (sin(x)/x)',
    },
    {
      id: 'session-2',
      user_id: userId,
      title: 'Derivative of x³ + 2x²',
      created_at: new Date(Date.now() - 172800000).toISOString(),
      updated_at: new Date(Date.now() - 172800000).toISOString(),
      first_message: 'Find the derivative of f(x) = x³ + 2x²',
    },
  ];
  
  return new Promise((resolve) => {
    setTimeout(() => resolve(mockSessions), 300);
  });
}

export async function getSession(sessionId: string): Promise<Message[]> {
  // TODO: Replace with actual DynamoDB call
  // Mock data for now
  const mockMessages: Message[] = [
    {
      role: 'user',
      content: 'Find the limit: lim(x→0) (sin(x)/x)',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      role: 'assistant',
      content: 'The limit is **1**.',
      expression: '\\lim_{x \\to 0} \\frac{\\sin(x)}{x}',
      result: '1',
      steps: 'This is a famous limit. Using L\'Hôpital\'s rule or Taylor series, we can show that this limit equals 1.',
      timestamp: new Date(Date.now() - 3500000).toISOString(),
    },
  ];
  
  return new Promise((resolve) => {
    setTimeout(() => resolve(mockMessages), 300);
  });
}

export async function saveMessage(
  sessionId: string,
  message: Message,
  userId: string
): Promise<void> {
  // TODO: Replace with actual DynamoDB call
  console.log('Saving message:', { sessionId, message, userId });
  
  return new Promise((resolve) => {
    setTimeout(() => resolve(), 100);
  });
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
