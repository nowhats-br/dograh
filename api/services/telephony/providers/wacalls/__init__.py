"""WaCalls telephony provider package.

Bridges Dograh voice agents with WhatsApp via the WaCalls-Dograh Bridge.
Uses 16kHz PCM binary frames over WebSocket — zero audio conversion.
"""

from typing import Any, Dict

from api.services.telephony.registry import (
    ProviderSpec,
    ProviderUIField,
    ProviderUIMetadata,
    register,
)

from .config import WaCallsConfigurationRequest, WaCallsConfigurationResponse
from .provider import WaCallsProvider
from .transport import create_transport


def _config_loader(value: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "provider": "wacalls",
        "bridge_url": value.get("bridge_url", "http://localhost:8080"),
        "bridge_api_key": value.get("bridge_api_key", ""),
        "from_numbers": value.get("from_numbers", []),
    }


_UI_METADATA = ProviderUIMetadata(
    display_name="WaCalls (WhatsApp)",
    docs_url="https://github.com/JotaDev66/WaCalls",
    fields=[
        ProviderUIField(
            name="bridge_url",
            label="Bridge URL",
            type="text",
            description="URL of the WaCalls-Dograh Bridge (e.g., http://bridge:8080)",
        ),
        ProviderUIField(
            name="bridge_api_key",
            label="Bridge API Key",
            type="password",
            sensitive=True,
            description="API key for the bridge (leave empty if no auth)",
        ),
        ProviderUIField(
            name="from_numbers",
            label="WhatsApp Session IDs",
            type="string-array",
            description="Session IDs for outbound calls (from WaCalls /api/sessions)",
        ),
    ],
)


SPEC = ProviderSpec(
    name="wacalls",
    provider_cls=WaCallsProvider,
    config_loader=_config_loader,
    transport_factory=create_transport,
    transport_sample_rate=16000,
    config_request_cls=WaCallsConfigurationRequest,
    config_response_cls=WaCallsConfigurationResponse,
    ui_metadata=_UI_METADATA,
    account_id_credential_field="",
)


register(SPEC)


__all__ = [
    "SPEC",
    "WaCallsConfigurationRequest",
    "WaCallsConfigurationResponse",
    "WaCallsProvider",
    "create_transport",
]
