#include <stdlib.h>
#include <stdio.h>
#include <sys/io.h>
#include <unistd.h>
#include <fcntl.h>
#include <linux/parport.h>
#include <linux/ppdev.h>
#include <sys/ioctl.h>
#include <sys/stat.h>
#include <sys/types.h>

/* 
   Wiring:
   -------

   PC Parallel Port:
   -----------------
   STROBE ---------- nWR of 82C55A
   AUTOFEED -------- nRD of 82C55A
   SELECTIN -------- A1 of 82C55A
   nINIT ----------- A0 of 82C55A
 */

/* Size of ROM */
#define ROM_SIZE        8192

/* PC parallel port address */
#define port_base       0x0378
#define port_control    (port_base + 2)

/* Control register bits */
#define STROBE		0x01
#define AUTOFEED	0x02
#define nINIT		0x04 /* non-inverted */
#define SELECTIN	0x08
#define PCD		0x20

/* Chip pin assignments */
#define nWR_disable     ctrport &= ~STROBE; ioctl(PortFD, PPWCONTROL, &ctrport)
#define nWR_enable      ctrport |= STROBE; ioctl(PortFD, PPWCONTROL, &ctrport)
#define nRD_disable     ctrport &= ~AUTOFEED; ioctl(PortFD, PPWCONTROL, &ctrport)
#define nRD_enable      ctrport |= AUTOFEED; ioctl(PortFD, PPWCONTROL, &ctrport)
#define A1_high         ctrport &= ~SELECTIN; ioctl(PortFD, PPWCONTROL, &ctrport)
#define A1_low          ctrport |= SELECTIN; ioctl(PortFD, PPWCONTROL, &ctrport)
#define A0_low          ctrport &= ~nINIT; ioctl(PortFD, PPWCONTROL, &ctrport) // non-inverted
#define A0_high         ctrport |= nINIT; ioctl(PortFD, PPWCONTROL, &ctrport)

/* Parallel port direction control */
#define port_write      datadir = 0; ioctl(PortFD, PPDATADIR, &datadir)
#define port_read       datadir = 1; ioctl(PortFD, PPDATADIR, &datadir)

/* Data byte out/in */
#define port_out(byte)  byte_out = byte; ioctl(PortFD, PPWDATA, &byte_out)
#define port_in         ioctl(PortFD, PPRDATA, &byte_in)


/* 8255: Port A = input, Port B, C = output */
/*                        76543210 */
#define IO8255_CONFIG   0b10010000


/* Address of parallel port control register */
unsigned char byte_out, byte_in;
unsigned char ctrport;
int datadir;
int PortFD;


/* Initialize parallel port */
void init_port() {
  PortFD = open("/dev/parport0", O_RDWR);
  ioctl(PortFD, PPCLAIM);
}


/* Set initial port state */
void init_state() {
  /* No read or write */
  nRD_disable;
  nWR_disable;
  /* Select CONTROL register of 8255 */
  A0_high;
  A1_high;
  /* Write control register contents */
  port_write;
  port_out(IO8255_CONFIG);
  /* Strobe write signal */
  nWR_enable;
  nWR_disable;
}


void write_portB(unsigned char byte) {
  /* No read or write */
  nRD_disable;
  nWR_disable;
  /* Select "B" register of 8255 */
  A0_high;
  A1_low;
  /* Write control register contents */
  port_write;
  port_out(byte);
  /* Strobe write signal */
  nWR_enable;
  nWR_disable;
}


void write_portC(unsigned char byte) {
  /* No read or write */
  nRD_disable;
  nWR_disable;
  /* Select "C" register of 8255 */
  A0_low;
  A1_high;
  /* Write control register contents */
  port_write;
  port_out(byte);
  /* Strobe write signal */
  nWR_enable;
  nWR_disable;
}


/* Latch an address */
void set_addr(unsigned long addr) {
  write_portB(addr & 0xFF);
  write_portC((addr >> 8) & 0xFF);
}


/* Read byte at current ROM address */
unsigned char read_byte() {
  unsigned char byte;
  /* No read or write */
  nRD_disable;
  nWR_disable;
  /* Select "A" register of 8255 */
  A0_low;
  A1_low;
  /* Write control register contents */
  port_read;
  /* Strobe write signal */
  nRD_enable;
  port_in;
  byte = byte_in;
  nRD_disable;
  return byte;
}



void readROM(char *filename) {
  unsigned long addr;
  unsigned char byte;

  FILE *ROMFile;
  ROMFile = fopen(filename, "w");

  for (addr = 0; addr < ROM_SIZE; addr++) {
    set_addr(addr);
    usleep(200);
    byte = read_byte();
    fputc(byte, ROMFile);
  }

  fclose(ROMFile);
}


int main(int argc, char **argv) {
  init_port();
  init_state();
  readROM("microwriter.rom");
  return 0;
}
