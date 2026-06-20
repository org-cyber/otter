# example.py
# Example: Using the Otter SDK in a Python agent

from otter_sdk import OtterAgent, ChatMessage, OtterError


def main():
    # Initialize agent with your API key (from the SEAL dashboard)
    agent = OtterAgent(
        gateway_url="http://localhost:3001",
        api_key="otter_LfVsI4yRLU-4gxy5memht9xrq0A9z0rY",
    )

    # Check gateway health
    health = agent.health()
    print(f"Gateway: {health['status']} | Package: {health['package'][:16]}...")

    # Simple chat
    response = agent.chat(
        messages=[ChatMessage("user", "Write a tweet about Sui blockchain")],
        model="llama-3.1-8b-instant",
        max_tokens=128,
    )

    print(f"\n🤖 Agent says:\n{response.content}")
    print(f"\n💰 Cost: {response.cost.actual} {response.cost.currency}")
    print(f"🔗 Settlement: {response.settlement.digest[:16]}..." if response.settlement.digest else "🔗 Settlement: pending")
    print(f"⚡ Velocity: {response.velocity.rate}/{response.velocity.threshold}")

    # Multi-turn conversation
    conversation = [
        ChatMessage("system", "You are a helpful coding assistant."),
        ChatMessage("user", "Explain Sui object ownership"),
    ]

    reply = agent.chat(conversation, max_tokens=256)
    print(f"\n💬 Reply: {reply.content[:100]}...")

    # Check agent status (need treasury ID from dashboard)
    # status = agent.status("0xYOUR_TREASURY_ID")
    # print(f"\n📊 Balance: {status['balance']} MIST")
    # print(f"⏸️  Paused: {status['paused']['onChain']}")

    # Handle errors gracefully
    try:
        bad_agent = OtterAgent(
            gateway_url="http://localhost:3001",
            api_key="otter_invalid_key_here",
        )
        bad_agent.chat([ChatMessage("user", "test")])
    except OtterError as e:
        print(f"\n❌ Expected error: {e}")
        print(f"Status: {e.status_code}")
        print(f"Details: {e.details}")


if __name__ == "__main__":
    main()