#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
tools/analyze_audio.py  ->  public/data/analysis.json

按 SPEC §3.1 输出：
  - 实测时长（原生采样率，soundfile 读取）
  - onsets[{t, strength}]、beats[t]
  - 分段 tempo（10s 窗 / 5s 步进）
  - RMS 包络（30 帧/秒）
  - 64 频带 mel 频谱（30 帧/秒，量化到 uint8）

只依赖 librosa（+soundfile/numpy）。渲染期禁止实时 AnalyserNode，
所有节拍/频谱都从这里读。
"""
import json
import math
import os
import shutil
import sys

import numpy as np

try:
    import librosa
    import soundfile as sf
except Exception as exc:  # pragma: no cover
    sys.stderr.write("需要 librosa 与 soundfile: pip install librosa soundfile\n%r\n" % (exc,))
    raise SystemExit(2)

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
# FIX.md §5.2：分析与播放一律用 assets/song.mp3（参考仓库那份，211.907s，与 FLAC 差 <1ms）。
# FLAC 只作备份，不复制进 public/，因此不会进 dist/。dist 目标 <15MB。
CANDIDATES = [os.path.join(ROOT, "assets", "song.mp3"), os.path.join(ROOT, "assets", "song.flac")]
PUB_AUDIO = os.path.join(ROOT, "public", "audio")
OUT = os.path.join(ROOT, "public", "data", "analysis.json")

FPS = 30
SR = 22050  # 特征分析用采样率；时长另按原生采样率实测


def q(x, n=4):
    return round(float(x), n)


def main():
    song = next((p for p in CANDIDATES if os.path.isfile(p)), None)
    if song is None:
        sys.stderr.write("缺少音频，请放到以下任一位置（用户自备）：\n  %s\n" % "\n  ".join(CANDIDATES))
        raise SystemExit(2)
    SONG = song

    # ---- 实测时长：原生采样率，不重采样 ----
    info = sf.info(SONG)
    duration = float(info.frames) / float(info.samplerate)

    y, sr = librosa.load(SONG, sr=SR, mono=True)
    hop = int(round(sr / FPS))

    # ---- onset 包络 + 起音点 ----
    env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop)
    env = np.asarray(env, dtype=np.float64)
    env_max = float(env.max()) if env.size else 1.0
    if env_max <= 0:
        env_max = 1.0

    onset_frames = librosa.onset.onset_detect(
        onset_envelope=env, sr=sr, hop_length=hop, units="frames", backtrack=False
    )
    onsets = []
    for f in np.atleast_1d(onset_frames):
        f = int(f)
        t = f * hop / sr
        if 0.0 <= t <= duration:
            onsets.append({"t": q(t, 4), "strength": q(min(1.0, env[f] / env_max), 4)})
    onset_times = np.array([o["t"] for o in onsets], dtype=np.float64)

    # ---- beat tracking ----
    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr, hop_length=hop, units="frames")
    tempo_val = float(np.atleast_1d(tempo)[0])
    beats = [q(float(f) * hop / sr, 4) for f in np.atleast_1d(beat_frames)]
    beats = [b for b in beats if 0.0 <= b <= duration]

    # ---- 分段 tempo：10s 窗，5s 步进 ----
    tempo_fn = getattr(librosa.feature.rhythm, "tempo", None) or librosa.beat.tempo
    segs = []
    win, step = 10.0, 5.0
    t0 = 0.0
    n_frames = env.shape[0]
    while t0 < duration:
        t1 = min(t0 + win, duration)
        f0 = int(t0 * sr / hop)
        f1 = int(t1 * sr / hop)
        seg = env[f0:f1]
        bpm = tempo_val
        if seg.size >= 8:
            try:
                est = tempo_fn(onset_envelope=seg, sr=sr, hop_length=hop, aggregate=np.median)
                est = np.atleast_1d(est)
                if est.size and math.isfinite(float(est[0])) and float(est[0]) > 0:
                    bpm = float(est[0])
            except Exception:
                pass
        segs.append({"t0": q(t0, 3), "t1": q(t1, 3), "bpm": q(bpm, 2)})
        if t1 >= duration:
            break
        t0 += step

    # ---- RMS 包络（30 帧/秒）----
    rms = librosa.feature.rms(y=y, frame_length=2048, hop_length=hop)[0]
    rms = np.asarray(rms, dtype=np.float64)
    rms_max = float(rms.max()) if rms.size else 1.0
    if rms_max <= 0:
        rms_max = 1.0
    rms_norm = np.clip(rms / rms_max, 0.0, 1.0)
    rms_list = [q(v, 4) for v in rms_norm.tolist()]

    # ---- 64 频带 mel 频谱（30 帧/秒，quantize uint8）----
    mel = librosa.feature.melspectrogram(
        y=y, sr=sr, n_fft=2048, hop_length=hop, n_mels=64, fmin=30.0, fmax=sr / 2.0, power=2.0
    )
    mel_db = librosa.power_to_db(mel, ref=np.max)
    # 固定动态范围 -80..0 dB，避免全局归一在不同片段间漂移
    min_db, max_db = -80.0, 0.0
    q8 = np.clip((mel_db - min_db) / (max_db - min_db), 0.0, 1.0)
    q8 = np.round(q8 * 255.0).astype(np.uint8)  # (bands, frames)

    n_bands, n_frames = q8.shape
    # 转成 frames × bands 的扁平数组（行主序），便于 sync.js 直接索引
    flat = q8.T.reshape(-1).astype(int).tolist()

    data = {
        "version": 1,
        "source": os.path.basename(SONG),
        "duration": q(duration, 4),
        "sampleRateNative": int(info.samplerate),
        "channels": int(info.channels),
        "analysisRate": SR,
        "fps": FPS,
        "hop": hop,
        "globalTempo": q(tempo_val, 3),
        "onsets": onsets,
        "beats": beats,
        "tempoSegments": segs,
        "rms": {"fps": FPS, "values": rms_list},
        "mel": {
            "fps": FPS,
            "bands": int(n_bands),
            "frames": int(n_frames),
            "minDb": min_db,
            "maxDb": max_db,
            "layout": "frames-major, value = round(255*(db-minDb)/(maxDb-minDb))",
            "data": flat,
        },
    }

    # 把播放用的 mp3 复制到 public/audio/（该目录在 .gitignore 中；FLAC 不复制）
    if os.path.basename(SONG).lower().endswith(".mp3"):
        os.makedirs(PUB_AUDIO, exist_ok=True)
        shutil.copyfile(SONG, os.path.join(PUB_AUDIO, "song.mp3"))
        print("  playback   public/audio/song.mp3  (%.1f MB)" % (os.path.getsize(SONG) / 1024 / 1024))
    else:
        sys.stderr.write(
            "警告：正在用 %s 分析，但它不会被复制到 public/audio/（FIX §5.2 要求播放 mp3）\n"
            % os.path.basename(SONG)
        )

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, separators=(",", ":"))

    size_mb = os.path.getsize(OUT) / 1024.0 / 1024.0
    print("[analyze_audio] %s" % OUT)
    print("  source     %s  (%d Hz, %d ch)" % (os.path.basename(SONG), info.samplerate, info.channels))
    print("  duration   %.3f s  (%d:%05.2f)" % (duration, int(duration // 60), duration % 60))
    print("  global bpm %.1f" % tempo_val)
    print("  onsets     %d   beats %d" % (len(onsets), len(beats)))
    print("  tempoSegs  %d   rms frames %d   mel %dx%d" % (len(segs), len(rms_list), n_frames, n_bands))
    print("  size       %.2f MB" % size_mb)


if __name__ == "__main__":
    main()
