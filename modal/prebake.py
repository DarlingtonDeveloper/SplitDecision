"""
Modal CLAP + librosa pipeline for SplitDecision.

Provides:
  - POST web endpoint: embed_text({"text": "dark trap"}) -> {embedding}
  - POST web endpoint: embed_audio({"audio_url": "https://..."}) -> {embedding, bpm, music_key}
  - Batch pre-bake command: modal run modal/prebake.py --audio-dir ./beats

Modal setup expected:
  modal secret create splitdecision-supabase \
    SUPABASE_URL=... \
    SUPABASE_SERVICE_KEY=...

Deploy endpoints:
  modal deploy modal/prebake.py

Then set Vercel envs:
  MODAL_CLAP_TEXT_URL=<Modal embed_text endpoint URL>
  MODAL_CLAP_AUDIO_URL=<Modal embed_audio endpoint URL>
"""

from __future__ import annotations

import base64
import os
import pathlib
import tempfile
from typing import Iterable
from urllib.parse import urlparse

import modal

APP_NAME = "splitdecision-clap"
MODEL_ID = "laion/clap-htsat-unfused"
SAMPLE_RATE = 48_000
EMBEDDING_DIM = 512

app = modal.App(APP_NAME)

cache_volume = modal.Volume.from_name("splitdecision-clap-cache", create_if_missing=True)

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg", "libsndfile1", "git")
    .pip_install(
        "accelerate==1.12.0",
        "fastapi[standard]==0.124.0",
        "librosa==0.11.0",
        "numpy==2.3.5",
        "requests==2.32.5",
        "soundfile==0.13.1",
        "supabase==2.24.0",
        "torch==2.9.1",
        "transformers==4.57.3",
    )
    .env(
        {
            "HF_HOME": "/cache/huggingface",
            "TRANSFORMERS_CACHE": "/cache/huggingface",
            "TORCH_HOME": "/cache/torch",
        }
    )
)


def _normalise(vec: Iterable[float]) -> list[float]:
    import numpy as np

    arr = np.asarray(list(vec), dtype=np.float32)
    norm = float(np.linalg.norm(arr)) or 1.0
    arr = arr / norm
    if arr.shape[0] != EMBEDDING_DIM:
        raise ValueError(f"Expected {EMBEDDING_DIM}-dim CLAP vector, got {arr.shape[0]}")
    return arr.astype(float).tolist()


def _key_from_chroma(y, sr: int) -> str | None:
    """Tiny Krumhansl-Schmuckler-style key estimate good enough for catalogue metadata."""
    import librosa
    import numpy as np

    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
    if chroma.size == 0:
        return None

    profile = chroma.mean(axis=1)
    major = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
    minor = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
    names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

    scores: list[tuple[float, str]] = []
    for i, name in enumerate(names):
        scores.append((float(np.corrcoef(profile, np.roll(major, i))[0, 1]), f"{name} major"))
        scores.append((float(np.corrcoef(profile, np.roll(minor, i))[0, 1]), f"{name} minor"))
    scores = [(s, k) for s, k in scores if not np.isnan(s)]
    return max(scores, default=(0.0, "C minor"))[1]


def _safe_title(path_or_url: str) -> str:
    parsed = urlparse(path_or_url)
    name = pathlib.Path(parsed.path or path_or_url).stem
    return name.replace("_", " ").replace("-", " ").strip().title() or "Untitled Beat"


@app.cls(
    image=image,
    gpu="T4",
    volumes={"/cache": cache_volume},
    timeout=900,
    container_idle_timeout=300,
    allow_concurrent_inputs=4,
)
class ClapEncoder:
    @modal.enter()
    def load(self):
        import torch
        from transformers import ClapModel, ClapProcessor

        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.processor = ClapProcessor.from_pretrained(MODEL_ID)
        self.model = ClapModel.from_pretrained(MODEL_ID).to(self.device)
        self.model.eval()

    @modal.method()
    def embed_text(self, text: str) -> dict:
        import torch

        if not text or not text.strip():
            raise ValueError("text required")

        inputs = self.processor(text=[text], return_tensors="pt", padding=True).to(self.device)
        with torch.no_grad():
            features = self.model.get_text_features(**inputs)[0].detach().cpu().numpy()
        return {"embedding": _normalise(features)}

    def _embed_audio_bytes_impl(self, filename: str, audio_b64: str) -> dict:
        import librosa
        import torch

        suffix = pathlib.Path(filename).suffix or ".wav"
        with tempfile.NamedTemporaryFile(suffix=suffix) as tmp:
            tmp.write(base64.b64decode(audio_b64))
            tmp.flush()
            y, _sr = librosa.load(tmp.name, sr=SAMPLE_RATE, mono=True)

        tempo, _beats = librosa.beat.beat_track(y=y, sr=SAMPLE_RATE)
        bpm = int(round(float(tempo))) if tempo else None
        music_key = _key_from_chroma(y, SAMPLE_RATE)

        inputs = self.processor(audios=y, sampling_rate=SAMPLE_RATE, return_tensors="pt", padding=True).to(self.device)
        with torch.no_grad():
            features = self.model.get_audio_features(**inputs)[0].detach().cpu().numpy()

        return {
            "title": _safe_title(filename),
            "bpm": bpm,
            "music_key": music_key,
            "embedding": _normalise(features),
        }

    @modal.method()
    def embed_audio_bytes(self, filename: str, audio_b64: str) -> dict:
        return self._embed_audio_bytes_impl(filename, audio_b64)

    @modal.method()
    def embed_audio_url(self, audio_url: str) -> dict:
        import requests

        if not audio_url:
            raise ValueError("audio_url required")
        res = requests.get(audio_url, timeout=60)
        res.raise_for_status()
        audio_b64 = base64.b64encode(res.content).decode("ascii")
        return self._embed_audio_bytes_impl(audio_url, audio_b64)


@app.function(image=image, timeout=120)
@modal.fastapi_endpoint(method="POST")
def embed_text(payload: dict) -> dict:
    text = payload.get("text") if isinstance(payload, dict) else None
    if not text:
        return {"error": "text required"}
    return ClapEncoder().embed_text.remote(text)


@app.function(image=image, timeout=240)
@modal.fastapi_endpoint(method="POST")
def embed_audio(payload: dict) -> dict:
    audio_url = payload.get("audio_url") if isinstance(payload, dict) else None
    if not audio_url:
        return {"error": "audio_url required"}
    return ClapEncoder().embed_audio_url.remote(audio_url)


@app.function(
    image=image,
    gpu="T4",
    volumes={"/cache": cache_volume},
    secrets=[modal.Secret.from_name("splitdecision-supabase")],
    timeout=3600,
)
def prebake_audio_files(files: list[tuple[str, str]]) -> list[dict]:
    """Embed local audio files and upsert metadata/embeddings into Supabase.

    files is [(filename, base64_audio), ...]. Passing bytes keeps the CLI simple for
    the hackathon-sized catalogue; for larger catalogues use Supabase Storage URLs.
    """
    from supabase import create_client

    url = os.environ["SUPABASE_URL"]
    service_key = os.environ["SUPABASE_SERVICE_KEY"]
    supabase = create_client(url, service_key)

    encoder = ClapEncoder()
    rows: list[dict] = []

    for filename, audio_b64 in files:
        metadata = encoder.embed_audio_bytes.remote(filename, audio_b64)
        storage_path = f"beats/{pathlib.Path(filename).name}"
        audio_bytes = base64.b64decode(audio_b64)

        try:
            supabase.storage.from_("beats").upload(
                storage_path,
                audio_bytes,
                {"content-type": "audio/mpeg", "upsert": "true"},
            )
        except Exception:
            # Bucket may already contain it or Storage may not be configured for demo.
            pass

        public = supabase.storage.from_("beats").get_public_url(storage_path)
        public_url = public if isinstance(public, str) else public.get("publicUrl")

        row = {
            "title": metadata["title"],
            "audio_url": public_url,
            "bpm": metadata["bpm"],
            "music_key": metadata["music_key"],
            "embedding": metadata["embedding"],
            "status": "available",
        }

        existing = (
            supabase.table("beats")
            .select("id")
            .eq("title", row["title"])
            .limit(1)
            .execute()
        )
        if existing.data:
            supabase.table("beats").update(row).eq("id", existing.data[0]["id"]).execute()
        else:
            supabase.table("beats").insert(row).execute()
        rows.append(row)

    return rows


@app.local_entrypoint()
def main(audio_dir: str = "./beats"):
    root = pathlib.Path(audio_dir).expanduser().resolve()
    if not root.exists():
        raise SystemExit(f"Audio dir not found: {root}")

    exts = {".wav", ".mp3", ".m4a", ".aiff", ".aif", ".flac", ".ogg"}
    files: list[tuple[str, str]] = []
    for path in sorted(p for p in root.iterdir() if p.suffix.lower() in exts):
        files.append((path.name, base64.b64encode(path.read_bytes()).decode("ascii")))

    if not files:
        raise SystemExit(f"No audio files found in {root}")

    rows = prebake_audio_files.remote(files)
    for row in rows:
        print(f"{row['title']}: {row['bpm']} BPM, {row['music_key']}")
