#!/bin/bash
# Generate the in-house sound-library expansion (2026-07): fans & hums, wind,
# little-ones beds, shaped variants of our licensed recordings, blends, and
# noise variants. Every output is HONEST audio — synthesized in-house or
# derived from the already-credited recordings in assets/audio (see
# AUDIO_CREDITS). Loop beds: blends 75s, synth/shaped 90s, piano pieces 120s.
# Profile matches the bundle: mono, 96kbps mp3, loudnorm.
set -e
cd "$(dirname "$0")/../assets/audio"
LN="loudnorm=I=-16:TP=-1.5"
LNQ="loudnorm=I=-18:TP=-2"  # quieter beds (distant / little ones)

blend2() { # out in1 vol1 in2 vol2 dur [loop2]
  local LOOP2=""; [ "${7:-}" = "loop" ] && LOOP2="-stream_loop -1"
  ffmpeg -y -loglevel error -i "$2" $LOOP2 -i "$4" -filter_complex \
    "[0:a]volume=$3[a];[1:a]volume=$5[b];[a][b]amix=inputs=2:duration=first:normalize=0,$LN" \
    -t "$6" -ac 1 -b:a 96k "$1"
  echo "  $1"
}

# ---------- fans & hums (synthesized) ----------
ffmpeg -y -loglevel error -f lavfi -i "anoisesrc=color=brown:sample_rate=44100:duration=90" \
  -af "highpass=f=80,lowpass=f=700,tremolo=f=0.7:d=0.10,$LN" -ac 1 -b:a 96k ceiling-fan.mp3; echo "  ceiling-fan.mp3"
ffmpeg -y -loglevel error -f lavfi -i "anoisesrc=color=pink:sample_rate=44100:duration=90" \
  -af "highpass=f=120,lowpass=f=2000,tremolo=f=1.6:d=0.12,$LN" -ac 1 -b:a 96k desk-fan.mp3; echo "  desk-fan.mp3"
ffmpeg -y -loglevel error -f lavfi -i "anoisesrc=color=brown:sample_rate=44100:duration=90" -f lavfi -i "anoisesrc=color=white:sample_rate=44100:duration=90" \
  -filter_complex "[0:a]lowpass=f=450,volume=1.0[low];[1:a]highpass=f=900,lowpass=f=3500,volume=0.12[hiss];[low][hiss]amix=inputs=2:duration=first:normalize=0,tremolo=f=0.25:d=0.04,$LN" \
  -ac 1 -b:a 96k airplane-cabin.mp3; echo "  airplane-cabin.mp3"
ffmpeg -y -loglevel error -f lavfi -i "anoisesrc=color=brown:sample_rate=44100:duration=90" \
  -af "lowpass=f=300,tremolo=f=0.4:d=0.15,$LN" -ac 1 -b:a 96k night-train.mp3; echo "  night-train.mp3"
ffmpeg -y -loglevel error -f lavfi -i "sine=frequency=120:sample_rate=44100:duration=90" -f lavfi -i "anoisesrc=color=pink:sample_rate=44100:duration=90" \
  -filter_complex "[0:a]volume=0.18[h];[1:a]lowpass=f=900,volume=0.7[n];[h][n]amix=inputs=2:duration=first:normalize=0,$LN" \
  -ac 1 -b:a 96k ac-hum.mp3; echo "  ac-hum.mp3"
ffmpeg -y -loglevel error -f lavfi -i "anoisesrc=color=brown:sample_rate=44100:duration=90" \
  -af "lowpass=f=250,tremolo=f=0.2:d=0.25,$LNQ" -ac 1 -b:a 96k night-drive.mp3; echo "  night-drive.mp3"
ffmpeg -y -loglevel error -f lavfi -i "anoisesrc=color=brown:sample_rate=44100:duration=90" \
  -af "highpass=f=100,lowpass=f=1200,firequalizer=gain_entry='entry(400,4);entry(800,2)',tremolo=f=1.2:d=0.10,$LN" -ac 1 -b:a 96k tumble-dryer.mp3; echo "  tumble-dryer.mp3"

# ---------- wind & air (synthesized gusting) ----------
ffmpeg -y -loglevel error -f lavfi -i "anoisesrc=color=pink:sample_rate=44100:duration=90" \
  -af "lowpass=f=1200,tremolo=f=0.15:d=0.5,tremolo=f=0.37:d=0.3,$LN" -ac 1 -b:a 96k soft-wind.mp3; echo "  soft-wind.mp3"
ffmpeg -y -loglevel error -f lavfi -i "anoisesrc=color=brown:sample_rate=44100:duration=90" -f lavfi -i "anoisesrc=color=pink:sample_rate=44100:duration=90" \
  -filter_complex "[0:a]volume=0.8[b];[1:a]lowpass=f=800,volume=0.5[p];[b][p]amix=inputs=2:duration=first:normalize=0,tremolo=f=0.11:d=0.45,tremolo=f=0.29:d=0.25,$LN" \
  -ac 1 -b:a 96k mountain-wind.mp3; echo "  mountain-wind.mp3"
ffmpeg -y -loglevel error -f lavfi -i "anoisesrc=color=pink:sample_rate=44100:duration=90" \
  -af "highpass=f=200,lowpass=f=2600,tremolo=f=0.21:d=0.55,tremolo=f=0.53:d=0.3,$LN" -ac 1 -b:a 96k winter-wind.mp3; echo "  winter-wind.mp3"
ffmpeg -y -loglevel error -i green-noise.mp3 -af "tremolo=f=0.17:d=0.45,tremolo=f=0.41:d=0.25,$LN" -t 90 -ac 1 -b:a 96k leaf-wind.mp3; echo "  leaf-wind.mp3"

# ---------- little ones (synthesized; womb/heartbeat are classic baby beds) ----------
# heartbeat: ~58bpm lub-dub from a 50Hz thump (sine gated by an envelope built from two tremolos)
ffmpeg -y -loglevel error -f lavfi -i "sine=frequency=50:sample_rate=44100:duration=90" \
  -af "tremolo=f=0.97:d=0.95,tremolo=f=1.94:d=0.5,lowpass=f=150,volume=1.6,$LNQ" -ac 1 -b:a 96k heartbeat.mp3; echo "  heartbeat.mp3"
ffmpeg -y -loglevel error -f lavfi -i "anoisesrc=color=brown:sample_rate=44100:duration=90" -f lavfi -i "sine=frequency=50:sample_rate=44100:duration=90" \
  -filter_complex "[0:a]lowpass=f=250,volume=0.7[w];[1:a]tremolo=f=1.03:d=0.95,tremolo=f=2.06:d=0.5,lowpass=f=150,volume=0.9[h];[w][h]amix=inputs=2:duration=first:normalize=0,$LNQ" \
  -ac 1 -b:a 96k womb.mp3; echo "  womb.mp3"
ffmpeg -y -loglevel error -f lavfi -i "anoisesrc=color=white:sample_rate=44100:duration=90" \
  -af "lowpass=f=2500,highpass=f=300,tremolo=f=0.24:d=0.75,$LNQ" -ac 1 -b:a 96k shush.mp3; echo "  shush.mp3"

# ---------- shaped variants of the real recordings ----------
ffmpeg -y -loglevel error -i rain.mp3 -af "lowpass=f=3500,firequalizer=gain_entry='entry(300,-3);entry(2500,2)',aecho=0.7:0.6:28:0.25,$LN" -t 90 -ac 1 -b:a 96k rain-window.mp3; echo "  rain-window.mp3"
ffmpeg -y -loglevel error -i rain.mp3 -af "lowpass=f=2200,firequalizer=gain_entry='entry(120,4);entry(700,3)',$LN" -t 90 -ac 1 -b:a 96k rain-tent.mp3; echo "  rain-tent.mp3"
ffmpeg -y -loglevel error -i rain.mp3 -af "lowpass=f=1200,volume=0.7,aecho=0.6:0.5:60:0.3,$LNQ" -t 90 -ac 1 -b:a 96k rain-distant.mp3; echo "  rain-distant.mp3"
blend2 rain-heavy.mp3 rain.mp3 1.0 brown-noise.mp3 0.35 75 loop
ffmpeg -y -loglevel error -i waves.mp3 -af "asetrate=44100*0.88,aresample=44100,lowpass=f=1600,$LN" -t 90 -ac 1 -b:a 96k deep-swell.mp3; echo "  deep-swell.mp3"
ffmpeg -y -loglevel error -i ocean.mp3 -af "lowpass=f=1000,volume=0.75,aecho=0.6:0.5:55:0.3,$LNQ" -t 90 -ac 1 -b:a 96k sea-dunes.mp3; echo "  sea-dunes.mp3"
ffmpeg -y -loglevel error -i forest.mp3 -af "lowpass=f=1900,firequalizer=gain_entry='entry(4000,-6)',$LNQ" -t 90 -ac 1 -b:a 96k forest-dusk.mp3; echo "  forest-dusk.mp3"
ffmpeg -y -loglevel error -i birdsong.mp3 -af "lowpass=f=3000,volume=0.7,aecho=0.6:0.5:70:0.3,$LNQ" -t 90 -ac 1 -b:a 96k birds-far.mp3; echo "  birds-far.mp3"
ffmpeg -y -loglevel error -stream_loop -1 -i fire.mp3 -af "lowpass=f=1500,firequalizer=gain_entry='entry(150,3)',$LNQ" -t 90 -ac 1 -b:a 96k embers.mp3; echo "  embers.mp3"

# ---------- blends (of credited recordings) ----------
blend2 piano-fire.mp3 piano.mp3 1.0 fire.mp3 0.55 120 loop
blend2 piano-sea.mp3 piano.mp3 1.0 ocean.mp3 0.45 120
blend2 piano-birds.mp3 piano.mp3 1.0 birdsong.mp3 0.4 120
blend2 gymnopedie-rain.mp3 gymnopedie.mp3 1.0 rain.mp3 0.4 120
blend2 forest-campfire.mp3 forest.mp3 1.0 fire.mp3 0.7 75 loop
blend2 shore-morning.mp3 waves.mp3 1.0 birdsong.mp3 0.5 75
blend2 fireside-hush.mp3 fire.mp3 1.0 brown-noise.mp3 0.3 60 loop
# 3-layer: storm rolling in (rain + waves + deep low)
ffmpeg -y -loglevel error -i rain.mp3 -i waves.mp3 -i brown-noise.mp3 -filter_complex \
  "[0:a]volume=1.0[r];[1:a]volume=0.7[w];[2:a]lowpass=f=200,volume=0.4[b];[r][w][b]amix=inputs=3:duration=first:normalize=0,$LN" \
  -t 75 -ac 1 -b:a 96k storm-rolling.mp3; echo "  storm-rolling.mp3"
# 3-layer: the cabin (rain on the roof + fire + distant sea)
ffmpeg -y -loglevel error -i rain.mp3 -stream_loop -1 -i fire.mp3 -i ocean.mp3 -filter_complex \
  "[0:a]lowpass=f=2500,volume=0.9[r];[1:a]volume=0.8[f];[2:a]lowpass=f=900,volume=0.35[o];[r][f][o]amix=inputs=3:duration=first:normalize=0,$LN" \
  -t 75 -ac 1 -b:a 96k the-cabin.mp3; echo "  the-cabin.mp3"

# ---------- noise variants (synthesized) ----------
ffmpeg -y -loglevel error -f lavfi -i "anoisesrc=color=brown:sample_rate=44100:duration=90" -af "lowpass=f=200,$LN" -ac 1 -b:a 96k deep-brown.mp3; echo "  deep-brown.mp3"
ffmpeg -y -loglevel error -f lavfi -i "anoisesrc=color=white:sample_rate=44100:duration=90" -af "lowpass=f=4000,$LN" -ac 1 -b:a 96k soft-white.mp3; echo "  soft-white.mp3"
ffmpeg -y -loglevel error -f lavfi -i "anoisesrc=color=pink:sample_rate=44100:duration=90" -af "lowpass=f=800,$LN" -ac 1 -b:a 96k warm-pink.mp3; echo "  warm-pink.mp3"

echo "done."
