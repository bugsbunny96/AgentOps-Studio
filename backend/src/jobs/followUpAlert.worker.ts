/**
 * Follow-Up Alert Worker
 *
 * Consumes jobs from the 'follow-up-alert' BullMQ queue.
 * For each job, it:
 *   1. Looks up the organization and its owner.
 *   2. Sends an email to the org owner with follow-up details.
 *
 * Bootstrapped in index.ts alongside other workers.
 */

import { Worker } from 'bullmq';
import mongoose from 'mongoose';
import { bullmqConnection }   from '../config/bullmq-connection';
import { OrganizationModel }  from '../modules/organization/organization.model';
import { UserModel }          from '../modules/auth/auth.model';
import { MembershipModel }    from '../modules/organization/organization.model';
import { sendEmail }          from '../utils/email';
import { logger }             from '../utils/logger';
import { env }                from '../config/env';
import type { FollowUpAlertJobData, FollowUpAlertJobName } from './followUpAlert.queue';

// ─── Email template ───────────────────────────────────────────────────────────

function buildFollowUpEmailHtml(opts: {
  ownerName: string;
  orgName: string;
  callId: string;
  callerNumber: string;
  callEndedAt: string;
  followUpReason: string | null;
  callSummary: string | null;
  callsUrl: string;
}): string {
  const callDate = new Date(opts.callEndedAt).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const reasonBlock = opts.followUpReason
    ? `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px;margin:16px 0;">
         <p style="margin:0 0 6px;font-weight:700;color:#92400e;">📌 Follow-up reason:</p>
         <p style="margin:0;color:#374151;">${opts.followUpReason}</p>
       </div>`
    : '';

  const summaryBlock = opts.callSummary
    ? `<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0;">
         <p style="margin:0 0 6px;font-weight:700;color:#374151;">📝 Call summary:</p>
         <p style="margin:0;color:#4b5563;font-size:14px;">${opts.callSummary}</p>
       </div>`
    : '';

  return `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #ffffff;">
      <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 12px; padding: 24px 28px; margin-bottom: 24px;">
        <h1 style="color: #ffffff; margin: 0 0 6px; font-size: 20px;">📞 Follow-up needed</h1>
        <p style="color: #fef3c7; margin: 0; font-size: 14px;">
          A recent call to <strong>${opts.orgName}</strong> was flagged for follow-up.
        </p>
      </div>

      <p style="color: #374151; font-size: 15px;">Hi ${opts.ownerName},</p>

      <p style="color: #374151; font-size: 15px; line-height: 1.6;">
        Your AI voice agent identified that a caller needs a follow-up after their call ended.
      </p>

      <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
        <tr>
          <td style="padding:8px 12px;background:#f9fafb;border:1px solid #e5e7eb;font-weight:600;color:#374151;width:40%;">Caller</td>
          <td style="padding:8px 12px;border:1px solid #e5e7eb;color:#111827;">${opts.callerNumber || 'Unknown'}</td>
        </tr>
        <tr>
          <td style="padding:8px 12px;background:#f9fafb;border:1px solid #e5e7eb;font-weight:600;color:#374151;">Call ended</td>
          <td style="padding:8px 12px;border:1px solid #e5e7eb;color:#111827;">${callDate} IST</td>
        </tr>
      </table>

      ${reasonBlock}
      ${summaryBlock}

      <a href="${opts.callsUrl}"
         style="display:inline-block;padding:12px 24px;background:#f59e0b;color:white;
                text-decoration:none;border-radius:8px;font-weight:700;font-size:14px;margin:8px 0;">
        View Call Details →
      </a>

      <p style="color: #6b7280; font-size: 13px; margin-top: 20px;">
        You're receiving this because your AI agent flagged this call for manual follow-up.
        To review call details and the full transcript, click the button above.
      </p>

      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
      <p style="color: #9ca3af; font-size: 12px;">
        AgentOps Studio — AI Voice Agent Operations Platform<br/>
        <a href="${env.CLIENT_URL}/settings" style="color:#9ca3af;">Manage notification preferences</a>
      </p>
    </body>
    </html>
  `;
}

// ─── Worker ───────────────────────────────────────────────────────────────────

export function startFollowUpAlertWorker() {
  const worker = new Worker<FollowUpAlertJobData, void, FollowUpAlertJobName>(
    'follow-up-alert',
    async (job) => {
      const { orgId, callId, vapiCallId, callerNumber, callEndedAt, followUpReason, callSummary } = job.data;

      logger.info('[followUpAlert] Processing job', { jobId: job.id, vapiCallId, orgId });

      // 1. Look up the organization
      const org = await OrganizationModel.findById(new mongoose.Types.ObjectId(orgId));
      if (!org) {
        logger.warn('[followUpAlert] Org not found — skipping', { orgId, vapiCallId });
        return;
      }

      // 2. Look up the org owner via Membership
      const ownerMembership = await MembershipModel.findOne({
        organizationId: org._id,
        role: 'Owner',
      });

      if (!ownerMembership) {
        logger.warn('[followUpAlert] Owner membership not found', { orgId, vapiCallId });
        return;
      }

      const owner = await UserModel.findById(ownerMembership.userId);
      if (!owner) {
        logger.warn('[followUpAlert] Owner user not found', { userId: String(ownerMembership.userId), vapiCallId });
        return;
      }

      // 3. Build the call detail URL
      const callsUrl = `${env.CLIENT_URL}/calls/${callId}`;

      // 4. Send the email
      await sendEmail({
        to:      owner.email,
        subject: `📞 Follow-up needed — call from ${callerNumber || 'unknown caller'} to ${org.name}`,
        html:    buildFollowUpEmailHtml({
          ownerName:     owner.name,
          orgName:       org.name,
          callId,
          callerNumber:  callerNumber ?? 'Unknown',
          callEndedAt,
          followUpReason: followUpReason ?? null,
          callSummary:   callSummary ?? null,
          callsUrl,
        }),
      });

      logger.info('[followUpAlert] Alert email sent', {
        to:       owner.email,
        orgId,
        vapiCallId,
      });
    },
    {
      connection:  bullmqConnection,
      concurrency: 3, // 3 alert emails can be sent in parallel
    },
  );

  worker.on('completed', (job) => {
    logger.info('[followUpAlert] Job completed', { jobId: job.id });
  });

  worker.on('failed', (job, err) => {
    logger.error('[followUpAlert] Job failed', {
      jobId:   job?.id,
      attempt: job?.attemptsMade,
      error:   err.message,
    });
  });

  logger.info('✅  Follow-up alert worker started');
  return worker;
}
