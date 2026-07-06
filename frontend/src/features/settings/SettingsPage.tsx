/**
 * SettingsPage — org config view with Phone Number Setup (live section).
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppSelector } from '@/store';
import { useAuth } from '@/hooks/useAuth';
import { Bot, Copy, CheckCircle2, Phone, ExternalLink, Loader2 } from 'lucide-react';
import { api } from '@/utils/api';

// ─── API helpers ───────────────────────────────────────────────────────────────

async function fetchPhoneNumber(): Promise<{ vapiPhoneNumberId: string | null; vapiAssistantId: string | null }> {
  const res = await api.get<{ success: boolean; data: { vapiPhoneNumberId: string | null; vapiAssistantId: string | null } }>('/agents/phone-number');
  return res.data.data;
}

async function savePhoneNumber(vapiPhoneNumberId: string): Promise<{ vapiPhoneNumberId: string | null; message: string }> {
  const res = await api.post<{ success: boolean; data: { vapiPhoneNumberId: string | null; message: string } }>('/agents/phone-number', { vapiPhoneNumberId });
  return res.data.data;
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-slate-50 last:border-0">
      <span className="text-xs font-medium text-slate-400 w-40 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-slate-700 text-right flex-1 leading-snug">{value}</span>
    </div>
  );
}

function CopyRow({ label, value }: { label: string; value?: string }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;

  const copy = () => {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-slate-50 last:border-0">
      <span className="text-xs font-medium text-slate-400 w-40 flex-shrink-0">{label}</span>
      <div className="flex items-center gap-2">
        <code className="text-xs bg-slate-50 border border-slate-100 rounded-md px-2 py-1
          font-mono text-slate-600 max-w-[200px] truncate">
          {value}
        </code>
        <button
          onClick={copy}
          title="Copy"
          className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400
            hover:bg-slate-100 hover:text-slate-600 transition-colors"
        >
          {copied
            ? <CheckCircle2 size={13} className="text-emerald-500" />
            : <Copy size={13} />}
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white">
      <div className="px-5 pt-5 pb-1">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      </div>
      <div className="px-5 pb-3">{children}</div>
    </div>
  );
}

// ─── Phone Number Setup section ───────────────────────────────────────────────

function PhoneNumberSetup() {
  const queryClient = useQueryClient();
  const [inputValue, setInputValue] = useState('');
  const [saveError, setSaveError]   = useState<string | null>(null);
  const [saved, setSaved]           = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['phoneNumber'],
    queryFn:  fetchPhoneNumber,
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: savePhoneNumber,
    onSuccess: () => {
      setSaved(true);
      setSaveError(null);
      setInputValue('');
      void queryClient.invalidateQueries({ queryKey: ['phoneNumber'] });
      setTimeout(() => setSaved(false), 3000);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to save phone number';
      setSaveError(msg);
    },
  });

  const handleSave = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) {
      setSaveError('Please enter the Vapi phone number ID');
      return;
    }
    // Basic UUID format check
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(trimmed)) {
      setSaveError('Should look like a UUID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx');
      return;
    }
    setSaveError(null);
    mutation.mutate(trimmed);
  };

  return (
    <div className="mt-3 space-y-4">
      {/* Status row */}
      <div className="flex items-center gap-3 pb-4 border-b border-slate-50">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-lg flex-shrink-0"
          style={{ background: 'rgba(99,102,241,.08)', border: '1px solid rgba(99,102,241,.15)' }}
        >
          <Phone size={15} className="text-brand-600" strokeWidth={1.8} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-800">Inbound Call Routing</p>
          {isLoading ? (
            <p className="text-xs text-slate-400 mt-0.5">Loading…</p>
          ) : data?.vapiPhoneNumberId ? (
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="text-xs text-emerald-600 font-medium">Phone number linked</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              <span className="text-xs text-amber-600 font-medium">No phone number linked yet</span>
            </div>
          )}
        </div>
      </div>

      {/* Current linked ID */}
      {data?.vapiPhoneNumberId && (
        <CopyRow label="Linked Phone ID" value={data.vapiPhoneNumberId} />
      )}

      {/* How-to instructions */}
      <div className="rounded-lg bg-slate-50 border border-slate-100 p-4 text-xs text-slate-500 leading-relaxed space-y-2">
        <p className="font-semibold text-slate-600">How to connect your Vapi phone number:</p>
        <ol className="list-decimal list-inside space-y-1.5">
          <li>
            Open the{' '}
            <a
              href="https://dashboard.vapi.ai/phone-numbers"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-600 hover:underline inline-flex items-center gap-0.5"
            >
              Vapi Phone Numbers dashboard
              <ExternalLink size={10} className="inline" />
            </a>
          </li>
          <li>Buy or import a phone number (Twilio, Vonage, or Vapi-managed)</li>
          <li>
            In the number's settings, set <strong>Server URL</strong> to:<br />
            <code className="bg-white border border-slate-200 rounded px-1.5 py-0.5 font-mono text-slate-700 text-[10px] break-all">
              https://your-api-domain.com/api/v1/webhooks/vapi
            </code>
          </li>
          <li>Copy the phone number's <strong>ID</strong> (UUID format) and paste it below</li>
        </ol>
      </div>

      {/* Input + save */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-slate-600" htmlFor="phoneNumberId">
          Vapi Phone Number ID
        </label>
        <div className="flex gap-2">
          <input
            id="phoneNumberId"
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono
              text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2
              focus:ring-brand-500 focus:border-transparent transition-shadow"
          />
          <button
            onClick={handleSave}
            disabled={mutation.isPending || !inputValue.trim()}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium
              bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50
              disabled:cursor-not-allowed transition-colors"
          >
            {mutation.isPending
              ? <Loader2 size={14} className="animate-spin" />
              : saved
                ? <CheckCircle2 size={14} className="text-emerald-300" />
                : null}
            {saved ? 'Saved!' : 'Save'}
          </button>
        </div>
        {saveError && (
          <p className="text-xs text-rose-500">{saveError}</p>
        )}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { currentOrg, currentRole } = useAppSelector((s) => s.org);
  const { user } = useAuth();

  const faqCount = currentOrg?.faqs?.length ?? 0;
  const svcCount = currentOrg?.services?.length ?? 0;
  const locCount = currentOrg?.locations?.length ?? 0;

  return (
    <div className="space-y-6">

      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-slate-500">
            Organisation configuration and phone number setup.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5">
          <span className="text-xs font-medium text-amber-700">Full editor coming soon</span>
        </div>
      </div>

      {/* Organisation profile */}
      <Section title="Organisation Profile">
        <div className="flex items-center gap-4 mb-4 mt-3 pb-4 border-b border-slate-50">
          <div
            className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl
              text-lg font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
          >
            {currentOrg?.name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-800 truncate">
              {currentOrg?.name ?? '—'}
            </p>
            <p className="text-xs text-slate-400 font-mono">{currentOrg?.slug}</p>
          </div>
          {currentRole && (
            <span className="flex-shrink-0 rounded-full border border-brand-100 bg-brand-50
              px-2.5 py-1 text-xs font-semibold text-brand-700">
              {currentRole}
            </span>
          )}
        </div>

        <InfoRow label="Industry"        value={currentOrg?.industry} />
        <InfoRow label="Timezone"        value={currentOrg?.timezone} />
        <InfoRow label="Business hours"  value={
          currentOrg?.businessHours
            ? `${currentOrg.businessHours.start} – ${currentOrg.businessHours.end}`
            : undefined
        } />
        <InfoRow label="Contact email"   value={currentOrg?.contactDetails?.email} />
        <InfoRow label="Contact phone"   value={currentOrg?.contactDetails?.phone} />
        {locCount > 0 && (
          <InfoRow label="Locations" value={currentOrg?.locations.join(', ')} />
        )}
      </Section>

      {/* Agent configuration */}
      <Section title="Agent Configuration">
        <div className="flex items-center gap-3 mt-3 mb-4 pb-4 border-b border-slate-50">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg"
            style={{ background: 'rgba(99,102,241,.1)', border: '1px solid rgba(99,102,241,.15)' }}
          >
            <Bot size={16} className="text-brand-600" strokeWidth={1.8} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">
              {currentOrg?.agentName ?? 'AI Agent'}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`h-1.5 w-1.5 rounded-full ${currentOrg?.vapiAssistantId ? 'bg-emerald-500' : 'bg-amber-400'}`} />
              <span className={`text-xs font-medium ${currentOrg?.vapiAssistantId ? 'text-emerald-600' : 'text-amber-600'}`}>
                {currentOrg?.vapiAssistantId ? 'Live' : 'Not configured'}
              </span>
            </div>
          </div>
        </div>

        {currentOrg?.websiteUrl && (
          <InfoRow label="Website" value={currentOrg.websiteUrl} />
        )}
        {(currentOrg?.supportedLanguages?.length ?? 0) > 0 && (
          <InfoRow label="Languages" value={currentOrg!.supportedLanguages.join(', ')} />
        )}
        {currentOrg?.fallbackNumber && (
          <InfoRow label="Fallback number" value={currentOrg.fallbackNumber} />
        )}
        {svcCount > 0 && (
          <InfoRow
            label={`Services (${svcCount})`}
            value={[
              ...currentOrg!.services.slice(0, 3),
              ...(svcCount > 3 ? [`+${svcCount - 3} more`] : []),
            ].join(', ')}
          />
        )}
        {faqCount > 0 && (
          <InfoRow label="FAQs" value={`${faqCount} configured`} />
        )}
        {currentOrg?.businessDescription && (
          <div className="py-3">
            <p className="text-xs font-medium text-slate-400 mb-1.5">Business description</p>
            <p className="text-sm text-slate-600 leading-relaxed line-clamp-3">
              {currentOrg.businessDescription}
            </p>
          </div>
        )}
      </Section>

      {/* Phone Number Setup — live section */}
      <Section title="Phone Number Setup">
        <PhoneNumberSetup />
      </Section>

      {/* Technical IDs */}
      <Section title="Technical Details">
        <div className="mt-2">
          <CopyRow label="Organisation ID" value={currentOrg?.id} />
          <CopyRow label="Agent ID"        value={currentOrg?.vapiAssistantId} />
          <InfoRow  label="Created"         value={
            currentOrg?.createdAt
              ? new Date(currentOrg.createdAt).toLocaleDateString('en-IN', {
                  day: 'numeric', month: 'long', year: 'numeric',
                })
              : undefined
          } />
          <InfoRow label="Onboarding status" value={currentOrg?.onboardingStatus} />
        </div>
      </Section>

      {/* Account */}
      <Section title="Your Account">
        <div className="mt-2">
          <InfoRow label="Name"  value={user?.name} />
          <InfoRow label="Email" value={user?.email} />
          <InfoRow label="Role"  value={currentRole ?? undefined} />
        </div>
      </Section>

    </div>
  );
}
