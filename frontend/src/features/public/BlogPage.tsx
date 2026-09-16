/**
 * BlogPage — dynamic, API-driven
 * Route: /blog (public)
 *
 * Fetches published posts from GET /api/v1/blog.
 * Clicking a card fetches the full post body and renders it inline.
 * Falls back to an elegant empty state if there are no posts yet.
 */

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '@/utils/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BlogPostCard {
  _id:         string;
  slug:        string;
  title:       string;
  subtitle:    string;
  author:      string;
  tags:        string[];
  publishedAt: string;
  createdAt:   string;
}

interface BlogPostFull extends BlogPostCard {
  body:        string;
  coverImage?: string;
}

// ─── Design tokens ────────────────────────────────────────────────────────────

const T = {
  bg: '#030712', bgS: '#0d1524',
  bgC: 'rgba(255,255,255,0.03)', bdr: 'rgba(255,255,255,0.07)', bdrB: 'rgba(255,255,255,0.12)',
  blue: '#3b82f6', violet: '#8b5cf6', em: '#10b981',
  t1: '#f8fafc', t2: '#94a3b8', t3: '#475569',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const pill = (bg: string, color: string, border: string): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700,
  padding: '4px 10px', borderRadius: 999, background: bg, color, border: `1px solid ${border}`,
});

function tagColor(index: number) {
  const palette = [T.em, T.violet, T.blue, '#f59e0b', '#ec4899'];
  return palette[index % palette.length];
}

function readTime(body: string) {
  const words = body.split(/\s+/).length;
  const mins  = Math.max(1, Math.round(words / 200));
  return `${mins} min read`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ─── Minimal Markdown renderer (same as Compose page) ─────────────────────────

function renderMarkdown(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3 style="font-size:17px;font-weight:700;color:#f8fafc;margin:24px 0 10px">$1</h3>')
    .replace(/^## (.+)$/gm,  '<h2 style="font-size:20px;font-weight:800;color:#f8fafc;margin:32px 0 12px">$1</h2>')
    .replace(/^# (.+)$/gm,   '<h1 style="font-size:24px;font-weight:900;color:#f8fafc;margin:36px 0 14px">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#f8fafc">$1</strong>')
    .replace(/\*(.+?)\*/g,     '<em>$1</em>')
    .replace(/`(.+?)`/g,       '<code style="background:rgba(255,255,255,0.08);padding:2px 6px;border-radius:4px;font-size:0.9em;font-family:monospace">$1</code>')
    .replace(/^> (.+)$/gm,     '<blockquote style="border-left:3px solid #3b82f6;margin:16px 0;padding:10px 18px;color:#94a3b8;background:rgba(59,130,246,0.06);border-radius:0 8px 8px 0">$1</blockquote>')
    .replace(/^- (.+)$/gm,     '<li style="margin:6px 0 6px 24px;color:#94a3b8;line-height:1.7">$1</li>')
    .split('\n\n')
    .map((block) => {
      if (block.startsWith('<h') || block.startsWith('<blockquote') || block.startsWith('<li')) return block;
      return `<p style="color:#94a3b8;font-size:15px;line-height:1.85;margin:0 0 16px">${block}</p>`;
    })
    .join('');
}

// ─── Scroll-reveal wrapper ─────────────────────────────────────────────────────

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVis(true); io.disconnect(); } }, { threshold: 0.06 });
    io.observe(el); return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ opacity: vis ? 1 : 0, transform: vis ? 'none' : 'translateY(18px)', transition: `opacity .6s ease ${delay}ms, transform .6s ease ${delay}ms` }}>
      {children}
    </div>
  );
}

// ─── Full article view ─────────────────────────────────────────────────────────

function ArticleView({ slug, onClose }: { slug: string; onClose: () => void }) {
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, []);

  const { data: post, isLoading } = useQuery<BlogPostFull>({
    queryKey: ['blog-post', slug],
    queryFn:  async () => {
      const r = await api.get(`/blog/${slug}`);
      return r.data.data;
    },
  });

  const color = tagColor(0);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid rgba(59,130,246,0.2)', borderTopColor: T.blue, animation: 'spin .7s linear infinite' }} />
      </div>
    );
  }

  if (!post) return null;

  const primaryTag = post.tags[0] ?? 'Article';
  const tc = tagColor(0);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 24px 100px' }}>
      <button
        onClick={onClose}
        style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'none', border: 'none', color: T.t2, fontSize: 13, cursor: 'pointer', padding: '12px 0', fontFamily: 'inherit', marginBottom: 32 }}
      >
        ← Back to blog
      </button>

      {post.coverImage && (
        <img src={post.coverImage} alt="" style={{ width: '100%', maxHeight: 320, objectFit: 'cover', borderRadius: 16, marginBottom: 32 }} />
      )}

      <div style={{ marginBottom: 12 }}>
        <span style={pill(`${tc}15`, tc, `${tc}30`)}>{primaryTag}</span>
      </div>
      <h1 style={{ fontSize: 'clamp(24px,4vw,40px)', fontWeight: 900, lineHeight: 1.15, margin: '0 0 14px', letterSpacing: '-0.02em', color: T.t1 }}>{post.title}</h1>
      {post.subtitle && <p style={{ color: T.t2, fontSize: 16, lineHeight: 1.6, margin: '0 0 20px' }}>{post.subtitle}</p>}
      <div style={{ display: 'flex', gap: 16, color: T.t3, fontSize: 12, marginBottom: 40, flexWrap: 'wrap' }}>
        <span>By {post.author}</span>
        <span>·</span>
        <span>{formatDate(post.publishedAt)}</span>
        <span>·</span>
        <span>{readTime(post.body)}</span>
      </div>

      <div dangerouslySetInnerHTML={{ __html: renderMarkdown(post.body) }} />

      <div style={{ background: `linear-gradient(135deg, ${color}15, ${color}08)`, border: `1px solid ${color}30`, borderRadius: 16, padding: '28px 32px', textAlign: 'center', marginTop: 56 }}>
        <p style={{ color: T.t2, fontSize: 14, margin: '0 0 16px' }}>Ready to transform your inbound calls?</p>
        <Link to="/register" style={{ display: 'inline-flex', alignItems: 'center', padding: '12px 28px', borderRadius: 9, background: color, color: '#fff', fontWeight: 700, fontSize: 15, textDecoration: 'none' }}>
          Start free →
        </Link>
      </div>
    </div>
  );
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div style={{ background: T.bgC, border: `1px solid ${T.bdr}`, borderRadius: 20, padding: 'clamp(24px,4vw,36px)' }}>
      <div style={{ display: 'flex', gap: 24 }}>
        <div style={{ width: 68, height: 68, borderRadius: 16, background: 'rgba(255,255,255,0.05)', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ width: 80, height: 20, borderRadius: 999, background: 'rgba(255,255,255,0.06)', marginBottom: 12 }} />
          <div style={{ width: '80%', height: 22, borderRadius: 8, background: 'rgba(255,255,255,0.06)', marginBottom: 10 }} />
          <div style={{ width: '60%', height: 16, borderRadius: 8, background: 'rgba(255,255,255,0.04)' }} />
        </div>
      </div>
    </div>
  );
}

// ─── BlogPage ─────────────────────────────────────────────────────────────────

export default function BlogPage() {
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['blog-list', page, tagFilter],
    queryFn:  async () => {
      const params = new URLSearchParams({ page: String(page), limit: '10' });
      if (tagFilter) params.set('tag', tagFilter);
      const r = await api.get(`/blog?${params}`);
      return r.data.data as { posts: BlogPostCard[]; total: number; page: number; limit: number };
    },
  });

  if (openSlug) {
    return (
      <div style={{ background: T.bg, color: T.t1, minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif', paddingTop: 64 }}>
        <ArticleView slug={openSlug} onClose={() => setOpenSlug(null)} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const posts      = data?.posts ?? [];
  const total      = data?.total ?? 0;
  const totalPages = Math.ceil(total / 10);

  // Collect all tags for filter
  const allTags = Array.from(new Set(posts.flatMap((p) => p.tags))).slice(0, 8);

  return (
    <div style={{ background: T.bg, color: T.t1, minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* Hero */}
      <section style={{ padding: 'clamp(80px,10vw,120px) 24px 60px', textAlign: 'center' }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <div style={{ marginBottom: 20 }}>
            <span style={pill('rgba(59,130,246,0.1)', T.blue, 'rgba(59,130,246,0.25)')}>● Resource Library</span>
          </div>
          <h1 style={{ fontSize: 'clamp(28px,5vw,52px)', fontWeight: 900, lineHeight: 1.1, margin: '0 0 16px', letterSpacing: '-0.03em' }}>
            Guides for AI-powered{' '}
            <span style={{ background: `linear-gradient(135deg, ${T.blue}, ${T.violet})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              voice operations
            </span>
          </h1>
          <p style={{ color: T.t2, fontSize: 'clamp(14px,2vw,17px)', lineHeight: 1.7, margin: 0 }}>
            Practical guides for Indian SMBs deploying AI voice agents — ROI calculators, setup walkthroughs, and real case studies.
          </p>
        </div>
      </section>

      {/* Tag filters */}
      {allTags.length > 0 && (
        <section style={{ maxWidth: 800, margin: '0 auto', padding: '0 24px 28px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={() => { setTagFilter(undefined); setPage(1); }}
            style={{ padding: '5px 14px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1px solid ${!tagFilter ? T.blue : T.bdr}`, background: !tagFilter ? 'rgba(59,130,246,0.1)' : T.bgC, color: !tagFilter ? T.blue : T.t2 }}
          >
            All
          </button>
          {allTags.map((tag, i) => {
            const tc = tagColor(i);
            const active = tagFilter === tag;
            return (
              <button
                key={tag}
                onClick={() => { setTagFilter(tag); setPage(1); }}
                style={{ padding: '5px 14px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1px solid ${active ? tc : T.bdr}`, background: active ? `${tc}15` : T.bgC, color: active ? tc : T.t2 }}
              >
                {tag}
              </button>
            );
          })}
        </section>
      )}

      {/* Post list */}
      <section style={{ maxWidth: 800, margin: '0 auto', padding: '0 24px 100px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {isLoading && [0, 1].map((i) => (
          <Reveal key={i} delay={i * 60}><SkeletonCard /></Reveal>
        ))}

        {isError && (
          <div style={{ textAlign: 'center', padding: '48px 24px', color: T.t2 }}>
            <p>Failed to load posts. Please try again later.</p>
          </div>
        )}

        {!isLoading && !isError && posts.length === 0 && (
          <Reveal>
            <div style={{ background: T.bgC, border: `1px dashed ${T.bdr}`, borderRadius: 20, padding: 'clamp(32px,6vw,56px)', textAlign: 'center' }}>
              <p style={{ color: T.t2, fontSize: 16, margin: '0 0 8px', fontWeight: 600 }}>No articles yet</p>
              <p style={{ color: T.t3, fontSize: 13, margin: 0 }}>
                Hindi vs English scripts · Comparing Vapi vs Twilio · Reducing AI hallucinations in customer calls — coming soon.
              </p>
            </div>
          </Reveal>
        )}

        {!isLoading && posts.map((post, i) => {
          const primaryTag = post.tags[0] ?? 'Article';
          const tc         = tagColor(i);
          return (
            <Reveal key={post._id} delay={i * 80}>
              <button
                onClick={() => setOpenSlug(post.slug)}
                style={{
                  display: 'block', width: '100%', background: T.bgC,
                  border: `1px solid ${T.bdr}`, borderRadius: 20,
                  padding: 'clamp(24px,4vw,36px)', textAlign: 'left',
                  cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'border-color .25s, transform .25s', color: 'inherit',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.bdrB; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.bdr;  e.currentTarget.style.transform = 'none'; }}
              >
                <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
                  {/* Cover image or emoji fallback */}
                  <div style={{
                    fontSize: 28, flexShrink: 0, width: 68, height: 68,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: `${tc}12`, border: `1px solid ${tc}25`, borderRadius: 16,
                    overflow: 'hidden',
                  }}>
                    📝
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                      {post.tags.slice(0, 2).map((tag, ti) => (
                        <span key={tag} style={pill(`${tagColor(ti)}15`, tagColor(ti), `${tagColor(ti)}30`)}>{tag}</span>
                      ))}
                      <span style={{ color: T.t3, fontSize: 12 }}>
                        {formatDate(post.publishedAt)}
                      </span>
                    </div>
                    <h2 style={{ fontSize: 'clamp(16px,2.5vw,22px)', fontWeight: 800, margin: '0 0 8px', color: T.t1, lineHeight: 1.2 }}>
                      {post.title}
                    </h2>
                    {post.subtitle && (
                      <p style={{ color: T.t2, fontSize: 14, lineHeight: 1.6, margin: '0 0 16px' }}>{post.subtitle}</p>
                    )}
                    <span style={{ color: tc, fontSize: 13, fontWeight: 600 }}>Read article →</span>
                  </div>
                </div>
              </button>
            </Reveal>
          );
        })}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, paddingTop: 8 }}>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                style={{
                  width: 36, height: 36, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  background: page === p ? T.blue : T.bgC,
                  border: `1px solid ${page === p ? T.blue : T.bdr}`,
                  color: page === p ? '#fff' : T.t2,
                  fontFamily: 'inherit',
                }}
              >
                {p}
              </button>
            ))}
          </div>
        )}

        {/* Coming soon footer */}
        {posts.length > 0 && totalPages <= 1 && (
          <Reveal delay={160}>
            <div style={{ background: T.bgC, border: `1px dashed ${T.bdr}`, borderRadius: 20, padding: 'clamp(20px,4vw,32px)', textAlign: 'center' }}>
              <p style={{ color: T.t3, fontSize: 14, margin: '0 0 6px' }}>More articles coming soon</p>
              <p style={{ color: T.t3, fontSize: 12, margin: 0 }}>Hindi vs English scripts · Comparing Vapi vs Twilio · Reducing AI hallucinations in customer calls</p>
            </div>
          </Reveal>
        )}
      </section>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
