"""
Media probe tests (Issue 1).

The probe is what replaced the editor's hardcoded 10-second clip length, so
these tests pin down two things: that it reads real values out of real headers,
and that when it cannot read a file it returns None rather than guessing.

The MP4 fixtures are built byte by byte here so the suite needs no media files
and no ffmpeg.
"""

import struct

import pytest

from app.services import media_probe

def box(box_type: bytes, payload: bytes) -> bytes:
    return struct.pack(">I", len(payload) + 8) + box_type + payload

def mvhd(timescale: int, duration: int) -> bytes:
    return box(b"mvhd", b"\x00" * 4 + b"\x00" * 8 + struct.pack(">II", timescale, duration) + b"\x00" * 80)

def hdlr(handler: bytes) -> bytes:
    return box(b"hdlr", b"\x00" * 4 + b"\x00" * 4 + handler + b"\x00" * 12)

def tkhd(width: int, height: int) -> bytes:
    payload = bytearray(84)
    payload[-8:] = struct.pack(">II", width << 16, height << 16)
    return box(b"tkhd", bytes(payload))

def mdhd(timescale: int, duration: int) -> bytes:
    return box(b"mdhd", b"\x00" * 4 + b"\x00" * 8 + struct.pack(">II", timescale, duration) + b"\x00" * 4)

def stsd(codec: bytes) -> bytes:
    return box(b"stsd", b"\x00" * 4 + struct.pack(">I", 1) + struct.pack(">I", 16) + codec + b"\x00" * 8)

def trak(handler: bytes, codec: bytes, width=0, height=0, timescale=600, duration=6000) -> bytes:
    stbl = box(b"stbl", stsd(codec))
    minf = box(b"minf", stbl)
    mdia = box(b"mdia", mdhd(timescale, duration) + hdlr(handler) + minf)
    return box(b"trak", tkhd(width, height) + mdia)

def build_mp4(tracks, timescale=1000, duration=5000) -> bytes:
    ftyp = box(b"ftyp", b"isomiso2avc1mp41")
    moov = box(b"moov", mvhd(timescale, duration) + b"".join(tracks))
    mdat = box(b"mdat", b"\x00" * 64)
    return ftyp + moov + mdat

@pytest.fixture
def video_with_audio_mp4():
    return build_mp4([
        trak(b"vide", b"avc1", width=1920, height=1080),
        trak(b"soun", b"mp4a"),
    ], timescale=1000, duration=12500)      # 12.5 s

@pytest.fixture
def audio_only_mp4():
    return build_mp4([trak(b"soun", b"mp4a")], timescale=1000, duration=30000)

@pytest.fixture
def exotic_codec_mp4():
    return build_mp4([trak(b"vide", b"hvc1", width=640, height=480)])

class TestProbeReadsRealValues:
    def test_reads_duration_dimensions_and_codecs(self, video_with_audio_mp4):
        info = media_probe.probe(video_with_audio_mp4)
        assert info["duration"] == 12.5
        assert info["width"] == 1920
        assert info["height"] == 1080
        assert info["has_video_track"] is True
        assert info["has_audio_track"] is True
        assert info["video_codec"] == "avc1"
        assert info["audio_codec"] == "mp4a"

    def test_detects_an_audio_only_file(self, audio_only_mp4):
        info = media_probe.probe(audio_only_mp4)
        assert info["has_video_track"] is False
        assert info["has_audio_track"] is True
        assert info["duration"] == 30.0
        assert info["width"] is None
        assert info["height"] is None

    def test_sniffs_the_container_not_the_extension(self, video_with_audio_mp4):
        info = media_probe.probe(video_with_audio_mp4, "video/webm", "mislabelled.webm")
        assert info["width"] == 1920

    def test_wav_duration_from_the_header(self):
        sample_rate, channels, bits = 44100, 1, 16
        byte_rate = sample_rate * channels * bits // 8
        pcm = b"\x00" * (byte_rate * 2)      # exactly 2 seconds
        fmt = struct.pack("<HHIIHH", 1, channels, sample_rate, byte_rate, 2, bits)
        wav = (b"RIFF" + struct.pack("<I", 36 + len(pcm)) + b"WAVE"
               + b"fmt " + struct.pack("<I", len(fmt)) + fmt
               + b"data" + struct.pack("<I", len(pcm)) + pcm)
        info = media_probe.probe(wav)
        assert info["duration"] == 2.0
        assert info["has_video_track"] is False
        assert info["has_audio_track"] is True

class TestProbeDoesNotGuess:
    def test_unknown_values_are_none_never_zero(self):
        """`None` means unknown. Zero would be a wrong fact, not a missing one."""
        info = media_probe.probe(b"not a media file at all, just text bytes here")
        assert info["duration"] is None
        assert info["width"] is None
        assert info["height"] is None
        assert info["probe_note"]

    def test_truncated_mp4_without_moov_is_reported(self):
        truncated = box(b"ftyp", b"isomiso2avc1mp41") + box(b"mdat", b"\x00" * 32)
        info = media_probe.probe(truncated)
        assert info["duration"] is None
        assert "moov" in info["probe_note"]

    def test_a_tiny_file_is_reported_not_crashed(self):
        info = media_probe.probe(b"\x00\x01\x02")
        assert info["duration"] is None
        assert "too small" in info["probe_note"].lower()

    def test_empty_input_does_not_raise(self):
        assert media_probe.probe(b"")["duration"] is None

    def test_garbage_box_sizes_do_not_raise(self):
        evil = b"\x00\x00\x00\x08ftyp" + b"\xff\xff\xff\xffmoov" + b"\x00" * 32
        info = media_probe.probe(evil)
        assert info["duration"] is None or isinstance(info["duration"], float)

    def test_probe_never_mutates_its_input(self, video_with_audio_mp4):
        before = bytes(video_with_audio_mp4)
        media_probe.probe(video_with_audio_mp4)
        assert video_with_audio_mp4 == before

class TestPlayabilityIsHonest:
    def test_h264_video_is_accepted(self, video_with_audio_mp4):
        info = media_probe.probe(video_with_audio_mp4)
        playable, reason = media_probe.is_browser_playable(info, "video")
        assert playable is True
        assert reason is None

    def test_audio_only_uploaded_as_video_is_rejected_with_a_clear_reason(self, audio_only_mp4):
        info = media_probe.probe(audio_only_mp4)
        playable, reason = media_probe.is_browser_playable(info, "video")
        assert playable is False
        assert "no video track" in reason.lower()
        assert "audio" in reason.lower()      # tells the creator what to do

    def test_undecodable_codec_is_rejected_with_the_codec_named(self, exotic_codec_mp4):
        info = media_probe.probe(exotic_codec_mp4)
        playable, reason = media_probe.is_browser_playable(info, "video")
        assert playable is False
        assert "hvc1" in reason
        assert "H.264" in reason              # suggests the fix

    def test_an_unreadable_header_is_not_treated_as_unplayable(self):
        """Not being able to read a file is not evidence that it is broken."""
        info = media_probe.probe(b"something unparseable but possibly fine")
        playable, reason = media_probe.is_browser_playable(info, "video")
        assert playable is True
        assert reason is None

    def test_audio_track_codec_is_checked_for_audio_uploads(self):
        info = media_probe.probe(build_mp4([trak(b"soun", b"qdm2")]))
        playable, reason = media_probe.is_browser_playable(info, "audio")
        assert playable is False
        assert "qdm2" in reason

class TestUploadStoresProbedMetadata:
    def _project(self, client, creator_user):
        res = client.post("/api/creator/studio/projects",
                          json={"title": "probe test", "aspect_ratio": "16:9"},
                          headers=creator_user["headers"])
        assert res.status_code in (200, 201)
        return res.json()["id"]

    def test_real_metadata_is_persisted_not_guessed(self, client, creator_user, video_with_audio_mp4):
        pid = self._project(client, creator_user)
        res = client.post(
            "/api/creator/studio/assets",
            data={"media_type": "video", "project_id": str(pid)},
            files={"file": ("clip.mp4", video_with_audio_mp4, "video/mp4")},
            headers=creator_user["headers"],
        )
        assert res.status_code == 200, res.text
        body = res.json()
        assert body["duration"] == 12.5
        assert body["width"] == 1920
        assert body["height"] == 1080
        assert body["has_video_track"] is True
        assert body["video_codec"] == "avc1"

    def test_audio_only_video_upload_is_refused_with_an_explanation(self, client, creator_user, audio_only_mp4):
        pid = self._project(client, creator_user)
        res = client.post(
            "/api/creator/studio/assets",
            data={"media_type": "video", "project_id": str(pid)},
            files={"file": ("sound.mp4", audio_only_mp4, "video/mp4")},
            headers=creator_user["headers"],
        )
        assert res.status_code == 400
        assert "no video track" in res.json()["detail"].lower()

    def test_undecodable_video_is_refused_rather_than_stored(self, client, creator_user, exotic_codec_mp4):
        pid = self._project(client, creator_user)
        res = client.post(
            "/api/creator/studio/assets",
            data={"media_type": "video", "project_id": str(pid)},
            files={"file": ("weird.mp4", exotic_codec_mp4, "video/mp4")},
            headers=creator_user["headers"],
        )
        assert res.status_code == 400
        assert "hvc1" in res.json()["detail"]

    def test_unprobeable_file_is_still_accepted_with_a_note(self, client, creator_user):
        """An unreadable header must not block a possibly-valid upload."""
        pid = self._project(client, creator_user)
        stub = box(b"ftyp", b"isomiso2mp41")      # header only, no moov
        res = client.post(
            "/api/creator/studio/assets",
            data={"media_type": "video", "project_id": str(pid)},
            files={"file": ("stub.mp4", stub, "video/mp4")},
            headers=creator_user["headers"],
        )
        assert res.status_code == 200
        body = res.json()
        assert body["duration"] is None          # unknown, not guessed
        assert body["probe_note"]                # and it says why

    def test_stream_is_served_inline_with_range_support(self, client, creator_user, video_with_audio_mp4):
        """An attachment disposition is wrong for a <video> source."""
        pid = self._project(client, creator_user)
        asset = client.post(
            "/api/creator/studio/assets",
            data={"media_type": "video", "project_id": str(pid)},
            files={"file": ("clip.mp4", video_with_audio_mp4, "video/mp4")},
            headers=creator_user["headers"],
        ).json()

        res = client.get(f"/api/creator/studio/assets/{asset['id']}/stream",
                         headers=creator_user["headers"])
        assert res.status_code == 200
        assert res.headers["content-type"] == "video/mp4"
        assert res.headers.get("content-disposition") == "inline"
        assert res.headers.get("accept-ranges") == "bytes"

    def test_another_creator_cannot_stream_the_asset(self, client, creator_user, other_creator_user, video_with_audio_mp4):
        pid = self._project(client, creator_user)
        asset = client.post(
            "/api/creator/studio/assets",
            data={"media_type": "video", "project_id": str(pid)},
            files={"file": ("clip.mp4", video_with_audio_mp4, "video/mp4")},
            headers=creator_user["headers"],
        ).json()

        res = client.get(f"/api/creator/studio/assets/{asset['id']}/stream",
                         headers=other_creator_user["headers"])
        assert res.status_code == 404

    def test_client_role_cannot_stream_studio_assets(self, client, creator_user, client_user, video_with_audio_mp4):
        pid = self._project(client, creator_user)
        asset = client.post(
            "/api/creator/studio/assets",
            data={"media_type": "video", "project_id": str(pid)},
            files={"file": ("clip.mp4", video_with_audio_mp4, "video/mp4")},
            headers=creator_user["headers"],
        ).json()

        res = client.get(f"/api/creator/studio/assets/{asset['id']}/stream",
                         headers=client_user["headers"])
        assert res.status_code == 403
