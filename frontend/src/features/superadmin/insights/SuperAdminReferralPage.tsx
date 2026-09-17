/**
 * 19.8 — Referral Tracking
 * Top referrers leaderboard + look up referral tree for any org.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Gift, Search, RefreshCw, Award, ChevronRight, Tag } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '@/utils/api';

const T = {
  bg: '#07070f', bgS: '#0e0e1a', bgC: 'rgba(255,255,255,0.04)',
  bdr: 'rgba(255,255,255,0.07)', bdrB: 'rgba(255,255,255,0.12)',
  green: '#22c55e', greenD: 'rgba(34,197,94,0.12)',
  amber: '#f59e0b', amberD: 'rgba(245,158,11,0.12)',
  blue: '#3b82f6', blueD: 'rgba(59,130,246,0.12)',
  purple: '#a855f7', purpleD: 'rgba(168,85,247,0.12)',
  t1: '#f8fafc', t2: '#94a3b8', t3: '#475569',
};

interface TopReferrer {
  orgId: string; orgName: string; referralCode: string;
  referralCount: number; plan: string;
}
interface ReferralLink {
  orgId: string; orgName: string; plan: string; joinedAt: string;
}
interface ReferralTree {
  orgId: string; orgName: string; referralCode: string;
  referrals: ReferralLink[];
}

const medalColors = ['#f59e0b', '#94a3b8', '#cd7c2f'];

export default function SuperAdminReferralPage() {
  const [lookupOrgId, setLookupOrgId] = useState('');
  const [treeOrgId, setTreeOrgId] = useState('');
  const qc = useQueryClient();

  // Top referrers
  const { data: topReferrers, isLoading: loadingTop, refetch: refetchTop, isFetching: fetchingTop } = useQuery({
    queryKey: ['sa-top-referrers'],
    queryFn: async () => {
      const r = await api.get<{ success: boolean; data: TopReferrer[] }>('/superadmin/referrals/top?limit=20');
      return r.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Referral tree lookup (on-demand)
  const { data: treeData, isLoading: loadingTree, refetch: doTreeLookup } = useQuery({
    queryKey: ['sa-referral-tree', treeOrgId],
    queryFn: async () => {
      if (!treeOrgId) return null;
      const r = await api.get<{ success: boolean; data: ReferralTree }>(
        `/superadmin/orgs/${treeOrgId}/referral-tree`
      );
      return r.data.data;
    },
    enabled: false,
    staleTime: 2 * 60 * 1000,
  });

  // Generate referral code mutation
  const genCodeMutation = useMutation({
    mutationFn: async (orgId: string) => {
      const r = await api.post<{ success: boolean; data: { referralCode: string } }>(
        `/superadmin/orgs/${orgId}/referral-code`, {}
      );
      return r.data.data.referralCode;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['sa-top-referrers'] });
      void qc.invalidateQueries({ queryKey: ['sa-referral-tree'] });
    },
  });

  function handleTreeLookup() {
    if (!lookupOrgId.trim()) return;
    setTreeOrgId(lookupOrgId.trim());
    setTimeout(() => doTreeLookup(), 50);
  }

  return (
    <div style={{ padding: '32px 40px', background: T.bg, minHeight: '100vh', color: T.t1 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Gift size={22} color={T.purple} />
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Referral Tracking</h1>
            <p style={{ margin: 0, fontSize: 13, color: T.t2, marginTop: 2 }}>
              Referral codes, chains, and top-referrer leaderboard
            </p>
          </div>
        </div>
        <button onClick={() => refetchTop()} disabled={fetchingTop}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
            background: T.bgC, border: `1px solid ${T.bdr}`, borderRadius: 8,
            color: T.t2, cursor: 'pointer', fontSize: 13 }}>
          <RefreshCw size={14} style={{ animation: fetchingTop ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 28 }}>
        {/* Leaderboard */}
        <div>
          <h2 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: T.t2 }}>
            <Award size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            Top Referrers
          </h2>
          <div style={{ background: T.bgS, border: `1px solid ${T.bdr}`, borderRadius: 12, overflow: 'hidden' }}>
            {loadingTop && (
              <div style={{ padding: 40, textAlign: 'center', color: T.t2 }}>Loading…</div>
            )}
            {!loadingTop && (topReferrers ?? []).length === 0 && (
              <div style={{ padding: 40, textAlign: 'center', color: T.t2 }}>
                No referrals yet. Generate codes and start tracking!
              </div>
            )}
            {(topReferrers ?? []).map((r, i) => (
              <div key={r.orgId} style={{ display: 'flex', alignItems: 'center', gap: 16,
                padding: '14px 20px', borderBottom: i < (topReferrers ?? []).length - 1 ? `1px solid ${T.bdr}` : 'none' }}>
                {/* Rank */}
                <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: i < 3 ? `${medalColors[i]}22` : T.bgC,
                  border: `1px solid ${i < 3 ? medalColors[i] + '55' : T.bdr}`,
                  fontSize: 13, fontWeight: 700, color: i < 3 ? medalColors[i] : T.t3 }}>
                  {i + 1}
                </div>
                {/* Org info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{r.orgName}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Tag size={11} color={T.t3} />
                    <code style={{ fontSize: 11, color: T.purple, background: T.purpleD,
                      padding: '1px 6px', borderRadius: 4 }}>
                      {r.referralCode}
                    </code>
                    <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 6,
                      background: T.blueD, color: T.blue, fontWeight: 600, textTransform: 'capitalize' }}>
                      {r.plan}
                    </span>
                  </div>
                </div>
                {/* Referral count */}
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: T.purple }}>{r.referralCount}</div>
                  <div style={{ fontSize: 11, color: T.t3 }}>referrals</div>
                </div>
                <Link to={`/superadmin/orgs/${r.orgId}`}
                  style={{ color: T.t3, textDecoration: 'none', flexShrink: 0 }}>
                  <ChevronRight size={16} />
                </Link>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar: tree lookup + code generator */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Referral tree lookup */}
          <div style={{ background: T.bgS, border: `1px solid ${T.bdr}`, borderRadius: 12, padding: 20 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700, color: T.t2,
              textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Look Up Referral Tree
            </h3>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input value={lookupOrgId} onChange={e => setLookupOrgId(e.target.value)}
                placeholder="Org ID…"
                onKeyDown={e => e.key === 'Enter' && handleTreeLookup()}
                style={{ flex: 1, padding: '8px 12px', background: T.bgC,
                  border: `1px solid ${T.bdr}`, borderRadius: 8, color: T.t1,
                  fontSize: 13, outline: 'none' }} />
              <button onClick={handleTreeLookup} disabled={loadingTree}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 14px',
                  background: T.blueD, border: `1px solid ${T.blue}`, borderRadius: 8,
                  color: T.blue, cursor: 'pointer', fontSize: 13 }}>
                <Search size={14} />
              </button>
            </div>
            {loadingTree && <div style={{ color: T.t2, fontSize: 13 }}>Loading…</div>}
            {treeData && (
              <div>
                <div style={{ marginBottom: 10 }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{treeData.orgName}</span>
                  <code style={{ fontSize: 11, color: T.purple, background: T.purpleD,
                    padding: '1px 6px', borderRadius: 4, marginLeft: 8 }}>
                    {treeData.referralCode || '(no code)'}
                  </code>
                </div>
                {treeData.referrals.length === 0 && (
                  <p style={{ color: T.t3, fontSize: 12, margin: 0 }}>No direct referrals.</p>
                )}
                {treeData.referrals.map(ref => (
                  <div key={ref.orgId} style={{ display: 'flex', alignItems: 'center', gap: 8,
                    padding: '7px 0', borderBottom: `1px solid ${T.bdr}` }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: T.green, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{ref.orgName}</div>
                      <div style={{ fontSize: 11, color: T.t3 }}>
                        {new Date(ref.joinedAt).toLocaleDateString()} · {ref.plan}
                      </div>
                    </div>
                    <Link to={`/superadmin/orgs/${ref.orgId}`}
                      style={{ fontSize: 11, color: T.blue, textDecoration: 'none' }}>View →</Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Generate code for an org */}
          <div style={{ background: T.bgS, border: `1px solid ${T.bdr}`, borderRadius: 12, padding: 20 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700, color: T.t2,
              textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Generate Referral Code
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input id="gen-code-input" placeholder="Org ID…"
                style={{ padding: '8px 12px', background: T.bgC,
                  border: `1px solid ${T.bdr}`, borderRadius: 8, color: T.t1,
                  fontSize: 13, outline: 'none' }} />
              <button
                onClick={() => {
                  const el = document.getElementById('gen-code-input') as HTMLInputElement;
                  if (el?.value.trim()) genCodeMutation.mutate(el.value.trim());
                }}
                disabled={genCodeMutation.isPending}
                style={{ padding: '9px 16px', background: T.purpleD, border: `1px solid ${T.purple}`,
                  borderRadius: 8, color: T.purple, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                {genCodeMutation.isPending ? 'Generating…' : 'Generate / Regenerate Code'}
              </button>
              {genCodeMutation.isSuccess && genCodeMutation.data && (
                <div style={{ padding: '10px 14px', background: T.purpleD,
                  border: `1px solid ${T.purple}55`, borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: T.t3, marginBottom: 4 }}>New code</div>
                  <code style={{ fontSize: 16, color: T.purple, fontWeight: 700 }}>
                    {genCodeMutation.data}
                  </code>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
