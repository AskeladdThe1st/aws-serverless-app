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

  // Always try to read and return the JSON body, even on non-2xx
  let json: any = null;
  try {
    json = await res.json();
  } catch (e) {
    // If there is no JSON body, fall back to a basic error
    if (!res.ok) {
      throw new Error(`Lambda error: ${res.status}`);
    }
    return null;
  }

  // Some Lambda integrations wrap the payload in a body string
  const parsed = json?.body ? JSON.parse(json.body) : json;

  // If the backend explicitly returns an error field, surface it
  if (!res.ok && parsed?.error) {
    throw new Error(parsed.error);
  }

  // Otherwise, even for 4xx/5xx, return the parsed payload so
  // the frontend can still load stored messages and titles
  if (!res.ok && !parsed?.error) {
    console.warn("Lambda returned non-2xx without explicit error", {
      status: res.status,
      payload: parsed,
    });
  }

  return parsed;
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

// Persist updated chat titles to DynamoDB using the existing "update" action
export async function updateChatTitle(
  sessionId: string,
  userId: string,
  title: string
) {
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
  text: string
) {
  return callLambda({
    action: "solve",
    user_id: userId,
    session_id: sessionId,
    text,
  });
}

export async function analyzeGraph(
  userId: string,
  sessionId: string,
  imageBase64: string,
  text?: string
) {
  const payload: any = {
    action: "graph",
    user_id: userId,
    session_id: sessionId,
    image: imageBase64,
  };

  if (text) payload.text = text;

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
