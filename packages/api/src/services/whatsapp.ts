/**
 * Server-side Meta WhatsApp Cloud API provider. Sends a pre-approved template
 * message. Server-only — relies on WHATSAPP_* env vars and must never run in the
 * browser.
 *
 * Env:
 *   WHATSAPP_ACCESS_TOKEN          permanent/system-user token
 *   WHATSAPP_PHONE_NUMBER_ID       sender phone-number id
 *   WHATSAPP_API_VERSION           graph API version (default v21.0)
 *   WHATSAPP_TEMPLATE_REMINDER_24H approved template name
 *   WHATSAPP_TEMPLATE_LANG         template language code (default "he")
 *
 * The 24h reminder template must expose 6 body variables, in this order:
 *   {{1}} client name  {{2}} business name  {{3}} service name
 *   {{4}} date         {{5}} time           {{6}} confirmation link
 */

export interface WhatsAppReminderArgs {
  to: string; // normalized "972…" recipient
  clientName: string;
  businessName: string;
  serviceName: string;
  date: string;
  time: string;
  confirmUrl: string;
}

export interface WhatsAppSendResult {
  messageId: string;
}

/**
 * Error carrying the Meta API error code + message parsed from the response
 * body, so callers can record both — not just the HTTP status.
 */
export class WhatsAppApiError extends Error {
  readonly code: number | null;
  constructor(message: string, code: number | null) {
    super(message);
    this.name = "WhatsAppApiError";
    this.code = code;
  }
}

interface WhatsAppApiResponse {
  messages?: { id: string }[];
  error?: { message?: string; code?: number };
}

const GRAPH_BASE = "https://graph.facebook.com";

export async function sendWhatsAppReminder(
  args: WhatsAppReminderArgs,
): Promise<WhatsAppSendResult> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const apiVersion = process.env.WHATSAPP_API_VERSION ?? "v21.0";
  const template = process.env.WHATSAPP_TEMPLATE_REMINDER_24H;
  const lang = process.env.WHATSAPP_TEMPLATE_LANG ?? "he";

  if (!token || !phoneNumberId || !template) {
    throw new Error(
      "WhatsApp not configured (WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_TEMPLATE_REMINDER_24H).",
    );
  }

  const body = {
    messaging_product: "whatsapp",
    to: args.to,
    type: "template",
    template: {
      name: template,
      language: { code: lang },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: args.clientName },
            { type: "text", text: args.businessName },
            { type: "text", text: args.serviceName },
            { type: "text", text: args.date },
            { type: "text", text: args.time },
            { type: "text", text: args.confirmUrl },
          ],
        },
      ],
    },
  };

  const res = await fetch(`${GRAPH_BASE}/${apiVersion}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const json = (await res.json().catch(() => null)) as WhatsAppApiResponse | null;

  if (!res.ok) {
    // Prefer the structured Meta error (code + message) over the bare HTTP status.
    const apiMessage = json?.error?.message ?? `HTTP ${res.status}`;
    const apiCode = json?.error?.code ?? null;
    throw new WhatsAppApiError(apiMessage, apiCode);
  }

  const messageId = json?.messages?.[0]?.id;
  if (!messageId) {
    throw new Error("WhatsApp send: no message id returned");
  }
  return { messageId };
}
