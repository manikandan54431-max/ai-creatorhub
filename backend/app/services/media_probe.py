"""
Dependency-free media probing (Issue 1).

`ffprobe` is not installed in this environment, and adding a binary dependency
to read a duration would be a deployment burden. These parsers read the
container headers directly for the formats the Studio accepts.

What this answers, and why each matters for the blank-preview bug:

  * `duration`          - clips were previously given a hardcoded 10s guess, so
                          the timeline and controls did not match the real file.
  * `width` / `height`  - needed to lay the preview out at the true aspect ratio.
  * `has_video_track`   - an audio-only file uploaded as "video" plays a timer
                          with no picture. That is a legitimate blank preview and
                          must be reported honestly, not treated as a failure.
  * `codec`             - lets the UI warn before playback that a browser cannot
                          decode this file, instead of showing a black box.

Every function is best-effort and side-effect free: it never rewrites the file,
and on anything it cannot parse it returns `None` for the unknown fields rather
than guessing. Callers must treat `None` as "unknown", never as zero.
"""

from __future__ import annotations

import struct
from typing import Optional

BROWSER_PLAYABLE_VIDEO_CODECS = {"avc1", "avc3", "vp08", "vp09", "av01", "mp4v"}
BROWSER_PLAYABLE_AUDIO_CODECS = {"mp4a", "opus", "vorb", "ec-3", "ac-3"}

def _empty(reason: Optional[str] = None) -> dict:
    return {
        "duration": None,
        "width": None,
        "height": None,
        "has_video_track": None,
        "has_audio_track": None,
        "video_codec": None,
        "audio_codec": None,
        "probe_note": reason,
    }

def probe_mp4(data: bytes) -> dict:
    """
    Parse an ISO-BMFF (MP4 / MOV / M4A) header.

    Walks the top-level boxes to find `moov`, then reads `mvhd` for the duration
    and each `trak` for its handler type, dimensions and codec.
    """
    result = _empty()

    try:
        moov = None
        offset = 0
        total = len(data)
        while offset + 8 <= total:
            size = struct.unpack(">I", data[offset:offset + 4])[0]
            box_type = data[offset + 4:offset + 8]
            header = 8
            if size == 1:                      # 64-bit extended size
                if offset + 16 > total:
                    break
                size = struct.unpack(">Q", data[offset + 8:offset + 16])[0]
                header = 16
            elif size == 0:                    # extends to end of file
                size = total - offset
            if size < header:
                break
            if box_type == b"moov":
                moov = data[offset + header:offset + size]
                break
            offset += size

        if moov is None:
            return _empty("No 'moov' box found - the file is not a complete MP4.")

        timescale = None
        movie_duration = None
        tracks = []

        def walk(buf: bytes, depth: int = 0):
            """Recurse through container boxes, collecting what we need."""
            nonlocal timescale, movie_duration
            if depth > 8:
                return
            pos = 0
            n = len(buf)
            while pos + 8 <= n:
                size = struct.unpack(">I", buf[pos:pos + 4])[0]
                box_type = buf[pos + 4:pos + 8]
                header = 8
                if size == 1:
                    if pos + 16 > n:
                        return
                    size = struct.unpack(">Q", buf[pos + 8:pos + 16])[0]
                    header = 16
                elif size == 0:
                    size = n - pos
                if size < header or pos + size > n:
                    return
                body = buf[pos + header:pos + size]

                if box_type == b"mvhd" and len(body) >= 20:
                    version = body[0]
                    if version == 1 and len(body) >= 32:
                        timescale = struct.unpack(">I", body[20:24])[0]
                        movie_duration = struct.unpack(">Q", body[24:32])[0]
                    elif len(body) >= 20:
                        timescale = struct.unpack(">I", body[12:16])[0]
                        movie_duration = struct.unpack(">I", body[16:20])[0]

                elif box_type == b"trak":
                    tracks.append(_parse_trak(body))

                elif box_type in (b"moov", b"mdia", b"minf", b"stbl", b"udta"):
                    walk(body, depth + 1)

                pos += size

        walk(moov)

        if timescale:
            if movie_duration and movie_duration > 0:
                result["duration"] = round(movie_duration / timescale, 3)
            else:
                track_durations = [t["duration"] for t in tracks if t.get("duration")]
                if track_durations:
                    result["duration"] = round(max(track_durations), 3)

        video = next((t for t in tracks if t["handler"] == "vide"), None)
        audio = next((t for t in tracks if t["handler"] == "soun"), None)

        result["has_video_track"] = video is not None
        result["has_audio_track"] = audio is not None
        if video:
            result["width"] = video["width"] or None
            result["height"] = video["height"] or None
            result["video_codec"] = video["codec"]
        if audio:
            result["audio_codec"] = audio["codec"]

        if not tracks:
            result["probe_note"] = "MP4 header has no readable tracks."
        return result

    except (struct.error, IndexError, ValueError, ZeroDivisionError) as exc:
        return _empty(f"Could not parse the MP4 header ({type(exc).__name__}).")

def _parse_trak(trak: bytes) -> dict:
    """Pull handler type, pixel dimensions, duration and codec out of one trak."""
    info = {"handler": None, "width": 0, "height": 0, "codec": None, "duration": None}
    track_timescale = None
    track_duration = None

    def walk(buf: bytes, depth: int = 0):
        nonlocal track_timescale, track_duration
        if depth > 8:
            return
        pos = 0
        n = len(buf)
        while pos + 8 <= n:
            size = struct.unpack(">I", buf[pos:pos + 4])[0]
            box_type = buf[pos + 4:pos + 8]
            header = 8
            if size == 1:
                if pos + 16 > n:
                    return
                size = struct.unpack(">Q", buf[pos + 8:pos + 16])[0]
                header = 16
            elif size == 0:
                size = n - pos
            if size < header or pos + size > n:
                return
            body = buf[pos + header:pos + size]

            if box_type == b"tkhd" and len(body) >= 84:
                w, h = struct.unpack(">II", body[-8:])
                info["width"] = w >> 16
                info["height"] = h >> 16

            elif box_type == b"mdhd" and len(body) >= 20:
                version = body[0]
                if version == 1 and len(body) >= 32:
                    track_timescale = struct.unpack(">I", body[20:24])[0]
                    track_duration = struct.unpack(">Q", body[24:32])[0]
                else:
                    track_timescale = struct.unpack(">I", body[12:16])[0]
                    track_duration = struct.unpack(">I", body[16:20])[0]

            elif box_type == b"hdlr" and len(body) >= 12:
                info["handler"] = body[8:12].decode("latin-1", "replace")

            elif box_type == b"stsd" and len(body) >= 16:
                info["codec"] = body[12:16].decode("latin-1", "replace").strip()

            elif box_type in (b"mdia", b"minf", b"stbl", b"edts"):
                walk(body, depth + 1)

            pos += size

    walk(trak)
    if track_timescale and track_duration:
        info["duration"] = track_duration / track_timescale
    return info

def probe_webm(data: bytes) -> dict:
    """
    Minimal EBML/Matroska probe for duration and track presence.

    WebM is far less regular than MP4 to parse by hand, so this reads only what
    is cheap and reliable: the TimecodeScale/Duration pair and the TrackType
    markers. Anything it cannot find stays `None`.
    """
    result = _empty()
    if not data.startswith(b"\x1a\x45\xdf\xa3"):
        return _empty("Not an EBML/WebM file.")

    try:
        head = data[:min(len(data), 2 * 1024 * 1024)]

        timecode_scale = 1_000_000           # default: 1 ms, per the spec
        idx = head.find(b"\x2a\xd7\xb1")     # TimecodeScale
        if idx != -1 and idx + 4 <= len(head):
            length = head[idx + 3]
            if 1 <= length <= 8 and idx + 4 + length <= len(head):
                timecode_scale = int.from_bytes(head[idx + 4:idx + 4 + length], "big")

        idx = head.find(b"\x44\x89")         # Duration (a float)
        if idx != -1 and idx + 3 <= len(head):
            length = head[idx + 2]
            raw = head[idx + 3:idx + 3 + length]
            value = None
            if length == 4 and len(raw) == 4:
                value = struct.unpack(">f", raw)[0]
            elif length == 8 and len(raw) == 8:
                value = struct.unpack(">d", raw)[0]
            if value and value > 0:
                result["duration"] = round(value * timecode_scale / 1_000_000_000, 3)

        has_video = b"\x83\x01\x01" in head
        has_audio = b"\x83\x01\x02" in head
        result["has_video_track"] = has_video
        result["has_audio_track"] = has_audio

        for tag, key in ((b"\xb0", "width"), (b"\xba", "height")):
            i = head.find(tag)
            if i != -1 and i + 2 <= len(head):
                length = head[i + 1]
                if 1 <= length <= 4 and i + 2 + length <= len(head):
                    result[key] = int.from_bytes(head[i + 2:i + 2 + length], "big") or None

        if result["duration"] is None:
            result["probe_note"] = "WebM duration not present in the header."
        return result

    except (struct.error, IndexError, ValueError) as exc:
        return _empty(f"Could not parse the WebM header ({type(exc).__name__}).")

def probe(data: bytes, content_type: str = "", filename: str = "") -> dict:
    """
    Probe a media file by sniffing its container.

    Returns the `_empty()` shape with whatever could be determined. `probe_note`
    explains any gap, so the API can be candid about what it does not know.
    """
    if len(data) < 16:
        return _empty("File is too small to contain a media header.")

    if data[4:8] == b"ftyp":
        return probe_mp4(data)
    if data.startswith(b"\x1a\x45\xdf\xa3"):
        return probe_webm(data)
    if data.startswith(b"RIFF") and data[8:12] == b"WAVE":
        return probe_wav(data)
    if data.startswith(b"ID3") or data[:2] in (b"\xff\xfb", b"\xff\xf3", b"\xff\xf2"):
        return _empty("MP3 duration is not read from the header; it is reported by the browser.")
    if data.startswith(b"OggS"):
        return _empty("Ogg duration is not read from the header; it is reported by the browser.")

    return _empty("Unrecognised container; metadata will be read by the browser instead.")

def probe_wav(data: bytes) -> dict:
    """RIFF/WAVE: duration from the fmt byte rate and the data chunk size."""
    result = _empty()
    result["has_video_track"] = False
    result["has_audio_track"] = True
    try:
        pos = 12
        byte_rate = None
        data_size = None
        while pos + 8 <= len(data):
            chunk_id = data[pos:pos + 4]
            chunk_size = struct.unpack("<I", data[pos + 4:pos + 8])[0]
            if chunk_id == b"fmt " and pos + 8 + 16 <= len(data):
                byte_rate = struct.unpack("<I", data[pos + 8 + 8:pos + 8 + 12])[0]
            elif chunk_id == b"data":
                data_size = chunk_size
                break
            pos += 8 + chunk_size + (chunk_size % 2)
        if byte_rate and data_size:
            result["duration"] = round(data_size / byte_rate, 3)
        else:
            result["probe_note"] = "WAV header incomplete; duration unknown."
        return result
    except (struct.error, IndexError, ValueError, ZeroDivisionError) as exc:
        return _empty(f"Could not parse the WAV header ({type(exc).__name__}).")

def is_browser_playable(info: dict, media_type: str) -> tuple[bool, Optional[str]]:
    """
    Decide whether a browser is likely to render this file, and say why not.

    Returns `(playable, reason)`. `playable` is True when nothing is known to be
    wrong — including when the probe could not read the file, since an unreadable
    header is not evidence of an unplayable file. The reason is written for the
    creator to read.
    """
    if media_type == "video":
        if info.get("has_video_track") is False:
            return False, (
                "This file has no video track, so it cannot show a picture. "
                "If it is an audio file, upload it under Audio instead."
            )
        codec = info.get("video_codec")
        if codec and codec not in BROWSER_PLAYABLE_VIDEO_CODECS:
            return False, (
                f"The video codec '{codec}' cannot be played by browsers. "
                "Re-export the file as H.264 (MP4) or VP9 (WebM)."
            )
    elif media_type == "audio":
        codec = info.get("audio_codec")
        if codec and codec not in BROWSER_PLAYABLE_AUDIO_CODECS:
            return False, f"The audio codec '{codec}' cannot be played by browsers."

    return True, None
