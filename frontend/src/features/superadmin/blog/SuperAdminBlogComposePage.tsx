/**
 * SuperAdminBlogComposePage
 * Create or edit a blog post.
 *
 * Routes:
 *   /superadmin/blog/new         — create
 *   /superadmin/blog/:id/edit    — edit existing
 *
 * Features:
 *   - Split-pane: left = Markdown editor, right = live preview
 *   - Save Draft / Publish Now buttons
 *   - Tag input (comma-separated)
 *   - Cover image URL input
 */

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Eye, EyeOff, Loader2, Save, Globe } from 'lucide-react';
import api from '@/utils/api';

// ─── Minimal Markdown renderer ─────────────────────────────────────────────────

function renderMarkdown(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3 style="font-size:16px;font-weight:700;margin:20px 0 8px">$1</h3>')
    .replace(/^## (.+)$/gm,  '<h2 style="font-size:18px;font-weight:800;margin:24px 0 10px">$1</h2>')
    .replace(/^# (.+)$/gm,   '<h1 style="font-size:22px;font-weight:900;margin:28px 0 12px">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,     '<em>$1</em>')
    .replace(/`(.+?)`/g,       '<code style="background:rgba(255,255,255,0.08);padding:2px 6px;border-radius:4px;font-size:0.9em">$1</code>')
    .replace(/^> (.+)$/gm,     '<blockquote style="border-left:3px solid #ef4444;margin:12px 0;padding:8px 16px;color:#94a3b8">$1</blockquote>')
    .replace(/^- (.+)$/gm,     '<li style="margin:4px 0 4px 20px;color:#94a3b8">$1</li>')
    .replace(/\n\n/g,          '</p><p style="margin:0 0 12px;color:#94a3b8;line-height:1.8">')
    .replace(/^(?!<[hbcl])/gm, '')
    .replace(/^(.+)$/gm, (line) =>
      line.startsWith('<') ? line : `<p style="margin:0 0 12px;color:#94a3b8;line-height:1.8">${line}</p>`
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const T = {
  bg: '#07070f', bgS: '#0e0e1a', bgC: 'rgba(255,255,255,0.04)',
  bdr: 'rgba(255,255,255,0.07)', bdrB: 'rgba(255,255,255,0.14)',
  red: '#ef4444', green: '#10b981', amber: '#f59e0b',
  t1: '#f8fafc', t2: '#94a3b8', t3: '#475569',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13,
  background: T.bgC, border: `1px solid ${T.bdr}`, color: T.t1,
  outline: 'none', boxSizing: 'border-box', fontFamily: 'Inter, system-ui, sans-serif',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function SuperAdminBlogComposePage() {
  const navigate    = useNavigate();
  const { id }      = useParams<{ id?: string }>();
  const qc          = useQueryClient();
  const isEdit      = Boolean(id);
  const [preview, setPreview] = useState(false);

  // Form state
  const [title,      setTitle]      = useState('');
  const [subtitle,   setSubtitle]   = useState('');
  const [body,       setBody]       = useState('');
  const [author,     setAuthor]     = useState('');
  const [tagsInput,  setTagsInput]  = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [serverErr,  setServerErr]  = useState<string | null>(null);

  // Load existing post for edit
  const { isLoading: loadingPost } = useQuery({
    queryKey: ['sa-blog-edit', id],
    enabled:  isEdit,
    queryFn:  async () => {
      const r = await api.get(`/superadmin/blog/${id}`);
      return r.data.data;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    select: (data: any) => {
      setTitle(data.title ?? '');
      setSubtitle(data.subtitle ?? '');
      setBody(data.body ?? '');
      setAuthor(data.author ?? '');
      setTagsInput((data.tags ?? []).join(', '));
      setCoverImage(data.coverImage ?? '');
      return data;
    },
  });

  const saveMut = useMutation({
    mutationFn: (payload: { status: 'draft' | 'published' }) =>
      isEdit
        ? api.patch(`/superadmin/blog/${id}`, { title, subtitle, body, author, coverImage, tags: tagsInput, ...payload })
        : api.post('/superadmin/blog', { title, subtitle, body, author, coverImage, tags: tagsInput, ...payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sa-blog'] });
      navigate('/superadmin/blog');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      setServerErr(msg ?? 'Something went wrong. Please try again.');
    },
  });

  const charCount = body.length;

  if (loadingPost) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <Loader2 size={28} color={T.red} style={{ animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)', overflow: 'hidden' }}>

      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 0 18px', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => navigate('/superadmin/blog')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: T.t2, fontSize: 13, cursor: 'pointer', padding: 0 }}
          >
            <ArrowLeft size={14} /> Back
          </button>
          <h1 style={{ fontSize: 18, fontWeight: 800, color: T.t1, margin: 0 }}>
            {isEdit ? 'Edit Post' : 'New Blog Post'}
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Preview toggle */}
          <button
            onClick={() => setPreview((v) => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, background: T.bgC, border: `1px solid ${T.bdr}`, color: T.t2, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          >
            {preview ? <EyeOff size={13} /> : <Eye size={13} />}
            {preview ? 'Edit' : 'Preview'}
          </button>

          {/* Save Draft */}
          <button
            onClick={() => { setServerErr(null); saveMut.mutate({ status: 'draft' }); }}
            disabled={saveMut.isPending || !title.trim() || !body.trim()}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 8, background: T.bgC, border: `1px solid ${T.bdr}`, color: T.t2, fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: (!title.trim() || !body.trim()) ? 0.5 : 1 }}
          >
            {saveMut.isPending && <Loader2 size={12} style={{ animation: 'spin 0.8s linear infinite' }} />}
            <Save size={12} /> Save Draft
          </button>

          {/* Publish */}
          <button
            onClick={() => { setServerErr(null); saveMut.mutate({ status: 'published' }); }}
            disabled={saveMut.isPending || !title.trim() || !body.trim()}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 8, background: T.red, border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: (!title.trim() || !body.trim()) ? 0.5 : 1 }}
          >
            {saveMut.isPending && <Loader2 size={12} style={{ animation: 'spin 0.8s linear infinite' }} />}
            <Globe size={12} /> Publish Now
          </button>
        </div>
      </div>

      {serverErr && (
        <div style={{ padding: '10px 16px', background: 'rgba(239,68,68,0.1)', border: `1px solid rgba(239,68,68,0.3)`, borderRadius: 8, color: '#fca5a5', fontSize: 13, marginBottom: 16, flexShrink: 0 }}>
          {serverErr}
        </div>
      )}

      {/* Meta fields row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16, flexShrink: 0 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: T.t3, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>
            Title <span style={{ color: T.red }}>*</span>
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Post title"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: T.t3, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>Subtitle</label>
          <input
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="Optional subheading"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: T.t3, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>Author</label>
          <input
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="Display name"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: T.t3, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>Tags (comma-separated)</label>
          <input
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="roi, how-to, voice-ai"
            style={inputStyle}
          />
        </div>
        <div style={{ gridColumn: 'span 2' }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: T.t3, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>Cover Image URL</label>
          <input
            value={coverImage}
            onChange={(e) => setCoverImage(e.target.value)}
            placeholder="https://example.com/image.jpg"
            style={inputStyle}
          />
        </div>
      </div>

      {/* Editor / Preview pane */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', gap: 16 }}>
        {/* Editor */}
        {!preview && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: T.bgS, border: `1px solid ${T.bdr}`, borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '8px 14px', borderBottom: `1px solid ${T.bdr}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: T.t3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Markdown</span>
              <span style={{ fontSize: 11, color: T.t3 }}>{charCount.toLocaleString()} chars</span>
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your post in Markdown…&#10;&#10;# Heading&#10;**Bold** and *italic* supported.&#10;&#10;> Blockquote&#10;&#10;- List item"
              style={{
                flex: 1, padding: 16, background: 'transparent', border: 'none',
                color: T.t1, fontSize: 13, lineHeight: 1.7, resize: 'none',
                outline: 'none', fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                boxSizing: 'border-box', width: '100%',
              }}
            />
          </div>
        )}

        {/* Preview */}
        {preview && (
          <div style={{ flex: 1, background: T.bgS, border: `1px solid ${T.bdr}`, borderRadius: 12, overflow: 'auto', padding: '24px 32px' }}>
            {coverImage && (
              <img src={coverImage} alt="cover" style={{ width: '100%', maxHeight: 260, objectFit: 'cover', borderRadius: 12, marginBottom: 24 }} />
            )}
            <h1 style={{ fontSize: 26, fontWeight: 900, color: T.t1, margin: '0 0 8px', lineHeight: 1.2 }}>{title || 'Untitled'}</h1>
            {subtitle && <p style={{ fontSize: 15, color: T.t2, margin: '0 0 20px', lineHeight: 1.6 }}>{subtitle}</p>}
            {author && <p style={{ fontSize: 12, color: T.t3, margin: '0 0 28px' }}>By {author}</p>}
            <div
              style={{ color: T.t2, fontSize: 14, lineHeight: 1.8 }}
              dangerouslySetInnerHTML={{ __html: body ? renderMarkdown(body) : '<p style="color:#475569">Nothing to preview yet…</p>' }}
            />
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
