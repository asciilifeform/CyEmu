#include "mwemu.h"
#include "1802.h"

int main(int argc, char **argv) {
  int i;

  ram_init();
  cpu_reset();
  load_rom("microwriter.rom");
  
  for (i = 0; i < 1000; i++) {
    cpu_cycle();
  }

  printf("Done.\n");
  ram_free();

  return 0;
}
