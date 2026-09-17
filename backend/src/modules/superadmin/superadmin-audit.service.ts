import { Request } from 'express';
import { SuperAdminLogModel, SuperAdminAction } from './superadmin-audit.model';
import mongoose from 'mongoose';

interface WriteLogParams {
  superAdminId: string;
  superAdminEmail: string;
  action: SuperAdminAction;
  targetType?: 'Organization' | 'User' | 'BlogPost' | 'PromoCode' | 'FeatureFlag' | 'Queue' | 'Announcement' | 'Changelog' | 'ABTest';
  targetId?: string;
  targetLabel?: string;
  metadata?: Record<string, unknown>;
  req?: Request;
}

/**
 * Append an immutable audit log entry. Fire-and-forget — never throws.
 */
export async function writeAuditLog(params: WriteLogParams): Promise<void> {
  try {
    await SuperAdminLogModel.create({
      superAdminId:    new mongoose.Types.ObjectId(params.superAdminId),
      superAdminEmail: params.superAdminEmail,
      action:          params.action,
      targetType:      params.targetType,
      targetId:        params.targetId,
      targetLabel:     params.targetLabel,
      metadata:        params.metadata,
      ip:              params.req ? (params.req.ip ?? params.req.socket?.remoteAddress) : undefined,
      userAgent:       params.req?.headers?.['user-agent'],
    });
  } catch (err) {
    // Audit failures must never crash the request
    console.error('[SuperAdminAudit] Failed to write audit log:', err);
  }
}

export async function getAuditLogs(
  page = 1,
  limit = 50,
  filters?: { superAdminId?: string; targetId?: string; action?: string }
) {
  const query: Record<string, unknown> = {};
  if (filters?.superAdminId) query.superAdminId = new mongoose.Types.ObjectId(filters.superAdminId);
  if (filters?.targetId)     query.targetId     = filters.targetId;
  if (filters?.action)       query.action       = filters.action;

  const skip  = (page - 1) * limit;
  const total = await SuperAdminLogModel.countDocuments(query);
  const logs  = await SuperAdminLogModel.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  return { total, page, limit, logs };
}
