export class PaymentResponseDto {
  id: string;
  display_id?: string;
  job_id: string;
  user_id: string;
  provider_id: string;
  /** Total amount charged to the customer (base service price + GST on platform fee) */
  amount: number;
  platform_fee: number;
  provider_amount: number;
  /** GST rate applied on platform fee (e.g. 18 for 18%) */
  gst_rate: number;
  /** GST amount collected on platform fee (platform_fee * gst_rate / 100) */
  gst_amount: number;
  currency: string;
  payment_method?: string;
  status: string;
  transaction_id?: string;
  failed_reason?: string;
  /** Gateway used to process this payment (stripe, razorpay, paypal, payubiz, instamojo, mock). */
  gateway: string;
  /**
   * Raw gateway response forwarded to the client.
   *
   * PayUbiz  → { txnid, key, amount, productinfo, firstname, email, hash, surl, furl, payuAction }
   *            Frontend must POST these fields to `payuAction` to complete checkout.
   *
   * Instamojo → { id, longurl, status, amount, currency }
   *             Frontend must redirect user to `longurl` to complete checkout.
   *
   * Other gateways → { clientSecret } (Stripe) or { orderId, currency } (Razorpay/PayPal).
   */
  gateway_response?: Record<string, any>;
  created_at: string;
  updated_at: string;
  /** URL to the auto-generated invoice file (available after payment completes) */
  invoice_url?: string;
  /** File service ID of the auto-generated invoice */
  invoice_file_id?: string;
}
