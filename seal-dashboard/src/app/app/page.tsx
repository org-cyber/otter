
'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  ConnectButton,
  useCurrentAccount,
  useSignAndExecuteTransaction,
} from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';

// ── CONFIG ──────────────────────────────────────────────────────────────────
const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3001';
const SUI_SCAN = 'https://suiscan.xyz/testnet/object';
const PACKAGE_ID = '0xdbfb39eabe0938cb1495443b733e00bd90799a6d5ea870227d9f0e426091b480';

// ── DESIGN TOKENS ───────────────────────────────────────────────────────────
const C = {
  teal: '#1a6b7a',
  tealDark: '#0d2b36',
  tealLight: '#e8f1f3',
  tealMuted: '#8fb3bd',
  brown: '#a0785a',
  brownLight: '#f5ede6',
  bg: '#f5f7f9',
  surface: '#ffffff',
  surfaceHover: '#fafbfc',
  border: '#e2e8f0',
  borderStrong: '#cbd5e1',
  text: '#0f172a',
  textSecondary: '#475569',
  textMuted: '#94a3b8',
  danger: '#dc2626',
  dangerBg: '#fef2f2',
  dangerBorder: '#fecaca',
  success: '#059669',
  successBg: '#ecfdf5',
  successBorder: '#a7f3d0',
  shadow: '0 1px 2px rgba(15,23,42,0.04), 0 1px 3px rgba(15,23,42,0.06)',
  shadowMd: '0 4px 6px -1px rgba(15,23,42,0.06), 0 2px 4px -2px rgba(15,23,42,0.04)',
  shadowLg: '0 10px 15px -3px rgba(15,23,42,0.08), 0 4px 6px -4px rgba(15,23,42,0.04)',
  shadowFocus: '0 0 0 3px rgba(26,107,122,0.15)',
};

// ── ICONS ───────────────────────────────────────────────────────────────────
const Icon = {
  Landmark: (p: any) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6M10 9h4M10 13h4" />
    </svg>
  ),
  Network: (p: any) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="16" y="16" width="6" height="6" rx="1" /><rect x="2" y="16" width="6" height="6" rx="1" /><rect x="9" y="2" width="6" height="6" rx="1" /><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3M12 12V8" />
    </svg>
  ),
  Bot: (p: any) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3" y="11" width="18" height="10" rx="2" /><circle cx="12" cy="5" r="2" /><path d="M12 7v4M8 16h.01M16 16h.01" />
    </svg>
  ),
  Zap: (p: any) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  Key: (p: any) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="7.5" cy="15.5" r="5.5" /><path d="m21 2-9.6 9.6M15.5 7.5 19 11l3-3-3-3" />
    </svg>
  ),
  Lock: (p: any) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  ),
  Plus: (p: any) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  Undo: (p: any) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 7v6h6M21 17a9 9 0 0 0-15-6.7L3 13" />
    </svg>
  ),
  Check: (p: any) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  X: (p: any) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  ),
  Alert: (p: any) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3ZM12 9v4M12 17h.01" />
    </svg>
  ),
  ExternalLink: (p: any) => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3" />
    </svg>
  ),
  Terminal: (p: any) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  ),
  Pause: (p: any) => (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" {...p}>
      <rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  ),
  Circle: (p: any) => (
    <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" {...p}>
      <circle cx="12" cy="12" r="10" />
    </svg>
  ),
  Spinner: (p: any) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" {...p}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" style={{ animation: 'spin 1s linear infinite', transformOrigin: 'center' }} />
    </svg>
  ),
};

// ── SHARED UI PRIMITIVES (Hoisted to module scope) ──────────────────────────
const inputStyle = {
  padding: '10px 14px',
  background: C.surface,
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  color: C.text,
  fontSize: 13,
  fontFamily: 'inherit',
  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
  outline: 'none',
};

const btnBase = {
  padding: '10px 18px',
  fontSize: 13,
  fontWeight: 600,
  border: 'none',
  borderRadius: 8,
  cursor: 'pointer',
  fontFamily: 'inherit',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  transition: 'all 0.15s ease',
  letterSpacing: '-0.01em',
};

const btnPrimary = {
  ...btnBase,
  background: C.teal,
  color: '#fff',
};

const btnPrimaryDisabled = {
  ...btnPrimary,
  background: C.tealMuted,
  cursor: 'not-allowed',
};

const btnSecondary = {
  ...btnBase,
  background: C.surface,
  color: C.textSecondary,
  border: `1px solid ${C.border}`,
};

const btnDanger = {
  ...btnBase,
  background: C.dangerBg,
  color: C.danger,
  border: `1px solid ${C.dangerBorder}`,
};

const btnDangerDisabled = {
  ...btnDanger,
  opacity: 0.6,
  cursor: 'not-allowed',
};

const labelStyle = {
  fontSize: 11,
  fontWeight: 600,
  color: C.textMuted,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: 6,
  display: 'block',
};

// ── TYPES ───────────────────────────────────────────────────────────────────
interface TreasuryNode {
  id: string;
  name: string;
  owner: string;
  balance: string;
  paused: boolean;
  parent: string | null;
  children: TreasuryNode[];
}
interface ApiKeyRecord {
  key: string;
  treasuryId: string;
  label: string;
  createdAt: number;
  revoked: boolean;
  allowResume: boolean;
}
interface ProviderInfo {
  configured: boolean;
  models: Record<string, { costPer1kTokens: number }>;
}

// ─ UTILITY ─────────────────────────────────────────────────────────────────
function formatSui(mist: string): string {
  return (Number(mist) / 1e9).toFixed(6);
}
function formatDate(ts: number): string {
  return new Date(ts).toLocaleString();
}
function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}

// ─ COMPONENT ──────────────────────────────────────────────────────────────
export default function Home() {
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const wallet = account?.address;
  const [treasuries, setTreasuries] = useState<TreasuryNode[]>([]);
  const [selectedTreasury, setSelectedTreasury] = useState<string | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKeyRecord[]>([]);
  const [providers, setProviders] = useState<Record<string, ProviderInfo>>({});
  const [ownerCaps, setOwnerCaps] = useState<Record<string, string>>({});
  const [newTreasuryName, setNewTreasuryName] = useState('');
  const [newTreasuryDeposit, setNewTreasuryDeposit] = useState('0.05');
  const [spawnParentId, setSpawnParentId] = useState('');
  const [spawnName, setSpawnName] = useState('');
  const [spawnBudget, setSpawnBudget] = useState('0.01');
  const [spawnDailyCap, setSpawnDailyCap] = useState('5000000');
  const [spawnProviders, setSpawnProviders] = useState<string[]>(['groq']);
  const [prompt1, setPrompt1] = useState('');
  const [prompt2, setPrompt2] = useState('');
  const [prompt3, setPrompt3] = useState('');
  const [parallelResults, setParallelResults] = useState<any[]>([]);
  const [parallelLoading, setParallelLoading] = useState(false);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  // ── FETCH OWNER CAPS ──────────────────────────────────────────────────────
  const fetchOwnerCaps = useCallback(async () => {
    if (!wallet) return;
    try {
      const res = await fetch(`${GATEWAY_URL}/caps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet }),
      });
      const data = await res.json();
      setOwnerCaps(data.caps || {});
    } catch (err) {
      console.error('Fetch caps error:', err);
    }
  }, [wallet]);

  // ── REFRESH FUNCTIONS ─────────────────────────────────────────────────────
  const refreshTreasuries = useCallback(async () => {
    if (!wallet) return;
    try {
      const res = await fetch(`${GATEWAY_URL}/agents/${wallet}`);
      const data = await res.json();
      const list = data.treasuries || [];
      const masters = list.filter((t: any) => !t.parent);
      const children = list.filter((t: any) => t.parent);
      const tree: TreasuryNode[] = masters.map((m: any) => ({
        ...m,
        children: children
          .filter((c: any) => c.parent === m.id)
          .map((c: any) => ({ ...c, children: [] })),
      }));
      setTreasuries(tree);
    } catch (err) {
      console.error('Treasuries fetch error:', err);
    }
  }, [wallet]);

  const refreshApiKeys = useCallback(async () => {
    if (!wallet) return;
    try {
      const res = await fetch(`${GATEWAY_URL}/keys/${wallet}`);
      const data = await res.json();
      setApiKeys(data.keys || []);
    } catch (err) {
      console.error('API keys error:', err);
    }
  }, [wallet]);

  const refreshProviders = useCallback(async () => {
    try {
      const res = await fetch(`${GATEWAY_URL}/providers`);
      const data = await res.json();
      setProviders(data.providers || {});
    } catch (err) {
      console.error('Providers fetch error:', err);
    }
  }, []);

  // ── POLLING ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!wallet) return;
    refreshTreasuries();
    refreshApiKeys();
    refreshProviders();
    fetchOwnerCaps();
    const interval = setInterval(() => {
      refreshTreasuries();
      fetchOwnerCaps();
    }, 5000);
    return () => clearInterval(interval);
  }, [wallet, refreshTreasuries, refreshApiKeys, refreshProviders, fetchOwnerCaps]);

  // ── CREATE MASTER TREASURY ────────────────────────────────────────────────
  const handleCreateTreasury = async () => {
    if (!wallet) {
      setError('Connect wallet first');
      return;
    }
    setLoading(prev => ({ ...prev, createTreasury: true }));
    setError(null);
    try {
      const depositMist = BigInt(Math.floor(parseFloat(newTreasuryDeposit) * 1e9));
      const tx = new Transaction();
      tx.setGasBudget(10_000_000);
      const [payment] = tx.splitCoins(tx.gas, [tx.pure.u64(depositMist)]);
      const policy = tx.moveCall({
        target: `${PACKAGE_ID}::agent_treasury::create_policy`,
        arguments: [
          tx.pure.u64(5_000_000n),
          tx.pure.u64(50_000_000n),
          tx.pure.u64(1_000_000n),
          tx.pure.vector('string', ['groq']),
          tx.pure.u64(5),
        ],
      });
      tx.moveCall({
        target: `${PACKAGE_ID}::agent_treasury::create_master_treasury`,
        arguments: [
          payment,
          tx.pure.string(newTreasuryName || 'Master Treasury'),
          policy,
          tx.object('0x6'),
        ],
      });
      signAndExecute(
        { transaction: tx },
        {
          onSuccess: async () => {
            setError(null);
            setNewTreasuryName('');
            await new Promise(r => setTimeout(r, 3000));
            await refreshTreasuries();
            await fetchOwnerCaps();
            setLoading(prev => ({ ...prev, createTreasury: false }));
          },
          onError: (err: any) => {
            setError('Create treasury failed: ' + err.message);
            setLoading(prev => ({ ...prev, createTreasury: false }));
          },
        }
      );
    } catch (err: any) {
      setError('Error: ' + err.message);
      setLoading(prev => ({ ...prev, createTreasury: false }));
    }
  };

  // ── SPAWN CHILD AGENT ─────────────────────────────────────────────────────
  const handleSpawnChild = async () => {
    if (!wallet || !spawnParentId) {
      setError('Select a parent treasury');
      return;
    }
    const parentCapId = ownerCaps[spawnParentId];
    if (!parentCapId) {
      setError('TreasuryOwnerCap not found. Wait for sync or refresh.');
      return;
    }
    setLoading(prev => ({ ...prev, spawnChild: true }));
    setError(null);
    try {
      const budgetMist = BigInt(Math.floor(parseFloat(spawnBudget) * 1e9));
      const tx = new Transaction();
      tx.setGasBudget(10_000_000);
      const childPolicy = tx.moveCall({
        target: `${PACKAGE_ID}::agent_treasury::create_policy`,
        arguments: [
          tx.pure.u64(BigInt(spawnDailyCap)),
          tx.pure.u64(BigInt(spawnDailyCap) * 10n),
          tx.pure.u64(BigInt(spawnDailyCap) / 5n),
          tx.pure.vector('string', spawnProviders),
          tx.pure.u64(3),
        ],
      });
      tx.moveCall({
        target: `${PACKAGE_ID}::agent_treasury::spawn_child_agent`,
        arguments: [
          tx.object(parentCapId),
          tx.object(spawnParentId),
          tx.pure.u64(budgetMist),
          tx.pure.string(spawnName || 'Child Agent'),
          childPolicy,
          tx.object('0x6'),
        ],
      });
      signAndExecute(
        { transaction: tx },
        {
          onSuccess: async () => {
            setError(null);
            setSpawnName('');
            setSpawnBudget('0.01');
            setSpawnParentId('');
            await new Promise(r => setTimeout(r, 3000));
            await refreshTreasuries();
            await fetchOwnerCaps();
            setLoading(prev => ({ ...prev, spawnChild: false }));
          },
          onError: (err: any) => {
            setError('Spawn failed: ' + err.message);
            setLoading(prev => ({ ...prev, spawnChild: false }));
          },
        }
      );
    } catch (err: any) {
      setError('Error: ' + err.message);
      setLoading(prev => ({ ...prev, spawnChild: false }));
    }
  };

  // ── RECLAIM CHILD ─────────────────────────────────────────────────────────
  const handleReclaimChild = async (parentId: string, childId: string) => {
    if (!wallet) return;
    const parentCapId = ownerCaps[parentId];
    if (!parentCapId) {
      setError('TreasuryOwnerCap not found for parent.');
      return;
    }
    setLoading(prev => ({ ...prev, [`reclaim_${childId}`]: true }));
    setError(null);
    try {
      const tx = new Transaction();
      tx.setGasBudget(10_000_000);
      tx.moveCall({
        target: `${PACKAGE_ID}::agent_treasury::reclaim_child_budget`,
        arguments: [
          tx.object(parentCapId),
          tx.object(parentId),
          tx.object(childId),
          tx.object('0x6'),
        ],
      });
      signAndExecute(
        { transaction: tx },
        {
          onSuccess: async () => {
            await new Promise(r => setTimeout(r, 3000));
            await refreshTreasuries();
            await fetchOwnerCaps();
            setLoading(prev => ({ ...prev, [`reclaim_${childId}`]: false }));
          },
          onError: (err: any) => {
            setError('Reclaim failed: ' + err.message);
            setLoading(prev => ({ ...prev, [`reclaim_${childId}`]: false }));
          },
        }
      );
    } catch (err: any) {
      setError('Error: ' + err.message);
      setLoading(prev => ({ ...prev, [`reclaim_${childId}`]: false }));
    }
  };

  // ── CREATE API KEY ────────────────────────────────────────────────────────
  const handleCreateKey = async (
    treasuryId: string,
    label: string,
    allowResume: boolean
  ): Promise<string | null> => {
    if (!wallet) return null;
    setLoading(prev => ({ ...prev, [`key_${treasuryId}`]: true }));
    try {
      const res = await fetch(`${GATEWAY_URL}/keys/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet,
          treasuryId,
          label: label || 'default',
          allowResume,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.status === 'success') {
        await refreshApiKeys();
        return data.key;
      } else {
        setError(data.error || 'Failed to create key');
        return null;
      }
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(prev => ({ ...prev, [`key_${treasuryId}`]: false }));
    }
  };

  // ── PARALLEL DEMO ────────────────────────────────────────────────────────
  const handleParallelCall = async (treasuryId: string, prompt: string, index: number) => {
    if (!prompt.trim()) return null;
    const activeKey = apiKeys.find(k => k.treasuryId === treasuryId && !k.revoked);
    if (!activeKey) {
      setError(`No active API key for agent ${index + 1}`);
      return null;
    }
    try {
      const res = await fetch(`${GATEWAY_URL}/v1/chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${activeKey.key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [{ role: 'user', content: prompt.trim() }],
          temperature: 0.7,
          max_tokens: 256,
        }),
      });
      const data = await res.json();
      return { index, ...data, error: data.error || null };
    } catch (err: any) {
      return { index, error: err.message };
    }
  };

  const handleExecuteAll = async () => {
    setParallelLoading(true);
    setParallelResults([]);
    setError(null);
    const eligibleTreasuries = treasuries
      .flatMap(t => [t, ...t.children])
      .filter(t => apiKeys.some(k => k.treasuryId === t.id && !k.revoked))
      .slice(0, 3);
    if (eligibleTreasuries.length === 0) {
      setError('No agents with active API keys. Create keys first.');
      setParallelLoading(false);
      return;
    }
    const prompts = [prompt1, prompt2, prompt3];
    const results = await Promise.all(
      eligibleTreasuries.map((t, i) =>
        handleParallelCall(t.id, prompts[i] || 'Hello', i)
      )
    );
    setParallelResults(results.filter(Boolean));
    setParallelLoading(false);
  };

  // ── STYLES (injected once) ────────────────────────────────────────────────
  const globalStyles = `
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes slideIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    * { box-sizing: border-box; }
    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; -webkit-font-smoothing: antialiased; }
    input:focus, textarea:focus { outline: none; }
    button { font-family: inherit; }
    button:active:not(:disabled) { transform: translateY(1px); }
  `;

  // ── LOCAL CARD/SECTION STYLES ─────────────────────────────────────────────
  const cardStyle = {
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 12,
    padding: 28,
    boxShadow: C.shadow,
    transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
  };
  const sectionTitleStyle = {
    fontSize: 15,
    fontWeight: 600,
    color: C.tealDark,
    marginBottom: 4,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    letterSpacing: '-0.01em',
  };
  const sectionSubtitleStyle = {
    fontSize: 13,
    color: C.textSecondary,
    marginBottom: 20,
    lineHeight: 1.5,
  };

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{globalStyles}</style>
      <div style={{
        minHeight: '100vh',
        background: C.bg,
        color: C.text,
        paddingBottom: 80,
      }}>
        {/* ── HEADER ─────────────────────────────────────────────────────── */}
        <header style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: 'rgba(245,247,249,0.85)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: `1px solid ${C.border}`,
        }}>
          <div style={{
            maxWidth: 1120,
            margin: '0 auto',
            padding: '14px 32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <img
                src="/logo.jpg"
                alt="Otter"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  objectFit: 'contain',
                }}
              />
              <div>
                <div style={{
                  fontSize: 17,
                  fontWeight: 700,
                  color: C.tealDark,
                  letterSpacing: '-0.02em',
                  lineHeight: 1,
                }}>
                  OTTER
                </div>
                <div style={{
                  fontSize: 11,
                  color: C.textMuted,
                  marginTop: 2,
                  fontWeight: 500,
                }}>
                  Autonomous Agent Treasury Protocol
                </div>
              </div>
            </div>
            <div style={{
              padding: 4,
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 10,
            }}>
              <ConnectButton />
            </div>
          </div>
        </header>

        {/* ── MAIN ───────────────────────────────────────────────────────── */}
        <main style={{
          maxWidth: 1120,
          margin: '0 auto',
          padding: '32px 32px 0',
        }}>
          {/* Error banner */}
          {error && (
            <div style={{
              ...cardStyle,
              background: C.dangerBg,
              borderColor: C.dangerBorder,
              padding: '14px 18px',
              marginBottom: 24,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              animation: 'slideIn 0.2s ease',
            }}>
              <div style={{ color: C.danger, flexShrink: 0 }}>
                <Icon.Alert />
              </div>
              <div style={{ flex: 1, fontSize: 13, color: '#991b1b', fontWeight: 500 }}>
                {error}
              </div>
              <button
                onClick={() => setError(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: C.danger,
                  cursor: 'pointer',
                  padding: 4,
                  borderRadius: 4,
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(220,38,38,0.08)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <Icon.X />
              </button>
            </div>
          )}

          {wallet && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

              {/* ── CREATE MASTER TREASURY ─────────────────────────────── */}
              <section style={cardStyle}>
                <div style={sectionTitleStyle}>
                  <Icon.Landmark style={{ color: C.teal }} />
                  Create Master Treasury
                </div>
                <div style={sectionSubtitleStyle}>
                  Initialize a shared Sui object with your deposit. You receive a TreasuryOwnerCap for governance.
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div style={{ flex: '1 1 240px', minWidth: 200 }}>
                    <label style={labelStyle}>Treasury Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Production Treasury"
                      value={newTreasuryName}
                      onChange={e => setNewTreasuryName(e.target.value)}
                      style={{ ...inputStyle, width: '100%' }}
                      onFocus={e => Object.assign(e.currentTarget.style, { borderColor: C.teal, boxShadow: C.shadowFocus })}
                      onBlur={e => Object.assign(e.currentTarget.style, { borderColor: C.border, boxShadow: 'none' })}
                    />
                  </div>
                  <div style={{ width: 140 }}>
                    <label style={labelStyle}>Deposit (SUI)</label>
                    <input
                      type="number"
                      placeholder="0.05"
                      value={newTreasuryDeposit}
                      onChange={e => setNewTreasuryDeposit(e.target.value)}
                      step="0.01"
                      min="0.001"
                      style={{ ...inputStyle, width: '100%' }}
                      onFocus={e => Object.assign(e.currentTarget.style, { borderColor: C.teal, boxShadow: C.shadowFocus })}
                      onBlur={e => Object.assign(e.currentTarget.style, { borderColor: C.border, boxShadow: 'none' })}
                    />
                  </div>
                  <button
                    onClick={handleCreateTreasury}
                    disabled={loading.createTreasury}
                    style={loading.createTreasury ? btnPrimaryDisabled : btnPrimary}
                    onMouseEnter={e => { if (!loading.createTreasury) { e.currentTarget.style.background = C.tealDark; e.currentTarget.style.boxShadow = C.shadowMd; } }}
                    onMouseLeave={e => { if (!loading.createTreasury) { e.currentTarget.style.background = C.teal; e.currentTarget.style.boxShadow = 'none'; } }}
                  >
                    {loading.createTreasury ? (
                      <>
                        <Icon.Spinner />
                        Creating…
                      </>
                    ) : (
                      <>
                        <Icon.Plus />
                        Create Treasury
                      </>
                    )}
                  </button>
                </div>
              </section>

              {/* ── TREASURY TREE ──────────────────────────────────────── */}
              <section style={cardStyle}>
                <div style={sectionTitleStyle}>
                  <Icon.Network style={{ color: C.teal }} />
                  Agent Treasury Tree
                </div>
                <div style={sectionSubtitleStyle}>
                  Hierarchical view of your treasuries. Master treasuries can spawn child agents with isolated budgets.
                </div>
                {treasuries.length === 0 ? (
                  <div style={{
                    padding: '32px 0',
                    textAlign: 'center',
                    color: C.textMuted,
                    fontSize: 13,
                    border: `1px dashed ${C.border}`,
                    borderRadius: 8,
                  }}>
                    No treasuries yet. Create one above to get started.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {treasuries.map(master => (
                      <TreasuryTreeNode
                        key={master.id}
                        node={master}
                        onSpawn={setSpawnParentId}
                        onReclaim={handleReclaimChild}
                        onCreateKey={handleCreateKey}
                        onSelect={setSelectedTreasury}
                        selected={selectedTreasury}
                        loading={loading}
                        apiKeys={apiKeys}
                      />
                    ))}
                  </div>
                )}
              </section>

              {/* ── SPAWN CHILD MODAL ──────────────────────────────────── */}
              {spawnParentId && (
                <section style={{
                  ...cardStyle,
                  borderColor: C.teal,
                  borderWidth: 1.5,
                  animation: 'slideIn 0.2s ease',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
                    <div>
                      <div style={sectionTitleStyle}>
                        <Icon.Bot style={{ color: C.brown }} />
                        Spawn Child Agent
                      </div>
                      <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4, fontFamily: 'monospace' }}>
                        Parent: {spawnParentId.slice(0, 10)}…{spawnParentId.slice(-6)}
                      </div>
                    </div>
                    <button
                      onClick={() => setSpawnParentId('')}
                      style={{
                        background: 'transparent',
                        border: `1px solid ${C.border}`,
                        color: C.textSecondary,
                        padding: '6px 10px',
                        borderRadius: 6,
                        cursor: 'pointer',
                        fontSize: 12,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = C.borderStrong; e.currentTarget.style.color = C.text; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textSecondary; }}
                    >
                      <Icon.X />
                      Close
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 18 }}>
                    <div>
                      <label style={labelStyle}>Agent Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Research Agent"
                        value={spawnName}
                        onChange={e => setSpawnName(e.target.value)}
                        style={{ ...inputStyle, width: '100%' }}
                        onFocus={e => Object.assign(e.currentTarget.style, { borderColor: C.teal, boxShadow: C.shadowFocus })}
                        onBlur={e => Object.assign(e.currentTarget.style, { borderColor: C.border, boxShadow: 'none' })}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Budget (SUI)</label>
                      <input
                        type="number"
                        placeholder="0.01"
                        value={spawnBudget}
                        onChange={e => setSpawnBudget(e.target.value)}
                        step="0.001"
                        style={{ ...inputStyle, width: '100%' }}
                        onFocus={e => Object.assign(e.currentTarget.style, { borderColor: C.teal, boxShadow: C.shadowFocus })}
                        onBlur={e => Object.assign(e.currentTarget.style, { borderColor: C.border, boxShadow: 'none' })}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Daily Cap (MIST)</label>
                      <input
                        type="number"
                        placeholder="5000000"
                        value={spawnDailyCap}
                        onChange={e => setSpawnDailyCap(e.target.value)}
                        style={{ ...inputStyle, width: '100%' }}
                        onFocus={e => Object.assign(e.currentTarget.style, { borderColor: C.teal, boxShadow: C.shadowFocus })}
                        onBlur={e => Object.assign(e.currentTarget.style, { borderColor: C.border, boxShadow: 'none' })}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => setSpawnParentId('')}
                      style={btnSecondary}
                      onMouseEnter={e => { e.currentTarget.style.background = C.surfaceHover; }}
                      onMouseLeave={e => { e.currentTarget.style.background = C.surface; }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSpawnChild}
                      disabled={loading.spawnChild}
                      style={loading.spawnChild ? btnPrimaryDisabled : btnPrimary}
                      onMouseEnter={e => { if (!loading.spawnChild) { e.currentTarget.style.background = C.tealDark; e.currentTarget.style.boxShadow = C.shadowMd; } }}
                      onMouseLeave={e => { if (!loading.spawnChild) { e.currentTarget.style.background = C.teal; e.currentTarget.style.boxShadow = 'none'; } }}
                    >
                      {loading.spawnChild ? (
                        <>
                          <Icon.Spinner />
                          Spawning…
                        </>
                      ) : (
                        <>
                          <Icon.Plus />
                          Spawn Agent
                        </>
                      )}
                    </button>
                  </div>
                </section>
              )}

              {/* ── PARALLEL EXECUTION ─────────────────────────────────── */}
              <section style={cardStyle}>
                <div style={sectionTitleStyle}>
                  <Icon.Zap style={{ color: C.brown }} />
                  Parallel Agent Execution
                </div>
                <div style={sectionSubtitleStyle}>
                  Fire prompts to multiple agents simultaneously. Each agent spends from its own object-held balance.
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 18 }}>
                  {[
                    { value: prompt1, set: setPrompt1, idx: 0 },
                    { value: prompt2, set: setPrompt2, idx: 1 },
                    { value: prompt3, set: setPrompt3, idx: 2 },
                  ].map(({ value, set, idx }) => {
                    const totalAgents = treasuries.flatMap(t => [t, ...t.children]).length;
                    const hasAgent = idx < totalAgents;
                    return (
                      <div key={idx}>
                        <label style={labelStyle}>
                          Agent {idx + 1}
                          <span style={{
                            marginLeft: 6,
                            color: hasAgent ? C.success : C.textMuted,
                            fontWeight: 500,
                          }}>
                            {hasAgent ? '● Ready' : '○ Unassigned'}
                          </span>
                        </label>
                        <textarea
                          value={value}
                          onChange={e => set(e.target.value)}
                          placeholder={`Prompt for agent ${idx + 1}…`}
                          rows={3}
                          style={{
                            ...inputStyle,
                            width: '100%',
                            resize: 'vertical',
                            fontFamily: 'inherit',
                            lineHeight: 1.5,
                          }}
                          onFocus={e => Object.assign(e.currentTarget.style, { borderColor: C.teal, boxShadow: C.shadowFocus })}
                          onBlur={e => Object.assign(e.currentTarget.style, { borderColor: C.border, boxShadow: 'none' })}
                        />
                      </div>
                    );
                  })}
                </div>
                <button
                  onClick={handleExecuteAll}
                  disabled={parallelLoading}
                  style={{
                    ...(parallelLoading ? btnPrimaryDisabled : btnPrimary),
                    padding: '12px 24px',
                    fontSize: 14,
                  }}
                  onMouseEnter={e => { if (!parallelLoading) { e.currentTarget.style.background = C.tealDark; e.currentTarget.style.boxShadow = C.shadowMd; } }}
                  onMouseLeave={e => { if (!parallelLoading) { e.currentTarget.style.background = C.teal; e.currentTarget.style.boxShadow = 'none'; } }}
                >
                  {parallelLoading ? (
                    <>
                      <Icon.Spinner />
                      Executing…
                    </>
                  ) : (
                    <>
                      <Icon.Zap />
                      Execute All Agents
                    </>
                  )}
                </button>

                {parallelResults.length > 0 && (
                  <div style={{
                    marginTop: 20,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 12,
                    animation: 'fadeIn 0.3s ease',
                  }}>
                    {parallelResults.map((result, i) => (
                      <div
                        key={i}
                        style={{
                          padding: 14,
                          background: C.surface,
                          borderRadius: 8,
                          border: `1px solid ${result.error ? C.dangerBorder : C.successBorder}`,
                          animation: 'slideIn 0.25s ease',
                        }}
                      >
                        <div style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: C.textMuted,
                          marginBottom: 8,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}>
                          Agent {result.index + 1}
                        </div>
                        {result.error ? (
                          <div style={{ color: C.danger, fontSize: 12, lineHeight: 1.5 }}>
                            {result.error}
                          </div>
                        ) : (
                          <div>
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              color: C.success,
                              fontSize: 12,
                              fontWeight: 600,
                              marginBottom: 6,
                            }}>
                              <Icon.Check />
                              Success
                            </div>
                            <div style={{
                              fontSize: 12,
                              color: C.textSecondary,
                              lineHeight: 1.5,
                              marginBottom: 8,
                            }}>
                              {result.content?.slice(0, 120)}
                              {(result.content?.length || 0) > 120 ? '…' : ''}
                            </div>
                            <div style={{
                              fontSize: 11,
                              color: C.textMuted,
                              fontFamily: 'monospace',
                              background: C.bg,
                              padding: '4px 8px',
                              borderRadius: 4,
                              display: 'inline-block',
                            }}>
                              Cost: {result.cost?.actual} MIST
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* ── API KEYS ───────────────────────────────────────────── */}
              <section style={cardStyle}>
                <div style={sectionTitleStyle}>
                  <Icon.Key style={{ color: C.teal }} />
                  API Keys
                </div>
                <div style={sectionSubtitleStyle}>
                  Manage access credentials for your treasury agents. Each key is scoped to a specific treasury object.
                </div>
                {apiKeys.length === 0 ? (
                  <div style={{
                    padding: '32px 0',
                    textAlign: 'center',
                    color: C.textMuted,
                    fontSize: 13,
                    border: `1px dashed ${C.border}`,
                    borderRadius: 8,
                  }}>
                    No API keys yet. Create one from a treasury node above.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {apiKeys.map((k, i) => (
                      <div
                        key={i}
                        style={{
                          padding: '14px 16px',
                          background: C.surfaceHover,
                          border: `1px solid ${C.border}`,
                          borderRadius: 8,
                          fontSize: 13,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          transition: 'border-color 0.15s ease',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = C.borderStrong)}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontFamily: 'monospace',
                            color: C.text,
                            fontSize: 12,
                            fontWeight: 500,
                            marginBottom: 4,
                          }}>
                            {k.key.slice(0, 28)}…
                          </div>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            fontSize: 11,
                            color: C.textMuted,
                            flexWrap: 'wrap',
                          }}>
                            <span>{k.label}</span>
                            <span style={{ fontFamily: 'monospace', fontSize: 10 }}>
                              {k.treasuryId.slice(0, 10)}…{k.treasuryId.slice(-6)}
                            </span>
                            {k.allowResume && (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                color: C.success,
                                fontWeight: 500,
                              }}>
                                <Icon.Circle />
                                Resume enabled
                              </span>
                            )}
                            {k.revoked && (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                color: C.danger,
                                fontWeight: 500,
                              }}>
                                <Icon.Pause />
                                Revoked
                              </span>
                            )}
                          </div>
                        </div>
                        <div style={{ fontSize: 11, color: C.textMuted, flexShrink: 0, marginLeft: 16 }}>
                          {formatDate(k.createdAt)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{
                  marginTop: 20,
                  padding: 16,
                  background: C.tealDark,
                  borderRadius: 8,
                  overflow: 'hidden',
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    color: C.tealMuted,
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: 10,
                  }}>
                    <Icon.Terminal />
                    Example Request
                  </div>
                  <pre style={{
                    margin: 0,
                    fontSize: 11,
                    color: '#e2e8f0',
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                    lineHeight: 1.6,
                    overflowX: 'auto',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                  }}>
{`curl -X POST ${GATEWAY_URL}/v1/chat \\
  -H "Authorization: Bearer otter_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "llama-3.1-8b-instant",
    "messages": [{"role": "user", "content": "Hello"}]
  }'`}
                  </pre>
                </div>
              </section>

            </div>
          )}
        </main>
      </div>
    </>
  );
}

// ── TREASURY TREE NODE ──────────────────────────────────────────────────────
function TreasuryTreeNode({
  node,
  onSpawn,
  onReclaim,
  onCreateKey,
  onSelect,
  selected,
  loading,
  apiKeys,
}: any) {
  const isSelected = selected === node.id;
  const [keyLabel, setKeyLabel] = useState('');
  const [allowResume, setAllowResume] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [hovered, setHovered] = useState(false);
  const nodeKeys = apiKeys.filter((k: any) => k.treasuryId === node.id && !k.revoked);
  const isChild = !!node.parent;

  const cardBase = {
    background: isSelected ? C.tealLight : C.surface,
    border: `1px solid ${isSelected ? C.teal : C.border}`,
    borderRadius: 10,
    padding: 18,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    boxShadow: hovered && !isSelected ? C.shadowMd : C.shadow,
  };

  return (
    <div style={{
      marginLeft: isChild ? 28 : 0,
      borderLeft: isChild ? `2px solid ${C.border}` : 'none',
      paddingLeft: isChild ? 16 : 0,
      position: 'relative',
    }}>
      {isChild && (
        <div style={{
          position: 'absolute',
          left: -2,
          top: 28,
          width: 16,
          height: 2,
          background: C.border,
        }} />
      )}
      <div
        onClick={() => onSelect(isSelected ? null : node.id)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={cardBase}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 16,
          marginBottom: 14,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontWeight: 600,
              fontSize: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: C.tealDark,
              letterSpacing: '-0.01em',
            }}>
              {isChild ? (
                <Icon.Bot style={{ color: C.brown }} />
              ) : (
                <Icon.Landmark style={{ color: C.teal }} />
              )}
              {node.name}
              {node.paused && (
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  background: C.dangerBg,
                  color: C.danger,
                  padding: '2px 8px',
                  borderRadius: 4,
                  fontSize: 10,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}>
                  <Icon.Pause />
                  Paused
                </span>
              )}
            </div>
            <div style={{
              fontFamily: 'ui-monospace, monospace',
              fontSize: 11,
              color: C.textMuted,
              marginTop: 4,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {node.id}
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{
              fontSize: 22,
              fontWeight: 700,
              color: C.teal,
              letterSpacing: '-0.02em',
              lineHeight: 1,
            }}>
              {formatSui(node.balance)}
              <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 500, marginLeft: 4 }}>
                SUI
              </span>
            </div>
            <a
              href={`${SUI_SCAN}/${node.id}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              style={{
                fontSize: 11,
                color: C.teal,
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                marginTop: 6,
                fontWeight: 500,
                transition: 'color 0.15s ease',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = C.tealDark)}
              onMouseLeave={e => (e.currentTarget.style.color = C.teal)}
            >
              SuiScan
              <Icon.ExternalLink />
            </a>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {!isChild && (
            <button
              onClick={e => { e.stopPropagation(); onSpawn(node.id); }}
              style={{
                ...btnPrimary,
                padding: '7px 12px',
                fontSize: 12,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = C.tealDark; }}
              onMouseLeave={e => { e.currentTarget.style.background = C.teal; }}
            >
              <Icon.Plus />
              Spawn Child
            </button>
          )}
          {isChild && (
            <button
              onClick={e => { e.stopPropagation(); onReclaim(node.parent, node.id); }}
              disabled={loading[`reclaim_${node.id}`]}
              style={loading[`reclaim_${node.id}`] ? btnDangerDisabled : btnDanger}
              onMouseEnter={e => { if (!loading[`reclaim_${node.id}`]) { e.currentTarget.style.background = '#fee2e2'; } }}
              onMouseLeave={e => { if (!loading[`reclaim_${node.id}`]) { e.currentTarget.style.background = C.dangerBg; } }}
            >
              {loading[`reclaim_${node.id}`] ? (
                <>
                  <Icon.Spinner />
                  Reclaiming…
                </>
              ) : (
                <>
                  <Icon.Undo />
                  Reclaim
                </>
              )}
            </button>
          )}
          <button
            onClick={async e => {
              e.stopPropagation();
              const key = await onCreateKey(node.id, keyLabel, allowResume);
              if (key) {
                setNewKey(key);
                setKeyLabel('');
                setAllowResume(false);
              }
            }}
            disabled={loading[`key_${node.id}`]}
            style={{
              ...(loading[`key_${node.id}`] ? btnPrimaryDisabled : {
                ...btnBase,
                background: C.surface,
                color: C.teal,
                border: `1px solid ${C.teal}`,
              }),
              padding: '7px 12px',
              fontSize: 12,
            }}
            onMouseEnter={e => {
              if (!loading[`key_${node.id}`]) {
                e.currentTarget.style.background = C.tealLight;
              }
            }}
            onMouseLeave={e => {
              if (!loading[`key_${node.id}`]) {
                e.currentTarget.style.background = C.surface;
              }
            }}
          >
            {loading[`key_${node.id}`] ? (
              <>
                <Icon.Spinner />
                Creating…
              </>
            ) : (
              <>
                <Icon.Key />
                Create Key
              </>
            )}
          </button>
        </div>

        {isSelected && (
          <div
            onClick={e => e.stopPropagation()}
            style={{
              marginTop: 14,
              padding: 14,
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              animation: 'slideIn 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Key label"
                value={keyLabel}
                onChange={e => setKeyLabel(e.target.value)}
                onClick={e => e.stopPropagation()}
                style={{ ...inputStyle, flex: 1 }}
                onFocus={e => Object.assign(e.currentTarget.style, { borderColor: C.teal, boxShadow: C.shadowFocus })}
                onBlur={e => Object.assign(e.currentTarget.style, { borderColor: C.border, boxShadow: 'none' })}
              />
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                color: C.textSecondary,
                cursor: 'pointer',
                userSelect: 'none',
                padding: '8px 12px',
                background: C.surfaceHover,
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                transition: 'border-color 0.15s ease',
              }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = C.borderStrong)}
                onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}
              >
                <input
                  type="checkbox"
                  checked={allowResume}
                  onChange={e => setAllowResume(e.target.checked)}
                  onClick={e => e.stopPropagation()}
                  style={{ accentColor: C.teal }}
                />
                Allow resume
              </label>
            </div>

            {newKey && (
              <div style={{
                background: C.successBg,
                border: `1px solid ${C.successBorder}`,
                padding: 12,
                borderRadius: 6,
                animation: 'slideIn 0.2s ease',
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  color: C.success,
                  fontWeight: 600,
                  fontSize: 12,
                  marginBottom: 6,
                }}>
                  <Icon.Lock />
                  API Key Created
                </div>
                <div style={{
                  fontFamily: 'ui-monospace, monospace',
                  fontSize: 11,
                  wordBreak: 'break-all',
                  color: C.text,
                  background: C.surface,
                  padding: 8,
                  borderRadius: 4,
                  border: `1px solid ${C.border}`,
                  marginBottom: 8,
                }}>
                  {newKey}
                </div>
                <button
                  onClick={() => {
                    copyToClipboard(newKey!);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  style={{
                    ...btnBase,
                    padding: '5px 10px',
                    fontSize: 11,
                    background: C.success,
                    color: '#fff',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#047857')}
                  onMouseLeave={e => (e.currentTarget.style.background = C.success)}
                >
                  {copied ? (
                    <>
                      <Icon.Check />
                      Copied
                    </>
                  ) : (
                    <>
                      <Icon.Copy />
                      Copy
                    </>
                  )}
                </button>
              </div>
            )}

            {nodeKeys.length > 0 && (
              <div style={{
                fontSize: 11,
                color: C.textMuted,
                marginTop: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}>
                <Icon.Circle style={{ color: C.success }} />
                {nodeKeys.length} active key{nodeKeys.length > 1 ? 's' : ''}
              </div>
            )}
          </div>
        )}
      </div>

      {node.children?.length > 0 && (
        <div style={{ marginTop: 12 }}>
          {node.children.map((child: any) => (
            <TreasuryTreeNode
              key={child.id}
              node={child}
              onSpawn={onSpawn}
              onReclaim={onReclaim}
              onCreateKey={onCreateKey}
              onSelect={onSelect}
              selected={selected}
              loading={loading}
              apiKeys={apiKeys}
            />
          ))}
        </div>
      )}
    </div>
  );
}
