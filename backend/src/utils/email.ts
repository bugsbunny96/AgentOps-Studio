import { Resend } from 'resend';
import { env } from '../config/env';
import { logger } from './logger';

let resendClient: Resend | null = null;

function getResend(): Resend | null {
  if (!env.RESEND_API_KEY) return null;
  if (!resendClient) resendClient = new Resend(env.RESEND_API_KEY);
  return resendClient;
}

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(opts: SendEmailOptions): Promise<void> {
  const client = getResend();

  if (!client) {
    // Dev mode: print to console instead of sending
    logger.info(`[DEV EMAIL] ─────────────────────────────────`);
    logger.info(`[DEV EMAIL] To:      ${opts.to}`);
    logger.info(`[DEV EMAIL] Subject: ${opts.subject}`);
    logger.debug(`[DEV EMAIL] HTML:\n${opts.html}`);
    logger.info(`[DEV EMAIL] ─────────────────────────────────`);
    return;
  }

  const { error } = await client.emails.send({
    from: env.EMAIL_FROM,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
  });

  if (error) {
    // In dev, fall back to console instead of crashing (e.g. unverified domain)
    if (env.NODE_ENV !== 'production') {
      logger.warn('Resend delivery failed — falling back to console (dev mode)', { reason: error.message });
      logger.info(`[DEV EMAIL] ─────────────────────────────────`);
      logger.info(`[DEV EMAIL] To:      ${opts.to}`);
      logger.info(`[DEV EMAIL] Subject: ${opts.subject}`);
      logger.debug(`[DEV EMAIL] HTML:\n${opts.html}`);
      logger.info(`[DEV EMAIL] ─────────────────────────────────`);
      return;
    }
    logger.error('Failed to send email via Resend', { to: opts.to, subject: opts.subject, error });
    throw new Error(`Email send failed: ${error.message}`);
  }
}

export async function sendVerificationEmail(
  email: string,
  name: string,
  token: string
): Promise<void> {
  const verifyUrl = `${env.CLIENT_URL}/verify-email?token=${token}`;
  // Always log in dev so the token is easy to grab without needing a real email
  if (env.NODE_ENV !== 'production') {
    logger.info(`[DEV] ✉️  Verification URL for ${email}: ${verifyUrl}`);
  }
  await sendEmail({
    to: email,
    subject: 'Verify your AgentOps Studio account',
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #1e1b4b;">Welcome to AgentOps Studio, ${name}!</h2>
        <p style="color: #374151;">Please verify your email address to activate your account.</p>
        <a href="${verifyUrl}"
           style="display:inline-block;padding:12px 24px;background:#6366f1;color:white;
                  text-decoration:none;border-radius:6px;font-weight:600;margin:16px 0;">
          Verify Email Address
        </a>
        <p style="color: #6b7280; font-size: 14px;">This link expires in <strong>24 hours</strong>.</p>
        <p style="color: #6b7280; font-size: 14px;">If you didn't create this account, you can safely ignore this email.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
        <p style="color: #9ca3af; font-size: 12px;">AgentOps Studio — AI Voice Agent Operations Platform</p>
      </body>
      </html>
    `,
  });
}

export async function sendPasswordResetEmail(
  email: string,
  name: string,
  token: string
): Promise<void> {
  const resetUrl = `${env.CLIENT_URL}/reset-password?token=${token}`;
  await sendEmail({
    to: email,
    subject: 'Reset your AgentOps Studio password',
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #1e1b4b;">Password Reset Request</h2>
        <p style="color: #374151;">Hi ${name}, we received a request to reset your AgentOps Studio password.</p>
        <a href="${resetUrl}"
           style="display:inline-block;padding:12px 24px;background:#6366f1;color:white;
                  text-decoration:none;border-radius:6px;font-weight:600;margin:16px 0;">
          Reset Password
        </a>
        <p style="color: #6b7280; font-size: 14px;">This link expires in <strong>1 hour</strong>.</p>
        <p style="color: #6b7280; font-size: 14px;">If you didn't request this, ignore this email — your password won't change.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
        <p style="color: #9ca3af; font-size: 12px;">AgentOps Studio — AI Voice Agent Operations Platform</p>
      </body>
      </html>
    `,
  });
}
