// ======================================================
// MISSION TRAILS ACCOUNT ACCESS HOOK
// ======================================================
//
// Purpose:
// Gives React screens one reusable way to load and
// refresh Mission Trails account permissions.
//
// ======================================================

import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  getAccountAccessState,
  type AccountAccessState,
} from '@/services/account-access-service';


// ======================================================
// HOOK
// ======================================================

// Purpose:
// Loads the signed-in user's current Mission Trails
// permissions and keeps loading/error state for the UI.
export function useAccountAccess() {

  const [
    access,
    setAccess,
  ] =
    useState<AccountAccessState | null>(
      null
    );


  const [
    loading,
    setLoading,
  ] =
    useState(true);


  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null
    );


  // Purpose:
  // Reloads the account access record from Supabase.
  // Screens can call this after account status changes.
  const refresh =
    useCallback(
      async () => {

        try {

          setLoading(true);
          setError(null);


          const nextAccess =
            await getAccountAccessState();


          setAccess(
            nextAccess
          );

        } catch (loadError) {

          const message =
            loadError instanceof Error
              ? loadError.message
              : 'Unable to load account access.';


          console.error(
            '[ACCOUNT ACCESS] Unable to load permissions:',
            loadError
          );


          setError(
            message
          );


          // Purpose:
          // Clears stale permission data if loading fails.
          // Protected features therefore remain locked.
          setAccess(
            null
          );

        } finally {

          setLoading(
            false
          );
        }
      },
      []
    );


  // Purpose:
  // Loads account permissions when a protected screen
  // first appears.
  useEffect(
    () => {
      const refreshTimer = setTimeout(() => {
        void refresh();
      }, 0);

      return () => clearTimeout(refreshTimer);
    },
    [
      refresh,
    ]
  );


  return {
    access,
    loading,
    error,
    refresh,
  };
}
