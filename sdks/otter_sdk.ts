// otter-sdk.ts
// Otter v0.3 — Lightweight Agent SDK for TypeScript/JavaScript
// Drop this into any Node.js or browser project to integrate with SEAL

export interface OtterConfig {
  gatewayUrl: string;
  apiKey: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  max_tokens?: number;
}

export interface ChatResponse {
  status: string;
  content: string;
  model: string;
  usage: {
    total_tokens: number;
    prompt_tokens: number;
    completion_tokens: number;
  };
  cost: {
    estimated: string;
    actual: string;
    currency: string;
  };
  settlement: {
    digest: string | null;
    error: string | null;
    settled: boolean;
    retryable: boolean;
    pending: string;
    lastSettled: number;
  };
  velocity: {
    rate: number;
    threshold: number;
    windowMs: number;
  };
}

export interface AgentStatus {
  treasuryId: string;
  balance: string;
  paused: {
    onChain: boolean;
    soft: { pausedAt: number; reason: string; auto: boolean } | null;
  };
  velocity: {
    currentRate: number;
    threshold: number;
    windowMs: number;
  };
  ledger: {
    reserved: string;
    spent: string;
    lastSettlement: number;
    settlementFailures: number;
  };
}

export class OtterAgent {
  private config: OtterConfig;

  constructor(config: OtterConfig) {
    this.config = config;
  }

  /**
   * Send a chat completion request through the SEAL gateway.
   * Automatically handles balance checks, cost estimation, and on-chain settlement.
   */
  async chat(
    messages: ChatMessage[],
    options: ChatOptions = {}
  ): Promise<ChatResponse> {
    const {
      model = 'llama-3.1-8b-instant',
      temperature = 0.7,
      max_tokens = 256,
    } = options;

    const response = await fetch(`${this.config.gatewayUrl}/v1/chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const error = new Error(data.error || `HTTP ${response.status}`);
      (error as any).status = response.status;
      (error as any).details = data;
      throw error;
    }

    return data as ChatResponse;
  }

  /**
   * Get the agent's current status: balance, pause state, velocity, ledger.
   */
  async status(): Promise<AgentStatus> {
    // Extract treasuryId from the API key record via a gateway endpoint
    // The gateway doesn't expose treasuryId directly from key, so we use /status/:treasuryId
    // For now, this requires the user to know their treasuryId.
    // In v0.4, we could add /v1/status that reads from the key.
    throw new Error('Use statusByTreasuryId(treasuryId) for now. In v0.4, key-based status will be added.');
  }

  /**
   * Get status by explicit treasury ID.
   */
  async statusByTreasuryId(treasuryId: string): Promise<AgentStatus> {
    const response = await fetch(`${this.config.gatewayUrl}/status/${treasuryId}`);
    const data = await response.json();

    if (!response.ok) {
      const error = new Error(data.error || `HTTP ${response.status}`);
      (error as any).status = response.status;
      (error as any).details = data;
      throw error;
    }

    return data as AgentStatus;
  }

  /**
   * Resume a paused agent (if the API key has allowResume permission).
   */
  async resume(): Promise<{ status: string; treasuryId: string }> {
    const response = await fetch(`${this.config.gatewayUrl}/resume`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      const error = new Error(data.error || `HTTP ${response.status}`);
      (error as any).status = response.status;
      (error as any).details = data;
      throw error;
    }

    return data;
  }

  /**
   * Check if the agent is healthy and the gateway is reachable.
   */
  async health(): Promise<{ status: string; package: string; gateway: string }> {
    const response = await fetch(`${this.config.gatewayUrl}/health`);
    return response.json();
  }
}

/**
 * Convenience function for one-off chat calls without instantiating a class.
 */
export async function otterChat(
  gatewayUrl: string,
  apiKey: string,
  messages: ChatMessage[],
  options?: ChatOptions
): Promise<ChatResponse> {
  const agent = new OtterAgent({ gatewayUrl, apiKey });
  return agent.chat(messages, options);
}

export default OtterAgent;