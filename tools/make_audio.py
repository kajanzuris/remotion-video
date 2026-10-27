import numpy as np, json, wave, sys
from scipy.signal import butter, sosfilt
np.random.seed(7)
SR = 44100
cues = json.load(open('tools/cues.json'))
DUR = cues['dur']; M = cues['music']; BEAT = 60.0 / M['bpm']; BAR = BEAT * 4
BED = ('--bed' in sys.argv) or M.get('profile') == 'bed'   # Mode B/D: bed musik + SFX terpisah (Fase 6B)
AG = .5 if BED else 1.0                                   # arpeggio dikecilkan di bawah suara
N = int(DUR * SR) + SR
music = np.zeros((N, 2)); drums = np.zeros((N, 2)); sfx = np.zeros((N, 2))

def tt(d): return np.arange(int(d * SR)) / SR
def place(buf, sig, t, pan=0.0, gain=1.0):
    i = int(t * SR)
    if i < 0 or i >= N: return
    n = min(len(sig), N - i)
    l = np.cos((pan + 1) * np.pi / 4) * 1.4142; r = np.sin((pan + 1) * np.pi / 4) * 1.4142
    buf[i:i+n, 0] += sig[:n] * gain * l; buf[i:i+n, 1] += sig[:n] * gain * r
def filt(x, kind, f, order=3): return sosfilt(butter(order, f, btype=kind, fs=SR, output='sos'), x)
def noise(d): return np.random.randn(int(d * SR))
def sweep_tone(d, f0, f1, curve=1.0):
    t = tt(d); f = f0 + (f1 - f0) * (t / d) ** curve; return np.sin(2 * np.pi * np.cumsum(f) / SR)
def sweep_noise(d, f0, f1, q=1.6):
    x = noise(d); out = np.zeros_like(x); W = 2048; H = 1024; win = np.hanning(W); nch = max(1, len(x) // H - 1)
    for k in range(nch):
        s = k * H; fc = f0 * (f1 / f0) ** (k / max(1, nch - 1)); seg = x[s:s+W]
        if len(seg) < W: break
        out[s:s+W] += filt(seg, 'band', [max(60, fc / q), min(SR / 2 - 500, fc * q)], 2) * win
    return out / (np.max(np.abs(out)) + 1e-9)

# ---- bunyi dasar
def kick():
    t = tt(.5); s = np.sin(2 * np.pi * np.cumsum(48 + 130 * np.exp(-t * 30)) / SR) * np.exp(-t * 8)
    s[:150] += np.random.randn(150) * 0.4 * np.linspace(1, 0, 150); return s
def clap():
    t = tt(.25); n = filt(noise(.25), 'band', [900, 3500], 2); e = np.exp(-t * 20) * 0.5
    for o in (0, .011, .022): e += np.exp(-np.clip(t - o, 0, None) * 120) * (t >= o)
    return n * e * 0.7
def hat(o=False):
    d = .22 if o else .07; return filt(noise(d), 'high', 7000, 2) * np.exp(-tt(d) * (18 if o else 70)) * 0.5
def impact():
    t = tt(1.6); return np.sin(2*np.pi*np.cumsum(28 + 70*np.exp(-t*5))/SR) * np.exp(-t*2.6) + filt(noise(1.6), 'low', 500, 2) * np.exp(-t*3.2) * 0.7
def thud():
    t = tt(.35); return np.sin(2*np.pi*np.cumsum(50 + 70*np.exp(-t*25))/SR) * np.exp(-t*12) + filt(noise(.35), 'low', 700, 2) * np.exp(-t*45) * 0.6
def pop():
    t = tt(.16); return np.sin(2*np.pi*np.cumsum(350 + 800*np.exp(-t*30))/SR) * np.exp(-t*30)
def plink():
    t = tt(.3); f = 700 + 900*np.exp(-t*25); return (np.sin(2*np.pi*np.cumsum(f)/SR) + .3*np.sin(4*np.pi*np.cumsum(f)/SR)) * np.exp(-t*16)
def tick(): return filt(noise(.03), 'high', 3000, 2) * np.exp(-tt(.03) * 160)
def bell(f, d=1.4):
    t = tt(d); s = 0
    for m, a, k in [(1, 1, 3), (2.76, .5, 5), (5.4, .3, 8), (8.93, .15, 12)]: s = s + a*np.sin(2*np.pi*f*m*t)*np.exp(-t*k)
    return s * 0.6
def sparkle(t0, pan=0):
    for i, fq in enumerate([880, 1318, 1760, 2637, 3520]): place(sfx, bell(fq, .9) * 0.5, t0 + i*.055, pan + (i-2)*.2, 0.5)
def whoosh(t0, d, f0, f1, gain=.8, pan=0):
    x = sweep_noise(d, f0, f1); place(sfx, x * np.sin(np.pi * np.linspace(0, 1, len(x))) ** 2, t0, pan, gain)
def riser(t0, d, gain=.8):
    x = sweep_noise(d, 250, 7000, 1.8); e = np.linspace(0, 1, len(x)) ** 2.2
    place(sfx, (x + sweep_tone(d, 180, 1500, 2.0) * .25) * e, t0, 0, gain)

# ---- musik
NOTE = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
def chord(name):
    r = NOTE[name[0]]; rest = name[1:]
    if rest[:1] == '#': r += 1; rest = rest[1:]
    elif rest[:1] == 'b': r -= 1; rest = rest[1:]
    minor = rest.startswith('m') and not rest.startswith('maj'); root = 36 + r
    while root < 41: root += 12
    return [440 * 2 ** ((m - 69) / 12) for m in (root, root + (3 if minor else 4), root + 7)]
def pluck(f, d=.3):
    t = tt(d); return sum((1 / n**1.4) * np.sin(2*np.pi*f*n*t) * np.exp(-t*(9 + 4*n)) for n in range(1, 7))
def bass(f, d=.24):
    t = tt(d); s = np.sin(2*np.pi*f*t) + .5*np.sin(4*np.pi*f*t)*np.exp(-t*10) + .3*np.sin(6*np.pi*f*t)*np.exp(-t*14)
    return s * np.minimum(1, t / .004) * np.exp(-t * 4)
def pad(freqs, d, det):
    t = tt(d); s = sum(np.sin(2*np.pi*f*det*n*t) / n**1.5 for f in freqs for n in range(1, 9))
    return s * np.minimum(1, t / .7) * np.minimum(1, (d - t) / .7) / len(freqs)

breaks = M.get('breaks', []); FINAL = M['final']
def on(t): return t < FINAL and not any(a <= t < b for a, b in breaks)

# drum
t = 0.0; kicks = []
while t < FINAL:
    if on(t): place(drums, kick(), t, 0, .95); kicks.append(t)
    t += BEAT
for a, b in breaks:
    for tb in (a, b - 2 * BEAT, b - BEAT): place(drums, kick(), tb, 0, .5)
t = 0.0
while t < FINAL:
    if on(t):
        beat_in_bar = round((t % BAR) / BEAT)
        if t >= M.get('clap_from', 2.0) and beat_in_bar in (1, 3): place(drums, clap(), t, 0, .8)
        if t >= M.get('hat_from', 2.0):
            place(drums, hat(), t + BEAT / 2, .3, .8); place(drums, hat(), t + BEAT / 4, -.3, .45)
    t += BEAT
if M.get('build'):
    x, gap, a = M['build'][0], .25, M['build'][0]
    while x < M['build'][1]:
        place(drums, clap(), x, 0, .5 + .5 * (x - a) / (M['build'][1] - a)); gap = max(.0625, gap * .8); x += gap
    riser(M['build'][0] - 1.0, M['build'][1] - M['build'][0] + 1.0, .7)
duck = np.ones(N)
for k in kicks:
    i = int(k * SR); n = int(.4 * SR); e = 1 - .6 * np.exp(-np.arange(n) / SR * 9); seg = duck[i:i+n]; duck[i:i+len(seg)] = np.minimum(seg, e[:len(seg)])
# bass, arp, pad per bar
nb = int(np.ceil(FINAL / BAR)) + 1
for bi in range(nb):
    t0 = bi * BAR; ch = chord(M['bars'][bi % len(M['bars'])]); inbreak = any(a <= t0 < b for a, b in breaks)
    if on(t0):
        for k in range(8): place(music, bass(ch[0]), t0 + k * BEAT / 2, 0, .9)
        place(music, np.sin(2*np.pi*(ch[0]/2)*tt(BAR*.95)) * np.minimum(1, tt(BAR*.95)/.05) * np.minimum(1, (BAR*.95 - tt(BAR*.95))/.2), t0, 0, .45)
    if t0 >= M.get('arp_from', 0) and t0 < FINAL:
        if inbreak:
            for k in range(8): place(music, pluck(ch[k % 3] * 4, .5), t0 + k * BEAT / 2, ((k % 3) - 1) * .4, .28 * AG)
        else:
            notes = [ch[0]*2, ch[1]*2, ch[2]*2, ch[1]*4, ch[2]*2, ch[1]*2, ch[0]*4, ch[2]*4]
            for k in range(16): place(music, pluck(notes[k % 8]), t0 + k * BEAT / 4, ((k % 4) - 1.5) * .3, .35 * AG)
    if t0 < FINAL:
        g = .5 if inbreak else .32; pf = [x * 2 for x in ch]
        place(music, pad(pf, BAR, 1.003), t0, -.5, g); place(music, pad(pf, BAR, .997), t0, .5, g)
fc = [x * 4 for x in chord(M.get('final_chord', M['bars'][-1]))] + [chord(M.get('final_chord', M['bars'][-1]))[0] * 8]
place(music, pad(fc, 1.5, 1.003), FINAL, -.5, .55); place(music, pad(fc, 1.5, .997), FINAL, .5, .55); place(drums, impact(), FINAL, 0, .7)

# ---- SFX dari cues
for e in cues['sfx']:
    t, ty, g, p, d = e['t'], e['type'], e.get('gain', .8), e.get('pan', 0), e.get('d')
    if   ty == 'impact': place(sfx, impact(), t, p, g)
    elif ty == 'thud':   place(sfx, thud(), t, p, g)
    elif ty == 'clap':   place(sfx, clap(), t, p, g)
    elif ty == 'pop':    place(sfx, pop(), t, p, g)
    elif ty == 'plink':  place(sfx, plink(), t, p, g)
    elif ty == 'tick':   place(sfx, tick(), t, p, g)
    elif ty == 'ticks':
        x = t
        while x < t + d: place(sfx, tick(), x, p, g); x += e.get('step', .1)
    elif ty == 'bell':    place(sfx, bell(e.get('f', 1318)), t, p, g)
    elif ty == 'sparkle': sparkle(t, p)
    elif ty == 'whoosh':  whoosh(t, d or .5, e.get('f0', 300), e.get('f1', 5200), g, p)
    elif ty == 'riser':   riser(t, d or 1.2, g)
    elif ty == 'rise':    place(sfx, sweep_tone(d, e.get('f0', 250), e.get('f1', 1000), 1.3) * np.sin(np.pi * np.linspace(0, 1, int(d * SR))) * .2, t, p, g)
    elif ty == 'shimmer': place(sfx, filt(noise(d), 'high', 5000, 2) * np.sin(np.pi * np.linspace(0, 1, int(d * SR))) * .12, t, p, g)

# ---- mix
n = int(DUR * SR)
def wav_out(name, x):
    x = x[:n].copy(); fo = int(.8 * SR); x[-fo:] *= np.linspace(1, 0, fo)[:, None]
    x = x / (np.max(np.abs(x)) + 1e-9) * .9
    with wave.open(name, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((x * 32767).astype('<i2').tobytes())
if BED:   # Mode B/D: bed musik dan SFX dipisah supaya hanya musik yang di-duck oleh suara (Fase 6B)
    wav_out('tmp/bed.wav', np.tanh((music * duck[:, None] * .55 + drums * .5) * .9))
    wav_out('tmp/sfx.wav', np.tanh(sfx * .8))
else:
    wav_out('tmp/raw_mix.wav', np.tanh((music * duck[:, None] * .55 + drums * .8 + sfx * .95) * .9))
print('audio ok', n / SR, 'dtk', '(bed + sfx)' if BED else '')
