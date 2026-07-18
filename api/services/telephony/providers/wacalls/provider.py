"""WaCalls telephony provider implementation.

Bridges Dograh voice agents with WhatsApp via the WaCalls-Dograh Bridge.
Uses 16kHz PCM binary frames over WebSocket — zero audio conversion.
"""

import json
from typing import Any, Dict, List, Optional

import aiohttp
from fastapi import WebSocket
from loguru import logger

from api.services.telephony.base import (
    CallInitiationResult,
    NormalizedInboundData,
    TelephonyProvider,
)


class WaCallsProvider(TelephonyProvider):
    """WaCalls telephony provider.

    Connects to the WaCalls-Dograh Bridge which manages WhatsApp sessions
    and audio relay. The bridge speaks 16kHz PCM over WebSocket, matching
    Dograh's internal pipeline rate.
    """

    PROVIDER_NAME = "wacalls"
    WEBHOOK_ENDPOINT = None  # Bridge handles events via WebSocket

    def __init__(self, config: Dict[str, Any]):
        self.bridge_url = config.get("bridge_url", "http://localhost:8080").rstrip("/")
        self.bridge_api_key = config.get("bridge_api_key", "")
        self.from_numbers = config.get("from_numbers", [])

        if isinstance(self.from_numbers, str):
            self.from_numbers = [self.from_numbers]

    def _headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.bridge_api_key:
            headers["X-API-Key"] = self.bridge_api_key
        return headers

    # ---- Outbound ----

    async def initiate_call(
        self,
        to_number: str,
        webhook_url: str,
        workflow_run_id: Optional[int] = None,
        from_number: Optional[str] = None,
        **kwargs: Any,
    ) -> CallInitiationResult:
        session_id = from_number or (self.from_numbers[0] if self.from_numbers else "")
        agent_uuid = kwargs.get("agent_uuid", "")

        if not session_id:
            raise ValueError("No WhatsApp session ID configured for WaCalls provider")

        payload = {
            "session_id": session_id,
            "phone_number": to_number,
            "agent_uuid": agent_uuid,
            "context": {
                "webhook_url": webhook_url,
                "workflow_run_id": workflow_run_id,
            },
        }

        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.bridge_url}/api/v1/calls/outbound",
                json=payload,
                headers=self._headers(),
            ) as resp:
                resp.raise_for_status()
                result = await resp.json()

        call_id = result.get("call_id", "")
        logger.info(
            f"[WaCalls] Outbound call initiated: {call_id} → {to_number}"
        )

        return CallInitiationResult(
            call_id=call_id,
            status="initiated",
            caller_number=session_id,
            provider_metadata={"session_id": session_id},
        )

    async def get_call_status(self, call_id: str) -> Dict[str, Any]:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{self.bridge_url}/api/v1/calls/{call_id}",
                headers=self._headers(),
            ) as resp:
                if resp.status == 200:
                    return await resp.json()
                return {"status": "unknown", "call_id": call_id}

    async def get_available_phone_numbers(self) -> List[str]:
        return self.from_numbers

    def validate_config(self) -> bool:
        return bool(self.bridge_url)

    async def get_call_cost(self, call_id: str) -> Dict[str, Any]:
        return {"cost_usd": 0.0, "note": "WhatsApp calls are free"}

    # ---- Webhooks (not used — bridge handles via WebSocket) ----

    async def verify_webhook_signature(
        self, url: str, params: Dict[str, Any], signature: str
    ) -> bool:
        return True

    async def get_webhook_response(
        self, workflow_id: int, organization_id: int, workflow_run_id: int
    ) -> str:
        return ""

    def parse_status_callback(self, data: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "call_id": data.get("call_id"),
            "status": data.get("status"),
            "duration": data.get("duration_seconds", 0),
        }

    # ---- WebSocket (main audio interface) ----

    async def handle_websocket(
        self,
        websocket: WebSocket,
        workflow_id: int,
        organization_id: int,
        workflow_run_id: int,
    ) -> None:
        from api.services.pipecat.run_pipeline import run_pipeline_telephony

        call_id = f"run-{workflow_run_id}"

        logger.info(
            f"[WaCalls] Starting pipeline for workflow_run {workflow_run_id}"
        )

        await run_pipeline_telephony(
            websocket,
            provider_name=self.PROVIDER_NAME,
            workflow_id=workflow_id,
            workflow_run_id=workflow_run_id,
            organization_id=organization_id,
            call_id=call_id,
            transport_kwargs={"call_id": call_id, "bridge_url": self.bridge_url},
        )

    # ---- Inbound ----

    @classmethod
    def can_handle_webhook(
        cls, webhook_data: Dict[str, Any], headers: Dict[str, str]
    ) -> bool:
        return False

    @staticmethod
    def parse_inbound_webhook(webhook_data: Dict[str, Any]) -> NormalizedInboundData:
        return NormalizedInboundData(
            provider="wacalls",
            call_id=webhook_data.get("call_id", ""),
            from_number=webhook_data.get("caller_number", ""),
            to_number=webhook_data.get("called_number", ""),
            direction="inbound",
            call_status="ringing",
            raw_data=webhook_data,
        )

    @staticmethod
    def validate_account_id(config_data: dict, webhook_account_id: str) -> bool:
        return True

    async def verify_inbound_signature(
        self,
        url: str,
        webhook_data: Dict[str, Any],
        headers: Dict[str, str],
        body: str = "",
    ) -> bool:
        return True

    async def start_inbound_stream(
        self,
        *,
        websocket_url: str,
        workflow_run_id: int,
        normalized_data,
        backend_endpoint: str,
    ):
        from fastapi import Response

        return Response(content="", status_code=204)

    @staticmethod
    def generate_error_response(error_type: str, message: str) -> tuple:
        from fastapi import Response

        return Response(
            content=json.dumps({"error": error_type, "message": message}),
            media_type="application/json",
        )

    # ---- Transfers (not supported on WhatsApp) ----

    def supports_transfers(self) -> bool:
        return False

    async def transfer_call(
        self,
        destination: str,
        transfer_id: str,
        conference_name: str,
        timeout: int = 30,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        return {"error": "transfer_not_supported"}
