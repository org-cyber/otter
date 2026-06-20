# Otter SDK

Lightweight SDKs for integrating with the **Otter/SEAL Autonomous Agent Treasury Protocol**.

## What This Is

Drop this SDK into your agent codebase. It handles:
- Authentication with your SEAL API key
- Chat completions via Groq (OpenAI-compatible)
- Automatic on-chain cost settlement
- Balance checking and error handling
- Agent pause/resume

## Quick Start

### TypeScript

```bash
npm install   # no dependencies needed, just fetch
```

```typescript
import { OtterAgent } from './otter-sdk';

const agent = new OtterAgent({
  gatewayUrl: 'http://localhost:3001',
  apiKey: 'otter_xxx...',  // from SEAL dashboard
});

const response = await agent.chat([
  { role: 'user', content: 'Hello' }
]);

console.log(response.content);
console.log(`Cost: ${response.cost.actual} MIST`);
```

### Python

```bash
pip install requests
```

```python
from otter_sdk import OtterAgent, ChatMessage

agent = OtterAgent(
    gateway_url="http://localhost:3001",
    api_key="otter_xxx...",  # from SEAL dashboard
)

response = agent.chat([
    ChatMessage("user", "Hello")
])

print(response.content)
print(f"Cost: {response.cost.actual} MIST")
```

## API Reference

### `OtterAgent(gatewayUrl, apiKey)`

Create an agent instance. The `apiKey` ties this agent to a specific treasury object on Sui.

### `agent.chat(messages, options?)`

Send a chat completion request.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `messages` | `ChatMessage[]` | required | Conversation history |
| `options.model` | `string` | `llama-3.1-8b-instant` | Model ID |
| `options.temperature` | `number` | `0.7` | Sampling temperature |
| `options.max_tokens` | `number` | `256` | Max tokens to generate |

**Returns:** `ChatResponse` with:
- `content` — the AI's response text
- `cost.actual` — MIST deducted from treasury
- `settlement.digest` — on-chain transaction digest
- `velocity.rate` — current request rate

### `agent.status(treasuryId)`

Get the agent's on-chain status: balance, pause state, ledger, velocity.

### `agent.resume()`

Resume a paused agent (requires `allowResume` permission on the API key).

### `agent.health()`

Check gateway connectivity and configuration.

## Error Handling

| Error | Status | Meaning | Fix |
|-------|--------|---------|-----|
| `Invalid or revoked API key` | 401 | Bad key | Check key in dashboard |
| `Insufficient balance` | 402 | Treasury empty | Deposit more SUI or reclaim from parent |
| `Agent paused` | 403 | Velocity triggered | Wait or resume via dashboard |
| `Rate limit exceeded` | 429 | Too many requests | Slow down |
| `Failed to verify on-chain balance` | 502 | RPC issue | Check gateway SUI_RPC env |

## Integration with Agent Frameworks

### LangChain (Python)

```python
from langchain.llms.base import LLM
from otter_sdk import OtterAgent, ChatMessage

class OtterLLM(LLM):
    agent: OtterAgent

    def _call(self, prompt: str, stop=None):
        response = self.agent.chat([ChatMessage("user", prompt)])
        return response.content

    @property
    def _llm_type(self):
        return "otter"

# Use in any LangChain chain
llm = OtterLLM(agent=OtterAgent("http://localhost:3001", "otter_xxx..."))
```

### CrewAI (Python)

```python
from crewai import Agent
from otter_sdk import OtterAgent, ChatMessage

class OtterCrewAgent(Agent):
    def __init__(self, otter_agent, **kwargs):
        super().__init__(**kwargs)
        self.otter = otter_agent

    def execute_task(self, task, context=None):
        response = self.otter.chat([
            ChatMessage("system", self.role),
            ChatMessage("user", task.description)
        ])
        return response.content
```

## Files

| File | Purpose |
|------|---------|
| `otter-sdk.ts` | TypeScript SDK |
| `otter_sdk.py` | Python SDK |
| `example.ts` | TypeScript usage example |
| `example.py` | Python usage example |

## Getting an API Key

1. Open the SEAL dashboard at `http://localhost:3000`
2. Connect your Sui wallet
3. Create a master treasury (deposit some SUI)
4. Spawn a child agent
5. Click "Create Key" on the agent
6. Copy the key — it looks like `otter_abc123...`
7. Paste it into your SDK code

That's it. Every chat call now deducts from your agent's on-chain budget automatically.
