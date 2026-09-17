/**
 * SuperAdminBlogListPage
 * Lists all blog posts (draft + published) with inline publish toggle,
 * edit navigation, and delete with confirmation.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PlusCircle, Edit2, Trash2, Globe, EyeOff, FileText, Loader2 } from 'lucide-react';
import api from '@/utils/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BlogPost {
  _id:         string;
  slug:        string;
  title:       string;
  subtitle:    string;
  author:      string;
  tags:        string[];
  status:      'draft' | 'published';
  publishedAt?: string;
  createdAt:   string;
}

const T = {
  bg: '#07070f', bgS: '#0e0e1a', bgC: 'rgba(255,255,255,0.04)',
  bdr: 'rgba(255,255,255,0.07)', bdrB: 'rgba(255,255,255,0.12)',
  red: '#ef4444', redL: '#fca5a5',
  green: '#10b981', amber: '#f59e0b',
  t1: '#f8fafc', t2: '#94a3b8', t3: '#475569',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function SuperAdminBlogListPage() {
  const navigate     = useNavigate();
  const qc           = useQueryClient();
  const [deleteId, setDeleteId]   = useState<string | null>(null);
  const [statusFilter, setFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [page, setPage]           = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['sa-blog', page, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const r = await api.get(`/superadmin/blog?${params}`);
      return r.data.data as { posts: BlogPost[]; total: number; page: number; limit: number };
    },
  });

  const toggleMut = useMutation({
    mutationFn: (id: string) => api.patch(`/superadmin/blog/${id}/toggle`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sa-blog'] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/superadmin/blog/${id}`),
    onSuccess: () => {
      setDeleteId(null);
      qc.invalidateQueries({ queryKey: ['sa-blog'] });
    },
  });

  const posts      = data?.posts ?? [];
  const total      = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: T.t1, margin: 0 }}>Blog Posts</h1>
          <p style={{ fontSize: 13, color: T.t2, margin: '4px 0 0' }}>
            {total} post{total !== 1 ? 's' : ''} total
          </p>
        </div>
        <button
          onClick={() => navigate('/superadmin/blog/new')}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '9px 18px', borderRadius: 8,
            background: T.red, border: 'none', color: '#fff',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          <PlusCircle size={15} /> New Post
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {(['all', 'published', 'draft'] as const).map((f) => (
          <button
            key={f}
            onClick={() => { setFilter(f); setPage(1); }}
            style={{
              padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600,
              cursor: 'pointer', textTransform: 'capitalize',
              background: statusFilter === f ? T.red : T.bgC,
              border: `1px solid ${statusFilter === f ? T.red : T.bdr}`,
              color: statusFilter === f ? '#fff' : T.t2,
              transition: 'all 0.15s',
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: T.bgS, border: `1px solid ${T.bdr}`, borderRadius: 12, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
            <Loader2 size={24} color={T.red} style={{ animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : posts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 24px' }}>
            <FileText size={32} color={T.t3} style={{ marginBottom: 12 }} />
            <p style={{ color: T.t2, fontSize: 14, margin: 0 }}>No posts yet.</p>
            <button
              onClick={() => navigate('/superadmin/blog/new')}
              style={{ marginTop: 12, padding: '8px 18px', borderRadius: 8, background: T.red, border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              Write your first post
            </button>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.bdr}` }}>
                {['Title', 'Status', 'Author', 'Tags', 'Published', 'Actions'].map((h) => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: T.t3, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => (
                <tr
                  key={post._id}
                  style={{ borderBottom: `1px solid ${T.bdr}`, transition: 'background 0.15s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = T.bgC)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  {/* Title */}
                  <td style={{ padding: '14px 16px', maxWidth: 300 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: T.t1, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {post.title}
                    </p>
                    {post.subtitle && (
                      <p style={{ fontSize: 11, color: T.t3, margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {post.subtitle}
                      </p>
                    )}
                  </td>

                  {/* Status */}
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                      background: post.status === 'published' ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
                      color:      post.status === 'published' ? T.green : T.amber,
                      border:     `1px solid ${post.status === 'published' ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.25)'}`,
                    }}>
                      {post.status === 'published' ? <Globe size={10} /> : <EyeOff size={10} />}
                      {post.status}
                    </span>
                  </td>

                  {/* Author */}
                  <td style={{ padding: '14px 16px', fontSize: 12, color: T.t2 }}>{post.author}</td>

                  {/* Tags */}
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {post.tags.slice(0, 3).map((tag) => (
                        <span key={tag} style={{ padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 600, background: T.bgC, border: `1px solid ${T.bdr}`, color: T.t2 }}>
                          {tag}
                        </span>
                      ))}
                      {post.tags.length > 3 && (
                        <span style={{ fontSize: 10, color: T.t3 }}>+{post.tags.length - 3}</span>
                      )}
                    </div>
                  </td>

                  {/* Published date */}
                  <td style={{ padding: '14px 16px', fontSize: 12, color: T.t2, whiteSpace: 'nowrap' }}>
                    {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                  </td>

                  {/* Actions */}
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {/* Toggle publish */}
                      <button
                        onClick={() => toggleMut.mutate(post._id)}
                        disabled={toggleMut.isPending}
                        title={post.status === 'published' ? 'Unpublish' : 'Publish'}
                        style={{
                          padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                          cursor: 'pointer', border: `1px solid ${T.bdr}`,
                          background: T.bgC,
                          color: post.status === 'published' ? T.amber : T.green,
                          display: 'flex', alignItems: 'center', gap: 4,
                        }}
                      >
                        {post.status === 'published' ? <EyeOff size={11} /> : <Globe size={11} />}
                        {post.status === 'published' ? 'Unpublish' : 'Publish'}
                      </button>

                      {/* Edit */}
                      <button
                        onClick={() => navigate(`/superadmin/blog/${post._id}/edit`)}
                        style={{ padding: '5px 8px', borderRadius: 6, background: T.bgC, border: `1px solid ${T.bdr}`, color: T.t2, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                        title="Edit"
                      >
                        <Edit2 size={13} />
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => setDeleteId(post._id)}
                        style={{ padding: '5px 8px', borderRadius: 6, background: T.bgC, border: `1px solid ${T.bdr}`, color: T.red, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                        title="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              style={{
                width: 32, height: 32, borderRadius: 6, fontSize: 12, fontWeight: 600,
                cursor: 'pointer',
                background: page === p ? T.red : T.bgC,
                border: `1px solid ${page === p ? T.red : T.bdr}`,
                color: page === p ? '#fff' : T.t2,
              }}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteId && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={() => setDeleteId(null)}
        >
          <div
            style={{ background: T.bgS, border: `1px solid ${T.bdr}`, borderRadius: 16, padding: 32, maxWidth: 380, width: '90%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: 17, fontWeight: 700, color: T.t1, margin: '0 0 8px' }}>Delete post?</h3>
            <p style={{ fontSize: 13, color: T.t2, margin: '0 0 24px' }}>This action is permanent and cannot be undone.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteId(null)} style={{ padding: '8px 18px', borderRadius: 8, background: T.bgC, border: `1px solid ${T.bdr}`, color: T.t2, fontSize: 13, cursor: 'pointer' }}>
                Cancel
              </button>
              <button
                onClick={() => deleteMut.mutate(deleteId)}
                disabled={deleteMut.isPending}
                style={{ padding: '8px 18px', borderRadius: 8, background: T.red, border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                {deleteMut.isPending && <Loader2 size={13} style={{ animation: 'spin 0.8s linear infinite' }} />}
                Delete permanently
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
