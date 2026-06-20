// otter-gateway.ts
// Otter v0.3 — Autonomous Agent Treasury Protocol
// Gateway: provider routing, per-agent settlement, velocity tracking
// FIXES APPLIED:
//   1. Per-treasury settlement serialization (prevents object-lock collisions)
//   2. Immediate ledger clear on success (no stale pending)
//   3. Retryable vs non-retryable error classification
//   4. Reset settlementFailures on success (agents recover)
//   5. Detailed logging for every settlement attempt

import express from 'express';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import dotenv from 'dotenv';
import cors from 'cors';
import crypto from 'crypto';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

dotenv.config();

// ── CONFIGURATION ──────────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.use(cors({ origin: '*' }));

const SUI_RPC = process.env.SUI_RPC || getFullnodeUrl('testnet');
const client = new SuiClient({ url: SUI_RPC });

const PACKAGE = process.env.PACKAGE_ID!;
const GATEWAY_ADDR = process.env.GATEWAY_ADDRESS!;
const gatewayKeypair = Ed25519Keypair.fromSecretKey(process.env.GATEWAY_PRIVATE_KEY!);
const PORT = process.env.PORT || '3001';

// ── STARTUP VALIDATION ─────────────────────────────────────────────────────

function validateConfig() {
  const missing: string[] = [];
  if (!PACKAGE) missing.push('PACKAGE_ID');
  if (!GATEWAY_ADDR) missing.push('GATEWAY_ADDRESS');
  if (!process.env.GATEWAY_PRIVATE_KEY) missing.push('GATEWAY_PRIVATE_KEY');
  if (!process.env.GROQ_API_KEY) console.warn('[WARN] GROQ_API_KEY not set');
  if (missing.length > 0) {
    console.error('[FATAL] Missing env vars:', missing.join(', '));
    process.exit(1);
  }
  console.log('[CONFIG] RPC:', SUI_RPC);
  console.log('[CONFIG] Package:', PACKAGE);
  console.log('[CONFIG] Gateway:', GATEWAY_ADDR);
}

// ── DATA DIRECTORY ────────────────────────────────────────────────────────

const DATA_DIR = join(process.cwd(), 'data');
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

const API_KEYS_FILE = join(DATA_DIR, 'api-keys.json');
const LEDGER_FILE = join(DATA_DIR, 'agent-ledger.json');
const PAUSED_FILE = join(DATA_DIR, 'paused-agents.json');

// ── PROVIDER CONFIGURATION ─────────────────────────────────────────────────

interface ModelConfig {
  costPer1kTokens: number;
}

interface ProviderConfig {
  baseUrl: string;
  apiKeyEnvVar: string;
  models: Record<string, ModelConfig>;
}

const PROVIDERS: Record<string, ProviderConfig> = {
  groq: {
    baseUrl: 'https://api.groq.com/openai/v1',
    apiKeyEnvVar: 'GROQ_API_KEY',
    models: {
      'llama-3.1-8b-instant': { costPer1kTokens: 50_000 },
      'llama-3.3-70b-versatile': { costPer1kTokens: 200_000 },
      'mixtral-8x7b-32768': { costPer1kTokens: 120_000 },
    },
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    apiKeyEnvVar: 'OPENAI_API_KEY',
    models: {
      'gpt-4o': { costPer1kTokens: 500_000 },
      'gpt-4o-mini': { costPer1kTokens: 50_000 },
      'gpt-3.5-turbo': { costPer1kTokens: 50_000 },
    },
  },
  anthropic: {
    baseUrl: 'https://api.anthropic.com/v1',
    apiKeyEnvVar: 'ANTHROPIC_API_KEY',
    models: {
      'claude-3-5-sonnet-20241022': { costPer1kTokens: 800_000 },
      'claude-3-haiku-20240307': { costPer1kTokens: 100_000 },
    },
  },
};

function getProviderForModel(model: string): { provider: string; config: ProviderConfig; modelConfig: ModelConfig } | null {
  for (const [providerName, providerConfig] of Object.entries(PROVIDERS)) {
    if (providerConfig.models[model]) {
      return { provider: providerName, config: providerConfig, modelConfig: providerConfig.models[model] };
    }
  }
  return null;
}

function calculateCost(model: string, tokenCount: number): bigint {
  const info = getProviderForModel(model);
  if (!info) return 0n;
  const cost = Math.ceil((tokenCount / 1000) * info.modelConfig.costPer1kTokens);
  return BigInt(cost);
}

// ── PERSISTENCE HELPERS ────────────────────────────────────────────────────

function loadJson<T>(path: string, defaultValue: T): T {
  if (!existsSync(path)) return defaultValue;
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return defaultValue;
  }
}

function saveJson<T>(path: string, data: T) {
  writeFileSync(path, JSON.stringify(data, (_key, value) =>
    typeof value === 'bigint' ? value.toString() : value, 2));
}

// ── API KEY STORE ──────────────────────────────────────────────────────────

interface AgentApiKey {
  wallet: string;
  treasuryId: string;
  label: string;
  createdAt: number;
  revoked: boolean;
  allowResume: boolean;
}

const apiKeys = new Map<string, AgentApiKey>(
  Object.entries(loadJson<Record<string, AgentApiKey>>(API_KEYS_FILE, {}))
);

function persistApiKeys() {
  saveJson(API_KEYS_FILE, Object.fromEntries(apiKeys));
}

function generateApiKey(): string {
  const random = crypto.randomBytes(24).toString('base64url');
  return `otter_${random}`;
}

// ── PER-AGENT CREDIT LEDGER ───────────────────────────────────────────────

interface AgentLedger {
  treasuryId: string;
  reserved: bigint;
  spent: bigint;
  lastSettlement: number;
  settlementFailures: number;
}

const agentLedger = new Map<string, AgentLedger>(
  Object.entries(loadJson<Record<string, AgentLedger>>(LEDGER_FILE, {})).map(([k, v]) => [
    k,
    { ...v, reserved: BigInt(v.reserved || 0), spent: BigInt(v.spent || 0) }
  ])
);

function persistLedger() {
  saveJson(LEDGER_FILE, Object.fromEntries(agentLedger));
}

function getOrCreateLedger(treasuryId: string): AgentLedger {
  if (!agentLedger.has(treasuryId)) {
    agentLedger.set(treasuryId, { treasuryId, reserved: 0n, spent: 0n, lastSettlement: Date.now(), settlementFailures: 0 });
    persistLedger();
  }
  return agentLedger.get(treasuryId)!;
}

// ── SETTLEMENT SERIALIZATION ───────────────────────────────────────────────
// CRITICAL FIX: Only one settlement transaction per treasury can be in flight
// at any time. This prevents "object already locked" errors from Sui consensus.

const settlingTreasuries = new Set<string>();

function acquireSettlementLock(treasuryId: string): boolean {
  if (settlingTreasuries.has(treasuryId)) return false;
  settlingTreasuries.add(treasuryId);
  return true;
}

function releaseSettlementLock(treasuryId: string) {
  settlingTreasuries.delete(treasuryId);
}

// ── SOFT PAUSE STATE ──────────────────────────────────────────────────────

interface PauseRecord {
  pausedAt: number;
  reason: string;
  auto: boolean;
}

const pausedAgents = new Map<string, PauseRecord>(
  Object.entries(loadJson<Record<string, PauseRecord>>(PAUSED_FILE, {}))
);

function persistPaused() {
  saveJson(PAUSED_FILE, Object.fromEntries(pausedAgents));
}

// ── VELOCITY TRACKER ────────────────────────────────────────────────────────

const VELOCITY_WINDOW_MS = 60_000;
const VELOCITY_THRESHOLD = 8;
const VELOCITY_BURST_LIMIT = 5;

interface VelocityWindow {
  requests: number[];
}

const agentVelocityWindows = new Map<string, VelocityWindow>();

function checkVelocity(treasuryId: string): { triggered: boolean; rate: number; reason: string } {
  const now = Date.now();
  let window = agentVelocityWindows.get(treasuryId);
  if (!window) {
    window = { requests: [] };
    agentVelocityWindows.set(treasuryId, window);
  }

  window.requests = window.requests.filter(t => now - t < VELOCITY_WINDOW_MS);
  window.requests.push(now);

  const recent = window.requests.filter(t => now - t < 5_000);
  if (recent.length >= VELOCITY_BURST_LIMIT) {
    return { triggered: true, rate: recent.length, reason: `Burst detected: ${recent.length} requests in 5 seconds` };
  }

  const rate = window.requests.length;
  if (rate > VELOCITY_THRESHOLD) {
    return { triggered: true, rate, reason: `Velocity spike: ${rate} requests in 1 minute (threshold: ${VELOCITY_THRESHOLD})` };
  }

  return { triggered: false, rate, reason: '' };
}

// ── RATE LIMITING ──────────────────────────────────────────────────────────

interface RateLimitEntry {
  requests: number[];
}

const ipLimits = new Map<string, RateLimitEntry>();
const treasuryLimits = new Map<string, RateLimitEntry>();

const IP_LIMIT = 100;
const TREASURY_LIMIT = 10;

function checkRateLimit(map: Map<string, RateLimitEntry>, key: string, limit: number, windowMs: number = 60_000): boolean {
  const now = Date.now();
  let entry = map.get(key);
  if (!entry) {
    entry = { requests: [] };
    map.set(key, entry);
  }
  entry.requests = entry.requests.filter(t => now - t < windowMs);
  if (entry.requests.length >= limit) return false;
  entry.requests.push(now);
  return true;
}

// ── PROVIDER CALLERS ───────────────────────────────────────────────────────

async function callGroq(
  model: string,
  messages: any[],
  temperature: number,
  max_tokens: number
): Promise<{ model?: string; content?: string; usage?: { total_tokens: number; prompt_tokens: number; completion_tokens: number }; error?: string }> {
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) {
    return { error: 'GROQ_API_KEY not configured' };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${groqKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, messages, temperature, max_tokens }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      return { error: `Groq HTTP ${response.status}: ${errorText}` };
    }

    const data = await response.json();
    return {
      model: data.model,
      content: data.choices?.[0]?.message?.content,
      usage: data.usage,
    };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { error: 'Groq request timed out after 30s' };
    }
    return { error: err.message };
  }
}

async function callOpenAIStub(): Promise<{ error: string }> {
  return { error: 'OpenAI provider not configured. Add OPENAI_API_KEY to enable.' };
}

async function callAnthropicStub(): Promise<{ error: string }> {
  return { error: 'Anthropic provider not configured. Add ANTHROPIC_API_KEY to enable.' };
}

// ── ENDPOINTS ──────────────────────────────────────────────────────────────

app.get('/health', async (_req, res) => {
  res.json({
    status: 'ok',
    package: PACKAGE,
    gateway: GATEWAY_ADDR,
    rpc: SUI_RPC,
    providers: Object.fromEntries(
      Object.entries(PROVIDERS).map(([name, config]) => [
        name,
        {
          configured: !!process.env[config.apiKeyEnvVar],
          models: Object.keys(config.models),
        },
      ])
    ),
  });
});

app.post('/caps', async (req, res) => {
  const { wallet } = req.body;
  if (!wallet) {
    return res.status(400).json({ error: 'wallet required' });
  }

  try {
    const objects = await client.getOwnedObjects({
      owner: wallet,
      filter: {
        StructType: `${PACKAGE}::agent_treasury::TreasuryOwnerCap`,
      },
      options: { showContent: true },
    });

    const caps: Record<string, string> = {};
    for (const obj of objects.data) {
      if (obj.data?.content?.dataType === 'moveObject') {
        const fields = (obj.data.content as any).fields as any;
        const treasuryId = fields.treasury_id;
        caps[treasuryId] = obj.data.objectId;
      }
    }

    res.json({ wallet, caps });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch caps', message: err.message });
  }
});

app.get('/providers', async (_req, res) => {
  res.json({
    providers: Object.fromEntries(
      Object.entries(PROVIDERS).map(([name, config]) => [
        name,
        {
          configured: !!process.env[config.apiKeyEnvVar],
          models: Object.fromEntries(
            Object.entries(config.models).map(([model, modelConfig]) => [
              model,
              { costPer1kTokens: modelConfig.costPer1kTokens },
            ])
          ),
        },
      ])
    ),
  });
});

app.post('/keys/create', async (req, res) => {
  const { wallet, treasuryId, label, allowResume = false } = req.body;
  if (!wallet || !treasuryId) {
    return res.status(400).json({ error: 'wallet and treasuryId required' });
  }

  if (!treasuryId.match(/^0x[0-9a-fA-F]{64}$/)) {
    return res.status(400).json({ error: 'Invalid treasuryId format. Must be 0x + 64 hex chars.' });
  }

  const key = generateApiKey();
  apiKeys.set(key, {
    wallet,
    treasuryId,
    label: label || 'default',
    createdAt: Date.now(),
    revoked: false,
    allowResume: !!allowResume,
  });

  getOrCreateLedger(treasuryId);
  persistApiKeys();

  res.json({
    status: 'success',
    key,
    wallet,
    treasuryId,
    label: label || 'default',
    allowResume: !!allowResume,
  });
});

app.get('/keys/:wallet', async (req, res) => {
  const wallet = req.params.wallet;
  const keys = Array.from(apiKeys.entries())
    .filter(([_, v]) => v.wallet === wallet)
    .map(([k, v]) => ({
      key: k,
      treasuryId: v.treasuryId,
      label: v.label,
      createdAt: v.createdAt,
      revoked: v.revoked,
      allowResume: v.allowResume,
    }));

  res.json({ wallet, keys });
});

app.post('/keys/revoke', async (req, res) => {
  const { key } = req.body;
  const record = apiKeys.get(key);
  if (!record) {
    return res.status(404).json({ error: 'Key not found' });
  }
  record.revoked = true;
  persistApiKeys();
  res.json({ status: 'success', message: 'Key revoked' });
});

app.get('/status/:treasuryId', async (req, res) => {
  const treasuryId = req.params.treasuryId;

  try {
    const obj = await client.getObject({
      id: treasuryId,
      options: { showContent: true, showOwner: true },
    });

    if (!obj.data || obj.data.content?.dataType !== 'moveObject') {
      return res.status(404).json({ error: 'AgentTreasury not found' });
    }

    const fields = (obj.data.content as any).fields as any;

    const balance = BigInt(fields.balance);
    const paused = fields.paused;
    const owner = fields.owner;
    const name = fields.name;
    const parent = fields.parent?.fields?.vec?.[0] || null;

    const policy = fields.policy?.fields || {};
    const spendTracking = fields.spend_tracking?.fields || {};
    const reputation = fields.reputation?.fields || {};

    const ledger = getOrCreateLedger(treasuryId);
    const pauseRecord = pausedAgents.get(treasuryId);
    const velocityWindow = agentVelocityWindows.get(treasuryId);

    res.json({
      treasuryId,
      owner,
      name,
      parent,
      balance: balance.toString(),
      policy: {
        maxDailySpend: policy.max_daily_spend,
        maxMonthlySpend: policy.max_monthly_spend,
        maxSingleSpend: policy.max_single_spend,
        approvedProviders: policy.approved_providers?.map((p: any) => p.fields.name) || [],
        velocityThreshold: policy.velocity_threshold,
      },
      spendTracking: {
        dailySpent: spendTracking.daily_spent,
        monthlySpent: spendTracking.monthly_spent,
        lastDailyReset: spendTracking.last_daily_reset,
        lastMonthlyReset: spendTracking.last_monthly_reset,
      },
      reputation: {
        totalSettled: reputation.total_settled,
        successfulCalls: reputation.successful_calls,
        violations: reputation.violations,
        anomalyScore: reputation.anomaly_score,
        lastActive: reputation.last_active,
      },
      paused: {
        onChain: paused,
        soft: pauseRecord ? { pausedAt: pauseRecord.pausedAt, reason: pauseRecord.reason, auto: pauseRecord.auto } : null,
      },
      velocity: {
        currentRate: velocityWindow?.requests.length || 0,
        windowMs: VELOCITY_WINDOW_MS,
        threshold: VELOCITY_THRESHOLD,
      },
      ledger: {
        reserved: ledger.reserved.toString(),
        spent: ledger.spent.toString(),
        lastSettlement: ledger.lastSettlement,
        settlementFailures: ledger.settlementFailures,
      },
    });
  } catch (err: any) {
    console.error('Status error:', err);
    res.status(500).json({ error: 'Failed to fetch status', message: err.message });
  }
});

app.get('/agents/:wallet', async (req, res) => {
  const wallet = req.params.wallet;

  try {
    // Query all three event types: created, spawned, and reclaimed
    const [createdEvents, spawnedEvents, reclaimedEvents] = await Promise.all([
      client.queryEvents({
        query: { MoveEventType: `${PACKAGE}::agent_treasury::AgentCreated` },
        limit: 100,
      }),
      client.queryEvents({
        query: { MoveEventType: `${PACKAGE}::agent_treasury::ChildSpawned` },
        limit: 100,
      }),
      client.queryEvents({
        query: { MoveEventType: `${PACKAGE}::agent_treasury::BudgetReclaimed` },
        limit: 100,
      }),
    ]);

    // Build set of reclaimed child IDs
    const reclaimedIds = new Set<string>();
    for (const e of reclaimedEvents.data) {
      const childId = e.parsedJson?.child_id;
      if (childId) {
        reclaimedIds.add(childId);
      }
    }

    const treasuryMap = new Map<string, any>();

    // Process master treasuries (AgentCreated)
    for (const e of createdEvents.data) {
      if (e.parsedJson?.owner === wallet) {
        treasuryMap.set(e.parsedJson.treasury_id, {
          id: e.parsedJson.treasury_id,
          name: e.parsedJson.name,
          owner: e.parsedJson.owner,
          parent: null,
          balance: '0',
          paused: false,
        });
      }
    }

    // Process child treasuries (ChildSpawned), skipping reclaimed ones
    for (const e of spawnedEvents.data) {
      const childId = e.parsedJson?.child_id;
      if (e.parsedJson?.owner === wallet && childId && !reclaimedIds.has(childId)) {
        treasuryMap.set(childId, {
          id: childId,
          name: e.parsedJson.name,
          owner: e.parsedJson.owner,
          parent: e.parsedJson.parent_id,
          balance: '0',
          paused: false,
        });
      }
    }

    const myTreasuries = Array.from(treasuryMap.values());

    // Fetch current on-chain state for each treasury
    for (const t of myTreasuries) {
      try {
        const obj = await client.getObject({
          id: t.id,
          options: { showContent: true },
        });
        if (obj.data?.content?.dataType === 'moveObject') {
          const fields = (obj.data.content as any).fields as any;
          t.balance = (BigInt(fields.balance)).toString();
          t.paused = fields.paused;
        }
      } catch (e) {
        // Object may have been deleted (e.g., master reclaimed via different path)
        // Keep the event data but mark balance as unknown
      }
    }

    res.json({ wallet, count: myTreasuries.length, treasuries: myTreasuries });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch agents', message: err.message });
  }
});

// ── CORE SETTLEMENT FUNCTION (SERIALIZED PER TREASURY) ────────────────────
// CRITICAL: This is the heart of the fix. Settlement is now atomic per treasury.

async function settleAgentCall(
  treasuryId: string,
  amount: bigint,
  provider: string
): Promise<{ success: boolean; digest?: string; error?: string; retryable: boolean }> {

  // Try to acquire lock — if another settlement for this treasury is in flight, skip
  if (!acquireSettlementLock(treasuryId)) {
    console.log(`[SETTLEMENT] Skipping ${treasuryId}: another settlement already in flight`);
    return { success: false, error: 'Settlement already in progress for this treasury', retryable: true };
  }

  try {
    console.log(`[SETTLEMENT] Attempting ${amount} MIST for ${treasuryId} via ${provider}`);

    const tx = new Transaction();
    tx.setGasBudget(10_000_000); // Explicit gas budget to avoid estimation failures

    tx.moveCall({
      target: `${PACKAGE}::agent_treasury::authorize_agent_call`,
      arguments: [
        tx.object(treasuryId),
        tx.pure.address(GATEWAY_ADDR),
        tx.pure.u64(amount),
        tx.pure.string(provider),
        tx.object('0x6'),
      ],
    });

    const result = await client.signAndExecuteTransaction({
      transaction: tx,
      signer: gatewayKeypair,
      options: { showEffects: true, showEvents: true },
    });

    if (result.effects?.status?.status === 'success') {
      console.log(`[SETTLEMENT] ✓ Success digest=${result.digest}`);
      return { success: true, digest: result.digest, retryable: false };
    } else {
      const status = JSON.stringify(result.effects?.status);
      console.error(`[SETTLEMENT] ✗ Transaction failed: ${status}`);
      return { success: false, error: `Transaction failed: ${status}`, retryable: true };
    }
  } catch (err: any) {
    const msg = err.message || String(err);
    console.error(`[SETTLEMENT] ✗ Error: ${msg}`);

    // Classify errors
    const isObjectLocked = msg.includes('already locked') || msg.includes('conflicting transaction');
    const isInsufficientBalance = msg.includes('MoveAbort') && msg.includes('5');
    const isGasIssue = msg.includes('gas') || msg.includes('budget');
    const isNetwork = msg.includes('fetch') || msg.includes('timeout') || msg.includes('ECONNREFUSED');

    if (isObjectLocked) {
      return { success: false, error: 'Object locked by concurrent transaction', retryable: true };
    }
    if (isInsufficientBalance) {
      return { success: false, error: 'Insufficient balance or policy violation (MoveAbort 5)', retryable: false };
    }
    if (isGasIssue) {
      return { success: false, error: `Gas issue: ${msg}`, retryable: true };
    }
    if (isNetwork) {
      return { success: false, error: `Network error: ${msg}`, retryable: true };
    }

    return { success: false, error: msg, retryable: true };
  } finally {
    releaseSettlementLock(treasuryId);
  }
}

// ── PROTECTED API ROUTE ───────────────────────────────────────────────────

app.post('/v1/chat', async (req, res) => {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

  if (!checkRateLimit(ipLimits, clientIp, IP_LIMIT)) {
    return res.status(429).json({ error: 'Rate limit exceeded. Max 100 requests per minute.' });
  }

  const authHeader = req.headers['authorization'] as string;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing API key. Use: Authorization: Bearer otter_...' });
  }

  const apiKey = authHeader.slice(7);
  const keyRecord = apiKeys.get(apiKey);

  if (!keyRecord || keyRecord.revoked) {
    return res.status(401).json({ error: 'Invalid or revoked API key' });
  }

  const treasuryId = keyRecord.treasuryId;

  const pauseRecord = pausedAgents.get(treasuryId);
  if (pauseRecord) {
    return res.status(403).json({
      error: 'Agent paused',
      reason: pauseRecord.reason,
      pausedAt: pauseRecord.pausedAt,
      auto: pauseRecord.auto,
      message: 'This agent has been paused due to unusual activity. Connect your wallet to the dashboard to resume.',
    });
  }

  if (!checkRateLimit(treasuryLimits, treasuryId, TREASURY_LIMIT)) {
    return res.status(429).json({ error: 'Rate limit exceeded. Max 10 requests per minute per agent.' });
  }

  const { model, messages, temperature = 0.7, max_tokens = 256 } = req.body;

  if (!model || !messages) {
    return res.status(400).json({ error: 'model and messages required' });
  }

  const providerInfo = getProviderForModel(model);
  if (!providerInfo) {
    return res.status(400).json({ error: `Unsupported model: ${model}. Use /providers to see available models.` });
  }

  if (!process.env[providerInfo.config.apiKeyEnvVar]) {
    return res.status(503).json({
      error: `Provider ${providerInfo.provider} not configured`,
      message: `Set ${providerInfo.config.apiKeyEnvVar} environment variable to enable.`,
    });
  }

  const estimatedTokens = max_tokens;
  const estimatedCost = calculateCost(model, estimatedTokens);

  if (estimatedCost === 0n) {
    return res.status(500).json({ error: 'Failed to calculate cost for model' });
  }

  // ── ON-CHAIN BALANCE CHECK ───────────────────────────────────────────────
  let onChainBalance: bigint;
  let objResponse: any;

  try {
    console.log(`[BALANCE CHECK] treasuryId=${treasuryId}, RPC=${SUI_RPC}`);
    objResponse = await client.getObject({
      id: treasuryId,
      options: { showContent: true },
    });
  } catch (err: any) {
    console.error(`[BALANCE CHECK] RPC ERROR:`, err.message);
    return res.status(502).json({
      error: 'Failed to verify on-chain balance',
      detail: err.message,
      treasuryId,
      rpc: SUI_RPC,
    });
  }

  if (!objResponse || !objResponse.data) {
    return res.status(404).json({
      error: 'AgentTreasury not found on-chain',
      treasuryId,
      rpc: SUI_RPC,
    });
  }

  if (objResponse.data.content?.dataType !== 'moveObject') {
    return res.status(404).json({
      error: 'AgentTreasury not found — object is not a Move object',
      dataType: objResponse.data.content?.dataType,
      treasuryId,
    });
  }

  const fields = (objResponse.data.content as any).fields as any;
  const rawBalance = fields?.balance;
  if (rawBalance === undefined || rawBalance === null) {
    return res.status(500).json({
      error: 'AgentTreasury object missing balance field',
      fields,
      treasuryId,
    });
  }

  try {
    onChainBalance = BigInt(rawBalance);
  } catch (err: any) {
    return res.status(500).json({
      error: 'Invalid balance format from chain',
      rawBalance,
      type: typeof rawBalance,
    });
  }

  console.log(`[BALANCE CHECK] Balance=${onChainBalance.toString()} MIST`);

  // ── LEDGER CHECK ─────────────────────────────────────────────────────────
  const ledger = getOrCreateLedger(treasuryId);
  const available = onChainBalance - ledger.reserved - ledger.spent;

  if (available < estimatedCost) {
    return res.status(402).json({
      error: 'Insufficient balance',
      balance: onChainBalance.toString(),
      reserved: ledger.reserved.toString(),
      spent: ledger.spent.toString(),
      available: available.toString(),
      required: estimatedCost.toString(),
    });
  }

  // Reserve credits
  ledger.reserved += estimatedCost;
  persistLedger();

  // ── CALL PROVIDER ────────────────────────────────────────────────────────
  let providerResponse;
  try {
    if (providerInfo.provider === 'groq') {
      providerResponse = await callGroq(model, messages, temperature, max_tokens);
    } else if (providerInfo.provider === 'openai') {
      providerResponse = await callOpenAIStub();
    } else if (providerInfo.provider === 'anthropic') {
      providerResponse = await callAnthropicStub();
    } else {
      ledger.reserved -= estimatedCost;
      persistLedger();
      return res.status(500).json({ error: 'Provider implementation missing' });
    }
  } catch (err: any) {
    ledger.reserved -= estimatedCost;
    persistLedger();
    return res.status(502).json({ error: 'Provider call failed', details: err.message });
  }

  if (providerResponse.error) {
    ledger.reserved -= estimatedCost;
    persistLedger();
    return res.status(502).json({ error: 'Provider error', details: providerResponse.error });
  }

  // ── CALCULATE ACTUAL COST ────────────────────────────────────────────────
  const actualTokens = providerResponse.usage?.total_tokens || estimatedTokens;
  const actualCost = calculateCost(model, actualTokens);

  // Deduct from ledger
  ledger.reserved -= estimatedCost;
  ledger.spent += actualCost;
  persistLedger();

  console.log(`[LEDGER] treasury=${treasuryId} reserved=${ledger.reserved} spent=${ledger.spent}`);

  // ── IMMEDIATE SETTLEMENT ─────────────────────────────────────────────────
  // CRITICAL FIX: Settle immediately, don't wait for batch. This prevents
  // the ledger from growing stale and hitting MoveAbort on insufficient balance.

  let settlementResult = await settleAgentCall(treasuryId, actualCost, providerInfo.provider);

  if (settlementResult.success && settlementResult.digest) {
    // CRITICAL FIX: Clear spent immediately on success so we never double-settle
    ledger.spent = 0n;
    ledger.settlementFailures = 0;
    ledger.lastSettlement = Date.now();
    persistLedger();
    console.log(`[SETTLEMENT] ✓ Cleared ledger for ${treasuryId}`);
  } else {
    // Settlement failed — handle based on error type
    if (!settlementResult.retryable) {
      // Non-retryable: balance/policy issue. Clear the ledger to prevent
      // repeated failures. The on-chain state is the source of truth.
      console.warn(`[SETTLEMENT] Non-retryable failure for ${treasuryId}: ${settlementResult.error}. Clearing ledger.`);
      ledger.spent = 0n;
      ledger.settlementFailures = 0;
      persistLedger();
    } else {
      // Retryable: keep spent in ledger for batch settlement to retry
      ledger.settlementFailures++;
      persistLedger();
      console.warn(`[SETTLEMENT] Retryable failure #${ledger.settlementFailures} for ${treasuryId}: ${settlementResult.error}`);
    }
  }

  // ── VELOCITY CHECK ───────────────────────────────────────────────────────
  const velocityCheck = checkVelocity(treasuryId);
  if (velocityCheck.triggered) {
    pausedAgents.set(treasuryId, {
      pausedAt: Date.now(),
      reason: velocityCheck.reason,
      auto: true,
    });
    persistPaused();
    treasuryLimits.delete(treasuryId);
    console.log(`[AUTO-PAUSE] Agent ${treasuryId}: ${velocityCheck.reason}`);
  }

  // ── RETURN RESPONSE ────────────────────────────────────────────────────────
  res.json({
    status: 'success',
    model: providerResponse.model,
    content: providerResponse.content,
    usage: providerResponse.usage,
    cost: {
      estimated: estimatedCost.toString(),
      actual: actualCost.toString(),
      currency: 'MIST',
    },
    settlement: {
      digest: settlementResult.success ? settlementResult.digest : null,
      error: settlementResult.error || null,
      settled: settlementResult.success,
      retryable: settlementResult.retryable,
      pending: ledger.spent.toString(),
      lastSettled: ledger.lastSettlement,
    },
    velocity: {
      rate: velocityCheck.rate,
      threshold: VELOCITY_THRESHOLD,
      windowMs: VELOCITY_WINDOW_MS,
    },
  });
});

// ── RESUME ENDPOINTS ────────────────────────────────────────────────────────

app.post('/resume', async (req, res) => {
  const authHeader = req.headers['authorization'] as string;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing API key' });
  }

  const apiKey = authHeader.slice(7);
  const keyRecord = apiKeys.get(apiKey);

  if (!keyRecord || keyRecord.revoked) {
    return res.status(401).json({ error: 'Invalid or revoked API key' });
  }

  if (!keyRecord.allowResume) {
    return res.status(403).json({
      error: 'API key not authorized to resume',
      message: 'This key was created without resume permission. Use the dashboard to resume.',
    });
  }

  const treasuryId = keyRecord.treasuryId;
  const pauseRecord = pausedAgents.get(treasuryId);
  if (!pauseRecord) {
    return res.json({ status: 'already_resumed', treasuryId });
  }

  pausedAgents.delete(treasuryId);
  persistPaused();

  res.json({
    status: 'success',
    treasuryId,
    previousPause: pauseRecord,
  });
});

app.post('/resume/:treasuryId', async (req, res) => {
  const treasuryId = req.params.treasuryId;
  const pauseRecord = pausedAgents.get(treasuryId);

  if (!pauseRecord) {
    return res.json({ status: 'already_resumed', treasuryId });
  }

  pausedAgents.delete(treasuryId);
  persistPaused();

  res.json({
    status: 'success',
    treasuryId,
    previousPause: pauseRecord,
  });
});

// ── BATCH SETTLEMENT (BACKGROUND CLEANUP) ────────────────────────────────
// This now only handles retryable failures from the immediate settlement.
// Most settlements should succeed immediately in /v1/chat.

const SETTLEMENT_INTERVAL = 2 * 60 * 1000; // Every 2 minutes (was 5)
const MAX_SETTLEMENT_FAILURES = 5; // Was 3, increased because we reset on success

async function runBatchSettlement() {
  console.log('[BATCH] Running background settlement cleanup...');
  let processed = 0;
  let succeeded = 0;

  for (const [treasuryId, ledger] of agentLedger.entries()) {
    if (ledger.spent === 0n) continue;
    if (ledger.settlementFailures >= MAX_SETTLEMENT_FAILURES) {
      console.warn(`[BATCH] Skipping ${treasuryId}: ${ledger.settlementFailures} consecutive failures.`);
      continue;
    }

    const amount = ledger.spent;
    console.log(`[BATCH] Retrying ${amount} MIST for agent ${treasuryId}`);

    const result = await settleAgentCall(treasuryId, amount, 'batch');
    processed++;

    if (result.success) {
      ledger.spent = 0n;
      ledger.settlementFailures = 0;
      ledger.lastSettlement = Date.now();
      persistLedger();
      succeeded++;
      console.log(`[BATCH] ✓ Success: ${result.digest}`);
    } else if (!result.retryable) {
      // Non-retryable: clear and move on
      console.warn(`[BATCH] Non-retryable for ${treasuryId}: ${result.error}. Clearing.`);
      ledger.spent = 0n;
      ledger.settlementFailures = 0;
      persistLedger();
    } else {
      ledger.settlementFailures++;
      persistLedger();
      console.error(`[BATCH] ✗ Retryable failure #${ledger.settlementFailures}: ${result.error}`);
    }
  }

  console.log(`[BATCH] Done. Processed: ${processed}, Succeeded: ${succeeded}`);
}

setInterval(runBatchSettlement, SETTLEMENT_INTERVAL);

// ── START SERVER ───────────────────────────────────────────────────────────

validateConfig();

app.listen(PORT, () => {
  console.log(`Otter Gateway v0.3.1 (HARDENED) running on http://localhost:${PORT}`);
  console.log(`Package: ${PACKAGE}`);
  console.log(`Gateway: ${GATEWAY_ADDR}`);
  console.log(`Providers: ${Object.keys(PROVIDERS).join(', ')}`);
  console.log(`Data directory: ${DATA_DIR}`);
  console.log(`Settlement interval: ${SETTLEMENT_INTERVAL / 1000}s`);
});