
# Otter v0.3 — Autonomous Agent Treasury Protocol

> The financial operating system for autonomous AI agents on Sui.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [File Structure](#file-structure)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
- [Smart Contract Reference](#smart-contract-reference)
- [Usage Examples](#usage-examples)
- [Environment Variables](#environment-variables)
- [Data Persistence](#data-persistence)
- [Provider Configuration](#provider-configuration)
- [Security Model](#security-model)

---

## Overview

Otter gives every AI agent its own programmable bank account on Sui. Each agent treasury is a real Sui object that physically owns `Coin<SUI>` funds, operates under programmable constraints, and can be revoked atomically.

### Core Concepts

| Concept | Description |
|---------|-------------|
| **Master Treasury** | Root treasury object created by a wallet. Can spawn child agents. |
| **Agent Treasury** | Child object with its own `Balance<SUI>`, policy, and reputation. |
| **TreasuryOwnerCap** | Capability proving ownership. Required for spawn, reclaim, pause, resume. |
| **PolicySet** | Programmable constraints: daily/monthly caps, approved providers, velocity limits. |
| **Atomic Reclaim** | Parent destroys child object, reclaims budget in one transaction. |

### Why Sui

This architecture is impossible on Ethereum and awkward on Solana. Sui's object-centric design enables:

- **Physical ownership**: Parent objects literally own child `Coin<SUI>` objects
- **Parallel execution**: Independent agent treasuries execute simultaneously
- **Atomic destruction**: Reclaim and destroy child objects in one PTB

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Otter Dashboard (Next.js)                  │
│  • Wallet connect  • Treasury tree UI  • PTB construction    │
│  • Agent spawn/reclaim  • Parallel demo  • SuiScan links    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Otter Gateway (Node/TS)                   │
│  • API key auth → treasuryId  • Provider routing (Groq live) │
│  • Per-agent velocity tracking  • Soft pause/resume          │
│  • On-chain settlement via authorize_agent_call            │
│  • Batch settlement every 5 minutes                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Sui Move Contract (Testnet)                      │
│  • AgentTreasury (shared object)                            │
│  • create_master_treasury  • spawn_child_agent               │
│  • reclaim_child_budget (atomic)  • authorize_agent_call   │
│  • pause_agent / resume_agent  • Policy enforcement        │
│  • Events: AgentCreated, ChildSpawned, BudgetReclaimed, etc  │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

```
User creates Master Treasury (user-signed PTB)
         │
         ▼
    ┌─────────────┐
    │  Master     │ ◄── TreasuryOwnerCap (in user's wallet)
    │  Treasury   │
    └──────┬──────┘
           │ spawn_child_agent (user-signed PTB)
           ▼
    ┌─────────────┐     ┌─────────────┐
    │  Trading    │     │  Research   │
    │  Agent      │     │  Agent      │
    └──────┬──────┘     └──────┬──────┘
           │                   │
           │ API calls with    │ API calls with
           │ otter_... key     │ otter_... key
           ▼                   ▼
    ┌─────────────────────────────────────┐
    │         Otter Gateway               │
    │  • Check on-chain balance           │
    │  • Check policy constraints         │
    │  • Call provider (Groq)             │
    │  • Settle via authorize_agent_call  │
    └─────────────────────────────────────┘
```

---

## File Structure

```
otter/
├── otter-contract/
│   ├── Move.toml
│   └── sources/
│       └── agent_treasury.move          # Core Move contract
│
├── otter-gateway/
│   ├── .env                             # Environment variables
│   ├── package.json
│   ├── tsconfig.json
│   ├── data/                            # Persistent state (JSON files)
│   │   ├── api-keys.json               # API key → treasuryId mappings
│   │   ├── agent-ledger.json           # Per-agent spend tracking
│   │   └── paused-agents.json          # Soft pause state
│   └── src/
│       └── gateway.ts                   # Main gateway server
│
├── otter-dashboard/
│   ├── .env.local
│   ├── package.json
│   ├── next.config.js
│   └── src/
│       └── app/
│           ├── page.tsx                 # Main dashboard
│           └── layout.tsx
│
└── README.md                            # This file
```

---

## Quick Start

### 1. Deploy Contract

```bash
cd otter-contract

# Ensure Move.toml is configured
cat Move.toml
# [package]
# name = "otter"
# version = "0.0.1"
# edition = "2024.beta"
# 
# [dependencies]
# Sui = { git = "https://github.com/MystenLabs/sui.git", subdir = "crates/sui-framework/packages/sui-framework", rev = "testnet" }
# 
# [addresses]
# otter = "0x0"

# Build and deploy (use BitLab IDE or CLI)
sui client publish --gas-budget 50000000

# Save the Package ID from output
export PACKAGE_ID="0xdbfb39eabe0938cb1495443b733e00bd90799a6d5ea870227d9f0e426091b480"
```

### 2. Start Gateway

```bash
cd otter-gateway

# Create .env file
cat > .env << 'EOF'
SUI_RPC=https://sui-testnet-rpc.publicnode.com
PACKAGE_ID=0xdbfb39eabe0938cb1495443b733e00bd90799a6d5ea870227d9f0e426091b480
GATEWAY_ADDRESS=0xdb46b6c133f989a776279be1ef95c2f3cc0be6cf8103d8ab390363964d475c13
GATEWAY_PRIVATE_KEY=suiprivkey1qq3s87q8jlf5p3h6edxemqdklzjkwcfxevmqhk2sdvndjtuahyw2qwnag0x
PORT=3001
GROQ_API_KEY=gsk_YOUR_GROQ_KEY
EOF

npm install
npm run dev        # ts-node gateway.ts or tsx gateway.ts
```

### 3. Test Health Endpoint

```bash
curl http://localhost:3001/health
```

Expected response:
```json
{
  "status": "ok",
  "package": "0xdbfb39eabe0938cb1495443b733e00bd90799a6d5ea870227d9f0e426091b480",
  "gateway": "0xdb46b6c133f989a776279be1ef95c2f3cc0be6cf8103d8ab390363964d475c13",
  "providers": {
    "groq": {
      "configured": true,
      "models": ["llama-3.1-8b-instant", "llama-3.3-70b-versatile", "mixtral-8x7b-32768"]
    },
    "openai": {
      "configured": false,
      "models": ["gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"]
    },
    "anthropic": {
      "configured": false,
      "models": ["claude-3-5-sonnet-20241022", "claude-3-haiku-20240307"]
    }
  }
}
```

---

## API Reference

### Health & Providers

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Gateway status, provider config |
| GET | `/providers` | List providers, models, cost rates |

### Agent Treasury Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/keys/create` | Generate API key for existing treasury |
| GET | `/keys/:wallet` | List API keys for wallet |
| POST | `/keys/revoke` | Revoke API key |
| GET | `/status/:treasuryId` | Full agent status (balance, policy, pause, reputation) |
| GET | `/agents/:wallet` | List all agent treasuries for wallet |

### Chat Completion

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/chat` | Chat completion with agent settlement |

### Pause/Resume

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/resume` | Resume via API key (if permitted) |
| POST | `/resume/:treasuryId` | Resume via treasury ID |

---

## Smart Contract Reference

### Core Objects

```move
struct AgentTreasury has key {
    id: UID,
    owner: address,
    parent: Option<ID>,           // None = root, Some = child
    name: String,
    balance: Balance<SUI>,        // OWNED funds
    policy: PolicySet,
    spend_tracking: SpendTracking,
    reputation: Reputation,
    paused: bool,
    created_at: u64,
}

struct PolicySet has store, drop {
    max_daily_spend: u64,
    max_monthly_spend: u64,
    max_single_spend: u64,
    approved_providers: vector<String>,
    velocity_threshold: u64,
}

struct TreasuryOwnerCap has key, store {
    id: UID,
    treasury_id: ID,
}
```

### Entry Functions

| Function | Who Calls | Description |
|----------|-----------|-------------|
| `create_master_treasury` | User (dashboard PTB) | Create root treasury with initial deposit |
| `spawn_child_agent` | User (dashboard PTB) | Split parent budget, create child object |
| `reclaim_child_budget` | User (dashboard PTB) | Destroy child, reclaim budget to parent |
| `authorize_agent_call` | Gateway | Settle spend from agent treasury to gateway |
| `pause_agent` | User or Gateway | Pause agent (soft pause via gateway, hard via PTB) |
| `resume_agent` | User (dashboard PTB) | Resume paused agent |
| `deposit` | Anyone | Add funds to any treasury |
| `withdraw` | User (dashboard PTB) | Withdraw funds from treasury |
| `update_policy` | User (dashboard PTB) | Update agent policy constraints |

### Events

| Event | Emitted By | Fields |
|-------|-----------|--------|
| `AgentCreated` | `create_master_treasury` | treasury_id, owner, parent, name, initial_budget, created_at |
| `ChildSpawned` | `spawn_child_agent` | parent_id, child_id, owner, budget, name |
| `BudgetReclaimed` | `reclaim_child_budget` | child_id, parent_id, amount, timestamp |
| `AgentPaused` | `pause_agent` | treasury_id, reason, auto, timestamp |
| `AgentResumed` | `resume_agent` | treasury_id, timestamp |
| `CallAuthorized` | `authorize_agent_call` | treasury_id, cost, provider, remaining_balance, timestamp |
| `FundsDeposited` | `deposit` | treasury_id, amount, source, timestamp |
| `FundsWithdrawn` | `withdraw` | treasury_id, amount, timestamp |

---

## Usage Examples

### Example 1: Create Master Treasury (Dashboard PTB)

```typescript
import { Transaction } from '@mysten/sui/transactions';

const tx = new Transaction();
tx.setGasBudget(10_000_000);

// Initial deposit
const [payment] = tx.splitCoins(tx.gas, [tx.pure.u64(100_000_000n)]); // 0.1 SUI

// Create policy
const policy = tx.moveCall({
  target: `${PACKAGE_ID}::agent_treasury::create_policy`,
  arguments: [
    tx.pure.u64(5_000_000n),           // max_daily_spend: 0.005 SUI
    tx.pure.u64(50_000_000n),          // max_monthly_spend: 0.05 SUI
    tx.pure.u64(1_000_000n),           // max_single_spend: 0.001 SUI
    tx.pure.vector('string', ['groq']), // approved_providers
    tx.pure.u64(5),                     // velocity_threshold: 5 req/min
  ],
});

// Create master treasury
tx.moveCall({
  target: `${PACKAGE_ID}::agent_treasury::create_master_treasury`,
  arguments: [
    payment,
    tx.pure.string('Master Treasury'),
    policy,
    tx.object('0x6'), // Clock
  ],
});

// Sign and execute with dapp-kit
signAndExecute({ transaction: tx }, {
  onSuccess: (result) => {
    console.log('Treasury created:', result.digest);
    // Extract treasury ID from created objects
  },
});
```

### Example 2: Spawn Child Agent (Dashboard PTB)

```typescript
const tx = new Transaction();
tx.setGasBudget(10_000_000);

// Get TreasuryOwnerCap from wallet (you own it)
const parentCap = tx.object(TREASURY_OWNER_CAP_ID);
const parentTreasury = tx.object(PARENT_TREASURY_ID);

// Create child policy
const childPolicy = tx.moveCall({
  target: `${PACKAGE_ID}::agent_treasury::create_policy`,
  arguments: [
    tx.pure.u64(2_000_000n),   // max_daily_spend
    tx.pure.u64(20_000_000n),  // max_monthly_spend
    tx.pure.u64(500_000n),     // max_single_spend
    tx.pure.vector('string', ['groq', 'cetus']),
    tx.pure.u64(3),
  ],
});

// Spawn child with 0.03 SUI budget
tx.moveCall({
  target: `${PACKAGE_ID}::agent_treasury::spawn_child_agent`,
  arguments: [
    parentCap,
    parentTreasury,
    tx.pure.u64(30_000_000n),  // budget: 0.03 SUI
    tx.pure.string('Trading Agent'),
    childPolicy,
    tx.object('0x6'),
  ],
});

signAndExecute({ transaction: tx }, { onSuccess: (result) => console.log(result) });
```

### Example 3: Reclaim Child Budget (Dashboard PTB)

```typescript
const tx = new Transaction();
tx.setGasBudget(10_000_000);

const parentCap = tx.object(TREASURY_OWNER_CAP_ID);
const parentTreasury = tx.object(PARENT_TREASURY_ID);
const childTreasury = tx.object(CHILD_TREASURY_ID); // Must be owned by parent

tx.moveCall({
  target: `${PACKAGE_ID}::agent_treasury::reclaim_child_budget`,
  arguments: [
    parentCap,
    parentTreasury,
    childTreasury,
    tx.object('0x6'),
  ],
});

signAndExecute({ transaction: tx }, { onSuccess: (result) => console.log(result) });
```

### Example 4: Create API Key (Gateway)

```bash
curl -X POST http://localhost:3001/keys/create \
  -H "Content-Type: application/json" \
  -d '{
    "wallet": "0x28441bfc3fe1f98e0dec5755322210c24d67054a23bacec2299f6d2f88fe8d47",
    "treasuryId": "0xabc123...",
    "label": "Trading Agent Key",
    "allowResume": true
  }'
```

Response:
```json
{
  "status": "success",
  "key": "otter_aB3xK9mP2vL7nQ4...",
  "wallet": "0x28441bfc3fe1f98e0dec5755322210c24d67054a23bacec2299f6d2f88fe8d47",
  "treasuryId": "0xabc123...",
  "label": "Trading Agent Key",
  "allowResume": true
}
```

### Example 5: Chat Completion (Agent API Key)

```bash
curl -X POST http://localhost:3001/v1/chat \
  -H "Authorization: Bearer otter_aB3xK9mP2vL7nQ4..." \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama-3.1-8b-instant",
    "messages": [{"role": "user", "content": "Analyze BTC price trend"}],
    "temperature": 0.7,
    "max_tokens": 256
  }'
```

Response:
```json
{
  "status": "success",
  "model": "llama-3.1-8b-instant",
  "content": "Based on current market data...",
  "usage": {
    "total_tokens": 128,
    "prompt_tokens": 12,
    "completion_tokens": 116
  },
  "cost": {
    "estimated": "50000",
    "actual": "64000",
    "currency": "MIST"
  },
  "settlement": {
    "digest": "CnELzt7KW7qnkC5VLhCBJQJ2ZTxwghV8aXR9kZR6P1Vh",
    "pending": "0",
    "lastSettled": 1718812800000
  },
  "velocity": {
    "rate": 1,
    "threshold": 8,
    "windowMs": 60000
  }
}
```

### Example 6: Check Agent Status

```bash
curl http://localhost:3001/status/0xabc123...
```

Response:
```json
{
  "treasuryId": "0xabc123...",
  "owner": "0x28441bfc3fe1f98e0dec5755322210c24d67054a23bacec2299f6d2f88fe8d47",
  "name": "Trading Agent",
  "parent": "0xdef456...",
  "balance": "27000000",
  "policy": {
    "maxDailySpend": 2000000,
    "maxMonthlySpend": 20000000,
    "maxSingleSpend": 500000,
    "approvedProviders": ["groq", "cetus"],
    "velocityThreshold": 3
  },
  "spendTracking": {
    "dailySpent": 64000,
    "monthlySpent": 128000,
    "lastDailyReset": 1718812800000,
    "lastMonthlyReset": 1718812800000
  },
  "reputation": {
    "totalSettled": 128000,
    "successfulCalls": 2,
    "violations": 0,
    "anomalyScore": 0,
    "lastActive": 1718812800000
  },
  "paused": {
    "onChain": false,
    "soft": null
  },
  "velocity": {
    "currentRate": 1,
    "windowMs": 60000,
    "threshold": 8
  },
  "ledger": {
    "reserved": "0",
    "spent": "0",
    "lastSettlement": 1718812800000
  }
}
```

### Example 7: Resume Paused Agent

```bash
# Via API key
curl -X POST http://localhost:3001/resume \
  -H "Authorization: Bearer otter_aB3xK9mP2vL7nQ4..."

# Via treasury ID (dashboard)
curl -X POST http://localhost:3001/resume/0xabc123...
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SUI_RPC` | Yes | Sui RPC endpoint (testnet recommended) |
| `PACKAGE_ID` | Yes | Deployed Otter package ID |
| `GATEWAY_ADDRESS` | Yes | Gateway Sui address for settlement |
| `GATEWAY_PRIVATE_KEY` | Yes | Gateway private key for signing settlement PTBs |
| `PORT` | No | Gateway port (default: 3001) |
| `GROQ_API_KEY` | Yes* | Groq API key (only live provider) |
| `OPENAI_API_KEY` | No | OpenAI API key (stub if missing) |
| `ANTHROPIC_API_KEY` | No | Anthropic API key (stub if missing) |

*Required for Groq provider to function.

---

## Data Persistence

The gateway stores state in JSON files under `./data/`:

| File | Purpose | Format |
|------|---------|--------|
| `api-keys.json` | API key → treasuryId mappings | `Record<string, AgentApiKey>` |
| `agent-ledger.json` | Per-agent spend tracking | `Record<string, AgentLedger>` |
| `paused-agents.json` | Soft pause state | `Record<string, PauseRecord>` |

**Note:** File-based persistence is for MVP only. Production should use SQLite or PostgreSQL.

---

## Provider Configuration

Provider rates are hardcoded in `gateway.ts` (MIST per 1K tokens):

| Provider | Model | Cost (MIST) |
|----------|-------|-------------|
| Groq | `llama-3.1-8b-instant` | 50,000 |
| Groq | `llama-3.3-70b-versatile` | 200,000 |
| Groq | `mixtral-8x7b-32768` | 120,000 |
| OpenAI | `gpt-4o` | 500,000 |
| OpenAI | `gpt-4o-mini` | 50,000 |
| OpenAI | `gpt-3.5-turbo` | 50,000 |
| Anthropic | `claude-3-5-sonnet-20241022` | 800,000 |
| Anthropic | `claude-3-haiku-20240307` | 100,000 |

Restart gateway to update rates. Dynamic updates planned for v0.4.

---

## Security Model

| Layer | Mechanism |
|-------|-----------|
| **On-chain ownership** | `TreasuryOwnerCap` required for all treasury mutations |
| **Non-custodial** | User signs all treasury operations; gateway only settles |
| **Policy enforcement** | Daily/monthly/single spend caps enforced on-chain |
| **Provider whitelist** | Only approved providers can be called per agent |
| **Velocity tracking** | Off-chain sliding window; auto-pause on anomaly |
| **Soft pause** | Gateway-level pause (immediate); on-chain pause via PTB |
| **API key isolation** | Each key maps to one treasury; revoked keys are dead |

---

## Batch Settlement

Every 5 minutes, the gateway automatically settles accumulated off-chain spend to on-chain:

```typescript
setInterval(runBatchSettlement, 5 * 60 * 1000);
```

If settlement fails 3 times consecutively, the agent is skipped and requires manual intervention.

---

## Next Steps

- [ ] Dashboard PTB integration (`create_master_treasury`, `spawn_child_agent`, `reclaim_child_budget`)
- [ ] Tree visualization with real-time object graph
- [ ] Parallel execution demo panel
- [ ] SuiScan object explorer links
- [ ] zkLogin for agent authentication (v0.4)
- [ ] Multi-asset treasuries (USDC, NAVI LP) (v0.4)
- [ ] Compute receipt NFTs with Kiosk (v0.4)
```

---

Now for testing the backend. Here's your step-by-step test plan:

**Step 1: Start the gateway**
```bash
cd otter-gateway
npm install
# Create .env with your values
npm run dev
```

**Step 2: Verify health**
```bash
curl http://localhost:3001/health
```

**Step 3: Test with a treasury ID**
Since you don't have a dashboard yet, you'll need to manually create a treasury via Sui CLI or BitLab, then test the gateway endpoints.

Do you want me to:
1. **Walk you through creating a test treasury via Sui CLI** so we can test the gateway endpoints?
2. **Move straight to the dashboard refactor** so you can create treasuries through the UI?

The gateway is ready to test, but you need at least one `AgentTreasury` object ID to hit `/status/:treasuryId` or `/v1/chat`.