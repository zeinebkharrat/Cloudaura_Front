/** PayPal checkout runs in a popup; return/cancel pages notify the opener via postMessage. */
export const TRANSPORT_PAYPAL_POPUP_MSG = 'cloudaura-transport-paypal' as const;

export type TransportPayPalPopupPayload = {
  type: typeof TRANSPORT_PAYPAL_POPUP_MSG;
  status: 'success' | 'cancel' | 'error';
  transportReservationId?: number;
  transportId?: number;
  message?: string;
};

export function isTransportPayPalPopupPayload(data: unknown): data is TransportPayPalPopupPayload {
  if (data == null || typeof data !== 'object') return false;
  const o = data as Record<string, unknown>;
  return (
    o['type'] === TRANSPORT_PAYPAL_POPUP_MSG &&
    (o['status'] === 'success' || o['status'] === 'cancel' || o['status'] === 'error')
  );
}
