export {};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
) {
  return Response.json(body, {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

async function getAuthenticatedUser(
  req: Request,
): Promise<{ id: string } | null> {
  const authorization =
    req.headers.get("Authorization");

  const apiKey =
    req.headers.get("apikey");

  const supabaseUrl =
    Deno.env.get("SUPABASE_URL");

  if (
    !authorization ||
    !apiKey ||
    !supabaseUrl
  ) {
    return null;
  }

  try {
    const response = await fetch(
      `${supabaseUrl}/auth/v1/user`,
      {
        headers: {
          Authorization: authorization,
          apikey: apiKey,
        },
      },
    );

    if (!response.ok) {
      return null;
    }

    const user = await response.json();

    if (
      !user ||
      typeof user.id !== "string"
    ) {
      return null;
    }

    return {
      id: user.id,
    };
  } catch (error) {
    console.error(
      "[MISSION AI] User verification failed:",
      error,
    );

    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      {
        error: "Method not allowed",
      },
      405,
    );
  }

  try {
    const user =
      await getAuthenticatedUser(req);

    if (!user) {
      return jsonResponse(
        {
          error: "Authentication required",
        },
        401,
      );
    }

    const openAiApiKey =
      Deno.env.get("OPENAI_API_KEY");

    if (!openAiApiKey) {
      console.error(
        "[MISSION AI] OPENAI_API_KEY is missing",
      );

      return jsonResponse(
        {
          error: "AI service is unavailable",
        },
        500,
      );
    }

    let body: unknown;

    try {
      body = await req.json();
    } catch {
      return jsonResponse(
        {
          error: "Invalid JSON body",
        },
        400,
      );
    }

    const message =
      typeof (
        body as {
          message?: unknown;
        }
      )?.message === "string"
        ? (
            body as {
              message: string;
            }
          ).message.trim()
        : "";

    if (!message) {
      return jsonResponse(
        {
          error: "message is required",
        },
        400,
      );
    }

    if (message.length > 800) {
      return jsonResponse(
        {
          error:
            "Message must be 800 characters or fewer",
        },
        400,
      );
    }

    const openaiResponse = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${openAiApiKey}`,
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          model: "gpt-5.6",

          instructions:
            "You are the Mission Trails concierge. " +
            "Keep answers short, friendly, and focused on walking, trails, missions, relics, eggs, companions, and Mission Trails app help. " +
            "Never encourage trespassing, entering restricted or private property, unsafe road crossings, driving while playing, or entering dangerous areas. " +
            "Do not request a user's precise home address. " +
            "Give a clear action-oriented next step.",

          input: message,

          max_output_tokens: 500,
        }),
      },
    );

    const data =
      await openaiResponse.json();

    if (!openaiResponse.ok) {
      console.error(
        "[MISSION AI] OpenAI request failed:",
        {
          status:
            openaiResponse.status,

          message:
            data?.error?.message ??
            "Unknown OpenAI error",
        },
      );

      return jsonResponse(
        {
          error:
            openaiResponse.status === 429
              ? "AI service is temporarily busy"
              : "AI request failed",
        },
        openaiResponse.status === 429
          ? 429
          : 502,
      );
    }

    const text =
      data?.output
        ?.flatMap(
          (item: {
            content?: unknown[];
          }) =>
            item?.content ?? [],
        )
        ?.find(
          (item: {
            type?: string;
          }) =>
            item?.type ===
            "output_text",
        )
        ?.text?.trim() ?? "";

    if (!text) {
      console.error(
        "[MISSION AI] Empty OpenAI response",
      );

      return jsonResponse(
        {
          error:
            "AI returned an empty response",
        },
        502,
      );
    }

    console.log(
      "[MISSION AI] Successful request",
      {
        userId: user.id,
      },
    );

    return jsonResponse({
      text,
    });
  } catch (error) {
    console.error(
      "[MISSION AI] Unexpected error:",
      error,
    );

    return jsonResponse(
      {
        error:
          "Mission AI service error",
      },
      500,
    );
  }
});
