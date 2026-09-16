/**
 * OrdersPage — paginated order list for the authenticated org.
 *
 * Fetches from GET /api/v1/orders (JWT-authenticated, org-scoped).
 * Each row shows order ID, product, customer, amount, status, and date.
 * Owners can update order status inline.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Package, ChevronLeft, ChevronRight, AlertCircle,
  Loader2, Truck, Store, CheckCircle2, Clock, XCircle,
  RefreshCw,
} from 'lucide-react';
import api from '@/utils/api';

// ─── Types ────────────────────────────────────────────────────────────────────

type OrderStatus =
  | 'pending_payment_arrangement'
  | 'payment_received'
  | 'processing'
  | 'dispatched'
  | 'delivered'
  | 'cancelled';

interface DeliveryAddress {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  pincode?: string;
}

interface Order {
  orderId: string;
  callId?: string;
  customerName: string;
  customerPhone: string;
  product: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  fulfillmentType: 'delivery' | 'pickup';
  deliveryAddress?: DeliveryAddress;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
}

interface ListOrdersResponse {
  orders: Order[];
  total: number;
  page: number;
  pages: number;
}

// ─── API helpers ─────────────────────────────────────────────────────────────

async function fetchOrders(page: number): Promise<ListOrdersResponse> {
  const { data } = await api.get<ListOrdersResponse>('/orders', {
    params: { page: String(page), limit: '20' },
  });
  return data;
}

async function updateStatus(orderId: string, status: OrderStatus): Promise<void> {
  await api.patch(`/orders/${orderId}/status`, { status });
}

// ─── Display helpers ─────────────────────────────────────────────────────────

const STATUS_META: Record<OrderStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  pending_payment_arrangement: { label: 'Awaiting Payment',  color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',   icon: Clock       },
  payment_received:            { label: 'Payment Received',  color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',   icon: CheckCircle2 },
  processing:                  { label: 'Processing',        color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)',   icon: RefreshCw   },
  dispatched:                  { label: 'Dispatched',        color: '#06b6d4', bg: 'rgba(6,182,212,0.1)',    icon: Truck       },
  delivered:                   { label: 'Delivered',         color: '#10b981', bg: 'rgba(16,185,129,0.1)',   icon: CheckCircle2 },
  cancelled:                   { label: 'Cancelled',         color: '#ef4444', bg: 'rgba(239,68,68,0.1)',    icon: XCircle     },
};

const NEXT_STATUSES: Partial<Record<OrderStatus, OrderStatus[]>> = {
  pending_payment_arrangement: ['payment_received', 'cancelled'],
  payment_received:            ['processing', 'cancelled'],
  processing:                  ['dispatched', 'cancelled'],
  dispatched:                  ['delivered', 'cancelled'],
};

function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['orders', page],
    queryFn: () => fetchOrders(page),
    staleTime: 30_000,
  });

  const statusMutation = useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: OrderStatus }) =>
      updateStatus(orderId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  // ── Loading ──
  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 320 }}>
        <Loader2 size={28} style={{ color: '#3b82f6', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  // ── Error ──
  if (isError) {
    const msg = error instanceof Error ? error.message : 'Failed to load orders';
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 12, height: 320,
      }}>
        <AlertCircle size={32} style={{ color: '#ef4444' }} />
        <p style={{ color: '#ef4444', fontSize: 14 }}>{msg}</p>
      </div>
    );
  }

  const orders = data?.orders ?? [];
  const total  = data?.total ?? 0;
  const pages  = data?.pages ?? 1;

  // ── Empty ──
  if (orders.length === 0 && page === 1) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 16, height: 320,
        border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 16,
      }}>
        <Package size={40} style={{ color: '#334155' }} />
        <p style={{ color: '#64748b', fontSize: 15 }}>No orders yet</p>
        <p style={{ color: '#475569', fontSize: 13 }}>
          Orders will appear here when customers place them via your AI receptionist.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>Orders</h2>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>
            {total} order{total !== 1 ? 's' : ''} placed via your AI receptionist
          </p>
        </div>
      </div>

      {/* Table */}
      <div style={{
        background: '#0f1729', border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 14, overflow: 'hidden',
      }}>
        {/* Table header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '130px 1fr 160px 100px 160px 160px',
          padding: '10px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
          textTransform: 'uppercase', color: '#475569',
        }}>
          <span>Order ID</span>
          <span>Product / Customer</span>
          <span>Fulfillment</span>
          <span>Amount</span>
          <span>Status</span>
          <span>Date</span>
        </div>

        {/* Rows */}
        {orders.map((order) => {
          const meta = STATUS_META[order.status];
          const StatusIcon = meta.icon;
          const isExpanded = expandedId === order.orderId;
          const nextOpts = NEXT_STATUSES[order.status] ?? [];

          return (
            <div key={order.orderId} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              {/* Main row */}
              <div
                onClick={() => setExpandedId(isExpanded ? null : order.orderId)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '130px 1fr 160px 100px 160px 160px',
                  padding: '14px 20px',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                  background: isExpanded ? 'rgba(59,130,246,0.04)' : 'transparent',
                }}
                onMouseEnter={(e) => { if (!isExpanded) e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                onMouseLeave={(e) => { if (!isExpanded) e.currentTarget.style.background = 'transparent'; }}
              >
                {/* Order ID */}
                <span style={{ fontSize: 12, fontWeight: 700, color: '#3b82f6', fontFamily: 'monospace' }}>
                  {order.orderId}
                </span>

                {/* Product + Customer */}
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', margin: 0,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {order.product}
                    <span style={{ fontSize: 11, color: '#64748b', marginLeft: 6 }}>× {order.quantity}</span>
                  </p>
                  <p style={{ fontSize: 11, color: '#64748b', margin: '2px 0 0' }}>
                    {order.customerName} · {order.customerPhone}
                  </p>
                </div>

                {/* Fulfillment */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  {order.fulfillmentType === 'delivery' ? (
                    <><Truck size={12} style={{ color: '#8b5cf6' }} />
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>Delivery</span></>
                  ) : (
                    <><Store size={12} style={{ color: '#10b981' }} />
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>Pickup</span></>
                  )}
                </div>

                {/* Amount */}
                <span style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>
                  {formatCurrency(order.totalAmount)}
                </span>

                {/* Status badge */}
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '3px 10px', borderRadius: 999,
                  background: meta.bg, width: 'fit-content',
                }}>
                  <StatusIcon size={11} style={{ color: meta.color }} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: meta.color }}>{meta.label}</span>
                </div>

                {/* Date */}
                <span style={{ fontSize: 11, color: '#475569' }}>{formatDate(order.createdAt)}</span>
              </div>

              {/* Expanded detail panel */}
              {isExpanded && (
                <div style={{
                  padding: '16px 20px 20px',
                  background: 'rgba(15,23,41,0.8)',
                  borderTop: '1px solid rgba(255,255,255,0.06)',
                  display: 'flex', gap: 40,
                }}>
                  {/* Delivery address */}
                  {order.fulfillmentType === 'delivery' && order.deliveryAddress && (
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 6px' }}>
                        Delivery Address
                      </p>
                      <p style={{ fontSize: 13, color: '#cbd5e1', margin: 0, lineHeight: 1.7 }}>
                        {order.deliveryAddress.line1}{order.deliveryAddress.line2 ? `, ${order.deliveryAddress.line2}` : ''}<br />
                        {order.deliveryAddress.city}{order.deliveryAddress.state ? `, ${order.deliveryAddress.state}` : ''}<br />
                        PIN: {order.deliveryAddress.pincode}
                      </p>
                    </div>
                  )}

                  {/* Price breakdown */}
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 6px' }}>
                      Price Breakdown
                    </p>
                    <p style={{ fontSize: 13, color: '#cbd5e1', margin: 0, lineHeight: 1.7 }}>
                      Unit price: {formatCurrency(order.unitPrice)}<br />
                      Qty: {order.quantity}<br />
                      <strong>Total: {formatCurrency(order.totalAmount)}</strong>
                    </p>
                  </div>

                  {/* Call ID */}
                  {order.callId && (
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 6px' }}>
                        Source Call
                      </p>
                      <p style={{ fontSize: 11, fontFamily: 'monospace', color: '#64748b', margin: 0 }}>
                        {order.callId}
                      </p>
                    </div>
                  )}

                  {/* Status actions */}
                  {nextOpts.length > 0 && (
                    <div style={{ marginLeft: 'auto' }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>
                        Update Status
                      </p>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {nextOpts.map((nextStatus) => {
                          const m = STATUS_META[nextStatus];
                          return (
                            <button
                              key={nextStatus}
                              disabled={statusMutation.isPending}
                              onClick={(e) => {
                                e.stopPropagation();
                                statusMutation.mutate({ orderId: order.orderId, status: nextStatus });
                              }}
                              style={{
                                padding: '6px 14px', borderRadius: 8,
                                background: m.bg, border: `1px solid ${m.color}40`,
                                color: m.color, fontSize: 12, fontWeight: 600,
                                cursor: statusMutation.isPending ? 'wait' : 'pointer',
                                opacity: statusMutation.isPending ? 0.6 : 1,
                                transition: 'all 0.15s',
                              }}
                            >
                              → {m.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '6px 14px', borderRadius: 8,
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
              color: page === 1 ? '#334155' : '#94a3b8', cursor: page === 1 ? 'default' : 'pointer',
              fontSize: 13, fontWeight: 500,
            }}
          >
            <ChevronLeft size={14} /> Prev
          </button>
          <span style={{ fontSize: 13, color: '#475569' }}>Page {page} of {pages}</span>
          <button
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
            disabled={page === pages}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '6px 14px', borderRadius: 8,
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
              color: page === pages ? '#334155' : '#94a3b8', cursor: page === pages ? 'default' : 'pointer',
              fontSize: 13, fontWeight: 500,
            }}
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
