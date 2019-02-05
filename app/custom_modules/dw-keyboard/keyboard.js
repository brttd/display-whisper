if (typeof window !== 'object') {
    throw new Error('Keyboard module used outside of browserWindow!')
} else if (typeof window.addEventListener !== 'function') {
    throw new Error("Window doesn't have addEventListener method!")
}

const modifiers = [
    'Alt',
    'AltGraph',
    'CapsLock',
    'Control',
    'Fn',
    'FnLock',
    'Hyper',
    'Meta',
    'NumLock',
    'ScrollLock',
    'Shift',
    'Super',
    'Symbol',
    'SymbolLock'
]

const events = {}

//Character keys -> character codes (US layout)
//(From https://www.w3.org/TR/uievents-code/)
let keyReplacements = {
    0: 'Digit0',
    1: 'Digit1',
    2: 'Digit2',
    3: 'Digit3',
    4: 'Digit4',
    5: 'Digit5',
    6: 'Digit6',
    7: 'Digit7',
    8: 'Digit8',
    9: 'Digit9',

    a: 'KeyA', //(KeyQ on French layout)
    A: 'KeyA', //(KeyQ on French layout)
    b: 'KeyB',
    B: 'KeyB',
    c: 'KeyC',
    C: 'KeyC',
    d: 'KeyD',
    D: 'KeyD',
    e: 'KeyE',
    E: 'KeyE',
    f: 'KeyF',
    F: 'KeyF',
    g: 'KeyG',
    G: 'KeyG',
    h: 'KeyH',
    H: 'KeyH',
    i: 'KeyI',
    I: 'KeyI',
    j: 'KeyJ',
    J: 'KeyJ',
    k: 'KeyK',
    K: 'KeyK',
    l: 'KeyL',
    L: 'KeyL',
    m: 'KeyM',
    M: 'KeyM',
    n: 'KeyN',
    N: 'KeyN',
    o: 'KeyO',
    O: 'KeyO',
    p: 'KeyP',
    P: 'KeyP',
    q: 'KeyQ', //(KeyA on French layout)
    Q: 'KeyQ', //(KeyA on French layout)
    r: 'KeyR',
    R: 'KeyR',
    s: 'KeyS',
    S: 'KeyS',
    t: 'KeyT',
    T: 'KeyT',
    u: 'KeyU',
    U: 'KeyU',
    v: 'KeyV',
    V: 'KeyV',
    w: 'KeyW', //(KeyZ on French layout)
    W: 'KeyW', //(KeyZ on French layout)
    x: 'KeyX',
    X: 'KeyX',
    y: 'KeyY', //(KeyZ on German layout)
    Y: 'KeyY', //(KeyZ on German layout)
    z: 'KeyZ', //(KeyW on French layout, keyY on German layout)
    Z: 'KeyZ', //(KeyW on French layout, keyY on German layout)

    '`': 'Backquote',
    '¬': 'Backquote',
    '~': 'Backslash', //(UK layout)

    '|': 'Backslash', //(IntlBackslash on UK layout)
    '\\': 'Backslash', //(IntlBackslash on UK layout)

    '⌫': 'Backspace',
    Delete: 'Backspace', //(Apple keyboard)

    '{': 'BracketLeft',
    '[': 'BracketLeft',

    '}': 'BracketRight',
    ']': 'BracketRight',

    ',': 'Comma',
    '<': 'Comma',

    ')': 'Digit0',
    '!': 'Digit1',
    '@': 'Digit2', //(Backslash or Quote on UK layout)
    '#': 'Digit3', //(Backslash on UK layout)
    '£': 'Digit3', //(UK layout)
    $: 'Digit4',
    '%': 'Digit5',
    '^': 'Digit6',
    '&': 'Digit7',
    '*': 'Digit8',
    '(': 'Digit9',

    '=': 'Equal',
    '+': 'Equal',

    '-': 'Minus',
    _: 'Minus',

    '.': 'Period',
    '>': 'Period',

    "'": 'Quote',
    '"': 'Quote', //(Digit2 on UK layout)

    ':': 'Semicolon',
    ';': 'Semicolon',

    '/': 'Slash',
    '?': 'Slash',

    '⇪': 'CapsLock',

    Return: 'Enter',
    '↵': 'Enter',

    '⇥': 'Tab',

    ' ': 'Space',

    '⌦': 'Delete',

    '↘': 'End',
    '↖': 'Home',

    Ins: 'Insert',

    PgDn: 'PageDown',
    '⇟': 'PageDown',

    PgUp: 'PageUp',
    '⇞': 'PageUp',

    '↓': 'ArrowDown',
    '←': 'ArrowLeft',
    '→': 'ArrowRight',
    '↑': 'ArrowUp',

    Clear: 'NumLock', //(Apple)
    del: 'NumpadDecimal',

    Esc: 'Escape',
    '⎋': 'Escape',

    PrtScr: 'PrintScreen',
    SysRq: 'PrintScreen',

    //Modifier keys are mapped to the relevent event.key, instead of .code (to enable left/right version of alt, ctrl, etc, to be used interchangeably)
    Option: 'Alt',
    '⌥': 'Alt',
    AltGR: 'AltGraph',

    Ctrl: 'Control',

    CommandOrControl: 'Meta',
    CmdOrCtrl: 'Meta',
    Command: 'Meta',
    Cmd: 'Meta',
    '⌘': 'Meta',

    '⇧': 'Shift'
}

if (process.platform === 'win32' || process.platform === 'linux') {
    //Windows and Linux don't have the command key
    keyReplacements['CommandOrControl'] = 'Control'
    keyReplacements['CmdOrCtrl'] = 'Control'
    keyReplacements['Command'] = 'Control'
    keyReplacements['Cmd'] = 'Control'
}

//Character codes -> user-displayed string (US layout)
let keyDisplays = {
    Digit0: '0',
    Digit1: '1',
    Digit2: '2',
    Digit3: '3',
    Digit4: '4',
    Digit5: '5',
    Digit6: '6',
    Digit7: '7',
    Digit8: '8',
    Digit9: '9',

    KeyA: 'A', //(Q on French layout)
    KeyB: 'B',
    KeyC: 'C',
    KeyD: 'D',
    KeyE: 'E',
    KeyF: 'F',
    KeyG: 'G',
    KeyH: 'H',
    KeyI: 'I',
    KeyJ: 'J',
    KeyK: 'K',
    KeyL: 'L',
    KeyM: 'M',
    KeyN: 'N',
    KeyO: 'O',
    KeyP: 'P',
    KeyQ: 'Q', //(A on French layout)
    KeyR: 'R',
    KeyS: 'S',
    KeyT: 'T',
    KeyU: 'U',
    KeyV: 'V',
    KeyW: 'W', //(z on French layout)
    KeyX: 'X',
    KeyY: 'Y', //(Z on German layout)
    KeyZ: 'Z', //(W on French layout, Y on German layout)

    Backquote: 'Backquote',
    Backslash: 'Backslash', //(~# on UK layout)

    IntlBackslash: 'Backslash', //(UK layout),
    IntlRo: 'IntlRo', //(Japanese layout),
    IntelYen: 'IntelYen', //(Japanese layout, \/ on Russian layout)

    Backspace: 'Backspace',

    BracketLeft: 'Left Bracket',
    BracketRight: 'Right Bracket',

    Comma: 'Comma',

    Equal: 'Equal',
    Minus: 'Minus',

    Period: 'Period',

    Quote: 'Quote',

    Semicolon: 'Semicolon',

    Slash: 'Slash',

    ContextMenu: 'Context Menu',
    Enter: 'Enter',
    Tab: 'Tab',
    Space: 'Space',
    Delete: 'Delete',
    Help: 'Help',
    End: 'End',
    Home: 'Home',
    Insert: 'Insert',
    PageDown: 'Page Down',
    PageUp: 'Page Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
    ArrowUp: 'Up',

    Numpad0: 'Num 0',
    Numpad1: 'Num 1',
    Numpad2: 'Num 2',
    Numpad3: 'Num 3',
    Numpad4: 'Num 4',
    Numpad5: 'Num 5',
    Numpad6: 'Num 6',
    Numpad7: 'Num 7',
    Numpad8: 'Num 8',
    Numpad9: 'Num 9',
    NumAdd: 'Num Add',
    NumBackspace: 'Num Backspace',
    NumpadClear: 'Clear',
    NumpadComma: 'Num Comma',
    NumpadDecimal: 'Num Decimal',
    NumpadDivide: 'Num Divide',
    NumpadEnter: 'Num Enter',
    NumpadEqual: 'Num Equal',
    NumpadMultiply: 'Num Multiply',
    NumpadSubtract: 'Num Subtract',

    Escape: 'Escape',

    F1: 'F1',
    F2: 'F2',
    F3: 'F3',
    F4: 'F4',
    F5: 'F5',
    F6: 'F6',
    F7: 'F7',
    F8: 'F8',
    F9: 'F9',
    F10: 'F10',
    F11: 'F11',
    F12: 'F12',

    PrintScreen: 'Prt Sc',
    Pause: 'Pause',

    //Modifier keys:
    Alt: 'Alt',
    AltGraph: 'Alt Gr',
    CapsLock: 'Caps Lock',
    Control: 'Ctrl',
    Fn: 'Fn',
    FnLock: 'Fn Lock',
    Hyper: 'Hyper',
    Meta: '⌘',
    NumLock: 'Num Lock',
    ScrollLock: 'Scroll Lock',
    Shift: 'Shift',
    Super: 'Super',
    Symbol: 'Symbol',
    SymbolLock: 'Symbol Lock'
}

if (process.platform === 'win32') {
    keyDisplays['Meta'] = 'Windows'
} else {
    keyDisplays['Alt'] = '⌥'
    keyDisplays['AltGraph'] = '⌥ Gr'
    keyDisplays['CapsLock'] = '⇪'
    keyDisplays['Control'] = '⌃'
    keyDisplays['Shift'] = '⇧'
}

/*
listeners is an array, with each item an object:
{
    shortcut: '...', (What key combination to fire on)
    function: ..., (What function to call)
    repeat: true/false, (Whether to call function whilst key combination is held down)
    global: true/false (Whether to call function when an element has user focus)
}
*/
let listeners = []

let idCounter = 0
let listenerShortcutsList = []

//Keys being held down
let activeKeyList = []
//Modifiers being held down
let activeModifierList = []
//Keys which were held, and have been released
let releasedKeyList = []

let activeShortcut = ''

function emitEvent(eventName, arg1) {
    if (!Array.isArray(events[eventName])) {
        return false
    }

    for (let i = 0; i < events[eventName].length; i++) {
        events[eventName][i](arg1)
    }
}

function cleanShortcut(shortcut) {
    let keys = shortcut.split('+').map(key => {
        key = key.trim()

        if (keyReplacements.hasOwnProperty(key)) {
            return keyReplacements[key]
        }

        return key
    })

    let modifierList = keys.filter(key => modifiers.includes(key))
    keys = keys.filter(key => {
        return key !== '' && !modifiers.includes(key)
    })

    return modifierList
        .sort()
        .concat(keys)
        .join('+')
}

window.addEventListener('keydown', event => {
    if (modifiers.includes(event.key)) {
        if (!activeModifierList.includes(event.key)) {
            activeModifierList.push(event.key)
            activeModifierList.sort()
        }
    } else if (releasedKeyList.includes(event.code)) {
        let index = activeKeyList.indexOf(event.code)
        if (index !== -1) {
            activeKeyList.splice(index, 1)
        }

        activeKeyList.push(event.code)

        index = releasedKeyList.indexOf(event.code)
        releasedKeyList.splice(index, 1)
    } else if (!activeKeyList.includes(event.code)) {
        activeKeyList.push(event.code)
    }

    activeShortcut = activeModifierList.concat(activeKeyList).join('+')

    emitEvent('shortcut-change', {
        shortcut: activeShortcut,

        modifiers: activeModifierList.slice(0),

        from: exports
    })

    if (listenerShortcutsList.includes(activeShortcut)) {
        for (let i = 0; i < listeners.length; i++) {
            if (
                listeners[i].shortcut === activeShortcut &&
                (!event.repeat || listeners[i].repeat) &&
                (document.activeElement === document.body ||
                    listeners[i].global)
            ) {
                listeners[i].function()
            }
        }
    }
})

window.addEventListener('keyup', event => {
    if (modifiers.includes(event.key)) {
        let index = activeModifierList.indexOf(event.key)

        if (index !== -1) {
            activeModifierList.splice(index, 1)
        }
    } else if (
        activeKeyList.includes(event.code) &&
        !releasedKeyList.includes(event.code)
    ) {
        releasedKeyList.push(event.code)
    }

    activeShortcut = activeModifierList.concat(activeKeyList).join('+')

    if (
        releasedKeyList.length === activeKeyList.length &&
        activeKeyList.length > 0
    ) {
        activeKeyList = []
        releasedKeyList = []

        emitEvent('shortcut-finish', {
            shortcut: activeShortcut,

            modifiers: activeModifierList.slice(0),

            from: exports
        })

        activeShortcut = ''
    } else {
        emitEvent('shortcut-change', {
            shortcut: activeShortcut,

            modifiers: activeModifierList.slice(0),

            from: exports
        })
    }
})
window.addEventListener('blur', () => {
    activeKeyList = []
    activeModifierList = []
    releasedKeyList = []

    activeShortcut = ''

    emitEvent('shortcut-change', {
        shortcut: activeShortcut
    })
})

exports.register = (shortcut, func, options = {}) => {
    if (typeof func !== 'function' || typeof shortcut !== 'string') {
        return false
    }

    shortcut = cleanShortcut(shortcut)

    if (shortcut.length === 0) {
        return false
    }

    if (!listenerShortcutsList.includes(shortcut)) {
        listenerShortcutsList.push(shortcut)
    }

    idCounter += 1

    listeners.push({
        id: idCounter,

        shortcut: shortcut,
        function: func,
        repeat: options.repeat || false,
        global: options.global || false
    })

    return idCounter
}
exports.unregister = id => {
    for (let i = 0; i < listeners.length; i++) {
        if (listeners[i].id === id) {
            let shortcut = listeners.splice(i, 1)[0].shortcut

            //if no other listeners are using the same shortcut, remove it
            if (!listeners.some(listener => listener.shortcut === shortcut)) {
                let index = listenerShortcutsList.indexOf(shortcut)

                if (index !== -1) {
                    listenerShortcutsList.splice(index, 1)
                }
            }

            return true
        }
    }

    return false
}
exports.clear = (shortcut = '') => {
    shortcut = cleanShortcut(shortcut)

    if (!listenerShortcutsList.includes(shortcut)) {
        return false
    }

    let index = listenerShortcutsList.indexOf(shortcut)
    if (index !== -1) {
        listenerShortcutsList.splice(listenerShortcutsList.indexOf(shortcut), 1)
    }

    for (let i = listeners.length - 1; i >= 0; i--) {
        if (listeners[i].shortcut === shortcut) {
            listeners.splice(i, 1)
        }
    }

    return true
}

exports.onEvent = (eventName, callback) => {
    if (typeof eventName !== 'string' || typeof callback !== 'function') {
        return false
    }

    if (!Array.isArray(events[eventName])) {
        events[eventName] = []
    }

    events[eventName].push(callback)
}

exports.getDisplay = (shortcut = '') => {
    if (typeof shortcut !== 'string' || shortcut.trim() === '') {
        return ''
    }

    let keys = shortcut.split('+').map(key => key.trim())

    let modifierList = keys
        .filter(key => modifiers.includes(key))
        .sort()
        .map(key => {
            if (keyDisplays[key]) {
                return keyDisplays[key]
            }

            return key
        })

    keys = keys
        .filter(key => {
            return key !== '' && !modifiers.includes(key)
        })
        .map(key => {
            if (keyDisplays[key]) {
                return keyDisplays[key]
            }

            return key
        })

    return modifierList.concat(keys).join('+')
}

exports.cleanShortcut = cleanShortcut
