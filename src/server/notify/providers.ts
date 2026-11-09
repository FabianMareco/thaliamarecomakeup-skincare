import nodemailer from "nodemailer";
import { Resend } from "resend";
import { env } from "../env";

// Proveedores de envío. Si no hay credenciales, quedan en modo "disabled":
// no envían y el resultado queda registrado como `skipped` en el log.

export type SendResult = { status: "sent" | "skipped" | "failed"; id?: string; error?: string };

export type EmailAttachment = { filename: string; content: string; contentType: string };
export type EmailMessage = { to: string; subject: string; html: string; text: string; attachments?: EmailAttachment[] };

export interface EmailProvider {
  send(msg: EmailMessage): Promise<SendResult>;
}

export interface WhatsAppProvider {
  readonly mode: "disabled" | "cloud_api";
  sendTemplate(msg: { to: string; template: string; language: string; params: string[] }): Promise<SendResult>;
}

class ResendEmail implements EmailProvider {
  constructor(private apiKey: string) {}
  async send({ attachments, ...msg }: EmailMessage): Promise<SendResult> {
    try {
      const { data, error } = await new Resend(this.apiKey).emails.send({
        from: env.emailFrom,
        ...msg,
        ...(attachments?.length ? { attachments: attachments.map((a) => ({ filename: a.filename, content: Buffer.from(a.content), contentType: a.contentType })) } : {}),
      });
      if (error) return { status: "failed", error: error.message };
      return { status: "sent", id: data?.id };
    } catch (e) {
      return { status: "failed", error: (e as Error).message };
    }
  }
}

/** Envío por SMTP; por ejemplo, una cuenta de Gmail con contraseña de aplicación. */
class SmtpEmail implements EmailProvider {
  constructor(private cfg: { host: string; port: number; user: string; pass: string }) {}
  async send(msg: EmailMessage): Promise<SendResult> {
    try {
      const transport = nodemailer.createTransport({
        host: this.cfg.host,
        port: this.cfg.port,
        secure: this.cfg.port === 465,
        auth: { user: this.cfg.user, pass: this.cfg.pass },
      });
      const info = await transport.sendMail({ from: env.emailFrom, ...msg });
      return { status: "sent", id: info.messageId };
    } catch (e) {
      return { status: "failed", error: (e as Error).message };
    }
  }
}

class LogEmail implements EmailProvider {
  async send(msg: { to: string; subject: string }): Promise<SendResult> {
    if (process.env.NODE_ENV !== "test") console.info(`[email:disabled] → ${msg.to}: ${msg.subject}`);
    return { status: "skipped", error: "Email no configurado (RESEND_API_KEY o SMTP_USER/SMTP_PASS)" };
  }
}

const GRAPH_VERSION = "v21.0";

class CloudApiWhatsApp implements WhatsAppProvider {
  readonly mode = "cloud_api" as const;
  constructor(private phoneNumberId: string, private token: string) {}
  async sendTemplate(msg: { to: string; template: string; language: string; params: string[] }): Promise<SendResult> {
    try {
      const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${this.phoneNumberId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: msg.to.replace(/\D/g, ""),
          type: "template",
          template: {
            name: msg.template,
            language: { code: msg.language },
            components: [{ type: "body", parameters: msg.params.map((text) => ({ type: "text", text })) }],
          },
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message: string } };
      if (!res.ok) return { status: "failed", error: body.error?.message ?? `HTTP ${res.status}` };
      return { status: "sent", id: body.messages?.[0]?.id };
    } catch (e) {
      return { status: "failed", error: (e as Error).message };
    }
  }
}

class DisabledWhatsApp implements WhatsAppProvider {
  readonly mode = "disabled" as const;
  async sendTemplate(msg: { to: string; template: string }): Promise<SendResult> {
    if (process.env.NODE_ENV !== "test") console.info(`[whatsapp:disabled] → ${msg.to}: ${msg.template}`);
    return { status: "skipped", error: "WHATSAPP_MODE=disabled" };
  }
}

export function emailProvider(): EmailProvider {
  const key = env.resendApiKey;
  if (key) return new ResendEmail(key);
  const smtp = env.smtp;
  if (smtp) return new SmtpEmail(smtp);
  return new LogEmail();
}

export function whatsappProvider(): WhatsAppProvider {
  const id = env.whatsappPhoneNumberId;
  const token = env.whatsappAccessToken;
  if (env.whatsappMode === "cloud_api" && id && token) return new CloudApiWhatsApp(id, token);
  return new DisabledWhatsApp();
}
