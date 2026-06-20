# SEAL — Autonomous Agent Treasury Protocol

> Programmable bank accounts for AI agents on Sui.

## What This Is

SEAL gives every AI agent its own on-chain treasury — a Sui object that physically holds `Coin<SUI>`, enforces spending policies, and can be reclaimed atomically. No central custodian. No opaque billing. Just object-native budget control.

### Why It Exists

Today, AI agents run on API keys tied to a developer's credit card. If an agent goes rogue, gets prompt-injected, or spawns unexpected sub-agents, the bill spikes with no ceiling. There's no way to give a sub-agent a capped budget, no way to reclaim unused funds, and no audit trail of what was spent where.

SEAL fixes this by making each agent treasury a **first-class Sui object** with:
- **Owned balance** — the object literally holds its own SUI
- **Programmable policy** — daily caps, monthly caps, single-spend limits, approved providers
- **Hierarchical budgeting** — master treasuries spawn children with sub-budgets
- **Atomic reclaim** — pull remaining funds back to parent in one transaction
- **On-chain settlement** — every inference call deducts MIST and records the digest

### Why Sui

This architecture is impossible on account-based chains. Sui's object-centric design enables:
- **Physical ownership** — parent objects literally own child `Coin<SUI>` objects
- **Parallel execution** — independent agent treasuries settle simultaneously without contention
- **Atomic destruction** — reclaim and destroy child objects in a single PTB

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    SEAL Dashboard (Next.js)                   │
│  • Wallet connect  • Treasury tree UI  • PTB construction   │
│  • Agent spawn/reclaim  • Parallel demo  • SuiScan links    │
│  • API key generation  • Real-time balance monitoring        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    SEAL Gateway (Node/TS)                     │
│  • API key auth → treasuryId  • Provider routing (Groq live)  │
│  • Per-agent velocity tracking  • Soft pause/resume           │
│  • Immediate on-chain settlement  • Batch cleanup (2 min)   │
│  • Per-treasury serialization (prevents object-lock collisions)│
│  • Retryable vs non-retryable error classification           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Sui Move Contract (Testnet)                      │
│  • AgentTreasury (shared object)                            │
│  • create_master_treasury  • spawn_child_agent              │
│  • reclaim_child_budget (atomic)  • authorize_agent_call    │
│  • pause_agent / resume_agent  • Policy enforcement         │
│  • Events: AgentCreated, ChildSpawned, BudgetReclaimed, etc │
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
    │  Twitter    │     │  Trading    │
    │  Bot        │     │  Bot        │
    └──────┬──────┘     └──────┬──────┘
           │                   │
           │ API calls with    │ API calls with
           │ otter_... key     │ otter_... key
           ▼                   ▼
    ┌─────────────────────────────────────┐
    │         SEAL Gateway                │
    │  • Check on-chain balance           │
    │  • Check policy constraints         │
    │  • Call provider (Groq)             │
    │  • Settle via authorize_agent_call  │
    │  • Handle object-lock serialization │
    └─────────────────────────────────────┘
```

---

## File Structure

```
seal/
├── seal-contract/
│   ├── Move.toml
│   └── sources/
│       └── agent_treasury.move          # Core Move contract
│
├── seal-gateway/
│   ├── .env                             # Environment variables
│   ├── package.json
│   ├── tsconfig.json
│   ├── data/                            # Persistent state (JSON)
│   │   ├── api-keys.json               # API key → treasuryId mappings
│   │   ├── agent-ledger.json           # Per-agent spend tracking
│   │   └── paused-agents.json          # Soft pause state
│   └── gateway.ts                       # Main gateway server
│
├── seal-dashboard/
│   ├── .env.local
│   ├── package.json
│   ├── next.config.js
│   └── src/
│       └── app/
│           ├── page.tsx                  # Main dashboard
│           └── layout.tsx
│
├── seal-sdk/
│   ├── otter-sdk.ts                     # TypeScript SDK
│   ├── otter_sdk.py                     # Python SDK
│   ├── example.ts                       # TypeScript usage
│   ├── example.py                       # Python usage
│   └── README.md                        # SDK docs
│
└── README.md                            # This file
```

---

## Quick Start

### 1. Deploy Contract

```bash
cd seal-contract

# Build and deploy (BitLab IDE or CLI)
sui client publish --gas-budget 50000000

# Save the Package ID from output
export PACKAGE_ID="0xYOUR_PACKAGE_ID"
```

### 2. Start Gateway

```bash
cd seal-gateway

# Create .env
cat > .env << 'EOF'
SUI_RPC=https://sui-testnet-rpc.publicnode.com
PACKAGE_ID=0xYOUR_PACKAGE_ID
GATEWAY_ADDRESS=0xYOUR_GATEWAY_ADDRESS
GATEWAY_PRIVATE_KEY=YOUR_PRIVATE_KEY
PORT=3001
GROQ_API_KEY=gsk_YOUR_GROQ_KEY
EOF

npm install
npx tsx gateway.ts
```

### 3. Start Dashboard

```bash
cd seal-dashboard
npm install
npm run dev
```

Open `http://localhost:3000` and connect your Sui wallet.

---

## Usage

### For Treasury Owners (Dashboard)

1. **Connect wallet** — Click "Connect" in the dashboard
2. **Create master treasury** — Enter name + deposit (e.g., 0.1 SUI), click "Create Treasury"
3. **Spawn child agents** — Click "+ Spawn Child", set name + budget + daily cap
4. **Generate API keys** — Click "Create Key" on any agent, copy the key
5. **Monitor** — View balances, pause states, and SuiScan links in real time
6. **Reclaim** — Click "Reclaim" to atomically pull remaining budget back to parent

### For Agent Developers (SDK)

**TypeScript:**
```typescript
import { OtterAgent } from './otter-sdk';

const agent = new OtterAgent({
  gatewayUrl: 'http://localhost:3001',
  apiKey: 'otter_xxx...',
});

const response = await agent.chat([
  { role: 'user', content: 'Analyze BTC price trend' }
]);

console.log(response.content);
console.log(`Cost: ${response.cost.actual} MIST`);
console.log(`Settlement: ${response.settlement.digest}`);
```

**Python:**
```python
from otter_sdk import OtterAgent, ChatMessage

agent = OtterAgent(
    gateway_url="http://localhost:3001",
    api_key="otter_xxx...",
)

response = agent.chat([ChatMessage("user", "Analyze BTC price trend")])

print(response.content)
print(f"Cost: {response.cost.actual} MIST")
print(f"Settlement: {response.settlement.digest}")
```

**cURL:**
```bash
curl -X POST http://localhost:3001/v1/chat \
  -H "Authorization: Bearer otter_xxx..." \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama-3.1-8b-instant",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

---

## API Reference

### Health & Providers

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Gateway status, package, RPC, provider config |
| GET | `/providers` | List providers, models, cost rates |

### Agent Treasury Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/keys/create` | Generate API key for existing treasury |
| GET | `/keys/:wallet` | List API keys for wallet |
| POST | `/keys/revoke` | Revoke API key |
| GET | `/status/:treasuryId` | Full agent status (balance, policy, pause, reputation, ledger) |
| GET | `/agents/:wallet` | List all agent treasuries for wallet (tree structure) |
| POST | `/caps` | Get TreasuryOwnerCap objects for wallet |

### Chat Completion

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/v1/chat` | `Bearer otter_...` | Chat completion with on-chain settlement |

### Pause/Resume

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/resume` | `Bearer otter_...` | Resume via API key (if `allowResume`) |
| POST | `/resume/:treasuryId` | None | Resume via treasury ID (dashboard) |

### Chat Response Format

```json
{
  "status": "success",
  "model": "llama-3.1-8b-instant",
  "content": "...",
  "usage": {
    "total_tokens": 128,
    "prompt_tokens": 12,
    "completion_tokens": 116
  },
  "cost": {
    "estimated": "50000",
    "actual": "6400",
    "currency": "MIST"
  },
  "settlement": {
    "digest": "CnELzt7...",
    "error": null,
    "settled": true,
    "retryable": false,
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

---

## Smart Contract Reference

### Core Objects

```move
struct AgentTreasury has key {
    id: UID,
    owner: address,
    parent: Option<ID>,
    name: String,
    balance: Balance<SUI>,
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

| Function | Caller | Description |
|----------|--------|-------------|
| `create_master_treasury` | User (dashboard PTB) | Create root treasury with initial deposit |
| `spawn_child_agent` | User (dashboard PTB) | Split parent budget, create child object |
| `reclaim_child_budget` | User (dashboard PTB) | Destroy child, reclaim budget to parent atomically |
| `authorize_agent_call` | Gateway | Settle spend from agent treasury to gateway |
| `pause_agent` | User or Gateway | Pause agent |
| `resume_agent` | User (dashboard PTB) | Resume paused agent |
| `deposit` | Anyone | Add funds to any treasury |
| `withdraw` | User (dashboard PTB) | Withdraw funds from treasury |
| `update_policy` | User (dashboard PTB) | Update agent policy constraints |

### Events

| Event | Emitted By | Fields |
|-------|-----------|--------|
| `AgentCreated` | `create_master_treasury` | treasury_id, owner, name, initial_budget |
| `ChildSpawned` | `spawn_child_agent` | parent_id, child_id, budget, name |
| `BudgetReclaimed` | `reclaim_child_budget` | child_id, parent_id, amount |
| `CallAuthorized` | `authorize_agent_call` | treasury_id, cost, provider, remaining_balance |
| `AgentPaused` | `pause_agent` | treasury_id, reason, auto |
| `AgentResumed` | `resume_agent` | treasury_id |
| `FundsDeposited` | `deposit` | treasury_id, amount |
| `FundsWithdrawn` | `withdraw` | treasury_id, amount |

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

Restart gateway to update rates.

---

## Security Model

| Layer | Mechanism |
|-------|-----------|
| **On-chain ownership** | `TreasuryOwnerCap` required for all treasury mutations |
| **Non-custodial** | User signs all treasury operations; gateway only settles |
| **Policy enforcement** | Daily/monthly/single spend caps enforced on-chain in Move |
| **Provider whitelist** | Only approved providers can be called per agent |
| **Velocity tracking** | Off-chain sliding window; auto-pause on burst/spike |
| **Soft pause** | Gateway-level pause (immediate); on-chain pause via PTB |
| **API key isolation** | Each key maps to exactly one treasury; revoked keys are dead |
| **Settlement serialization** | Per-treasury lock prevents object-lock collisions |
| **Error classification** | Retryable errors (network, object locked) vs non-retryable (insufficient balance) |

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SUI_RPC` | Yes | Sui RPC endpoint |
| `PACKAGE_ID` | Yes | Deployed SEAL package ID |
| `GATEWAY_ADDRESS` | Yes | Gateway Sui address for settlement |
| `GATEWAY_PRIVATE_KEY` | Yes | Gateway private key for signing PTBs |
| `PORT` | No | Gateway port (default: 3001) |
| `GROQ_API_KEY` | Yes* | Groq API key |
| `OPENAI_API_KEY` | No | OpenAI API key (stub if missing) |
| `ANTHROPIC_API_KEY` | No | Anthropic API key (stub if missing) |

*Required for Groq provider.

---

## Data Persistence

The gateway stores state in JSON files under `./data/`:

| File | Purpose |
|------|---------|
| `api-keys.json` | API key → treasuryId mappings |
| `agent-ledger.json` | Per-agent spend tracking (reserved, spent, settlementFailures) |
| `paused-agents.json` | Soft pause state |

---

## SDK Reference

### TypeScript SDK

```typescript
import { OtterAgent } from './otter-sdk';

const agent = new OtterAgent({ gatewayUrl, apiKey });

// Chat
const response = await agent.chat(messages, { model, temperature, max_tokens });

// Status
const status = await agent.statusByTreasuryId(treasuryId);

// Resume
await agent.resume();

// Health
await agent.health();
```

### Python SDK

```python
from otter_sdk import OtterAgent, ChatMessage

agent = OtterAgent(gateway_url, api_key)

# Chat
response = agent.chat(messages, model, temperature, max_tokens)

# Status
status = agent.status(treasury_id)

# Resume
agent.resume()

# Health
agent.health()
```

---

## License

MIT
