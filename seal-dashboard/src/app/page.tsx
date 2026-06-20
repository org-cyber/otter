'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ConnectButton,
  useCurrentAccount,
  useSignAndExecuteTransaction,
} from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';

const GATEWAY_URL = 'http://localhost:3001';
const SUI_SCAN = 'https://suiscan.xyz/testnet/object';


const PACKAGE_ID = '0xdbfb39eabe0938cb1495443b733e00bd90799a6d5ea870227d9f0e426091b480';



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

// ── UTILITY ─────────────────────────────────────────────────────────────────

function formatSui(mist: string): string {
  return (Number(mist) / 1e9).toFixed(6);
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString();
}

function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}

// ── COMPONENT ─────────────────────────────────────────────────────────────

export default function Home() {
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const wallet = account?.address;

  const [treasuries, setTreasuries] = useState<TreasuryNode[]>([]);
  const [selectedTreasury, setSelectedTreasury] = useState<string | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKeyRecord[]>([]);
  const [providers, setProviders] = useState<Record<string, ProviderInfo>>({});
  const [ownerCaps, setOwnerCaps] = useState<Record<string, string>>({}); // treasuryId -> capObjectId
  
  const [newTreasuryName, setNewTreasuryName] = useState('');
  const [newTreasuryDeposit, setNewTreasuryDeposit] = useState('0.05');
  
  const [spawnParentId, setSpawnParentId] = useState('');
  const [spawnName, setSpawnName] = useState('');
  const [spawnBudget, setSpawnBudget] = useState('0.01');
  const [spawnDailyCap, setSpawnDailyCap] = useState('5000000');
  const [spawnProviders, setSpawnProviders] = useState<string[]>(['groq']);
  
  const [newKeyLabel, setNewKeyLabel] = useState('');
  const [allowKeyResume, setAllowKeyResume] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  
  const [prompt1, setPrompt1] = useState('');
  const [prompt2, setPrompt2] = useState('');
  const [prompt3, setPrompt3] = useState('');
  const [parallelResults, setParallelResults] = useState<any[]>([]);
  const [parallelLoading, setParallelLoading] = useState(false);
  
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // ── FETCH OWNER CAPS ───────────────────────────────────────────────────────

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

  // ── REFRESH FUNCTIONS ────────────────────────────────────────────────────

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

  // ── POLLING ──────────────────────────────────────────────────────────────

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

  // ── CREATE MASTER TREASURY ─────────────────────────────────────────────

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
          onError: (err) => {
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

  // ── SPAWN CHILD AGENT ──────────────────────────────────────────────────

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

      const parentCap = tx.object(parentCapId);
      const parentTreasury = tx.object(spawnParentId);

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
          parentCap,
          parentTreasury,
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
          onError: (err) => {
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

  // ── RECLAIM CHILD ────────────────────────────────────────────────────────

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

      const parentCap = tx.object(parentCapId);
      const parentTreasury = tx.object(parentId);
      const childTreasury = tx.object(childId);

      tx.moveCall({
        target: `${PACKAGE_ID}::agent_treasury::reclaim_child_budget`,
        arguments: [
          parentCap,
          parentTreasury,
          childTreasury,
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
          onError: (err) => {
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

  // ── CREATE API KEY ─────────────────────────────────────────────────────

  const handleCreateKey = async (treasuryId: string) => {
    if (!wallet) return;
    setLoading(prev => ({ ...prev, [`key_${treasuryId}`]: true }));
    setNewKey(null);

    try {
      const res = await fetch(`${GATEWAY_URL}/keys/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet,
          treasuryId,
          label: newKeyLabel || 'default',
          allowResume: allowKeyResume,
        }),
      });
      const data = await res.json();
      if (data.status === 'success') {
        setNewKey(data.key);
        setNewKeyLabel('');
        setAllowKeyResume(false);
        await refreshApiKeys();
      } else {
        setError('Failed to create key: ' + (data.error || 'Unknown error'));
      }
    } catch (err: any) {
      setError('Error: ' + err.message);
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

  // ── RENDER ───────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: 40, background: '#0a0a0a', minHeight: '100vh', color: '#fff' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 36, marginBottom: 4, fontWeight: 800 }}>OTTER</h1>
        <p style={{ color: '#888', fontSize: 14 }}>
          Autonomous Agent Treasury Protocol. One API key. Multiple agents. On-chain objects.
        </p>
      </div>

      <div style={{ marginBottom: 32 }}>
        <ConnectButton />
      </div>

      {error && (
        <div style={{
          background: '#331111', border: '1px solid #ff4444', padding: 16, borderRadius: 8,
          marginBottom: 24, color: '#ff8888', fontSize: 14,
        }}>
          ⚠️ {error}
          <button onClick={() => setError(null)} style={{ float: 'right', background: 'transparent', border: 'none', color: '#ff8888', cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>
      )}

      {wallet && (
        <div>
          {/* Create Master Treasury */}
          <div style={{ background: '#111', padding: 24, borderRadius: 12, marginBottom: 24 }}>
            <h2 style={{ fontSize: 18, marginBottom: 16 }}>🏦 Create Master Treasury</h2>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <input
                type="text" placeholder="Treasury name" value={newTreasuryName}
                onChange={(e) => setNewTreasuryName(e.target.value)}
                style={{ flex: 1, minWidth: 200, padding: 10, background: '#1a1a1a', border: '1px solid #333', borderRadius: 6, color: '#fff', fontSize: 13 }}
              />
              <input
                type="number" placeholder="Deposit (SUI)" value={newTreasuryDeposit}
                onChange={(e) => setNewTreasuryDeposit(e.target.value)} step="0.01" min="0.001"
                style={{ width: 120, padding: 10, background: '#1a1a1a', border: '1px solid #333', borderRadius: 6, color: '#fff', fontSize: 13 }}
              />
              <button
                onClick={handleCreateTreasury} disabled={loading.createTreasury}
                style={{ padding: '10px 20px', fontSize: 14, fontWeight: 'bold', background: loading.createTreasury ? '#333' : '#00d4aa', color: '#000', border: 'none', borderRadius: 6, cursor: loading.createTreasury ? 'not-allowed' : 'pointer' }}
              >
                {loading.createTreasury ? 'Creating...' : 'Create Treasury'}
              </button>
            </div>
            <p style={{ color: '#666', fontSize: 12 }}>Creates a shared Sui object with your deposit. You get a TreasuryOwnerCap.</p>
          </div>

          {/* Treasury Tree */}
          <div style={{ background: '#111', padding: 24, borderRadius: 12, marginBottom: 24 }}>
            <h2 style={{ fontSize: 18, marginBottom: 16 }}>🌳 Agent Treasury Tree</h2>
            {treasuries.length === 0 ? (
              <p style={{ color: '#888' }}>No treasuries yet. Create one above.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {treasuries.map(master => (
                  <TreasuryTreeNode key={master.id} node={master} onSpawn={setSpawnParentId} onReclaim={handleReclaimChild}
                    onCreateKey={handleCreateKey} onSelect={setSelectedTreasury} selected={selectedTreasury}
                    loading={loading} newKey={newKey} copiedKey={copiedKey} setCopiedKey={setCopiedKey}
                    apiKeys={apiKeys} newKeyLabel={newKeyLabel} setNewKeyLabel={setNewKeyLabel}
                    allowKeyResume={allowKeyResume} setAllowKeyResume={setAllowKeyResume} setNewKey={setNewKey}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Spawn Child Modal */}
          {spawnParentId && (
            <div style={{ background: '#111', padding: 24, borderRadius: 12, marginBottom: 24, border: '1px solid #00d4aa33' }}>
              <h3 style={{ fontSize: 16, marginBottom: 12, color: '#00d4aa' }}>
                Spawn Child Agent from {spawnParentId.slice(0, 16)}...
              </h3>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                <input type="text" placeholder="Agent name" value={spawnName} onChange={(e) => setSpawnName(e.target.value)}
                  style={{ flex: 1, minWidth: 150, padding: 10, background: '#1a1a1a', border: '1px solid #333', borderRadius: 6, color: '#fff', fontSize: 13 }} />
                <input type="number" placeholder="Budget (SUI)" value={spawnBudget} onChange={(e) => setSpawnBudget(e.target.value)} step="0.001"
                  style={{ width: 100, padding: 10, background: '#1a1a1a', border: '1px solid #333', borderRadius: 6, color: '#fff', fontSize: 13 }} />
                <input type="number" placeholder="Daily cap (MIST)" value={spawnDailyCap} onChange={(e) => setSpawnDailyCap(e.target.value)}
                  style={{ width: 120, padding: 10, background: '#1a1a1a', border: '1px solid #333', borderRadius: 6, color: '#fff', fontSize: 13 }} />
                <button onClick={handleSpawnChild} disabled={loading.spawnChild}
                  style={{ padding: '10px 20px', fontSize: 14, fontWeight: 'bold', background: loading.spawnChild ? '#333' : '#00d4aa', color: '#000', border: 'none', borderRadius: 6, cursor: loading.spawnChild ? 'not-allowed' : 'pointer' }}>
                  {loading.spawnChild ? 'Spawning...' : 'Spawn Agent'}
                </button>
                <button onClick={() => setSpawnParentId('')}
                  style={{ padding: '10px 16px', fontSize: 14, background: '#333', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Parallel Demo */}
          <div style={{ background: '#111', padding: 24, borderRadius: 12, marginBottom: 24 }}>
            <h2 style={{ fontSize: 18, marginBottom: 16 }}>⚡ Parallel Agent Execution</h2>
            <p style={{ color: '#888', fontSize: 12, marginBottom: 12 }}>Fire prompts to multiple agents simultaneously. Each agent spends from its own object-held balance.</p>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
              {[prompt1, prompt2, prompt3].map((p, i) => (
                <div key={i}>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>
                    Agent {i + 1} {i < treasuries.flatMap(t => [t, ...t.children]).length ? '✓' : '—'}
                  </div>
                  <textarea
                    value={i === 0 ? prompt1 : i === 1 ? prompt2 : prompt3}
                    onChange={(e) => i === 0 ? setPrompt1(e.target.value) : i === 1 ? setPrompt2(e.target.value) : setPrompt3(e.target.value)}
                    placeholder={`Prompt for agent ${i + 1}...`} rows={2}
                    style={{ width: '100%', padding: 8, background: '#1a1a1a', border: '1px solid #333', borderRadius: 6, color: '#fff', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}
                  />
                </div>
              ))}
            </div>

            <button onClick={handleExecuteAll} disabled={parallelLoading}
              style={{ padding: '12px 24px', fontSize: 16, fontWeight: 'bold', background: parallelLoading ? '#333' : '#00d4aa', color: '#000', border: 'none', borderRadius: 8, cursor: parallelLoading ? 'not-allowed' : 'pointer' }}>
              {parallelLoading ? 'Executing...' : 'Execute All Agents'}
            </button>

            {parallelResults.length > 0 && (
              <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                {parallelResults.map((result, i) => (
                  <div key={i} style={{ padding: 12, background: '#1a1a1a', borderRadius: 8, border: result.error ? '1px solid #ff4444' : '1px solid #00d4aa33' }}>
                    <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Agent {result.index + 1}</div>
                    {result.error ? (
                      <div style={{ color: '#ff4444', fontSize: 12 }}>{result.error}</div>
                    ) : (
                      <div>
                        <div style={{ color: '#00d4aa', fontSize: 12, marginBottom: 4 }}>✓ Success</div>
                        <div style={{ fontSize: 12, color: '#ccc', lineHeight: 1.4 }}>{result.content?.slice(0, 100)}...</div>
                        <div style={{ fontSize: 10, color: '#666', marginTop: 4 }}>Cost: {result.cost?.actual} MIST</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* API Keys */}
          <div style={{ background: '#111', padding: 24, borderRadius: 12, marginBottom: 24 }}>
            <h2 style={{ fontSize: 18, marginBottom: 16 }}>🔑 API Keys</h2>
            {apiKeys.length === 0 ? (
              <p style={{ color: '#888' }}>No API keys yet. Create one from a treasury node.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {apiKeys.map((k, i) => (
                  <div key={i} style={{ padding: 12, background: '#1a1a1a', borderRadius: 6, fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontFamily: 'monospace', color: '#aaa' }}>{k.key.slice(0, 24)}...</div>
                      <div style={{ color: '#888', fontSize: 11, marginTop: 2 }}>
                        {k.label} • {k.treasuryId.slice(0, 16)}...
                        {k.allowResume && <span style={{ color: '#00d4aa', marginLeft: 8 }}>● Can resume</span>}
                        {k.revoked && <span style={{ color: '#ff4444', marginLeft: 8 }}>● Revoked</span>}
                      </div>
                    </div>
                    <div style={{ color: '#888', fontSize: 11 }}>{formatDate(k.createdAt)}</div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: 16, padding: 12, background: '#0a0a0a', borderRadius: 6 }}>
              <div style={{ color: '#888', fontSize: 12, marginBottom: 8 }}>Example usage:</div>
              <code style={{ fontSize: 11, color: '#00d4aa', fontFamily: 'monospace', display: 'block', whiteSpace: 'pre-wrap' }}>
                {`curl -X POST ${GATEWAY_URL}/v1/chat \\\n  -H "Authorization: Bearer otter_..." \\\n  -H "Content-Type: application/json" \\\n  -d '{"model":"llama-3.1-8b-instant","messages":[{"role":"user","content":"Hello"}]}'`}
              </code>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── TREASURY TREE NODE ─────────────────────────────────────────────────────

function TreasuryTreeNode({
  node, onSpawn, onReclaim, onCreateKey, onSelect, selected, loading,
  newKey, copiedKey, setCopiedKey, apiKeys, newKeyLabel, setNewKeyLabel,
  allowKeyResume, setAllowKeyResume, setNewKey,
}: any) {
  const isSelected = selected === node.id;
  const nodeKeys = apiKeys.filter((k: any) => k.treasuryId === node.id && !k.revoked);
  const isChild = !!node.parent;

  return (
    <div style={{ marginLeft: isChild ? 24 : 0, borderLeft: isChild ? '2px solid #333' : 'none', paddingLeft: isChild ? 12 : 0 }}>
      <div onClick={() => onSelect(isSelected ? null : node.id)}
        style={{ background: isSelected ? '#1a2a1a' : '#1a1a1a', border: isSelected ? '1px solid #00d4aa' : '1px solid #222', padding: 16, borderRadius: 10, cursor: 'pointer' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div>
            <div style={{ fontWeight: 'bold', fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
              {isChild ? '🤖' : '🏦'} {node.name}
              {node.paused && <span style={{ background: '#ff4444', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 10 }}>PAUSED</span>}
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#666', marginTop: 4 }}>{node.id}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#00d4aa' }}>
              {formatSui(node.balance)} <span style={{ fontSize: 12, color: '#888' }}>SUI</span>
            </div>
            <a href={`${SUI_SCAN}/${node.id}`} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 11, color: '#00d4aa', textDecoration: 'none' }} onClick={(e) => e.stopPropagation()}>
              View on SuiScan →
            </a>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          {!isChild && (
            <button onClick={(e: any) => { e.stopPropagation(); onSpawn(node.id); }}
              style={{ padding: '6px 12px', fontSize: 12, background: '#00d4aa', color: '#000', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold' }}>
              + Spawn Child
            </button>
          )}
          {isChild && (
            <button onClick={(e: any) => { e.stopPropagation(); onReclaim(node.parent, node.id); }}
              disabled={loading[`reclaim_${node.id}`]}
              style={{ padding: '6px 12px', fontSize: 12, background: loading[`reclaim_${node.id}`] ? '#333' : '#ff4444', color: '#fff', border: 'none', borderRadius: 4, cursor: loading[`reclaim_${node.id}`] ? 'not-allowed' : 'pointer' }}>
              {loading[`reclaim_${node.id}`] ? 'Reclaiming...' : '↩ Reclaim'}
            </button>
          )}
          <button onClick={(e: any) => { e.stopPropagation(); onCreateKey(node.id); }}
            disabled={loading[`key_${node.id}`]}
            style={{ padding: '6px 12px', fontSize: 12, background: loading[`key_${node.id}`] ? '#333' : '#0066cc', color: '#fff', border: 'none', borderRadius: 4, cursor: loading[`key_${node.id}`] ? 'not-allowed' : 'pointer' }}>
            {loading[`key_${node.id}`] ? 'Creating...' : '🔑 Create Key'}
          </button>
        </div>

        {isSelected && (
          <div style={{ marginTop: 12, padding: 12, background: '#0a0a0a', borderRadius: 6 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input type="text" placeholder="Key label" value={newKeyLabel} onChange={(e: any) => setNewKeyLabel(e.target.value)}
                style={{ flex: 1, padding: 8, background: '#1a1a1a', border: '1px solid #333', borderRadius: 4, color: '#fff', fontSize: 12 }} />
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#888' }}>
                <input type="checkbox" checked={allowKeyResume} onChange={(e: any) => setAllowKeyResume(e.target.checked)} />
                Allow resume
              </label>
            </div>
            {newKey && nodeKeys.length === 0 && (
              <div style={{ background: '#0a2a1a', border: '1px solid #00d4aa', padding: 12, borderRadius: 6 }}>
                <div style={{ color: '#00d4aa', fontWeight: 'bold', fontSize: 12, marginBottom: 4 }}>🔐 API Key Created</div>
                <div style={{ fontFamily: 'monospace', fontSize: 11, wordBreak: 'break-all', color: '#fff' }}>{newKey}</div>
                <button onClick={() => { copyToClipboard(newKey!); setCopiedKey(newKey); setTimeout(() => setCopiedKey(null), 2000); }}
                  style={{ marginTop: 8, padding: '4px 8px', fontSize: 11, background: '#00d4aa', color: '#000', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
                  {copiedKey === newKey ? '✓ Copied!' : 'Copy'}
                </button>
              </div>
            )}
            {nodeKeys.length > 0 && <div style={{ fontSize: 11, color: '#888' }}>{nodeKeys.length} active key{nodeKeys.length > 1 ? 's' : ''}</div>}
          </div>
        )}
      </div>

      {node.children?.length > 0 && (
        <div style={{ marginTop: 12 }}>
          {node.children.map((child: any) => (
            <TreasuryTreeNode key={child.id} node={child} onSpawn={onSpawn} onReclaim={onReclaim} onCreateKey={onCreateKey}
              onSelect={onSelect} selected={selected} loading={loading} newKey={newKey} copiedKey={copiedKey} setCopiedKey={setCopiedKey}
              apiKeys={apiKeys} newKeyLabel={newKeyLabel} setNewKeyLabel={setNewKeyLabel} allowKeyResume={allowKeyResume}
              setAllowKeyResume={setAllowKeyResume} setNewKey={setNewKey} />
          ))}
        </div>
      )}
    </div>
  );
}