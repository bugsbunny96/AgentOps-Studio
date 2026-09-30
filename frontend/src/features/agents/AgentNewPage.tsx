/**
 * AgentNewPage — polished coming-soon state for multi-agent creation.
 * Current plan supports one agent per org; multi-agent is a future roadmap item.
 */

import { Link } from 'react-router-dom';
import { ArrowLeft, Bot, Layers, GitBranch, BarChart2 } from 'lucide-react';

const ROADMAP_ITEMS = [
  {
    icon: Layers,
    label: 'Multiple agents per workspace',
    desc: 'Run separate agents for sales, support, and scheduling — each with its own voice and knowledge base.',
  },
  {
    icon: GitBranch,
    label: 'Agent branching & routing',
    desc: 'Route calls to the right agent automatically based on caller intent or language.',
  },
  {
    icon: BarChart2,
    label: 'Per-agent analytics',
    desc: 'Compare call volume, resolution rate, and satisfaction scores across all your agents.',
  },
];

export default function AgentNewPage() {
  return (
    <div className="space-y-6">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Link
          to="/agents"
          className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-100 transition-colors"
        >
          <ArrowLeft size={14} />
          Agents
        </Link>
        <span className="text-slate-200">/</span>
        <span className="text-sm font-medium text-slate-200">New Agent</span>
      </div>

      {/* Hero card */}
      <div
        className="relative overflow-hidden rounded-2xl border border-white/10 bg-surface"
        style={{ minHeight: 360 }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{ background: 'radial-gradient(ellipse 70% 60% at 50% 0%, rgba(33,241,168,.08) 0%, transparent 100%)' }}
        />

        <div className="relative flex flex-col items-center justify-center px-8 py-20 text-center">
          <div
            className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{
              background: 'linear-gradient(135deg, rgba(33,241,168,.12), rgba(15,201,138,.12))',
              border: '1px solid rgba(33,241,168,.2)',
            }}
          >
            <Bot size={28} className="text-brand-300" strokeWidth={1.8} />
          </div>

          <h2 className="mb-2 text-lg font-semibold text-slate-100">Multiple agents coming soon</h2>
          <p className="mb-6 max-w-sm text-sm text-slate-400 leading-relaxed">
            Your current plan includes one AI agent per workspace. Multi-agent support —
            with per-department routing and separate knowledge bases — is on our roadmap.
          </p>

          <div className="flex items-center gap-3">
            <Link
              to="/agents"
              className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold
                text-white transition-opacity hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #0FC98A, #0AA271)' }}
            >
              <Bot size={14} />
              View your agent
            </Link>
            <Link
              to="/settings"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-surface
                px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-white/[0.03] transition-colors"
            >
              View settings
            </Link>
          </div>
        </div>
      </div>

      {/* Roadmap */}
      <div>
        <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
          On the roadmap
        </p>
        <div className="space-y-3">
          {ROADMAP_ITEMS.map(({ icon: Icon, label, desc }) => (
            <div
              key={label}
              className="flex items-start gap-4 rounded-xl border border-white/10 bg-surface p-5"
            >
              <div
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
                style={{
                  background: 'linear-gradient(135deg, rgba(33,241,168,.1), rgba(15,201,138,.1))',
                  border: '1px solid rgba(33,241,168,.15)',
                }}
              >
                <Icon size={16} className="text-brand-300" strokeWidth={1.8} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-100">{label}</p>
                <p className="mt-0.5 text-xs text-slate-400 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
