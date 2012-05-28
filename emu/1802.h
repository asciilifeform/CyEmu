#ifndef _1802_h_
#define _1802_h_

#include <stdlib.h>
#include <stdio.h>
#include <stdint.h>


typedef struct _io {
  unsigned int EF1 : 1;
  unsigned int EF2 : 1;
  unsigned int EF3 : 1;
  unsigned int EF4 : 1;
} cpu_io;


typedef struct _cpu_regs {
  /* Data Register (Accumulator) */
  uint8_t D;

  /* Data Flag (ALU Carry) */
  unsigned int DF : 1;
  //uint8_t DF;

  /* Auxiliary Holding Register */
  uint8_t B;

  /* 1..16 Scratchpad Registers */
  uint16_t R[16];

  /* Designates which register is Program Counter */
  unsigned int P : 4;
  //uint8_t P;

  /* Designates which register is Data Pointer */
  unsigned int X : 4;
  //uint8_t X;

  /* Holds Low-Order Instruction Digit */
  unsigned int N : 4;
  //uint8_t N;

  /* Holds High-Order Instruction Digit */
  unsigned int I : 4;
  //uint8_t I;

  /* Holds old X, P after Interrupt (X is high nibble) */
  uint8_t T;

  /* Interrupt Enable */
  unsigned int IE : 1;
  //uint8_t IE;

  /* Output Flip-Flop */
  unsigned int Q : 1;
  //uint8_t Q;
} cpu_regs;


void cpu_reset();
void cpu_cycle();
void ram_init();
void ram_free();
void load_rom(char *filename);

#endif
