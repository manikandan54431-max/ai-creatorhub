"""
PixVerse API adapter — the ONLY module that talks to PixVerse.
==============================================================
Official PixVerse Platform API (verified against docs.platform.pixverse.ai):

  Generate (text-to-video):
    POST {base}/openapi/v2/video/text/generate
    Headers: API-KEY: <key>, Ai-trace-id: <uuid>, Content-Type: application/json
    Body:    {model, prompt, duration, quality, aspect_ratio, seed?}
    Resp:    {"ErrCode":0,"ErrMsg":"Success","Resp":{"video_id":123,"credits":10}}
             A non-zero ErrCode is a failure even on HTTP 200.

  Result / status:
    GET {base}/openapi/v2/video/result/{video_id}
    Headers: API-KEY, Ai-trace-id
    Resp:    {"ErrCode":0,"ErrMsg":"Success","Resp":{"status":1,"url":"https://...mp4"}}
    status:  1 = success (url present) · 5 = generating · 7 = moderation failed · 8 = failed

Secrets never leave this module. The key is read from settings and sent only in
the API-KEY header — never logged, returned, or placed in a URL.

Supported options are conservative subsets of what the docs document, chosen so
the UI never offers a value the configured model is unlikely to accept. The
owner can widen them here or via config.
"""
from __future__ import annotations

import logging
import uuid
from typing import Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# Documented option sets (see module docstring). Durations kept to PixVerse's
# two standard text-to-video lengths; the owner can extend SUPPORTED_DURATIONS.
SUPPORTED_QUALITIES = ["360p", "540p", "720p", "1080p"]
SUPPORTED_ASPECT_RATIOS = ["16:9", "9:16", "1:1", "4:3", "3:4"]
SUPPORTED_DURATIONS = [5, 8]

# PixVerse provider status codes.
STATUS_SUCCESS = 1
STATUS_GENERATING = 5
STATUS_MODERATION_FAILED = 7
STATUS_FAILED = 8


class PixVerseError(Exception):
    """A provider or configuration error with a creator-safe message."""

    def __init__(self, message: str, *, code: Optional[str] = None, retryable: bool = False):
        super().__init__(message)
        self.message = message
        self.code = code
        self.retryable = retryable


def is_configured() -> bool:
    return bool(settings.PIXVERSE_API_KEY)


def new_trace_id() -> str:
    return uuid.uuid4().hex


def _headers(trace_id: str) -> dict:
    return {
        "API-KEY": settings.PIXVERSE_API_KEY or "",
        "Ai-trace-id": trace_id,
        "Content-Type": "application/json",
    }


def _check_configured():
    if not is_configured():
        raise PixVerseError(
            "AI video generation is not available right now. The platform owner "
            "has not configured the provider.",
            code="not_configured",
        )


# ── Thin HTTP seams so tests can monkeypatch without real network calls ──────
def _post(url: str, json_body: dict, headers: dict, timeout: float) -> httpx.Response:
    with httpx.Client(timeout=timeout) as client:
        return client.post(url, json=json_body, headers=headers)


def _get(url: str, headers: dict, timeout: float) -> httpx.Response:
    with httpx.Client(timeout=timeout) as client:
        return client.get(url, headers=headers)


def _stream_download(url: str, max_bytes: int, timeout: float) -> tuple[bytes, Optional[str]]:
    """Download with a hard size cap. Returns (bytes, content_type)."""
    with httpx.Client(timeout=timeout, follow_redirects=True) as client:
        with client.stream("GET", url) as resp:
            resp.raise_for_status()
            content_type = resp.headers.get("content-type")
            chunks = bytearray()
            for chunk in resp.iter_bytes():
                chunks.extend(chunk)
                if len(chunks) > max_bytes:
                    raise PixVerseError(
                        "Generated video exceeded the allowed download size.",
                        code="output_too_large",
                    )
            return bytes(chunks), content_type


def submit_text_to_video(
    *, prompt: str, model: str, aspect_ratio: str, duration: int, quality: str,
    seed: Optional[int], trace_id: str,
) -> dict:
    """
    Submit a generation task. Returns {"video_id": str, "credits": int|None}.
    Raises PixVerseError on any failure. A successful return means ONLY that the
    task was accepted — not that a video exists yet.
    """
    _check_configured()
    url = f"{settings.PIXVERSE_API_BASE}/openapi/v2/video/text/generate"
    body = {
        "model": model,
        "prompt": prompt,
        "duration": duration,
        "quality": quality,
        "aspect_ratio": aspect_ratio,
    }
    if seed is not None:
        body["seed"] = seed

    try:
        resp = _post(url, body, _headers(trace_id), timeout=30.0)
    except httpx.RequestError as exc:
        logger.warning("PixVerse submit network error (trace=%s): %s", trace_id, exc)
        raise PixVerseError(
            "Could not reach the video provider. Please try again shortly.",
            code="network", retryable=True,
        )

    if resp.status_code == 401 or resp.status_code == 403:
        logger.error("PixVerse auth rejected (HTTP %s)", resp.status_code)
        raise PixVerseError(
            "AI video generation is unavailable (provider authentication failed).",
            code="auth",
        )
    if resp.status_code == 429:
        raise PixVerseError(
            "The provider is rate-limiting requests. Please wait and try again.",
            code="rate_limited", retryable=True,
        )

    try:
        data = resp.json()
    except ValueError:
        raise PixVerseError("The provider returned an unexpected response.", code="bad_response")

    err_code = data.get("ErrCode")
    if err_code != 0:
        return _raise_for_err(err_code, data)

    rp = data.get("Resp") or {}
    video_id = rp.get("video_id")
    if not video_id:
        raise PixVerseError("The provider accepted the request but returned no task id.", code="no_task_id")
    return {"video_id": str(video_id), "credits": rp.get("credits")}


def get_result(*, video_id: str, trace_id: str) -> dict:
    """
    Query a task. Returns {"status": int, "url": str|None, "raw_errcode": int}.
    Raises PixVerseError only on transport/auth problems, not on a 'still
    generating' or 'failed' provider status (those are returned as data).
    """
    _check_configured()
    url = f"{settings.PIXVERSE_API_BASE}/openapi/v2/video/result/{video_id}"
    try:
        resp = _get(url, _headers(trace_id), timeout=30.0)
    except httpx.RequestError as exc:
        logger.warning("PixVerse result network error (video_id=%s): %s", video_id, exc)
        raise PixVerseError("Could not reach the video provider.", code="network", retryable=True)

    if resp.status_code in (401, 403):
        raise PixVerseError("Provider authentication failed.", code="auth")

    try:
        data = resp.json()
    except ValueError:
        raise PixVerseError("The provider returned an unexpected response.", code="bad_response")

    if data.get("ErrCode") not in (0, None):
        return _raise_for_err(data.get("ErrCode"), data)

    rp = data.get("Resp") or {}
    # Documented field is "status"; some older schemas used "video_status".
    status = rp.get("status", rp.get("video_status"))
    return {"status": status, "url": rp.get("url") or None}


def download_output(url: str) -> tuple[bytes, Optional[str]]:
    """Download the completed video, enforcing the configured size cap."""
    max_bytes = settings.PIXVERSE_OUTPUT_MAX_MB * 1024 * 1024
    try:
        return _stream_download(url, max_bytes=max_bytes, timeout=120.0)
    except httpx.HTTPStatusError as exc:
        raise PixVerseError(
            f"Could not download the generated video (HTTP {exc.response.status_code}).",
            code="download_failed", retryable=True,
        )
    except httpx.RequestError as exc:
        logger.warning("PixVerse download error: %s", exc)
        raise PixVerseError("Could not download the generated video.", code="download_failed", retryable=True)


def _raise_for_err(err_code, data: dict):
    """Map a non-zero ErrCode to a creator-safe PixVerseError."""
    err = data.get("Error") or {}
    detail = err.get("Message") or data.get("ErrMsg") or "Unknown provider error"
    code = str(err_code)
    # Known buckets. Unknown codes are surfaced as a generic provider failure.
    if err_code in (400017,) or (err.get("Type") == "FIELD_VALUE_INVALID"):
        raise PixVerseError(f"Unsupported generation setting: {detail}", code=code)
    if err_code in (401, 403) or "auth" in detail.lower() or "api key" in detail.lower():
        raise PixVerseError("Provider authentication failed.", code="auth")
    if "credit" in detail.lower() or "balance" in detail.lower() or "insufficient" in detail.lower():
        raise PixVerseError(
            "The platform's video-generation credits are exhausted. Contact the platform owner.",
            code="insufficient_credits",
        )
    raise PixVerseError(f"The provider rejected the request: {detail}", code=code)
