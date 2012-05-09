/**
 * "CyEmu"
 * A very basic emulator of Cy Enfield's chording keyboard systems.
 *
 * (c) Copyright 2012 Stanislav Datskovskiy
 * http://www.loper-os.org
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 */


/************** Knobs: **************/
var THUMB_META = 96;     // Numpad-0
var THUMB = 97;          // Numpad 1
var INDEX_FINGER = 103;  // Numpad-7
var MIDDLE_FINGER = 104; // Numpad-8
var RING_FINGER = 105;   // Numpad-9
var LITTLE_FINGER = 107; // Numpad-Plus
/************************************/

// Current chorder state
var keys = 0;
var chord = 0;

var CyChordTable = {
    // Alpha
    12 : 'a',
    56 : 'b',
    10 : 'c',
    14 : 'd',
    4  : 'e',
    30 : 'f',
    48 : 'g',
    34 : 'h',
    6  : 'i',
    50 : 'j',
    18 : 'k',
    38 : 'l',
    60 : 'm',
    24 : 'n',
    8  : 'o',
    62 : 'p',
    40 : 'q',
    22 : 'r',
    16 : 's',
    20 : 't',
    32 : 'u',
    36 : 'v',
    54 : 'w',
    58 : 'x',
    26 : 'y',
    42 : 'z',
    // Misc
    2  : ' ',
    28 : '.',
    52 : ',',
    44 : '-',
    46 : '\''
};


// A chord was completed.
function doChord() {
    var meta = chord & 1;
    var symbol = CyChordTable[(chord & 62)];

    if (symbol != undefined) {
        if (meta) cybox.value += "Cmd-";
        cybox.value += symbol;
    } else {
        cybox.value += chord + " ";
    }

    chord = 0;
}


function handleKeyEvent(ev) {
    var c = ev.keyCode || ev.which;
    switch (c) {
        case THUMB_META:
            return 3; // Meta = Thumb + Meta Bit
            break;
        case THUMB:
            return 2;
            break;
        case INDEX_FINGER:
            return 4;
            break;
        case MIDDLE_FINGER:
            return 8;
            break;
        case RING_FINGER:
            return 16;
            break;
        case LITTLE_FINGER:
            return 32;
            break;
        default: // All other keys disabled.
            break;
    }
    return 0;
}


// Pressed key.
function downKey(ev) {
    var k = handleKeyEvent(ev);
    if (k != 0) {
        keys |= k;
        chord |= keys;
    }
    ev.preventDefault();
    ev.stopPropagation();
}


// Released key.
function upKey(ev) {
    var k = handleKeyEvent(ev);
    if (k != 0) {
        keys ^= k;
        if (keys == 0) doChord();
    }
    ev.preventDefault();
    ev.stopPropagation();
}


function Init() {
    cybox = document.getElementById('cybox');
    // Hook keyboard events
    cybox.addEventListener('keydown', downKey, true);
    cybox.addEventListener('keyup', upKey, true);
}
