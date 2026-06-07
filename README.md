# SEAL — Stablecoin-Enforced API Ledger

> **Programmable API Payment Wallet on Sui**  
> *Built for Sui Overflow Hackathon — DeFi & Finance Track*

---

## Table of Contents

1. [Overview](#overview)
2. [The Problem](#the-problem)
3. [The Solution](#the-solution)
4. [Architecture](#architecture)
5. [Smart Contract](#smart-contract)
6. [Gateway Relay](#gateway-relay)
7. [x402 Sui Adapter](#x402-sui-adapter)
8. [Next.js Dashboard](#nextjs-dashboard)
9. [Onramp Integration](#onramp-integration)
10. [Getting Started](#getting-started)
11. [Deployment](#deployment)
12. [Hackathon Track Alignment](#hackathon-track-alignment)
13. [Team](#team)
14. [License](#license)

---

## Overview

SEAL is a **decentralized programmable API payment wallet** built on the Sui blockchain. It enables developers and teams to deposit stablecoins (SUI on testnet, USDC on mainnet), set granular spend controls, and pay for API services — all enforced on-chain.

**Key Innovation:** SEAL ports the [x402](https://x402.org) payment-required standard to Sui, making it the first blockchain-native programmable API treasury with per-member spend caps, per-provider budgets, and trust-minimized team treasuries.

**Live on Sui Testnet:** [View Contract on Suiscan](https://suiscan.xyz/testnet/object/0x6e1de9eee9168dbf4803abf85fa955c0047111c8572ff74a3e47d3983bd61fd4)

---

## The Problem

Every developer team in 2026 faces **API bill anxiety** from LLMs and AI services:

| Pain Point | Current State |
|------------|---------------|
| **Shared API keys** | One leaked key = unlimited spend. No on-chain enforcement. |
| **No spend caps** | $50/month becomes $5,000 overnight. No programmatic limits. |
| **No per-member budgets** | Junior dev burns budget on expensive models. No granular control. |
| **No audit trail** | Who spent what, when, on which model? Spreadsheet chaos. |
| **Fiat onramp friction** | African developers can't easily access USDC for API payments. |

**The result:** Teams either underuse AI (missing productivity) or overspend (burning runway). There's no middle ground enforced by code.

---

## The Solution

SEAL transforms API payments from **static transfers** into **programmable financial actions** on Sui:

```
┌─────────────────────────────────────────────────────────────────┐
│  SEAL: Every API call is an on-chain, rule-enforced payment    │
├─────────────────────────────────────────────────────────────────┤
│  Deposit → Set Caps → Call API → Auto-Settle → Receipt        │
│     ↑        ↑          ↑           ↑            ↓              │
│  Linq   On-Chain   x402 402   Gateway      Suiscan           │
│  Onramp   Rules    Protocol    Relay         Audit              │
└─────────────────────────────────────────────────────────────────┘
```

**What makes SEAL different:**

| Feature | Traditional API Key | SEAL |
|---------|-------------------|------|
| Spend enforcement | None (post-hoc billing) | On-chain caps (pre-enforcement) |
| Per-member budgets | Manual approval chains | Smart contract enforced |
| Per-provider limits | Not possible | `set_provider_cap(b"claude", 500_000_000)` |
| Audit trail | CSV exports | Immutable on-chain receipts |
| Team treasuries | Shared credit card | On-chain multi-sig budgets |
| Fiat onramp | Wire transfer (days) | Linq NGN→USDC (minutes) |

---

## Architecture

### System Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                     │
│  │  Developer   │  │  Team Admin  │  │  API Consumer│                     │
│  │  (Individual)│  │  (Multi-member)│  │  (x402 Client)│                  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘                     │
└─────────┼─────────────────┼─────────────────┼───────────────────────────────┘
          │                 │                 │
          ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND LAYER                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    Next.js Dashboard                                 │    │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐  │    │
│  │  │ Wallet      │ │ Deposit/    │ │ Spend Caps  │ │ Team        │  │    │
│  │  │ Connect     │ │ Withdraw    │ │ Settings    │ │ Treasury    │  │    │
│  │  │ (@mysten/   │ │ (Coin<T>)   │ │ (PTB)       │ │ Management  │  │    │
│  │  │  dapp-kit)  │ │             │ │             │ │             │  │    │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PROTOCOL LAYER                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    x402 Sui Adapter                                  │    │
│  │                                                                     │    │
│  │   HTTP Request ──► 402 Payment Required ──► Sui Tx Submission    │    │
│  │        ↑                                              │            │    │
│  │        └────────────────── API Response ◄─────────────┘            │    │
│  │                                                                     │    │
│  │   Implements: x402.org payment-required standard on Sui            │    │
│  │   Key feature: Payment proof verified on-chain before API access   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         GATEWAY LAYER                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    Gateway Relay (Node.js/TypeScript)                │    │
│  │                                                                     │    │
│  │   ┌─────────────┐   ┌─────────────┐   ┌─────────────────────────┐  │    │
│  │   │  Balance    │   │  Settle     │   │  API Proxy              │  │    │
│  │   │  Check      │   │  Payment    │   │  (Claude/OpenAI/AWS)    │  │    │
│  │   │  (View fn)  │   │  (authorize │   │                         │  │    │
│  │   │             │   │   _call)    │   │  1. Verify on-chain     │  │    │
│  │   │  get_balance│   │             │   │  2. Proxy to provider   │  │    │
│  │   │             │   │  Deducts    │   │  3. Return response     │  │    │
│  │   │  No gas     │   │  1% fee     │   │                         │  │    │
│  │   └─────────────┘   └─────────────┘   └─────────────────────────┘  │    │
│  │                                                                     │    │
│  │   Stateless. Horizontally scalable. One gateway wallet =           │    │
│  │   authorized signer for all settlements.                           │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         BLOCKCHAIN LAYER                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    Sui Smart Contract (Move)                         │    │
│  │                                                                     │    │
│  │   ┌─────────────────────────────────────────────────────────────┐    │    │
│  │   │                    SealAPIPool (Shared Object)             │    │    │
│  │   │                                                             │    │    │
│  │   │   Treasury: Coin<SUI>  (mainnet: Coin<USDC>)              │    │    │
│  │   │                                                             │    │    │
│  │   │   wallet_records: Table<address, WalletRecord>              │    │    │
│  │   │   ├── balance, total_spent, daily_spent, monthly_spent      │    │    │
│  │   │   ├── daily_cap, monthly_cap                              │    │    │
│  │   │   ├── provider_caps: Table<bytes, ProviderCapRecord>      │    │    │
│  │   │   ├── paused: bool                                        │    │    │
│  │   │   └── low_balance_threshold: u64                          │    │    │
│  │   │                                                             │    │    │
│  │   │   teams: Table<address, TeamRecord>                         │    │    │
│  │   │   ├── admin, team_balance, team_daily_cap                  │    │    │
│  │   │   └── members: Table<address, MemberRecord>               │    │    │
│  │   │                                                             │    │    │
│  │   │   authorized_gateways: Table<address, bool>               │    │    │
│  │   │   protocol_wallet: address                                │    │    │
│  │   │                                                             │    │    │
│  │   │   total_deposited, total_disbursed, total_fees_collected   │    │    │
│  │   └─────────────────────────────────────────────────────────────┘    │    │
│  │                                                                     │    │
│  │   ┌─────────────────────────────────────────────────────────────┐    │    │
│  │   │                    AdminCap (Owned Object)                 │    │    │
│  │   │   - add_gateway()                                          │    │    │
│  │   │   - remove_gateway()                                       │    │    │
│  │   │   - update_protocol_wallet()                               │    │    │
│  │   └─────────────────────────────────────────────────────────────┘    │    │
│  │                                                                     │    │
│  │   Events: DepositEvent, ApiCallReceiptEvent, TeamCreatedEvent,    │    │
│  │   LowBalanceAlertEvent, WalletPauseEvent, ProviderCapSetEvent   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ONRAMP LAYER                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    Linq Integration (uselinq.xyz)                  │    │
│  │                                                                     │    │
│  │   NGN (Naira) ──► Linq Onramp ──► USDC ──► Sui Wallet ──► SEAL   │    │
│  │                                                                     │    │
│  │   On-chain source metadata: deposit_with_source(b"linq")          │    │
│  │   Every Linq deposit permanently traceable on Suiscan               │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Data Flow: Single API Call

```
┌──────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Client  │────►│   Gateway    │────►│    Sui       │────►│   API        │
│  App     │     │   Relay      │     │   Contract   │     │  Provider    │
└──────────┘     └──────────────┘     └──────────────┘     └──────────────┘
      │                │                    │                    │
      │ 1. POST /api   │                    │                    │
      │    + wallet    │                    │                    │
      │    + provider  │                    │                    │
      │────────────────►│                    │                    │
      │                │ 2. Check balance   │                    │
      │                │    (get_balance)   │                    │
      │                │───────────────────►│                    │
      │                │                    │                    │
      │                │ 3. Return balance  │                    │
      │                │◄───────────────────│                    │
      │                │                    │                    │
      │                │ 4. authorize_call  │                    │
      │                │    (deduct + fee)   │                    │
      │                │───────────────────►│                    │
      │                │                    │                    │
      │                │ 5. Emit receipt     │                    │
      │                │    event            │                    │
      │                │◄───────────────────│                    │
      │                │                    │                    │
      │                │ 6. Proxy request    │                    │
      │                │    to provider      │                    │
      │                │─────────────────────────────────────────►│
      │                │                    │                    │
      │                │ 7. Return response │                    │
      │                │◄─────────────────────────────────────────│
      │                │                    │                    │
      │ 8. Return API  │                    │                    │
      │    response +  │                    │                    │
      │    tx digest   │                    │                    │
      │◄───────────────│                    │                    │
```

### Data Flow: x402 Payment-Required

```
┌──────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Client  │     │   x402       │     │    Sui       │     │   API        │
│  (No     │     │   Adapter    │     │   Wallet     │     │  Provider    │
│  Payment)│     │              │     │   (Browser)  │     │              │
└──────────┘     └──────────────┘     └──────────────┘     └──────────────┘
      │                │                    │                    │
      │ 1. GET /api    │                    │                    │
      │────────────────►│                    │                    │
      │                │                    │                    │
      │ 2. 402 Payment │                    │                    │
      │    Required    │                    │                    │
      │    + Sui tx    │                    │                    │
      │◄───────────────│                    │                    │
      │                │                    │                    │
      │ 3. Sign &      │                    │                    │
      │    submit tx   │                    │                    │
      │─────────────────────────────────────►│                    │
      │                │                    │                    │
      │                │ 4. Verify on-chain │                    │
      │                │    (gateway polls) │                    │
      │                │─────────────────────────────────────────►│
      │                │                    │                    │
      │                │ 5. Return API     │                    │
      │                │    response        │                    │
      │◄───────────────│◄─────────────────────────────────────────│
```

---

## Smart Contract

### Module: `seal::seal_api_pool`

**Language:** Move on Sui  
**Network:** Sui Testnet (mainnet-ready via `Coin<T>` swap)  
**Package ID:** `0x6e1de9eee9168dbf4803abf85fa955c0047111c8572ff74a3e47d3983bd61fd4`

### Core Structs

```move
/// Main shared pool object
public struct SealAPIPool has key {
    id: UID,
    treasury: Coin<SUI>,              // Generic Coin<T> — swap to USDC on mainnet
    wallet_records: Table<address, WalletRecord>,
    teams: Table<address, TeamRecord>,
    authorized_gateways: Table<address, bool>,
    protocol_wallet: address,
    // ... lifetime stats
}

/// Individual developer wallet
public struct WalletRecord has store {
    balance: u64,
    total_spent: u64,
    daily_cap: u64,
    monthly_cap: u64,
    daily_spent: u64,
    monthly_spent: u64,
    daily_window_start: u64,
    monthly_window_start: u64,
    call_count: u64,
    created_at: u64,
    provider_caps: Table<vector<u8>, ProviderCapRecord>,
    paused: bool,
    low_balance_threshold: u64,
}

/// Team treasury with per-member caps
public struct TeamRecord has store {
    admin: address,
    team_balance: u64,
    team_daily_cap: u64,
    team_daily_spent: u64,
    team_daily_window_start: u64,
    team_monthly_cap: u64,
    team_monthly_spent: u64,
    team_monthly_window_start: u64,
    members: Table<address, MemberRecord>,
    total_deposited: u64,
    total_spent: u64,
    call_count: u64,
    created_at: u64,
}
```

### Key Entry Functions

| Function | Caller | Description |
|----------|--------|-------------|
| `deposit()` / `deposit_with_source()` | Anyone | Deposit SUI into personal wallet. Source metadata (`b"linq"`, `b"manual"`, `b"p2p"`) recorded on-chain. |
| `withdraw()` | Wallet owner | Non-custodial withdrawal. Instant. No permission needed. |
| `set_spend_caps()` | Wallet owner | Set global daily/monthly spend limits. |
| `set_provider_cap()` | Wallet owner | Set per-provider daily cap (e.g., `b"claude"` → 0.5 SUI/day). |
| `set_low_balance_threshold()` | Wallet owner | Alert when balance drops below threshold. |
| `pause_wallet()` / `unpause_wallet()` | Wallet owner | Emergency stop. Blocks API calls, withdrawals still work. |
| `authorize_call()` | Authorized gateway | Deduct payment, enforce all caps, split 1% fee / 99% provider, emit receipt. |
| `create_team()` | Anyone | Create shared team treasury with initial deposit. |
| `add_team_member()` | Team admin | Add member with individual daily cap. |
| `deposit_to_team()` | Team admin | Top up team budget. |
| `authorize_team_call()` | Authorized gateway | Team API call: deduct from team pool + enforce member cap. |
| `add_gateway()` / `remove_gateway()` | Admin (AdminCap) | Authorize/deauthorize gateway wallets. |
| `update_protocol_wallet()` | Admin (AdminCap) | Set fee recipient address. |

### Fee Structure

```
Total Cost = API Provider Fee + Protocol Fee
           = 99%              + 1%

Example: 100 MIST total cost
  → 99 MIST to API provider wallet
  → 1 MIST to protocol wallet (revenue)
```

**Competitive:** 1% is aligned with x402 ecosystem standards. Generates meaningful revenue at volume.

### Event System (Immutable Audit Trail)

Every financial action emits an on-chain event:

```move
public struct ApiCallReceiptEvent has copy, drop {
    wallet: address,
    cost: u64,                    // 99% to provider
    fee: u64,                     // 1% protocol
    provider: vector<u8>,          // b"claude", b"openai"
    model_name: vector<u8>,        // b"claude-sonnet-4-6"
    tokens_used: u64,
    request_hash: vector<u8>,      // SHA256 for audit
    remaining_balance: u64,
    daily_spent: u64,
    monthly_spent: u64,
    timestamp: u64,
    wallet_call_number: u64,      // sequential invoice number
    is_team_call: bool,
}
```

**Queryable on Suiscan:** Every receipt is permanently visible and verifiable.

---

## Gateway Relay

**Tech Stack:** Node.js, TypeScript, Express, `@mysten/sui`  
**State:** Stateless. Horizontally scalable.  
**Responsibility:** The only authorized signer for on-chain settlements.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Service status, pool/gateway info |
| `GET` | `/balance/:wallet` | Check wallet balance (gasless view call) |
| `POST` | `/settle` | Settle payment on-chain, return receipt |
| `POST` | `/api/:provider` | Full flow: settle + proxy to API provider |

### Settlement Flow

```typescript
// 1. Gateway validates caller is authorized
assert(is_gateway(pool, tx_context::sender(ctx)), E_UNAUTHORIZED_GATEWAY);

// 2. Check wallet not paused
assert(!rec.paused, E_WALLET_PAUSED);

// 3. Reset time windows if elapsed
if (now >= rec.daily_window_start + MS_PER_DAY) { rec.daily_spent = 0; }
if (now >= rec.monthly_window_start + MS_PER_MONTH) { rec.monthly_spent = 0; }

// 4-7. Enforce caps: balance, daily, monthly, provider
assert(rec.balance >= total_cost, E_INSUFFICIENT_BALANCE);
// ... cap checks

// 8. Fee split: 1% protocol, 99% provider
let fee = (total_cost * 100) / 10_000;     // 1%
let provider_payment = total_cost - fee;     // 99%

// 9. Transfer coins from treasury
let provider_coin = coin::split(&mut pool.treasury, provider_payment, ctx);
transfer::public_transfer(provider_coin, provider_addr);
transfer::public_transfer(fee_coin, pool.protocol_wallet);

// 10. Emit receipt for audit
event::emit(ApiCallReceiptEvent { ... });
```

**Atomic:** Any failure at any step reverts the entire transaction. No partial deductions.

---

## x402 Sui Adapter

**What is x402?**  
x402 is an open standard for HTTP payment-required flows. A server returns `402 Payment Required` with payment details; the client submits payment and retries.

**SEAL's Innovation:** The first x402 implementation on Sui, using Move objects and PTBs instead of Ethereum transactions.

### x402 Flow on SEAL

```
Client Request ──► 402 Payment Required ──► Sui Tx (Client Wallet)
                      │                           │
                      │                           ▼
                      │                    On-Chain Settlement
                      │                    (authorize_call)
                      │                           │
                      │                           ▼
                      └─────────────◄─────── Tx Proof (Receipt)
                                          │
                                          ▼
                                    API Response
```

### Adapter Middleware

```typescript
// Express middleware implementing x402 on Sui
function x402Adapter(options: {
  poolId: string;
  gatewayUrl: string;
  minCost: bigint;
}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Check if request includes valid payment proof
    const paymentProof = req.headers['x-sui-payment'];

    if (!paymentProof) {
      // Return 402 with payment requirements
      return res.status(402).json({
        error: 'Payment Required',
        payment: {
          network: 'sui:testnet',
          pool: options.poolId,
          gateway: options.gatewayUrl,
          amount: options.minCost.toString(),
          currency: 'SUI',
        },
      });
    }

    // Verify payment proof on-chain
    const receipt = await verifyPaymentOnChain(paymentProof);
    if (!receipt.valid) {
      return res.status(402).json({ error: 'Invalid payment' });
    }

    // Payment valid — proceed to API
    next();
  };
}
```

**Why this matters:** Any API provider can add `x402Adapter` to their Express server and instantly accept Sui-based payments. No contract integration needed on their side.

---

## Next.js Dashboard

**Tech Stack:** Next.js 14, Tailwind CSS, `@mysten/dapp-kit`, `@mysten/sui`  
**Features:**

### Individual Wallet

| Feature | Description |
|---------|-------------|
| **Wallet Connect** | `@mysten/dapp-kit` integration (Slush, Sui Wallet, etc.) |
| **Deposit** | Send SUI to pool via `deposit()` or `deposit_with_source()` |
| **Withdraw** | Non-custodial withdrawal to connected wallet |
| **Spend Caps** | Set daily/monthly limits with sliders |
| **Provider Caps** | Per-API-provider budgets (Claude, OpenAI, AWS) |
| **Low Balance Alert** | Configure threshold, receive push notifications |
| **Pause/Resume** | Emergency stop with one click |
| **Transaction History** | Query `ApiCallReceiptEvent` events from RPC |

### Team Treasury

| Feature | Description |
|---------|-------------|
| **Create Team** | Initialize team with deposit and caps |
| **Add Members** | Invite developers with individual daily caps |
| **Member Management** | View member spend, pause members |
| **Team Budget** | Shared pool with admin controls |
| **Team History** | `TeamCallReceiptEvent` audit trail |

### Programmable Transaction Blocks (PTBs)

**"Quick Setup" Button:** One transaction, 6 actions:

```typescript
const tx = new Transaction();

// 1. Split coin for deposit
const [payment] = tx.splitCoins(coin, [tx.pure.u64(1_000_000_000)]);

// 2. Deposit
tx.moveCall({ target: `${PKG}::deposit_with_source`, args: [pool, payment, clock] });

// 3. Set global caps
tx.moveCall({ target: `${PKG}::set_spend_caps`, args: [pool, daily, monthly, clock] });

// 4. Set Claude cap
tx.moveCall({ target: `${PKG}::set_provider_cap`, args: [pool, b"claude", cap, clock] });

// 5. Set OpenAI cap
tx.moveCall({ target: `${PKG}::set_provider_cap`, args: [pool, b"openai", cap, clock] });

// 6. Set alert threshold
tx.moveCall({ target: `${PKG}::set_low_balance_threshold`, args: [pool, threshold, clock] });

// ONE approval, ONE gas fee, ONE transaction
await signAndExecuteTransactionBlock({ transactionBlock: tx });
```

**Result:** 6 operations, 1 click, 2 seconds, atomic success/failure.

---

## Onramp Integration

### Linq (Primary Partner)

**URL:** [uselinq.xyz](https://uselinq.xyz)  
**Flow:**

```
User (NGN) ──► Linq App ──► Bank Transfer / Card ──► Linq Settlement
                                                    │
                                                    ▼
                                              USDC on Sui
                                                    │
                                                    ▼
                                              SEAL deposit_with_source(b"linq")
                                                    │
                                                    ▼
                                              On-chain receipt with source metadata
```

**On-chain traceability:** Every Linq-sourced deposit is permanently tagged `b"linq"` in the `DepositEvent.source` field. Auditable on Suiscan.

### Alternative Onramps

| Source | Identifier | Use Case |
|--------|-----------|----------|
| Linq | `b"linq"` | Primary: NGN→USDC for African developers |
| Manual | `b"manual"` | Direct crypto deposit from CEX/DEX |
| P2P | `b"p2p"` | Peer-to-peer USDC acquisition |

---

## Getting Started

### Prerequisites

- Node.js 18+
- Sui CLI (for local testing)
- Testnet SUI from [faucet.sui.io](https://faucet.sui.io)

### Clone & Install

```bash
git clone https://github.com/your-org/seal.git
cd seal

# Install dependencies
npm install

# Smart contract (BitsLab IDE or Sui CLI)
# Deployed package: 0x6e1de9...bd61fd4

# Gateway
npm install
npm run dev:gateway

# Dashboard
npm install
npm run dev:dashboard
```

### Environment Variables

```env
# Sui Network
SUI_RPC=https://fullnode.testnet.sui.io:443
SUI_NETWORK=testnet

# Contract IDs
PACKAGE_ID=0x6e1de9eee9168dbf4803abf85fa955c0047111c8572ff74a3e47d3983bd61fd4
POOL_ID=0xed89af9714f4d509c3a3578d295cd3acd71b4a4ae51dc6afca2d295ac96c9809

# Gateway
GATEWAY_ADDRESS=0xdb46b6c133f989a776279be1ef95c2f3cc0be6cf8103d8ab390363964d475c13
GATEWAY_PRIVATE_KEY=<your_private_key>

# Dashboard
NEXT_PUBLIC_PACKAGE_ID=0x6e1de9...
NEXT_PUBLIC_POOL_ID=0xed89af...
```

---

## Deployment

### Docker

```dockerfile
# Gateway
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["node", "dist/gateway.js"]
```

```bash
docker build -t seal-gateway .
docker run -p 3000:3000 --env-file .env seal-gateway
```

### Live Demo

- **Contract:** [Suiscan Testnet](https://suiscan.xyz/testnet/object/0x6e1de9eee9168dbf4803abf85fa955c0047111c8572ff74a3e47d3983bd61fd4)
- **Dashboard:** [https://seal-dashboard.vercel.app](https://seal-dashboard.vercel.app) *(placeholder)*
- **Gateway:** [https://seal-gateway.fly.dev](https://seal-gateway.fly.dev) *(placeholder)*

---

## Hackathon Track Alignment

### Sui Overflow — DeFi & Finance Track

| Judging Criteria | How SEAL Delivers |
|-----------------|-------------------|
| **Clear financial use case** | API spend management is a real, urgent problem for every dev team |
| **Correct handling of assets** | Move object model, `Coin<T>` generic treasury, capability-based admin |
| **Working end-to-end** | Linq → Sui → Gateway → x402 → API → Dashboard |
| **Novel use of PTBs** | "Quick Setup" bundles 6 operations into 1 atomic transaction |
| **Strong composability** | x402 adapter lets any API provider accept Sui payments without contract changes |
| **Real-world applicability** | African developers can pay for Claude via Linq NGN→USDC onramp |

### Category Fit

| Category | Fit |
|----------|-----|
| **Payments & Consumer Finance** | ✅ Primary — smart wallet for API payments |
| **Trust-Minimized Finance** | ✅ Strong — team treasuries with on-chain enforced caps |
| **Financial Automation** | ✅ Strong — rule-based auto-enforcement of budgets |
| **Infrastructure & Tooling** | ✅ Moderate — x402 Sui adapter is developer infrastructure |

---

## Team

**SEAL** was built for the Sui Overflow Hackathon, DeFi & Finance Track.

- **Smart Contract:** Move on Sui, deployed via BitsLab IDE
- **Gateway:** Node.js/TypeScript, stateless, horizontally scalable
- **Frontend:** Next.js + Tailwind + `@mysten/dapp-kit`
- **Onramp:** Linq partnership for African market access

---

## License

MIT License — see [LICENSE](./LICENSE) for details.

---

## Acknowledgments

- [Sui Foundation](https://sui.io/) for the Overflow Hackathon and Move language
- [x402](https://x402.org/) for the payment-required standard
- [Linq](https://uselinq.xyz/) for the NGN→USDC onramp partnership
- [BitsLab IDE](https://bitslab.xyz/) for Move development environment

---

> **"From Naira to Claude, trustlessly."**
# SEAL
