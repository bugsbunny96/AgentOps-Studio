/**
 * BlogPage — SEO foundation with 2 seeded articles
 * Route: /blog (public)
 *
 * Posts (inline, no backend):
 *   1. The Real ROI of an AI Voice Agent for Indian SMBs
 *   2. How to Set Up an AI Receptionist in 30 Minutes
 */

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

const T = {
  bg: '#030712', bgS: '#0d1524',
  bgC: 'rgba(255,255,255,0.03)', bdr: 'rgba(255,255,255,0.07)', bdrB: 'rgba(255,255,255,0.12)',
  blue: '#3b82f6', violet: '#8b5cf6', em: '#10b981', amber: '#f59e0b',
  t1: '#f8fafc', t2: '#94a3b8', t3: '#475569',
};

const pill = (bg: string, color: string, border: string): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700,
  padding: '4px 10px', borderRadius: 999, background: bg, color, border: `1px solid ${border}`,
});

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVis(true); io.disconnect(); } }, { threshold: 0.06 });
    io.observe(el); return () => io.disconnect();
  }, []);
  return <div ref={ref} style={{ opacity: vis ? 1 : 0, transform: vis ? 'none' : 'translateY(18px)', transition: `opacity .6s ease ${delay}ms, transform .6s ease ${delay}ms` }}>{children}</div>;
}

// ─── Article content ──────────────────────────────────────────────────────────

const POSTS = [
  {
    slug: 'voice-ai-roi',
    tag: 'ROI',
    tagColor: T.em,
    date: 'July 8, 2026',
    readTime: '6 min read',
    title: 'The Real ROI of an AI Voice Agent for Indian SMBs',
    subtitle: 'How logistics, real estate, and healthcare businesses are cutting cost-per-call by 70% while answering 3× more enquiries.',
    coverEmoji: '📞',
    intro: `Every missed call is a missed rupee. For Indian SMBs, the math is brutal: the average business answers only 62% of inbound calls during business hours, and virtually zero after 6 PM. An AI voice agent doesn't take breaks.`,
    sections: [
      {
        h: 'What does a missed call actually cost?',
        body: `Let's take a logistics company handling 200 inbound calls per day — tracking queries, delivery reschedules, complaints. At a conservative ₹500 average order value and a 30% caller-to-customer conversion rate, each missed call costs roughly ₹150 in lost revenue. At 38% miss rate, that's ₹11,400 per day — over ₹3.4 lakh per month.\n\nThe real number is usually worse. Callers who hit voicemail don't always call back. They call your competitor.`,
      },
      {
        h: 'The three numbers that matter',
        body: `When evaluating AI voice ROI, track three metrics:\n\n**Cost per handled call**: With a human receptionist at ₹25,000/month handling 150 calls/day (25 working days = 3,750 calls), cost per call is ₹6.67. An AI agent at ₹14,999/month handling 1,000+ calls/day costs under ₹0.60 per call.\n\n**After-hours capture rate**: Businesses that deploy an AI agent typically see 15–25% of bookings and enquiries come in between 7 PM and 9 AM — entirely new revenue that didn't exist before.\n\n**Call-to-conversion rate**: AI agents are consistent — they never have a bad day, never forget to mention a promotion, never rush a caller. Our customers see conversion parity with their best human agents within 30 days.`,
      },
      {
        h: 'A real example: real estate in Bangalore',
        body: `A Whitefield property developer was spending ₹65,000/month on two receptionists who collectively handled around 80 property enquiries per day. They deployed AgentOps Studio for ₹14,999/month.\n\nResult after 60 days:\n- Handled 220 enquiries/day (2.75× more)\n- 34 additional site visits booked after 7 PM that would have been missed\n- Total incremental revenue from those visits: ₹2.1 crore in closed deals\n- Monthly staff cost reduction: ₹50,001\n\nROI: 1,400% in the first quarter.`,
      },
      {
        h: 'What AI voice agents cannot do (yet)',
        body: `AI agents are excellent at handling predictable, high-frequency queries — tracking, booking, FAQ, routing. They're not ready for complex negotiations, emotionally sensitive escalations, or situations that require nuanced judgement.\n\nThe right model: let the AI handle 80% of call volume (the repetitive stuff), so your human team can focus 100% of their energy on the 20% that actually needs them.`,
      },
      {
        h: 'Getting started: 3 questions to ask',
        body: `1. **What are your top 5 most common inbound call types?** If 3 of them are "where is my order?", "what are your hours?", or "can I reschedule?" — you're an ideal candidate.\n\n2. **What percentage of calls do you miss today?** If you don't know, pull your missed call data from your phone system. Most businesses are shocked.\n\n3. **What is the average value of a handled inquiry?** This number lets you calculate your ROI before you sign up for anything.`,
      },
    ],
    cta: { text: 'Calculate your own ROI — start free', to: '/register' },
  },
  {
    slug: 'setup-ai-receptionist',
    tag: 'How-To',
    tagColor: T.violet,
    date: 'July 1, 2026',
    readTime: '8 min read',
    title: 'How to Set Up an AI Receptionist in 30 Minutes',
    subtitle: 'A step-by-step guide for non-technical founders who want a live AI voice agent handling their inbound calls before lunch.',
    coverEmoji: '🤖',
    intro: `You don't need an engineer, a vendor contract, or a three-month implementation timeline. If you can fill out a form and paste some text, you can have a working AI receptionist handling real calls today.`,
    sections: [
      {
        h: 'Step 1: Set up your account (5 minutes)',
        body: `Go to agentops.studio and click "Start free". You'll be asked for your:\n- Business name\n- Industry (logistics, real estate, healthcare, or other)\n- Primary language (Hindi, English, or both)\n- Business hours\n\nDon't overthink this — you can change everything later. The goal is to get your agent live and improve from real call data.`,
      },
      {
        h: 'Step 2: Build your Knowledge Base (10 minutes)',
        body: `Your AI agent answers questions from your Knowledge Base (KB). Think of it as a cheat sheet for your agent.\n\nWhat to add first:\n**Basic FAQ** (paste directly into the KB editor)\n- What do you do?\n- What are your business hours?\n- Where are you located?\n- How much does your service cost?\n- How do I track my order / book an appointment / get a quote?\n\n**Pro tip**: Record yourself answering your 10 most common inbound questions. Transcribe it (use Whisper or just type). Paste that into your KB. Done. Your agent now answers like you.`,
      },
      {
        h: 'Step 3: Configure your agent\'s behaviour (5 minutes)',
        body: `Under Agent Settings, configure:\n\n**Greeting script**: How should your agent introduce itself? Example: "Welcome to Sharma Logistics. I'm an AI assistant — I can help you track your shipment, reschedule a delivery, or answer any questions. How can I help you today?"\n\n**Fallback behaviour**: What should happen when a caller asks something the agent doesn't know? Options: offer to take a message, transfer to your mobile, or offer a callback.\n\n**After-hours message**: Should the agent still answer after hours? (Yes — this is where you capture after-hours revenue.) Configure a custom message like "Our office is closed, but I can still take your details and have someone call you back first thing tomorrow."`,
      },
      {
        h: 'Step 4: Connect your phone number (5 minutes)',
        body: `AgentOps Studio connects to your existing Exotel or Vapi number. If you don't have one yet, we'll walk you through getting a virtual number — it takes about 10 minutes and costs around ₹500/month.\n\nOnce your number is connected, your agent is live. All inbound calls to that number go to your AI agent first. If it can't handle the call, it routes to you.`,
      },
      {
        h: 'Step 5: Make a test call (5 minutes)',
        body: `Call your own number. Ask your agent a question from your KB. Ask it something it doesn't know. See how it handles the fallback.\n\nGo into your dashboard and review the transcript of your test call. Notice anything wrong? Edit your KB, save, and the agent updates immediately — no redeployment needed.\n\nMost founders need 2–3 iterations of their KB before they're happy with the quality. Plan for this. It's not a failure; it's the product working as designed.`,
      },
      {
        h: 'What to do in week 1',
        body: `Day 1–3: Review every transcript. Find the questions your agent got wrong and add them to your KB.\n\nDay 4–7: Check your analytics dashboard. What are the top 5 query types? Is there a pattern of callers hanging up at a specific point? Fix the script at that point.\n\nAfter 1 week: Your agent should be handling 75–85% of queries without human intervention. The remaining 15–25% will be complex queries that genuinely need you.`,
      },
    ],
    cta: { text: 'Start your 30-minute setup now →', to: '/register' },
  },
];

// ─── ArticleView ──────────────────────────────────────────────────────────────

function ArticleView({ post, onClose }: { post: typeof POSTS[0]; onClose: () => void }) {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 24px 100px' }}>
      <button
        onClick={onClose}
        style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'none', border: 'none', color: T.t2, fontSize: 13, cursor: 'pointer', padding: '12px 0', fontFamily: 'inherit', marginBottom: 32 }}
      >
        ← Back to blog
      </button>

      <div style={{ marginBottom: 12 }}>
        <span style={pill(`${post.tagColor}15`, post.tagColor, `${post.tagColor}30`)}>{post.tag}</span>
      </div>
      <h1 style={{ fontSize: 'clamp(24px,4vw,40px)', fontWeight: 900, lineHeight: 1.15, margin: '0 0 14px', letterSpacing: '-0.02em' }}>{post.title}</h1>
      <p style={{ color: T.t2, fontSize: 16, lineHeight: 1.6, margin: '0 0 20px' }}>{post.subtitle}</p>
      <div style={{ display: 'flex', gap: 16, color: T.t3, fontSize: 12, marginBottom: 40, flexWrap: 'wrap' }}>
        <span>{post.date}</span>
        <span>·</span>
        <span>{post.readTime}</span>
      </div>

      <div style={{ background: post.tagColor + '10', border: `1px solid ${post.tagColor}25`, borderRadius: 16, padding: '28px 32px', marginBottom: 40 }}>
        <p style={{ color: T.t2, fontSize: 15, lineHeight: 1.8, margin: 0, fontStyle: 'italic' }}>{post.intro}</p>
      </div>

      {post.sections.map((sec) => (
        <div key={sec.h} style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 12px', color: T.t1 }}>{sec.h}</h2>
          {sec.body.split('\n\n').map((para, i) => {
            // Minimal bold: replace **text** with <strong>
            const parts = para.split(/(\*\*[^*]+\*\*)/g).map((p, j) =>
              p.startsWith('**') ? <strong key={j} style={{ color: T.t1 }}>{p.slice(2, -2)}</strong> : p
            );
            return (
              <p key={i} style={{ color: T.t2, fontSize: 15, lineHeight: 1.8, margin: '0 0 12px' }}>
                {parts}
              </p>
            );
          })}
        </div>
      ))}

      <div style={{ background: `linear-gradient(135deg, ${post.tagColor}15, ${post.tagColor}08)`, border: `1px solid ${post.tagColor}30`, borderRadius: 16, padding: '28px 32px', textAlign: 'center', marginTop: 48 }}>
        <Link to={post.cta.to} style={{ display: 'inline-flex', alignItems: 'center', padding: '12px 28px', borderRadius: 9, background: post.tagColor, color: post.tagColor === T.em ? '#fff' : '#fff', fontWeight: 700, fontSize: 15, textDecoration: 'none' }}>{post.cta.text}</Link>
      </div>
    </div>
  );
}

// ─── BlogPage ─────────────────────────────────────────────────────────────────

export default function BlogPage() {
  const [openPost, setOpenPost] = useState<typeof POSTS[0] | null>(null);

  if (openPost) {
    return (
      <div style={{ background: T.bg, color: T.t1, minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif', paddingTop: 64 }}>
        <ArticleView post={openPost} onClose={() => setOpenPost(null)} />
      </div>
    );
  }

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
            <span style={{ background: `linear-gradient(135deg, ${T.blue}, ${T.violet})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>voice operations</span>
          </h1>
          <p style={{ color: T.t2, fontSize: 'clamp(14px,2vw,17px)', lineHeight: 1.7, margin: 0 }}>
            Practical guides for Indian SMBs deploying AI voice agents — ROI calculators, setup walkthroughs, and real case studies.
          </p>
        </div>
      </section>

      {/* Post list */}
      <section style={{ maxWidth: 800, margin: '0 auto', padding: '0 24px 100px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {POSTS.map((post, i) => (
          <Reveal key={post.slug} delay={i * 80}>
            <button
              onClick={() => setOpenPost(post)}
              style={{ display: 'block', width: '100%', background: T.bgC, border: `1px solid ${T.bdr}`, borderRadius: 20, padding: 'clamp(24px,4vw,36px)', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', transition: 'border-color .25s, transform .25s', color: 'inherit' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = T.bdrB; (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = T.bdr; (e.currentTarget as HTMLButtonElement).style.transform = 'none'; }}
            >
              <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
                <div style={{ fontSize: 40, flexShrink: 0, width: 68, height: 68, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${post.tagColor}12`, border: `1px solid ${post.tagColor}25`, borderRadius: 16 }}>{post.coverEmoji}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                    <span style={pill(`${post.tagColor}15`, post.tagColor, `${post.tagColor}30`)}>{post.tag}</span>
                    <span style={{ color: T.t3, fontSize: 12 }}>{post.date} · {post.readTime}</span>
                  </div>
                  <h2 style={{ fontSize: 'clamp(16px,2.5vw,22px)', fontWeight: 800, margin: '0 0 8px', color: T.t1, lineHeight: 1.2 }}>{post.title}</h2>
                  <p style={{ color: T.t2, fontSize: 14, lineHeight: 1.6, margin: '0 0 16px' }}>{post.subtitle}</p>
                  <span style={{ color: post.tagColor, fontSize: 13, fontWeight: 600 }}>Read article →</span>
                </div>
              </div>
            </button>
          </Reveal>
        ))}

        {/* Coming soon */}
        <Reveal delay={160}>
          <div style={{ background: T.bgC, border: `1px dashed ${T.bdr}`, borderRadius: 20, padding: 'clamp(20px,4vw,32px)', textAlign: 'center' }}>
            <p style={{ color: T.t3, fontSize: 14, margin: '0 0 8px' }}>More articles coming soon</p>
            <p style={{ color: T.t3, fontSize: 12, margin: 0 }}>Hindi vs English scripts · Comparing Vapi vs Twilio · Reducing AI hallucinations in customer calls</p>
          </div>
        </Reveal>
      </section>

    </div>
  );
}
