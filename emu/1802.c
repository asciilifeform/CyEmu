#include "mwemu.h"
#include "1802.h"

uint8_t *mem; /* RAM */

//uint16_t addr; /* Address Bus */
uint8_t bus; /* Data Bus */
cpu_regs r; /* CPU Registers */
cpu_io io; /* CPU I/O */


/* General */

uint16_t PC() {
  return r.R[r.P];
}


void setPC(uint16_t data) {
  r.R[r.P] = data;
}


void incPC() {
  r.R[r.P]++;
}


void memPcIn(uint8_t data) {
  mem[PC()] = data;
}


uint8_t memPcOut() {
  return mem[PC()];
}


void memXregIn(uint8_t data) {
  mem[(r.R[r.X])] = data;
}


uint8_t memXregOut() {
  return mem[(r.R[r.X])];
}


/* Register Ops */

/* INC r   Increment Register                      1r */
void inc(uint8_t k) {
  printf("\tINC %x\n", k);
  r.R[k]++;
}

/* DEC r   Decrement Register                      2r */
void dec(uint8_t k) {
  printf("\tDEC %x\n", k);
  r.R[k]--;
}

/* IRX     Increment R(X)                          60 */
void irx() {
  printf("\tIRX\n");
  r.R[r.X]++;
}

/* GLO r   Get Low byte of Register                8r */
void glo(uint8_t k) {
  printf("\tGLO %x\n", k);
  r.D = r.R[k] & 0xFF;
}

/* GHI r   Get High byte of Register               9r */
void ghi(uint8_t k) {
  printf("\tGHI %x\n", k);
  r.D = (r.R[k] & 0xFF00) >> 8;
}

/* PLO r   Put D in Low byte of register           Ar */
void plo(uint8_t k) {
  printf("\tPLO %x\n", k);
  r.R[k] &= 0xFF00;
  r.R[k] |= r.D;
}

/* PHI r   Put D in High byte of register          Br */
void phi(uint8_t k) {
  printf("\tPHI %x\n", k);
  r.R[k] = (r.D * 256) | (r.R[k] & 0x00FF);
}


/* Memory References */

/* LDN r   Load D via N (for r = 1 to F)           0r */
void ldn(uint8_t k) {
  printf("\tLDN %x\n", k);
  r.D = mem[r.R[k]];
}

/* LDA r   Load D and Advance                      4r */
void lda(uint8_t k) {
  printf("\tLDA %x\n", k);
  r.D = mem[r.R[k]];
  r.R[k]++;
}

/* LDX     Load D via R(X)                         F0 */
void ldx() {
  printf("\tLDX\n");
  r.D = memXregOut();
}

/* LDXA    Load D via R(X) and Advance             72 */
void ldxa() {
  printf("\tLDXA\n");
  r.D = memXregOut();
  r.R[r.X]++;
}

/* LDI b   Load D Immediate                        F8 bb */
void ldi() {
  r.D = memPcOut();
  printf("\tLDI %x\n", r.D);
  incPC();
}

/* STR r   Store D into memory                     5r */
void str(uint8_t k) {
  printf("\tSTR %x\n", k);
  mem[r.R[k]] = r.D;
}

/* STXD    Store D via R(X) and Decrement          73 */
void stxd() {
  printf("\tSTXD\n");
  memXregIn(r.D);
  r.R[r.X]--;
}


/* Logic Ops */

/* OR      Logical OR                              F1 */
void _or() {
  printf("\tOR\n");
  r.D |= memXregOut();
}

/* ORI b   OR Immediate                            F9 bb */
void ori() {
  printf("\tORI\n");
  r.D |= memXregOut();
  incPC();
}

/* XOR     Exclusive OR                            F3 */
void _xor() {
  printf("\tXOR\n");
  r.D ^= memXregOut();
}

/* XRI b   Exclusive OR, Immediate                 FB bb */
void xri() {
  printf("\tXRI\n");
  r.D ^= memXregOut();
  incPC();
}

/* AND     Logical AND                             F2 */
void _and() {
  printf("\tAND\n");
  r.D &= memXregOut();
}

/* ANI b   AND Immediate                           FA bb */
void ani() {
  printf("\tANI\n");
  r.D &= memXregOut();
  incPC();
}

/* SHR     Shift D Right                           F6 */
void shr() {
  printf("\tSHR\n");
  if (r.D & 1) {
    r.DF = 1;
  } else {
    r.DF = 0;
  }
  r.D = r.D >> 1;
  r.D &= 0x7F;
}

/* SHRC    Shift D Right with Carry                76 */
void rshr() {
  printf("\tRSHR\n");
  int f = r.DF;
  if (r.D & 1) {
    r.DF = 1;
  } else {
    r.DF = 0;
  }
  r.D = r.D >> 1;
  r.D &= 0x7F;
  if (f) r.D |= 0x80;
}

/* SHL     Shift D Left                            FE */
void shl() {
  printf("\tSHL\n");
  if (r.D & 0x80) {
    r.DF = 1;
  } else {
    r.DF = 0;
  }
  r.D = r.D << 1;
  r.D &= 0xFE;
}

/* SHLC    Shift D Left with Carry                 7E */
void rshl() {
  printf("\tRSHL\n");
  int f = r.DF;
  if (r.D & 0x80) {
    r.DF = 1;
  } else {
    r.DF = 0;
  }
  r.D = r.D << 1;
  r.D &= 0xFE;
  if (f) r.D |= 1;
}


/* Arithmetic Ops */

/* ADD     Add                                     F4 */
void add() {
  printf("\tADD\n");
  uint16_t tD = r.D;
  tD += memXregOut();
  if (tD > 0xFF) {
    r.DF = 1;
  } else {
    r.DF = 0;
  }
  r.D = tD & 0xFF;
}

/* ADI b   Add Immediate                           FC bb */
void adi() {
  printf("\tADI\n");
  uint16_t tD = r.D;
  tD += memPcOut();
  if (tD > 0xFF) {
    r.DF = 1;
  } else {
    r.DF = 0;
  }
  r.D = tD & 0xFF;
  incPC();
}

/* ADC     Add with Carry                          74 */
void adc() {
  printf("\tADC\n");
  uint16_t tD = r.D;
  tD += memXregOut();
  tD += r.DF;
  if (tD > 0xFF) {
    r.DF = 1;
  } else {
    r.DF = 0;
  }
  r.D = tD & 0xFF;
}

/* ADCI b  Add with Carry Immediate                7C bb */
void adci() {
  printf("\tADCI\n");
  uint16_t tD = r.D;
  tD += memPcOut();
  tD += r.DF;
  if (tD > 0xFF) {
    r.DF = 1;
  } else {
    r.DF = 0;
  }
  r.D = tD & 0xFF;
  incPC();
}

/* SD      Subtract D from memory                  F5 */
void sd() {
  printf("\tSD\n");
  uint16_t tD;
  tD = memXregOut() + 0xFF - r.D + 1;
  if (tD > 0xFF) {
    r.DF = 1;
  } else {
    r.DF = 0;
  }
  r.D = tD & 0xFF;
}

/* SDI b   Subtract D from memory Immediate byte   FD bb */
void sdi() {
  printf("\tSDI\n");
  uint16_t tD;
  tD = memPcOut() + 0xFF - r.D + 1;
  if (tD > 0xFF) {
    r.DF = 1;
  } else {
    r.DF = 0;
  }
  r.D = tD & 0xFF;
  incPC();
}

/* SDB     Subtract D from memory with Borrow      75 */
void sdb() {
  printf("\tSDB\n");
  uint16_t tD;
  tD = memXregOut() + 0xFF - r.D;
  tD += (0xFF - memXregOut());
  if (r.DF) tD++;
  if (tD > 0xFF) {
    r.DF = 1;
  } else {
    r.DF = 0;
  }
  r.D = tD & 0xFF;
}

/* SDBI b  Subtract D with Borrow, Immediate       7D bb */
void sdbi() {
  printf("\tSDBI\n");
  uint16_t tD;
  tD = memPcOut() + 0xFF - r.D;
  if (r.DF) tD++;
  if (tD > 0xFF) {
    r.DF = 1;
  } else {
    r.DF = 0;
  }
  r.D = tD & 0xFF;
  incPC();
}

/* SM      Subtract Memory from D                  F7 */
void sm() {
  printf("\tSM\n");
  uint16_t tD;
  tD = r.D + 0xFF - memXregOut() + 1;
  if (tD > 0xFF) {
    r.DF = 1;
  } else {
    r.DF = 0;
  }
  r.D = tD & 0xFF;
}

/* SMI b   Subtract Memory from D, Immediate       FF bb */
void smi() {
  printf("\tSMI\n");
  uint16_t tD;
  tD = r.D + 0xFF - memPcOut() + 1;
  if (tD > 0xFF) {
    r.DF = 1;
  } else {
    r.DF = 0;
  }
  r.D = tD & 0xFF;
  incPC();
}

/* SMB     Subtract Memory from D with Borrow      77 */
void smb() {
  printf("\tSMB\n");
  uint16_t tD;
  tD = r.D + 0xFF - memXregOut();
  if (r.DF) tD++;
  if (tD > 0xFF) {
    r.DF = 1;
  } else {
    r.DF = 0;
  }
  r.D = tD & 0xFF;
}

/* SMBI b  Subtract Memory with Borrow, Immediate  7F bb */
void smbi() {
  printf("\tSMBI\n");
  uint16_t tD;
  tD = r.D + 0xFF - memPcOut();
  if (r.DF) tD++;
  if (tD > 0xFF) {
    r.DF = 1;
  } else {
    r.DF = 0;
  }
  r.D = tD & 0xFF;
  incPC();
}


/* Branching */

/* BR a    Branch unconditionally                  30 aa */
void br() {
  printf("\tBR\n");
  //addr = (PC() & 0xFF00);
  //addr = (PC() & 0xFF00) | memPcOut();
  
  //printf("PC() & 0xFF00 = %.4x\n", addr);
  //printf("memPcOut() = %.4x\n", memPcOut());
  //addr |= memPcOut();
  
  //printf("addr |= memPcOut() = %.4x\n", addr);
  
  setPC(((PC() & 0xFF00) | memPcOut()));
}

/* BZ a    Branch on Zero                          32 aa */
void bz() {
  printf("\tBZ\n");
  if (r.D == 0) {
    br();
  } else {
    incPC();
  }
}

/* BNZ a   Branch on Not Zero                      3A aa */
void bnz() {
  printf("\tBNZ\n");
  if (r.D != 0) {
    br();
  } else {
    incPC();
  }
}

/* BDF a   Branch if DF is 1                       33 aa */
void bdf() {
  printf("\tBDF\n");
  if (r.DF) {
    br();
  } else {
    incPC();
  }
}

/* BNF a   Branch if DF is 0                       3B aa */
void bnf() {
  printf("\tBNF\n");
  if (!(r.DF)) {
    br();
  } else {
    incPC();
  }
}

/* BQ a    Branch if Q is on                       31 aa */
void bq() {
  printf("\tBQ\n");
  if (r.Q) {
    br();
  } else {
    incPC();
  }
}

/* BNQ a   Branch if Q is off                      39 aa */
void bnq() {
  printf("\tBNQ\n");
  if (!(r.Q)) {
    br();
  } else {
    incPC();
  }
}

/* B1 a    Branch on External Flag 1               34 aa */
void b1() {
  printf("\tB1\n");
  if (io.EF1) {
    br();
  } else {
    incPC();
  }
}

/* BN1 a   Branch on Not External Flag 1           3C aa */
void bn1() {
  printf("\tBN1\n");
  if (!(io.EF1)) {
    br();
  } else {
    incPC();
  }
}

/* B2 a    Branch on External Flag 2               35 aa */
void b2() {
  printf("\tB2\n");
  if (io.EF2) {
    br();
  } else {
    incPC();
  }
}

/* BN2 a   Branch on Not External Flag 2           3D aa */
void bn2() {
  printf("\tBN2\n");
  if (!(io.EF2)) {
    br();
  } else {
    incPC();
  }
}

/* B3 a    Branch on External Flag 3               36 aa */
void b3() {
  printf("\tB3\n");
  if (io.EF3) {
    br();
  } else {
    incPC();
  }
}

/* BN3 a   Branch on Not External Flag 3           3E aa */
void bn3() {
  printf("\tBN3\n");
  if (!(io.EF3)) {
    br();
  } else {
    incPC();
  }
}

/* B4 a    Branch on External Flag 4               37 aa */
void b4() {
  printf("\tB4\n");
  if (io.EF4) {
    br();
  } else {
    incPC();
  }
}

/* BN4 a   Branch on Not External Flag 4           3F aa */
void bn4() {
  printf("\tBN4\n");
  if (!(io.EF4)) {
    br();
  } else {
    incPC();
  }
}

/* LBR aa  Long Branch unconditionally             C0 aaaa */
void lbr() {
  uint16_t addr;
  printf("\tLBR\n");
  addr = 256 * memPcOut();
  incPC();

  addr = addr | memPcOut();
  //printf("addr |= memPcOut() = %.4x\n", addr);
  
  setPC(addr);
}

/* LBZ aa  Long Branch if Zero                     C2 aaaa */
void lbz() {
  printf("\tLBZ\n");
  if (r.D == 0) {
    lbr();
  } else {
    incPC();
    incPC();
  }
}

/* LBNZ aa Long Branch if Not Zero                 CA aaaa */
void lbnz() {
  printf("\tLBNZ\n");
  if (r.D != 0) {
    lbr();
  } else {
    incPC();
    incPC();
  }
}

/* LBDF aa Long Branch if DF is 1                  C3 aaaa */
void lbdf() {
  printf("\tLBDF\n");
  if (r.DF) {
    lbr();
  } else {
    incPC();
    incPC();
  }
}

/* LBNF aa Long Branch if DF is 0                  CB aaaa */
void lbnf() {
  printf("\tLBNF\n");
  if (!(r.DF)) {
    lbr();
  } else {
    incPC();
    incPC();
  }
}

/* LBQ aa  Long Branch if Q is on                  C1 aaaa */
void lbq() {
  printf("\tLBQ\n");
  if (r.Q) {
    lbr();
  } else {
    incPC();
    incPC();
  }
}

/* LBNQ aa Long Branch if Q is off                 C9 aaaa */
void lbnq() {
  printf("\tLBNQ\n");
  if (!(r.Q)) {
    lbr();
  } else {
    incPC();
    incPC();
  }
}


/* Skip Instructions */

/* LSZ     Long Skip if Zero                       CE */
void lsz() {
  printf("\tLSZ\n");
  if (r.D == 0) {
    incPC();
    incPC();
  }
}

/* LSNZ    Long Skip if Not Zero                   C6 */
void lsnz() {
  printf("\tLSNZ\n");
  if (r.D != 0) {
    incPC();
    incPC();
  }
}

/* LSDF    Long Skip if DF is 1                    CF */
void lsdf() {
  printf("\tLSDF\n");
  if (r.DF) {
    incPC();
    incPC();
  }
}

/* LSNF    Long Skip if DF is 0                    C7 */
void lsnf() {
  printf("\tLSNF\n");
  if (!(r.DF)) {
    incPC();
    incPC();
  }
}

/* LSQ     Long Skip if Q is on                    CD */
void lsq() {
  printf("\tLSQ\n");
  if (r.Q) {
    incPC();
    incPC();
  }
}

/* LSNQ    Long Skip if Q is off                   C5 */
void lsnq() {
  printf("\tLSNQ\n");
  if (!(r.Q)) {
    incPC();
    incPC();
  }
}

/* LSIE    Long Skip if Interrupts Enabled         CC */
void lsie() {
  printf("\tLSIE\n");
  if (r.IE) {
    incPC();
    incPC();
  }
}


/* Control Instructions */

/* SEP r   Set P                                   Dr */
void sep(uint8_t k) {
  printf("\tSEP %x\n", k);
  r.N = k;
  r.P = r.N;
}

/* SEX r   Set X                                   Er */
void sex(uint8_t k) {
  printf("\tSEX %x\n", k);
  r.N = k;
  r.X = r.N;
}


/* Input/Output Byte Transfer */

/* OUT p   Output from memory (for p = 1 to 7)     6p */
void out(uint8_t k) {
  bus = memXregOut();
  /* TODO: Do Stuff! */
  printf("OUT[%d]: BUS=%x\n", k, bus);
  /* TODO: Do Stuff! */
  r.R[r.X]++;
}

/* INP p   Input to memory and D (for p = 9 to F)  6p */
void inp(uint8_t k) {
  memXregIn(bus);
  bus = r.D;
  /* TODO: Do Stuff! */
  printf("IN[%d]: BUS=%x\n", k, bus);
  /* TODO: Do Stuff! */
}


/* Other */

/* RET     Return                                  70 */
void ret() {
  printf("\tRET\n");
  uint8_t tD = memXregOut();
  r.R[r.X]++;
  r.P = tD & 0x0F;
  r.X = tD >> 4;
  r.IE = 1;
}

/* DIS     Return and Disable Interrupts           71 */
void dis() {
  printf("\tDIS\n");
  uint8_t tD = memXregOut();
  r.R[r.X]++;
  r.P = tD & 0x0F;
  r.X = tD >> 4;
  r.IE = 0;
}

/* SAV     Save T                                  78 */
void sav() {
  printf("\tSAV\n");
  exit(1);
}

/* MARK    Save X and P in T                       79 */
void mark() {
  printf("\tMARK\n");
  exit(1);
}


/* Op not implemented */
void badop(char *s) {
  printf("Opcode not implemented: '%s'.\n", s);
}



/* IDL     Idle                                    00  */
void i00() { printf("\tIDL\n"); incPC(); }

void i01() { incPC(); ldn(1); }
void i02() { incPC(); ldn(2); }
void i03() { incPC(); ldn(3); }
void i04() { incPC(); ldn(4); }
void i05() { incPC(); ldn(5); }
void i06() { incPC(); ldn(6); }
void i07() { incPC(); ldn(7); }
void i08() { incPC(); ldn(8); }
void i09() { incPC(); ldn(9); }
void i0a() { incPC(); ldn(10); }
void i0b() { incPC(); ldn(11); }
void i0c() { incPC(); ldn(12); }
void i0d() { incPC(); ldn(13); }
void i0e() { incPC(); ldn(14); }
void i0f() { incPC(); ldn(15); }

void i10() { incPC(); inc(0); }
void i11() { incPC(); inc(1); }
void i12() { incPC(); inc(2); }
void i13() { incPC(); inc(3); }
void i14() { incPC(); inc(4); }
void i15() { incPC(); inc(5); }
void i16() { incPC(); inc(6); }
void i17() { incPC(); inc(7); }
void i18() { incPC(); inc(8); }
void i19() { incPC(); inc(9); }
void i1a() { incPC(); inc(10); }
void i1b() { incPC(); inc(11); }
void i1c() { incPC(); inc(12); }
void i1d() { incPC(); inc(13); }
void i1e() { incPC(); inc(14); }
void i1f() { incPC(); inc(15); }

void i20() { incPC(); dec(0); }
void i21() { incPC(); dec(1); }
void i22() { incPC(); dec(2); }
void i23() { incPC(); dec(3); }
void i24() { incPC(); dec(4); }
void i25() { incPC(); dec(5); }
void i26() { incPC(); dec(6); }
void i27() { incPC(); dec(7); }
void i28() { incPC(); dec(8); }
void i29() { incPC(); dec(9); }
void i2a() { incPC(); dec(10); }
void i2b() { incPC(); dec(11); }
void i2c() { incPC(); dec(12); }
void i2d() { incPC(); dec(13); }
void i2e() { incPC(); dec(14); }
void i2f() { incPC(); dec(15); }

void i30() { incPC(); br(); }
void i31() { incPC(); bq(); }
void i32() { incPC(); bz(); }
void i33() { incPC(); bdf(); }
void i34() { incPC(); b1(); }
void i35() { incPC(); b2(); }
void i36() { incPC(); b3(); }
void i37() { incPC(); b4(); }
void i38() { incPC(); incPC(); } /* SKP     Skip one byte   38 */
void i39() { incPC(); bnq(); }
void i3a() { incPC(); bnz(); }
void i3b() { incPC(); bnf(); }
void i3c() { incPC(); bn1(); }
void i3d() { incPC(); bn2(); }
void i3e() { incPC(); bn3(); }
void i3f() { incPC(); bn4(); }

void i40() { incPC(); lda(0); }
void i41() { incPC(); lda(1); }
void i42() { incPC(); lda(2); }
void i43() { incPC(); lda(3); }
void i44() { incPC(); lda(4); }
void i45() { incPC(); lda(5); }
void i46() { incPC(); lda(6); }
void i47() { incPC(); lda(7); }
void i48() { incPC(); lda(8); }
void i49() { incPC(); lda(9); }
void i4a() { incPC(); lda(10); }
void i4b() { incPC(); lda(11); }
void i4c() { incPC(); lda(12); }
void i4d() { incPC(); lda(13); }
void i4e() { incPC(); lda(14); }
void i4f() { incPC(); lda(15); }

void i50() { incPC(); str(0); }
void i51() { incPC(); str(1); }
void i52() { incPC(); str(2); }
void i53() { incPC(); str(3); }
void i54() { incPC(); str(4); }
void i55() { incPC(); str(5); }
void i56() { incPC(); str(6); }
void i57() { incPC(); str(7); }
void i58() { incPC(); str(8); }
void i59() { incPC(); str(9); }
void i5a() { incPC(); str(10); }
void i5b() { incPC(); str(11); }
void i5c() { incPC(); str(12); }
void i5d() { incPC(); str(13); }
void i5e() { incPC(); str(14); }
void i5f() { incPC(); str(15); }

void i60() { incPC(); irx(); }
void i61() { incPC(); out(1); }
void i62() { incPC(); out(2); }
void i63() { incPC(); out(3); }
void i64() { incPC(); out(4); }
void i65() { incPC(); out(5); }
void i66() { incPC(); out(6); }
void i67() { incPC(); out(7); }
void i68() { incPC(); badop("0x68"); }
void i69() { incPC(); inp(9); }
void i6a() { incPC(); inp(10); }
void i6b() { incPC(); inp(11); }
void i6c() { incPC(); inp(12); }
void i6d() { incPC(); inp(13); }
void i6e() { incPC(); inp(14); }
void i6f() { incPC(); inp(15); }

void i70() { incPC(); ret(); }
void i71() { incPC(); dis(); }
void i72() { incPC(); ldxa(); }
void i73() { incPC(); stxd(); }
void i74() { incPC(); adc(); }
void i75() { incPC(); sdb(); }
void i76() { incPC(); rshr(); }
void i77() { incPC(); smb(); }
void i78() { incPC(); sav(); }
void i79() { incPC(); mark(); }
void i7a() { incPC(); r.Q = 0; } /* REQ     Reset Q  7A */
void i7b() { printf("\tSEQ\n"); incPC(); r.Q = 1; } /* SEQ     Set Q   7B */
void i7c() { incPC(); adci(); }
void i7d() { incPC(); sdbi(); }
void i7e() { incPC(); rshl(); }
void i7f() { incPC(); smbi(); }

void i80() { incPC(); glo(0); }
void i81() { incPC(); glo(1); }
void i82() { incPC(); glo(2); }
void i83() { incPC(); glo(3); }
void i84() { incPC(); glo(4); }
void i85() { incPC(); glo(5); }
void i86() { incPC(); glo(6); }
void i87() { incPC(); glo(7); }
void i88() { incPC(); glo(8); }
void i89() { incPC(); glo(9); }
void i8a() { incPC(); glo(10); }
void i8b() { incPC(); glo(11); }
void i8c() { incPC(); glo(12); }
void i8d() { incPC(); glo(13); }
void i8e() { incPC(); glo(14); }
void i8f() { incPC(); glo(15); }

void i90() { incPC(); ghi(0); }
void i91() { incPC(); ghi(1); }
void i92() { incPC(); ghi(2); }
void i93() { incPC(); ghi(3); }
void i94() { incPC(); ghi(4); }
void i95() { incPC(); ghi(5); }
void i96() { incPC(); ghi(6); }
void i97() { incPC(); ghi(7); }
void i98() { incPC(); ghi(8); }
void i99() { incPC(); ghi(9); }
void i9a() { incPC(); ghi(10); }
void i9b() { incPC(); ghi(11); }
void i9c() { incPC(); ghi(12); }
void i9d() { incPC(); ghi(13); }
void i9e() { incPC(); ghi(14); }
void i9f() { incPC(); ghi(15); }

void ia0() { incPC(); plo(0); }
void ia1() { incPC(); plo(1); }
void ia2() { incPC(); plo(2); }
void ia3() { incPC(); plo(3); }
void ia4() { incPC(); plo(4); }
void ia5() { incPC(); plo(5); }
void ia6() { incPC(); plo(6); }
void ia7() { incPC(); plo(7); }
void ia8() { incPC(); plo(8); }
void ia9() { incPC(); plo(9); }
void iaa() { incPC(); plo(10); }
void iab() { incPC(); plo(11); }
void iac() { incPC(); plo(12); }
void iad() { incPC(); plo(13); }
void iae() { incPC(); plo(14); }
void iaf() { incPC(); plo(15); }

void ib0() { incPC(); phi(0); }
void ib1() { incPC(); phi(1); }
void ib2() { incPC(); phi(2); }
void ib3() { incPC(); phi(3); }
void ib4() { incPC(); phi(4); }
void ib5() { incPC(); phi(5); }
void ib6() { incPC(); phi(6); }
void ib7() { incPC(); phi(7); }
void ib8() { incPC(); phi(8); }
void ib9() { incPC(); phi(9); }
void iba() { incPC(); phi(10); }
void ibb() { incPC(); phi(11); }
void ibc() { incPC(); phi(12); }
void ibd() { incPC(); phi(13); }
void ibe() { incPC(); phi(14); }
void ibf() { incPC(); phi(15); }

void ic0() { incPC(); lbr(); }
void ic1() { incPC(); lbq(); }
void ic2() { incPC(); lbz(); }
void ic3() { incPC(); lbdf(); }
void ic4() { incPC(); } /* NOP     No Operation   C4 */
void ic5() { incPC(); lsnq(); }
void ic6() { incPC(); lsnz(); }
void ic7() { incPC(); lsnf(); }
void ic8() { printf("\tLSKP\n"); incPC(); incPC(); incPC(); } /* LSKP    Long Skip C8 */
void ic9() { incPC(); lbnq(); }
void ica() { incPC(); lbnz(); }
void icb() { incPC(); lbnf(); }
void icc() { incPC(); lsie(); }
void icd() { incPC(); lsq(); }
void ice() { incPC(); lsz(); }
void icf() { incPC(); lsdf(); }

void id0() { incPC(); sep(0); }
void id1() { incPC(); sep(1); }
void id2() { incPC(); sep(2); }
void id3() { incPC(); sep(3); }
void id4() { incPC(); sep(4); }
void id5() { incPC(); sep(5); }
void id6() { incPC(); sep(6); }
void id7() { incPC(); sep(7); }
void id8() { incPC(); sep(8); }
void id9() { incPC(); sep(9); }
void ida() { incPC(); sep(10); }
void idb() { incPC(); sep(11); }
void idc() { incPC(); sep(12); }
void idd() { incPC(); sep(13); }
void ide() { incPC(); sep(14); }
void idf() { incPC(); sep(15); }

void ie0() { incPC(); sex(0); }
void ie1() { incPC(); sex(1); }
void ie2() { incPC(); sex(2); }
void ie3() { incPC(); sex(3); }
void ie4() { incPC(); sex(4); }
void ie5() { incPC(); sex(5); }
void ie6() { incPC(); sex(6); }
void ie7() { incPC(); sex(7); }
void ie8() { incPC(); sex(8); }
void ie9() { incPC(); sex(9); }
void iea() { incPC(); sex(10); }
void ieb() { incPC(); sex(11); }
void iec() { incPC(); sex(12); }
void ied() { incPC(); sex(13); }
void iee() { incPC(); sex(14); }
void ief() { incPC(); sex(15); }

void if0() { incPC(); ldx(); }
void if1() { incPC(); _or(); }
void if2() { incPC(); _and(); }
void if3() { incPC(); _xor(); }
void if4() { incPC(); add(); }
void if5() { incPC(); sd(); }
void if6() { incPC(); shr(); }
void if7() { incPC(); sm(); }
void if8() { incPC(); ldi(); }
void if9() { incPC(); ori(); }
void ifa() { incPC(); ani(); }
void ifb() { incPC(); xri(); }
void ifc() { incPC(); adi(); }
void ifd() { incPC(); sdi(); }
void ife() { incPC(); shl(); }
void iff() { incPC(); smi(); }


typedef void (*fun)();
fun Tabula[] =
  {i00, i01, i02, i03, i04, i05, i06, i07,
   i08, i09, i0a, i0b, i0c, i0d, i0e, i0f,
   i10, i11, i12, i13, i14, i15, i16, i17,
   i18, i19, i1a, i1b, i1c, i1d, i1e, i1f,
   i20, i21, i22, i23, i24, i25, i26, i27,
   i28, i29, i2a, i2b, i2c, i2d, i2e, i2f,
   i30, i31, i32, i33, i34, i35, i36, i37,
   i38, i39, i3a, i3b, i3c, i3d, i3e, i3f,
   i40, i41, i42, i43, i44, i45, i46, i47,
   i48, i49, i4a, i4b, i4c, i4d, i4e, i4f,
   i50, i51, i52, i53, i54, i55, i56, i57,
   i58, i59, i5a, i5b, i5c, i5d, i5e, i5f,
   i60, i61, i62, i63, i64, i65, i66, i67,
   i68, i69, i6a, i6b, i6c, i6d, i6e, i6f,
   i70, i71, i72, i73, i74, i75, i76, i77,
   i78, i79, i7a, i7b, i7c, i7d, i7e, i7f,
   i80, i81, i82, i83, i84, i85, i86, i87,
   i88, i89, i8a, i8b, i8c, i8d, i8e, i8f,
   i90, i91, i92, i93, i94, i95, i96, i97,
   i98, i99, i9a, i9b, i9c, i9d, i9e, i9f,
   ia0, ia1, ia2, ia3, ia4, ia5, ia6, ia7,
   ia8, ia9, iaa, iab, iac, iad, iae, iaf,
   ib0, ib1, ib2, ib3, ib4, ib5, ib6, ib7,
   ib8, ib9, iba, ibb, ibc, ibd, ibe, ibf,
   ic0, ic1, ic2, ic3, ic4, ic5, ic6, ic7,
   ic8, ic9, ica, icb, icc, icd, ice, icf,
   id0, id1, id2, id3, id4, id5, id6, id7,
   id8, id9, ida, idb, idc, idd, ide, idf,
   ie0, ie1, ie2, ie3, ie4, ie5, ie6, ie7,
   ie8, ie9, iea, ieb, iec, ied, iee, ief,
   if0, if1, if2, if3, if4, if5, if6, if7,
   if8, if9, ifa, ifb, ifc, ifd, ife, iff};


void cpu_cycle() {
  int i;
  uint8_t code;
  code = memPcOut();
  //printf("Single Step:\n\n");
  printf("%.4x:  %.2x  ", PC(), code);
  Tabula[code]();
//#ifdef moo
  printf("\n");
  printf("Halt Address = %.4xh (%d)\n", PC(), PC());
  printf("D = %.2xh (%d)\n", r.D, r.D);
  printf("DF/Carry = %d\n", r.DF);
  printf("RP = R%x (%d) = %.4xh (%d)\n", r.P, r.P, r.R[r.P], r.R[r.P]);
  printf("RX = R%x (%d) = %.4xh (%d)\n", r.X, r.X, r.R[r.X], r.R[r.X]);
  printf("Q Flag = %d\n", r.Q);

  for (i = 0; i < 8; i++) {
    printf("R%x = %.4xh (%5d)          R%x = %.4xh (%d)\n",
           i, r.R[i], r.R[i], (i + 8), r.R[i + 8], r.R[i + 8]);
  }

  printf("\n");
//#endif  
/*
  printf("-----------------------------------------------------------------------------------------------------\n");
  printf("CYCLE: PC=%.4x CODE=%x D=%x DF=%d B=%x P=%d X=%d I=%x N=%x T=%x IE=%d Q=%d \n",
	 PC(), code, r.D, r.DF, r.B, r.P, r.X, r.I, r.N, r.T, r.IE, r.Q);
  printf("R0=%x R1=%x R2=%x R3=%x R4=%x R5=%x R6=%x R7=%x\nR8=%x R9=%x RA=%x RB=%x RC=%x RD=%x RE=%x RF=%x\n",
	 r.R[0], r.R[1], r.R[2], r.R[3], r.R[4], r.R[5], r.R[6], r.R[7],
	 r.R[8], r.R[9], r.R[10], r.R[11], r.R[12], r.R[13], r.R[14], r.R[15]);
  */
}


void cpu_reset() {
  r.I = 0;
  r.N = 0;
  r.Q = 0;
  r.IE = 1; /* Enable interrupts */
  bus = 0;
  r.X = 0;
  r.P = 0;
  r.R[0] = 0;
}


void ram_init() {
  mem = (uint8_t *)malloc(MEM_BYTES);
  if (!mem) {
    fprintf(stderr, "Couldn't allocate memory!\n");
    exit(EXIT_FAILURE);
  }
}


void ram_free() {
  free(mem);
}


void load_rom(char *filename) {
  FILE *f;
  uint16_t fsize;
  int result;
  f = fopen(filename, "r");
  if (f == NULL) {
    fprintf(stderr, "Cannot open ROM image \"%s\".\n", filename);
    exit(1);
  } else {
    fseek(f, 0, SEEK_END);
    fsize = ftell(f);
    rewind(f);
    /* ROM goes to the bottom of the address space: */
    result = fread(mem, 1, fsize, f);
    if (result != fsize) {
      fprintf(stderr, "Error reading ROM image \"%s\".\n", filename);
      exit(1);
    }
    fclose(f);
    printf("Loaded ROM image \"%s\" (%d bytes.)\n", filename, result);
  }
}
