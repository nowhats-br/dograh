"""WaCalls frame serializer.

Handles 16kHz PCM binary frames — zero conversion needed since both
WaCalls and Dograh use the same audio format.
"""

import struct
from typing import Optional

from loguru import logger
from pipecat.frames.frames import (
    AudioRawFrame,
    Frame,
    TextFrame,
)
from pipecat.serializers.base_serializer import FrameSerializer


class WaCallsFrameSerializer(FrameSerializer):
    """Serializer for WaCalls 16kHz PCM audio.

    Wire format:
    - Outgoing (pipeline → client): AudioRawFrame → raw bytes
    - Incoming (client → pipeline): raw bytes → AudioRawFrame

    No codec conversion — both sides use 16kHz mono Int16 LE PCM.
    """

    def __init__(self, stream_id: str, call_id: str):
        self.stream_id = stream_id
        self.call_id = call_id

    def serialize(self, frame: Frame) -> Optional[bytes | str]:
        """Serialize a frame to wire format."""
        if isinstance(frame, AudioRawFrame):
            return frame.audio
        elif isinstance(frame, TextFrame):
            return frame.text.encode() if frame.text else None
        return None

    def deserialize(self, data: bytes | str) -> Optional[Frame]:
        """Deserialize wire data to a frame."""
        if isinstance(data, bytes) and len(data) > 0:
            return AudioRawFrame(
                audio=data,
                sample_rate=16000,
                num_channels=1,
            )
        elif isinstance(data, str):
            return TextFrame(text=data)
        return None
