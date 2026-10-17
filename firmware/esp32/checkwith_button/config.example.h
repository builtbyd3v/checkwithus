#pragma once
#include "trust_anchor.h"
// Copy to config.h (gitignored). These empty values are intentionally unusable.
static const char WIFI_SSID[] = "";
static const char WIFI_PASSWORD[] = "";
// UUID and cwh_ credential shown ONCE by Dashboard > Button setup.
static const char DEVICE_ID[] = "";
static const char DEVICE_TOKEN[] = "";
static const char BACKEND_ORIGIN[] = "https://checkwith.us";
static constexpr bool DELIVERY_SOUNDS = true;
// TRUST_ANCHOR below is a public CA certificate, never a private key.
