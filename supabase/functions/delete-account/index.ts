import { createClient } from "npm:@supabase/supabase-js@2.106.2";

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

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "METHOD_NOT_ALLOWED", requestId }, 405);
  }

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
    if (authError || !authData.user) {
      return jsonResponse({ error: "UNAUTHORIZED", requestId }, 401);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Auth deletion is the authoritative account deletion. User-owned relational
    // records that reference auth.users with ON DELETE CASCADE are removed by the
    // database. Do not convert this into a soft-delete or account suspension.
    const { error: deletionError } = await admin.auth.admin.deleteUser(
      authData.user.id,
      false,
    );

    if (deletionError) {
      console.error("Account deletion failed", {
        requestId,
        code: deletionError.code,
        status: deletionError.status,
      });
      return jsonResponse(
        {
          error: "ACCOUNT_DELETION_FAILED",
          message: "Mission Trails could not delete the account. Please try again.",
          requestId,
        },
        500,
      );
    }

    // Never return the deleted email, user id, access token, or other personal data.
    return jsonResponse({ deleted: true, requestId }, 200);
  } catch (error) {
    console.error("Account deletion request failed", {
      requestId,
      failure: error instanceof Error ? error.message : "unknown",
    });
    return jsonResponse(
      {
        error: "ACCOUNT_DELETION_UNAVAILABLE",
        message: "Account deletion is temporarily unavailable. Please try again.",
        requestId,
      },
      503,
    );
  }
});
