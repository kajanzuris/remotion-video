#!/usr/bin/env python3
"""
Buat public/<video>/scenes.src.json OTOMATIS dari voiceover.srt (untuk video dengan bahan hanya MP3 + SRT).

    python3 tools/autoscenes.py video2 --style block --cta "Tulis komentarmu"
    python3 tools/autoscenes.py video2 --style sprite --bgs 3 --char img/girl_idle.png --talk img/girl_talk.png

Opsi:
  --style  stick | robot | block | sprite      (default stick)
  --char   gambar karakter (sprite) atau tipe vektor: girl | boss | robot   (default girl)
  --talk   gambar karakter mulut terbuka (sprite, opsional)
  --bgs    jumlah gambar latar img/bg1.png ... bgN.png (sprite)
  --cta    teks ajakan di akhir (kosong = tanpa CTA)

Hasilnya generik (latar, pose, aksen bergantian; kata terpanjang ditandai *penting*). Edit file hasilnya bila perlu.
Kartu (list/stat) tidak dibuat otomatis karena butuh isi yang bermakna: tambahkan manual.
"""
import argparse, json, os, re

ap = argparse.ArgumentParser()
ap.add_argument('video'); ap.add_argument('--style', default='stick'); ap.add_argument('--char', default='girl')
ap.add_argument('--talk', default=''); ap.add_argument('--bgs', type=int, default=3); ap.add_argument('--cta', default='')
ap.add_argument('--maxwords', type=int, default=9)
a = ap.parse_args()
D = f'public/{a.video}'

def ts(x):
    h, m, r = x.split(':'); s, ms = r.replace(',', '.').split('.')
    return int(h) * 3600 + int(m) * 60 + int(s) + int(ms.ljust(3, '0')[:3]) / 1000
segs = []
for blk in re.split(r'\n\s*\n', open(f'{D}/voiceover.srt', encoding='utf-8').read().strip().replace('\r', '')):
    ln = blk.split('\n'); i = next((k for k, l in enumerate(ln) if '-->' in l), None)
    if i is None: continue
    s0, s1 = [ts(x.strip()) for x in ln[i].split('-->')]
    segs.append((s0, s1, ' '.join(ln[i + 1:]).strip()))

# pecah kalimat jadi frasa pendek (di tanda baca), gabungkan frasa terlalu pendek, belah frasa terlalu panjang
phrases = []
for s0, s1, text in segs:
    parts = [p.strip() for p in re.split(r'(?<=[,.;?!])\s+', text) if p.strip()]
    merged = []
    for p in parts:
        if merged and len(merged[-1].split()) < 3: merged[-1] += ' ' + p
        else: merged.append(p)
    if len(merged) > 1 and len(merged[-1].split()) < 3: merged[-2] += ' ' + merged.pop()
    out = []
    for p in merged:
        w = p.split()
        while len(w) > a.maxwords:
            cut = len(w) // 2; out.append(' '.join(w[:cut])); w = w[cut:]
        out.append(' '.join(w))
    tot = sum(len(p) for p in out) or 1; t = s0
    for p in out:
        d = (s1 - s0) * len(p) / tot; phrases.append((t, p)); t += d

STOP = set('yang dan atau untuk dengan dari pada kita kamu aku itu ini juga sudah akan bisa lebih saja nggak gak tidak bukan karena supaya biar sampai udah masih agak jadi gini deh sih kok loh lo ya nah oh coba'.split())
def highlight(text):
    ws = text.split()
    cand = sorted([i for i, w in enumerate(ws) if len(re.sub(r'\W', '', w)) >= 5 and re.sub(r'\W', '', w).lower() not in STOP], key=lambda i: -len(ws[i]))[:2]
    return ' '.join(f'*{w}*' if i in cand else w for i, w in enumerate(ws))

BGS = ['dawn', 'dusk', 'room', 'stage', 'night', 'day', 'office']
POSES = ['sad', 'idle', 'tremble', 'point', 'think', 'wave', 'walk', 'idle', 'cheer']
ACC = ['#FFA500', '#FFD700', '#FF4500', '#1E90FF', '#9370DB', '#FF6347', '#00FF7F', '#FF8C00', '#ADFF2F', '#FF69B4', '#00CED1', '#FFFF00']
PROPS = ['shadow', None, 'phone', 'crowd', 'orb', None, 'bulb', None, 'think', None]
sprite = a.style == 'sprite'
scenes = []
for i, (t, p) in enumerate(phrases):
    last = i == len(phrases) - 1
    ch = dict(x=500 if i % 3 else 440, pose='cheer' if last else POSES[i % len(POSES)])
    if sprite:
        ch['type'] = 'sprite'; ch['img'] = a.char if a.char.startswith('img/') else 'img/char_idle.png'
        if a.talk: ch['talkImg'] = a.talk
    else:
        ch['type'] = a.char if a.char in ('girl', 'boss', 'robot') else 'girl'
        if ch['pose'] == 'walk': ch['x'] = 200; ch['walkTo'] = 600
    sc = dict(title=highlight(p), start=round(t, 3), accent=ACC[i % len(ACC)],
              bg=(f'img/bg{i % max(1, a.bgs) + 1}.png' if sprite else ('stage' if last else BGS[i % len(BGS)])), chars=[ch])
    prop = 'confetti' if last else PROPS[i % len(PROPS)]
    if prop and not sprite: sc['prop'] = prop
    scenes.append(sc)

data = dict(durationInFrames=900, watermark='', music=False, style=a.style, scenes=scenes)
if a.cta: data['cta'] = a.cta
os.makedirs(D, exist_ok=True)
json.dump(data, open(f'{D}/scenes.src.json', 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
print(f'{len(scenes)} adegan ditulis ke {D}/scenes.src.json (gaya {a.style}). Lanjut: python3 tools/prepare.py {a.video}')
