const LAMBDA_URL =
  "https://cdyibmzy64skc2ikp74qebsicq0nggic.lambda-url.us-east-1.on.aws/";

// Get or create user ID from localStorage
export function getOrCreateUserId(): string {
  const key = "calculus_user_id";
  let userId = localStorage.getItem(key);
  if (!userId) {
    userId = crypto.randomUUID();
    localStorage.setItem(key, userId);
  }
  return userId;
}

async function callLambda(body: any) {
  const res = await fetch(LAMBDA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Lambda error: ${res.status}`);

  const json = await res.json();
  if (json?.body) return JSON.parse(json.body);

  return json;
}

export async function createChat(sessionId: string, userId: string, title: string) {
  return callLambda({
    action: "create",
    user_id: userId,
    session_id: sessionId,
    title: title || "New Chat",
  });
}

export async function listChats(userId: string) {
  return callLambda({
    action: "list",
    user_id: userId,
  });
}

export async function loadChat(sessionId: string, userId: string) {
  return callLambda({
    action: "load",
    user_id: userId,
    session_id: sessionId,
  });
}

export async function deleteChat(sessionId: string, userId: string) {
  return callLambda({
    action: "delete",
    user_id: userId,
    session_id: sessionId,
  });
}

export async function updateChatTitle(sessionId: string, userId: string, title: string) {
  return callLambda({
    action: "update",
    user_id: userId,
    session_id: sessionId,
    title,
  });
}

export async function solveProblem(
  userId: string,
  sessionId: string,
  text: string,
  imageBase64?: string
) {
  const payload: any = {
    action: "solve",
    user_id: userId,
    session_id: sessionId,
    text,
  };

  if (imageBase64) payload.image = imageBase64;

  return callLambda(payload);
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
