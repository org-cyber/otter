// example.ts
// Example: Using the Otter SDK in a TypeScript agent

import { OtterAgent, ChatMessage } from './otter_sdk';

async function main() {
  // Initialize agent with your API key (from the SEAL dashboard)
  const agent = new OtterAgent({
    gatewayUrl: 'http://localhost:3001',
    apiKey: 'otter_LfVsI4yRLU-4gxy5memht9xrq0A9z0rY',
  });

  // Check gateway health
  const health = await agent.health();
  console.log('Gateway:', health.status, '| Package:', health.package.slice(0, 16) + '...');

  // Simple chat
  const response = await agent.chat([
    { role: 'user', content: 'Write a tweet about Sui blockchain' }
  ], {
    model: 'llama-3.1-8b-instant',
    max_tokens: 128,
  });

  console.log('\n🤖 Agent says:');
  console.log(response.content);
  console.log('\n💰 Cost:', response.cost.actual, response.cost.currency);
  console.log('🔗 Settlement:', response.settlement.digest?.slice(0, 16) + '...');
  console.log('⚡ Velocity:', response.velocity.rate, '/', response.velocity.threshold);

  // Multi-turn conversation
  const conversation: ChatMessage[] = [
    { role: 'system', content: 'You are a helpful coding assistant.' },
    { role: 'user', content: 'Explain Sui object ownership' },
  ];

  const reply = await agent.chat(conversation, { max_tokens: 256 });
  console.log('\n💬 Reply:', reply.content.slice(0, 100) + '...');

  // Handle errors gracefully
  try {
    // This will fail if the agent is paused or out of balance
    const badAgent = new OtterAgent({
      gatewayUrl: 'http://localhost:3001',
      apiKey: 'otter_invalid_key_here',
    });
    await badAgent.chat([{ role: 'user', content: 'test' }]);
  } catch (err: any) {
    console.log('\n❌ Expected error:', err.message);
    console.log('Status:', err.status);
    console.log('Details:', err.details);
  }
}

main().catch(console.error);