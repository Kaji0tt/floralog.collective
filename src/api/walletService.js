import { supabase } from "@/api/supabaseClient";

const getCurrentAuthContext = async () => {
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  const user = data?.user;
  if (!user?.id) {
    throw new Error("Authenticated user is required");
  }

  return {
    authId: user.id,
    userEmail: user.email || null,
  };
};

const DEFAULT_WALLET = {
  seeds_progress: 0,
  sparks_balance: 0,
  amber_balance: 0,
};

export const getUserWallet = async (authId) => {
  if (!authId) return { ...DEFAULT_WALLET };

  const { data, error } = await supabase
    .from("UserWallet")
    .select("auth_id, seeds_progress, sparks_balance, amber_balance")
    .eq("auth_id", authId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return {
      auth_id: authId,
      ...DEFAULT_WALLET,
    };
  }

  return {
    ...DEFAULT_WALLET,
    ...data,
  };
};

export const claimDailyLoginSparks = async ({ eventReference = null, metadata = {} } = {}) => {
  const { authId } = await getCurrentAuthContext();

  const { data, error } = await supabase.rpc("claim_daily_login_sparks", {
    p_auth_id: authId,
    p_event_reference: eventReference,
    p_metadata: metadata,
  });

  if (error) {
    throw error;
  }

  return Array.isArray(data) ? data[0] || null : data || null;
};

export const grantWalletCurrency = async ({
  authId = null,
  currencyCode,
  eventSource,
  eventReference,
  amount,
  direction = "credit",
  metadata = {},
}) => {
  const resolvedAuthId = authId || (await getCurrentAuthContext()).authId;

  const { data, error } = await supabase.rpc("wallet_grant_currency", {
    p_auth_id: resolvedAuthId,
    p_currency_code: currencyCode,
    p_event_source: eventSource,
    p_event_reference: eventReference,
    p_amount: Math.max(0, Math.round(Number(amount || 0))),
    p_direction: direction,
    p_metadata: metadata,
  });

  if (error) {
    throw error;
  }

  return Array.isArray(data) ? data[0] || null : data || null;
};