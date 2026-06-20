from otter_sdk import OtterAgent, ChatMessage

agent = OtterAgent(
    gateway_url="http://localhost:3001",
    api_key="otter_LfVsI4yRLU-4gxy5memht9xrq0A9z0rY",
)

r = agent.chat([ChatMessage("user", "Say hi")])
print(r.content)
print(f"Cost: {r.cost.actual} MIST")
print(f"Settlement: {r.settlement.digest[:16]}...")
