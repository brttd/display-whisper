const electron = require('electron')
const { app, BrowserWindow, dialog, ipcMain, shell, Menu, MenuItem } = electron

const url = require('url')
const path = require('path')
const fs = require('fs')
const getURL = require('https').get

const logger = require('dw-log')

let screen
let primaryScreen

let appPath = path.join(app.getAppPath(), '/app.asar')

let debug = false
//appPath = path.normalize(app.getAppPath())

//List of valid window names
let windowNames = []
//BrowserWindow instances
let windows = {}
let windowDefaults = {}

//BrowserWindow instances for editors (stored by id)
const editors = {}

//Used to store messages when the control window isn't open
let controlMessageBuffer = []

//List of all system displays
let displays = []
//Current display being used
let display = {
    bounds: {
        x: 0,
        y: 0,
        width: 0,
        height: 0
    },
    screen: 0,
    show: false
}
//User set display size
let customDisplaySize = {
    use: false,

    width: 0,
    height: 0
}

//Used when display is re-opened, so that it correctly shows the current section
let lastDisplayData = null

//User settings
//All logic is done inside the main JS script, so that there's a simple system for requesting & setting values, and sending updates to windows which requested values
const settings = {}
{
    const settingsPath = path.join(app.getPath('userData'), 'settings.json')

    const saveInterval = 2 * 1000
    let lastSaveAttempt = 0

    let loaded = false

    let cache = {}

    let listeners = {}

    function save(callback) {
        fs.writeFile(settingsPath, JSON.stringify(cache), error => {
            if (error) {
                logger.error('Unable to save settings file:', error)

                sendToControlWindow(
                    'show-message',
                    'An error occurred while saving application preferences! View log for more details.',
                    'error'
                )
            }

            if (typeof callback === 'function') {
                callback(error)
            }
        })
    }

    function attemptSave() {
        lastSaveAttempt = Date.now()

        setTimeout(() => {
            if (Date.now() - lastSaveAttempt > saveInterval) {
                save()
            }
        }, saveInterval + 1)
    }

    function addListener(key, listener) {
        //The only valid listeners are functions, and webContents (which have .isDestroyed & .send functions)
        if (typeof listener !== 'function') {
            if (
                typeof listener !== 'object' ||
                Array.isArray(listener) ||
                listener === null
            ) {
                return false
            }

            if (
                typeof listener.isDestroyed !== 'function' ||
                typeof listener.send !== 'function'
            ) {
                return false
            }
        }

        if (!listeners.hasOwnProperty(key)) {
            listeners[key] = []
        }

        if (!listeners[key].includes(listener)) {
            listeners[key].push(listener)
        }
    }

    function alertListeners(key, value) {
        if (!Array.isArray(listeners[key])) {
            return false
        }

        for (let i = listeners[key].length - 1; i >= 0; i--) {
            //If it's a function, call it. If not, it's a webcontents, so check if it's destroyed
            //If it is, remove it, else send

            if (typeof listeners[key][i] === 'function') {
                listeners[key][i](value)
            } else if (listeners[key][i].isDestroyed()) {
                listeners[key].splice(i, 1)
            } else {
                listeners[key][i].send('setting', key, value)
            }
        }
    }

    function keyChanged(key, value) {
        attemptSave()

        alertListeners(key, value)
    }

    //loads app/settings.json and fills in all defaults from there, which aren't already set
    function fillSettings() {
        fs.readFile(
            path.join(appPath, 'settings.json'),
            'utf8',
            (error, data) => {
                if (error) {
                    return logger.error(
                        'Unable to read app/settings.json:',
                        error
                    )
                }

                try {
                    data = JSON.parse(data)
                } catch (error) {
                    return logger.error(
                        'Unable to parse app/settings.json:',
                        error
                    )
                }

                for (let section in data) {
                    for (let subSection in data[section]) {
                        if (typeof data[section][subSection] === 'object') {
                            let keyGroup = section + '.' + subSection
                            if (
                                typeof data[section][subSection].map ===
                                'string'
                            ) {
                                keyGroup = data[section][subSection].map
                            }
                            keyGroup += '.'

                            let entries = data[section][subSection].entries

                            for (let option in entries) {
                                if (!settings.has(keyGroup + option)) {
                                    settings.set(
                                        keyGroup + option,
                                        entries[option].default
                                    )
                                }
                            }
                        }
                    }
                }
            }
        )
    }

    //Returns the value in the obj at the given level from an array of string keys.
    //If the level doesn't exist, it will be created. If the level is not an object, it will return undefined, unless overwrite is true, in which case it will make it into a level.
    function findLevel(obj, keys, overwrite = false) {
        if (keys.length === 0) {
            return obj
        }

        if (obj.hasOwnProperty(keys[0])) {
            if (
                typeof obj[keys[0]] !== 'object' ||
                Array.isArray(obj[keys[0]]) ||
                obj[keys[0]] === null
            ) {
                if (overwrite) {
                    obj[keys[0]] = {}

                    return findLevel(obj[keys[0]], keys.slice(1), overwrite)
                }

                return undefined
            }
        } else {
            obj[keys[0]] = {}
        }

        return findLevel(obj[keys[0]], keys.slice(1), overwrite)
    }

    settings.has = function(key) {
        if (typeof key !== 'string') {
            return false
        }

        let keys = key.split('.')
        let lastKey = keys.pop()

        //Find the level the key is at, without overwriting any data
        let obj = findLevel(cache, keys, false)

        //If the level exists, return the existance of the key
        if (typeof obj === 'object') {
            return obj.hasOwnProperty(lastKey)
        }

        return false
    }

    settings.get = function(key, defaultValue = undefined) {
        if (typeof key !== 'string') {
            return false
        }

        let keys = key.split('.')
        let lastKey = keys.pop()

        //find the level at the second last key
        let obj = findLevel(cache, keys, false)

        if (typeof obj === 'object') {
            //The level exists

            //If the level doesn't have the key, then it should be set to the default value. If there is not default value, return undefined
            if (!obj.hasOwnProperty(lastKey)) {
                if (typeof defaultValue === 'undefined') {
                    return undefined
                }

                obj[lastKey] = defaultValue

                keyChanged(key, obj[lastKey])
            }

            return obj[lastKey]
        } else if (typeof defaultValue !== 'undefined') {
            //The level is not an object, it needs to be made into a object
            obj = findLevel(cache, keys, true)

            obj[lastKey] = defaultValue

            keyChanged(key, obj[lastKey])

            return obj[lastKey]
        } else {
            //The level is not an object, and there is no default value, so return undefined
            return undefined
        }
    }
    settings.set = function(key = '_', value = undefined) {
        if (typeof key !== 'string') {
            return false
        }

        let keys = key.split('.')

        //Get the level of the second last key, overwriting as neccesary
        let obj = findLevel(cache, keys.slice(0, keys.length - 1), true)

        obj[keys[keys.length - 1]] = value

        keyChanged(key, value)
    }
    settings.listen = addListener
    settings.load = () => {
        if (!app.isReady() || loaded) {
            return false
        }

        if (!fs.existsSync(settingsPath)) {
            fs.writeFileSync(settingsPath, JSON.stringify(cache))
        }

        let fileContent = null

        try {
            fileContent = fs.readFileSync(settingsPath)
        } catch (error) {
            logger.error('Unable to read settings file:', error)

            return false
        }

        try {
            cache = JSON.parse(fileContent)
        } catch (error) {
            logger.error('Unable to load settings file:', error)

            fs.rename(settingsPath, settingsPath + '-error', error => {
                if (error) {
                    logger.error(
                        'Unable to rename corrupted settings file!',
                        error
                    )
                }
            })

            sendToControlWindow(
                'show-message',
                'Application preferences could not be loaded! Your Preferences may have been lost.',
                'error'
            )

            return false
        }

        loaded = true

        for (let key in listeners) {
            alertListeners(key, settings.get(key))
        }

        fillSettings()

        return true
    }
    settings.forceSave = callback => {
        save(callback)
        lastSaveAttempt = Date.now()
    }

    ipcMain.on('get-setting-sync', (event, key, defaultValue) => {
        addListener(key, event.sender)

        let value = settings.get(key, defaultValue)

        if (typeof value === 'undefined') {
            event.returnValue = null
        } else {
            event.returnValue = value
        }
    })
    ipcMain.on('get-setting', (event, key, defaultValue) => {
        addListener(key, event.sender)

        event.sender.send('setting', key, settings.get(key, defaultValue))
    })

    ipcMain.on('get-settings', (event, keyValuePairs) => {
        //Sends each key from the array to the sender, and adds the window as a listener for that key
        //If the key is an array, uses the second value as the default value

        if (Array.isArray(keyValuePairs)) {
            for (let i = 0; i < keyValuePairs.length; i++) {
                if (Array.isArray(keyValuePairs[i])) {
                    addListener(keyValuePairs[i][0], event.sender)

                    event.sender.send(
                        'setting',
                        keyValuePairs[i][0],
                        settings.get(keyValuePairs[i][0], keyValuePairs[i][1])
                    )
                } else {
                    addListener(keyValuePairs[i], event.sender)

                    event.sender.send(
                        'setting',
                        keyValuePairs[i],
                        settings.get(keyValuePairs[i])
                    )
                }
            }
        }
    })

    ipcMain.on('set-setting-sync', (event, key, value) => {
        addListener(key, event.sender)

        event.returnValue = settings.set(key, value)
    })
    ipcMain.on('set-setting', (event, key, value) => {
        addListener(key, event.sender)

        settings.set(key, value)
    })
}

app.commandLine.appendSwitch('disable-http-cache')

function loadWindowDefaults() {
    try {
        windowDefaults = JSON.parse(
            fs.readFileSync(path.join(appPath, 'windows.json'))
        )

        for (let windowName in windowDefaults) {
            if (windowDefaults.hasOwnProperty(windowName)) {
                windowNames.push(windowName)
            }
        }
    } catch (error) {
        logger.error('Unable to load windows json file!', error)

        dialog.showErrorBox(
            'Error creating windows!',
            'Unable to load window information.\nReinstalling may fix this issue.\n\nFull error message: ' +
                (error.message || error.toString())
        )
    }
}

function makeWindowBoundsSafe(bounds) {
    //The display in which the window will be shown
    let windowDisplay = null

    if (isFinite(bounds.minWidth) && isFinite(bounds.width)) {
        bounds.width = Math.max(bounds.minWidth, bounds.width)
    }
    if (isFinite(bounds.minHeight) && isFinite(bounds.height)) {
        bounds.height = Math.max(bounds.minHeight, bounds.height)
    }

    if (isFinite(bounds.maxWidth) && isFinite(bounds.width)) {
        bounds.width = Math.min(bounds.maxWidth, bounds.width)
    }
    if (isFinite(bounds.maxHeight) && isFinite(bounds.height)) {
        bounds.height = Math.min(bounds.maxHeight, bounds.height)
    }

    if (isFinite(bounds.x) && isFinite(bounds.y)) {
        windowDisplay = screen.getDisplayNearestPoint({
            x: bounds.x,
            y: bounds.y
        })
    } else {
        windowDisplay = screen.getPrimaryDisplay()

        bounds.x = windowDisplay.bounds.x + windowDisplay.bounds.width / 2

        bounds.y = windowDisplay.bounds.y + windowDisplay.bounds.height / 2

        if (isFinite(bounds.width) && isFinite(bounds.height)) {
            bounds.x -= bounds.width / 2

            bounds.y -= bounds.height / 2
        }
    }

    if (windowDisplay && isFinite(bounds.x) && isFinite(bounds.y)) {
        let winSize = {
            width: bounds.width || 0,
            height: bounds.height || 0
        }

        if (bounds.x < windowDisplay.bounds.x) {
            bounds.x = windowDisplay.bounds.x
        } else if (
            bounds.x >
            windowDisplay.bounds.x + windowDisplay.bounds.width - winSize.width
        ) {
            bounds.x = Math.max(
                windowDisplay.bounds.x,
                windowDisplay.bounds.x +
                    windowDisplay.bounds.width -
                    winSize.width
            )
        }

        if (bounds.y < windowDisplay.bounds.y) {
            bounds.y = windowDisplay.bounds.y
        } else if (
            bounds.y >
            windowDisplay.bounds.y +
                windowDisplay.bounds.height -
                winSize.height
        ) {
            bounds.y = Math.max(
                windowDisplay.bounds.y,
                windowDisplay.bounds.y +
                    windowDisplay.bounds.height -
                    winSize.height
            )
        }
    }
}

function onWinNewWindow(event, url) {
    event.preventDefault()
    shell.openExternal(url)

    logger.log('A window opened url:', url)
}
function onWinNavigate(event, url) {
    logger.log('A window attempted to navigate to:', url)

    event.preventDefault()
}

function openDisplay() {
    if (windows.display) {
        windows.display.focus()

        return windows.display
    }

    windows.display = new BrowserWindow({
        width: display.bounds.width,
        height: display.bounds.height,
        x: display.bounds.x,
        y: display.bounds.y,

        icon: path.join(
            appPath,
            process.platform === 'darwin' ? 'icons/main.icns' : 'icons/main.ico'
        ),

        show: false,

        resizable: false,
        movable: false,
        minimizable: false,
        maximizable: false,

        //focusable: true,
        alwaysOnTop: true,
        frame: false,
        //thickFrame: false,
        skipTaskbar: true,
        hasShadow: false,

        title: 'Display Whisper | Display',

        webPreferences: {
            devTools: debug,

            backgroundThrottling: false
        }
    })

    windows.display.on('close', () => {
        setDisplay({ show: false })
    })
    windows.display.on('closed', () => {
        windows.display = null
    })

    windows.display.webContents.on('new-window', onWinNewWindow)
    windows.display.webContents.on('will-navigate', onWinNavigate)

    let isUnresponsive = false

    windows.display.on('unresponsive', () => {
        logger.warn('Display became unresponsive')

        //Wait 3 seconds, and restart if still unresponsive
        setTimeout(() => {
            if (isUnresponsive && windows.display) {
                if (!windows.display.isDestroyed) {
                    windows.display.destroy()
                }

                windows.display = null

                openDisplay()

                sendToControlWindow(
                    'show-message',
                    'An error occurred with the display! It has been reset.',
                    'warning'
                )
            }
        }, 3000)
    })

    windows.display.on('responsive', () => {
        isUnresponsive = false
    })

    windows.display.webContents.on('crashed', (event, killed) => {
        logger.error('Display window crashed!', event, killed)

        if (!windows.display.isDestroyed()) {
            windows.display.destroy()
        }

        windows.display = null
        openDisplay()

        sendToControlWindow(
            'show-message',
            'An error occurred with the display! It has been reset.',
            'warning'
        )
    })
    windows.display.webContents.on(
        'did-fail-load',
        (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
            logger.error(
                'Display window failed to load (errorCode = ' +
                    errorCode.toString() +
                    ', errorDescription = ' +
                    errorDescription.toString() +
                    ', validatedURL = ' +
                    validatedURL.toString() +
                    ', isMainFrame = ' +
                    isMainFrame +
                    '):',
                event
            )
        }
    )

    windows.display.webContents.on('did-finish-load', () => {
        //when reopening the display window,
        //re-display whatever was last displayed
        if (lastDisplayData !== null) {
            windows.display.webContents.send('display', lastDisplayData)
        }

        if (display.show) {
            updateDisplayPosition()
            windows.display.show()
        }
    })

    windows.display.loadURL(
        url.format({
            protocol: 'file:',
            slashes: true,
            pathname: path.join(appPath, 'windows/display.html')
        })
    )

    if (debug) {
        windows.display.webContents.openDevTools()
    }
    windows.display.setMenu(null)

    return windows.display
}

function openControl() {
    if (windows.control) {
        windows.control.focus()

        return windows.control
    }

    let bounds = settings.get('windows.control')
    if (typeof bounds !== 'object') {
        bounds = windowDefaults.control
    }

    let winOptions = {
        title: windowDefaults.control.title,

        minWidth: windowDefaults.control.minWidth,
        minHeight: windowDefaults.control.minHeight,

        icon: path.join(
            appPath,
            process.platform === 'darwin' ? 'icons/main.icns' : 'icons/main.ico'
        ),

        webPreferences: {
            //devTools: debug
        },

        resizable: true,
        maximizable: true
    }

    if (bounds.maximized === true) {
        winOptions.maximized = true
    } else {
        winOptions.useContentSize = true

        if (typeof bounds.x === 'string') {
            bounds.x =
                primaryScreen.workArea.x +
                parseFloat(bounds.x) * primaryScreen.width
        } else if (typeof bounds.x === 'number') {
            winOptions.x = bounds.x
        }

        if (typeof bounds.y === 'string') {
            bounds.y =
                primaryScreen.workArea.y +
                parseFloat(bounds.y) * primaryScreen.height
        } else if (typeof bounds.y === 'number') {
            winOptions.y = bounds.y
        }

        if (typeof bounds.width === 'string') {
            winOptions.width =
                parseFloat(bounds.width) * primaryScreen.workArea.width
        } else if (typeof bounds.width === 'number') {
            winOptions.width = bounds.width
        }

        if (typeof bounds.height === 'string') {
            winOptions.height =
                parseFloat(bounds.height) * primaryScreen.workArea.height
        } else if (typeof bounds.height === 'number') {
            winOptions.height = bounds.height
        }
    }

    makeWindowBoundsSafe(winOptions)

    windows.control = new BrowserWindow(winOptions)

    if (winOptions.maximized) {
        windows.control.maximize()
    }

    let onCloseMessage = event => {
        if (event.sender !== windows.control.webContents) {
            return false
        }

        let closing = true
        //This event happens when the user tries to close the control window
        //It is cancelled by the control window, which will wait until a 'can-close' message is sent

        //To ensure the control window can safely close, all other windows (excluding display) must be closed first
        //If any of them send a 'close-canceled' message, tell the control window it can't close
        ipcMain.once('close-canceled', event => {
            if (event.sender !== windows.control.webContents) {
                closing = false
                windows.control.webContents.send('cancel-close')
            }
        })

        //All windows which need to be closed
        let toClose = []

        for (let windowName in windows) {
            if (windows[windowName] && windowName !== 'control') {
                toClose.push(windows[windowName])
            }
        }

        for (let id in editors) {
            if (editors[id]) {
                toClose.push(editors[id])
            }
        }

        let closeNext = () => {
            if (!closing) {
                return false
            }

            if (toClose.length === 0) {
                windows.control.webContents.send('can-close')

                return false
            }

            //Remove a window, and close it
            //when it's closed, move onto the next one

            let win = toClose.pop()

            win.once('closed', closeNext)

            win.close()
        }

        closeNext()
    }

    ipcMain.on('close', onCloseMessage)

    windows.control.on('close', () => {
        bounds = windows.control.getContentBounds()

        settings.set('windows.control', {
            x: bounds.x,
            y: bounds.y,

            width: bounds.width,
            height: bounds.height,

            maximized: windows.control.isMaximized()
        })
    })
    windows.control.on('closed', () => {
        windows.control = null

        //Control window is fully closed, so program shutdown logic starts

        if (windows.display) {
            //Need to use destroy method instead of close,
            //As close method will trigger 'close' listener
            //Which will then save the display as off
            windows.display.destroy()
        }

        //Wait until settings have been written
        settings.forceSave(error => {
            if (error) {
                logger.error("Couldn't save settings on close!", error)
            }

            //If Mac, keep process running to respond to app events
            //Otherwise, quit
            if (process.platform !== 'darwin') {
                //If the logger is still saving logs, then wait a small amount of time before quitting
                if (logger.writing) {
                    //Quit after 2 seconds
                    setTimeout(app.quit, 1000 * 2)
                } else {
                    app.quit()
                }
            }
        })

        ipcMain.removeListener('close', onCloseMessage)
    })

    windows.control.webContents.on('new-window', onWinNewWindow)
    windows.control.webContents.on('will-navigate', onWinNavigate)

    windows.control.on('responsive', () => {})
    windows.control.on('unresponsive', () => {
        logger.warn('Control window became unresponsive')
    })
    windows.control.webContents.on('crashed', (event, killed) => {
        logger.error(
            'Control window crashed (killed = ' + killed.toString() + '):',
            event
        )

        if (!windows.control.isDestroyed()) {
            windows.control.destroy()
        }

        windows.control = null
        openControl()
    })
    windows.control.webContents.on(
        'did-fail-load',
        (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
            logger.error(
                'Control window failed to load (errorCode = ' +
                    errorCode.toString() +
                    ', errorDescription = ' +
                    errorDescription.toString() +
                    ', validatedURL = ' +
                    validatedURL.toString() +
                    ', isMainFrame = ' +
                    isMainFrame +
                    '):',
                event
            )

            dialog.showErrorBox(
                'Error Loading!',
                'Could not load Display Whisper!\nThere may be a problem with your installation.'
            )
        }
    )

    windows.control.webContents.on('did-finish-load', () => {
        windows.control.webContents.send('display-info', getDisplayInfo())

        while (controlMessageBuffer.length > 0) {
            windows.control.webContents.send(...controlMessageBuffer.pop())
        }
    })

    windows.control.loadURL(
        url.format({
            protocol: 'file:',
            slashes: true,
            pathname: path.join(appPath, 'windows/control.html')
        })
    )

    windows.control.setMenu(null)

    return windows.control
}

function openWindow(name) {
    if (windows[name]) {
        if (windows[name].isMinimized()) {
            windows[name].restore()
        }

        windows[name].focus()

        return windows[name]
    }

    if (name === 'display') {
        return openDisplay()
    } else if (name === 'control') {
        return openControl()
    } else if (typeof name !== 'string' || !windowNames.includes(name)) {
        return false
    }

    let bounds = settings.get('windows.' + name)
    if (typeof bounds !== 'object') {
        bounds = windowDefaults[name]
    }

    let winOptions = {
        parent: windows.control,

        show: false,

        modal: windowDefaults[name].modal || false,

        title: windowDefaults[name].title,

        minWidth: windowDefaults[name].minWidth,
        minHeight: windowDefaults[name].minHeight,

        maxWidth: windowDefaults[name].maxWidth,
        maxHeight: windowDefaults[name].maxHeight,

        icon: path.join(
            appPath,
            process.platform === 'darwin' ? 'icons/main.icns' : 'icons/main.ico'
        ),

        webPreferences: {
            //devTools: debug
        }
    }

    if (bounds.maximized === true) {
        winOptions.maximized = true
    } else {
        winOptions.useContentSize = true

        if (typeof bounds.x === 'string') {
            bounds.x =
                primaryScreen.workArea.x +
                parseFloat(bounds.x) * primaryScreen.width
        } else if (typeof bounds.x === 'number') {
            winOptions.x = bounds.x
        }

        if (typeof bounds.y === 'string') {
            bounds.y =
                primaryScreen.workArea.y +
                parseFloat(bounds.y) * primaryScreen.height
        } else if (typeof bounds.y === 'number') {
            winOptions.y = bounds.y
        }
        if (typeof bounds.width === 'string') {
            winOptions.width =
                parseFloat(bounds.width) * primaryScreen.workArea.width
        } else if (typeof bounds.width === 'number') {
            winOptions.width = bounds.width
        }

        if (typeof bounds.height === 'string') {
            winOptions.height =
                parseFloat(bounds.height) * primaryScreen.workArea.height
        } else if (typeof bounds.height === 'number') {
            winOptions.height = bounds.height
        }
    }

    if (typeof windowDefaults[name].resizable === 'boolean') {
        winOptions.resizable = windowDefaults[name].resizable

        if (winOptions.resizable === false) {
            winOptions.width = windowDefaults[name].width
            winOptions.height = windowDefaults[name].height
        }
    }
    if (typeof windowDefaults[name].maximizable === 'boolean') {
        winOptions.maximizable = windowDefaults[name].maximizable
    }

    makeWindowBoundsSafe(winOptions)

    if (winOptions.modal) {
        winOptions.minimizable = false
    }

    let win = new BrowserWindow(winOptions)

    windows[name] = win

    if (winOptions.maximized) {
        win.maximize()
    }

    win.on('close', () => {
        bounds = win.getContentBounds()

        settings.set('windows.' + name, {
            x: bounds.x,
            y: bounds.y,

            width: bounds.width,
            height: bounds.height,

            maximized: win.isMaximized()
        })
    })
    win.on('closed', () => {
        windows[name] = null
    })

    win.webContents.on('new-window', onWinNewWindow)
    win.webContents.on('will-navigate', onWinNavigate)

    win.on('unresponsive', () => {
        logger.warn('Window', name, 'became unresponsive')
    })
    win.webContents.on('crashed', (event, killed) => {
        logger.error(
            'Window ' + name + ' crashed (killed = ' + killed + '):',
            event
        )
    })
    win.webContents.on(
        'did-fail-load',
        (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
            logger.error(
                'Window (' +
                    name +
                    ') failed to load (errorCode = ' +
                    errorCode.toString() +
                    ', errorDescription = ' +
                    errorDescription.toString() +
                    ', validatedURL = ' +
                    validatedURL.toString() +
                    ', isMainFrame = ' +
                    isMainFrame +
                    '):',
                event
            )
        }
    )

    win.webContents.on('did-finish-load', () => {
        win.webContents.send('display-info', getDisplayInfo())
    })

    win.once('ready-to-show', () => {
        //this isn't ideal, but makes window loading look smoother (At the cost of being delayed)
        win.show()
    })

    //TODO: Test methods of making window loading quicker/simpler
    //Set URL to data;base64 html <script> tag?
    //Removes need for almost empty, duplicated html files
    /*
    win.loadURL(
        'data:text/html;charset=UTF-8,' +
            encodeURIComponent(
                '<link href="../fonts/fonts.css" rel="stylesheet"><body style="opacity:0;transition:opacity 0.2s"><script src="' +
                    name +
                    '.js"></script>'
            ),
        {
            baseURLForDataURL: path.join(appPath, 'windows', name + '.html')
        }
    )
    */

    win.loadURL(
        url.format({
            protocol: 'file:',
            slashes: true,
            pathname: path.join(appPath, 'windows', name + '.html')
        })
    )

    win.setMenu(null)

    return win
}

function getWindowFromWebContents(contents) {
    return BrowserWindow.fromWebContents(contents)
}

function openWindowAndSend(windowName, messageArray) {
    if (!windowNames.includes(windowName)) {
        return false
    }

    if (!Array.isArray(messageArray) || typeof messageArray[0] !== 'string') {
        openWindow(windowName)

        return false
    }

    if (windows[windowName]) {
        if (windows[windowName].isMinimized()) {
            windows[windowName].restore()
        }

        windows[windowName].focus()

        windows[windowName].webContents.send(...messageArray)

        return true
    }

    openWindow(windowName)

    windows[windowName].webContents.on('did-finish-load', () => {
        windows[windowName].webContents.send(...messageArray)
    })
}

function sendToControlWindow() {
    if (windows.control) {
        windows.control.webContents.send(...arguments)
    } else {
        controlMessageBuffer.push(arguments)
    }
}

function sendToAllWindows() {
    for (let i = 0; i < windowNames.length; i++) {
        if (windows[windowNames[i]]) {
            windows[windowNames[i]].webContents.send(...arguments)
        }
    }

    for (let id in editors) {
        editors[id].webContents.send(...arguments)
    }
}

function getDisplayInfo() {
    return {
        bounds: customDisplaySize.use
            ? {
                  x: display.bounds.x,
                  y: display.bounds.y,
                  width: customDisplaySize.width,
                  height: customDisplaySize.height
              }
            : display.bounds,

        screen: display.screen,
        screenCount: displays.length,
        show: display.show
    }
}

function openItemEditor(type, id, data = {}) {
    if (typeof type !== 'string') {
        return false
    }

    if (windows.control === null) {
        return false
    }

    if (editors[id]) {
        return editors[id].focus()
    }

    let win = new BrowserWindow({
        parent: windows.control,

        title: type.slice(0, 1).toUpperCase() + type.slice(1) + ' Editor',

        width: windowDefaults.editor.width,
        height: windowDefaults.editor.height,

        minWidth: windowDefaults.editor.minWidth,
        minHeight: windowDefaults.editor.minHeight,

        icon: path.join(
            appPath,
            process.platform === 'darwin' ? 'icons/main.icns' : 'icons/main.ico'
        ),

        webPreferences: {
            //devTools: debug
        }
    })

    //Store id with window instance
    //so that ipcMain can access it without searching through all editors
    win._editorID = win.webContents._editorID = id

    editors[id] = win

    win.on('closed', () => {
        delete editors[id]

        sendToControlWindow('edit-close', id)
    })

    win.webContents.on('new-window', onWinNewWindow)
    win.webContents.on('will-navigate', onWinNavigate)

    win.webContents.on('crashed', (event, killed) => {
        logger.error(
            'Editor ' + type + ' crashed (killed = ' + killed.toString() + '):',
            event
        )
    })

    win.webContents.on('did-finish-load', () => {
        win.webContents.send('display-info', getDisplayInfo())

        win.webContents.send('edit-data', data)
    })

    win.loadURL(
        url.format({
            protocol: 'file:',
            slashes: true,
            pathname: path.join(appPath, 'windows/editors/', type + '.html')
        })
    )

    win.setMenu(null)
}

let updateDisplayPosition

if (process.platform === 'darwin') {
    updateDisplayPosition = () => {
        windows.display.minmize()
        windows.display.setBounds(display.bounds)
        windows.display.maximize()
    }
} else {
    updateDisplayPosition = () => {
        windows.display.setBounds(display.bounds)
    }
}

function setDisplay(options) {
    let change = false

    //if a screen is set, always update it, ignoring if it's the same or not
    if (typeof options.screen === 'number') {
        display.screen = Math.max(
            0,
            Math.min(displays.length - 1, options.screen)
        )

        display.bounds = displays[display.screen].bounds

        if (windows.display && display.show) {
            updateDisplayPosition()
        }

        change = true
    } else if (display.screen < 0 || display.screen >= displays.length) {
        display.screen = Math.max(
            0,
            Math.min(displays.length - 1, display.screen)
        )

        display.bounds = displays[display.screen].bounds

        if (
            windows.display &&
            display.show &&
            (typeof options.show !== 'boolean' || options.show)
        ) {
            updateDisplayPosition()
        }

        change = true
    }

    if (typeof options.show === 'boolean' && options.show !== display.show) {
        display.show = options.show

        if (windows.display) {
            if (display.show === true) {
                updateDisplayPosition()
                windows.display.show()

                if (lastDisplayData !== null) {
                    windows.display.webContents.send('display', lastDisplayData)
                }
            } else {
                windows.display.hide()
            }
        } else if (display.show === true) {
            openDisplay()
        }

        change = true
    }

    if (change) {
        sendToAllWindows('display-info', getDisplayInfo())

        settings.set('display.screen', display.screen)
        settings.set('display.show', display.show)
    }
}

function setCustomDisplaySizeFromString(string) {
    if (typeof string !== 'string' || string.length === 0) {
        return false
    }

    let values = string.split('x')

    let width = values[0]
    let height = values[1].slice(0, values[1].indexOf(','))

    width = parseFloat(width)
    height = parseFloat(height)

    if (
        !isNaN(width) &&
        isFinite(width) &&
        width > 0 &&
        !isNaN(height) &&
        isFinite(height) &&
        height > 0
    ) {
        customDisplaySize.width = width
        customDisplaySize.height = height
    }
}

function isLatestVersion(callback) {
    if (typeof callback !== 'function') {
        return false
    }

    try {
        getURL(
            'https://raw.githubusercontent.com/brttd/display-whisper/builds/latest/info.json',
            response => {
                let text = ''

                response.on('data', data => {
                    text += data
                })

                response.on('end', () => {
                    if (text) {
                        try {
                            let data = JSON.parse(text)

                            if (typeof data.version === 'string') {
                                let exit = false

                                let currentVersion = app.getVersion().split('.')
                                let newVersion = data.version.split('.')

                                logger.info(
                                    'Checking versions, current:',
                                    currentVersion,
                                    'new:',
                                    newVersion,
                                    'text',
                                    text
                                )

                                for (
                                    let i = 0;
                                    i < currentVersion.length &&
                                    i < newVersion.length &&
                                    exit === false;
                                    i++
                                ) {
                                    let current = parseInt(currentVersion[i])
                                    let latest = parseInt(newVersion[i])

                                    if (isFinite(current) && isFinite(latest)) {
                                        if (current < latest) {
                                            callback(null, data.version)
                                            exit = true
                                        } else if (current > latest) {
                                            callback(null, false)
                                            exit = true
                                        }
                                    }
                                }

                                if (!exit) {
                                    callback(null, false)
                                }
                            } else {
                                callback(null, false)

                                logger.error(
                                    'latest/info.json did not contain version!'
                                )
                            }
                        } catch (error) {
                            callback(error, false)

                            logger.error(
                                'Unable to get latest version info:',
                                error
                            )
                        }
                    } else {
                        callback(true, false)

                        logger.error(
                            'Get latest version response ended with no data!'
                        )
                    }
                })
            }
        ).on('error', error => {
            logger.error('https.get error:', error)

            callback(null, false)
        })
    } catch (error) {
        logger.error('Unable to send version request!', error)

        callback(null, false)
    }
}

function checkForUpdate() {
    isLatestVersion((error, version) => {
        if (error) {
            sendToControlWindow(
                'show-message',
                'Unable to find latest application version.',
                'error'
            )

            return false
        }

        if (version) {
            sendToControlWindow('update-available', version)

            if (!windows.control) {
                openControl()
            }
        } else {
            sendToControlWindow(
                'show-message',
                'You are using the latest version!',
                'success'
            )
        }
    })
}

//MacOS Menu
if (process.platform === 'darwin') {
    const appMenu = new Menu()

    function onMenuClick(item) {
        if (typeof item.window === 'string') {
            openWindow(item.window)

            return
        } else if (typeof item.url === 'string') {
            shell.openExternal(item.url)

            return
        } else if (typeof item.function === 'function') {
            item.function()

            return
        }

        let activeWindow = BrowserWindow.getFocusedWindow()

        if (item.sendTo === 'active') {
            if (activeWindow) {
                if (Array.isArray(item.value)) {
                    activeWindow.webContents.send(
                        'menu',
                        item.message,
                        ...item.value
                    )
                } else {
                    activeWindow.webContents.send(
                        'menu',
                        item.message,
                        item.value
                    )
                }
            }

            return
        } else if (item.sendTo === 'control') {
            if (Array.isArray(item.value)) {
                sendToControlWindow('menu', item.message, ...item.value)
            } else {
                sendToControlWindow('menu', item.message, item.value)
            }

            if (!windows.control) {
                openControl()
            }
        }
    }

    function cleanItem(item) {
        if (typeof item !== 'object' || item === null) {
            return {}
        }

        if (item.hasOwnProperty('submenu')) {
            let cleaned = []

            if (Array.isArray(item.submenu)) {
                for (let i = 0; i < item.submenu.length; i++) {
                    if (
                        typeof item.submenu[i] === 'object' &&
                        item.submenu[i] !== null
                    ) {
                        item.submenu[i].topContext =
                            item.topContext || item.context
                        item.submenu[i].context =
                            item.submenu[i].context || item.context

                        cleaned.push(cleanItem(item.submenu[i]))
                    }
                }
            }

            item.submenu = cleaned
        }

        return {
            window: item.window || null,
            url: item.url || null,
            function: item.function || null,

            sendTo: item.sendTo || null,

            message: item.message || null,
            value: item.value || null,

            topContext: item.topContext || item.context || '',
            context: item.context || '',
            value: item.value || '',

            click: onMenuClick,
            role: item.role,
            type: item.type,
            label: item.label,
            sublabel: item.sublabel,
            accelerator: item.accelerator,
            icon: item.icon,
            enabled: item.enabled,
            checked: item.checked,
            submenu: item.submenu
        }
    }

    appMenu.append(
        new MenuItem(
            cleanItem({
                label: 'Display Whisper',

                submenu: [
                    {
                        label: 'About Display Whisper',
                        window: 'about'
                    },
                    {
                        label: 'Check For Updates',
                        function: checkForUpdate
                    },
                    {
                        type: 'separator'
                    },
                    {
                        label: 'Preferences...',
                        window: 'preferences'
                    },
                    {
                        type: 'separator'
                    },
                    {
                        label: 'Quit',
                        function: () => {
                            if (windows.control) {
                                windows.control.close()
                            }
                        }
                    }
                ]
            })
        )
    )
    appMenu.append(
        new MenuItem(
            cleanItem({
                label: 'File',
                context: 'file',

                submenu: [
                    {
                        label: 'New Presentation',
                        sendTo: 'control',

                        message: 'file',
                        value: 'new'
                    },
                    {
                        label: 'Open Presentation...',
                        sendTo: 'control',

                        message: 'file',
                        value: 'open'
                    },
                    /*
                    Temporarily(?) disabled
                    {
                        label: 'Open Recent',
                        sendTo: 'control',

                        context: 'open',
        
                        submenu: []
                    },
                    */
                    {
                        type: 'separator'
                    },
                    {
                        label: 'Save',
                        sendTo: 'control',

                        message: 'file',
                        value: 'save'
                    },
                    {
                        label: 'Save As...',
                        sendTo: 'control',

                        message: 'file',
                        value: 'save-as'
                    }
                ]
            })
        )
    )
    /*
    appMenu.append(
        new MenuItem(
            cleanItem({
                label: 'Edit',

                context: 'edit',

                submenu: [
                    {
                        label: 'Undo',
                        sendTo: 'active',

                        message: 'edit',
                        value: 'undo'
                    },
                    {
                        label: 'Redo',
                        sendTo: 'active',

                        message: 'edit',
                        value: 'redo'
                    }
                ]
            })
        )
    )
    */
    appMenu.append(
        new MenuItem(
            cleanItem({
                label: 'Library',

                submenu: [
                    {
                        label: 'Songs...',
                        window: 'songDatabase'
                    },
                    {
                        label: 'Images...',
                        window: 'imageDatabase'
                    }
                ]
            })
        )
    )
    appMenu.append(
        new MenuItem(
            cleanItem({
                label: 'Tools',

                submenu: [
                    {
                        label: 'Add Song...',
                        window: 'songAdd'
                    },
                    {
                        label: 'Import Songs...',
                        window: 'songImport'
                    },
                    {
                        label: 'Export Songs...',
                        window: 'songExport'
                    },
                    {
                        label: 'Check Songs...',
                        window: 'songCheck'
                    },
                    {
                        type: 'separator'
                    },
                    {
                        label: 'Print...',
                        window: 'print'
                    },
                    {
                        type: 'separator'
                    },
                    {
                        label: 'Edit Templates...',
                        window: 'templateEditor'
                    }
                ]
            })
        )
    )
    appMenu.append(
        new MenuItem(
            cleanItem({
                label: 'Help',

                submenu: [
                    {
                        label: 'Help...',
                        window: 'help'
                    },
                    {
                        type: 'separator'
                    },
                    {
                        label: 'Report Issue (GitHub)...',
                        url:
                            'https://github.com/brttd/display-whisper/issues/new'
                    },
                    {
                        label: 'Report Issue (Email)...',
                        url:
                            'mailto://displaywhisper@brettdoyle.uk?subject=Display%20Whisper%20-%20issue'
                    },
                    {
                        type: 'separator'
                    },
                    {
                        label: 'View Log',
                        window: 'log'
                    }
                ]
            })
        )
    )

    const debugMenu = new MenuItem(
        cleanItem({
            label: 'Debug',

            submenu: [
                {
                    label: 'Open DevTools...',

                    function: () => {
                        let active = BrowserWindow.getFocusedWindow()

                        if (active) {
                            active.webContents.openDevTools()
                        }
                    }
                },
                {
                    label: 'Open Log...',
                    window: 'log'
                },
                {
                    type: 'separator'
                },
                {
                    label: 'Disable Debug',

                    function: () => {
                        settings.set('debug.enable', false)
                    }
                }
            ]
        })
    )

    if (settings.get('debug.enable', false)) {
        appMenu.append(debugMenu)
    }

    app.on('ready', () => {
        Menu.setApplicationMenu(appMenu)

        settings.listen('debug.enable', value => {
            if (value) {
                appMenu.append(debugMenu)

                Menu.setApplicationMenu(appMenu)
            }
        })
    })
}

//Window messages
{
    ipcMain.on('open-window', (event, name, messageArray) => {
        openWindowAndSend(name, messageArray)
    })

    ipcMain.on('show-dialog', (event, type, options = {}) => {
        let win = getWindowFromWebContents(event.sender)

        switch (type) {
            case 'open':
                dialog.showOpenDialog(win, options, files => {
                    if (!event.sender.isDestroyed()) {
                        event.sender.send(
                            'open-dialog-return',
                            files,
                            options.id
                        )
                    }
                })
                break
            case 'save':
                dialog.showSaveDialog(win, options, filename => {
                    if (!event.sender.isDestroyed()) {
                        event.sender.send(
                            'save-dialog-return',
                            filename,
                            options.id
                        )
                    }
                })
                break
            case 'message':
                dialog.showMessageBox(win, options, (index, checked) => {
                    if (!event.sender.isDestroyed()) {
                        event.sender.send(
                            'message-dialog-return',
                            index,
                            checked,
                            options.id
                        )
                    }
                })
                break
            case 'error':
                dialog.showErrorBox(
                    options.title || 'Error',
                    options.content || ''
                )
                break
        }
    })

    ipcMain.on('database-updated', (event, databaseName, from, changes) => {
        sendToAllWindows('database-updated', databaseName, from, changes)
    })

    ipcMain.on('check-version', event => {
        checkForUpdate()
    })

    ipcMain.on('quit', event => {
        if (windows.control) {
            windows.control.close()
        }
    })
}

//Display events
//============================================
{
    ipcMain.on('display', (event, data) => {
        if (windows.display && display.show) {
            windows.display.webContents.send('display', data)
        }

        lastDisplayData = data
        lastDisplayData.transition = {}
    })

    ipcMain.on('change-display', (event, data) => {
        setDisplay(data)

        //If the window sends a show display command, the display window opening will give it focus
        //But the original window should retain focus, so it needs to be refocused
        if (!event.sender.isFocused()) {
            event.sender.focus()
        }
    })

    ipcMain.on('display-command', (event, argument) => {
        if (windows.control) {
            windows.control.webContents.send('playlist', argument)
        }
    })

    ipcMain.on('display-blank', (event, blank) => {
        if (!windows.control) {
            return false
        }

        if (event.sender === windows.control.webContents) {
            if (windows.display) {
                windows.display.webContents.send('display-blank', blank)
            }
        } else {
            windows.control.webContents.send('display-blank', blank)
        }
    })
}

//Edit events
//============================================
{
    //from control window
    ipcMain.on('start-edit', (event, editor, id, data) =>
        openItemEditor(editor, id, data)
    )
    ipcMain.on('stop-edit', (event, id) => {
        if (editors[id]) {
            editors[id].destroy()

            delete editors[id]

            sendToControlWindow('edit-close', id)
        }
    })

    ipcMain.on('lock-edit', (event, id) => {
        if (editors[id]) {
            editors[id].webContents.send('lock')
        }
    })
    ipcMain.on('unlock-edit', (event, id) => {
        if (editors[id]) {
            editors[id].webContents.send('unlock')
        }
    })

    ipcMain.on('edit-data', (event, id, data) => {
        if (editors[id]) {
            editors[id].webContents.send('edit-data', data)
        }
    })

    //from editor windows
    ipcMain.on('edit', (event, data) => {
        if (event.sender._editorID) {
            sendToControlWindow('edit', event.sender._editorID, data)
        } else {
            logger.error(
                'edit message recieved from webcontents with no _editorID property!'
            )
        }
    })
}

//Gets, and listens for information about system displays
function setupDisplays() {
    if (!screen) {
        screen = electron.screen
    }
    displays = screen.getAllDisplays()

    primaryScreen = screen.getPrimaryDisplay()

    customDisplaySize.use = settings.get(
        'display.setSize',
        customDisplaySize.use
    )

    setCustomDisplaySizeFromString(
        settings.get('display.displaySize', '1280x720, 16:9 - HD')
    )

    //load default screen, and display show/hide from settings
    //If screen isn't set, use second screen if available, otherwise first
    setDisplay({
        screen: settings.get(
            'display.screen',
            Math.min(1, displays.length - 1)
        ),
        show: settings.get('display.show', false)
    })

    screen.on('display-added', (event, newDisplay) => {
        displays.push(newDisplay)

        sendToAllWindows('display-info', getDisplayInfo())
    })

    screen.on('display-removed', (event, oldDisplay) => {
        let index = displays.findIndex(display => display.id === oldDisplay.id)

        displays = screen.getAllDisplays()
        //displays.splice(index, 1)

        if (display.screen === index) {
            //If the display in use was removed, hide display
            setDisplay({ show: false })
        } else {
            if (display.screen > index) {
                setDisplay({ screen: display.screen - 1 })
            } else {
                sendToAllWindows('display-info', getDisplayInfo())
            }
        }
    })

    screen.on('display-metrics-changed', (event, changedDisplay) => {
        let index = displays.findIndex(
            display => display.id === changedDisplay.id
        )
        displays[index] = changedDisplay

        if (display.screen === index) {
            setDisplay({ screen: display.screen })
        } else {
            sendToAllWindows('display-info', getDisplayInfo())
        }
    })

    settings.listen('display.setSize', value => {
        customDisplaySize.use = value

        sendToAllWindows('display-info', getDisplayInfo())
    })

    settings.listen('display.displaySize', value => {
        setCustomDisplaySizeFromString(value)

        if (customDisplaySize.use) {
            sendToAllWindows('display-info', getDisplayInfo())
        }
    })
}

//App events
//============================================
{
    let isSingleInstance = app.requestSingleInstanceLock()

    if (!isSingleInstance) {
        app.exit()
    }

    app.on('second-instance', (event, args) => {
        if (args.length > 1) {
            if (path.isAbsolute(args[args.length - 1])) {
                sendToControlWindow('open-file', args[args.length - 1])
            }
        }

        if (windows.control) {
            if (windows.control.isMinimized()) {
                windows.control.restore()
            }

            windows.control.focus()
        } else {
            openControl()
        }
    })

    if (process.argv.length > 1) {
        let pathArgument = process.argv[process.argv.length - 1]

        if (path.isAbsolute(pathArgument)) {
            if (
                path
                    .extname(pathArgument)
                    .toLowerCase()
                    .endsWith('.dpl')
            ) {
                sendToControlWindow('open-file', pathArgument)
            }
        }
    }

    app.on('ready', () => {
        settings.load()

        debug = settings.get('debug.enable', false)
        settings.listen('debug.enable', value => {
            debug = value
        })

        setupDisplays()

        loadWindowDefaults()

        openControl()

        if (debug) {
            openWindow('test')
        }

        isLatestVersion((error, version) => {
            if (error) {
                return false
            }

            if (version) {
                setTimeout(() => {
                    if (windows.control) {
                        windows.control.webContents.send(
                            'update-available',
                            version
                        )
                    }
                }, 5000)
            }
        })
    })

    //The app shutdown is handled in the control window code
    //Subscribing to the window-all-closed event stops the app automatically quitting,
    //So that the control window can do everything needed
    app.on('window-all-closed', () => {})

    //Mac events
    //Should listen for this event before 'ready' event
    app.on('open-file', (event, filePath) => {
        event.preventDefault()

        if (filePath) {
            sendToControlWindow('open-file', filePath)
        } else {
            logger.warn('app "open-file" was emitted without passing a path')
        }
    })

    app.on('activate', () => {
        if (windows.control) {
            windows.control.focus()
        } else {
            openControl()
        }
    })
}
