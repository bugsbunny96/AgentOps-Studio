/**
 * CatalogPage — manage the org's product catalog (electrical/electronics
 * retail items used by the AI voice agent to quote prices and take orders).
 *
 * Full CRUD against /api/v1/catalog (JWT-authenticated, org-scoped):
 *   GET    /catalog          — list active items
 *   POST   /catalog          — create (itemId auto-generated if omitted)
 *   PATCH  /catalog/:id      — update
 *   DELETE /catalog/:id      — soft-delete (isActive: false)
 */

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Boxes, Plus, Pencil, Trash2, X, Loader2, AlertCircle, PackageX,
} from 'lucide-react';
import api from '@/utils/api';

// ── Types ──────────────────────────────────────────────────────────────────────
const CATEGORIES = [
  'Lighting', 'Fans', 'Switches & Sockets', 'Wires & Cables', 'Protection Devices',
  'Electrical Accessories', 'Switchgear', 'Conduits & Accessories', 'Solar Equipment',
  'Domestic Appliances', 'Industrial Components', 'Safety Equipment',
] as const;
type Category = (typeof CATEGORIES)[number];

interface CatalogItem {
  id: string;
  itemId: string;
  name: string;
  category: Category;
  brand?: string;
  price: number;
  unit: string;
  stock: number;
  isActive: boolean;
}

interface ItemFormValues {
  itemId: string;
  name: string;
  category: Category;
  brand: string;
  price: string;
  unit: string;
  stock: string;
}

const EMPTY_FORM: ItemFormValues = { itemId: '', name: '', category: CATEGORIES[0], brand: '', price: '', unit: 'piece', stock: '' };

function toFormValues(item: CatalogItem): ItemFormValues {
  return {
    itemId: item.itemId, name: item.name, category: item.category,
    brand: item.brand ?? '', price: String(item.price), unit: item.unit, stock: String(item.stock),
  };
}

// ── API ──────────────────────────────────────────────────────────────────────
async function fetchCatalog(): Promise<CatalogItem[]> {
  const { data } = await api.get<{ items: CatalogItem[] }>('/catalog');
  return data.items;
}
async function createItem(values: ItemFormValues): Promise<void> {
  await api.post('/catalog', {
    ...(values.itemId.trim() ? { itemId: values.itemId.trim().toUpperCase() } : {}),
    name: values.name.trim(),
    category: values.category,
    ...(values.brand.trim() ? { brand: values.brand.trim() } : {}),
    price: Number(values.price),
    unit: values.unit.trim() || 'piece',
    stock: Number(values.stock) || 0,
  });
}
async function updateItem(itemId: string, values: ItemFormValues): Promise<void> {
  await api.patch(`/catalog/${itemId}`, {
    name: values.name.trim(),
    category: values.category,
    brand: values.brand.trim() || undefined,
    price: Number(values.price),
    unit: values.unit.trim() || 'piece',
    stock: Number(values.stock) || 0,
  });
}
async function deleteItem(itemId: string): Promise<void> {
  await api.delete(`/catalog/${itemId}`);
}

function extractErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const resp = (err as { response?: { data?: { message?: string; error?: string } } }).response;
    return resp?.data?.message ?? resp?.data?.error ?? 'Something went wrong';
  }
  return err instanceof Error ? err.message : 'Something went wrong';
}

function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

// ── Item form modal (shared by Add / Edit) ────────────────────────────────────
function ItemFormModal({ mode, initial, onClose, onSaved }: {
  mode: 'create' | 'edit';
  initial: ItemFormValues;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<ItemFormValues>(initial);
  const [formError, setFormError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => (mode === 'create' ? createItem(values) : updateItem(initial.itemId, values)),
    onSuccess: onSaved,
    onError: (err) => setFormError(extractErrorMessage(err)),
  });

  const isValid = values.name.trim().length > 0 && Number(values.price) >= 0 && values.price !== '';

  function set<K extends keyof ItemFormValues>(key: K, val: ItemFormValues[K]) {
    setValues((v) => ({ ...v, [key]: val }));
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: 8,
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
    color: '#f1f5f9', fontSize: 13, outline: 'none',
  };
  const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: 6 };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(3,7,18,0.85)', backdropFilter: 'blur(8px)',
    }}>
      <div style={{
        width: 480, maxHeight: '90vh', overflowY: 'auto', borderRadius: 20,
        background: '#0d1524', border: '1px solid rgba(255,255,255,0.07)',
        boxShadow: '0 0 60px rgba(59,130,246,0.15)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.25)' }}>
              <Boxes size={15} style={{ color: '#60a5fa' }} />
            </div>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc', margin: 0 }}>
              {mode === 'create' ? 'Add Catalog Item' : `Edit ${initial.itemId}`}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', display: 'flex' }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {mode === 'create' && (
            <div>
              <label style={labelStyle}>Item ID (optional — auto-generated if blank)</label>
              <input style={inputStyle} value={values.itemId} onChange={(e) => set('itemId', e.target.value)} placeholder="EL-033" />
            </div>
          )}

          <div>
            <label style={labelStyle}>Name</label>
            <input style={inputStyle} value={values.name} onChange={(e) => set('name', e.target.value)} placeholder="LED Bulb 9W" autoFocus />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Category</label>
              <select style={{ ...inputStyle, colorScheme: 'dark' }} value={values.category} onChange={(e) => set('category', e.target.value as Category)}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Brand (optional)</label>
              <input style={inputStyle} value={values.brand} onChange={(e) => set('brand', e.target.value)} placeholder="Philips" />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Price (₹)</label>
              <input style={inputStyle} type="number" min="0" value={values.price} onChange={(e) => set('price', e.target.value)} placeholder="85" />
            </div>
            <div>
              <label style={labelStyle}>Unit</label>
              <input style={inputStyle} value={values.unit} onChange={(e) => set('unit', e.target.value)} placeholder="piece" />
            </div>
            <div>
              <label style={labelStyle}>Stock</label>
              <input style={inputStyle} type="number" min="0" value={values.stock} onChange={(e) => set('stock', e.target.value)} placeholder="500" />
            </div>
          </div>

          {formError && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <AlertCircle size={14} style={{ color: '#f87171', flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: '#f87171' }}>{formError}</span>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <button
              onClick={onClose}
              style={{ flex: 1, padding: '10px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              onClick={() => { setFormError(null); mutation.mutate(); }}
              disabled={!isValid || mutation.isPending}
              style={{
                flex: 1, padding: '10px', borderRadius: 8, border: 'none',
                background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', color: '#fff',
                fontSize: 13, fontWeight: 600, cursor: isValid && !mutation.isPending ? 'pointer' : 'default',
                opacity: isValid && !mutation.isPending ? 1 : 0.5,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              {mutation.isPending && <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />}
              {mode === 'create' ? 'Add Item' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Delete confirm modal ──────────────────────────────────────────────────────
function DeleteConfirmModal({ item, onClose, onDeleted }: { item: CatalogItem; onClose: () => void; onDeleted: () => void }) {
  const mutation = useMutation({ mutationFn: () => deleteItem(item.itemId), onSuccess: onDeleted });
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(3,7,18,0.85)', backdropFilter: 'blur(8px)' }}>
      <div style={{ width: 380, borderRadius: 16, background: '#0d1524', border: '1px solid rgba(255,255,255,0.07)', padding: 24 }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: '#f8fafc', margin: '0 0 8px' }}>Remove "{item.name}"?</p>
        <p style={{ fontSize: 12.5, color: '#94a3b8', margin: '0 0 20px', lineHeight: 1.6 }}>
          This item ({item.itemId}) will be deactivated and hidden from your catalog and your AI agent's product list. This can be reversed later via support.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '9px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            style={{ flex: 1, padding: '9px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.12)', color: '#f87171', fontSize: 13, fontWeight: 600, cursor: mutation.isPending ? 'default' : 'pointer', opacity: mutation.isPending ? 0.6 : 1 }}
          >
            {mutation.isPending ? 'Removing…' : 'Remove'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Component ───────────────────────────────────────────────────────────────
export default function CatalogPage() {
  const queryClient = useQueryClient();
  const [categoryFilter, setCategoryFilter] = useState<Category | 'all'>('all');
  const [modal, setModal] = useState<{ mode: 'create' } | { mode: 'edit'; item: CatalogItem } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CatalogItem | null>(null);

  const { data, isLoading, isError, error } = useQuery({ queryKey: ['catalog'], queryFn: fetchCatalog, staleTime: 30_000 });

  const items = data ?? [];
  const filtered = useMemo(
    () => categoryFilter === 'all' ? items : items.filter((i) => i.category === categoryFilter),
    [items, categoryFilter],
  );
  const usedCategories = useMemo(() => Array.from(new Set(items.map((i) => i.category))).sort(), [items]);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['catalog'] });
  }

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 320 }}>
        <Loader2 size={28} style={{ color: '#3b82f6', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  if (isError) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, height: 320 }}>
        <AlertCircle size={32} style={{ color: '#ef4444' }} />
        <p style={{ color: '#ef4444', fontSize: 14 }}>{extractErrorMessage(error)}</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>Catalog</h2>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>
            {items.length} item{items.length !== 1 ? 's' : ''} — used by your AI agent to quote prices and take orders
          </p>
        </div>
        <button
          onClick={() => setModal({ mode: 'create' })}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 9,
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', border: 'none', color: '#fff',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          <Plus size={14} /> Add Item
        </button>
      </div>

      {/* Category filter */}
      {usedCategories.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['all', ...usedCategories] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCategoryFilter(c)}
              style={{
                padding: '5px 12px', borderRadius: 999, fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
                background: categoryFilter === c ? 'rgba(59,130,246,0.18)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${categoryFilter === c ? 'rgba(59,130,246,0.35)' : 'rgba(255,255,255,0.08)'}`,
                color: categoryFilter === c ? '#60a5fa' : '#94a3b8',
              }}
            >
              {c === 'all' ? 'All Categories' : c}
            </button>
          ))}
        </div>
      )}

      {/* Empty state */}
      {filtered.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, height: 280, border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 16 }}>
          <PackageX size={40} style={{ color: '#334155' }} />
          <p style={{ color: '#64748b', fontSize: 15 }}>{items.length === 0 ? 'No catalog items yet' : 'No items in this category'}</p>
        </div>
      ) : (
        <div style={{ background: '#0f1729', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '90px 1fr 170px 110px 90px 70px 76px',
            padding: '10px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)',
            fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#475569',
          }}>
            <span>Item ID</span>
            <span>Name / Brand</span>
            <span>Category</span>
            <span>Price</span>
            <span>Stock</span>
            <span>Unit</span>
            <span />
          </div>

          {filtered.map((item) => (
            <div key={item.id} style={{
              display: 'grid', gridTemplateColumns: '90px 1fr 170px 110px 90px 70px 76px',
              padding: '13px 20px', alignItems: 'center',
              borderBottom: '1px solid rgba(255,255,255,0.04)',
            }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#3b82f6', fontFamily: 'ui-monospace, "SF Mono", monospace' }}>{item.itemId}</span>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</p>
                {item.brand && <p style={{ fontSize: 11, color: '#64748b', margin: '2px 0 0' }}>{item.brand}</p>}
              </div>
              <span style={{ fontSize: 11.5, color: '#94a3b8' }}>{item.category}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9', fontFamily: 'ui-monospace, "SF Mono", monospace' }}>{formatCurrency(item.price)}</span>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: item.stock === 0 ? '#f87171' : item.stock < 10 ? '#f59e0b' : '#94a3b8' }}>
                {item.stock}
              </span>
              <span style={{ fontSize: 11.5, color: '#64748b' }}>{item.unit}</span>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                <button onClick={() => setModal({ mode: 'edit', item })} title="Edit item" style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 6, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#60a5fa' }}>
                  <Pencil size={12} />
                </button>
                <button onClick={() => setDeleteTarget(item)} title="Remove item" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 6, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#f87171' }}>
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <ItemFormModal
          mode={modal.mode}
          initial={modal.mode === 'create' ? EMPTY_FORM : toFormValues(modal.item)}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); invalidate(); }}
        />
      )}
      {deleteTarget && (
        <DeleteConfirmModal
          item={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => { setDeleteTarget(null); invalidate(); }}
        />
      )}
    </div>
  );
}
