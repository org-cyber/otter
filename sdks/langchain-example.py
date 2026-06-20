from langchain.llms.base import LLM
from otter_sdk import OtterAgent, ChatMessage

class OtterLLM(LLM):
    """LangChain LLM that routes through SEAL for on-chain budget control."""
    
    agent: OtterAgent
    
    def _call(self, prompt: str, stop=None):
        response = self.agent.chat([ChatMessage("user", prompt)])
        return response.content
    
    @property
    def _llm_type(self):
        return "otter"

# Now use it exactly like any other LangChain LLM
agent = OtterAgent(
    gateway_url="http://localhost:3001",
    api_key="otter_xxx..."  # from SEAL dashboard
)

llm = OtterLLM(agent=agent)

# Same LangChain code, but every call deducts from on-chain treasury
chain = LLMChain(llm=llm, prompt=PromptTemplate(...))
result = chain.run("What is Sui?")