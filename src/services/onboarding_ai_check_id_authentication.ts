// ======================================================
// ONBOARDING AI CHECK ID AUTHENTICATION
// ======================================================
//
// FILE LOCATION:
//
// src/services/onboarding_ai_check_id_authentication.ts
//
// PURPOSE:
//
// This file is the bridge between:
//
// onboarding_check_id.tsx
//
// and:
//
// Supabase Edge Function:
// verify-onboarding-id
//
// PRE-ACCOUNT FLOW:
//
// The user does NOT need to be signed in.
// ID information is checked BEFORE account creation.
//
// The OpenAI API key NEVER lives in this file.
// OpenAI is called only from the secure Edge Function.
//
// ======================================================

import { idVerifySupabase } from '../../lib/supabase';


// ======================================================
// USER INFORMATION
// ======================================================

export interface OnboardingIdentityInformation {
  firstName: string;
  lastName: string;

  displayName?: string;

  birthday: string;

  city?: string;
  state?: string;
  country?: string;
}


// ======================================================
// VERIFICATION REQUEST
// ======================================================

export interface IdVerificationRequest {
  idImageUri: string;

  userInformation: OnboardingIdentityInformation;
}


// ======================================================
// FIELD COMPARISON RESULT
// ======================================================

export interface IdentityFieldComparison {
  enteredValue?: string | null;

  idValue?: string | null;

  matched: boolean | null;

  confidence?: number | null;
}


// ======================================================
// VERIFICATION RESULT
// ======================================================

export interface IdVerificationResult {
  success: boolean;

  status:
    | 'matched'
    | 'mismatch'
    | 'unable_to_verify'
    | 'error';

  message: string;

  // Purpose:
  // Contains the short-lived server-issued ticket only
  // after successful ID information matching.
  verificationTicket?: string | null;

  informationMatched?: boolean;

  requiresManualReview?: boolean;

  documentReadable?: boolean;

  appearsToBeIdentityDocument?: boolean;

  extracted?: {
    firstName?: string | null;
    lastName?: string | null;
    birthday?: string | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;
  };

  comparisons?: {
    firstName?: IdentityFieldComparison;

    lastName?: IdentityFieldComparison;

    birthday?: IdentityFieldComparison;

    city?: IdentityFieldComparison;

    state?: IdentityFieldComparison;

    country?: IdentityFieldComparison;
  };

  explanation?: string;

  errorType?: string;
}


// ======================================================
// ERROR TYPE
// ======================================================

export class IdVerificationError extends Error {
  statusCode?: number;

  constructor(
    message: string,
    statusCode?: number
  ) {
    super(message);

    this.name = 'IdVerificationError';

    this.statusCode = statusCode;
  }
}


// ======================================================
// VALIDATE USER INFORMATION
// ======================================================

function validateUserInformation(
  information: OnboardingIdentityInformation
) {
  if (!information.firstName.trim()) {
    throw new IdVerificationError(
      'First name is required for ID verification.'
    );
  }

  if (!information.lastName.trim()) {
    throw new IdVerificationError(
      'Last name is required for ID verification.'
    );
  }

  if (!information.birthday.trim()) {
    throw new IdVerificationError(
      'Date of birth is required for ID verification.'
    );
  }
}


// ======================================================
// GET IMAGE BLOB
// ======================================================
//
// This converts the selected Expo image URI into an
// actual Blob that can be sent to the Edge Function.
//
// Works naturally for web blob/http URLs and Expo's
// fetchable local URI representation.
//
// ======================================================


// ======================================================
// DETERMINE IMAGE TYPE
// ======================================================


// ======================================================
// DETERMINE FILE NAME
// ======================================================

function determineFileName(
  mimeType: string
): string {
  if (mimeType === 'image/png') {
    return 'onboarding-id.png';
  }

  if (mimeType === 'image/webp') {
    return 'onboarding-id.webp';
  }

  return 'onboarding-id.jpg';
}


// ======================================================
// VERIFY ONBOARDING ID
// ======================================================

export async function verifyOnboardingId(
  request: IdVerificationRequest
): Promise<IdVerificationResult> {

  // ====================================================
  // VALIDATE IMAGE
  // ====================================================

  if (!request.idImageUri) {
    throw new IdVerificationError(
      'An ID image is required.'
    );
  }


  // ====================================================
  // VALIDATE USER INFORMATION
  // ====================================================

  validateUserInformation(
    request.userInformation
  );


  // ====================================================
  // IMPORTANT: NO LOGIN / SESSION CHECK HERE
  // ====================================================
  //
  // This verification intentionally happens BEFORE the
  // user creates an account.
  //
  // Do NOT call:
  //
  // supabase.auth.getSession()
  //
  // and do NOT require an authenticated user here.
  //
  // The Supabase Edge Function is configured separately
  // to support this pre-account onboarding request.
  //
  // ====================================================


  // ====================================================
  // PREPARE ID IMAGE
  // ====================================================
  //
  // React Native should send the local file URI directly
  // through FormData. Converting the URI to a browser Blob
  // can produce a zero-byte multipart upload on iOS.
  //
  // ====================================================

  const imageUri =
    request.idImageUri;

  const normalizedImageUri =
    imageUri
      .split('?')[0]
      .toLowerCase();

  let imageType =
    'image/jpeg';

  if (
    normalizedImageUri.endsWith('.png')
  ) {
    imageType =
      'image/png';
  } else if (
    normalizedImageUri.endsWith('.webp')
  ) {
    imageType =
      'image/webp';
  }

  const imageName =
    determineFileName(
      imageType
    );


  // ====================================================
  // CREATE MULTIPART FORM
  // ====================================================

  const formData =
    new FormData();


  // ====================================================
  // ADD ONBOARDING INFORMATION
  // ====================================================

  formData.append(
    'firstName',
    request.userInformation.firstName.trim()
  );


  formData.append(
    'lastName',
    request.userInformation.lastName.trim()
  );


  formData.append(
    'displayName',
    request.userInformation.displayName?.trim() ?? ''
  );


  formData.append(
    'birthday',
    request.userInformation.birthday.trim()
  );


  formData.append(
    'city',
    request.userInformation.city?.trim() ?? ''
  );


  formData.append(
    'state',
    request.userInformation.state?.trim() ?? ''
  );


  formData.append(
    'country',
    request.userInformation.country?.trim() ?? ''
  );


  // ====================================================
  // ADD ID IMAGE
  // ====================================================

  formData.append(
    'idImage',
    {
      uri: imageUri,
      name: imageName,
      type: imageType,
    } as any
  );


  // ====================================================
  // CALL SUPABASE EDGE FUNCTION
  // ====================================================
  //
  // Function:
  //
  // verify-onboarding-id
  //
  // No signed-in user session is required.
  //
  // The Supabase client still supplies the project's
  // normal public/publishable credentials used to reach
  // the Edge Function.
  //
  // ====================================================

  let data: any;
  let error: any;


  if (!idVerifySupabase) {
    throw new IdVerificationError(
      'ID verification is not configured on this build.'
    );
  }

  try {
    const result =
      await idVerifySupabase.functions.invoke(
        'verify-onboarding-id',
        {
          body: formData,
        }
      );

    data = result.data;
    error = result.error;

  } catch (invokeError) {
    console.error(
      'Unable to invoke ID verification function:',
      invokeError
    );

    throw new IdVerificationError(
      'Unable to connect to the ID verification service.'
    );
  }


  // ====================================================
  // EDGE FUNCTION ERROR
  // ====================================================

  if (error) {
    console.error(
      'ID verification Edge Function error:',
      error
    );

    const errorMessage =
      typeof data?.message === 'string' &&
      data.message.trim()
        ? data.message
        : error.message ||
          'The ID verification service returned an error.';

    throw new IdVerificationError(
      errorMessage
    );
  }


  // ====================================================
  // CHECK RESPONSE
  // ====================================================

  if (!data) {
    throw new IdVerificationError(
      'The ID verification service returned no data.'
    );
  }


  // ====================================================
  // VALIDATE STATUS
  // ====================================================

  const validStatuses = [
    'matched',
    'mismatch',
    'unable_to_verify',
    'error',
  ];


  if (
    !validStatuses.includes(
      data.status
    )
  ) {
    console.error(
      'Unexpected verification result:',
      data
    );

    throw new IdVerificationError(
      'The ID verification service returned an invalid result.'
    );
  }


  // ====================================================
  // TECHNICAL / SERVICE ERROR
  // ====================================================
  //
  // Keep a service failure separate from an actual
  // identity-information mismatch.
  //
  // This allows onboarding_check_id.tsx to show a
  // technical error instead of falsely telling the user
  // that their ID information did not match.
  //
  // ====================================================

  if (data.status === 'error') {
    console.error(
      'ID verification service returned a technical error:',
      data
    );

    throw new IdVerificationError(
      data.message ||
        'The ID verification service could not complete the check.'
    );
  }


  // ====================================================
  // RETURN RESULT TO CHECK ID SCREEN
  // ====================================================

  return data as IdVerificationResult;
}


// ======================================================
// DID ID INFORMATION MATCH?
// ======================================================

export function didIdentityInformationMatch(
  result: IdVerificationResult
): boolean {
  return (
    result.success === true &&
    result.status === 'matched' &&
    result.informationMatched === true
  );
}


// ======================================================
// DOES RESULT REQUIRE REVIEW?
// ======================================================

export function identityNeedsManualReview(
  result: IdVerificationResult
): boolean {
  return (
    result.status === 'unable_to_verify' ||
    result.requiresManualReview === true
  );
}


// ======================================================
// GET USER-FRIENDLY RESULT MESSAGE
// ======================================================

export function getIdentityVerificationMessage(
  result: IdVerificationResult
): string {

  if (result.status === 'matched') {
    return (
      result.message ||
      'The readable information on your ID matches the information you entered.'
    );
  }


  if (result.status === 'mismatch') {
    return (
      result.message ||
      'Some information on the ID does not match the information you entered.'
    );
  }


  if (
    result.status ===
    'unable_to_verify'
  ) {
    return (
      result.message ||
      'We could not read enough information from the ID to complete verification.'
    );
  }


  return (
    result.message ||
    'We could not verify the ID. Please try again.'
  );
}