'use client';

import { useState, useEffect } from 'react';
import {
  ConnectButton,
  useCurrentAccount,
  useSignAndExecuteTransaction,
} from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';

const GATEWAY_URL = 'http://localhost:3001';

const PACKAGE_ID =
  '0x6e1de9eee9168dbf4803abf85fa955c0047111c8572ff74a3e47d3983bd61fd4';

const POOL_ID =
  '0xed89af9714f4d509c3a3578d295cd3acd71b4a4ae51dc6afca2d295ac96c9809';

  

export default function Home() {
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const wallet = account?.address;
    const [balance, setBalance] = useState<bigint | null>(null);
const [events, setEvents] = useState<any[]>([]);
const [loading, setLoading] = useState(false);
const [prompt, setPrompt] = useState('');
const [apiLoading, setApiLoading] = useState(false);
const [apiResponse, setApiResponse] = useState<any>(null);

  const refreshBalance = async () => {
    if (!wallet) return;

    try {
      const res = await fetch(
        `${GATEWAY_URL}/balance/${wallet}`
      );

      const data = await res.json();

      console.log('RAW BALANCE RESPONSE →', {
  balance: data.balance,
  type: typeof data.balance
});

     setBalance(BigInt(data.balance));
    } catch (err) {
      console.error('Balance fetch error:', err);
    }
  };

  const refreshEvents = async () => {
    if (!wallet) return;

    try {
      const res = await fetch(
        `${GATEWAY_URL}/events/${wallet}`
      );

      const data = await res.json();

      setEvents(data.events || []);
    } catch (err) {
      console.error('Events fetch error:', err);
    }
  };

  useEffect(() => {
    if (!wallet) return;

    refreshBalance();
    refreshEvents();
  }, [wallet]);

const handleApiCall = async () => {
  if (!wallet || !prompt.trim()) return;
  setApiLoading(true);
  setApiResponse(null);

  try {
    const cost = 1_000_000;

    // Step 1: Ask the gateway to settle payment on-chain
    const settleRes = await fetch(`${GATEWAY_URL}/settle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wallet: wallet,
        total_cost: cost,
        provider_name: 'local',
        provider_addr: '0xdb46b6c133f989a776279be1ef95c2f3cc0be6cf8103d8ab390363964d475c13',
        model_name: 'qwen2.5-coder-1.5b',
        tokens_used: prompt.length,
        request_hash: prompt.slice(0, 50),
      }),
    });

    const settleData = await settleRes.json();

    if (settleData.status !== 'success') {
      setApiResponse({
        content: `Settlement failed: ${settleData.message || 'Unknown error'}`,
      });
      setApiLoading(false);
      return;
    }

    const digest = settleData.digest;

    // Step 2: Call the AI with the payment receipt
    const gatewayRes = await fetch(`${GATEWAY_URL}/api/local`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-sui-payment': digest,
      },
      body: JSON.stringify({ prompt: prompt.trim() }),
    });

    const data = await gatewayRes.json();

    if (data.status === 'success') {
      setApiResponse({
        content: data.ai?.content || 'No response',
        receipt: {
          digest: digest,
          cost: cost.toString(),
          fee: (cost * 100 / 10000).toString(),
        },
      });
    } else {
      setApiResponse({
        content: `API Error: ${data.message || 'Unknown error'}`,
      });
    }

    await new Promise((r) => setTimeout(r, 1000));
    await refreshBalance();
    await refreshEvents();
    setApiLoading(false);

  } catch (err: any) {
    setApiResponse({
      content: `Error: ${err.message}`,
    });
    setApiLoading(false);
  }
};



  const handleQuickSetup = async () => {
    if (!wallet) {
      alert('Connect wallet first');
      return;
    }

    setLoading(true);

    try {
      const tx = new Transaction();

      tx.setGasBudget(10_000_000);

      // Split 0.05 SUI from gas coin
      const [paymentCoin] = tx.splitCoins(tx.gas, [
        tx.pure.u64(50_000_000n),
      ]);

      // Deposit
      tx.moveCall({
        target: `${PACKAGE_ID}::seal_api_pool::deposit_with_source`,
        arguments: [
          tx.object(POOL_ID),
          paymentCoin,
          tx.pure.vector(
            'u8',
            Array.from(
              new TextEncoder().encode('manual')
            )
          ),
          tx.object('0x6'),
        ],
      });

      // Global caps
      tx.moveCall({
        target: `${PACKAGE_ID}::seal_api_pool::set_spend_caps`,
        arguments: [
          tx.object(POOL_ID),
          tx.pure.u64(5_000_000n),
          tx.pure.u64(50_000_000n),
          tx.object('0x6'),
        ],
      });

      // Claude cap
      tx.moveCall({
        target: `${PACKAGE_ID}::seal_api_pool::set_provider_cap`,
        arguments: [
          tx.object(POOL_ID),
          tx.pure.vector(
            'u8',
            Array.from(
              new TextEncoder().encode('claude')
            )
          ),
          tx.pure.u64(2_000_000n),
          tx.object('0x6'),
        ],
      });

      // OpenAI cap
      tx.moveCall({
        target: `${PACKAGE_ID}::seal_api_pool::set_provider_cap`,
        arguments: [
          tx.object(POOL_ID),
          tx.pure.vector(
            'u8',
            Array.from(
              new TextEncoder().encode('openai')
            )
          ),
          tx.pure.u64(1_000_000n),
          tx.object('0x6'),
        ],
      });

      // Low balance alert
      tx.moveCall({
        target: `${PACKAGE_ID}::seal_api_pool::set_low_balance_threshold`,
        arguments: [
          tx.object(POOL_ID),
          tx.pure.u64(500_000n),
          tx.object('0x6'),
        ],
      });

      signAndExecute(
        {
          transaction: tx,
        },
        {
          onSuccess: async (result) => {
            alert(
              `PTB success!\nDigest: ${result.digest}`
            );

            // Give indexer time to catch up
            await new Promise((resolve) =>
              setTimeout(resolve, 2000)
            );

            await refreshBalance();
            await refreshEvents();
          },

          onError: (err) => {
            console.error(err);
            alert(
              'Transaction failed: ' + err.message
            );
          },
        }
      );
    } catch (err) {
      console.error(err);

      alert(
        'Error: ' + (err as Error).message
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: 800,
        margin: '0 auto',
        padding: 40,
      }}
    >
      <h1
        style={{
          fontSize: 32,
          marginBottom: 8,
        }}
      >
        SEAL Dashboard
      </h1>

      <p
        style={{
          color: '#888',
          marginBottom: 32,
        }}
      >
        Stablecoin-Enforced API Ledger
      </p>

      <div style={{ marginBottom: 32 }}>
        <ConnectButton />
      </div>

      {wallet && (
        <div>
          <div
            style={{
              background: '#111',
              padding: 24,
              borderRadius: 12,
              marginBottom: 24,
            }}
          >
            <h2
              style={{
                fontSize: 20,
                marginBottom: 16,
              }}
            >
              Wallet
            </h2>

            <p
              style={{
                fontFamily: 'monospace',
                fontSize: 14,
                color: '#aaa',
              }}
            >
              {wallet}
            </p>

            <div style={{ marginTop: 16 }}>
              <span
                style={{
                  fontSize: 48,
                  fontWeight: 'bold',
                }}
              >
             
  {balance !== null
    ? (Number(balance) / 1e9).toFixed(4)
    : '---'}
</span>

              <span
                style={{
                  color: '#888',
                  marginLeft: 8,
                }}
              >
                SUI
              </span>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              gap: 12,
              marginBottom: 24,
            }}
          >
            <button
              onClick={handleQuickSetup}
              disabled={loading}
              style={{
                padding: '16px 24px',
                fontSize: 16,
                fontWeight: 'bold',
                background: loading
                  ? '#333'
                  : '#00d4aa',
                color: '#000',
                border: 'none',
                borderRadius: 8,
                cursor: loading
                  ? 'not-allowed'
                  : 'pointer',
              }}
            >
              {loading
                ? 'Building...'
                : '⚡ Quick Setup (PTB)'}
            </button>
          </div>

          <div
            style={{
              background: '#111',
              padding: 24,
              borderRadius: 12,
            }}
          >
            <h2
              style={{
                fontSize: 20,
                marginBottom: 16,
              }}
            >
              Recent Events
            </h2>


            {events.length === 0 ? (
              <p style={{ color: '#888' }}>
                No events found
              </p>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                {events
                  .slice(0, 10)
                  .map((e, i) => (
                    <div
                      key={i}
                      style={{
                        padding: 12,
                        background: '#1a1a1a',
                        borderRadius: 8,
                        fontSize: 13,
                      }}
                    >
                      <div
                        style={{
                          color: '#00d4aa',
                          fontWeight: 'bold',
                        }}
                      >
                        {e.type
                          ?.split('::')
                          .pop() || 'Event'}
                      </div>

                      <div
                        style={{
                          color: '#888',
                          fontFamily:
                            'monospace',
                          fontSize: 11,
                          marginTop: 4,
                        }}
                      >
                        {e.id?.txDigest?.slice(
                          0,
                          20
                        )}
                        ...
                      </div>
                    </div>
                  ))}
              </div>
                      )}
          </div>

          {/* ── API Call Demo ── */}
                {/* ── API Call Demo ── */}
          <div
            style={{
              background: '#111',
              padding: 24,
              borderRadius: 12,
              marginTop: 24,
            }}
          >
            <h2 style={{ fontSize: 20, marginBottom: 16 }}>
              🤖 API Call Demo
            </h2>

            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Type a prompt..."
              rows={3}
              style={{
                width: '100%',
                padding: 12,
                background: '#1a1a1a',
                border: '1px solid #333',
                borderRadius: 8,
                color: '#fff',
                fontFamily: 'system-ui, sans-serif',
                fontSize: 14,
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />

            <div style={{ marginTop: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
              <button
                onClick={handleApiCall}
                disabled={apiLoading || !prompt.trim()}
                style={{
                  padding: '12px 24px',
                  fontSize: 16,
                  fontWeight: 'bold',
                  background: apiLoading ? '#333' : '#00d4aa',
                  color: '#000',
                  border: 'none',
                  borderRadius: 8,
                  cursor: apiLoading || !prompt.trim() ? 'not-allowed' : 'pointer',
                }}
              >
                {apiLoading ? 'Processing...' : '⚡ Pay & Call AI'}
              </button>

              <span style={{ color: '#888', fontSize: 14 }}>
                Cost: ~0.001 SUI
              </span>
            </div>

            {apiResponse && (
              <div
                style={{
                  marginTop: 16,
                  padding: 16,
                  background: '#1a1a1a',
                  borderRadius: 8,
                  border: '1px solid #333',
                }}
              >
                <div style={{ color: '#00d4aa', fontWeight: 'bold', marginBottom: 8 }}>
                  Response
                </div>
                <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {apiResponse.content}
                </div>
                {apiResponse.receipt && (
                  <div
                    style={{
                      marginTop: 12,
                      padding: 12,
                      background: '#0a0a0a',
                      borderRadius: 6,
                      fontSize: 12,
                      fontFamily: 'monospace',
                      color: '#888',
                    }}
                  >
                    <div>Tx: {apiResponse.receipt.digest?.slice(0, 20)}...</div>
                    <div>Cost: {apiResponse.receipt.cost} MIST</div>
                    <div>Fee: {apiResponse.receipt.fee} MIST</div>
                  </div>
                )}
              </div>
            )}
                   </div>
        </div>
      )}
    </div>
  );
}