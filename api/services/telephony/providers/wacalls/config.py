"""WaCalls telephony provider configuration schemas."""

from typing import List, Literal

from pydantic import BaseModel, Field


class WaCallsConfigurationRequest(BaseModel):
    """Request schema for WaCalls configuration."""

    provider: Literal["wacalls"] = Field(default="wacalls")
    bridge_url: str = Field(
        ...,
        description="WaCalls-Dograh bridge URL (e.g., http://bridge:8080)",
    )
    bridge_api_key: str = Field(
        default="",
        description="API key for the bridge (if authentication is enabled)",
    )
    from_numbers: List[str] = Field(
        default_factory=list,
        description="WhatsApp session IDs for outbound calls",
    )


class WaCallsConfigurationResponse(BaseModel):
    """Response schema for WaCalls configuration."""

    provider: Literal["wacalls"] = Field(default="wacalls")
    bridge_url: str
    bridge_api_key: str = Field(default="")
    from_numbers: List[str]
