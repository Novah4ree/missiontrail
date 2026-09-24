import { createClient } from "@supabase/supabase-js";

import {
  APIException,
  AppStoreServerAPIClient,
  Environment,
} from "@apple/app-store-server-library";


// =========================================================
// MISSION TRAILS - EXPLORER COIN PURCHASE VERIFIER
//
// Purpose:
// Verifies an Apple purchase before Explorer Coins are added.
//
// IMPORTANT:
// The phone NEVER decides how many coins to award.
// Apple tells the server which product was purchased.
// =========================================================


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};


// ---------------------------------------------------------
// Purpose:
// Sends a consistent JSON response back to Mission Trails.
// ---------------------------------------------------------

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    },
  );
}


// ---------------------------------------------------------
// Purpose:
// Reads the .p8 Apple private key that we safely stored
// in Supabase as Base64.
// ---------------------------------------------------------

function decodePrivateKey(base64Key: string): string {
  const binary = atob(base64Key);

  const bytes = Uint8Array.from(
    binary,
    (character) => character.charCodeAt(0),
  );

  return new TextDecoder().decode(bytes);
}


// ---------------------------------------------------------
// Purpose:
// Reads the payload portion of Apple's JWS transaction.
//
// IMPORTANT:
// We do NOT accept a JWS supplied by the phone here.
// This JWS comes directly from Apple's authenticated
// App Store Server API response.
// ---------------------------------------------------------

function decodeAppleJwsPayload(
  signedTransaction: string,
): Record<string, unknown> {
  const parts = signedTransaction.split(".");

  if (parts.length !== 3) {
    throw new Error("INVALID_APPLE_JWS");
  }

  let payload = parts[1]
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  payload += "=".repeat(
    (4 - (payload.length % 4)) % 4,
  );

  const binary = atob(payload);

  const bytes = Uint8Array.from(
    binary,
    (character) => character.charCodeAt(0),
  );

  const json = new TextDecoder().decode(bytes);

  return JSON.parse(json);
}


// ---------------------------------------------------------
// Purpose:
// Checks whether Apple is saying the transaction simply
// does not exist in this environment.
//
// Apple error 4040010 = TransactionIdNotFoundError.
// ---------------------------------------------------------

function shouldTryAppleSandbox(
  error: unknown,
): boolean {
  if (!(error instanceof APIException)) {
    return false;
  }

  const apiError =
    error.apiError == null
      ? null
      : Number(error.apiError);

  const httpStatus =
    Number(error.httpStatusCode);

  // Apple normally returns 4040010 when a transaction
  // does not exist in Production.
  //
  // TestFlight/Sandbox transactions may also return
  // HTTP 401/404 when queried against Production.
  //
  // Trying Sandbox here is safe because Apple still
  // has to return and verify the real transaction
  // before Mission Trails grants Explorer Coins.

  return (
    apiError === 4040010 ||
    httpStatus === 401 ||
    httpStatus === 404
  );
}


// ---------------------------------------------------------
// Purpose:
// Ask Apple's PRODUCTION server first.
//
// If Apple says the transaction is not in Production,
// automatically try Sandbox.
//
// This allows real purchases and Sandbox/TestFlight
// purchases to use the same Mission Trails function.
// ---------------------------------------------------------

async function getAppleTransaction(
  transactionId: string,
  privateKey: string,
  keyId: string,
  issuerId: string,
  bundleId: string,
) {
  const productionClient =
    new AppStoreServerAPIClient(
      privateKey,
      keyId,
      issuerId,
      bundleId,
      Environment.PRODUCTION,
    );

  try {
    const response =
      await productionClient.getTransactionInfo(
        transactionId,
      );

    return {
      response,
      environment: "production",
    };
  } catch (error) {
    if (!shouldTryAppleSandbox(error)) {
      throw error;
    }

    console.warn(
      "Apple Production lookup failed. Trying Sandbox/TestFlight.",
      {
        httpStatus:
          error instanceof APIException
            ? error.httpStatusCode
            : null,

        apiError:
          error instanceof APIException
            ? error.apiError
            : null,
      },
    );
  }


  // Transaction was not found in Production.
  // Try Apple's Sandbox server next.

  const sandboxClient =
    new AppStoreServerAPIClient(
      privateKey,
      keyId,
      issuerId,
      bundleId,
      Environment.SANDBOX,
    );

  const response =
    await sandboxClient.getTransactionInfo(
      transactionId,
    );

  return {
    response,
    environment: "sandbox",
  };
}


// =========================================================
// EDGE FUNCTION
// =========================================================

Deno.serve(async (req) => {

  // Browser preflight support.
  if (req.method === "OPTIONS") {
    return new Response(
      "ok",
      {
        headers: corsHeaders,
      },
    );
  }


  if (req.method !== "POST") {
    return jsonResponse(
      {
        verified: false,
        code: "METHOD_NOT_ALLOWED",
      },
      405,
    );
  }


  try {

    // -----------------------------------------------------
    // Load server secrets.
    // -----------------------------------------------------

    const supabaseUrl =
      Deno.env.get("SUPABASE_URL");

    const serviceRoleKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    const appleIssuerId =
      Deno.env.get("APPLE_IAP_ISSUER_ID");

    const appleKeyId =
      Deno.env.get("APPLE_IAP_KEY_ID");

    const applePrivateKeyBase64 =
      Deno.env.get(
        "APPLE_IAP_PRIVATE_KEY_BASE64",
      );

    const expectedBundleId =
      Deno.env.get("APPLE_IAP_BUNDLE_ID");


    if (
      !supabaseUrl ||
      !serviceRoleKey ||
      !appleIssuerId ||
      !appleKeyId ||
      !applePrivateKeyBase64 ||
      !expectedBundleId
    ) {
      console.error(
        "Explorer Coin verifier is missing server configuration.",
      );

      return jsonResponse(
        {
          verified: false,
          code: "SERVER_CONFIGURATION_ERROR",
        },
        500,
      );
    }


    // -----------------------------------------------------
    // Authenticate the Mission Trails user.
    //
    // We do not accept a user_id from the request body.
    // The user's real UUID comes from their Supabase JWT.
    // -----------------------------------------------------

    const authorization =
      req.headers.get("Authorization");

    if (
      !authorization ||
      !authorization.startsWith("Bearer ")
    ) {
      return jsonResponse(
        {
          verified: false,
          code: "UNAUTHORIZED",
        },
        401,
      );
    }

    const accessToken =
      authorization.slice("Bearer ".length);


    const supabase =
      createClient(
        supabaseUrl,
        serviceRoleKey,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        },
      );


    const {
      data: userData,
      error: userError,
    } =
      await supabase.auth.getUser(
        accessToken,
      );


    if (
      userError ||
      !userData.user
    ) {
      return jsonResponse(
        {
          verified: false,
          code: "INVALID_USER_SESSION",
        },
        401,
      );
    }


    const userId =
      userData.user.id;


    // -----------------------------------------------------
    // Read ONLY the Apple transaction ID from the phone.
    //
    // The client does not send:
    // - coin amount
    // - product reward
    // - user UUID
    // - purchase price
    // -----------------------------------------------------

    const body =
      await req.json()
        .catch(() => null);


    const transactionId =
      typeof body?.transactionId === "string"
        ? body.transactionId.trim()
        : "";


    if (!transactionId) {
      return jsonResponse(
        {
          verified: false,
          code: "MISSING_TRANSACTION_ID",
        },
        400,
      );
    }


    // -----------------------------------------------------
    // Load Apple private key.
    // -----------------------------------------------------

    const applePrivateKey =
      decodePrivateKey(
        applePrivateKeyBase64,
      );


    // -----------------------------------------------------
    // Ask APPLE for the transaction.
    //
    // Production is tried first.
    // Sandbox is tried only if Apple says it is not there.
    // -----------------------------------------------------

    const appleResult =
      await getAppleTransaction(
        transactionId,
        applePrivateKey,
        appleKeyId,
        appleIssuerId,
        expectedBundleId,
      );


    const signedTransaction =
      appleResult.response
        .signedTransactionInfo;


    if (!signedTransaction) {
      return jsonResponse(
        {
          verified: false,
          code: "APPLE_TRANSACTION_MISSING",
        },
        400,
      );
    }


    // -----------------------------------------------------
    // Decode the transaction returned directly by Apple.
    // -----------------------------------------------------

    const transaction =
      decodeAppleJwsPayload(
        signedTransaction,
      );


    const appleTransactionId =
      String(
        transaction.transactionId ?? "",
      );

    const productId =
      String(
        transaction.productId ?? "",
      );

    const bundleId =
      String(
        transaction.bundleId ?? "",
      );

    const appAccountToken =
      String(
        transaction.appAccountToken ?? "",
      );

    const productType =
      String(
        transaction.type ?? "",
      );


    // -----------------------------------------------------
    // Verify transaction ID.
    // -----------------------------------------------------

    if (
      appleTransactionId !==
      transactionId
    ) {
      return jsonResponse(
        {
          verified: false,
          code: "TRANSACTION_ID_MISMATCH",
        },
        400,
      );
    }


    // -----------------------------------------------------
    // Verify this purchase belongs to Mission Trails.
    // -----------------------------------------------------

    if (
      bundleId !== expectedBundleId
    ) {
      return jsonResponse(
        {
          verified: false,
          code: "WRONG_APP",
        },
        400,
      );
    }


    // -----------------------------------------------------
    // Verify Apple tied the purchase to THIS signed-in
    // Mission Trails account.
    //
    // Our app will send the Supabase user UUID to Apple
    // as appAccountToken when purchase starts.
    // -----------------------------------------------------

    if (
      !appAccountToken ||
      appAccountToken.toLowerCase() !==
        userId.toLowerCase()
    ) {
      return jsonResponse(
        {
          verified: false,
          code: "ACCOUNT_TOKEN_MISMATCH",
        },
        403,
      );
    }


    // -----------------------------------------------------
    // Explorer Coins must be a consumable purchase.
    // -----------------------------------------------------

    if (
      productType &&
      productType.toLowerCase() !==
        "consumable"
    ) {
      return jsonResponse(
        {
          verified: false,
          code: "INVALID_PRODUCT_TYPE",
        },
        400,
      );
    }


    // -----------------------------------------------------
    // Do not grant a refunded/revoked transaction.
    // -----------------------------------------------------

    if (
      transaction.revocationDate != null
    ) {
      return jsonResponse(
        {
          verified: false,
          code: "PURCHASE_REVOKED",
        },
        400,
      );
    }


    // -----------------------------------------------------
    // For now Mission Trails sells one coin pack at a time.
    // Reject unexpected multi-quantity transactions.
    // -----------------------------------------------------

    const quantity =
      Number(
        transaction.quantity ?? 1,
      );


    if (
      !Number.isFinite(quantity) ||
      quantity !== 1
    ) {
      return jsonResponse(
        {
          verified: false,
          code: "INVALID_QUANTITY",
        },
        400,
      );
    }


    // -----------------------------------------------------
    // Convert Apple's millisecond purchase date.
    // -----------------------------------------------------

    let purchaseDate:
      string | null = null;


    if (
      typeof transaction.purchaseDate ===
        "number"
    ) {
      purchaseDate =
        new Date(
          transaction.purchaseDate,
        ).toISOString();
    }


    // -----------------------------------------------------
    // Credit Explorer Coins.
    //
    // IMPORTANT:
    // The DATABASE determines how many coins this product
    // gives. The phone does not.
    //
    // Duplicate transaction IDs are blocked in SQL.
    // -----------------------------------------------------

    const {
      data: creditData,
      error: creditError,
    } =
      await supabase.rpc(
        "server_credit_verified_iap",
        {
          p_user_id: userId,
          p_platform: "ios",

          p_store_transaction_id:
            appleTransactionId,

          p_product_id:
            productId,

          p_environment:
            appleResult.environment,

          p_purchase_date:
            purchaseDate,
        },
      );


    if (creditError) {
      console.error(
        "Explorer Coin credit RPC failed:",
        creditError.message,
      );

      return jsonResponse(
        {
          verified: false,
          code: "COIN_CREDIT_FAILED",
        },
        500,
      );
    }


    const creditResult =
      Array.isArray(creditData)
        ? creditData[0]
        : creditData;


    if (!creditResult) {
      return jsonResponse(
        {
          verified: false,
          code: "EMPTY_CREDIT_RESPONSE",
        },
        500,
      );
    }


    // -----------------------------------------------------
    // Success OR safe duplicate response.
    //
    // ALREADY_GRANTED means Apple purchase was valid,
    // but this exact transaction already received coins.
    // It does NOT award them again.
    // -----------------------------------------------------

    return jsonResponse({
      verified: true,

      granted:
        creditResult.granted === true,

      code:
        creditResult.result_code,

      coinsGranted:
        creditResult.coins_granted,

      balance:
        creditResult.new_balance,

      productId,
    });

  } catch (error) {

    // Never print Apple private-key values or full JWS data.
    console.error(
      "Explorer Coin verification failed:",
      error instanceof Error
        ? error.message
        : "Unknown error",
    );


    const detail =
      error instanceof APIException
        ? `HTTP_${error.httpStatusCode}_APPLE_${error.apiError ?? "NONE"}`
        : (
            error instanceof Error
              ? error.message
              : "UNKNOWN_ERROR"
          );

    return jsonResponse(
      {
        verified: false,
        code: "APPLE_VERIFICATION_FAILED",
        detail,
      },
      400,
    );
  }
});
