#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include <esp_system.h>
#include <esp_arduino_version.h>
#include <time.h>
#include <atomic>
#include "button_state.h"
#if __has_include("config.h")
#include "config.h"
#else
#include "config.example.h"
#endif
#if ESP_ARDUINO_VERSION_MAJOR < 3
#error "Install Arduino-ESP32 core 3.x; this sketch uses the pin-based LEDC API."
#endif
#if !defined(CONFIG_IDF_TARGET_ESP32)
#error "This wiring targets classic ESP32/WROOM. Review pins before porting to C3/S3."
#endif

constexpr uint8_t BUTTON_PIN = 27, BUZZER_PIN = 18, QUEUE_CAPACITY = 8;
struct Event { char id[37]; char occurredAt[25]; };
struct PendingQueue { uint32_t version = 1; uint32_t count = 0; Event events[QUEUE_CAPACITY] = {}; };
enum class Sound : uint8_t { Local, Accepted, Failed };
struct SendResult { int status; bool accepted; uint32_t retryMs; };
SendResult post(const char *path, const String &body, const char *eventId=nullptr);
Preferences preferences;
PendingQueue pending;
SemaphoreHandle_t queueMutex;
QueueHandle_t soundQueue;
ButtonState button;
std::atomic<bool> storageReady{false};
bool buzzerReady = false;
bool toneOn = false;
uint8_t pulsesLeft = 0;
uint16_t toneHz = 2000, toneMs = 90;
uint32_t toneChanged = 0;

bool validUuid(const char *value) {
  if (strlen(value) != 36) return false;
  for (int i=0; i<36; ++i) {
    if (i==8 || i==13 || i==18 || i==23) { if(value[i]!='-') return false; }
    else if (!((value[i]>='0' && value[i]<='9') || (value[i]>='a' && value[i]<='f'))) return false;
  }
  return true;
}
bool configured() {
  return strlen(WIFI_SSID)>0 && validUuid(DEVICE_ID) && strlen(DEVICE_TOKEN)==47
    && strncmp(DEVICE_TOKEN,"cwh_",4)==0 && strncmp(BACKEND_ORIGIN,"https://",8)==0;
}
void sound(Sound value) {
  if (value == Sound::Local || DELIVERY_SOUNDS) xQueueSend(soundQueue, &value, 0);
}
void startSound(Sound value) {
  if (!buzzerReady) return;
  pulsesLeft = value==Sound::Local ? 1 : value==Sound::Accepted ? 2 : 3;
  toneHz = value==Sound::Local ? 2000 : value==Sound::Accepted ? 2600 : 700;
  toneMs = value==Sound::Local ? 90 : value==Sound::Accepted ? 70 : 140;
  toneOn = true; toneChanged = millis();
  ledcWriteTone(BUZZER_PIN, toneHz);
}
void tickSound() {
  if (!pulsesLeft) {
    Sound next;
    if (xQueueReceive(soundQueue, &next, 0)==pdTRUE) startSound(next);
    return;
  }
  if (uint32_t(millis()-toneChanged) < (toneOn ? toneMs : 100)) return;
  toneChanged = millis();
  if (toneOn) { ledcWriteTone(BUZZER_PIN, 0); toneOn=false; --pulsesLeft; }
  else { ledcWriteTone(BUZZER_PIN, toneHz); toneOn=true; }
}
bool saveQueue() { return preferences.putBytes("queue", &pending, sizeof(pending)) == sizeof(pending); }
bool headEvent(Event &event) {
  xSemaphoreTake(queueMutex, portMAX_DELAY);
  const bool exists = pending.count>0;
  if (exists) event=pending.events[0];
  xSemaphoreGive(queueMutex);
  return exists;
}
void newUuid(char *out) {
  uint8_t b[16]; esp_fill_random(b, sizeof(b));
  b[6]=(b[6]&0x0f)|0x40; b[8]=(b[8]&0x3f)|0x80;
  snprintf(out,37,"%02x%02x%02x%02x-%02x%02x-%02x%02x-%02x%02x-%02x%02x%02x%02x%02x%02x",
    b[0],b[1],b[2],b[3],b[4],b[5],b[6],b[7],b[8],b[9],b[10],b[11],b[12],b[13],b[14],b[15]);
}
void enqueuePress() {
  // Called only from loop. Beep BEFORE flash storage, Wi-Fi or HTTP work.
  startSound(Sound::Local);
  if (!storageReady || !configured()) { Serial.println("Press detected; NOT queued. Check configuration/storage."); sound(Sound::Failed); return; }
  Event event = {}; newUuid(event.id);
  time_t now=time(nullptr);
  if (now>1577836800) { struct tm utc; gmtime_r(&now,&utc); strftime(event.occurredAt,sizeof(event.occurredAt),"%Y-%m-%dT%H:%M:%SZ",&utc); }
  xSemaphoreTake(queueMutex, portMAX_DELAY);
  bool saved=false;
  if (pending.count < QUEUE_CAPACITY) {
    pending.events[pending.count++]=event;
    saved=saveQueue();
    if (!saved) --pending.count;
  }
  xSemaphoreGive(queueMutex);
  if (saved) Serial.printf("Press queued: %s. Local beep is NOT delivery confirmation.\n",event.id);
  else { Serial.println("NOT queued: storage failed or eight requests already pending. Ask family another way."); sound(Sound::Failed); }
}

SendResult post(const char *path, const String &body, const char *eventId) {
  WiFiClientSecure tls;
  tls.setCACert(TRUST_ANCHOR); // certificate AND hostname verification stay enabled
  tls.setHandshakeTimeout(5);
  HTTPClient http;
  http.setConnectTimeout(5000); http.setTimeout(5000);
  http.setFollowRedirects(HTTPC_DISABLE_FOLLOW_REDIRECTS); // never forward credential to another host
  if (!http.begin(tls,String(BACKEND_ORIGIN)+path)) return {-1,false,0};
  const char *headers[]={"X-CheckWith-Accepted","Retry-After"};
  http.collectHeaders(headers,2);
  http.addHeader("Content-Type","application/json");
  http.addHeader("Authorization",String("Bearer ")+DEVICE_TOKEN);
  const int status=http.POST(body);
  // Require the exact event receipt, not merely 200 (which could be an HTML page).
  const bool accepted=(status==200 || status==201) && (!eventId || http.header("X-CheckWith-Accepted")==eventId);
  const long seconds=http.header("Retry-After").toInt();
  const uint32_t retryMs=seconds>0 ? uint32_t(min(seconds,60L))*1000 : 0;
  http.end();
  return {status,accepted,retryMs};
}
void networkWorker(void *) {
  uint32_t reconnectAt=0, nextAttempt=0, nextHeartbeat=0, lastWarning=0;
  uint8_t failures=0;
  bool paused=false, hadEvent=false;
  for (;;) {
    const uint32_t now=millis();
    Event event={}; const bool hasEvent=headEvent(event);
    if (hasEvent && !hadEvent) lastWarning=now;
    hadEvent=hasEvent;
    if (hasEvent && uint32_t(now-lastWarning)>=60000) {
      sound(Sound::Failed); lastWarning=now;
      Serial.println("Request still pending; no server receipt yet. Contact family another way if urgent.");
    }
    if (!configured() || !storageReady || paused) { vTaskDelay(pdMS_TO_TICKS(1000)); continue; }
    if (WiFi.status()!=WL_CONNECTED) {
      if (int32_t(now-reconnectAt)>=0) { Serial.println("Wi-Fi unavailable; reconnecting (requests stay queued)."); WiFi.reconnect(); reconnectAt=now+15000; }
      vTaskDelay(pdMS_TO_TICKS(250)); continue;
    }
    // SNTP provides certificate-validity time. Never bypass TLS to fix a clock.
    if (time(nullptr)<1577836800) { vTaskDelay(pdMS_TO_TICKS(500)); continue; }
    if (hasEvent && int32_t(now-nextAttempt)>=0) {
      String body=String("{\"deviceId\":\"")+DEVICE_ID+"\",\"eventId\":\""+event.id+"\",\"event\":\"purchase_review_requested\",\"occurredAt\":";
      body += event.occurredAt[0] ? String("\"")+event.occurredAt+"\"}" : "null}";
      const SendResult result=post("/api/device/alert",body,event.id);
      Serial.printf("Event %s: HTTP %d\n",event.id,result.status); // never print token, SSID/password, or response body
      if (result.accepted) {
        xSemaphoreTake(queueMutex,portMAX_DELAY);
        PendingQueue before=pending;
        for(uint32_t i=1;i<pending.count;++i) pending.events[i-1]=pending.events[i];
        --pending.count;
        const bool saved=saveQueue();
        if (!saved) pending=before; // retry same accepted event safely if flash write failed
        xSemaphoreGive(queueMutex);
        if (saved) { sound(Sound::Accepted); Serial.println("Server accepted: saved in family dashboard. This is NOT confirmation a person saw it."); }
        failures=0; nextAttempt=millis()+1000; lastWarning=millis();
      } else if (result.status>=400 && result.status<500 && result.status!=408 && result.status!=425 && result.status!=429) {
        paused=true; sound(Sound::Failed);
        Serial.println("Delivery paused: check device ID/token/request. Fix config and restart. Pending events retained.");
      } else {
        failures=min(uint8_t(failures+1),uint8_t(6));
        uint32_t backoff=min(uint32_t(1000)<<failures,uint32_t(60000));
        nextAttempt=millis()+max(backoff,result.retryMs)+(esp_random()%500);
        sound(Sound::Failed); lastWarning=millis();
      }
    } else if (!hasEvent && int32_t(now-nextHeartbeat)>=0) {
      const SendResult result=post("/api/device/heartbeat",String("{\"deviceId\":\"")+DEVICE_ID+"\"}");
      Serial.printf("Heartbeat HTTP %d\n",result.status);
      nextHeartbeat=millis()+60000;
    }
    vTaskDelay(pdMS_TO_TICKS(50));
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(BUTTON_PIN,INPUT_PULLUP);
  button.begin(digitalRead(BUTTON_PIN)==HIGH,millis());
  buzzerReady=ledcAttach(BUZZER_PIN,2000,8);
  if (!buzzerReady) Serial.println("LEDC attach failed: check board/pin support.");
  else ledcWriteTone(BUZZER_PIN,0);
  queueMutex=xSemaphoreCreateMutex(); soundQueue=xQueueCreate(8,sizeof(Sound));
  if (!queueMutex || !soundQueue) { Serial.println("Fatal: queue allocation failed."); while(true) delay(1000); }
  if (preferences.begin("cw-button",false)) {
    bool valid=true;
    const size_t size=preferences.getBytesLength("queue");
    if (size) {
      valid=size==sizeof(pending) && preferences.getBytes("queue",&pending,sizeof(pending))==sizeof(pending)
        && pending.version==1 && pending.count<=QUEUE_CAPACITY;
      if (valid) for(uint32_t i=0;i<pending.count;++i) {
        pending.events[i].id[36]='\0'; pending.events[i].occurredAt[24]='\0';
        if (!validUuid(pending.events[i].id)) valid=false;
      }
    }
    const String previousDevice=preferences.getString("device","");
    if (previousDevice!=DEVICE_ID && pending.count) valid=false;
    if (valid && configured()) {
      valid=preferences.putString("device",DEVICE_ID)>0;
      storageReady=valid;
    }
    if (!valid) { pending.count=0; Serial.println("Stored queue invalid or belongs to another device. Restore matching config or explicitly erase NVS; delivery disabled."); }
  }
  if (!configured()) Serial.println("Configure config.h before use. No requests will be sent with the empty example.");
  WiFi.mode(WIFI_STA); WiFi.setAutoReconnect(true);
  if (configured()) WiFi.begin(WIFI_SSID,WIFI_PASSWORD);
  configTime(0,0,"pool.ntp.org","time.google.com");
  if (xTaskCreate(networkWorker,"https-sender",12288,nullptr,1,nullptr)!=pdPASS) {
    storageReady=false; Serial.println("Network worker could not start; delivery disabled.");
  }
  Serial.println("Ready: GPIO27 button to GND; GPIO18 passive piezo. Hold does not repeat.");
}
void loop() {
  if (button.update(digitalRead(BUTTON_PIN)==HIGH,millis())) enqueuePress();
  tickSound();
  delay(2);
}
