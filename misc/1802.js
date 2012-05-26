/*
   1802 COSMAC Microprocessor Simulator Routines
   Originally based on the 6502 JavaScript emulator by N.Landsteiner
*/
/*
   COSMAC ELF-ish JavaScript Simulator (SimElf++ / COSMAC Elf^2)

   Enhanced program/system by William Donnelly circa May 2011
   http://www.donnelly-house.net/ -- whd1802 (at) donnelly-house.net
   http://www.donnelly-house.net/programming/cdp1802/
   Changes:
      Brightened switches and Hex LED display images (also made OFF and green LED versions)
      Added "COSMAC ELF" 'logo' text (image -- click for "About...")
      Cleaned up and streamlined JavaScript code and HTML specification
         cosmacelf.html, simelf.js, 1802cpu.js; created 1802programs.js; added 1802disasm.js
         Prefixed and renamed variable names
         Formatted code (whitespace, etc.)
         Changed from HTML Tables to Divs and changed FONT tags to SPAN
         Fixed several bugs and added speed enhancers
      Added memory dump and load form functionality and access via CDP1802 chip click
      Added mnemonic list functionality
      Added debugger window w/single step, breakpoint, etc.
      Offered ZIP archive so user can install and use it locally off-line
      Added "check for more recent update version" functionality

   This program is free software; you can redistribute it and/or modify
   it under the terms of the GNU General Public License as published by
   the Free Software Foundation; either version 3 of the License, or
   (at your option) any later version.

   Based on program/system by Maciej Szyc 2005, cosmac'at'szyc.org
   http://www.cosmac.szyc.org/
   Archived at: http://www.donnelly-house.net/programming/cdp1802/simelf/original/
   (note that this program has severe bugs)

   This program is free software; you can redistribute it and/or modify
   it under the terms of the GNU General Public License as published by
   the Free Software Foundation; either version 2 of the License, or
   (at your option) any later version.

   This program is distributed in the hope that it will be useful,
   but WITHOUT ANY WARRANTY; without even the implied warranty of
   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
   GNU General Public License for more details.
*/

// global constants

var gconMEMRD_OPCODE = -2;    // this value must be less than gconMEMRD_DATA  { memoryRead() }
var gconMEMRD_DATA = -1;      // this value and gconMEMRD_OPCODE must be < 0  { memoryRead() }

var gconMEM_USEPC = -1;      // use the PC as the address to store data, otherwise address  { memoryStore() }


// global values

var gbMemWriteFlag = true;    // memory write-able flag
var gnDataBus = 0;            // data bus value
var gnMemoryMaxRAM = 65536    // 65K      // 4608; // 4K   // 8192;    // 8K    // was 1024;   // 1K    // was 256;    // 256 bytes (1/4K)


// registers & memory

/*
   D  | 8 bits  | Data Register (Accumulator)
   DF | 1 bit   | Data Flag (ALU Carry)
   B  | 8 bits  | Auxiliary Holding Register
   R  | 16 bits | 1 of 16 Scratchpad Registers
   P  | 4 bits  | Designates which register is Program Counter
   X  | 4 bits  | Designates which register is Data Pointer
   N  | 4 bits  | Holds Low-Order Instruction Digit
   I  | 4 bits  | Holds High-Order Instruction Digit
   T  | 8 bits  | Holds old X, P after interrupt (X is high nibble)
   IE | 1 bit   | Interrupt Enable
   Q  | 1 bit   | Output Flip-Flop
*/

var   gnD8bAccum,          // D = 8-bit data register / accumulator
      gnB8bReg,            //    currently unused / not implemented (?)
      gnP4bRegIdx,         // P = 4-bit Program Counter register indicator
      gnX4bRegIdx,         // X = 4-bit RX register indicator
      gnN4bOpCodeLo,       // N = 4-bit register = Low order nybble of OpCode
      gnT8bRegIRQ;         // T = 8-bit (2 nybbles) register for IRQ (unused / not implemented)

      // gnI4bOpCodeHi

var   gbDataFlag1bCarry,   // DF = 1-bit Data Flag / ALU Carry (overflow / borrow)
      gbIntEnable1bFlag,   // IE = 1-bit Interrupt Enable flag (effectively unused / not implemented)
      gbQ1bFlag;           // Q = 1-bit output flag ('attached' to Q LED)

var   gbaEFnFlag = new Array (5);    // 1 - 4 (0 not used)

var   gnaRegister16b = new Array (16);  // 0 - 15

var   gnaMemoryRAM = new Array (gnMemoryMaxRAM);  // Memory array of bytes of RAM (maximum size set above)

var gfaOutputCallback = new Array(8);     // OUT opcode Callback Routines -- only 1 thru 7 are used
var gfaInputCallback = new Array(8);      // INP opcode Callback Routines -- only 1 thru 7 are used


// elf hardware
var gbDispFlag = false;
var gnInTemp;


// Extended debugging aids

var gbDebugMode = false;
var gnLastOpCodeAddress = 0;     // used to let the user know where the processor was before "now"
var gnLastGetAddress = 0;        // used to let the user know where the processor last accessed memory (get = load)
var gnLastPutAddress = 0;        // used to let the user know where the processor last accessed memory (put = store)


//General Functions


function getPC()
{
   return gnaRegister16b[gnP4bRegIdx] || 0;
} // getPC (Get Program Counter)


function setPC (pnData16)
{
   gnaRegister16b[gnP4bRegIdx] = (pnData16 & 0xFFFF);

   return;
} // setPC (Set Program Counter)


function incPC()
{
   gnaRegister16b[gnP4bRegIdx]++;
   gnaRegister16b[gnP4bRegIdx] &= 0xFFFF;

   return;
} // incPC (Increment Program Counter)


function memoryStore (pnData8, pnAddressMode)
{
   var nAddress;

   if (pnAddressMode == gconMEM_USEPC)    // -1 = use the Program Counter as the address
      nAddress = getPC();

   else
      nAddress = pnAddressMode & 0xFFFF;     // use passed in value as an address

   gnLastPutAddress = nAddress;   // save Last data Put Address (store)

if (gbDebugMode)
window.status = "Opcode: " + decToHex4 (gnLastOpCodeAddress) + " -- Data Get: " + decToHex4 (gnLastGetAddress) + " -- Data Store: " + decToHex4 
(gnLastPutAddress);

   if (nAddress >= 0  &&  nAddress < gnMemoryMaxRAM  &&  gbMemWriteFlag) {    // protect memory array from growing
      gnaMemoryRAM[nAddress] = pnData8 & 0xFF;
   }

   return;
} // memoryStore (Store data byte into memory via Program Counter)


function memoryRead (pnAddressMode)
{
   var nByte = 0xFF;    // default for out of bounds values
   var nAddress;

   if (pnAddressMode < 0)   // gconMEMRD_OPCODE or gconMEMRD_DATA
      nAddress = getPC();

   else
      nAddress = pnAddressMode & 0xFFFF;     // use passed in value as an address

   if (pnAddressMode == gconMEMRD_OPCODE)    // -2 = Get an OpCode
      gnLastOpCodeAddress = nAddress;        // save Last OpCode Address (versus data-get)

   if (pnAddressMode > gconMEMRD_OPCODE)     // -1 = Get "data" (immediate, memory address) or actual address
      gnLastGetAddress = nAddress;           // save Last data Get Address (versus opcode-get)

if (gbDebugMode)
window.status = "Opcode: " + decToHex4 (gnLastOpCodeAddress) + " -- Data Get: " + decToHex4 (gnLastGetAddress) + " -- Data Store: " + decToHex4 
(gnLastPutAddress);

   if (nAddress >= 0  &&  nAddress < gnMemoryMaxRAM) {    // keep memory references in bounds
      nByte = gnaMemoryRAM[nAddress] & 0xFF;
   }

   return nByte;
} // memoryRead (Retrieve next byte in memory via Program Counter or Address)


function memXRegStore (pnData8)
{
   var nAddress = gnaRegister16b[gnX4bRegIdx];

   gnLastPutAddress = nAddress;   // save Last data Put Address (store)

if (gbDebugMode)
window.status = "Opcode: " + decToHex4 (gnLastOpCodeAddress) + " -- Data Get: " + decToHex4 (gnLastGetAddress) + " -- Data Store: " + decToHex4 
(gnLastPutAddress);

   if (nAddress >= 0  &&  nAddress < gnMemoryMaxRAM  &&  gbMemWriteFlag) {    // protect memory array from growing
      gnaMemoryRAM[nAddress] = pnData8 & 0xFF;
   }

   return;
} // memXRegStore (Store data byte into memory via X Register)


function memXRegRead()
{
   var nAddress = gnaRegister16b[gnX4bRegIdx];
   var nByte = 0xFF;    // default for out of bounds values

   gnLastGetAddress = nAddress;   // save Last data Get Address (versus opcode-get)

if (gbDebugMode)
window.status = "Opcode: " + decToHex4 (gnLastOpCodeAddress) + " -- Data Get: " + decToHex4 (gnLastGetAddress) + " -- Data Store: " + decToHex4 
(gnLastPutAddress);

   if (nAddress >= 0  &&  nAddress < gnMemoryMaxRAM) {    // keep memory references in bounds
      nByte = gnaMemoryRAM[nAddress] & 0xFF;
   }

   return nByte;
} // memXRegRead (Retrieve next byte in memory via X Register)



// Register Operations


function incRegN (pnRegN)
{
   gnaRegister16b[pnRegN]++;
   gnaRegister16b[pnRegN] &= 0xFFFF;

   return;
} // incRegN (Increment Register N)


function decRegN (pnRegN)
{
   if (gnaRegister16b[pnRegN] == 0)
      gnaRegister16b[pnRegN] = 0xFFFF;

   else
      gnaRegister16b[pnRegN]--;

   return;
} // decRegN (Decrement Register N)


function incRegX()
{
   gnaRegister16b[gnX4bRegIdx]++;
   gnaRegister16b[gnX4bRegIdx] &= 0xFFFF;

   return;
} // incRegX (Increment Register X)


function getLoByte (pnRegN)
{
   gnD8bAccum = gnaRegister16b[pnRegN] & 0xFF;

   return;
} // getLoByte (Get Low Byte of Register N)


function getHiByte (pnRegN)
{
   gnD8bAccum = (gnaRegister16b[pnRegN] & 0xFF00) >> 8;

   return;
} // getHiByte (Get High Byte of Register N)


function putLoByte (pnRegN)
{
   gnaRegister16b[pnRegN] &= 0xFF00;
   gnaRegister16b[pnRegN] |= gnD8bAccum;

   return;
} // putLoByte (Store Low Byte of Register N)


function putHiByte (pnRegN)
{
   gnaRegister16b[pnRegN] = (gnD8bAccum * 256) | (gnaRegister16b[pnRegN] & 0xFF);

   return;
} // putHiByte (Store High Byte of Register N)



// Memory Reference


function loadRegN (pnRegN)
{
   gnD8bAccum = memoryRead (gnaRegister16b[pnRegN]);

   return;
} // loadRegN (LDN = Load Accumulator (D Reg) via Register N)


function loadAccumRegN (pnRegN) {
   gnD8bAccum = memoryRead (gnaRegister16b[pnRegN]);
   gnaRegister16b[pnRegN]++;
   gnaRegister16b[pnRegN] &= 0xFFFF;

   return;
} // loadAccumRegN (LDA = Load Accumulator (D Reg) via Register N and Advance (Increment Reg N))


function cdp1802_ldx()
{
   gnD8bAccum = memXRegRead();

   return;
} // cdp1802_ldx (Load Accumulator (D Reg) via Register X)


function cdp1802_ldxa()
{
   gnD8bAccum = memXRegRead();
   gnaRegister16b[gnX4bRegIdx]++;
   gnaRegister16b[gnX4bRegIdx] &= 0xFFFF

   return;
} // cdp1802_ldxa (Load Accumulator (D Reg) via Register X and Advance (Increment Reg X))


function cdp1802_ldi()
{
   gnD8bAccum = memoryRead (gconMEMRD_DATA);
   incPC();

   return;
} // cdp1802_ldi (Load Accumulator (D Reg) Immediate)


function storeAccumRegN (pnRegN)
{
   memoryStore (gnD8bAccum, gnaRegister16b[pnRegN]);

   return;
} // storeAccumRegN (STR = Store Accumulator (D Reg) via Register N)


function cdp1802_stxd()
{
   memXRegStore (gnD8bAccum);

   if (gnaRegister16b[gnX4bRegIdx] == 0)
      gnaRegister16b[gnX4bRegIdx] = 0xFFFF;

   else
      gnaRegister16b[gnX4bRegIdx]--;

   return;
} // cdp1802_stxd (Store Accumulator (D Reg) via Register X and Decrement (Reg X))



// Logic Operations


function cdp1802_or()
{
   gnD8bAccum |= memXRegRead();

   return;
} // cdp1802_or (OR memory byte via X Reg with Accumulator (D Reg))


function cdp1802_ori()
{
   gnD8bAccum |= memoryRead (gconMEMRD_DATA);
   incPC();

   return;
} // cdp1802_ori (OR Immediate (next byte) with Accumulator (D Reg))


function cdp1802_xor()
{
   gnD8bAccum ^= memXRegRead();

   return;
} // cdp1802_xor (XOR (Exclusive OR) memory byte via X Reg with Accumulator (D Reg))


function cdp1802_xri()
{
   gnD8bAccum ^= memoryRead (gconMEMRD_DATA);
   incPC();

   return;
} // cdp1802_xri (XOR Immediate (Exclusive OR next byte) with Accumulator (D Reg))


function cdp1802_and()
{
   gnD8bAccum &= memXRegRead();

   return;
} // cdp1802_and (AND memory byte via X Reg with Accumulator (D Reg))


function cdp1802_ani()
{
   gnD8bAccum &= memoryRead (gconMEMRD_DATA);
   incPC();

   return;
} // cdp1802_ani (AND Immediate (next byte) with Accumulator (D Reg))


function cdp1802_shr()
{
   if(gnD8bAccum & 1)
      gbDataFlag1bCarry = true;

   else
      gbDataFlag1bCarry = false;

   gnD8bAccum = gnD8bAccum >> 1;
   gnD8bAccum &= 0x7F;

   return;
} // cdp1802_shr (Shift Right)


function cdp1802_rshr()
{
   var bFlag = gbDataFlag1bCarry;

   if (gnD8bAccum & 1)
      gbDataFlag1bCarry = true;

   else
      gbDataFlag1bCarry = false;

   gnD8bAccum = gnD8bAccum >> 1;
   gnD8bAccum &= 0x7F;

   if (bFlag)
      gnD8bAccum |= 0x80;

   return;
} // cdp1802_rshr (Rotate Shift Right)


function cdp1802_shl()
{
   if (gnD8bAccum & 0x80)
      gbDataFlag1bCarry = true;

   else
      gbDataFlag1bCarry = false;

   gnD8bAccum = gnD8bAccum << 1;
   gnD8bAccum &= 0xFE;

   return;
} // cdp1802_shl (Shift Left)


function cdp1802_rshl() {
   var bFlag = gbDataFlag1bCarry;

   if (gnD8bAccum & 0x80)
      gbDataFlag1bCarry = true;

   else
      gbDataFlag1bCarry = false;

   gnD8bAccum = gnD8bAccum << 1;
   gnD8bAccum &= 0xFE;

   if (bFlag)
      gnD8bAccum |= 1;

   return;
} // cdp1802_rshl (Rotate Shift Left)



// Aritmetic Operations


function cdp1802_add()
{
   gnD8bAccum += memXRegRead();

   if (gnD8bAccum > 0xFF)
      gbDataFlag1bCarry = true;

   else
      gbDataFlag1bCarry = false;

   gnD8bAccum &= 0xFF;

   return;
} // cdp1802_add (Add memory byte via X Reg to Accumulator (D Reg))


function cdp1802_adi()
{
   gnD8bAccum += memoryRead (gconMEMRD_DATA);

   if (gnD8bAccum > 0xFF)
      gbDataFlag1bCarry = true;

   else
      gbDataFlag1bCarry = false;

   gnD8bAccum &= 0xFF;
   incPC();

   return;
} // cdp1802_add (Add Immediate (next byte) to Accumulator (D Reg))


function cdp1802_adc()
{
   gnD8bAccum += memXRegRead();
   gnD8bAccum += gbDataFlag1bCarry;

   if (gnD8bAccum > 0xFF)
      gbDataFlag1bCarry = true;

   else
      gbDataFlag1bCarry = false;

   gnD8bAccum &= 0xFF;

   return;
} // cdp1802_adc (Add memory byte via X Reg plus carry to Accumulator (D Reg))


function cdp1802_adci()
{
   gnD8bAccum += memoryRead (gconMEMRD_DATA);
   gnD8bAccum += gbDataFlag1bCarry;

   if (gnD8bAccum > 0xFF)
      gbDataFlag1bCarry = true;

   else
      gbDataFlag1bCarry = false;

   gnD8bAccum &= 0xFF;
   incPC();

   return;
} // cdp1802_add (Add Immediate (next byte) plus carry to Accumulator (D Reg))


function cdp1802_sd()
{
   gnD8bAccum = memXRegRead() + (0xFF - gnD8bAccum) + 1;

   if (gnD8bAccum > 0xFF)
      gbDataFlag1bCarry = true;     // no borrow

   else
      gbDataFlag1bCarry = false;    // borrow

   gnD8bAccum &= 0xFF;

   return;
} // cdp1802_sd (Subtract Accumulator (D Reg) from memory byte via X Reg)


function cdp1802_sdi() {
   gnD8bAccum = memoryRead (gconMEMRD_DATA) + (0xFF - gnD8bAccum) + 1;

   if (gnD8bAccum > 0xFF)
      gbDataFlag1bCarry = true;     // no borrow

   else
      gbDataFlag1bCarry = false;    // borrow

   gnD8bAccum &= 0xFF;
   incPC();

   return;
} // cdp1802_sd (Subtract Accumulator (D Reg) from Immediate (next byte))


function cdp1802_sdb()
{
   gnD8bAccum = memXRegRead() + (0xFF - gnD8bAccum) + 1;
   // gnD8bAccum += (0xFF - memXRegRead());      // bug error?

   if (!gbDataFlag1bCarry)
      gnD8bAccum--;           // subtract borrow, which is NOT (DF)

   if (gnD8bAccum > 0xFF)
      gbDataFlag1bCarry = true;     // no borrow

   else
      gbDataFlag1bCarry = false;    // borrow

   gnD8bAccum &= 0xFF;

   return;
} // cdp1802_sd (Subtract Accumulator (D Reg) with borrow from memory byte via X Reg)


function cdp1802_sdbi()
{
   gnD8bAccum = memoryRead (gconMEMRD_DATA) + (0xFF - gnD8bAccum) + 1;

   if (!gbDataFlag1bCarry)
      gnD8bAccum--;           // subtract borrow, which is NOT (DF)

   if (gnD8bAccum > 0xFF)
      gbDataFlag1bCarry = true;     // no borrow

   else
      gbDataFlag1bCarry = false;    // borrow

   gnD8bAccum &= 0xFF;
   incPC();

   return;
} // cdp1802_sd (Subtract Accumulator (D Reg) with borrow from Immediate (next byte))


function cdp1802_sm()
{
   gnD8bAccum = gnD8bAccum + (0xFF - memXRegRead()) + 1;

   if (gnD8bAccum > 0xFF)
      gbDataFlag1bCarry = true;     // no borrow

   else
      gbDataFlag1bCarry = false;    // borrow

   gnD8bAccum &= 0xFF;

   return;
} // cdp1802_sd (Subtract memory byte via X Reg from Accumulator (D Reg))


function cdp1802_smi()
{
   gnD8bAccum = gnD8bAccum + (0xFF - memoryRead (gconMEMRD_DATA)) + 1;

   if (gnD8bAccum > 0xFF)
      gbDataFlag1bCarry = true;     // no borrow

   else
      gbDataFlag1bCarry = false;    // borrow

   gnD8bAccum &= 0xFF;
   incPC();

   return;
} // cdp1802_sd (Subtract Immediate (next byte) from Accumulator (D Reg))


function cdp1802_smb()
{
   gnD8bAccum = gnD8bAccum + (0xFF - memXRegRead()) + 1;

   if (!gbDataFlag1bCarry)
      gnD8bAccum--;           // subtract borrow, which is NOT (DF)

   if (gnD8bAccum > 0xFF)
      gbDataFlag1bCarry = true;     // no borrow

   else
      gbDataFlag1bCarry = false;    // borrow

   gnD8bAccum &= 0xFF;

   return;
} // cdp1802_sd (Subtract memory byte via X Reg with borrow from Accumulator (D Reg))


function cdp1802_smbi()
{
   gnD8bAccum = gnD8bAccum + (0xFF - memoryRead (gconMEMRD_DATA)) + 1;

   if (!gbDataFlag1bCarry)
      gnD8bAccum--;           // subtract borrow, which is NOT (DF)

   if (gnD8bAccum > 0xFF)
      gbDataFlag1bCarry = true;     // no borrow

   else
      gbDataFlag1bCarry = false;    // borrow

   gnD8bAccum &= 0xFF;
   incPC();

   return;
} // cdp1802_sd (Subtract Immediate (next byte) with borrow from Accumulator (D Reg))



// Branching


function cdp1802_br()
{
   var nAddress = (getPC() & 0xFF00);
   nAddress |= memoryRead (gconMEMRD_DATA);
   setPC (nAddress);

   return;
} // cdp1802_br (Page branch -- unconditional)


function cdp1802_bz()
{
   if (gnD8bAccum == 0) {
      var nAddress = (getPC() & 0xFF00);
      nAddress |= memoryRead (gconMEMRD_DATA);
      setPC (nAddress);

   } else
      incPC();

   return;
} // cdp1802_bz (Page Branch if Accumulator (D Reg) is zero)


function cdp1802_bnz()
{
   if (gnD8bAccum != 0) {
      var nAddress = (getPC() & 0xFF00);
      nAddress |= memoryRead (gconMEMRD_DATA);
      setPC (nAddress);

   } else
      incPC();

   return;
} // cdp1802_bnz (Page Branch if Accumulator (D Reg) is not zero)


function cdp1802_bdf()
{
   if (gbDataFlag1bCarry) {
      var nAddress = (getPC() & 0xFF00);
      nAddress |= memoryRead (gconMEMRD_DATA);
      setPC (nAddress);

   } else
      incPC();

   return;
} // cdp1802_bdf (Page Branch if Data Flag is set) = (Carry / No Borrow)


function cdp1802_bnf()
{
   if (!gbDataFlag1bCarry) {
      var nAddress = (getPC() & 0xFF00);
      nAddress |= memoryRead (gconMEMRD_DATA);
      setPC (nAddress);

   } else
      incPC();

   return;
} // cdp1802_bnf (Page Branch if Data Flag is clear) = (No Carry / Borrow)


function cdp1802_bq()
{
   if (gbQ1bFlag) {
      var nAddress = (getPC() & 0xFF00);
      nAddress |= memoryRead (gconMEMRD_DATA);
      setPC (nAddress);

   } else
      incPC();

   return;
} // cdp1802_bq (Page Branch if Q Flag is set)


function cdp1802_bnq()
{
   if (!gbQ1bFlag) {
      var nAddress = (getPC() & 0xFF00);
      nAddress |= memoryRead (gconMEMRD_DATA);
      setPC (nAddress);

   } else
      incPC();

   return;
} // cdp1802_bnq (Page Branch if Q Flag is clear)


function cdp1802_b1()
{
   if (gbaEFnFlag[1]) {
      var nAddress = (getPC() & 0xFF00);
      nAddress |= memoryRead (gconMEMRD_DATA);
      setPC (nAddress);

   } else
      incPC()

   return;
} // cdp1802_b1 (Page Branch if EF1 Flag is set)


function cdp1802_bn1()
{
   if (!gbaEFnFlag[1]) {
      var nAddress = (getPC() & 0xFF00);
      nAddress |= memoryRead (gconMEMRD_DATA);
      setPC (nAddress);

   } else
      incPC();

   return;
} // cdp1802_bn1 (Page Branch if EF1 Flag is clear)


function cdp1802_b2()
{
   if (gbaEFnFlag[2]) {
      var nAddress = (getPC() & 0xFF00);
      nAddress |= memoryRead (gconMEMRD_DATA);
      setPC (nAddress);

   } else
      incPC();

   return;
} // cdp1802_b2 (Page Branch if EF2 Flag is set)


function cdp1802_bn2()
{
   if (!gbaEFnFlag[2]) {
      var nAddress = (getPC() & 0xFF00);
      nAddress |= memoryRead (gconMEMRD_DATA);
      setPC (nAddress);

   } else
      incPC();

   return;
} // cdp1802_bn2 (Page Branch if EF2 Flag is clear)


function cdp1802_b3()
{
   if (gbaEFnFlag[3]) {
      var nAddress = (getPC() & 0xFF00);
      nAddress |= memoryRead (gconMEMRD_DATA);
      setPC (nAddress);

   } else
      incPC();

   return;
} // cdp1802_b3 (Page Branch if EF3 Flag is set)


function cdp1802_bn3()
{
   if (!gbaEFnFlag[3]) {
      var nAddress = (getPC() & 0xFF00);
      nAddress |= memoryRead (gconMEMRD_DATA);
      setPC (nAddress);

   } else
      incPC();

   return;
} // cdp1802_bn3 (Page Branch if EF3 Flag is clear)


function cdp1802_b4()
{
   if (gbaEFnFlag[4]) {
      var nAddress = (getPC() & 0xFF00);
      nAddress |= memoryRead (gconMEMRD_DATA);
      setPC (nAddress);

   } else
      incPC();

   return;
} // cdp1802_b4 (Page Branch if EF4 Flag is set)


function cdp1802_bn4()
{
   if (!gbaEFnFlag[4] & gnInTemp) {
      gnInTemp--;
      var nAddress = (getPC() & 0xFF00);
      nAddress |= memoryRead (gconMEMRD_DATA);
      setPC (nAddress);

   } else
      incPC();

   return;
} // cdp1802_bn4 (Page Branch if EF4 Flag is clear)


function cdp1802_lbr()
{
   var nAddress = 256 * memoryRead (gconMEMRD_DATA);
   incPC();
   nAddress |= memoryRead (gconMEMRD_DATA);
   setPC (nAddress);

   return;
} // cdp1802_bz (Long Branch -- unconditional)


function cdp1802_lbz()
{
   if (gnD8bAccum == 0) {
      var nAddress = 256 * memoryRead (gconMEMRD_DATA);
      incPC();
      nAddress |= memoryRead (gconMEMRD_DATA);
      setPC (nAddress);

   } else {
      incPC();
      incPC();
   }

   return;
} // cdp1802_lbz (Long Branch if Accumulator (D Reg) is zero)


function cdp1802_lbnz()
{
   if (gnD8bAccum != 0) {
      var nAddress = 256 * memoryRead (gconMEMRD_DATA);
      incPC();
      nAddress |= memoryRead (gconMEMRD_DATA);
      setPC (nAddress);

   } else {
      incPC();
      incPC();
   }

   return;
} // cdp1802_lbnz (Long Branch if Accumulator (D Reg) is not zero)


function cdp1802_lbdf()
{
   if (gbDataFlag1bCarry) {
      var nAddress = 256 * memoryRead (gconMEMRD_DATA);
      incPC();
      nAddress |= memoryRead (gconMEMRD_DATA);
      setPC (nAddress);

   } else {
      incPC();
      incPC();
   }

   return;
} // cdp1802_lbdf (Long Branch if Data Flag is set) = (Carry / No Borrow)


function cdp1802_lbnf()
{
   if (!gbDataFlag1bCarry) {
      var nAddress = 256 * memoryRead (gconMEMRD_DATA);
      incPC();
      nAddress |= memoryRead (gconMEMRD_DATA);
      setPC (nAddress);

   } else {
      incPC();
      incPC();
   }

   return;
} // cdp1802_lbnf (Long Branch if Data Flag is clear) = (No Carry / Borrow)


function cdp1802_lbq()
{
   if (gbQ1bFlag) {
      var nAddress = 256 * memoryRead (gconMEMRD_DATA);
      incPC();
      nAddress |= memoryRead (gconMEMRD_DATA);
      setPC (nAddress);

   } else {
      incPC();
      incPC();
   }

   return;
} // cdp1802_lbq (Long Branch if Q Flag is set)


function cdp1802_lbnq()
{
   if (!gbQ1bFlag) {
      var nAddress = 256 * memoryRead (gconMEMRD_DATA);
      incPC();
      nAddress |= memoryRead (gconMEMRD_DATA);
      setPC (nAddress);

   } else {
      incPC();
      incPC();
   }

   return;
} // cdp1802_lbq (Long Branch if Q Flag is clear)



// Skip instructions


function cdp1802_lsz()
{
   if (gnD8bAccum == 0) {
      incPC();
      incPC();
   }

   return;
} // cdp1802_lsz (Long Skip if Accumulator (D Reg) is zero)


function cdp1802_lsnz()
{
   if (gnD8bAccum != 0) {
      incPC();
      incPC();
   }

   return;
} // cdp1802_lsnz (Long Skip if Accumulator (D Reg) is not zero)


function cdp1802_lsdf()
{
   if (gbDataFlag1bCarry) {
      incPC();
      incPC();
   }

   return;
} // cdp1802_lsdf (Long Skip if Data Flag is set) = (Carry / No Borrow)


function cdp1802_lsnf()
{
   if (!gbDataFlag1bCarry) {
      incPC();
      incPC();
   }

   return;
} // cdp1802_lbdf (Long Skip if Data Flag is clear) = (No Carry / Borrow)


function cdp1802_lsq()
{
   if (gbQ1bFlag) {
      incPC();
      incPC();
   }

   return;
} // cdp1802_lsq (Long Skip if Q Flag is set)


function cdp1802_lsnq()
{
   if (!gbQ1bFlag) {
      incPC();
      incPC();
   }

   return;
} // cdp1802_lsnq (Long Skip if Q Flag is clear)


function cdp1802_lsie()
{
   if (gbIntEnable1bFlag) {
      incPC();
      incPC();
   }

   return;
} // cdp1802_lsie (Long Skip if Interrupts are Enabled)



// Control instructions


function cdp1802_sep (pnRegN)
{
   gnN4bOpCodeLo = pnRegN;
   gnP4bRegIdx = gnN4bOpCodeLo;

   return;
} // cdp1802_sep (Set Index for Program Counter as Register N)


function cdp1802_sex (pnRegN)
{
   gnN4bOpCodeLo = pnRegN;
   gnX4bRegIdx = gnN4bOpCodeLo;

   return;
} // cdp1802_sep (Set Index for Register X as Register N)



// Input/Output Byte Tranfer


function cdp1802_out (pnPortK)
{
   var nData8b;
   var nCallbackCount = 0;

   gnDataBus = memXRegRead();

   if (pnPortK == 4) {
      gnDispData = gnDataBus;  // via simelf.js (hex LED displays)
      gbDispFlag = true;
   }  // elf hardware

   nCallbackCount = gfaOutputCallback[pnPortK].length;

   if (nCallbackCount > 0) {  // if there are callback functions, call each one and xfer data
      for (var nIdx = 0;  nIdx < nCallbackCount;  ++nIdx) {

         gfaOutputCallback[pnPortK][nIdx](gnDataBus);

      } // for
   }

   gnaRegister16b[gnX4bRegIdx]++;
   gnaRegister16b[gnX4bRegIdx] &= 0xFFFF;

   return;
} // cdp1802_out


function cdp1802_inp (pnPortK)
{
   var nData8b = -1;
   var nCallbackCount = 0;

   // gnDataBus = Math.floor (Math.random() * 256);   // default to random value (?)
   gnDataBus = 0;    // default to zero?

   if (pnPortK == 4) {
      gnDataBus = gnInData;   // via simelf.js (8 toggle switches)
   }  // elf hardware

   nCallbackCount = gfaInputCallback[pnPortK].length;

   if (nCallbackCount > 0) {  // if there are callback functions, call each one and return first found
      for (var nIdx = 0;  nIdx < nCallbackCount;  ++nIdx) {

         nData8b = gfaInputCallback[pnPortK][nIdx]();

         if (typeof (nData8b) != "undefined"  &&  nData8b !== null  &&  nData8b !== false)
            nIdx = nCallbackCount;  // stop checking when first data byte found

      } // for
   }

   if (typeof (nData8b) != "undefined"  &&  nData8b !== null  &&  nData8b !== false  &&  nData8b !== -1)
      gnDataBus = nData8b & 0xFF;

   memXRegStore (gnDataBus);     // store data bus value into memory via Regster X
   gnD8bAccum = gnDataBus;    // store data bus value into Accumulator (D Reg)
//if(pnPortK==6)window.status=gnDataBus+" "+window.status.substr (0, 100);
   return;
} // cdp1802_inp


function cdp1802_dis()
{
   var nNewXP = memXRegRead() & 0xFF;

   var nXnybble = nNewXP >> 4;
   var nPnybble = nNewXP & 0x0F;

   gnX4bRegIdx = nXnybble;    // set new X register
   gnP4bRegIdx = nPnybble;    // set new P register (PC = Program Counter)

   gnaRegister16b[gnX4bRegIdx]++;
   gbIntEnable1bFlag = false;

   return;
} // cdp1802_dis -- DIS M(R(X)) => (X,P); R(X)+1; 0 => IE --- Return w/ Interrupt disabled


function cdp1802_ret()
{
   var nNewXP = memXRegRead() & 0xFF;

   var nXnybble = nNewXP >> 4;
   var nPnybble = nNewXP & 0x0F;

   gnX4bRegIdx = nXnybble;    // set new X register
   gnP4bRegIdx = nPnybble;    // set new P register (PC = Program Counter)

   gnaRegister16b[gnX4bRegIdx]++;
   gbIntEnable1bFlag = true;

   return;
} // cdp1802_ret -- RET M(R(X)) => (X,P); R(X)+1; 1 => IE --- Return w/ Interrupt enabled



// Instruction Code Functions


function icf_00() { incPC(); }    // IDL -- not implemented here, so NOP
/*
   IDLE = Wait for DMA Or Interrupt; M(R(0)) => Bus
   In Idle mode, the microprocessor repeats executing (S1) cycles until
   an I/O request is asserted (INTERRUPT, DMA-IN, or DMA-OUT are pulled low).
   When the request is acknowledged, the IDLE cycle is terminated and the
   I/O request is serviced, whereupon normal operation is resumed.
   Note: Perhaps this should be implemented as a "Pause" / "Halt" instruction.
   It could be effectively used as a Breakpoint, in this manner.
*/

function icf_01() { incPC(); loadRegN (1); }
function icf_02() { incPC(); loadRegN (2); }
function icf_03() { incPC(); loadRegN (3); }
function icf_04() { incPC(); loadRegN (4); }
function icf_05() { incPC(); loadRegN (5); }
function icf_06() { incPC(); loadRegN (6); }
function icf_07() { incPC(); loadRegN (7); }
function icf_08() { incPC(); loadRegN (8); }
function icf_09() { incPC(); loadRegN (9); }
function icf_0A() { incPC(); loadRegN (10); }
function icf_0B() { incPC(); loadRegN (11); }
function icf_0C() { incPC(); loadRegN (12); }
function icf_0D() { incPC(); loadRegN (13); }
function icf_0E() { incPC(); loadRegN (14); }
function icf_0F() { incPC(); loadRegN (15); }

function icf_10() { incPC(); incRegN (0); }
function icf_11() { incPC(); incRegN (1); }
function icf_12() { incPC(); incRegN (2); }
function icf_13() { incPC(); incRegN (3); }
function icf_14() { incPC(); incRegN (4); }
function icf_15() { incPC(); incRegN (5); }
function icf_16() { incPC(); incRegN (6); }
function icf_17() { incPC(); incRegN (7); }
function icf_18() { incPC(); incRegN (8); }
function icf_19() { incPC(); incRegN (9); }
function icf_1A() { incPC(); incRegN (10); }
function icf_1B() { incPC(); incRegN (11); }
function icf_1C() { incPC(); incRegN (12); }
function icf_1D() { incPC(); incRegN (13); }
function icf_1E() { incPC(); incRegN (14); }
function icf_1F() { incPC(); incRegN (15); }

function icf_20() { incPC(); decRegN (0); }
function icf_21() { incPC(); decRegN (1); }
function icf_22() { incPC(); decRegN (2); }
function icf_23() { incPC(); decRegN (3); }
function icf_24() { incPC(); decRegN (4); }
function icf_25() { incPC(); decRegN (5); }
function icf_26() { incPC(); decRegN (6); }
function icf_27() { incPC(); decRegN (7); }
function icf_28() { incPC(); decRegN (8); }
function icf_29() { incPC(); decRegN (9); }
function icf_2A() { incPC(); decRegN (10); }
function icf_2B() { incPC(); decRegN (11); }
function icf_2C() { incPC(); decRegN (12); }
function icf_2D() { incPC(); decRegN (13); }
function icf_2E() { incPC(); decRegN (14); }
function icf_2F() { incPC(); decRegN (15); }

function icf_30() { incPC(); cdp1802_br(); }
function icf_31() { incPC(); cdp1802_bq(); }
function icf_32() { incPC(); cdp1802_bz(); }
function icf_33() { incPC(); cdp1802_bdf(); }
function icf_34() { incPC(); cdp1802_b1(); }
function icf_35() { incPC(); cdp1802_b2(); }
function icf_36() { incPC(); cdp1802_b3(); }
function icf_37() { incPC(); cdp1802_b4(); }
function icf_38() { incPC(); }                   // SKP or NBR (short = 1 byte)
function icf_39() { incPC(); cdp1802_bnq(); }
function icf_3A() { incPC(); cdp1802_bnz(); }
function icf_3B() { incPC(); cdp1802_bnf(); }
function icf_3C() { incPC(); cdp1802_bn1(); }
function icf_3D() { incPC(); cdp1802_bn2(); }
function icf_3E() { incPC(); cdp1802_bn3(); }
function icf_3F() { incPC(); cdp1802_bn4(); }

function icf_40() { incPC(); loadAccumRegN (0); }
function icf_41() { incPC(); loadAccumRegN (1); }
function icf_42() { incPC(); loadAccumRegN (2); }
function icf_43() { incPC(); loadAccumRegN (3); }
function icf_44() { incPC(); loadAccumRegN (4); }
function icf_45() { incPC(); loadAccumRegN (5); }
function icf_46() { incPC(); loadAccumRegN (6); }
function icf_47() { incPC(); loadAccumRegN (7); }
function icf_48() { incPC(); loadAccumRegN (8); }
function icf_49() { incPC(); loadAccumRegN (9); }
function icf_4A() { incPC(); loadAccumRegN (10); }
function icf_4B() { incPC(); loadAccumRegN (11); }
function icf_4C() { incPC(); loadAccumRegN (12); }
function icf_4D() { incPC(); loadAccumRegN (13); }
function icf_4E() { incPC(); loadAccumRegN (14); }
function icf_4F() { incPC(); loadAccumRegN (15); }

function icf_50() { incPC(); storeAccumRegN (0); }
function icf_51() { incPC(); storeAccumRegN (1); }
function icf_52() { incPC(); storeAccumRegN (2); }
function icf_53() { incPC(); storeAccumRegN (3); }
function icf_54() { incPC(); storeAccumRegN (4); }
function icf_55() { incPC(); storeAccumRegN (5); }
function icf_56() { incPC(); storeAccumRegN (6); }
function icf_57() { incPC(); storeAccumRegN (7); }
function icf_58() { incPC(); storeAccumRegN (8); }
function icf_59() { incPC(); storeAccumRegN (9); }
function icf_5A() { incPC(); storeAccumRegN (10); }
function icf_5B() { incPC(); storeAccumRegN (11); }
function icf_5C() { incPC(); storeAccumRegN (12); }
function icf_5D() { incPC(); storeAccumRegN (13); }
function icf_5E() { incPC(); storeAccumRegN (14); }
function icf_5F() { incPC(); storeAccumRegN (15); }

function icf_60() { incPC(); incRegX(); }
function icf_61() { incPC(); cdp1802_out (1); }
function icf_62() { incPC(); cdp1802_out (2); }
function icf_63() { incPC(); cdp1802_out (3); }
function icf_64() { incPC(); cdp1802_out (4); }
function icf_65() { incPC(); cdp1802_out (5); }
function icf_66() { incPC(); cdp1802_out (6); }
function icf_67() { incPC(); cdp1802_out (7); }
function icf_68() { incPC(); }                   // effectively, or actually, undefined --- so, NOP? (or input random #?)
function icf_69() { incPC(); cdp1802_inp (1); }
function icf_6A() { incPC(); cdp1802_inp (2); }
function icf_6B() { incPC(); cdp1802_inp (3); }
function icf_6C() { incPC(); cdp1802_inp (4); }
function icf_6D() { incPC(); cdp1802_inp (5); }
function icf_6E() { incPC(); cdp1802_inp (6); }
function icf_6F() { incPC(); cdp1802_inp (7); }

function icf_70() { incPC(); cdp1802_ret(); }    
function icf_71() { incPC(); cdp1802_dis(); }
function icf_72() { incPC(); cdp1802_ldxa(); }
function icf_73() { incPC(); cdp1802_stxd(); }
function icf_74() { incPC(); cdp1802_adc(); }
function icf_75() { incPC(); cdp1802_sdb(); }
function icf_76() { incPC(); cdp1802_rshr(); }
function icf_77() { incPC(); cdp1802_smb(); }

function icf_78() { incPC();                       // SAV (not implemented! T => M(R(X)) --- Interrupt usage
   alert ("WARNING! Unsupported instruction: 78h SAV at " + decToHex4 (getPC() - 1)); }
function icf_79() { incPC();                       // MARK (not implemented! (X,P) => T; (X,P) => M(R(2)); Then P => X; R(2)-1 --- Interrupt usage
   alert ("WARNING! Unsupported instruction: 79h MARK at " + decToHex4 (getPC() - 1)); }

function icf_7A() { incPC(); gbQ1bFlag = false; gbDispFlag = true; }
function icf_7B() { incPC(); gbQ1bFlag = true;  gbDispFlag = true; }
function icf_7C() { incPC(); cdp1802_adci(); }
function icf_7D() { incPC(); cdp1802_sdbi(); }
function icf_7E() { incPC(); cdp1802_rshl(); }
function icf_7F() { incPC(); cdp1802_smbi(); }

function icf_80() { incPC(); getLoByte (0); }
function icf_81() { incPC(); getLoByte (1); }
function icf_82() { incPC(); getLoByte (2); }
function icf_83() { incPC(); getLoByte (3); }
function icf_84() { incPC(); getLoByte (4); }
function icf_85() { incPC(); getLoByte (5); }
function icf_86() { incPC(); getLoByte (6); }
function icf_87() { incPC(); getLoByte (7); }
function icf_88() { incPC(); getLoByte (8); }
function icf_89() { incPC(); getLoByte (9); }
function icf_8A() { incPC(); getLoByte (10); }
function icf_8B() { incPC(); getLoByte (11); }
function icf_8C() { incPC(); getLoByte (12); }
function icf_8D() { incPC(); getLoByte (13); }
function icf_8E() { incPC(); getLoByte (14); }
function icf_8F() { incPC(); getLoByte (15); }

function icf_90() { incPC(); getHiByte (0); }
function icf_91() { incPC(); getHiByte (1); }
function icf_92() { incPC(); getHiByte (2); }
function icf_93() { incPC(); getHiByte (3); }
function icf_94() { incPC(); getHiByte (4); }
function icf_95() { incPC(); getHiByte (5); }
function icf_96() { incPC(); getHiByte (6); }
function icf_97() { incPC(); getHiByte (7); }
function icf_98() { incPC(); getHiByte (8); }
function icf_99() { incPC(); getHiByte (9); }
function icf_9A() { incPC(); getHiByte (10); }
function icf_9B() { incPC(); getHiByte (11); }
function icf_9C() { incPC(); getHiByte (12); }
function icf_9D() { incPC(); getHiByte (13); }
function icf_9E() { incPC(); getHiByte (14); }
function icf_9F() { incPC(); getHiByte (15); }

function icf_A0() { incPC(); putLoByte (0); }
function icf_A1() { incPC(); putLoByte (1); }
function icf_A2() { incPC(); putLoByte (2); }
function icf_A3() { incPC(); putLoByte (3); }
function icf_A4() { incPC(); putLoByte (4); }
function icf_A5() { incPC(); putLoByte (5); }
function icf_A6() { incPC(); putLoByte (6); }
function icf_A7() { incPC(); putLoByte (7); }
function icf_A8() { incPC(); putLoByte (8); }
function icf_A9() { incPC(); putLoByte (9); }
function icf_AA() { incPC(); putLoByte (10); }
function icf_AB() { incPC(); putLoByte (11); }
function icf_AC() { incPC(); putLoByte (12); }
function icf_AD() { incPC(); putLoByte (13); }
function icf_AE() { incPC(); putLoByte (14); }
function icf_AF() { incPC(); putLoByte (15); }

function icf_B0() { incPC(); putHiByte (0); }
function icf_B1() { incPC(); putHiByte (1); }
function icf_B2() { incPC(); putHiByte (2); }
function icf_B3() { incPC(); putHiByte (3); }
function icf_B4() { incPC(); putHiByte (4); }
function icf_B5() { incPC(); putHiByte (5); }
function icf_B6() { incPC(); putHiByte (6); }
function icf_B7() { incPC(); putHiByte (7); }
function icf_B8() { incPC(); putHiByte (8); }
function icf_B9() { incPC(); putHiByte (9); }
function icf_BA() { incPC(); putHiByte (10); }
function icf_BB() { incPC(); putHiByte (11); }
function icf_BC() { incPC(); putHiByte (12); }
function icf_BD() { incPC(); putHiByte (13); }
function icf_BE() { incPC(); putHiByte (14); }
function icf_BF() { incPC(); putHiByte (15); }

function icf_C0() { incPC(); cdp1802_lbr(); }
function icf_C1() { incPC(); cdp1802_lbq(); }
function icf_C2() { incPC(); cdp1802_lbz(); }
function icf_C3() { incPC(); cdp1802_lbdf(); }
function icf_C4() { incPC(); }                   // NOP
function icf_C5() { incPC(); cdp1802_lsnq(); }
function icf_C6() { incPC(); cdp1802_lsnz(); }
function icf_C7() { incPC(); cdp1802_lsnf(); }
function icf_C8() { incPC(); incPC(); incPC(); }    // LSKP or NLBR (long = 2 bytes)
function icf_C9() { incPC(); cdp1802_lbnq(); }
function icf_CA() { incPC(); cdp1802_lbnz(); }
function icf_CB() { incPC(); cdp1802_lbnf(); }
function icf_CC() { incPC(); cdp1802_lsie(); }
function icf_CD() { incPC(); cdp1802_lsq(); }
function icf_CE() { incPC(); cdp1802_lsz(); }
function icf_CF() { incPC(); cdp1802_lsdf(); }

function icf_D0() { incPC(); cdp1802_sep (0); }
function icf_D1() { incPC(); cdp1802_sep (1); }
function icf_D2() { incPC(); cdp1802_sep (2); }
function icf_D3() { incPC(); cdp1802_sep (3); }
function icf_D4() { incPC(); cdp1802_sep (4); }
function icf_D5() { incPC(); cdp1802_sep (5); }
function icf_D6() { incPC(); cdp1802_sep (6); }
function icf_D7() { incPC(); cdp1802_sep (7); }
function icf_D8() { incPC(); cdp1802_sep (8); }
function icf_D9() { incPC(); cdp1802_sep (9); }
function icf_DA() { incPC(); cdp1802_sep (10); }
function icf_DB() { incPC(); cdp1802_sep (11); }
function icf_DC() { incPC(); cdp1802_sep (12); }
function icf_DD() { incPC(); cdp1802_sep (13); }
function icf_DE() { incPC(); cdp1802_sep (14); }
function icf_DF() { incPC(); cdp1802_sep (15); }

function icf_E0() { incPC(); cdp1802_sex (0); }
function icf_E1() { incPC(); cdp1802_sex (1); }
function icf_E2() { incPC(); cdp1802_sex (2); }
function icf_E3() { incPC(); cdp1802_sex (3); }
function icf_E4() { incPC(); cdp1802_sex (4); }
function icf_E5() { incPC(); cdp1802_sex (5); }
function icf_E6() { incPC(); cdp1802_sex (6); }
function icf_E7() { incPC(); cdp1802_sex (7); }
function icf_E8() { incPC(); cdp1802_sex (8); }
function icf_E9() { incPC(); cdp1802_sex (9); }
function icf_EA() { incPC(); cdp1802_sex (10); }
function icf_EB() { incPC(); cdp1802_sex (11); }
function icf_EC() { incPC(); cdp1802_sex (12); }
function icf_ED() { incPC(); cdp1802_sex (13); }
function icf_EE() { incPC(); cdp1802_sex (14); }
function icf_EF() { incPC(); cdp1802_sex (15); }

function icf_F0() { incPC(); cdp1802_ldx(); }
function icf_F1() { incPC(); cdp1802_or(); }
function icf_F2() { incPC(); cdp1802_and(); }
function icf_F3() { incPC(); cdp1802_xor(); }
function icf_F4() { incPC(); cdp1802_add(); }
function icf_F5() { incPC(); cdp1802_sd(); }
function icf_F6() { incPC(); cdp1802_shr(); }
function icf_F7() { incPC(); cdp1802_sm(); }
function icf_F8() { incPC(); cdp1802_ldi(); }
function icf_F9() { incPC(); cdp1802_ori(); }
function icf_FA() { incPC(); cdp1802_ani(); }
function icf_FB() { incPC(); cdp1802_xri(); }
function icf_FC() { incPC(); cdp1802_adi(); }
function icf_FD() { incPC(); cdp1802_sdi(); }
function icf_FE() { incPC(); cdp1802_shl(); }
function icf_FF() { incPC(); cdp1802_smi(); }


// code pages

var gaInstrCodeFunc = [
   icf_00, icf_01, icf_02, icf_03, icf_04, icf_05, icf_06, icf_07,
   icf_08, icf_09, icf_0A, icf_0B, icf_0C, icf_0D, icf_0E, icf_0F,
   icf_10, icf_11, icf_12, icf_13, icf_14, icf_15, icf_16, icf_17,
   icf_18, icf_19, icf_1A, icf_1B, icf_1C, icf_1D, icf_1E, icf_1F,
   icf_20, icf_21, icf_22, icf_23, icf_24, icf_25, icf_26, icf_27,
   icf_28, icf_29, icf_2A, icf_2B, icf_2C, icf_2D, icf_2E, icf_2F,
   icf_30, icf_31, icf_32, icf_33, icf_34, icf_35, icf_36, icf_37,
   icf_38, icf_39, icf_3A, icf_3B, icf_3C, icf_3D, icf_3E, icf_3F,
   icf_40, icf_41, icf_42, icf_43, icf_44, icf_45, icf_46, icf_47,
   icf_48, icf_49, icf_4A, icf_4B, icf_4C, icf_4D, icf_4E, icf_4F,
   icf_50, icf_51, icf_52, icf_53, icf_54, icf_55, icf_56, icf_57,
   icf_58, icf_59, icf_5A, icf_5B, icf_5C, icf_5D, icf_5E, icf_5F,
   icf_60, icf_61, icf_62, icf_63, icf_64, icf_65, icf_66, icf_67,
   icf_68, icf_69, icf_6A, icf_6B, icf_6C, icf_6D, icf_6E, icf_6F,
   icf_70, icf_71, icf_72, icf_73, icf_74, icf_75, icf_76, icf_77,
   icf_78, icf_79, icf_7A, icf_7B, icf_7C, icf_7D, icf_7E, icf_7F,
   icf_80, icf_81, icf_82, icf_83, icf_84, icf_85, icf_86, icf_87,
   icf_88, icf_89, icf_8A, icf_8B, icf_8C, icf_8D, icf_8E, icf_8F,
   icf_90, icf_91, icf_92, icf_93, icf_94, icf_95, icf_96, icf_97,
   icf_98, icf_99, icf_9A, icf_9B, icf_9C, icf_9D, icf_9E, icf_9F,
   icf_A0, icf_A1, icf_A2, icf_A3, icf_A4, icf_A5, icf_A6, icf_A7,
   icf_A8, icf_A9, icf_AA, icf_AB, icf_AC, icf_AD, icf_AE, icf_AF,
   icf_B0, icf_B1, icf_B2, icf_B3, icf_B4, icf_B5, icf_B6, icf_B7,
   icf_B8, icf_B9, icf_BA, icf_BB, icf_BC, icf_BD, icf_BE, icf_BF,
   icf_C0, icf_C1, icf_C2, icf_C3, icf_C4, icf_C5, icf_C6, icf_C7,
   icf_C8, icf_C9, icf_CA, icf_CB, icf_CC, icf_CD, icf_CE, icf_CF,
   icf_D0, icf_D1, icf_D2, icf_D3, icf_D4, icf_D5, icf_D6, icf_D7,
   icf_D8, icf_D9, icf_DA, icf_DB, icf_DC, icf_DD, icf_DE, icf_DF,
   icf_E0, icf_E1, icf_E2, icf_E3, icf_E4, icf_E5, icf_E6, icf_E7,
   icf_E8, icf_E9, icf_EA, icf_EB, icf_EC, icf_ED, icf_EE, icf_EF,
   icf_F0, icf_F1, icf_F2, icf_F3, icf_F4, icf_F5, icf_F6, icf_F7,
   icf_F8, icf_F9, icf_FA, icf_FB, icf_FC, icf_FD, icf_FE, icf_FF
];

var gnaCycles = [
   2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2,  // 00
   2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2,  // 10
   2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2,  // 20
   2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2,  // 30
   2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2,  // 40
   2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2,  // 50
   2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2,  // 60
   2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2,  // 70
   2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2,  // 80
   2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2,  // 90
   2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2,  // A0
   2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2,  // B0
   3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3,  // C0
   2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2,  // D0
   2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2,  // E0
   2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2   // F0
];


// main

function cpuLoop (pnCycleLimit, pnStartAddress)
{
   var nCPUCycles = 0;
   var nOpCode;

   gnInTemp = Math.random() * 255;
   gnInTemp = Math.round (gnInTemp);

   if (gbInFlag)  // via simelf.js
      gbaEFnFlag[4] = false;

   else
      gbaEFnFlag[4] = true;

   if (pnStartAddress >= 0)
      setPC (pnStartAddress);

   while (nCPUCycles < pnCycleLimit  &&  !gbDispFlag) {

      nOpCode = memoryRead (gconMEMRD_OPCODE);

      gaInstrCodeFunc[nOpCode]();
      nCPUCycles += gnaCycles[nOpCode];

      if (nOpCode == 0)  // IDL instruction is treated as a HALT
         return getPC();   // stop execution -- return memory address of Halt (+1)

   } // while

   return -1;  // call back for more execution
} // cpuLoop


function cpuReset()
{
   window.status = "1802 CPU Reset";

   gnD8bAccum = 0;   // ???
   gnDataBus = 0;
   gnN4bOpCodeLo = gnX4bRegIdx = gnP4bRegIdx = 0;
   gbIntEnable1bFlag = true;
   gbQ1bFlag = false;
   gbaEFnFlag[1] = gbaEFnFlag[2] = gbaEFnFlag[3] = gbaEFnFlag[4] = true;   // high pulled low
   gnaRegister16b[0] = 0;     // PC = 0
}


function regsClear()
{
   for(nRegN = 0;  nRegN < 16;  nRegN++)
      gnaRegister16b[nRegN] = 0;

   return;
} // regsClear


function ramClear()
{
   for(ii = 0;  ii < gnMemoryMaxRAM;  ii++)
      gnaMemoryRAM[ii] = 0;

   return;
} // ramClear


function registerCallbackOutput (pnPort, pfCallbackFunction)
{
   if (typeof (gfaOutputCallback[0]) == "undefined") {
      for (var nIdx = 0;  nIdx < 8;  ++nIdx)
         gfaOutputCallback[nIdx] = new Array();
   }

   gfaOutputCallback[pnPort & 0x7].push (pfCallbackFunction);

   return;
} // registerCallbackOutput


function registerCallbackInput (pnPort, pfCallbackFunction)
{
   if (typeof (gfaInputCallback[0]) == "undefined") {
      for (var nIdx = 0;  nIdx < 8;  ++nIdx)
         gfaInputCallback[nIdx] = new Array();
   }

   gfaInputCallback[pnPort & 0x7].push (pfCallbackFunction);

   return;
} // registerCallbackInput

// end of COSMAC CDP1802 simulator/emulator
/*
   1802 COSMAC Microprocessor Simulator Routines
   Originally based on the 6502 JavaScript emulator by N.Landsteiner
*/
/*
   COSMAC ELF-ish JavaScript Simulator (SimElf++ / COSMAC Elf^2)

   Enhanced program/system by William Donnelly circa May 2011
   http://www.donnelly-house.net/ -- whd1802 (at) donnelly-house.net
   http://www.donnelly-house.net/programming/cdp1802/
   Changes:
      Brightened switches and Hex LED display images (also made OFF and green LED versions)
      Added "COSMAC ELF" 'logo' text (image -- click for "About...")
      Cleaned up and streamlined JavaScript code and HTML specification
         cosmacelf.html, simelf.js, 1802cpu.js; created 1802programs.js; added 1802disasm.js
         Prefixed and renamed variable names
         Formatted code (whitespace, etc.)
         Changed from HTML Tables to Divs and changed FONT tags to SPAN
         Fixed several bugs and added speed enhancers
      Added memory dump and load form functionality and access via CDP1802 chip click
      Added mnemonic list functionality
      Added debugger window w/single step, breakpoint, etc.
      Offered ZIP archive so user can install and use it locally off-line
      Added "check for more recent update version" functionality

   This program is free software; you can redistribute it and/or modify
   it under the terms of the GNU General Public License as published by
   the Free Software Foundation; either version 3 of the License, or
   (at your option) any later version.

   Based on program/system by Maciej Szyc 2005, cosmac'at'szyc.org
   http://www.cosmac.szyc.org/
   Archived at: http://www.donnelly-house.net/programming/cdp1802/simelf/original/
   (note that this program has severe bugs)

   This program is free software; you can redistribute it and/or modify
   it under the terms of the GNU General Public License as published by
   the Free Software Foundation; either version 2 of the License, or
   (at your option) any later version.

   This program is distributed in the hope that it will be useful,
   but WITHOUT ANY WARRANTY; without even the implied warranty of
   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
   GNU General Public License for more details.
*/

// global constants

var gconMEMRD_OPCODE = -2;    // this value must be less than gconMEMRD_DATA  { memoryRead() }
var gconMEMRD_DATA = -1;      // this value and gconMEMRD_OPCODE must be < 0  { memoryRead() }

var gconMEM_USEPC = -1;      // use the PC as the address to store data, otherwise address  { memoryStore() }


// global values

var gbMemWriteFlag = true;    // memory write-able flag
var gnDataBus = 0;            // data bus value
var gnMemoryMaxRAM = 65536    // 65K      // 4608; // 4K   // 8192;    // 8K    // was 1024;   // 1K    // was 256;    // 256 bytes (1/4K)


// registers & memory

/*
   D  | 8 bits  | Data Register (Accumulator)
   DF | 1 bit   | Data Flag (ALU Carry)
   B  | 8 bits  | Auxiliary Holding Register
   R  | 16 bits | 1 of 16 Scratchpad Registers
   P  | 4 bits  | Designates which register is Program Counter
   X  | 4 bits  | Designates which register is Data Pointer
   N  | 4 bits  | Holds Low-Order Instruction Digit
   I  | 4 bits  | Holds High-Order Instruction Digit
   T  | 8 bits  | Holds old X, P after interrupt (X is high nibble)
   IE | 1 bit   | Interrupt Enable
   Q  | 1 bit   | Output Flip-Flop
*/

var   gnD8bAccum,          // D = 8-bit data register / accumulator
      gnB8bReg,            //    currently unused / not implemented (?)
      gnP4bRegIdx,         // P = 4-bit Program Counter register indicator
      gnX4bRegIdx,         // X = 4-bit RX register indicator
      gnN4bOpCodeLo,       // N = 4-bit register = Low order nybble of OpCode
      gnT8bRegIRQ;         // T = 8-bit (2 nybbles) register for IRQ (unused / not implemented)

      // gnI4bOpCodeHi

var   gbDataFlag1bCarry,   // DF = 1-bit Data Flag / ALU Carry (overflow / borrow)
      gbIntEnable1bFlag,   // IE = 1-bit Interrupt Enable flag (effectively unused / not implemented)
      gbQ1bFlag;           // Q = 1-bit output flag ('attached' to Q LED)

var   gbaEFnFlag = new Array (5);    // 1 - 4 (0 not used)

var   gnaRegister16b = new Array (16);  // 0 - 15

var   gnaMemoryRAM = new Array (gnMemoryMaxRAM);  // Memory array of bytes of RAM (maximum size set above)

var gfaOutputCallback = new Array(8);     // OUT opcode Callback Routines -- only 1 thru 7 are used
var gfaInputCallback = new Array(8);      // INP opcode Callback Routines -- only 1 thru 7 are used


// elf hardware
var gbDispFlag = false;
var gnInTemp;


// Extended debugging aids

var gbDebugMode = false;
var gnLastOpCodeAddress = 0;     // used to let the user know where the processor was before "now"
var gnLastGetAddress = 0;        // used to let the user know where the processor last accessed memory (get = load)
var gnLastPutAddress = 0;        // used to let the user know where the processor last accessed memory (put = store)


//General Functions


function getPC()
{
   return gnaRegister16b[gnP4bRegIdx] || 0;
} // getPC (Get Program Counter)


function setPC (pnData16)
{
   gnaRegister16b[gnP4bRegIdx] = (pnData16 & 0xFFFF);

   return;
} // setPC (Set Program Counter)


function incPC()
{
   gnaRegister16b[gnP4bRegIdx]++;
   gnaRegister16b[gnP4bRegIdx] &= 0xFFFF;

   return;
} // incPC (Increment Program Counter)


function memoryStore (pnData8, pnAddressMode)
{
   var nAddress;

   if (pnAddressMode == gconMEM_USEPC)    // -1 = use the Program Counter as the address
      nAddress = getPC();

   else
      nAddress = pnAddressMode & 0xFFFF;     // use passed in value as an address

   gnLastPutAddress = nAddress;   // save Last data Put Address (store)

if (gbDebugMode)
window.status = "Opcode: " + decToHex4 (gnLastOpCodeAddress) + " -- Data Get: " + decToHex4 (gnLastGetAddress) + " -- Data Store: " + decToHex4 
(gnLastPutAddress);

   if (nAddress >= 0  &&  nAddress < gnMemoryMaxRAM  &&  gbMemWriteFlag) {    // protect memory array from growing
      gnaMemoryRAM[nAddress] = pnData8 & 0xFF;
   }

   return;
} // memoryStore (Store data byte into memory via Program Counter)


function memoryRead (pnAddressMode)
{
   var nByte = 0xFF;    // default for out of bounds values
   var nAddress;

   if (pnAddressMode < 0)   // gconMEMRD_OPCODE or gconMEMRD_DATA
      nAddress = getPC();

   else
      nAddress = pnAddressMode & 0xFFFF;     // use passed in value as an address

   if (pnAddressMode == gconMEMRD_OPCODE)    // -2 = Get an OpCode
      gnLastOpCodeAddress = nAddress;        // save Last OpCode Address (versus data-get)

   if (pnAddressMode > gconMEMRD_OPCODE)     // -1 = Get "data" (immediate, memory address) or actual address
      gnLastGetAddress = nAddress;           // save Last data Get Address (versus opcode-get)

if (gbDebugMode)
window.status = "Opcode: " + decToHex4 (gnLastOpCodeAddress) + " -- Data Get: " + decToHex4 (gnLastGetAddress) + " -- Data Store: " + decToHex4 
(gnLastPutAddress);

   if (nAddress >= 0  &&  nAddress < gnMemoryMaxRAM) {    // keep memory references in bounds
      nByte = gnaMemoryRAM[nAddress] & 0xFF;
   }

   return nByte;
} // memoryRead (Retrieve next byte in memory via Program Counter or Address)


function memXRegStore (pnData8)
{
   var nAddress = gnaRegister16b[gnX4bRegIdx];

   gnLastPutAddress = nAddress;   // save Last data Put Address (store)

if (gbDebugMode)
window.status = "Opcode: " + decToHex4 (gnLastOpCodeAddress) + " -- Data Get: " + decToHex4 (gnLastGetAddress) + " -- Data Store: " + decToHex4 
(gnLastPutAddress);

   if (nAddress >= 0  &&  nAddress < gnMemoryMaxRAM  &&  gbMemWriteFlag) {    // protect memory array from growing
      gnaMemoryRAM[nAddress] = pnData8 & 0xFF;
   }

   return;
} // memXRegStore (Store data byte into memory via X Register)


function memXRegRead()
{
   var nAddress = gnaRegister16b[gnX4bRegIdx];
   var nByte = 0xFF;    // default for out of bounds values

   gnLastGetAddress = nAddress;   // save Last data Get Address (versus opcode-get)

if (gbDebugMode)
window.status = "Opcode: " + decToHex4 (gnLastOpCodeAddress) + " -- Data Get: " + decToHex4 (gnLastGetAddress) + " -- Data Store: " + decToHex4 
(gnLastPutAddress);

   if (nAddress >= 0  &&  nAddress < gnMemoryMaxRAM) {    // keep memory references in bounds
      nByte = gnaMemoryRAM[nAddress] & 0xFF;
   }

   return nByte;
} // memXRegRead (Retrieve next byte in memory via X Register)



// Register Operations


function incRegN (pnRegN)
{
   gnaRegister16b[pnRegN]++;
   gnaRegister16b[pnRegN] &= 0xFFFF;

   return;
} // incRegN (Increment Register N)


function decRegN (pnRegN)
{
   if (gnaRegister16b[pnRegN] == 0)
      gnaRegister16b[pnRegN] = 0xFFFF;

   else
      gnaRegister16b[pnRegN]--;

   return;
} // decRegN (Decrement Register N)


function incRegX()
{
   gnaRegister16b[gnX4bRegIdx]++;
   gnaRegister16b[gnX4bRegIdx] &= 0xFFFF;

   return;
} // incRegX (Increment Register X)


function getLoByte (pnRegN)
{
   gnD8bAccum = gnaRegister16b[pnRegN] & 0xFF;

   return;
} // getLoByte (Get Low Byte of Register N)


function getHiByte (pnRegN)
{
   gnD8bAccum = (gnaRegister16b[pnRegN] & 0xFF00) >> 8;

   return;
} // getHiByte (Get High Byte of Register N)


function putLoByte (pnRegN)
{
   gnaRegister16b[pnRegN] &= 0xFF00;
   gnaRegister16b[pnRegN] |= gnD8bAccum;

   return;
} // putLoByte (Store Low Byte of Register N)


function putHiByte (pnRegN)
{
   gnaRegister16b[pnRegN] = (gnD8bAccum * 256) | (gnaRegister16b[pnRegN] & 0xFF);

   return;
} // putHiByte (Store High Byte of Register N)



// Memory Reference


function loadRegN (pnRegN)
{
   gnD8bAccum = memoryRead (gnaRegister16b[pnRegN]);

   return;
} // loadRegN (LDN = Load Accumulator (D Reg) via Register N)


function loadAccumRegN (pnRegN) {
   gnD8bAccum = memoryRead (gnaRegister16b[pnRegN]);
   gnaRegister16b[pnRegN]++;
   gnaRegister16b[pnRegN] &= 0xFFFF;

   return;
} // loadAccumRegN (LDA = Load Accumulator (D Reg) via Register N and Advance (Increment Reg N))


function cdp1802_ldx()
{
   gnD8bAccum = memXRegRead();

   return;
} // cdp1802_ldx (Load Accumulator (D Reg) via Register X)


function cdp1802_ldxa()
{
   gnD8bAccum = memXRegRead();
   gnaRegister16b[gnX4bRegIdx]++;
   gnaRegister16b[gnX4bRegIdx] &= 0xFFFF

   return;
} // cdp1802_ldxa (Load Accumulator (D Reg) via Register X and Advance (Increment Reg X))


function cdp1802_ldi()
{
   gnD8bAccum = memoryRead (gconMEMRD_DATA);
   incPC();

   return;
} // cdp1802_ldi (Load Accumulator (D Reg) Immediate)


function storeAccumRegN (pnRegN)
{
   memoryStore (gnD8bAccum, gnaRegister16b[pnRegN]);

   return;
} // storeAccumRegN (STR = Store Accumulator (D Reg) via Register N)


function cdp1802_stxd()
{
   memXRegStore (gnD8bAccum);

   if (gnaRegister16b[gnX4bRegIdx] == 0)
      gnaRegister16b[gnX4bRegIdx] = 0xFFFF;

   else
      gnaRegister16b[gnX4bRegIdx]--;

   return;
} // cdp1802_stxd (Store Accumulator (D Reg) via Register X and Decrement (Reg X))



// Logic Operations


function cdp1802_or()
{
   gnD8bAccum |= memXRegRead();

   return;
} // cdp1802_or (OR memory byte via X Reg with Accumulator (D Reg))


function cdp1802_ori()
{
   gnD8bAccum |= memoryRead (gconMEMRD_DATA);
   incPC();

   return;
} // cdp1802_ori (OR Immediate (next byte) with Accumulator (D Reg))


function cdp1802_xor()
{
   gnD8bAccum ^= memXRegRead();

   return;
} // cdp1802_xor (XOR (Exclusive OR) memory byte via X Reg with Accumulator (D Reg))


function cdp1802_xri()
{
   gnD8bAccum ^= memoryRead (gconMEMRD_DATA);
   incPC();

   return;
} // cdp1802_xri (XOR Immediate (Exclusive OR next byte) with Accumulator (D Reg))


function cdp1802_and()
{
   gnD8bAccum &= memXRegRead();

   return;
} // cdp1802_and (AND memory byte via X Reg with Accumulator (D Reg))


function cdp1802_ani()
{
   gnD8bAccum &= memoryRead (gconMEMRD_DATA);
   incPC();

   return;
} // cdp1802_ani (AND Immediate (next byte) with Accumulator (D Reg))


function cdp1802_shr()
{
   if(gnD8bAccum & 1)
      gbDataFlag1bCarry = true;

   else
      gbDataFlag1bCarry = false;

   gnD8bAccum = gnD8bAccum >> 1;
   gnD8bAccum &= 0x7F;

   return;
} // cdp1802_shr (Shift Right)


function cdp1802_rshr()
{
   var bFlag = gbDataFlag1bCarry;

   if (gnD8bAccum & 1)
      gbDataFlag1bCarry = true;

   else
      gbDataFlag1bCarry = false;

   gnD8bAccum = gnD8bAccum >> 1;
   gnD8bAccum &= 0x7F;

   if (bFlag)
      gnD8bAccum |= 0x80;

   return;
} // cdp1802_rshr (Rotate Shift Right)


function cdp1802_shl()
{
   if (gnD8bAccum & 0x80)
      gbDataFlag1bCarry = true;

   else
      gbDataFlag1bCarry = false;

   gnD8bAccum = gnD8bAccum << 1;
   gnD8bAccum &= 0xFE;

   return;
} // cdp1802_shl (Shift Left)


function cdp1802_rshl() {
   var bFlag = gbDataFlag1bCarry;

   if (gnD8bAccum & 0x80)
      gbDataFlag1bCarry = true;

   else
      gbDataFlag1bCarry = false;

   gnD8bAccum = gnD8bAccum << 1;
   gnD8bAccum &= 0xFE;

   if (bFlag)
      gnD8bAccum |= 1;

   return;
} // cdp1802_rshl (Rotate Shift Left)



// Aritmetic Operations


function cdp1802_add()
{
   gnD8bAccum += memXRegRead();

   if (gnD8bAccum > 0xFF)
      gbDataFlag1bCarry = true;

   else
      gbDataFlag1bCarry = false;

   gnD8bAccum &= 0xFF;

   return;
} // cdp1802_add (Add memory byte via X Reg to Accumulator (D Reg))


function cdp1802_adi()
{
   gnD8bAccum += memoryRead (gconMEMRD_DATA);

   if (gnD8bAccum > 0xFF)
      gbDataFlag1bCarry = true;

   else
      gbDataFlag1bCarry = false;

   gnD8bAccum &= 0xFF;
   incPC();

   return;
} // cdp1802_add (Add Immediate (next byte) to Accumulator (D Reg))


function cdp1802_adc()
{
   gnD8bAccum += memXRegRead();
   gnD8bAccum += gbDataFlag1bCarry;

   if (gnD8bAccum > 0xFF)
      gbDataFlag1bCarry = true;

   else
      gbDataFlag1bCarry = false;

   gnD8bAccum &= 0xFF;

   return;
} // cdp1802_adc (Add memory byte via X Reg plus carry to Accumulator (D Reg))


function cdp1802_adci()
{
   gnD8bAccum += memoryRead (gconMEMRD_DATA);
   gnD8bAccum += gbDataFlag1bCarry;

   if (gnD8bAccum > 0xFF)
      gbDataFlag1bCarry = true;

   else
      gbDataFlag1bCarry = false;

   gnD8bAccum &= 0xFF;
   incPC();

   return;
} // cdp1802_add (Add Immediate (next byte) plus carry to Accumulator (D Reg))


function cdp1802_sd()
{
   gnD8bAccum = memXRegRead() + (0xFF - gnD8bAccum) + 1;

   if (gnD8bAccum > 0xFF)
      gbDataFlag1bCarry = true;     // no borrow

   else
      gbDataFlag1bCarry = false;    // borrow

   gnD8bAccum &= 0xFF;

   return;
} // cdp1802_sd (Subtract Accumulator (D Reg) from memory byte via X Reg)


function cdp1802_sdi() {
   gnD8bAccum = memoryRead (gconMEMRD_DATA) + (0xFF - gnD8bAccum) + 1;

   if (gnD8bAccum > 0xFF)
      gbDataFlag1bCarry = true;     // no borrow

   else
      gbDataFlag1bCarry = false;    // borrow

   gnD8bAccum &= 0xFF;
   incPC();

   return;
} // cdp1802_sd (Subtract Accumulator (D Reg) from Immediate (next byte))


function cdp1802_sdb()
{
   gnD8bAccum = memXRegRead() + (0xFF - gnD8bAccum) + 1;
   // gnD8bAccum += (0xFF - memXRegRead());      // bug error?

   if (!gbDataFlag1bCarry)
      gnD8bAccum--;           // subtract borrow, which is NOT (DF)

   if (gnD8bAccum > 0xFF)
      gbDataFlag1bCarry = true;     // no borrow

   else
      gbDataFlag1bCarry = false;    // borrow

   gnD8bAccum &= 0xFF;

   return;
} // cdp1802_sd (Subtract Accumulator (D Reg) with borrow from memory byte via X Reg)


function cdp1802_sdbi()
{
   gnD8bAccum = memoryRead (gconMEMRD_DATA) + (0xFF - gnD8bAccum) + 1;

   if (!gbDataFlag1bCarry)
      gnD8bAccum--;           // subtract borrow, which is NOT (DF)

   if (gnD8bAccum > 0xFF)
      gbDataFlag1bCarry = true;     // no borrow

   else
      gbDataFlag1bCarry = false;    // borrow

   gnD8bAccum &= 0xFF;
   incPC();

   return;
} // cdp1802_sd (Subtract Accumulator (D Reg) with borrow from Immediate (next byte))


function cdp1802_sm()
{
   gnD8bAccum = gnD8bAccum + (0xFF - memXRegRead()) + 1;

   if (gnD8bAccum > 0xFF)
      gbDataFlag1bCarry = true;     // no borrow

   else
      gbDataFlag1bCarry = false;    // borrow

   gnD8bAccum &= 0xFF;

   return;
} // cdp1802_sd (Subtract memory byte via X Reg from Accumulator (D Reg))


function cdp1802_smi()
{
   gnD8bAccum = gnD8bAccum + (0xFF - memoryRead (gconMEMRD_DATA)) + 1;

   if (gnD8bAccum > 0xFF)
      gbDataFlag1bCarry = true;     // no borrow

   else
      gbDataFlag1bCarry = false;    // borrow

   gnD8bAccum &= 0xFF;
   incPC();

   return;
} // cdp1802_sd (Subtract Immediate (next byte) from Accumulator (D Reg))


function cdp1802_smb()
{
   gnD8bAccum = gnD8bAccum + (0xFF - memXRegRead()) + 1;

   if (!gbDataFlag1bCarry)
      gnD8bAccum--;           // subtract borrow, which is NOT (DF)

   if (gnD8bAccum > 0xFF)
      gbDataFlag1bCarry = true;     // no borrow

   else
      gbDataFlag1bCarry = false;    // borrow

   gnD8bAccum &= 0xFF;

   return;
} // cdp1802_sd (Subtract memory byte via X Reg with borrow from Accumulator (D Reg))


function cdp1802_smbi()
{
   gnD8bAccum = gnD8bAccum + (0xFF - memoryRead (gconMEMRD_DATA)) + 1;

   if (!gbDataFlag1bCarry)
      gnD8bAccum--;           // subtract borrow, which is NOT (DF)

   if (gnD8bAccum > 0xFF)
      gbDataFlag1bCarry = true;     // no borrow

   else
      gbDataFlag1bCarry = false;    // borrow

   gnD8bAccum &= 0xFF;
   incPC();

   return;
} // cdp1802_sd (Subtract Immediate (next byte) with borrow from Accumulator (D Reg))



// Branching


function cdp1802_br()
{
   var nAddress = (getPC() & 0xFF00);
   nAddress |= memoryRead (gconMEMRD_DATA);
   setPC (nAddress);

   return;
} // cdp1802_br (Page branch -- unconditional)


function cdp1802_bz()
{
   if (gnD8bAccum == 0) {
      var nAddress = (getPC() & 0xFF00);
      nAddress |= memoryRead (gconMEMRD_DATA);
      setPC (nAddress);

   } else
      incPC();

   return;
} // cdp1802_bz (Page Branch if Accumulator (D Reg) is zero)


function cdp1802_bnz()
{
   if (gnD8bAccum != 0) {
      var nAddress = (getPC() & 0xFF00);
      nAddress |= memoryRead (gconMEMRD_DATA);
      setPC (nAddress);

   } else
      incPC();

   return;
} // cdp1802_bnz (Page Branch if Accumulator (D Reg) is not zero)


function cdp1802_bdf()
{
   if (gbDataFlag1bCarry) {
      var nAddress = (getPC() & 0xFF00);
      nAddress |= memoryRead (gconMEMRD_DATA);
      setPC (nAddress);

   } else
      incPC();

   return;
} // cdp1802_bdf (Page Branch if Data Flag is set) = (Carry / No Borrow)


function cdp1802_bnf()
{
   if (!gbDataFlag1bCarry) {
      var nAddress = (getPC() & 0xFF00);
      nAddress |= memoryRead (gconMEMRD_DATA);
      setPC (nAddress);

   } else
      incPC();

   return;
} // cdp1802_bnf (Page Branch if Data Flag is clear) = (No Carry / Borrow)


function cdp1802_bq()
{
   if (gbQ1bFlag) {
      var nAddress = (getPC() & 0xFF00);
      nAddress |= memoryRead (gconMEMRD_DATA);
      setPC (nAddress);

   } else
      incPC();

   return;
} // cdp1802_bq (Page Branch if Q Flag is set)


function cdp1802_bnq()
{
   if (!gbQ1bFlag) {
      var nAddress = (getPC() & 0xFF00);
      nAddress |= memoryRead (gconMEMRD_DATA);
      setPC (nAddress);

   } else
      incPC();

   return;
} // cdp1802_bnq (Page Branch if Q Flag is clear)


function cdp1802_b1()
{
   if (gbaEFnFlag[1]) {
      var nAddress = (getPC() & 0xFF00);
      nAddress |= memoryRead (gconMEMRD_DATA);
      setPC (nAddress);

   } else
      incPC()

   return;
} // cdp1802_b1 (Page Branch if EF1 Flag is set)


function cdp1802_bn1()
{
   if (!gbaEFnFlag[1]) {
      var nAddress = (getPC() & 0xFF00);
      nAddress |= memoryRead (gconMEMRD_DATA);
      setPC (nAddress);

   } else
      incPC();

   return;
} // cdp1802_bn1 (Page Branch if EF1 Flag is clear)


function cdp1802_b2()
{
   if (gbaEFnFlag[2]) {
      var nAddress = (getPC() & 0xFF00);
      nAddress |= memoryRead (gconMEMRD_DATA);
      setPC (nAddress);

   } else
      incPC();

   return;
} // cdp1802_b2 (Page Branch if EF2 Flag is set)


function cdp1802_bn2()
{
   if (!gbaEFnFlag[2]) {
      var nAddress = (getPC() & 0xFF00);
      nAddress |= memoryRead (gconMEMRD_DATA);
      setPC (nAddress);

   } else
      incPC();

   return;
} // cdp1802_bn2 (Page Branch if EF2 Flag is clear)


function cdp1802_b3()
{
   if (gbaEFnFlag[3]) {
      var nAddress = (getPC() & 0xFF00);
      nAddress |= memoryRead (gconMEMRD_DATA);
      setPC (nAddress);

   } else
      incPC();

   return;
} // cdp1802_b3 (Page Branch if EF3 Flag is set)


function cdp1802_bn3()
{
   if (!gbaEFnFlag[3]) {
      var nAddress = (getPC() & 0xFF00);
      nAddress |= memoryRead (gconMEMRD_DATA);
      setPC (nAddress);

   } else
      incPC();

   return;
} // cdp1802_bn3 (Page Branch if EF3 Flag is clear)


function cdp1802_b4()
{
   if (gbaEFnFlag[4]) {
      var nAddress = (getPC() & 0xFF00);
      nAddress |= memoryRead (gconMEMRD_DATA);
      setPC (nAddress);

   } else
      incPC();

   return;
} // cdp1802_b4 (Page Branch if EF4 Flag is set)


function cdp1802_bn4()
{
   if (!gbaEFnFlag[4] & gnInTemp) {
      gnInTemp--;
      var nAddress = (getPC() & 0xFF00);
      nAddress |= memoryRead (gconMEMRD_DATA);
      setPC (nAddress);

   } else
      incPC();

   return;
} // cdp1802_bn4 (Page Branch if EF4 Flag is clear)


function cdp1802_lbr()
{
   var nAddress = 256 * memoryRead (gconMEMRD_DATA);
   incPC();
   nAddress |= memoryRead (gconMEMRD_DATA);
   setPC (nAddress);

   return;
} // cdp1802_bz (Long Branch -- unconditional)


function cdp1802_lbz()
{
   if (gnD8bAccum == 0) {
      var nAddress = 256 * memoryRead (gconMEMRD_DATA);
      incPC();
      nAddress |= memoryRead (gconMEMRD_DATA);
      setPC (nAddress);

   } else {
      incPC();
      incPC();
   }

   return;
} // cdp1802_lbz (Long Branch if Accumulator (D Reg) is zero)


function cdp1802_lbnz()
{
   if (gnD8bAccum != 0) {
      var nAddress = 256 * memoryRead (gconMEMRD_DATA);
      incPC();
      nAddress |= memoryRead (gconMEMRD_DATA);
      setPC (nAddress);

   } else {
      incPC();
      incPC();
   }

   return;
} // cdp1802_lbnz (Long Branch if Accumulator (D Reg) is not zero)


function cdp1802_lbdf()
{
   if (gbDataFlag1bCarry) {
      var nAddress = 256 * memoryRead (gconMEMRD_DATA);
      incPC();
      nAddress |= memoryRead (gconMEMRD_DATA);
      setPC (nAddress);

   } else {
      incPC();
      incPC();
   }

   return;
} // cdp1802_lbdf (Long Branch if Data Flag is set) = (Carry / No Borrow)


function cdp1802_lbnf()
{
   if (!gbDataFlag1bCarry) {
      var nAddress = 256 * memoryRead (gconMEMRD_DATA);
      incPC();
      nAddress |= memoryRead (gconMEMRD_DATA);
      setPC (nAddress);

   } else {
      incPC();
      incPC();
   }

   return;
} // cdp1802_lbnf (Long Branch if Data Flag is clear) = (No Carry / Borrow)


function cdp1802_lbq()
{
   if (gbQ1bFlag) {
      var nAddress = 256 * memoryRead (gconMEMRD_DATA);
      incPC();
      nAddress |= memoryRead (gconMEMRD_DATA);
      setPC (nAddress);

   } else {
      incPC();
      incPC();
   }

   return;
} // cdp1802_lbq (Long Branch if Q Flag is set)


function cdp1802_lbnq()
{
   if (!gbQ1bFlag) {
      var nAddress = 256 * memoryRead (gconMEMRD_DATA);
      incPC();
      nAddress |= memoryRead (gconMEMRD_DATA);
      setPC (nAddress);

   } else {
      incPC();
      incPC();
   }

   return;
} // cdp1802_lbq (Long Branch if Q Flag is clear)



// Skip instructions


function cdp1802_lsz()
{
   if (gnD8bAccum == 0) {
      incPC();
      incPC();
   }

   return;
} // cdp1802_lsz (Long Skip if Accumulator (D Reg) is zero)


function cdp1802_lsnz()
{
   if (gnD8bAccum != 0) {
      incPC();
      incPC();
   }

   return;
} // cdp1802_lsnz (Long Skip if Accumulator (D Reg) is not zero)


function cdp1802_lsdf()
{
   if (gbDataFlag1bCarry) {
      incPC();
      incPC();
   }

   return;
} // cdp1802_lsdf (Long Skip if Data Flag is set) = (Carry / No Borrow)


function cdp1802_lsnf()
{
   if (!gbDataFlag1bCarry) {
      incPC();
      incPC();
   }

   return;
} // cdp1802_lbdf (Long Skip if Data Flag is clear) = (No Carry / Borrow)


function cdp1802_lsq()
{
   if (gbQ1bFlag) {
      incPC();
      incPC();
   }

   return;
} // cdp1802_lsq (Long Skip if Q Flag is set)


function cdp1802_lsnq()
{
   if (!gbQ1bFlag) {
      incPC();
      incPC();
   }

   return;
} // cdp1802_lsnq (Long Skip if Q Flag is clear)


function cdp1802_lsie()
{
   if (gbIntEnable1bFlag) {
      incPC();
      incPC();
   }

   return;
} // cdp1802_lsie (Long Skip if Interrupts are Enabled)



// Control instructions


function cdp1802_sep (pnRegN)
{
   gnN4bOpCodeLo = pnRegN;
   gnP4bRegIdx = gnN4bOpCodeLo;

   return;
} // cdp1802_sep (Set Index for Program Counter as Register N)


function cdp1802_sex (pnRegN)
{
   gnN4bOpCodeLo = pnRegN;
   gnX4bRegIdx = gnN4bOpCodeLo;

   return;
} // cdp1802_sep (Set Index for Register X as Register N)



// Input/Output Byte Tranfer


function cdp1802_out (pnPortK)
{
   var nData8b;
   var nCallbackCount = 0;

   gnDataBus = memXRegRead();

   if (pnPortK == 4) {
      gnDispData = gnDataBus;  // via simelf.js (hex LED displays)
      gbDispFlag = true;
   }  // elf hardware

   nCallbackCount = gfaOutputCallback[pnPortK].length;

   if (nCallbackCount > 0) {  // if there are callback functions, call each one and xfer data
      for (var nIdx = 0;  nIdx < nCallbackCount;  ++nIdx) {

         gfaOutputCallback[pnPortK][nIdx](gnDataBus);

      } // for
   }

   gnaRegister16b[gnX4bRegIdx]++;
   gnaRegister16b[gnX4bRegIdx] &= 0xFFFF;

   return;
} // cdp1802_out


function cdp1802_inp (pnPortK)
{
   var nData8b = -1;
   var nCallbackCount = 0;

   // gnDataBus = Math.floor (Math.random() * 256);   // default to random value (?)
   gnDataBus = 0;    // default to zero?

   if (pnPortK == 4) {
      gnDataBus = gnInData;   // via simelf.js (8 toggle switches)
   }  // elf hardware

   nCallbackCount = gfaInputCallback[pnPortK].length;

   if (nCallbackCount > 0) {  // if there are callback functions, call each one and return first found
      for (var nIdx = 0;  nIdx < nCallbackCount;  ++nIdx) {

         nData8b = gfaInputCallback[pnPortK][nIdx]();

         if (typeof (nData8b) != "undefined"  &&  nData8b !== null  &&  nData8b !== false)
            nIdx = nCallbackCount;  // stop checking when first data byte found

      } // for
   }

   if (typeof (nData8b) != "undefined"  &&  nData8b !== null  &&  nData8b !== false  &&  nData8b !== -1)
      gnDataBus = nData8b & 0xFF;

   memXRegStore (gnDataBus);     // store data bus value into memory via Regster X
   gnD8bAccum = gnDataBus;    // store data bus value into Accumulator (D Reg)
//if(pnPortK==6)window.status=gnDataBus+" "+window.status.substr (0, 100);
   return;
} // cdp1802_inp


function cdp1802_dis()
{
   var nNewXP = memXRegRead() & 0xFF;

   var nXnybble = nNewXP >> 4;
   var nPnybble = nNewXP & 0x0F;

   gnX4bRegIdx = nXnybble;    // set new X register
   gnP4bRegIdx = nPnybble;    // set new P register (PC = Program Counter)

   gnaRegister16b[gnX4bRegIdx]++;
   gbIntEnable1bFlag = false;

   return;
} // cdp1802_dis -- DIS M(R(X)) => (X,P); R(X)+1; 0 => IE --- Return w/ Interrupt disabled


function cdp1802_ret()
{
   var nNewXP = memXRegRead() & 0xFF;

   var nXnybble = nNewXP >> 4;
   var nPnybble = nNewXP & 0x0F;

   gnX4bRegIdx = nXnybble;    // set new X register
   gnP4bRegIdx = nPnybble;    // set new P register (PC = Program Counter)

   gnaRegister16b[gnX4bRegIdx]++;
   gbIntEnable1bFlag = true;

   return;
} // cdp1802_ret -- RET M(R(X)) => (X,P); R(X)+1; 1 => IE --- Return w/ Interrupt enabled



// Instruction Code Functions


function icf_00() { incPC(); }    // IDL -- not implemented here, so NOP
/*
   IDLE = Wait for DMA Or Interrupt; M(R(0)) => Bus
   In Idle mode, the microprocessor repeats executing (S1) cycles until
   an I/O request is asserted (INTERRUPT, DMA-IN, or DMA-OUT are pulled low).
   When the request is acknowledged, the IDLE cycle is terminated and the
   I/O request is serviced, whereupon normal operation is resumed.
   Note: Perhaps this should be implemented as a "Pause" / "Halt" instruction.
   It could be effectively used as a Breakpoint, in this manner.
*/

function icf_01() { incPC(); loadRegN (1); }
function icf_02() { incPC(); loadRegN (2); }
function icf_03() { incPC(); loadRegN (3); }
function icf_04() { incPC(); loadRegN (4); }
function icf_05() { incPC(); loadRegN (5); }
function icf_06() { incPC(); loadRegN (6); }
function icf_07() { incPC(); loadRegN (7); }
function icf_08() { incPC(); loadRegN (8); }
function icf_09() { incPC(); loadRegN (9); }
function icf_0A() { incPC(); loadRegN (10); }
function icf_0B() { incPC(); loadRegN (11); }
function icf_0C() { incPC(); loadRegN (12); }
function icf_0D() { incPC(); loadRegN (13); }
function icf_0E() { incPC(); loadRegN (14); }
function icf_0F() { incPC(); loadRegN (15); }

function icf_10() { incPC(); incRegN (0); }
function icf_11() { incPC(); incRegN (1); }
function icf_12() { incPC(); incRegN (2); }
function icf_13() { incPC(); incRegN (3); }
function icf_14() { incPC(); incRegN (4); }
function icf_15() { incPC(); incRegN (5); }
function icf_16() { incPC(); incRegN (6); }
function icf_17() { incPC(); incRegN (7); }
function icf_18() { incPC(); incRegN (8); }
function icf_19() { incPC(); incRegN (9); }
function icf_1A() { incPC(); incRegN (10); }
function icf_1B() { incPC(); incRegN (11); }
function icf_1C() { incPC(); incRegN (12); }
function icf_1D() { incPC(); incRegN (13); }
function icf_1E() { incPC(); incRegN (14); }
function icf_1F() { incPC(); incRegN (15); }

function icf_20() { incPC(); decRegN (0); }
function icf_21() { incPC(); decRegN (1); }
function icf_22() { incPC(); decRegN (2); }
function icf_23() { incPC(); decRegN (3); }
function icf_24() { incPC(); decRegN (4); }
function icf_25() { incPC(); decRegN (5); }
function icf_26() { incPC(); decRegN (6); }
function icf_27() { incPC(); decRegN (7); }
function icf_28() { incPC(); decRegN (8); }
function icf_29() { incPC(); decRegN (9); }
function icf_2A() { incPC(); decRegN (10); }
function icf_2B() { incPC(); decRegN (11); }
function icf_2C() { incPC(); decRegN (12); }
function icf_2D() { incPC(); decRegN (13); }
function icf_2E() { incPC(); decRegN (14); }
function icf_2F() { incPC(); decRegN (15); }

function icf_30() { incPC(); cdp1802_br(); }
function icf_31() { incPC(); cdp1802_bq(); }
function icf_32() { incPC(); cdp1802_bz(); }
function icf_33() { incPC(); cdp1802_bdf(); }
function icf_34() { incPC(); cdp1802_b1(); }
function icf_35() { incPC(); cdp1802_b2(); }
function icf_36() { incPC(); cdp1802_b3(); }
function icf_37() { incPC(); cdp1802_b4(); }
function icf_38() { incPC(); }                   // SKP or NBR (short = 1 byte)
function icf_39() { incPC(); cdp1802_bnq(); }
function icf_3A() { incPC(); cdp1802_bnz(); }
function icf_3B() { incPC(); cdp1802_bnf(); }
function icf_3C() { incPC(); cdp1802_bn1(); }
function icf_3D() { incPC(); cdp1802_bn2(); }
function icf_3E() { incPC(); cdp1802_bn3(); }
function icf_3F() { incPC(); cdp1802_bn4(); }

function icf_40() { incPC(); loadAccumRegN (0); }
function icf_41() { incPC(); loadAccumRegN (1); }
function icf_42() { incPC(); loadAccumRegN (2); }
function icf_43() { incPC(); loadAccumRegN (3); }
function icf_44() { incPC(); loadAccumRegN (4); }
function icf_45() { incPC(); loadAccumRegN (5); }
function icf_46() { incPC(); loadAccumRegN (6); }
function icf_47() { incPC(); loadAccumRegN (7); }
function icf_48() { incPC(); loadAccumRegN (8); }
function icf_49() { incPC(); loadAccumRegN (9); }
function icf_4A() { incPC(); loadAccumRegN (10); }
function icf_4B() { incPC(); loadAccumRegN (11); }
function icf_4C() { incPC(); loadAccumRegN (12); }
function icf_4D() { incPC(); loadAccumRegN (13); }
function icf_4E() { incPC(); loadAccumRegN (14); }
function icf_4F() { incPC(); loadAccumRegN (15); }

function icf_50() { incPC(); storeAccumRegN (0); }
function icf_51() { incPC(); storeAccumRegN (1); }
function icf_52() { incPC(); storeAccumRegN (2); }
function icf_53() { incPC(); storeAccumRegN (3); }
function icf_54() { incPC(); storeAccumRegN (4); }
function icf_55() { incPC(); storeAccumRegN (5); }
function icf_56() { incPC(); storeAccumRegN (6); }
function icf_57() { incPC(); storeAccumRegN (7); }
function icf_58() { incPC(); storeAccumRegN (8); }
function icf_59() { incPC(); storeAccumRegN (9); }
function icf_5A() { incPC(); storeAccumRegN (10); }
function icf_5B() { incPC(); storeAccumRegN (11); }
function icf_5C() { incPC(); storeAccumRegN (12); }
function icf_5D() { incPC(); storeAccumRegN (13); }
function icf_5E() { incPC(); storeAccumRegN (14); }
function icf_5F() { incPC(); storeAccumRegN (15); }

function icf_60() { incPC(); incRegX(); }
function icf_61() { incPC(); cdp1802_out (1); }
function icf_62() { incPC(); cdp1802_out (2); }
function icf_63() { incPC(); cdp1802_out (3); }
function icf_64() { incPC(); cdp1802_out (4); }
function icf_65() { incPC(); cdp1802_out (5); }
function icf_66() { incPC(); cdp1802_out (6); }
function icf_67() { incPC(); cdp1802_out (7); }
function icf_68() { incPC(); }                   // effectively, or actually, undefined --- so, NOP? (or input random #?)
function icf_69() { incPC(); cdp1802_inp (1); }
function icf_6A() { incPC(); cdp1802_inp (2); }
function icf_6B() { incPC(); cdp1802_inp (3); }
function icf_6C() { incPC(); cdp1802_inp (4); }
function icf_6D() { incPC(); cdp1802_inp (5); }
function icf_6E() { incPC(); cdp1802_inp (6); }
function icf_6F() { incPC(); cdp1802_inp (7); }

function icf_70() { incPC(); cdp1802_ret(); }    
function icf_71() { incPC(); cdp1802_dis(); }
function icf_72() { incPC(); cdp1802_ldxa(); }
function icf_73() { incPC(); cdp1802_stxd(); }
function icf_74() { incPC(); cdp1802_adc(); }
function icf_75() { incPC(); cdp1802_sdb(); }
function icf_76() { incPC(); cdp1802_rshr(); }
function icf_77() { incPC(); cdp1802_smb(); }

function icf_78() { incPC();                       // SAV (not implemented! T => M(R(X)) --- Interrupt usage
   alert ("WARNING! Unsupported instruction: 78h SAV at " + decToHex4 (getPC() - 1)); }
function icf_79() { incPC();                       // MARK (not implemented! (X,P) => T; (X,P) => M(R(2)); Then P => X; R(2)-1 --- Interrupt usage
   alert ("WARNING! Unsupported instruction: 79h MARK at " + decToHex4 (getPC() - 1)); }

function icf_7A() { incPC(); gbQ1bFlag = false; gbDispFlag = true; }
function icf_7B() { incPC(); gbQ1bFlag = true;  gbDispFlag = true; }
function icf_7C() { incPC(); cdp1802_adci(); }
function icf_7D() { incPC(); cdp1802_sdbi(); }
function icf_7E() { incPC(); cdp1802_rshl(); }
function icf_7F() { incPC(); cdp1802_smbi(); }

function icf_80() { incPC(); getLoByte (0); }
function icf_81() { incPC(); getLoByte (1); }
function icf_82() { incPC(); getLoByte (2); }
function icf_83() { incPC(); getLoByte (3); }
function icf_84() { incPC(); getLoByte (4); }
function icf_85() { incPC(); getLoByte (5); }
function icf_86() { incPC(); getLoByte (6); }
function icf_87() { incPC(); getLoByte (7); }
function icf_88() { incPC(); getLoByte (8); }
function icf_89() { incPC(); getLoByte (9); }
function icf_8A() { incPC(); getLoByte (10); }
function icf_8B() { incPC(); getLoByte (11); }
function icf_8C() { incPC(); getLoByte (12); }
function icf_8D() { incPC(); getLoByte (13); }
function icf_8E() { incPC(); getLoByte (14); }
function icf_8F() { incPC(); getLoByte (15); }

function icf_90() { incPC(); getHiByte (0); }
function icf_91() { incPC(); getHiByte (1); }
function icf_92() { incPC(); getHiByte (2); }
function icf_93() { incPC(); getHiByte (3); }
function icf_94() { incPC(); getHiByte (4); }
function icf_95() { incPC(); getHiByte (5); }
function icf_96() { incPC(); getHiByte (6); }
function icf_97() { incPC(); getHiByte (7); }
function icf_98() { incPC(); getHiByte (8); }
function icf_99() { incPC(); getHiByte (9); }
function icf_9A() { incPC(); getHiByte (10); }
function icf_9B() { incPC(); getHiByte (11); }
function icf_9C() { incPC(); getHiByte (12); }
function icf_9D() { incPC(); getHiByte (13); }
function icf_9E() { incPC(); getHiByte (14); }
function icf_9F() { incPC(); getHiByte (15); }

function icf_A0() { incPC(); putLoByte (0); }
function icf_A1() { incPC(); putLoByte (1); }
function icf_A2() { incPC(); putLoByte (2); }
function icf_A3() { incPC(); putLoByte (3); }
function icf_A4() { incPC(); putLoByte (4); }
function icf_A5() { incPC(); putLoByte (5); }
function icf_A6() { incPC(); putLoByte (6); }
function icf_A7() { incPC(); putLoByte (7); }
function icf_A8() { incPC(); putLoByte (8); }
function icf_A9() { incPC(); putLoByte (9); }
function icf_AA() { incPC(); putLoByte (10); }
function icf_AB() { incPC(); putLoByte (11); }
function icf_AC() { incPC(); putLoByte (12); }
function icf_AD() { incPC(); putLoByte (13); }
function icf_AE() { incPC(); putLoByte (14); }
function icf_AF() { incPC(); putLoByte (15); }

function icf_B0() { incPC(); putHiByte (0); }
function icf_B1() { incPC(); putHiByte (1); }
function icf_B2() { incPC(); putHiByte (2); }
function icf_B3() { incPC(); putHiByte (3); }
function icf_B4() { incPC(); putHiByte (4); }
function icf_B5() { incPC(); putHiByte (5); }
function icf_B6() { incPC(); putHiByte (6); }
function icf_B7() { incPC(); putHiByte (7); }
function icf_B8() { incPC(); putHiByte (8); }
function icf_B9() { incPC(); putHiByte (9); }
function icf_BA() { incPC(); putHiByte (10); }
function icf_BB() { incPC(); putHiByte (11); }
function icf_BC() { incPC(); putHiByte (12); }
function icf_BD() { incPC(); putHiByte (13); }
function icf_BE() { incPC(); putHiByte (14); }
function icf_BF() { incPC(); putHiByte (15); }

function icf_C0() { incPC(); cdp1802_lbr(); }
function icf_C1() { incPC(); cdp1802_lbq(); }
function icf_C2() { incPC(); cdp1802_lbz(); }
function icf_C3() { incPC(); cdp1802_lbdf(); }
function icf_C4() { incPC(); }                   // NOP
function icf_C5() { incPC(); cdp1802_lsnq(); }
function icf_C6() { incPC(); cdp1802_lsnz(); }
function icf_C7() { incPC(); cdp1802_lsnf(); }
function icf_C8() { incPC(); incPC(); incPC(); }    // LSKP or NLBR (long = 2 bytes)
function icf_C9() { incPC(); cdp1802_lbnq(); }
function icf_CA() { incPC(); cdp1802_lbnz(); }
function icf_CB() { incPC(); cdp1802_lbnf(); }
function icf_CC() { incPC(); cdp1802_lsie(); }
function icf_CD() { incPC(); cdp1802_lsq(); }
function icf_CE() { incPC(); cdp1802_lsz(); }
function icf_CF() { incPC(); cdp1802_lsdf(); }

function icf_D0() { incPC(); cdp1802_sep (0); }
function icf_D1() { incPC(); cdp1802_sep (1); }
function icf_D2() { incPC(); cdp1802_sep (2); }
function icf_D3() { incPC(); cdp1802_sep (3); }
function icf_D4() { incPC(); cdp1802_sep (4); }
function icf_D5() { incPC(); cdp1802_sep (5); }
function icf_D6() { incPC(); cdp1802_sep (6); }
function icf_D7() { incPC(); cdp1802_sep (7); }
function icf_D8() { incPC(); cdp1802_sep (8); }
function icf_D9() { incPC(); cdp1802_sep (9); }
function icf_DA() { incPC(); cdp1802_sep (10); }
function icf_DB() { incPC(); cdp1802_sep (11); }
function icf_DC() { incPC(); cdp1802_sep (12); }
function icf_DD() { incPC(); cdp1802_sep (13); }
function icf_DE() { incPC(); cdp1802_sep (14); }
function icf_DF() { incPC(); cdp1802_sep (15); }

function icf_E0() { incPC(); cdp1802_sex (0); }
function icf_E1() { incPC(); cdp1802_sex (1); }
function icf_E2() { incPC(); cdp1802_sex (2); }
function icf_E3() { incPC(); cdp1802_sex (3); }
function icf_E4() { incPC(); cdp1802_sex (4); }
function icf_E5() { incPC(); cdp1802_sex (5); }
function icf_E6() { incPC(); cdp1802_sex (6); }
function icf_E7() { incPC(); cdp1802_sex (7); }
function icf_E8() { incPC(); cdp1802_sex (8); }
function icf_E9() { incPC(); cdp1802_sex (9); }
function icf_EA() { incPC(); cdp1802_sex (10); }
function icf_EB() { incPC(); cdp1802_sex (11); }
function icf_EC() { incPC(); cdp1802_sex (12); }
function icf_ED() { incPC(); cdp1802_sex (13); }
function icf_EE() { incPC(); cdp1802_sex (14); }
function icf_EF() { incPC(); cdp1802_sex (15); }

function icf_F0() { incPC(); cdp1802_ldx(); }
function icf_F1() { incPC(); cdp1802_or(); }
function icf_F2() { incPC(); cdp1802_and(); }
function icf_F3() { incPC(); cdp1802_xor(); }
function icf_F4() { incPC(); cdp1802_add(); }
function icf_F5() { incPC(); cdp1802_sd(); }
function icf_F6() { incPC(); cdp1802_shr(); }
function icf_F7() { incPC(); cdp1802_sm(); }
function icf_F8() { incPC(); cdp1802_ldi(); }
function icf_F9() { incPC(); cdp1802_ori(); }
function icf_FA() { incPC(); cdp1802_ani(); }
function icf_FB() { incPC(); cdp1802_xri(); }
function icf_FC() { incPC(); cdp1802_adi(); }
function icf_FD() { incPC(); cdp1802_sdi(); }
function icf_FE() { incPC(); cdp1802_shl(); }
function icf_FF() { incPC(); cdp1802_smi(); }


// code pages

var gaInstrCodeFunc = [
   icf_00, icf_01, icf_02, icf_03, icf_04, icf_05, icf_06, icf_07,
   icf_08, icf_09, icf_0A, icf_0B, icf_0C, icf_0D, icf_0E, icf_0F,
   icf_10, icf_11, icf_12, icf_13, icf_14, icf_15, icf_16, icf_17,
   icf_18, icf_19, icf_1A, icf_1B, icf_1C, icf_1D, icf_1E, icf_1F,
   icf_20, icf_21, icf_22, icf_23, icf_24, icf_25, icf_26, icf_27,
   icf_28, icf_29, icf_2A, icf_2B, icf_2C, icf_2D, icf_2E, icf_2F,
   icf_30, icf_31, icf_32, icf_33, icf_34, icf_35, icf_36, icf_37,
   icf_38, icf_39, icf_3A, icf_3B, icf_3C, icf_3D, icf_3E, icf_3F,
   icf_40, icf_41, icf_42, icf_43, icf_44, icf_45, icf_46, icf_47,
   icf_48, icf_49, icf_4A, icf_4B, icf_4C, icf_4D, icf_4E, icf_4F,
   icf_50, icf_51, icf_52, icf_53, icf_54, icf_55, icf_56, icf_57,
   icf_58, icf_59, icf_5A, icf_5B, icf_5C, icf_5D, icf_5E, icf_5F,
   icf_60, icf_61, icf_62, icf_63, icf_64, icf_65, icf_66, icf_67,
   icf_68, icf_69, icf_6A, icf_6B, icf_6C, icf_6D, icf_6E, icf_6F,
   icf_70, icf_71, icf_72, icf_73, icf_74, icf_75, icf_76, icf_77,
   icf_78, icf_79, icf_7A, icf_7B, icf_7C, icf_7D, icf_7E, icf_7F,
   icf_80, icf_81, icf_82, icf_83, icf_84, icf_85, icf_86, icf_87,
   icf_88, icf_89, icf_8A, icf_8B, icf_8C, icf_8D, icf_8E, icf_8F,
   icf_90, icf_91, icf_92, icf_93, icf_94, icf_95, icf_96, icf_97,
   icf_98, icf_99, icf_9A, icf_9B, icf_9C, icf_9D, icf_9E, icf_9F,
   icf_A0, icf_A1, icf_A2, icf_A3, icf_A4, icf_A5, icf_A6, icf_A7,
   icf_A8, icf_A9, icf_AA, icf_AB, icf_AC, icf_AD, icf_AE, icf_AF,
   icf_B0, icf_B1, icf_B2, icf_B3, icf_B4, icf_B5, icf_B6, icf_B7,
   icf_B8, icf_B9, icf_BA, icf_BB, icf_BC, icf_BD, icf_BE, icf_BF,
   icf_C0, icf_C1, icf_C2, icf_C3, icf_C4, icf_C5, icf_C6, icf_C7,
   icf_C8, icf_C9, icf_CA, icf_CB, icf_CC, icf_CD, icf_CE, icf_CF,
   icf_D0, icf_D1, icf_D2, icf_D3, icf_D4, icf_D5, icf_D6, icf_D7,
   icf_D8, icf_D9, icf_DA, icf_DB, icf_DC, icf_DD, icf_DE, icf_DF,
   icf_E0, icf_E1, icf_E2, icf_E3, icf_E4, icf_E5, icf_E6, icf_E7,
   icf_E8, icf_E9, icf_EA, icf_EB, icf_EC, icf_ED, icf_EE, icf_EF,
   icf_F0, icf_F1, icf_F2, icf_F3, icf_F4, icf_F5, icf_F6, icf_F7,
   icf_F8, icf_F9, icf_FA, icf_FB, icf_FC, icf_FD, icf_FE, icf_FF
];

var gnaCycles = [
   2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2,  // 00
   2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2,  // 10
   2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2,  // 20
   2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2,  // 30
   2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2,  // 40
   2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2,  // 50
   2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2,  // 60
   2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2,  // 70
   2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2,  // 80
   2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2,  // 90
   2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2,  // A0
   2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2,  // B0
   3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3,  // C0
   2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2,  // D0
   2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2,  // E0
   2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2   // F0
];


// main

function cpuLoop (pnCycleLimit, pnStartAddress)
{
   var nCPUCycles = 0;
   var nOpCode;

   gnInTemp = Math.random() * 255;
   gnInTemp = Math.round (gnInTemp);

   if (gbInFlag)  // via simelf.js
      gbaEFnFlag[4] = false;

   else
      gbaEFnFlag[4] = true;

   if (pnStartAddress >= 0)
      setPC (pnStartAddress);

   while (nCPUCycles < pnCycleLimit  &&  !gbDispFlag) {

      nOpCode = memoryRead (gconMEMRD_OPCODE);

      gaInstrCodeFunc[nOpCode]();
      nCPUCycles += gnaCycles[nOpCode];

      if (nOpCode == 0)  // IDL instruction is treated as a HALT
         return getPC();   // stop execution -- return memory address of Halt (+1)

   } // while

   return -1;  // call back for more execution
} // cpuLoop


function cpuReset()
{
   window.status = "1802 CPU Reset";

   gnD8bAccum = 0;   // ???
   gnDataBus = 0;
   gnN4bOpCodeLo = gnX4bRegIdx = gnP4bRegIdx = 0;
   gbIntEnable1bFlag = true;
   gbQ1bFlag = false;
   gbaEFnFlag[1] = gbaEFnFlag[2] = gbaEFnFlag[3] = gbaEFnFlag[4] = true;   // high pulled low
   gnaRegister16b[0] = 0;     // PC = 0
}


function regsClear()
{
   for(nRegN = 0;  nRegN < 16;  nRegN++)
      gnaRegister16b[nRegN] = 0;

   return;
} // regsClear


function ramClear()
{
   for(ii = 0;  ii < gnMemoryMaxRAM;  ii++)
      gnaMemoryRAM[ii] = 0;

   return;
} // ramClear


function registerCallbackOutput (pnPort, pfCallbackFunction)
{
   if (typeof (gfaOutputCallback[0]) == "undefined") {
      for (var nIdx = 0;  nIdx < 8;  ++nIdx)
         gfaOutputCallback[nIdx] = new Array();
   }

   gfaOutputCallback[pnPort & 0x7].push (pfCallbackFunction);

   return;
} // registerCallbackOutput


function registerCallbackInput (pnPort, pfCallbackFunction)
{
   if (typeof (gfaInputCallback[0]) == "undefined") {
      for (var nIdx = 0;  nIdx < 8;  ++nIdx)
         gfaInputCallback[nIdx] = new Array();
   }

   gfaInputCallback[pnPort & 0x7].push (pfCallbackFunction);

   return;
} // registerCallbackInput

// end of COSMAC CDP1802 simulator/emulator

