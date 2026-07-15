/**
 * KnowledgeBasePage — polished empty state with context on what's coming.
 * Surfaces real org data (crawl status) from Redux.
 */

import { BookOpen, Globe, Upload, Search } from 'lucide-react';
import { useAppSelector } from '@/store';

const FEATURES = [
  { icon: Globe,    label: 'Website crawl',   desc: 'Automatically import pages from your website so your agent knows your products, services, and policies.' },
  { icon: Upload,   label: 'Document upload', desc: 'Upload PDFs, Word docs, and text files — your agent will reference them when answering calls.' },
  { icon: Search,   label: 'Instant search',  desc: 'Every piece of knowledge is full-text searchable so you can audit what your agent knows.' },
  { icon: BookOpen, label: 'Live sync',        desc: 'Keep knowledge fresh with scheduled re-crawls and document versioning.' },
];

export default function KnowledgeBasePage() {
  const { currentOrg } = useAppSelector((s) => s.org);

  return (
    <div className="space-y-8">

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Knowledge Base</h1>
        <p className="mt-1 text-sm text-slate-500">
          Documents and sources your agent draws on when answering calls.
        </p>
      </div>

      {/* Hero empty state */}
      <div
        className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white"
        style={{ minHeight: 320 }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{ background: 'radial-gradient(ellipse 70% 60% at 50% 0%, rgba(99,102,241,.08) 0%, transparent 100%)' }}
        />

        <div className="relative flex flex-col items-center justify-center px-8 py-20 text-center">
          <div
            className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{
              background: 'linear-gradient(135deg, rgba(99,102,241,.12), rgba(139,92,246,.12))',
              border: '1px solid rgba(99,102,241,.2)',
            }}
          >
            <BookOpen size={28} className="text-brand-600" strokeWidth={1.8} />
          </div>

          <h2 className="mb-2 text-lg font-semibold text-slate-800">Knowledge Base manager coming soon</h2>
          <p className="max-w-sm text-sm text-slate-500 leading-relaxed">
            {currentOrg?.crawlEnabled && currentOrg?.websiteUrl
              ? `We've already crawled ${currentOrg.websiteUrl} during setup. This manager will let you view, edit, and expand that knowledge.`
              : 'Add documents and website pages so your agent can answer questions with accurate, up-to-date information.'}
          </p>

          {currentOrg?.websiteUrl && (
            <div className="mt-4 flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5">
              <Globe size={12} className="text-emerald-600" />
              <span className="text-xs font-medium text-emerald-700">
                {currentOrg.websiteUrl} crawled during setup
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Upcoming features */}
      <div>
        <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Coming soon</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {FEATURES.map(({ icon: Icon, label, desc }) => (
            <div
              key={label}
              className="flex items-start gap-4 rounded-xl border border-slate-100 bg-white p-5"
            >
              <div
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
                style={{
                  background: 'linear-gradient(135deg, rgba(99,102,241,.1), rgba(139,92,246,.1))',
                  border: '1px solid rgba(99,102,241,.15)',
                }}
              >
                <Icon size={16} className="text-brand-600" strokeWidth={1.8} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">{label}</p>
                <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
