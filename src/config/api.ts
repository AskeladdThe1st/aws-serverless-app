const DEFAULT_LAMBDA_URL =
  "https://cdyibmzy64skc2ikp74qebsicq0nggic.lambda-url.us-east-1.on.aws/";

function resolveLambdaUrl(): string {
  const envUrl = import.meta.env.VITE_LAMBDA_URL;
  if (typeof envUrl === "string" && envUrl.trim().length > 0) {
    return envUrl.trim();
  }

  if (typeof window !== "undefined") {
    try {
      const stored = window.localStorage?.getItem("lambda_url");
      if (stored && stored.trim().length > 0) {
        return stored.trim();
      }
    } catch (error) {
      console.warn("Unable to read lambda_url from localStorage", error);
    }
  }

  return DEFAULT_LAMBDA_URL;
}

export const LAMBDA_URL = resolveLambdaUrl();
