#include "../checkwith_button/button_state.h"
#include <assert.h>
#include <stdio.h>
int main() {
  ButtonState b; b.begin(true,0);
  assert(!b.update(false,1)); assert(!b.update(true,10)); assert(!b.update(false,20));
  assert(!b.update(false,69)); assert(b.update(false,70));
  for(uint32_t t=71;t<10000;++t) assert(!b.update(false,t));
  assert(!b.update(true,10000)); assert(!b.update(true,10050));
  assert(!b.update(false,10100)); assert(b.update(false,10150));
  b.begin(false,0); assert(!b.update(false,1000)); // boot while held is not a press
  b.begin(true,UINT32_MAX-30); assert(!b.update(false,UINT32_MAX-20));
  assert(!b.update(false,10)); assert(b.update(false,30)); // millis rollover
  puts("Button debounce, held press, release/repress, boot-held and rollover passed.");
}
