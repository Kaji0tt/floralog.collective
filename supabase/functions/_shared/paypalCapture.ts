export interface VerifiedPayPalCapture {
  orderId: string;
  captureId: string;
  customId: string;
  grossAmount: number;
  feeAmount: number | null;
  netAmount: number | null;
  currencyCode: string;
  capturedAt: string;
}

function toOptionalAmount(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function extractVerifiedPayPalCapture(
  payload: Record<string, unknown>,
  orderId: string,
): VerifiedPayPalCapture | null {
  const purchaseUnit = (payload?.purchase_units as Array<Record<string, unknown>> | undefined)?.[0];
  const payments = purchaseUnit?.payments as Record<string, unknown> | undefined;
  const capture = (payments?.captures as Array<Record<string, unknown>> | undefined)?.[0];
  const amount = capture?.amount as Record<string, unknown> | undefined;
  const breakdown = capture?.seller_receivable_breakdown as Record<string, unknown> | undefined;
  const fee = breakdown?.paypal_fee as Record<string, unknown> | undefined;
  const net = breakdown?.net_amount as Record<string, unknown> | undefined;
  const grossAmount = Number(amount?.value);
  const captureId = String(capture?.id || "").trim();
  const currencyCode = String(amount?.currency_code || "").trim().toUpperCase();
  const status = String(capture?.status || payload?.status || "").trim().toUpperCase();

  if (
    status !== "COMPLETED" ||
    !captureId ||
    !Number.isFinite(grossAmount) ||
    grossAmount <= 0 ||
    !/^[A-Z]{3}$/.test(currencyCode)
  ) {
    return null;
  }

  return {
    orderId,
    captureId,
    customId: String(capture?.custom_id || purchaseUnit?.custom_id || "").trim(),
    grossAmount,
    feeAmount: toOptionalAmount(fee?.value),
    netAmount: toOptionalAmount(net?.value),
    currencyCode,
    capturedAt: String(capture?.create_time || new Date().toISOString()),
  };
}

export async function captureOrFetchPayPalOrder(params: {
  paypalBaseUrl: string;
  accessToken: string;
  orderId: string;
}): Promise<Record<string, unknown>> {
  const { paypalBaseUrl, accessToken, orderId } = params;
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
  const captureResponse = await fetch(`${paypalBaseUrl}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers,
  });
  const capturePayload = await captureResponse.json().catch(() => ({})) as Record<string, unknown>;
  if (captureResponse.ok) return capturePayload;

  const orderResponse = await fetch(`${paypalBaseUrl}/v2/checkout/orders/${orderId}`, {
    method: "GET",
    headers,
  });
  const orderPayload = await orderResponse.json().catch(() => ({})) as Record<string, unknown>;
  if (orderResponse.ok && String(orderPayload?.status || "").toUpperCase() === "COMPLETED") {
    return orderPayload;
  }

  throw new Error(`PayPal capture failed (${captureResponse.status})`);
}
