# CheckWithUs Ask My Family button

An ESP32 button creates an assistance request, not a payment. It does not know the
merchant, item or price and cannot authorize money. Its `cwh_` credential is separate
from phone credentials and Auth0 family authentication.

## Wiring (USB power disconnected while wiring)

Target: **classic ESP32 DevKit / ESP32-WROOM**, 3.3 V GPIO, USB-powered.

| Component | Connection |
| --- | --- |
| Momentary button terminal 1 | GPIO **27** |
| Momentary button terminal 2 | GND |
| Passive piezo positive | GPIO **18**, through **100–220 Ω** in series |
| Passive piezo negative | GND |
| DevKit power | USB data/power cable and suitable USB supply |

GPIO27 uses `INPUT_PULLUP`: open = HIGH, pressed = LOW. No external pull-up is
needed. A four-leg tactile switch has two internally joined pairs: use terminals
from opposite pairs (check continuity). Do not connect the button to 5 V.

Only directly drive a **two-pin, low-current passive piezo** whose data sheet
permits a 3.3 V GPIO drive. The series resistor limits charging transients; it does
not make an arbitrary buzzer safe. An active buzzer has its own oscillator and
will not reproduce these tone patterns correctly. A magnetic buzzer/speaker or
unknown/high-current buzzer needs a driver:

- GPIO18 → about 1 kΩ → NPN base; about 10 kΩ base-to-emitter pull-down.
- Emitter → GND; collector → buzzer negative; buzzer positive → its rated supply.
- ESP32 GND and buzzer supply GND must be common. Choose a transistor rated for
  the buzzer current and verify base drive/saturation, or use a suitable logic-level
  MOSFET driver module.
- For an **inductive** magnetic buzzer add a flyback diode across the load
  (cathode to supply, anode to collector). A passive piezo is capacitive; follow
  its manufacturer's driver guidance instead.

Do not interpret the ESP32 data sheet's drive-strength test current as permission
to power any load from a GPIO. Check the actual buzzer specification first.
ESP32-C3/S3 and boards without GPIO27 are deliberately rejected at compile time;
port and verify their pin mapping before using them.

## Arduino setup and flash

1. Install Arduino IDE 2.x. In Preferences, add
   `https://espressif.github.io/arduino-esp32/package_esp32_index.json` to Additional
   Boards Manager URLs.
2. Install **esp32 by Espressif Systems, version 3.3.12**. Core 2.x is unsupported:
   this sketch uses `ledcAttach(pin, frequency, resolution)` and `ledcWriteTone(pin, frequency)`.
3. Select **ESP32 Dev Module** (`esp32:esp32:esp32`), the actual USB serial port,
   and start with upload speed 115200. Install the board's CP210x/CH340 USB driver
   if your OS does not recognize it. Use the board's matching flash-size setting.
4. Open `checkwith_button/checkwith_button.ino`. WiFi, WiFiClientSecure,
   HTTPClient, Preferences, FreeRTOS and the ESP32 system/time APIs are bundled
   with the core; **no additional Arduino libraries are required**.
5. Copy `config.example.h` to `config.h` in that sketch folder. `config.h` is
   gitignored. Set the 2.4 GHz Wi-Fi SSID/password and the device UUID/token from
   the dashboard. Keep `BACKEND_ORIGIN` as `https://checkwith.us` (no trailing `/`).
   Public/campus Wi-Fi with a captive portal is not supported; use a private
   2.4 GHz network/hotspot with internet and NTP access.
6. In the family dashboard, select the older adult's circle, then **Ask my family →
   Button setup and contact number → Register ESP32 button**. Copy its device ID
   and one-time token into the config. Registering requires family membership
   (and approver role if the roles migration is installed). This is not a public
   self-registration endpoint. One circle supports eight active buttons.
7. Set a contact number in international form if you want a working **Call** link.
   Use fictional data for the hackathon demo. No phone number is invented.
8. Click Verify, then Upload. Some DevKits require holding BOOT while the uploader
   connects, then releasing it. Open Serial Monitor at **115200 baud** and press EN
   to restart. Logs show event IDs and HTTP statuses, never credentials/passwords.

The empty example compiles but intentionally refuses network delivery. Configure
the ignored file before flashing a demonstration device. Do not put a database
URL, Auth0 client secret or family token on the ESP32.

### TLS

`trust_anchor.h` contains the public **ISRG Root X1** certificate from Let's Encrypt.
The checkwith.us chain was verified against it on October 17, 2026. Firmware uses
CA and hostname verification and refuses redirects. It first obtains clock time
using SNTP so certificate validity can be checked. If hosting changes its issuing
CA, verify the new chain independently and update the public trust anchor; never
use `setInsecure()` or accept an unverified certificate. The included root expires
June 4, 2035; the server's leaf certificate rotates much sooner.

## What the beeps mean

| Pattern | Meaning |
| --- | --- |
| One short 2,000 Hz beep immediately after a debounced press | Button detected locally; **not** proof of server or family receipt |
| Two short higher beeps | Backend returned the exact event receipt; request stored in the dashboard |
| Three lower beeps | Failed/pending delivery, invalid configuration, or full local queue; check Serial Monitor |

Acceptance is **not** proof someone read the request, and not a push-delivery
receipt. A pending request warns again every minute. `DELIVERY_SOUNDS=false`
disables acceptance/failure patterns but keeps the local beep; leave it true for
the demo so delivery failures are audible. This prototype is not an emergency
alarm. If assistance is urgent or delivery fails, contact family another way.

## Reliability and limits

- 50 ms software debounce; only a press edge generates an event. Holding the
  button down, including while booting, does not generate repeats.
- Button/tone handling runs in the Arduino loop. HTTPS runs in a FreeRTOS worker
  with bounded connection/read/handshake timeouts, so network waits do not delay
  the local acknowledgment of a new press.
- Up to **eight** pending events persist in Preferences/NVS as a single blob.
  Each event has one random UUID, reused for every retry and after reboot. A full
  queue refuses new requests with the failure pattern; it never overwrites old ones.
- Retry delays grow from 2 seconds to 60 seconds plus jitter. Network errors,
  408/425/429, 5xx and missing receipts retry. Other 4xx pause delivery until you
  fix the configuration and restart. Queued events stay stored.
- One accepted new request per device per 10 seconds, at most 60 per circle per
  hour. Exact duplicates return the original receipt even during cooldown.
  Rapid separate presses can wait in the local queue behind rate limiting.
- An optional device-clock timestamp is captured at the press. Offline presses
  without valid time keep `occurredAt:null`; the UI labels server receive time
  honestly. Server receive time is always stored.
- Idle authenticated heartbeats run about once a minute. The dashboard shows
  last contact, not a promise that an old heartbeat proves the device is online now.
- Replace a credential from the dashboard, update `config.h`, and reflash. Rotation
  preserves the device ID and pending events. Revoke disables delivery immediately.
  Register a new device for reassignment to another family. If an NVS queue belongs
  to a different device ID, firmware disables delivery rather than misroute it.
- Deliberately erase flash/NVS only if you intend to discard undelivered events.
  A power loss before a new event finishes saving can lose that new press. Flash
  wear, brown-outs, queue corruption and real network outages need physical testing.

## Backend and dashboard

The feature uses the existing **Next.js / Vercel + Tiger Data Postgres + Auth0**
stack. It adds no Supabase service and no cloud AI calls. Migration
`web/db/migrations/013_hardware_alerts.sql` extends the existing `devices`, `alerts`
and `circles` tables and adds per-member `alert_recipients`. It does not depend on
pending migrations 011/012. Apply it with `cd web; npm run db:migrate` before deploy.

The request, idempotency record, device timestamps and member notifications commit
in one transaction. A token is 256 random bits; only its SHA-256 is stored. Tokens
start with `cwh_`, so existing phone/payment authentication (`cwd_`) rejects them.
The token and UUID must identify the same active ESP32. Device-supplied circle IDs,
purchase amounts and unknown fields are rejected. Hardware requests never move money.

| Endpoint | Authentication | Purpose |
| --- | --- | --- |
| `POST /api/device/alert` | `Authorization: Bearer cwh_…` | Assistance event; 201 new, 200 exact replay, 401 invalid/revoked, 409 conflicting event, 429 wait/retry |
| `POST /api/device/heartbeat` | Same hardware credential | `{deviceId}`; updates last contact, no assistance request |
| `GET /api/dashboard/hardware?circleId=UUID` | Auth0 dashboard session | Circle-scoped requests, devices, contact and management permission |

The alert payload is `{deviceId,eventId,event:"purchase_review_requested",occurredAt:null}`.
`occurredAt` may instead be UTC ISO-8601. Response includes `accepted`, `duplicate`,
`requestId`, `eventId`, `delivery:"in_app"`; `X-CheckWith-Accepted` echoes the exact
event UUID. A 429 includes `Retry-After: 60`.

Dashboard registration, credential replacement/revocation, contact updates and
resolution use authenticated Next server actions with the framework's same-origin
protection and server-side membership checks. Polling runs every five seconds
while visible, without overlapping requests; failures back off to 30 seconds.
Resolving a request updates it for the whole circle. The original family alerts
API also includes the new event kind. Open requests appear ahead of resolved ones.

There is no existing general SMS/email/APNs notification service to connect here.
The durable per-member records and dashboard are the first delivery channel.
Auth0 Guardian is used for payment approval, not as a generic help notification.
External delivery would require a provider, verified opt-in destinations and an
outbox worker with provider receipts/retries. Do not label this feature “push delivered.”
We do not attach unrelated pending purchases to a button press: no reliable
purchase-to-press correlation exists.

## Testing and demo checklist

The **ESP32 firmware** GitHub Actions workflow compiles the empty example for
`esp32:esp32:esp32` with Arduino CLI 1.5.1 / Arduino-ESP32 3.3.12 and runs the native
debounce assertions. It has no device credentials and does not exercise hardware.

1. Run `npm run typecheck`, `npm test`, `npm run test:db`, `npm run build` from `web/`.
   Database tests create/delete synthetic circles and test real SQL with no sponsor
   bank or Auth0 calls. Firmware debounce host test:
   `g++ -std=c++11 tests/button_state_test.cpp -o button-test` then run it.
2. Register a temporary synthetic button. In your shell, set `CW_DEVICE_ID` and
   `CW_HARDWARE_TOKEN` privately; optionally set `CW_BASE_URL` to an HTTPS preview.
   Run `node web/scripts/check-hardware.mjs`. It sends one event twice and requires
   the same receipt both times. It prints the event ID for recovery; on an uncertain
   failure reuse it as `CW_EVENT_ID` (the script uses `occurredAt:null`). Never paste
   your credential into source, screenshots, shell transcripts or a PR.
3. Open the linked circle's dashboard in two family sessions. Within five seconds,
   each should see **Purchase Review Requested**, name, time, button name and status.
   Check a different family's session cannot fetch it. Call opens the configured
   phone link. Resolve in one session; the other should update automatically.
4. On a **physical ESP32**, press once: local beep immediately, then acceptance
   pattern once the server acknowledges. Confirm exactly one new request. Hold
   the button for ten seconds: no repeated events. Release and press again.
5. Turn off Wi-Fi, press, hear local confirmation, then the pending warning. Restore
   Wi-Fi and confirm one event is delivered. Repeat with a reboot while queued.
   Test token rotation/revocation, a full queue, and loss of server response.
6. Revoke the temporary test device and remove temporary environment variables.

**Physical tests require your board and wiring. Compilation and HTTP/database
tests do not prove that the piezo, power supply, Wi-Fi or flash recovery work on
your actual hardware.** Do not claim they passed until performed.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| No local beep | Passive vs active buzzer; GPIO18/resistor/GND; LEDC error; actual device current rating; USB power |
| Press never registers | GPIO27, INPUT_PULLUP, opposite tactile-switch terminal pairs; release button after boot |
| Local beep only | Wi-Fi/internet/NTP, TLS trust chain, config token; Serial Monitor; server not yet accepted |
| TLS connection fails | Real clock, root CA and hostname; no captive portal; never disable verification |
| 401 / delivery paused | Correct device UUID and current `cwh_` token; revoked device; reflash then restart |
| 404 | Deploy this branch; use exact `/api/device/alert` path and correct origin |
| 429 | Preserve the event UUID; let the bounded retry run; don't repeatedly press |
| Dashboard empty | Correct Auth0 account and circle, server receipt, migration applied, polling error/session expiry |
| No call button | Add an international-format contact number in setup |
| Upload fails | Data-capable USB cable, selected COM port, driver, BOOT/EN sequence, stable power |

For production: edge/WAF rate limits before database access, audit/device ownership
policies, secure provisioning, encrypted flash/secure boot, firmware updates,
certificate rotation, monitoring and external delivery receipts remain necessary.

## Sources and credits

- [Arduino-ESP32 3.3.12](https://github.com/espressif/arduino-esp32/tree/3.3.12)
  (LGPL-2.1; bundled components retain their licenses), including WiFi/HTTP/Preferences.
- [LEDC API](https://docs.espressif.com/projects/arduino-esp32/en/latest/api/ledc.html).
- [ESP32-WROOM electrical characteristics](https://documentation.espressif.com/esp32-wroom-32_datasheet_en.html).
- [ISRG public root certificate](https://letsencrypt.org/certs/isrgrootx1.pem).
- AI tools used: Codex for implementation and tests. No physical-board test claimed.
