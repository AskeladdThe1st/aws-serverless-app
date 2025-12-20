/**
 * Resolve the Lambda Function URL with sensible fallbacks.
 * Priority: localStorage override -> Vite env -> hardcoded default.
 */
export function getLambdaUrl(): string {
  // Local override (useful for Amplify env vars or manual testing)
  try {
    const stored = typeof localStorage !== "undefined" ? localStorage.getItem("lambda_url") : null;
    if (stored) return stored;
  } catch {
    // ignore storage errors
  }

  const envUrl = import.meta.env?.VITE_LAMBDA_URL as string | undefined;
  if (envUrl) return envUrl;

  // Legacy default
  return "https://cdyibmzy64skc2ikp74qebsicq0nggic.lambda-url.us-east-1.on.aws/";
}
