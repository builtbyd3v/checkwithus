#pragma once
#include <stdint.h>
// No Arduino dependency: exercised by the host test, including millis rollover.
class ButtonState {
  bool raw_ = true, stable_ = true;
  uint32_t changed_ = 0;
public:
  void begin(bool high, uint32_t now) { raw_ = stable_ = high; changed_ = now; }
  bool update(bool high, uint32_t now) {
    if (high != raw_) { raw_ = high; changed_ = now; }
    if (raw_ != stable_ && uint32_t(now - changed_) >= 50) {
      stable_ = raw_;
      return !stable_; // only the stable falling edge, never a held button
    }
    return false;
  }
};
