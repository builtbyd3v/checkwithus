#!/usr/bin/env bash
# Generates every audio file for the demo videos with the ElevenLabs REST API.
# Usage (from video/): bash scripts/audio.sh        # make missing files
#                      FORCE=1 bash scripts/audio.sh # remake everything
#                      ONLY=vo07 bash scripts/audio.sh # remake one file
#                      bash scripts/audio.sh check   # durations + speech-to-text
# Needs ELEVENLABS_API_KEY in video/.env. The key is never printed.
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.env; set +a
API=https://api.elevenlabs.io/v1
OUT=public/audio
mkdir -p "$OUT"

VOICE=EXAVITQu4vr4xnSDxMaL # Sarah (premade, American, mature, reassuring)
MODEL=eleven_multilingual_v2 # high quality and supports voice_settings.speed (eleven_v4 has no speed)

want() { # want <name>: true if the file must be (re)made
  [[ -n "${ONLY:-}" ]] && { [[ "$ONLY" == "$1" ]]; return; }
  [[ "${FORCE:-0}" == 1 || ! -s "$OUT/$1.mp3" ]]
}

post() { # post <url> <json> <out file>
  local tmp code
  tmp=$(mktemp)
  code=$(curl -sS -o "$tmp" -w '%{http_code}' -X POST "$1" \
    -H "xi-api-key: $ELEVENLABS_API_KEY" -H "Content-Type: application/json" -d "$2")
  if [[ "$code" != 200 ]]; then echo "HTTP $code for $3: $(head -c 400 "$tmp")" >&2; rm -f "$tmp"; return 1; fi
  mv "$tmp" "$3"; echo "made $3"
}

body() { # body <base json> <key> <string value>: adds one string field safely
  python3 -c 'import json,sys; d=json.loads(sys.argv[1]); d[sys.argv[2]]=sys.argv[3]; print(json.dumps(d))' "$1" "$2" "$3"
}

tts() { # tts <name> <speed> <text>
  want "$1" || return 0
  local base='{"model_id":"'$MODEL'","voice_settings":{"stability":0.5,"similarity_boost":0.75,"speed":'$2'}}'
  post "$API/text-to-speech/$VOICE?output_format=mp3_44100_128" "$(body "$base" text "$3")" "$OUT/$1.mp3"
}
sfx() { # sfx <name> <seconds> <prompt>
  want "$1" || return 0
  local base='{"duration_seconds":'$2',"prompt_influence":0.6}'
  post "$API/sound-generation?output_format=mp3_44100_128" "$(body "$base" text "$3")" "$OUT/$1.mp3"
}
music() { # music <name> <ms> <prompt>
  want "$1" || return 0
  local base='{"music_length_ms":'$2',"force_instrumental":true}'
  post "$API/music?output_format=mp3_44100_128" "$(body "$base" prompt "$3")" "$OUT/$1.mp3"
}

# name|window frames (vo starts 8 frames in, the logo line 10 frames in; must end 10 frames before the window ends)
WINDOWS="vo01 150 8|vo02 150 8|vo03 120 8|vo04 240 8|vo05 150 8|vo06 360 8|vo07 270 8|vo08 300 8|vo09 270 8|vo10 150 8|vo11 150 10"

if [[ "${1:-}" == check ]]; then
  printf '%-6s %8s %8s %s\n' name dur_s max_s fits
  IFS='|' read -ra rows <<<"$WINDOWS"
  for r in "${rows[@]}"; do
    read -r n w s <<<"$r"
    d=$(afinfo "$OUT/$n.mp3" | awk '/estimated duration/ {print $3}')
    max=$(python3 -c "print(round(($w-$s-10)/30,2))")
    printf '%-6s %8.2f %8.2f %s\n' "$n" "$d" "$max" "$(python3 -c "print('yes' if $d <= $max else 'NO')")"
  done
  for r in "${rows[@]}"; do
    read -r n _ _ <<<"$r"
    t=$(curl -sS -X POST "$API/speech-to-text" -H "xi-api-key: $ELEVENLABS_API_KEY" \
      -F "file=@$OUT/$n.mp3" -F model_id=scribe_v2 -F language_code=en | python3 -c 'import json,sys; print(json.load(sys.stdin).get("text"))')
    echo "$n: $t"
  done
  exit 0
fi

# Voiceover (Devpost cut only). Spelled for pronunciation.
tts vo01 1.12 "Rosa's phone checks every text on the device. Scams go straight to Junk."
tts vo02 1.05 "Scam calls ring as Possible scam. Rosa answers anyway."
tts vo03 1.0 "The caller sends Rosa to the ATM."
tts vo04 1.05 "Then a gift card. Together, that's a scam. Fixed code pauses it, and the family says no."
tts vo05 1.0 "One tap moves the balance to a safe vault."
tts vo06 1.05 "Here's how it works. On the iPhone, a Message Filter and a Call Directory run our own one megabyte scam model. Texts never leave the phone."
tts vo07 1.15 "Every payment lands in a Tiger Data hypertable. Real-time continuous aggregates ask: is this three times Rosa's usual? In about a millisecond."
tts vo08 1.15 "Auth zero decides who can say yes. Approvers and viewers are separate roles. Over a thousand dollars, two must agree, and approving needs Face ID."
tts vo09 1.1 "Capital One Nessie is Rosa's bank. Ten resource types do real work, and one transfer powers Freeze, exactly once."
tts vo10 1.0 "Rosa learns nothing new. One action per screen, in plain words."
tts vo11 1.0 "Before money moves, check with us."

# Music, instrumental only.
music music-judge 30000 "Playful but calm instrumental, light and friendly, soft marimba and pizzicato strings with warm piano, gentle groove, a soft resolving ending at 29 seconds. No vocals."
music music-devpost 77000 "Calm, warm, hopeful instrumental, soft piano and light plucked strings, steady and unobtrusive under narration, gentle swell at the end. No vocals."

# Sound effects: short, clean, cartoonish but not silly.
sfx sfx-buzz 1 "Smartphone vibrating on a wooden side table, two short buzzes, clean"
sfx sfx-whoosh 0.6 "Light quick swoosh, clean UI transition"
sfx sfx-ring 2 "Soft modern smartphone ringtone, gentle melodic"
sfx sfx-cash 1.2 "ATM machine dispensing paper bills, mechanical whirr"
sfx sfx-pause 0.8 "Soft two-note alert chime, friendly, descending"
sfx sfx-grumble 1 "Cartoon frustrated huff from an older person, short exhale, no words"
sfx sfx-ping 0.6 "Friendly notification ping, bright and soft"
sfx sfx-coins 1.2 "Coins flying and dropping into a metal vault, cartoon sparkle"
sfx sfx-clunk 0.8 "Heavy steel vault door shutting with a solid clunk"
sfx sfx-chime 1.5 "Brand logo shimmer chime, warm sparkling bell, clean"
sfx sfx-tick 0.5 "Soft single UI tick click, subtle" # ponytail: API minimum is 0.5 s, so no 0.3 s tick
