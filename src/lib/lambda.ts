/* eslint-disable @typescript-eslint/no-explicit-any */
import { LAMBDA_URL } from "@/config/api";

// Get or create user ID from localStorage
export function getOrCreateUserId(): string {
  const key = "calculus_user_id";
  let userId = localStorage.getItem(key);
  if (!userId) {
    userId = `guest_${crypto.randomUUID()}`;
    localStorage.setItem(key, userId);
  }
  return userId;
}

async function callLambda(body: any, userRole: "guest" | "user" = "guest") {
  const payload = { ...body, user_role: userRole };

  const doFetch = async (timeoutMs: number) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(LAMBDA_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  };

  const timeouts = [12000, 18000];
  let res: Response | null = null;
  let lastError: Error | null = null;

  for (const ms of timeouts) {
    try {
      res = await doFetch(ms);
      break;
    } catch (error: any) {
      const isTimeout = error?.name === "AbortError";
      const isNetwork = typeof error?.message === "string" && error.message.includes("Failed to fetch");
      if (isTimeout || isNetwork) {
        lastError = new Error("Request timed out. Please try again.");
        continue;
      }
      throw error;
    }
  }

  if (!res) {
    throw lastError || new Error("Request failed before receiving a response.");
  }

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
    const err: any = new Error(parsed.error || "Request failed");
    err.payload = parsed;
    err.status = res.status;
    throw err;
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

export async function createChat(
  sessionId: string,
  userId: string,
  title: string,
  userRole: "guest" | "user" = "guest",
) {
  return callLambda(
    {
      action: "create",
      user_id: userId,
      session_id: sessionId,
      title: title || "New Chat",
    },
    userRole,
  );
}

export async function listChats(userId: string, userRole: "guest" | "user" = "guest") {
  return callLambda(
    {
      action: "list",
      user_id: userId,
    },
    userRole,
  );
}

export async function loadChat(
  sessionId: string,
  userId: string,
  userRole: "guest" | "user" = "guest",
) {
  return callLambda(
    {
      action: "load",
      user_id: userId,
      session_id: sessionId,
    },
    userRole,
  );
}

export async function deleteChat(
  sessionId: string,
  userId: string,
  userRole: "guest" | "user" = "guest",
) {
  return callLambda(
    {
      action: "delete",
      user_id: userId,
      session_id: sessionId,
    },
    userRole,
  );
}

// Persist updated chat titles to DynamoDB using the existing "update" action
export async function updateChatTitle(
  sessionId: string,
  userId: string,
  title: string,
  userRole: "guest" | "user" = "guest",
) {
  return callLambda(
    {
      action: "update",
      user_id: userId,
      session_id: sessionId,
      title,
    },
    userRole,
  );
}

export async function updateManualMode(
  sessionId: string,
  userId: string,
  enabled: boolean,
  userRole: "guest" | "user" = "guest",
) {
  return callLambda(
    {
      action: "update",
      user_id: userId,
      session_id: sessionId,
      manual_mode: enabled,
    },
    userRole,
  );
}

export async function fetchUsage(userId: string, userRole: "guest" | "user" = "guest") {
  return callLambda(
    {
      action: "usage",
      user_id: userId,
    },
    userRole,
  );
}

export async function createCheckoutSession(
  userId: string,
  userRole: "guest" | "user",
  planId: string,
  priceId?: string,
  successUrl?: string,
  cancelUrl?: string,
) {
  return callLambda(
    {
      action: "stripe_checkout",
      user_id: userId,
      plan: planId,
      price_id: priceId,
      success_url: successUrl,
      cancel_url: cancelUrl,
    },
    userRole,
  );
}

export async function solveProblem(
  userId: string,
  sessionId: string,
  text: string,
  userRole: "guest" | "user" = "guest",
) {
  return callLambda(
    {
      action: "solve",
      user_id: userId,
      session_id: sessionId,
      text,
    },
    userRole,
  );
}

export async function analyzeGraph(
  userId: string,
  sessionId: string,
  imageBase64: string,
  text?: string,
  userRole: "guest" | "user" = "guest",
) {
  const payload: any = {
    action: "graph",
    user_id: userId,
    session_id: sessionId,
    image: imageBase64,
  };

  if (text) payload.text = text;

  return callLambda(payload, userRole);
}


export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function fetchProfile(userId: string, userRole: "guest" | "user" = "guest") {
  return callLambda({ action: "profile", user_id: userId }, userRole);
}

export async function saveAvatar(
  userId: string,
  userRole: "guest" | "user",
  userAvatar?: string,
  tutorAvatar?: string,
  persona?: string,
) {
  return callLambda(
    {
      action: "save_avatar",
      user_id: userId,
      user_avatar: userAvatar,
      tutor_avatar: tutorAvatar,
      persona,
    },
    userRole,
  );
}

export async function saveMode(userId: string, userRole: "guest" | "user", mode: string) {
  return callLambda({ action: "mode", user_id: userId, mode }, userRole);
}
