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
  token: string,
  /** Optional query params chained through so the invite flow survives verification */
  extra?: { next?: string; emailHint?: string }
): Promise<void> {
  const params = new URLSearchParams({ token });
  if (extra?.next)      params.set('next',  extra.next);
  if (extra?.emailHint) params.set('email', extra.emailHint);
  const verifyUrl = `${env.CLIENT_URL}/verify-email?${params.toString()}`;
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

// ─── Trial reminder emails ─────────────────────────────────────────────────

/**
 * Day-5 trial reminder — sent when 2 days remain on the free trial.
 * Tone: helpful nudge. Highlights what they'll lose, shows upgrade CTA.
 */
export async function sendTrialDay5Email(
  email: string,
  name: string,
  orgName: string,
): Promise<void> {
  const upgradeUrl = `${env.CLIENT_URL}/billing`;
  await sendEmail({
    to: email,
    subject: `⏳ 2 days left in your AgentOps Studio trial — ${orgName}`,
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #ffffff;">
        <div style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); border-radius: 12px; padding: 28px 32px; margin-bottom: 24px;">
          <h1 style="color: #ffffff; margin: 0 0 8px; font-size: 22px;">Your free trial ends in 2 days</h1>
          <p style="color: #c7d2fe; margin: 0; font-size: 15px;">Hi ${name}, don't lose access to your AI voice agent.</p>
        </div>

        <p style="color: #374151; font-size: 15px; line-height: 1.6;">
          Your 7-day free trial for <strong>${orgName}</strong> ends in <strong>2 days</strong>.
          After that, you'll revert to the free plan — which means limited knowledge base documents
          and no team members.
        </p>

        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <p style="margin: 0 0 12px; font-weight: 700; color: #111827;">What you keep with a paid plan:</p>
          <ul style="margin: 0; padding-left: 20px; color: #374151; line-height: 1.8;">
            <li>✅ AI voice agent always live — inbound calls answered 24/7</li>
            <li>✅ Up to 50 knowledge base documents</li>
            <li>✅ Team collaboration (multiple members)</li>
            <li>✅ Full call transcripts + AI summaries</li>
            <li>✅ Analytics dashboard</li>
          </ul>
        </div>

        <a href="${upgradeUrl}"
           style="display:inline-block;padding:14px 28px;background:#6366f1;color:white;
                  text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;margin:8px 0;">
          Upgrade Now — from ₹4,100/month
        </a>

        <p style="color: #6b7280; font-size: 13px; margin-top: 20px;">
          Questions? Reply to this email and we'll help you choose the right plan.
        </p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
        <p style="color: #9ca3af; font-size: 12px;">AgentOps Studio — AI Voice Agent Operations Platform</p>
      </body>
      </html>
    `,
  });
}

/**
 * Day-7 trial expiry — sent on the last day of the free trial.
 * Tone: urgency. Makes crystal clear what happens at midnight.
 */
export async function sendTrialDay7Email(
  email: string,
  name: string,
  orgName: string,
): Promise<void> {
  const upgradeUrl = `${env.CLIENT_URL}/billing`;
  await sendEmail({
    to: email,
    subject: `🚨 Trial expires TODAY — upgrade to keep your AI agent live for ${orgName}`,
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #ffffff;">
        <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); border-radius: 12px; padding: 28px 32px; margin-bottom: 24px;">
          <h1 style="color: #ffffff; margin: 0 0 8px; font-size: 22px;">Your trial ends today</h1>
          <p style="color: #fecaca; margin: 0; font-size: 15px;">Hi ${name}, this is your final reminder.</p>
        </div>

        <p style="color: #374151; font-size: 15px; line-height: 1.6;">
          Your 7-day free trial for <strong>${orgName}</strong> expires <strong>today</strong>.
        </p>

        <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <p style="margin: 0 0 8px; font-weight: 700; color: #9a3412;">⚠️ What happens when your trial ends:</p>
          <ul style="margin: 0; padding-left: 20px; color: #374151; line-height: 1.8;">
            <li>Your AI voice agent will stop answering new calls</li>
            <li>Knowledge base limited to 5 documents</li>
            <li>Team members will lose access</li>
            <li>Your call history and transcripts are safely preserved</li>
          </ul>
        </div>

        <p style="color: #374151; font-size: 15px;">
          Upgrade now and your agent stays live without interruption. No setup required.
        </p>

        <a href="${upgradeUrl}"
           style="display:inline-block;padding:14px 28px;background:#ef4444;color:white;
                  text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;margin:8px 0;">
          Upgrade Now — Keep My Agent Live
        </a>

        <p style="color: #6b7280; font-size: 13px; margin-top: 20px;">
          Need help deciding? Reply and we'll walk you through it in under 5 minutes.
        </p>
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
