#!/usr/bin/env python3
"""
Persiapan video SEBELUM render. Jalankan dari root repo:

    python3 tools/prepare.py video1

Butuh: public/<video>/scenes.src.json (atau scenes.json), voiceover.mp3, dan (sangat disarankan) voiceover.srt.
Menghasilkan:
  public/<video>/scenes.json  -> start tiap adegan + waktu tiap kata mengikuti SRT, durasi otomatis
  public/<video>/env.json     -> kerasnya suara per frame (lip-sync)
  public/<video>/mix.wav      -> suara + musik (di-duck di bawah suara) + SFX, -14 LUFS
Butuh ffmpeg, python3, numpy, scipy.
"""
import difflib, json, math, os, re, shutil, subprocess, sys
import numpy as np

name = sys.argv[1] if len(sys.argv) > 1 else 'video1'
D = f'public/{name}'
FPS, XF = 30, 10
TAIL = float(os.environ.get('TAIL', 2.0))          # jeda penutup setelah suara selesai (untuk CTA)
FF = shutil.which('ffmpeg') or 'ffmpeg'
os.makedirs('tmp', exist_ok=True)

def run(a): return subprocess.run(a, capture_output=True, text=True)
def dur_of(p):
    r = run([FF, '-hide_banner', '-i', p]).stderr
    h, m, s = re.search(r'Duration: (\d+):(\d+):([\d.]+)', r).groups()
    return int(h) * 3600 + int(m) * 60 + float(s)

# ---------- 1. sumber adegan
src = f'{D}/scenes.src.json'
if not os.path.exists(src):
    shutil.copy(f'{D}/scenes.json', src)           # simpan salinan asli sekali saja
data = json.load(open(src, encoding='utf-8'))
scenes = data['scenes']

# ---------- 2. SRT -> waktu tiap kata
def ts(x):
    hh, mm, rest = x.split(':'); ss, ms = rest.replace(',', '.').split('.')
    return int(hh) * 3600 + int(mm) * 60 + int(ss) + int(ms.ljust(3, '0')[:3]) / 1000
def parse_srt(t):
    out = []
    for blk in re.split(r'\n\s*\n', t.strip().replace('\r', '')):
        ln = blk.split('\n'); i = next((k for k, l in enumerate(ln) if '-->' in l), None)
        if i is None: continue
        a, b = [ts(x.strip()) for x in ln[i].split('-->')]
        out.append((a, b, ' '.join(ln[i + 1:]).strip()))
    return out

srt_path = f'{D}/voiceover.srt'
srt = parse_srt(open(srt_path, encoding='utf-8').read()) if os.path.exists(srt_path) else []
mp3 = f'{D}/voiceover.mp3'
VO = dur_of(mp3) if os.path.exists(mp3) else (srt[-1][1] if srt else float(data.get('durationInFrames', 900)) / FPS)
if not os.path.exists(mp3): print('PERINGATAN: voiceover.mp3 tidak ada, mix.wav hanya berisi musik + SFX')
SPEECH_END = srt[-1][1] if srt else VO

norm = lambda w: re.sub(r'[^a-z0-9]', '', w.lower())
toks = [(si, t) for si, s in enumerate(scenes) for t in s['title'].split()]      # kata tampil di layar
if srt:
    sw = []                                                                         # kata SRT + waktu (kalimat akurat, kata = estimasi)
    for a, b, t in srt:
        ws = t.split(); tot = sum(len(w) + 1 for w in ws) or 1; x = a
        for w in ws:
            d = (b - a) * (len(w) + 1) / tot; sw.append((w, x, x + d)); x += d
    A = [norm(w) for w, _, _ in sw]; B = [norm(t.replace('*', '')) for _, t in toks]
    times = [None] * len(B)
    for blk in difflib.SequenceMatcher(None, A, B, autojunk=False).get_matching_blocks():
        for k in range(blk.size): times[blk.b + k] = (sw[blk.a + k][1], sw[blk.a + k][2])
    known = [i for i, t in enumerate(times) if t]
    if not known: times = [(i * SPEECH_END / len(B), (i + 1) * SPEECH_END / len(B)) for i in range(len(B))]
    else:                                                                           # isi kata yang tidak cocok dengan interpolasi
        prev_end, i = 0.0, 0
        while i < len(B):
            if times[i]: prev_end = times[i][1]; i += 1; continue
            j = i
            while j < len(B) and not times[j]: j += 1
            nxt = times[j][0] if j < len(B) else SPEECH_END
            step = (nxt - prev_end) / (j - i)
            for k in range(i, j): times[k] = (prev_end + (k - i) * step, prev_end + (k - i + 1) * step)
            i = j
    cover = len(known) / max(1, len(B))
    print(f'sinkron SRT: {len(known)}/{len(B)} kata cocok persis ({cover:.0%}), sisanya diinterpolasi')
else:
    print('PERINGATAN: voiceover.srt tidak ada; waktu kata diperkirakan dari start di scenes.src.json')
    times = []
    for si, s in enumerate(scenes):
        a = s['start']; b = scenes[si + 1]['start'] if si + 1 < len(scenes) else VO
        ws = [t for i, t in toks if i == si]; tot = sum(len(w) + 2 for w in ws) or 1; x = a
        for w in ws: d = (b - a) * (len(w) + 2) / tot; times.append((x, x + d)); x += d

words = [dict(w=t.replace('*', ''), hl='*' in t, a=round(a, 3), b=round(b, 3), s=si) for (si, t), (a, b) in zip(toks, times)]
first_idx = {}
for k, w in enumerate(words): first_idx.setdefault(w['s'], k)
prev = 0.0
for si, s in enumerate(scenes):                                                     # adegan mulai tepat saat kata pertamanya diucapkan
    st = 0.0 if si == 0 else max(prev + 0.8, words[first_idx[si]]['a'] - 0.05)
    s['start'] = round(st, 3); prev = st

DUR = math.ceil((max(VO, SPEECH_END) + TAIL) * FPS) / FPS
data['durationInFrames'] = int(round(DUR * FPS)); data['words'] = words; data['music'] = False
json.dump(data, open(f'{D}/scenes.json', 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
print('durasi', DUR, 'dtk =', data['durationInFrames'], 'frame;', len(scenes), 'adegan:', [s['start'] for s in scenes])

# ---------- 3. lip-sync: kerasnya suara per frame
env = [0.0] * data['durationInFrames']
if os.path.exists(mp3):
    raw = subprocess.run([FF, '-v', 'error', '-i', mp3, '-ac', '1', '-ar', '16000', '-f', 's16le', '-'], capture_output=True).stdout
    x = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768
    n = 16000 // FPS; k = len(x) // n
    rms = np.sqrt(np.mean(x[:k * n].reshape(k, n) ** 2, axis=1))
    ref = np.percentile(rms[rms > 0.01], 95) if np.any(rms > 0.01) else 1.0
    e = np.clip(rms / ref, 0, 1) ** 0.8
    e = np.convolve(e, [0.25, 0.5, 0.25], mode='same')
    for i in range(min(k, len(env))): env[i] = round(float(e[i]), 2)
json.dump(env, open(f'{D}/env.json', 'w'))

# ---------- 4. musik bed + SFX terikat adegan (cues untuk tools/make_audio.py)
seq = lambda s: max(0.0, s['start'] - (XF / FPS if s is not scenes[0] else 0))       # awal Sequence adegan
sfx = [dict(t=0.0, type='pop', gain=.5)]
for s in scenes[1:]:
    sfx += [dict(t=round(max(0, s['start'] - .32), 3), type='whoosh', d=.5, gain=.5), dict(t=s['start'], type='thud', gain=.3)]
for s in scenes:
    c = s.get('card'); q = seq(s)
    if c and c.get('type') == 'list':
        for i in range(len(c.get('items', []))): sfx.append(dict(t=round(q + (10 + i * 10) / FPS, 3), type='pop', gain=.5))
    if c and c.get('type') == 'stat':
        sfx += [dict(t=round(q + 4 / FPS, 3), type='ticks', d=1.2, step=.08, gain=.5),
                dict(t=round(q + 40 / FPS, 3), type='thud', gain=.7), dict(t=round(q + 40 / FPS, 3), type='bell', f=1318, gain=.4)]
    if s.get('prop') == 'confetti': sfx += [dict(t=round(s['start'] + .1, 3), type='impact', gain=.4), dict(t=round(s['start'] + .2, 3), type='sparkle')]
if data.get('cta'): sfx += [dict(t=round(DUR - 2.0, 3), type='sparkle'), dict(t=round(DUR - 2.0, 3), type='pop', gain=.6)]
music = dict(profile='bed', bpm=100, bars=['C', 'G', 'Am', 'F'], breaks=[], arp_from=2.0, hat_from=4.0, clap_from=999, final=round(max(DUR - 1.6, 1.0), 3))
json.dump(dict(dur=DUR, fps=FPS, sfx=sfx, music=music), open('tools/cues.json', 'w'), indent=1)
r = run([sys.executable, 'tools/make_audio.py', '--bed']); print(r.stdout.strip() or r.stderr[-400:])

# ---------- 5. mix dengan ducking: suara menang, musik turun saat bicara
if os.path.exists(mp3):
    subprocess.run([FF, '-y', '-loglevel', 'error', '-i', mp3, '-vn', '-ar', '44100', '-ac', '2', '-af', 'highpass=f=70,loudnorm=I=-16:TP=-1.5:LRA=7', 'tmp/vo.wav'], check=True)
else:
    subprocess.run([FF, '-y', '-loglevel', 'error', '-f', 'lavfi', '-i', f'anullsrc=r=44100:cl=stereo', '-t', str(DUR), 'tmp/vo.wav'], check=True)
fg = (f'[0:a]apad=whole_dur={DUR},asplit=2[vo][sc];[1:a]volume=0.65[bed];[bed][sc]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=500:makeup=1[d0];'
      f'[d0]asplit=2[duck][dchk];[2:a]volume=0.5[fx];[vo][duck][fx]amix=inputs=3:duration=longest[o]')
subprocess.run([FF, '-y', '-loglevel', 'error', '-i', 'tmp/vo.wav', '-i', 'tmp/bed.wav', '-i', 'tmp/sfx.wav', '-filter_complex', fg,
                '-map', '[o]', '-t', str(DUR), '-ar', '44100', 'tmp/raw_mix.wav', '-map', '[dchk]', '-t', str(DUR), 'tmp/duck_only.wav'], check=True)
subprocess.run([FF, '-y', '-loglevel', 'error', '-i', 'tmp/raw_mix.wav', '-af', 'loudnorm=I=-14:TP=-2.5:LRA=11', '-ar', '44100', f'{D}/mix.wav'], check=True)

# ---------- 6. cek angka (kita tidak "mendengar", jadi ukur)
if os.path.exists(mp3):
    from scipy.io import wavfile
    def load(p):
        sr, a = wavfile.read(p); a = a.astype(np.float32) / 32768
        return sr, (a.mean(axis=1) if a.ndim > 1 else a)
    sr, vo = load('tmp/vo.wav'); _, bd = load('tmp/duck_only.wav'); m = min(len(vo), len(bd)); vo, bd = vo[:m], bd[:m]
    W = int(.5 * sr); kk = m // W
    rv = np.array([np.sqrt(np.mean(vo[i*W:(i+1)*W] ** 2)) + 1e-9 for i in range(kk)]); rb = np.array([np.sqrt(np.mean(bd[i*W:(i+1)*W] ** 2)) + 1e-9 for i in range(kk)])
    sp = rv > np.percentile(rv, 40)
    print('ducking: suara vs musik saat bicara = %.1f dB (target 10-16)' % (20 * np.log10(rv[sp].mean()) - 20 * np.log10(rb[sp].mean())))
r = run([FF, '-nostats', '-i', f'{D}/mix.wav', '-af', 'ebur128=peak=true', '-f', 'null', '-']).stderr
print('loudness:', ' | '.join(l.strip() for l in r.splitlines() if re.match(r'\s*(I:|Peak:)', l))[-80:])
print(f'SELESAI -> {D}/mix.wav, {D}/scenes.json, {D}/env.json')
