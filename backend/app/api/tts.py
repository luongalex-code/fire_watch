import os
import subprocess
import tempfile
from hashlib import sha256
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field, confloat

from app.core.config import get_settings


router = APIRouter(prefix="/api/tts", tags=["tts"])


class PiperTtsIn(BaseModel):
    text: str = Field(min_length=1, max_length=300)
    voice: str = "vi_VN-vais1000-medium"
    length_scale: confloat(gt=0.3, le=3.0) | None = None
    sentence_silence: confloat(ge=0.0, le=5.0) | None = None


def _cache_key(*, text: str, voice: str, model_path: str, length_scale: float, sentence_silence: float) -> str:
    raw = {
        "text": text,
        "voice": voice,
        "model_path": model_path,
        "length_scale": round(length_scale, 3),
        "sentence_silence": round(sentence_silence, 3),
    }
    return sha256(repr(raw).encode("utf-8")).hexdigest()


@router.post("/piper")
def synthesize_piper(payload: PiperTtsIn):
    settings = get_settings()
    if not settings.piper_tts_enabled:
        raise HTTPException(status_code=503, detail="Piper TTS is disabled.")
    if payload.voice != "vi_VN-vais1000-medium":
        raise HTTPException(status_code=400, detail="Unsupported Piper voice.")
    if not settings.piper_tts_model_path:
        raise HTTPException(status_code=503, detail="Piper model path is not configured.")
    if not os.path.exists(settings.piper_tts_model_path):
        raise HTTPException(status_code=503, detail="Piper model file was not found.")

    length_scale = float(payload.length_scale or settings.piper_tts_length_scale)
    sentence_silence = float(payload.sentence_silence or settings.piper_tts_sentence_silence)
    cache_dir = Path(settings.piper_tts_cache_dir)
    cache_dir.mkdir(parents=True, exist_ok=True)
    cache_path = cache_dir / f"{_cache_key(text=payload.text, voice=payload.voice, model_path=settings.piper_tts_model_path, length_scale=length_scale, sentence_silence=sentence_silence)}.wav"

    if cache_path.is_file():
        return Response(content=cache_path.read_bytes(), media_type="audio/wav")

    output_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as output_file:
            output_path = output_file.name

        subprocess.run(
            [
                settings.piper_tts_executable,
                "--model",
                settings.piper_tts_model_path,
                "--output_file",
                output_path,
                "--length_scale",
                str(length_scale),
                "--sentence_silence",
                str(sentence_silence),
            ],
            input=payload.text,
            text=True,
            check=True,
            capture_output=True,
            timeout=max(1, settings.piper_tts_timeout_seconds),
        )

        with open(output_path, "rb") as audio_file:
            audio_bytes = audio_file.read()
        cache_path.write_bytes(audio_bytes)
        return Response(content=audio_bytes, media_type="audio/wav")
    except subprocess.TimeoutExpired as exc:
        raise HTTPException(status_code=504, detail="Piper TTS timeout.") from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail="Piper executable was not found.") from exc
    except subprocess.CalledProcessError as exc:
        detail = (exc.stderr or exc.stdout or "Piper synthesis failed.").strip()
        raise HTTPException(status_code=500, detail=detail) from exc
    finally:
        if output_path and os.path.exists(output_path):
            os.remove(output_path)
