import { createClient } from "npm:@supabase/supabase-js@2.106.2";

type SupportCategory = "account" | "privacy" | "purchase" | "unsafe_location" | "technical" | "other";

type SupportBody = {
  category?: SupportCategory;
  message?: string;
};

const allowedCategories = new Set<SupportCategory>([
  "account",
  "privacy",
  "purchase",
  "unsafe_location",
  "technical",
  "other",
]);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function requireEnvironment(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing server environment: ${name}`);
  return value;
}

Deno.serve(async (request) => {
  const requestId = crypto.randomUUID();

  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "METHOD_NOT_ALLOWED", requestId }, 405);

  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return jsonResponse({ error: "UNAUTHORIZED", requestId }, 401);
    }

    const supabaseUrl = requireEnvironment("SUPABASE_URL");
    const anonKey = requireEnvironment("SUPABASE_ANON_KEY");
    const serviceRoleKey = requireEnvironment("SUPABASE_SERVICE_ROLE_KEY");

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) return jsonResponse({ error: "UNAUTHORIZED", requestId }, 401);

    const body = (await request.json().catch(() => ({}))) as SupportBody;
    const category = body.category;
    const message = body.message?.trim() ?? "";

    if (!category || !allowedCategories.has(category) || message.length < 10 || message.length > 4000) {
      return jsonResponse(
        {
          error: "INVALID_SUPPORT_REQUEST",
          message: "Choose a valid category and enter a message between 10 and 4,000 characters.",
          requestId,
        },
        400,
      );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Avoid accepting coordinates or other structured location payloads here.
    // An unsafe-location report is a human-readable report, not another precise
    // location tracking channel.
    const { data: ticketId, error: supportError } = await admin.rpc(
      "server_create_support_request",
      {
        p_user_id: authData.user.id,
        p_category: category,
        p_message: message,
      },
    );

    if (supportError || typeof ticketId !== "string") {
      throw new Error("SUPPORT_SAVE_FAILED");
    }

    return jsonResponse({ submitted: true, ticketId, requestId }, 201);
  } catch (error) {
    console.error("Support request failed", {
      requestId,
      failure: error instanceof Error ? error.message : "unknown",
    });
    return jsonResponse(
      {
        error: "SUPPORT_UNAVAILABLE",
        message: "Support is temporarily unavailable. Please try again.",
        requestId,
      },
      503,
    );
  }
});
