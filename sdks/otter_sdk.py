# otter_sdk.py
# Otter v0.3 — Lightweight Agent SDK for Python
# pip install requests  # only dependency

import requests
from dataclasses import dataclass
from typing import List, Dict, Optional, Any


@dataclass
class ChatMessage:
    role: str  # "system" | "user" | "assistant"
    content: str


@dataclass
class ChatOptions:
    model: str = "llama-3.1-8b-instant"
    temperature: float = 0.7
    max_tokens: int = 256


@dataclass
class Usage:
    total_tokens: int
    prompt_tokens: int
    completion_tokens: int


@dataclass
class Cost:
    estimated: str
    actual: str
    currency: str


@dataclass
class Settlement:
    digest: Optional[str]
    error: Optional[str]
    settled: bool
    retryable: bool
    pending: str
    last_settled: int


@dataclass
class Velocity:
    rate: int
    threshold: int
    window_ms: int


@dataclass
class ChatResponse:
    status: str
    content: str
    model: str
    usage: Usage
    cost: Cost
    settlement: Settlement
    velocity: Velocity

    @classmethod
    def from_dict(cls, data: dict) -> "ChatResponse":
        return cls(
            status=data["status"],
            content=data["content"],
            model=data["model"],
            usage=Usage(**data["usage"]),
            cost=Cost(**data["cost"]),
            settlement=Settlement(
                digest=data["settlement"]["digest"],
                error=data["settlement"]["error"],
                settled=data["settlement"]["settled"],
                retryable=data["settlement"]["retryable"],
                pending=data["settlement"]["pending"],
                last_settled=data["settlement"]["lastSettled"],
            ),
            velocity=Velocity(
                rate=data["velocity"]["rate"],
                threshold=data["velocity"]["threshold"],
                window_ms=data["velocity"]["windowMs"],
            ),
        )


class OtterError(Exception):
    """Raised when the SEAL gateway returns an error."""

    def __init__(self, message: str, status_code: int = None, details: dict = None):
        super().__init__(message)
        self.status_code = status_code
        self.details = details or {}


class OtterAgent:
    """
    Lightweight SDK for the Otter/SEAL Autonomous Agent Treasury Protocol.

    Example:
        >>> from otter_sdk import OtterAgent, ChatMessage
        >>> agent = OtterAgent("http://localhost:3001", "otter_xxx...")
        >>> response = agent.chat([ChatMessage("user", "Hello")])
        >>> print(response.content)
        >>> print(f"Cost: {response.cost.actual} MIST")
    """

    def __init__(self, gateway_url: str, api_key: str):
        self.gateway_url = gateway_url.rstrip("/")
        self.api_key = api_key
        self._session = requests.Session()
        self._session.headers.update({
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        })

    def chat(
        self,
        messages: List[ChatMessage],
        model: str = "llama-3.1-8b-instant",
        temperature: float = 0.7,
        max_tokens: int = 256,
    ) -> ChatResponse:
        """
        Send a chat completion request through the SEAL gateway.
        Automatically handles balance checks, cost estimation, and on-chain settlement.
        """
        payload = {
            "model": model,
            "messages": [{"role": m.role, "content": m.content} for m in messages],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        response = self._session.post(f"{self.gateway_url}/v1/chat", json=payload)
        data = response.json()

        if not response.ok:
            raise OtterError(
                data.get("error", f"HTTP {response.status_code}"),
                status_code=response.status_code,
                details=data,
            )

        return ChatResponse.from_dict(data)

    def status(self, treasury_id: str) -> dict:
        """Get the agent's current on-chain status."""
        response = self._session.get(f"{self.gateway_url}/status/{treasury_id}")
        data = response.json()

        if not response.ok:
            raise OtterError(
                data.get("error", f"HTTP {response.status_code}"),
                status_code=response.status_code,
                details=data,
            )

        return data

    def resume(self) -> dict:
        """Resume a paused agent (if the API key has allowResume permission)."""
        response = self._session.post(f"{self.gateway_url}/resume")
        data = response.json()

        if not response.ok:
            raise OtterError(
                data.get("error", f"HTTP {response.status_code}"),
                status_code=response.status_code,
                details=data,
            )

        return data

    def health(self) -> dict:
        """Check if the gateway is healthy."""
        response = requests.get(f"{self.gateway_url}/health")
        return response.json()

    def __repr__(self):
        return f"OtterAgent(gateway={self.gateway_url}, key={self.api_key[:20]}...)"


def otter_chat(
    gateway_url: str,
    api_key: str,
    messages: List[ChatMessage],
    model: str = "llama-3.1-8b-instant",
    temperature: float = 0.7,
    max_tokens: int = 256,
) -> ChatResponse:
    """Convenience function for one-off chat calls."""
    agent = OtterAgent(gateway_url, api_key)
    return agent.chat(messages, model=model, temperature=temperature, max_tokens=max_tokens)