import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Forward requests to your existing AWS Lambda Function URL
const LAMBDA_URL = "https://cdyibmzy64skc2ikp74qebsicq0nggic.lambda-url.us-east-1.on.aws/";

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pass through the body as-is to the AWS Lambda
    const bodyText = await req.text();

    const upstream = await fetch(LAMBDA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: bodyText || "{}",
    });

    const respText = await upstream.text();
    const contentType = upstream.headers.get("content-type")?.includes("application/json")
      ? "application/json"
      : "application/json"; // default to JSON

    return new Response(respText, {
      status: upstream.status,
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("lambda-proxy error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});