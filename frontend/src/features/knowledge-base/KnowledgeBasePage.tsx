/**
 * KnowledgeBasePage — Enhanced
 *
 * Features:
 *   1. Search bar — client-side filter by title
 *   2. Eye icon → DocDetailModal — popup with full document preview (replaces accordion)
 *   3. Upload file modal — drag & drop or click-to-browse for .txt / .md / .csv files
 *   4. Edit modal — inline edit for manual_text docs (PATCH /knowledge-base/:id)
 *   5. Quality warning flags — too short / stale / large badges
 *   6. Crawl page picker — collapsible section with checkboxes to exclude website pages
 *   7. Consolidated Actions column — Eye / Download / Edit / Delete all in one header
 *   8. "+ Add document" dropdown — Upload file | Enter text manually
 */

import { useState, useMemo, useRef, useEffect, useCallback, DragEvent, ChangeEvent } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen, Globe, Plus, RefreshCw, Trash2, Loader2,
  FileText, HelpCircle, CheckCircle2, AlertCircle, Clock,
  ChevronDown, ChevronRight, ChevronUp, Pencil, Search, AlertTriangle,
  Download, X as XIcon, Eye, Upload, Settings2, Sparkles,
} from 'lucide-react';
import { api } from '@/utils/api';
import { useCanWrite } from '@/hooks/usePermission';
import { useAuth } from '@/hooks/useAuth';

// ─── Billing status (for plan limit display) ──────────────────────────────────
interface BillingStatus {
  plan:          string;
  effectivePlan: string;
  isInTrial:     boolean;
  kbDocs: { used: number; limit: number | null };
}

// ─── Types ─────────────────────────────────────────────────────────────────────

interface KbDoc {
  id: string;
  title: string;
  sourceType: 'website_page' | 'website_crawl' | 'manual_text' | 'faq_import';
  status: 'pending' | 'ready' | 'failed';
  tokenEstimate: number;
  errorMessage?: string;
  sourceUrl?: string;
  /** Category slug assigned by the crawler (e.g. 'faqs', 'services', 'pricing') */
  category?: string;
  createdAt: string;
  updatedAt: string;
}

interface KbDocFull extends KbDoc {
  content: string;
}

interface KbListResponse {
  docs: KbDoc[];
  total: number;
  readyCount: number;
}

interface KbStatusResponse {
  total: number;
  readyCount: number;
  pendingCount: number;
  crawlStatus: string;
  crawlEnabled: boolean;
  websiteUrl: string | null;
  lastCrawledAt: string | null;
}

// ─── Quality flag logic ───────────────────────────────────────────────────────

type QualityFlag = 'too_short' | 'stale' | 'large';

function getQualityFlags(doc: KbDoc): QualityFlag[] {
  const flags: QualityFlag[] = [];
  if (doc.status !== 'ready') return flags;
  if (doc.tokenEstimate < 10) flags.push('too_short');
  if (doc.tokenEstimate > 600) flags.push('large');
  if (doc.sourceType === 'website_page') {
    const ageDays = (Date.now() - new Date(doc.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays > 30) flags.push('stale');
  }
  return flags;
}

const FLAG_META: Record<QualityFlag, { label: string; tip: string; cls: string }> = {
  too_short: { label: 'Too short', tip: 'Less than 40 chars — may not be useful to the agent', cls: 'bg-red-50 text-red-600 border-red-100' },
  large: { label: 'Large', tip: 'Content will be truncated in the system prompt', cls: 'bg-amber-50 text-amber-600 border-amber-100' },
  stale: { label: 'Stale', tip: 'Website page not refreshed in >30 days', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
};

// ─── API helpers ───────────────────────────────────────────────────────────────

async function fetchDocs(): Promise<KbListResponse> {
  const r = await api.get<{ success: boolean; data: KbListResponse }>('/knowledge-base');
  return r.data.data;
}

async function fetchStatus(): Promise<KbStatusResponse> {
  const r = await api.get<{ success: boolean; data: KbStatusResponse }>('/knowledge-base/status');
  return r.data.data;
}

async function fetchDoc(id: string): Promise<KbDocFull> {
  const r = await api.get<{ success: boolean; data: KbDocFull }>(`/knowledge-base/${id}`);
  return r.data.data;
}

async function createDoc(payload: { title: string; content: string }) {
  const r = await api.post<{ success: boolean; data: KbDoc }>('/knowledge-base', { ...payload, sourceType: 'manual_text' });
  return r.data.data;
}

async function patchDoc(id: string, payload: { title?: string; content?: string }) {
  const r = await api.patch<{ success: boolean; data: KbDoc }>(`/knowledge-base/${id}`, payload);
  return r.data.data;
}

async function deleteDoc(id: string) {
  await api.delete(`/knowledge-base/${id}`);
}

async function triggerResync() {
  const r = await api.post<{ success: boolean; data: { jobId: string }; message: string }>('/knowledge-base/re-sync');
  return r.data;
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-slate-100 ${className}`} />;
}

function SourceBadge({ type }: { type: KbDoc['sourceType'] }) {
  const map = {
    website_page: { label: 'Web page', icon: Globe, cls: 'bg-blue-50 text-blue-700 border-blue-100' },
    website_crawl: { label: 'Website KB', icon: Globe, cls: 'bg-sky-50 text-sky-700 border-sky-100' },
    manual_text: { label: 'Manual', icon: FileText, cls: 'bg-violet-50 text-violet-700 border-violet-100' },
    faq_import: { label: 'FAQ', icon: HelpCircle, cls: 'bg-amber-50 text-amber-700 border-amber-100' },
  };
  const { label, icon: Icon, cls } = map[type];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      <Icon size={10} />
      {label}
    </span>
  );
}

function StatusDot({ status }: { status: KbDoc['status'] }) {
  if (status === 'ready') return <CheckCircle2 size={14} className="text-emerald-500" />;
  if (status === 'failed') return <AlertCircle size={14} className="text-red-500" />;
  return <Clock size={14} className="text-amber-400" />;
}

/** Small pill showing the category slug with pretty-printed label. */
function CategoryBadge({ slug }: { slug: string }) {
  const label = slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  return (
    <span className="inline-flex items-center rounded border border-slate-100 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
      {label}
    </span>
  );
}

// ─── Download helper ──────────────────────────────────────────────────────────

async function downloadDoc(doc: KbDoc): Promise<void> {
  const full = await fetchDoc(doc.id);
  const fileName = doc.sourceType === 'website_crawl'
    ? 'CrawledWebsite.md'
    : `${doc.title.replace(/[^a-z0-9_\-. ]/gi, '_').trim() || 'document'}.md`;
  const blob = new Blob([full.content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: fileName });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Add / Edit Document Modal ─────────────────────────────────────────────────

interface DocModalProps {
  mode: 'add' | 'edit';
  initial?: { id: string; title: string; content: string };
  onClose: () => void;
}

function DocModal({ mode, initial, onClose }: DocModalProps) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [content, setContent] = useState(initial?.content ?? '');
  const [error, setError] = useState('');
  const qc = useQueryClient();

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['kb', 'docs'] });
    void qc.invalidateQueries({ queryKey: ['kb', 'status'] });
    onClose();
  };

  const addMutation = useMutation({
    mutationFn: createDoc,
    onSuccess: invalidate,
    onError: (e: Error) => setError(e.message || 'Failed to save'),
  });

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { title?: string; content?: string } }) => patchDoc(id, data),
    onSuccess: invalidate,
    onError: (e: Error) => setError(e.message || 'Failed to update'),
  });

  const isPending = addMutation.isPending || editMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!title.trim()) { setError('Title is required'); return; }
    if (!content.trim()) { setError('Content is required'); return; }
    if (mode === 'add') {
      addMutation.mutate({ title: title.trim(), content: content.trim() });
    } else {
      editMutation.mutate({ id: initial!.id, data: { title: title.trim(), content: content.trim() } });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-800">
            {mode === 'add' ? 'Add knowledge document' : 'Edit document'}
          </h2>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition" aria-label="Close">
            <XIcon size={14} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Cancellation Policy"
              maxLength={300}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Content <span className="ml-1 text-slate-400 font-normal">({content.length.toLocaleString()}/50,000)</span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste the text your agent should know…"
              rows={9}
              maxLength={50_000}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition resize-y font-mono"
            />
          </div>

          {error && (
            <p className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
              <AlertCircle size={13} /> {error}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition">
              Cancel
            </button>
            <button type="submit" disabled={isPending} className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-60 transition">
              {isPending && <Loader2 size={14} className="animate-spin" />}
              {mode === 'add' ? 'Save document' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Document Detail Modal (Eye icon popup) ───────────────────────────────────

function DocDetailModal({ doc, onClose, onEdit }: { doc: KbDoc; onClose: () => void; onEdit?: () => void }) {
  const { data: full, isLoading } = useQuery({
    queryKey: ['kb', 'doc', doc.id],
    queryFn: () => fetchDoc(doc.id),
    staleTime: 60_000,
  });

  const fmt = (d: string) =>
    new Date(d).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="flex w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl"
        style={{ maxHeight: '90vh' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4 flex-shrink-0">
          <div className="min-w-0 pr-4">
            <h2 className="text-base font-semibold text-slate-800 truncate">{doc.title}</h2>
            <div className="mt-1.5 flex items-center gap-2 flex-wrap">
              <SourceBadge type={doc.sourceType} />
              <StatusDot status={doc.status} />
              <span className="text-xs text-slate-400">~{doc.tokenEstimate.toLocaleString()} tokens</span>
              {doc.sourceUrl && (
                <a
                  href={doc.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate text-xs text-blue-500 hover:underline max-w-xs"
                >
                  {doc.sourceUrl}
                </a>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
            aria-label="Close"
          >
            <XIcon size={14} />
          </button>
        </div>

        {/* Meta row */}
        <div className="flex gap-6 border-b border-slate-50 bg-slate-50/60 px-6 py-3 text-xs text-slate-500 flex-shrink-0">
          <span>Created: <span className="font-medium text-slate-700">{fmt(doc.createdAt)}</span></span>
          <span>Updated: <span className="font-medium text-slate-700">{fmt(doc.updatedAt)}</span></span>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {isLoading ? (
            <div className="space-y-2.5">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className={`h-3 ${i % 3 === 2 ? 'w-3/4' : 'w-full'}`} />
              ))}
            </div>
          ) : full ? (
            <pre className="whitespace-pre-wrap font-mono text-xs text-slate-700 leading-relaxed">
              {full.content}
            </pre>
          ) : (
            <p className="text-xs text-slate-400">Could not load content.</p>
          )}
        </div>

        {/* Footer */}
        {full && (
          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/60 px-6 py-3 flex-shrink-0">
            <span className="text-[11px] text-slate-400">
              {full.content.length.toLocaleString()} chars · ~{full.tokenEstimate.toLocaleString()} tokens
            </span>
            <div className="flex items-center gap-2">
              {doc.sourceType === 'manual_text' && onEdit && (
                <button
                  onClick={() => { onClose(); onEdit(); }}
                  className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 transition"
                >
                  <Pencil size={12} /> Edit
                </button>
              )}
              <button
                onClick={onClose}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 transition"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── File Upload Modal ────────────────────────────────────────────────────────

const ACCEPTED_EXTS = '.txt,.md,.csv,.json';
const MAX_FILE_BYTES = 200_000; // 200 KB

function FileUploadModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [fileError, setFileError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFile = useCallback((file: File) => {
    setFileError('');
    if (file.size > MAX_FILE_BYTES) {
      setFileError(`File is too large (max ${Math.round(MAX_FILE_BYTES / 1024)} KB). Paste the content manually instead.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string ?? '';
      setContent(text);
      // Auto-fill title: strip extension, replace dashes/underscores with spaces
      const nameWithoutExt = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ').trim();
      setTitle(nameWithoutExt || file.name);
      setFileName(file.name);
    };
    reader.onerror = () => setFileError('Could not read file. Please try again.');
    reader.readAsText(file, 'UTF-8');
  }, []);

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file);
  };

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadFile(file);
    e.target.value = '';
  };

  const handleSave = async () => {
    setSaveError('');
    if (!title.trim()) { setSaveError('Title is required'); return; }
    if (!content.trim()) { setSaveError('Content is required'); return; }
    setSaving(true);
    try {
      await createDoc({ title: title.trim(), content: content.trim() });
      void qc.invalidateQueries({ queryKey: ['kb', 'docs'] });
      void qc.invalidateQueries({ queryKey: ['kb', 'status'] });
      onClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save document');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-800">Upload document</h2>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition" aria-label="Close">
            <XIcon size={14} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer rounded-xl border-2 border-dashed px-6 py-8 text-center transition ${isDragging
                ? 'border-violet-400 bg-violet-50'
                : content
                  ? 'border-emerald-300 bg-emerald-50'
                  : 'border-slate-200 bg-slate-50 hover:border-violet-300 hover:bg-violet-50/40'
              }`}
          >
            {content ? (
              <div className="space-y-1">
                <CheckCircle2 size={24} className="mx-auto text-emerald-500" />
                <p className="text-sm font-medium text-slate-700">{fileName}</p>
                <p className="text-xs text-slate-500">
                  {content.length.toLocaleString()} chars · ~{Math.ceil(content.length / 4).toLocaleString()} tokens
                </p>
                <p className="text-xs text-violet-500 mt-1">Click to replace</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Upload size={24} className="mx-auto text-slate-300" />
                <p className="text-sm font-medium text-slate-600">
                  {isDragging ? 'Drop file here' : 'Drag & drop or click to browse'}
                </p>
                <p className="text-xs text-slate-400">
                  Supported: .txt · .md · .csv · .json · max 200 KB
                </p>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_EXTS}
            onChange={handleFileInput}
            className="hidden"
          />

          {fileError && (
            <p className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
              <AlertCircle size={13} /> {fileError}
            </p>
          )}

          {/* Title (shown after file load) */}
          {content && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Document title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Pricing FAQ"
                maxLength={300}
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition"
              />
            </div>
          )}

          {/* Content preview (shown after file load) */}
          {content && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Preview</label>
              <pre className="max-h-36 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50 p-3 font-mono text-[11px] text-slate-600 leading-relaxed whitespace-pre-wrap">
                {content.slice(0, 800)}{content.length > 800 ? '\n…' : ''}
              </pre>
            </div>
          )}

          {saveError && (
            <p className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
              <AlertCircle size={13} /> {saveError}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition">
              Cancel
            </button>
            <button
              onClick={() => void handleSave()}
              disabled={!content || saving}
              className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-60 transition"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              Save to Knowledge Base
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Delete Confirmation Modal ────────────────────────────────────────────────

function DeleteConfirmModal({
  docTitle,
  isDeleting,
  onConfirm,
  onCancel,
}: {
  docTitle: string;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl">
        <div className="px-6 pt-6 pb-5 text-center">
          {/* Warning icon */}
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
            <AlertTriangle size={22} className="text-red-500" />
          </div>

          <h2 className="text-base font-semibold text-slate-800">Delete document?</h2>
          <p className="mt-2 text-sm text-slate-500 leading-relaxed">
            <span className="font-medium text-slate-700">"{docTitle}"</span> will be permanently
            removed from your Knowledge Base. This cannot be undone.
          </p>
        </div>

        <div className="flex gap-3 border-t border-slate-100 px-6 py-4">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 py-2.5 text-sm font-medium text-white hover:bg-red-700 transition disabled:opacity-60"
          >
            {isDeleting && <Loader2 size={13} className="animate-spin" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Doc Row ──────────────────────────────────────────────────────────────────

// 5 columns — EXPLICIT widths so every row's grid aligns identically.
// Each row is its own CSS grid; `auto` would size independently per row → misalignment.
// Type: 6rem · Status: 2rem · Tokens: 5rem · Actions: 6rem
const ROW_COLS = '1fr 6rem 2rem 5rem 6rem';

interface DocRowProps {
  doc: KbDoc;
  onEdit: (doc: KbDoc) => void;
  onDelete: (id: string) => void;
  onView: (doc: KbDoc) => void;
  isDeleting: boolean;
  canWrite: boolean;
}

function DocRow({ doc, onEdit: _onEdit, onDelete, onView, isDeleting, canWrite }: DocRowProps) {
  const [downloading, setDownloading] = useState(false);
  const [downloadErr, setDownloadErr] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const flags = getQualityFlags(doc);

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setDownloadErr(null);
    setDownloading(true);
    try {
      await downloadDoc(doc);
    } catch {
      setDownloadErr('Download failed');
      setTimeout(() => setDownloadErr(null), 4_000);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <div
        className="grid items-center gap-3 px-5 py-3.5 transition hover:bg-slate-50/60"
        style={{ gridTemplateColumns: ROW_COLS }}
      >
        {/* Title + category + quality flags */}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-800">{doc.title}</p>
          <div className="mt-0.5 flex items-center gap-1 flex-wrap">
            {/* Category badge — only on website_page and manual_text docs.
              website_crawl docs use the category name as the title itself. */}
            {doc.category && doc.category !== 'other' && doc.sourceType !== 'website_crawl' && (
              <CategoryBadge slug={doc.category} />
            )}
            {flags.map((f) => (
              <span
                key={f}
                title={FLAG_META[f].tip}
                className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium cursor-help ${FLAG_META[f].cls}`}
              >
                <AlertTriangle size={9} />
                {FLAG_META[f].label}
              </span>
            ))}
          </div>
          {doc.errorMessage && <p className="mt-0.5 truncate text-xs text-red-500">{doc.errorMessage}</p>}
          {downloadErr && <p className="mt-0.5 text-xs text-red-500">{downloadErr}</p>}
        </div>

        {/* Type badge */}
        <SourceBadge type={doc.sourceType} />

        {/* Status */}
        <StatusDot status={doc.status} />

        {/* Tokens — column width set by ROW_COLS (5rem), no extra w-* needed */}
        <span className="text-xs tabular-nums text-slate-400 text-right">
          {doc.tokenEstimate > 0 ? `~${doc.tokenEstimate.toLocaleString()}` : '—'}
        </span>

        {/* Actions column — Eye (blue) · Download (green) · [write-only: Delete (red)] */}
        <div className="flex items-center justify-end gap-1">
          {/* View — always visible */}
          <button
            onClick={(e) => { e.stopPropagation(); onView(doc); }}
            title="View document"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-blue-400 transition hover:bg-blue-50 hover:text-blue-600"
            aria-label="View document"
          >
            <Eye size={13} />
          </button>

          {/* Download — always visible */}
          <button
            onClick={(e) => void handleDownload(e)}
            disabled={downloading || doc.status !== 'ready'}
            title={doc.sourceType === 'website_crawl' ? 'Download CrawledWebsite.md' : 'Download as .md'}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-emerald-400 transition hover:bg-emerald-50 hover:text-emerald-600 disabled:opacity-40"
            aria-label="Download document"
          >
            {downloading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
          </button>

          {/* Delete — write-only */}
          {canWrite && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(true); }}
              disabled={isDeleting}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-red-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
              aria-label="Delete document"
            >
              {isDeleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            </button>
          )}
        </div>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <DeleteConfirmModal
          docTitle={doc.title}
          isDeleting={isDeleting}
          onConfirm={() => { setShowDeleteConfirm(false); onDelete(doc.id); }}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </>
  );
}

// ─── Crawl Page Picker ─────────────────────────────────────────────────────────

interface PagePickerProps {
  pages: KbDoc[];
  onRemove: (ids: string[]) => void;
  canWrite: boolean;
}

function CrawlPagePicker({ pages, onRemove, canWrite }: PagePickerProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [removing, setRemoving] = useState(false);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected(selected.size === pages.length ? new Set() : new Set(pages.map((p) => p.id)));

  const handleRemove = async () => {
    setRemoving(true);
    onRemove([...selected]);
    setSelected(new Set());
    setRemoving(false);
  };

  if (pages.length === 0) return null;

  return (
    <div className="rounded-2xl border border-slate-100 bg-white overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left transition hover:bg-slate-50"
      >
        <div className="flex items-center gap-3">
          <Globe size={16} className="text-blue-500" />
          <div>
            <p className="text-sm font-semibold text-slate-800">Crawled website pages</p>
            <p className="text-xs text-slate-500">
              {pages.length} page{pages.length !== 1 ? 's' : ''} imported — uncheck to exclude from agent context
            </p>
          </div>
        </div>
        {open ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
      </button>

      {open && (
        <div className="border-t border-slate-100">
          {canWrite && (
            <div className="flex items-center justify-between border-b border-slate-50 px-5 py-2.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-violet-600 focus:ring-violet-400"
                  checked={selected.size === pages.length && pages.length > 0}
                  onChange={toggleAll}
                />
                <span className="text-xs text-slate-500">Select all</span>
              </label>
              {selected.size > 0 && (
                <button
                  onClick={() => void handleRemove()}
                  disabled={removing}
                  className="flex items-center gap-1.5 rounded-lg bg-red-50 border border-red-100 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 transition disabled:opacity-50"
                >
                  {removing ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                  Remove {selected.size} page{selected.size !== 1 ? 's' : ''}
                </button>
              )}
            </div>
          )}

          <div className="divide-y divide-slate-50 max-h-64 overflow-y-auto">
            {pages.map((page) => (
              <label
                key={page.id}
                className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-slate-50 transition"
              >
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-violet-600 focus:ring-violet-400"
                  checked={selected.has(page.id)}
                  onChange={() => toggle(page.id)}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-slate-700">{page.title}</p>
                  {page.sourceUrl && (
                    <p className="truncate text-[10px] text-slate-400">{page.sourceUrl}</p>
                  )}
                </div>
                <span className="text-xs tabular-nums text-slate-400 flex-shrink-0">
                  ~{page.tokenEstimate.toLocaleString()} tok
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Business Info Section ────────────────────────────────────────────────────

/** Returns true when saved hours represent 24-hour operation. */
function is24HourSchedule(start?: string, end?: string): boolean {
  return start === '00:00' && end === '23:59';
}

const BusinessConfigSchema = z.object({
  agentName: z.string().max(50).optional().or(z.literal('')),
  businessDescription: z.string().optional(),
  services: z.array(z.object({ value: z.string().max(100) })).max(20),
  isOpen24Hours: z.boolean(),
  businessHoursStart: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal('')),
  businessHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal('')),
  contactEmail: z.string().email('Enter a valid email').optional().or(z.literal('')),
  contactPhone: z.string().optional(),
  locations: z.array(z.object({ value: z.string().max(200) })).max(10),
  faqs: z.array(z.object({
    question: z.string().max(200),
    answer: z.string().max(300),
  })).max(10),
});

type BusinessConfigValues = z.infer<typeof BusinessConfigSchema>;

function buildBusinessDto(values: BusinessConfigValues, serviceFields: { value: string }[], locationFields: { value: string }[], faqFields: { question: string; answer: string }[]) {
  return {
    step: 'configure' as const,
    agentName: values.agentName || undefined,
    businessDescription: values.businessDescription || undefined,
    services: serviceFields.map((f) => f.value).filter(Boolean),
    businessHours: values.isOpen24Hours
      ? { start: '00:00', end: '23:59' }
      : (values.businessHoursStart && values.businessHoursEnd
        ? { start: values.businessHoursStart, end: values.businessHoursEnd }
        : undefined),
    contactDetails:
      values.contactEmail || values.contactPhone
        ? { email: values.contactEmail || undefined, phone: values.contactPhone || undefined }
        : undefined,
    locations: locationFields.map((f) => f.value).filter(Boolean),
    faqs: faqFields
      .filter((f) => f.question.trim() && f.answer.trim())
      .map((f) => ({ question: f.question.trim(), answer: f.answer.trim() })),
  };
}

interface BusinessInfoSectionProps {
  lastCrawledAt: string | null;
  onSaved: () => void;
}

function BusinessInfoSection({ lastCrawledAt, onSaved }: BusinessInfoSectionProps) {
  const { currentOrg, fetchCurrentOrg } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [serverErr, setServerErr] = useState<string | null>(null);
  const [newService, setNewService] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [faqsOpen, setFaqsOpen] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors },
  } = useForm<BusinessConfigValues>({
    resolver: zodResolver(BusinessConfigSchema),
    defaultValues: {
      agentName: currentOrg?.agentName ?? '',
      businessDescription: currentOrg?.businessDescription ?? '',
      services: (currentOrg?.services ?? []).map((v) => ({ value: v })),
      isOpen24Hours: is24HourSchedule(currentOrg?.businessHours?.start, currentOrg?.businessHours?.end),
      businessHoursStart: currentOrg?.businessHours?.start ?? '09:00',
      businessHoursEnd: currentOrg?.businessHours?.end ?? '18:00',
      contactEmail: currentOrg?.contactDetails?.email ?? '',
      contactPhone: currentOrg?.contactDetails?.phone ?? '',
      locations: (currentOrg?.locations ?? []).map((v) => ({ value: v })),
      faqs: (currentOrg?.faqs ?? []).map((f) => ({ question: f.question, answer: f.answer })),
    },
  });

  // Fetch full org data on mount — auth/me only carries the lean shape
  // (id, name, slug, onboardingStatus). Business fields need /onboarding/org.
  useEffect(() => {
    void fetchCurrentOrg();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-populate form when org hydrates from the network (or after a save).
  // Guard: if the user already opened the Edit form, don't reset mid-edit —
  // wait until they close it so we don't wipe their in-progress changes.
  useEffect(() => {
    if (!currentOrg || editing) return;
    const saved24h = is24HourSchedule(currentOrg.businessHours?.start, currentOrg.businessHours?.end);
    const hasFaqs = (currentOrg.faqs ?? []).length > 0;
    reset({
      agentName: currentOrg.agentName ?? '',
      businessDescription: currentOrg.businessDescription ?? '',
      services: (currentOrg.services ?? []).map((v) => ({ value: v })),
      isOpen24Hours: saved24h,
      businessHoursStart: saved24h ? '09:00' : (currentOrg.businessHours?.start ?? '09:00'),
      businessHoursEnd: saved24h ? '18:00' : (currentOrg.businessHours?.end ?? '18:00'),
      contactEmail: currentOrg.contactDetails?.email ?? '',
      contactPhone: currentOrg.contactDetails?.phone ?? '',
      locations: (currentOrg.locations ?? []).map((v) => ({ value: v })),
      faqs: hasFaqs
        ? currentOrg.faqs.map((f) => ({ question: f.question, answer: f.answer }))
        : [],
    });
    if (hasFaqs) setFaqsOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrg?.id, currentOrg?.businessDescription, currentOrg?.services?.length]);

  const { fields: serviceFields, append: appendService, remove: removeService } = useFieldArray({ control, name: 'services' });
  const { fields: locationFields, append: appendLocation, remove: removeLocation } = useFieldArray({ control, name: 'locations' });
  const { fields: faqFields, append: appendFaq, remove: removeFaq } = useFieldArray({ control, name: 'faqs' });

  const isOpen24Hours = watch('isOpen24Hours');

  function addService() {
    const v = newService.trim();
    if (!v || v.length > 100 || serviceFields.length >= 20) return;
    appendService({ value: v });
    setNewService('');
  }

  function addLocation() {
    const v = newLocation.trim();
    if (!v || v.length > 200 || locationFields.length >= 10) return;
    appendLocation({ value: v });
    setNewLocation('');
  }

  async function onSubmit(values: BusinessConfigValues) {
    setSaving(true);
    setServerErr(null);
    try {
      const dto = buildBusinessDto(values, serviceFields, locationFields, faqFields);
      await api.patch('/onboarding/org', dto);
      await fetchCurrentOrg();
      setSaved(true);
      setEditing(false);
      onSaved();
      setTimeout(() => setSaved(false), 4_000);
    } catch {
      setServerErr('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const org = currentOrg;
  const faqCount = org?.faqs?.length ?? 0;
  const svcCount = org?.services?.length ?? 0;
  const locCount = org?.locations?.length ?? 0;
  const hoursDisplay = org?.businessHours
    ? is24HourSchedule(org.businessHours.start, org.businessHours.end)
      ? 'Open 24 hours'
      : `${org.businessHours.start} – ${org.businessHours.end}`
    : undefined;

  const inputCls = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition';
  const labelCls = 'mb-1 block text-xs font-medium text-slate-600';

  return (
    <div className="rounded-2xl border border-slate-100 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
        <div className="flex items-center gap-2">
          <Settings2 size={15} className="text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-700">Business Information</h2>
          {lastCrawledAt && !editing && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
              <Sparkles size={9} /> Auto-filled from website
            </span>
          )}
        </div>
        {!editing && (
          <button
            onClick={() => { setEditing(true); setSaved(false); }}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
          >
            <Pencil size={11} /> Edit
          </button>
        )}
      </div>

      {/* Saved banner */}
      {saved && (
        <div className="flex items-center gap-2 bg-emerald-50 border-b border-emerald-100 px-5 py-2.5 text-xs text-emerald-700">
          <CheckCircle2 size={13} /> Business information saved successfully.
        </div>
      )}

      {/* Auto-fill info banner (only when crawled and not in edit mode) */}
      {lastCrawledAt && !editing && (
        <div className="flex items-center gap-2 bg-sky-50 border-b border-sky-100 px-5 py-2.5 text-xs text-sky-700">
          <Globe size={12} className="flex-shrink-0" />
          Fields below were pre-filled from your website crawl. You can edit them at any time.
        </div>
      )}

      {/* Body */}
      <div className="px-5 py-4">
        {!editing ? (
          /* ── Read-only view ── */
          <div className="space-y-0 divide-y divide-slate-50">
            {org?.businessDescription && (
              <div className="py-2.5">
                <span className="text-xs font-medium text-slate-400 block mb-1">Description</span>
                <p className="text-sm text-slate-700 leading-relaxed line-clamp-3">{org.businessDescription}</p>
              </div>
            )}
            {svcCount > 0 && (
              <div className="flex items-start justify-between gap-4 py-2.5">
                <span className="text-xs font-medium text-slate-400 w-32 flex-shrink-0">Services ({svcCount})</span>
                <span className="text-sm text-slate-700 text-right">
                  {[...org!.services.slice(0, 3), ...(svcCount > 3 ? [`+${svcCount - 3} more`] : [])].join(', ')}
                </span>
              </div>
            )}
            {hoursDisplay && (
              <div className="flex items-start justify-between gap-4 py-2.5">
                <span className="text-xs font-medium text-slate-400 w-32 flex-shrink-0">Business hours</span>
                <span className="text-sm text-slate-700 text-right">{hoursDisplay}</span>
              </div>
            )}
            {org?.contactDetails?.email && (
              <div className="flex items-start justify-between gap-4 py-2.5">
                <span className="text-xs font-medium text-slate-400 w-32 flex-shrink-0">Email</span>
                <span className="text-sm text-slate-700 text-right">{org.contactDetails.email}</span>
              </div>
            )}
            {org?.contactDetails?.phone && (
              <div className="flex items-start justify-between gap-4 py-2.5">
                <span className="text-xs font-medium text-slate-400 w-32 flex-shrink-0">Phone</span>
                <span className="text-sm text-slate-700 text-right">{org.contactDetails.phone}</span>
              </div>
            )}
            {locCount > 0 && (
              <div className="flex items-start justify-between gap-4 py-2.5">
                <span className="text-xs font-medium text-slate-400 w-32 flex-shrink-0">Locations ({locCount})</span>
                <span className="text-sm text-slate-700 text-right">{org!.locations.join(', ')}</span>
              </div>
            )}
            {faqCount > 0 && (
              <div className="py-2.5">
                <span className="text-xs font-medium text-slate-400 block mb-2">
                  FAQs ({faqCount})
                </span>
                <div className="space-y-2">
                  {org!.faqs.map((faq, i) => (
                    <div key={i} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                      <p className="text-xs font-medium text-slate-700">{faq.question}</p>
                      <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">{faq.answer}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {!org?.businessDescription && svcCount === 0 && faqCount === 0 && (
              <div className="py-6 text-center">
                <Settings2 size={28} className="mx-auto mb-2 text-slate-200" />
                <p className="text-sm text-slate-400">No business details yet.</p>
                <p className="text-xs text-slate-300 mt-0.5">
                  Run a website crawl to auto-fill, or click <strong>Edit</strong> to enter manually.
                </p>
              </div>
            )}
          </div>
        ) : (
          /* ── Edit form ── */
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 mt-1">
            {serverErr && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-100 px-4 py-2.5 text-sm text-red-700">
                <AlertCircle size={14} /> {serverErr}
              </div>
            )}

            {/* 1. Business description */}
            <div>
              <label className={labelCls}>Business description</label>
              <textarea {...register('businessDescription')} rows={3} placeholder="What does your business do?" className={`${inputCls} resize-y`} />
            </div>

            {/* 3. Services */}
            <div>
              <label className={labelCls}>Services / Products</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {serviceFields.map((f, i) => (
                  <span key={f.id} className="inline-flex items-center gap-1 rounded-full bg-violet-50 border border-violet-100 px-2.5 py-0.5 text-xs text-violet-700">
                    <input {...register(`services.${i}.value`)} className="bg-transparent outline-none w-auto max-w-[120px] text-xs" />
                    <button type="button" onClick={() => removeService(i)}><XIcon size={10} /></button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={newService}
                  onChange={(e) => setNewService(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addService(); } }}
                  placeholder="Add a service and press Enter"
                  className={inputCls}
                />
                <button type="button" onClick={addService} className="flex-shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 transition">
                  <Plus size={13} />
                </button>
              </div>
            </div>

            {/* 4. Business hours */}
            <div>
              <label className={labelCls}>Business hours</label>
              <label className="flex items-center gap-2 text-sm text-slate-700 mb-2 cursor-pointer">
                <input type="checkbox" {...register('isOpen24Hours')} className="rounded border-slate-300 text-violet-600 focus:ring-violet-400" />
                Open 24 hours
              </label>
              {!isOpen24Hours && (
                <div className="flex items-center gap-3">
                  <input type="time" {...register('businessHoursStart')} className={`${inputCls} w-36`} />
                  <span className="text-slate-400 text-sm">to</span>
                  <input type="time" {...register('businessHoursEnd')} className={`${inputCls} w-36`} />
                </div>
              )}
            </div>

            {/* 5. Contact details */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Contact email</label>
                <input {...register('contactEmail')} type="email" placeholder="hello@yourcompany.com" className={inputCls} />
                {errors.contactEmail && <p className="mt-1 text-xs text-red-600">{errors.contactEmail.message}</p>}
              </div>
              <div>
                <label className={labelCls}>Contact phone</label>
                <input {...register('contactPhone')} type="tel" placeholder="+91 98765 43210" className={inputCls} />
              </div>
            </div>

            {/* 6. Locations */}
            <div>
              <label className={labelCls}>Office / Branch locations</label>
              {locationFields.map((f, i) => (
                <div key={f.id} className="flex gap-2 mb-1.5">
                  <input {...register(`locations.${i}.value`)} className={`${inputCls} flex-1`} />
                  <button type="button" onClick={() => removeLocation(i)} className="flex-shrink-0 rounded-lg border border-slate-200 px-2 text-slate-400 hover:text-red-500 transition">
                    <XIcon size={13} />
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLocation(); } }}
                  placeholder="Add a location and press Enter"
                  className={inputCls}
                />
                <button type="button" onClick={addLocation} className="flex-shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 transition">
                  <Plus size={13} />
                </button>
              </div>
            </div>

            {/* 7. FAQs (collapsible) */}
            <div>
              <button
                type="button"
                onClick={() => setFaqsOpen((v) => !v)}
                className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-violet-700 transition"
              >
                {faqsOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                FAQs {faqFields.length > 0 ? `(${faqFields.length})` : ''}
              </button>
              {faqsOpen && (
                <div className="mt-3 space-y-3">
                  {faqFields.map((f, i) => (
                    <div key={f.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mt-0.5">Q{i + 1}</span>
                        <button type="button" onClick={() => removeFaq(i)} className="text-slate-300 hover:text-red-400 transition"><XIcon size={12} /></button>
                      </div>
                      <input {...register(`faqs.${i}.question`)} placeholder="Question" className={inputCls} />
                      <textarea {...register(`faqs.${i}.answer`)} rows={2} placeholder="Answer" className={`${inputCls} resize-none`} />
                    </div>
                  ))}
                  {faqFields.length < 10 && (
                    <button
                      type="button"
                      onClick={() => appendFaq({ question: '', answer: '' })}
                      className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-800 transition"
                    >
                      <Plus size={12} /> Add FAQ
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Form actions */}
            <div className="flex items-center gap-3 pt-1 border-t border-slate-50">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-50"
              >
                {saving && <Loader2 size={13} className="animate-spin" />}
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => { setEditing(false); setServerErr(null); }}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function KnowledgeBasePage() {
  const canWrite = useCanWrite('knowledgeBase');
  const { fetchCurrentOrg } = useAuth();

  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<null | { mode: 'add' } | { mode: 'edit'; doc: KbDoc }>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<KbDoc | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [resyncMsg, setResyncMsg] = useState('');
  const [resyncError, setResyncError] = useState('');

  const addBtnRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  // Close add-document dropdown on outside click
  useEffect(() => {
    if (!showAddMenu) return;
    const handleOutside = (e: MouseEvent) => {
      if (addBtnRef.current && !addBtnRef.current.contains(e.target as Node)) {
        setShowAddMenu(false);
      }
    };
    window.addEventListener('mousedown', handleOutside);
    return () => window.removeEventListener('mousedown', handleOutside);
  }, [showAddMenu]);

  const { data: billingStatus } = useQuery<BillingStatus>({
    queryKey: ['billing', 'status'],
    queryFn: () => api.get('/billing/status').then((r) => r.data?.data ?? r.data),
    staleTime: 5 * 60_000,
  });

  const { data: listData, isLoading: docsLoading } = useQuery({
    queryKey: ['kb', 'docs'],
    queryFn: fetchDocs,
    staleTime: 30_000,
    retry: false,
  });

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ['kb', 'status'],
    queryFn: fetchStatus,
    staleTime: 20_000,
    retry: false,
    refetchInterval: (query) => {
      const d = query.state.data;
      return d?.crawlStatus === 'processing' || d?.crawlStatus === 'pending' ? 4_000 : false;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDoc,
    onMutate: (id) => setDeletingId(id),
    onSettled: () => setDeletingId(null),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['kb', 'docs'] });
      void qc.invalidateQueries({ queryKey: ['kb', 'status'] });
    },
  });

  const resyncMutation = useMutation({
    mutationFn: triggerResync,
    onSuccess: (data) => {
      setResyncMsg(data.message ?? 'Re-sync queued');
      setTimeout(() => setResyncMsg(''), 5_000);
      void qc.invalidateQueries({ queryKey: ['kb', 'status'] });
    },
    onError: (e: Error) => {
      setResyncError(e.message || 'Re-sync failed');
      setTimeout(() => setResyncError(''), 6_000);
    },
  });

  const handleBulkDelete = async (ids: string[]) => {
    await Promise.allSettled(ids.map((id) => deleteDoc(id)));
    void qc.invalidateQueries({ queryKey: ['kb', 'docs'] });
    void qc.invalidateQueries({ queryKey: ['kb', 'status'] });
  };

  const allDocs = listData?.docs ?? [];
  const crawling = status?.crawlStatus === 'processing' || status?.crawlStatus === 'pending';

  // Detect crawl completion → refresh docs AND org business fields
  const prevCrawlingRef = useRef(false);
  useEffect(() => {
    if (prevCrawlingRef.current && !crawling && status !== undefined) {
      void qc.invalidateQueries({ queryKey: ['kb', 'docs'] });
      void qc.invalidateQueries({ queryKey: ['kb', 'status'] });
      // Crawl writes businessDescription, services, hours, etc. to the org.
      // Re-fetch so the Business Information panel shows the fresh data.
      void fetchCurrentOrg();
    }
    prevCrawlingRef.current = crawling;
  }, [crawling, qc, status, fetchCurrentOrg]);

  const websitePages = allDocs.filter((d) => d.sourceType === 'website_page');
  const otherDocs = allDocs.filter((d) => d.sourceType !== 'website_page');

  const filteredOther = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? otherDocs.filter((d) => d.title.toLowerCase().includes(q)) : otherDocs;
  }, [otherDocs, search]);

  const filteredAll = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? allDocs.filter((d) => d.title.toLowerCase().includes(q)) : null;
  }, [allDocs, search]);

  const displayDocs = filteredAll ?? filteredOther;
  const isSearching = search.trim().length > 0;

  const openEditModal = async (doc: KbDoc) => {
    try {
      const full = await fetchDoc(doc.id);
      setModal({ mode: 'edit', doc: { ...doc, content: full.content } as KbDoc & { content: string } });
    } catch {
      setModal({ mode: 'edit', doc });
    }
  };

  return (
    <div className="space-y-6">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Knowledge Base</h1>
          <p className="mt-1 text-sm text-slate-500">Documents your agent draws on when answering calls.</p>
        </div>

        {canWrite && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {status?.crawlEnabled && status?.websiteUrl && (
              <button
                onClick={() => resyncMutation.mutate()}
                disabled={resyncMutation.isPending || crawling}
                title={crawling ? 'Crawl in progress' : 'Pull latest content from your website'}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw size={14} className={crawling ? 'animate-spin' : ''} />
                {crawling ? 'Syncing…' : 'Re-sync website'}
              </button>
            )}

            {/* Add document — dropdown */}
            <div className="relative" ref={addBtnRef}>
              <button
                onClick={() => setShowAddMenu((v) => !v)}
                className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-violet-700"
              >
                <Plus size={14} />
                Add document
                <ChevronDown
                  size={12}
                  className={`transition-transform duration-150 ${showAddMenu ? 'rotate-180' : ''}`}
                />
              </button>

              {showAddMenu && (
                <div className="absolute right-0 top-full z-20 mt-1.5 w-56 rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
                  <button
                    onClick={() => { setShowUpload(true); setShowAddMenu(false); }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition hover:bg-violet-50"
                  >
                    <Upload size={15} className="flex-shrink-0 text-slate-400" />
                    <div>
                      <p className="font-medium text-slate-700">Upload file</p>
                      <p className="text-[11px] text-slate-400">Drag & drop .txt, .md, .csv</p>
                    </div>
                  </button>
                  <div className="border-t border-slate-100" />
                  <button
                    onClick={() => { setModal({ mode: 'add' }); setShowAddMenu(false); }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition hover:bg-violet-50"
                  >
                    <FileText size={15} className="flex-shrink-0 text-slate-400" />
                    <div>
                      <p className="font-medium text-slate-700">Enter manually</p>
                      <p className="text-[11px] text-slate-400">Paste or type text directly</p>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Banners ─────────────────────────────────────────────────── */}
      {resyncMsg && (
        <div className="flex items-center gap-2 rounded-lg bg-violet-50 border border-violet-100 px-4 py-2.5 text-sm text-violet-700">
          <CheckCircle2 size={14} /> {resyncMsg}
        </div>
      )}
      {resyncError && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-100 px-4 py-2.5 text-sm text-red-700">
          <AlertCircle size={14} /> {resyncError}
        </div>
      )}
      {crawling && !resyncMsg && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-100 px-4 py-2.5 text-sm text-amber-700">
          <Loader2 size={14} className="animate-spin" />
          Website crawl in progress — new KB documents will appear shortly.
        </div>
      )}

      {/* ── Stats ───────────────────────────────────────────────────── */}
      {!statusLoading && status && (
        <div className="grid grid-cols-3 gap-4">
          {/* Total documents — with plan limit if available */}
          <div className="rounded-xl border border-slate-100 bg-white p-4">
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold text-slate-900">{status.total}</p>
              {billingStatus?.kbDocs?.limit != null && billingStatus.kbDocs.limit > 0 && (
                <span className={`text-sm font-medium ${
                  status.total >= billingStatus.kbDocs.limit
                    ? 'text-red-500'
                    : status.total >= billingStatus.kbDocs.limit * 0.8
                      ? 'text-amber-500'
                      : 'text-slate-400'
                }`}>
                  / {billingStatus.kbDocs.limit}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Total documents
              {billingStatus?.isInTrial && (
                <span className="ml-1 inline-flex items-center rounded-full bg-blue-50 px-1.5 py-0.5 text-[9px] font-semibold text-blue-600">
                  Trial
                </span>
              )}
            </p>
            {/* Limit progress bar */}
            {billingStatus?.kbDocs?.limit != null && billingStatus.kbDocs.limit > 0 && (
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full transition-all ${
                    status.total >= billingStatus.kbDocs.limit
                      ? 'bg-red-500'
                      : status.total >= billingStatus.kbDocs.limit * 0.8
                        ? 'bg-amber-400'
                        : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min((status.total / billingStatus.kbDocs.limit) * 100, 100)}%` }}
                />
              </div>
            )}
          </div>

          {[
            { label: 'Ready', value: status.readyCount },
            { label: 'Processing', value: status.pendingCount },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl border border-slate-100 bg-white p-4">
              <p className="text-2xl font-bold text-slate-900">{value}</p>
              <p className="mt-0.5 text-xs text-slate-500">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── KB limit reached warning ─────────────────────────────────── */}
      {billingStatus?.kbDocs?.limit != null &&
       billingStatus.kbDocs.limit > 0 &&
       status &&
       status.total >= billingStatus.kbDocs.limit && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertCircle size={15} className="flex-shrink-0 text-amber-600" />
          <p className="text-sm text-amber-800">
            You've reached your {billingStatus.kbDocs.limit}-document limit on the{' '}
            <strong>{billingStatus.isInTrial ? 'Growth (Trial)' : billingStatus.effectivePlan}</strong> plan.{' '}
            <a href="/billing" className="font-semibold underline hover:text-amber-900">Upgrade</a> to add more.
          </p>
        </div>
      )}

      {/* ── Business Information ─────────────────────────────────── */}
      <BusinessInfoSection
        lastCrawledAt={status?.lastCrawledAt ?? null}
        onSaved={() => void fetchCurrentOrg()}
      />

      {/* ── Search bar ──────────────────────────────────────────────── */}
      {allDocs.length > 0 && (
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents…"
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <XIcon size={14} />
            </button>
          )}
        </div>
      )}

      {/* ── Document table ──────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-100 bg-white overflow-hidden">
        {/* Table header — 5 columns matching ROW_COLS */}
        <div
          className="grid items-center gap-3 border-b border-slate-100 px-5 py-3"
          style={{ gridTemplateColumns: ROW_COLS }}
        >
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Document</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Type</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 text-center">Status</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 text-right">Tokens</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 text-right">Actions</span>
        </div>

        {/* Skeletons */}
        {docsLoading && (
          <div className="divide-y divide-slate-50">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="grid items-center gap-3 px-5 py-4" style={{ gridTemplateColumns: ROW_COLS }}>
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-4 w-4 rounded-full mx-auto" />
                <Skeleton className="h-4 w-12 ml-auto" />
                <div className="flex justify-end gap-1">
                  <Skeleton className="h-7 w-7 rounded-lg" />
                  <Skeleton className="h-7 w-7 rounded-lg" />
                  <Skeleton className="h-7 w-7 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!docsLoading && displayDocs.length === 0 && (
          <div className="flex flex-col items-center justify-center px-8 py-16 text-center">
            <div
              className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{
                background: 'linear-gradient(135deg, rgba(99,102,241,.12), rgba(139,92,246,.12))',
                border: '1px solid rgba(99,102,241,.2)',
              }}
            >
              {isSearching
                ? <Search size={22} className="text-violet-400" />
                : <BookOpen size={22} className="text-violet-400" strokeWidth={1.8} />}
            </div>
            <p className="text-sm font-semibold text-slate-700">
              {isSearching ? `No documents matching "${search}"` : 'No documents yet'}
            </p>
            {!isSearching && (
              <p className="mt-1 max-w-xs text-xs text-slate-500 leading-relaxed">
                {status?.crawlEnabled && status?.websiteUrl
                  ? 'Click "Re-sync website" to import pages, or add a document manually.'
                  : 'Add your first document so your agent can answer questions accurately.'}
              </p>
            )}
          </div>
        )}

        {/* Document rows */}
        {!docsLoading && displayDocs.length > 0 && (
          <div className="divide-y divide-slate-50">
            {displayDocs.map((doc) => (
              <DocRow
                key={doc.id}
                doc={doc}
                onEdit={() => void openEditModal(doc)}
                onDelete={(id) => deleteMutation.mutate(id)}
                onView={(d) => setViewingDoc(d)}
                isDeleting={deletingId === doc.id}
                canWrite={canWrite}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Crawl page picker (only when not searching) ──────────────── */}
      {!isSearching && websitePages.length > 0 && (
        <CrawlPagePicker
          pages={websitePages}
          onRemove={(ids) => void handleBulkDelete(ids)}
          canWrite={canWrite}
        />
      )}

      {/* ── Website hint ─────────────────────────────────────────────── */}
      {status?.websiteUrl && (
        <p className="flex items-center gap-1.5 text-xs text-slate-400">
          <Globe size={11} />
          Synced from <span className="font-medium text-slate-500">{status.websiteUrl}</span>
          {status.lastCrawledAt && (
            <> · Last synced {new Date(status.lastCrawledAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</>
          )}
        </p>
      )}

      {/* ── Modals ───────────────────────────────────────────────────── */}
      {modal?.mode === 'add' && (
        <DocModal mode="add" onClose={() => setModal(null)} />
      )}
      {modal?.mode === 'edit' && (
        <DocModal
          mode="edit"
          initial={{
            id: modal.doc.id,
            title: modal.doc.title,
            content: (modal.doc as KbDoc & { content?: string }).content ?? '',
          }}
          onClose={() => setModal(null)}
        />
      )}
      {showUpload && (
        <FileUploadModal onClose={() => setShowUpload(false)} />
      )}
      {viewingDoc && (
        <DocDetailModal
          doc={viewingDoc}
          onClose={() => setViewingDoc(null)}
          onEdit={canWrite ? () => void openEditModal(viewingDoc) : undefined}
        />
      )}
    </div>
  );
}
