const electron = require('electron')
const { app, BrowserWindow, dialog, ipcMain, Menu, MenuItem } = electron

const path = require('path')
const fs = require('fs')
const url = require('url')

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
//Current screens(s) being used
let display = {
    //Master display size
    bounds: {
        width: 0,
        height: 0
    },

    //List of displays in use:
    /*
    {
        bounds: display.bounds,
        screen: index of display in displays array
        window: BrowserWindow instance
    }
    */
    screens: [],

    //Where to get the master display size from
    //Either "Smallest", "Average", "Largest", or "Custom"
    masterScale: 'Largest'
}

//Used when display is re-opened, so that it correctly shows the current section
let lastDisplayData = null

//User settings
//All logic is done inside the main JS script, so that there's a simple system for requesting & setting values, and sending updates to windows which requested values
const settings = {}
{
    const settingsPath = path.join(app.getPath('userData'), 'settings.json')

    let lastSaveTime = 0
    let lastChangeTime = 0

    let saveDelay = 2000

    let loaded = false

    let cache = {}

    let listeners = {}

    function save(callback) {
        let actualLastSaveTime = lastSaveTime
        lastSaveTime = Date.now()

        fs.writeFile(settingsPath, JSON.stringify(cache, null, 2), error => {
            if (error) {
                logger.error('Unable to save settings file:', error)

                sendToControlWindow(
                    'show-message',
                    'An error occurred while saving application preferences! View log for more details.',
                    'error'
                )

                if (typeof callback === 'function') {
                    callback(error)
                }

                lastSaveTime = actualLastSaveTime

                saveDelay += 1000
                attemptSave()

                return false
            }

            saveDelay = 2000

            if (typeof callback === 'function') {
                callback(error)
            }
        })
    }

    function attemptSave() {
        if (lastChangeTime >= lastSaveTime) {
            setTimeout(() => {
                if (Date.now() - saveDelay > lastSaveTime) {
                    save()
                }
            }, saveDelay + 20)
        }
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
        lastChangeTime = Date.now()
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

                lastSaveTime = Date.now() + 1

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
        if (lastChangeTime >= lastSaveTime) {
            save(callback)
        } else {
            callback()
        }
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
    electron.shell.openExternal(url)

    logger.log('A window opened url:', url)
}
function onWinNavigate(event, url) {
    logger.log('A window attempted to navigate to:', url)

    event.preventDefault()
}

function openDisplayWindow(screenIndex) {
    //screenIndex is the index of the screen in display.screens

    if (screenIndex < 0 || screenIndex >= display.screens.length) {
        return false
    }

    if (display.screens[screenIndex].window) {
        updateDisplayPosition(screenIndex)
        display.screens[screenIndex].window.focus()

        return display.screens[screenIndex].window
    }

    let displayWindow = new BrowserWindow({
        width: display.screens[screenIndex].bounds.width,
        height: display.screens[screenIndex].bounds.height,
        x: display.screens[screenIndex].bounds.x,
        y: display.screens[screenIndex].bounds.y,

        icon: path.join(appPath, 'icons/app.ico'),

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

    display.screens[screenIndex].window = displayWindow

    displayWindow.on('close', () => {
        let newScreenIndex = display.screens.findIndex(subDisplay => {
            return subDisplay.window === displayWindow
        })

        if (newScreenIndex !== -1) {
            removeDisplayScreen(newScreenIndex)
        }
    })
    displayWindow.on('closed', () => {
        let newScreenIndex = display.screens.findIndex(subDisplay => {
            return subDisplay.window === displayWindow
        })

        if (newScreenIndex !== -1) {
            display.screens[newScreenIndex].window = null
        }

        displayWindow = undefined
    })

    displayWindow.webContents.on('new-window', onWinNewWindow)
    displayWindow.webContents.on('will-navigate', onWinNavigate)

    let isUnresponsive = false

    displayWindow.on('unresponsive', () => {
        logger.warn('Display became unresponsive')

        //Wait 3 seconds, and restart if still unresponsive
        setTimeout(() => {
            if (isUnresponsive && displayWindow) {
                if (!displayWindow.isDestroyed) {
                    displayWindow.close()
                }

                sendToControlWindow(
                    'show-message',
                    'An error occurred with the display!',
                    'warning'
                )
            }
        }, 3000)
    })

    displayWindow.on('responsive', () => {
        isUnresponsive = false
    })

    displayWindow.webContents.on('crashed', (event, killed) => {
        logger.error('Display window crashed!', event, killed)

        if (!displayWindow.isDestroyed()) {
            displayWindow.close()
        }

        sendToControlWindow(
            'show-message',
            'A crash occurred with the display!',
            'warning'
        )
    })
    displayWindow.webContents.on(
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

    displayWindow.webContents.on('did-finish-load', () => {
        displayWindow.webContents.send('display-info', getDisplayInfo())

        //when reopening the display window,
        //re-display whatever was last displayed
        if (lastDisplayData !== null) {
            displayWindow.webContents.send('display', lastDisplayData)
        }

        let newScreenIndex = display.screens.findIndex(subDisplay => {
            return subDisplay.window === displayWindow
        })

        if (newScreenIndex !== -1) {
            updateDisplayPosition(newScreenIndex)
            displayWindow.show()
        }
    })

    displayWindow.loadURL(
        url.format({
            protocol: 'file:',
            slashes: true,
            pathname: path.join(appPath, 'windows/display.html')
        })
    )

    if (debug) {
        displayWindow.webContents.openDevTools()
    }

    displayWindow.setMenu(null)

    return displayWindow
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

        icon: path.join(appPath, 'icons/app.ico'),

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

        for (
            let screenIndex = 0;
            screenIndex < display.screens.length;
            screenIndex++
        ) {
            if (display.screens[screenIndex].window) {
                display.screens[screenIndex].window.destroy()
            }
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
        return openDisplayWindow()
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

        icon: path.join(appPath, 'icons/app.ico'),

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

    if (windowDefaults[name].menu) {
        win.setMenu(appMenus.get(windowDefaults[name].menu))
    } else if (!debug) {
        win.setMenu(null)
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

    for (let i = 0; i < display.screens.length; i++) {
        if (display.screens[i].window) {
            display.screens[i].window.webContents.send(...arguments)
        }
    }

    for (let id in editors) {
        editors[id].webContents.send(...arguments)
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

        icon: path.join(appPath, 'icons/app.ico'),

        webPreferences: {
            //devTools: debug
        }
    })

    //Store id with window instance
    //so that ipcMain can access it without searching through all editors
    win._editorID = win.webContents._editorID = id

    editors[id] = win

    if (windowDefaults.editor.menu) {
        win.setMenu(appMenus.get(windowDefaults.editor.menu))
    } else {
        win.setMenu(null)
    }

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
}

function getDisplayInfo() {
    return {
        bounds: {
            width: display.bounds.width,
            height: display.bounds.height
        },

        screens: display.screens.map(subDisplay => subDisplay.screen),
        screenCount: displays.length
    }
}

function updateMasterDisplay() {
    if (display.masterScale !== 'Custom') {
        if (display.screens.length === 0) {
            //The current master display is based on the output displays
            //But there are currently no active output displays

            //So, either use the last set master display size
            //Or use the custom size

            if (display.bounds.width > 0 && display.bounds.height > 0) {
                //There already is a valid display width & height,
                //use it without changing anything

                sendToAllWindows('display-info', getDisplayInfo())

                return true
            }
            //There isn't a valid display width & height
            //Use the custom size instead
            //(Done at the end of the function)
        } else {
            if (display.masterScale === 'Smallest') {
                display.bounds.width = Infinity
                display.bounds.height = Infinity

                for (
                    let screenIndex = 0;
                    screenIndex < display.screens.length;
                    screenIndex++
                ) {
                    let newBounds = display.screens[screenIndex].bounds

                    //If the pixel count is smaller, or if the pixel count is the same and the aspect ratio smaller
                    //(The aspect ratio check is to ensure that the master display selected is not dependant on the order displays were selected as outputs)
                    if (
                        newBounds.width * newBounds.height <
                            display.bounds.width * display.bounds.height ||
                        (newBounds.width * newBounds.height ===
                            display.bounds.width * display.bounds.height &&
                            newBounds.width / newBounds.height <
                                display.bounds.width / display.bounds.height)
                    ) {
                        display.bounds.width = newBounds.width
                        display.bounds.height = newBounds.height
                    }
                }
            } else if (display.masterScale === 'Largest') {
                display.bounds.width = 0
                display.bounds.height = 0

                for (
                    let screenIndex = 0;
                    screenIndex < display.screens.length;
                    screenIndex++
                ) {
                    let newBounds = display.screens[screenIndex].bounds

                    //If the pixel count is larger, or if the pixel count is the same and the aspect ratio larger
                    //(The aspect ratio check is to ensure that the master display selected is not dependant on the order displays were selected as outputs)
                    if (
                        newBounds.width * newBounds.height >
                            display.bounds.width * display.bounds.height ||
                        (newBounds.width * newBounds.height ===
                            display.bounds.width * display.bounds.height &&
                            newBounds.width / newBounds.height >
                                display.bounds.width / display.bounds.height)
                    ) {
                        display.bounds.width = newBounds.width
                        display.bounds.height = newBounds.height
                    }
                }
            } else {
                //Average
                display.bounds.width = 0
                display.bounds.height = 0

                for (
                    let screenIndex = 0;
                    screenIndex < display.screens.length;
                    screenIndex++
                ) {
                    display.bounds.width +=
                        display.screens[screenIndex].bounds.width
                    display.bounds.height +=
                        display.screens[screenIndex].bounds.height
                }

                display.bounds.width /= display.screens.length
                display.bounds.height /= display.screens.length
            }

            if (
                isFinite(display.bounds.width) &&
                isFinite(display.bounds.height) &&
                display.bounds.width > 0 &&
                display.bounds.height > 0
            ) {
                sendToAllWindows('display-info', getDisplayInfo())

                return true
            }
        }
    }

    //Otherwise, use custom display size
    display.bounds.width = settings.get('display.customWidth', 1366)
    display.bounds.height = settings.get('display.customHeight', 768)

    sendToAllWindows('display-info', getDisplayInfo())
}

let updateDisplayPosition

if (process.platform === 'darwin') {
    updateDisplayPosition = screenIndex => {
        if (
            screenIndex < 0 ||
            screenIndex >= display.screens.length ||
            !display.screens[screenIndex].window
        ) {
            return false
        }

        display.screens[screenIndex].window.setFullScreen(false)
        display.screens[screenIndex].window.setBounds(
            display.screens[screenIndex].bounds
        )
        display.screens[screenIndex].window.setFullScreen(true)
    }
} else {
    updateDisplayPosition = screenIndex => {
        if (
            screenIndex < 0 ||
            screenIndex >= display.screens.length ||
            !display.screens[screenIndex].window
        ) {
            return false
        }

        display.screens[screenIndex].window.setBounds(
            display.screens[screenIndex].bounds
        )
    }
}

function updateDisplayScreen(screenIndex) {
    if (screenIndex < 0 || screenIndex >= display.screens.length) {
        return false
    }

    display.screens[screenIndex].screen = Math.min(
        display.screens[screenIndex].screen,
        displays.length - 1
    )

    display.screens[screenIndex].bounds =
        displays[display.screens[screenIndex].screen].bounds

    if (display.screens[screenIndex].window) {
        updateDisplayPosition(screenIndex)
    } else {
        openDisplayWindow(screenIndex)
    }
}

function addDisplayScreen(displayIndex) {
    if (displayIndex < 0 || displayIndex >= displays.length) {
        return false
    }

    let alreadyDisplaying = display.screens.find(
        subDisplay => subDisplay.screen === displayIndex
    )

    if (alreadyDisplaying) {
        return false
    }

    display.screens.push({
        bounds: displays[displayIndex].bounds,
        screen: displayIndex
    })

    openDisplayWindow(display.screens.length - 1)

    settings.set(
        'display.defaultScreens',
        display.screens.map(subDisplay => subDisplay.screen)
    )

    if (display.masterScale === 'Custom') {
        sendToControlWindow('display-info', getDisplayInfo())
    } else {
        updateMasterDisplay()
    }
}
function removeDisplayScreen(screenIndex) {
    if (screenIndex < 0 || screenIndex >= display.screens.length) {
        return false
    }

    let removedDisplay = display.screens.splice(screenIndex, 1)[0]

    if (removedDisplay.window) {
        removedDisplay.window.destroy()
    }

    settings.set(
        'display.defaultScreens',
        display.screens.map(subDisplay => subDisplay.screen)
    )

    if (display.masterScale === 'Custom') {
        sendToControlWindow('display-info', getDisplayInfo())
    } else {
        updateMasterDisplay()
    }
}
function toggleDisplayScreen(index) {
    let screenIndex = display.screens.findIndex(
        subDisplay => subDisplay.screen === index
    )

    if (screenIndex === -1) {
        addDisplayScreen(index)
    } else {
        removeDisplayScreen(screenIndex)
    }
}

function isLatestVersion(callback) {
    if (typeof callback !== 'function') {
        return false
    }
    let https = require('https')

    try {
        https
            .get(
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

                                    let currentVersion = app
                                        .getVersion()
                                        .split('.')
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
                                        let current = parseInt(
                                            currentVersion[i]
                                        )
                                        let latest = parseInt(newVersion[i])

                                        if (
                                            isFinite(current) &&
                                            isFinite(latest)
                                        ) {
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
            )
            .on('error', error => {
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

//Application Menu
const appMenus = {
    main: new Menu()
}
{
    const dynamicItems = {}
    const allAcceleratorItems = []
    const acceleratorItemFunctions = {}

    const prebuiltMenus = {}

    function onMenuClick(item) {
        if (typeof item.window === 'string') {
            openWindow(item.window)

            return
        } else if (typeof item.url === 'string') {
            electron.shell.openExternal(item.url)

            return
        } else if (typeof item.function === 'function') {
            item.function()

            return
        }

        let event = {
            parentItem: item.parentItem,

            label: item.label,
            value: item.value
        }

        if (item.sendTo === 'active') {
            let activeWindow = BrowserWindow.getFocusedWindow()

            if (activeWindow) {
                if (Array.isArray(item.value)) {
                    activeWindow.webContents.send('menu', event)
                } else {
                    activeWindow.webContents.send('menu', event)
                }
            }

            return
        } else {
            if (Array.isArray(item.value)) {
                openWindowAndSend(item.sendTo, ['menu', event])
            } else {
                openWindowAndSend(item.sendTo, ['menu', event])
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
                        item.submenu[i].parentItem = item.label

                        cleaned.push(cleanItem(item.submenu[i]))
                    }
                }
            }

            item.submenu = cleaned
        }

        let defaults = {
            enabled: true,
            visible: true
        }

        if (
            typeof item.defaults === 'object' &&
            !Array.isArray(item.defaults) &&
            item.defaults !== null
        ) {
            if (typeof item.defaults.enabled === 'boolean') {
                defaults.enabled = item.defaults.enabled
            }
            if (typeof item.defaults.visible === 'boolean') {
                defaults.visible = item.defaults.visible
            }
        }

        return {
            window: item.window || null,
            url: item.url || null,
            function: item.function || null,

            defaults: defaults,
            static: item.static || item.role === 'seperator' || false,

            parentItem: item.parentItem || '',

            sendTo: item.sendTo || null,
            value: item.value || item.label || '',

            click: onMenuClick,
            role: item.role,
            type: item.type,
            label: item.label,
            sublabel: item.sublabel,
            accelerator: item.accelerator,
            icon: item.icon,
            enabled: item.enabled,
            submenu: item.submenu,

            //If the item has a role, register it's accelerator
            //Otherwise, don't (Layout module registers it instead)
            registerAccelerator: item.role === undefined ? false : true
        }
    }

    function updateMenuToWindow(win) {
        if (!win) {
            return false
        }

        if (typeof win.menuChanges !== 'object') {
            win.menuChanges = {}
        }

        for (let itemId in dynamicItems) {
            if (win.menuChanges[itemId]) {
                if (typeof win.menuChanges[itemId].enabled === 'boolean') {
                    dynamicItems[itemId].enabled =
                        win.menuChanges[itemId].enabled
                } else {
                    dynamicItems[itemId].enabled =
                        dynamicItems[itemId].defaults.enabled
                }

                if (typeof win.menuChanges[itemId].visible === 'boolean') {
                    dynamicItems[itemId].visible =
                        win.menuChanges[itemId].visible
                } else {
                    dynamicItems[itemId].visible =
                        dynamicItems[itemId].defaults.visible
                }
            } else {
                //If the window doesn't have changes for this menu item, use the default
                dynamicItems[itemId].enabled =
                    dynamicItems[itemId].defaults.enabled

                dynamicItems[itemId].visible =
                    dynamicItems[itemId].defaults.visible
            }
        }
    }

    function modifyWindowItem(win, itemID, changes) {
        if (!win) {
            return false
        }

        if (typeof win.menuChanges !== 'object') {
            win.menuChanges = {}
        }

        if (typeof win.menuChanges[itemID] !== 'object') {
            win.menuChanges[itemID] = {}
        }

        if (typeof changes.enabled === 'boolean') {
            win.menuChanges[itemID].enabled = changes.enabled
        }
        if (typeof changes.visible === 'boolean') {
            win.menuChanges[itemID].visible = changes.visible
        }

        if (win.isFocused()) {
            updateMenuToWindow(win)
        }
    }

    function sendAcceleratorsToWindow(win) {
        for (let i = 0; i < allAcceleratorItems.length; i++) {
            win.webContents.send(
                'register-menu-accelerator',
                allAcceleratorItems[i]
            )
        }
    }

    //Populate the dynamicItems object with menu items
    //Also populate the allAcceleratorItems array
    function addMenuItemToList(item) {
        let itemId = item.label.toLowerCase() + '-'

        let toCheck = item.submenu.items

        for (let i = 0; i < toCheck.length; i++) {
            if (toCheck[i].static !== true) {
                dynamicItems[
                    itemId +
                        (toCheck[i].value || toCheck[i].label).toLowerCase()
                ] = toCheck[i]
            }

            if (toCheck[i].accelerator && !toCheck[i].role) {
                if (typeof toCheck[i].function === 'function') {
                    let name = toCheck[i].parentItem + '-' + toCheck[i].label

                    acceleratorItemFunctions[name] = toCheck[i].function

                    allAcceleratorItems.push({
                        parentItem: toCheck[i].parentItem,

                        sendMessage: name,

                        type: toCheck[i].type,
                        label: toCheck[i].label,
                        sublabel: toCheck[i].sublabel,
                        accelerator: toCheck[i].accelerator,
                        enabled: toCheck[i].enabled
                    })
                } else {
                    allAcceleratorItems.push({
                        parentItem: toCheck[i].parentItem,

                        window: toCheck[i].window,
                        value: toCheck[i].value,

                        type: toCheck[i].type,
                        label: toCheck[i].label,
                        sublabel: toCheck[i].sublabel,
                        accelerator: toCheck[i].accelerator,
                        enabled: toCheck[i].enabled
                    })
                }
            }

            if (toCheck[i].submenu) {
                addMenuItemToList(toCheck[i])
            }
        }
    }

    const items = {
        app: new MenuItem(
            cleanItem({
                label: 'Application',

                submenu: [
                    {
                        label: 'About Display Whisper',
                        window: 'about',

                        static: true
                    },
                    {
                        label: 'Check For Updates',
                        function: checkForUpdate,

                        static: true
                    },
                    {
                        type: 'separator'
                    },
                    {
                        label: 'Preferences...',
                        window: 'preferences',

                        accelerator: 'CmdOrCtrl+,',

                        static: true
                    },
                    //On MacOS the menu should also include a 'Quit' option
                    process.platform === 'darwin'
                        ? ({
                              type: 'separator'
                          },
                          {
                              label: 'Quit Display Whisper',

                              function: () => {
                                  if (windows.control) {
                                      windows.control.close()
                                  }
                              },

                              accelerator: 'CmdOrCtrl+Q',

                              static: true
                          })
                        : null
                ]
            })
        ),
        file: new MenuItem(
            cleanItem({
                label: 'File',

                submenu: [
                    {
                        label: 'New Presentation',

                        function: sendToControlWindow.bind(null, 'menu', {
                            parentItem: 'File',
                            value: 'new'
                        }),

                        accelerator: 'CmdOrCtrl+N',

                        static: true
                    },
                    {
                        label: 'Open Presentation...',

                        function: sendToControlWindow.bind(null, 'menu', {
                            parentItem: 'File',
                            value: 'open'
                        }),

                        accelerator: 'CmdOrCtrl+O',

                        static: true
                    },
                    {
                        type: 'separator'
                    },
                    {
                        label: 'Save',

                        function: sendToControlWindow.bind(null, 'menu', {
                            parentItem: 'File',
                            value: 'save'
                        }),

                        accelerator: 'CmdOrCtrl+S',

                        static: true
                    },
                    {
                        label: 'Save As...',

                        function: sendToControlWindow.bind(null, 'menu', {
                            parentItem: 'File',
                            value: 'save-as'
                        }),

                        accelerator: 'CmdOrCtrl+Shift+S',

                        static: true
                    }
                ]
            })
        ),
        edit: new MenuItem(
            cleanItem({
                label: 'Edit',

                submenu: [
                    {
                        label: 'Undo',
                        accelerator: 'CmdOrCtrl+Z',

                        sendTo: 'active',
                        value: 'undo',

                        defaults: {
                            enabled: false
                        }
                    },
                    {
                        label: 'Redo',
                        accelerator: 'CmdOrCtrl+Shift+Z',

                        sendTo: 'active',
                        value: 'redo',

                        defaults: {
                            enabled: false
                        }
                    },
                    {
                        type: 'separator'
                    },
                    {
                        role: 'cut',
                        sendTo: 'active',
                        value: 'cut',

                        defaults: {
                            enabled: false
                        }
                    },
                    {
                        role: 'copy',
                        sendTo: 'active',
                        value: 'copy',

                        defaults: {
                            enabled: false
                        }
                    },
                    {
                        role: 'paste',
                        sendTo: 'active',
                        value: 'paste',

                        defaults: {
                            enabled: false
                        }
                    },
                    {
                        role: 'selectAll',
                        sendTo: 'active',
                        value: 'selectAll',

                        defaults: {
                            enabled: false
                        }
                    },
                    {
                        type: 'separator'
                    },
                    {
                        label: 'Font',

                        sendTo: 'active',
                        value: 'font',

                        defaults: {
                            enabled: false
                        },

                        submenu: [
                            {
                                label: 'Bold',
                                accelerator: 'CmdOrCtrl+B',

                                sendTo: 'active',
                                value: 'bold',

                                defaults: {
                                    enabled: false
                                }
                            },
                            {
                                label: 'Italic',
                                accelerator: 'CmdOrCtrl+I',

                                sendTo: 'active',
                                value: 'italic',

                                defaults: {
                                    enabled: false
                                }
                            },
                            {
                                label: 'Underline',
                                accelerator: 'CmdOrCtrl+U',

                                sendTo: 'active',
                                value: 'underline',

                                defaults: {
                                    enabled: false
                                }
                            },
                            {
                                label: 'Strikethrough',

                                sendTo: 'active',
                                value: 'strikethrough',

                                defaults: {
                                    enabled: false
                                }
                            },
                            {
                                label: 'Superscript',

                                sendTo: 'active',
                                value: 'superscript',

                                defaults: {
                                    enabled: false
                                }
                            },
                            {
                                label: 'Subscript',

                                sendTo: 'active',
                                value: 'subscript',

                                defaults: {
                                    enabled: false
                                }
                            },
                            {
                                type: 'separator'
                            },
                            {
                                label: 'Remove Formatting',
                                accelerator: 'CmdOrCtrl+Shift+T',

                                sendTo: 'active',
                                value: 'removeFormat',

                                defaults: {
                                    enabled: false
                                }
                            }
                        ]
                    }
                ]
            })
        ),
        library: new MenuItem(
            cleanItem({
                label: 'Library',

                submenu: [
                    {
                        label: 'Songs...',
                        window: 'songDatabase',

                        static: true
                    },
                    {
                        label: 'Add Songs...',
                        window: 'songAdd',

                        static: true
                    },
                    {
                        label: 'Import Songs...',
                        window: 'songImport',

                        static: true
                    },
                    {
                        label: 'Export Songs...',
                        window: 'songExport',

                        static: true
                    },
                    {
                        label: 'Check Songs...',
                        window: 'songCheck',

                        static: true
                    },
                    {
                        type: 'separator'
                    },
                    {
                        label: 'Images...',
                        window: 'imageDatabase',

                        static: true
                    }
                ]
            })
        ),
        tools: new MenuItem(
            cleanItem({
                label: 'Tools',

                submenu: [
                    {
                        label: 'Print...',
                        window: 'print',

                        static: true
                    },
                    {
                        label: 'Edit Templates...',
                        window: 'templateEditor',

                        static: true
                    }
                ]
            })
        ),
        help: new MenuItem(
            cleanItem({
                label: 'Help',

                submenu: [
                    {
                        label: 'Help...',
                        window: 'help',

                        static: true
                    },
                    {
                        type: 'separator'
                    },
                    {
                        label: 'Report Issue (GitHub)...',
                        url:
                            'https://github.com/brttd/display-whisper/issues/new',

                        static: true
                    },
                    {
                        label: 'Report Issue (Email)...',
                        url:
                            'mailto://displaywhisper@brettdoyle.uk?subject=Display%20Whisper%20-%20issue',

                        static: true
                    },
                    {
                        type: 'separator'
                    },
                    {
                        label: 'View Log',
                        window: 'log',

                        static: true
                    }
                ]
            })
        ),
        debug: new MenuItem(
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
                        },

                        static: true
                    },
                    {
                        role: 'toggleFullScreen',

                        static: true
                    },
                    {
                        type: 'separator'
                    },
                    {
                        label: 'Restart',

                        function: () => {
                            app.relaunch()
                            app.exit()
                        },

                        static: true
                    }
                ]
            })
        )
    }

    for (let label in items) {
        if (items.hasOwnProperty(label)) {
            addMenuItemToList(items[label])
        }
    }

    if (process.platform === 'darwin') {
        appMenus.main.append(items.app)
        appMenus.main.append(items.file)
    } else {
        appMenus.main.append(items.file)
        appMenus.main.append(items.app)
    }
    appMenus.main.append(items.edit)
    appMenus.main.append(items.library)
    appMenus.main.append(items.tools)
    appMenus.main.append(items.help)

    appMenus.get = list => {
        if (!Array.isArray(list)) {
            return null
        }

        let menuId = list.join('-')

        if (prebuiltMenus[menuId]) {
            return prebuiltMenus[menuId]
        }

        prebuiltMenus[menuId] = new Menu()

        for (let i = 0; i < list.length; i++) {
            if (items[list[i]]) {
                prebuiltMenus[menuId].append(items[list[i]])
            }
        }

        if (settings.get('debug.enable', false)) {
            prebuiltMenus[menuId].append(items.debug)
        }

        return prebuiltMenus[menuId]
    }

    if (settings.get('debug.enable', false)) {
        appMenus.main.append(items.debug)

        for (let menuId in prebuiltMenus) {
            if (prebuiltMenus.hasOwnProperty(menuId)) {
                prebuiltMenus[menuId].append(items.debug)
            }
        }
    }

    settings.listen('debug.enable', value => {
        if (value) {
            appMenus.main.append(items.debug)

            Menu.setApplicationMenu(appMenus.main)
        }
    })

    ipcMain.on('change-menu', (event, label, item, itemChanges) => {
        if (
            typeof label !== 'string' ||
            typeof item !== 'string' ||
            typeof itemChanges !== 'object' ||
            itemChanges === null
        ) {
            return false
        }

        let itemID = label.toLowerCase() + '-' + item.toLowerCase()

        if (dynamicItems[itemID]) {
            modifyWindowItem(
                BrowserWindow.fromWebContents(event.sender),
                itemID,
                itemChanges
            )
        }
    })

    ipcMain.on('menu-accelerator', (event, menuItemName) => {
        if (typeof acceleratorItemFunctions[menuItemName] === 'function') {
            acceleratorItemFunctions[menuItemName]()
        }
    })

    app.on('browser-window-focus', (event, win) => {
        updateMenuToWindow(win)
    })

    app.on('browser-window-created', (event, win) => {
        win.webContents.on(
            'did-finish-load',
            sendAcceleratorsToWindow.bind(null, win)
        )
    })
}

//Control window close message
ipcMain.on('close', event => {
    if (!windows.control || event.sender !== windows.control.webContents) {
        return false
    }
    //The control window needs a special system to handle closing:
    //All other windows need to be closed before the control window can close
    //But if any of the other windows have their close canceled (by the user), then the control window can't close

    //The event should only continue while closing is true (if it's cancelled, closing is set to false, and nothing more should happen)
    let closing = true

    //A window may cancel its close, in which case the control window needs to be told to also cancel
    ipcMain.once('close-canceled', event => {
        if (closing && event.sender !== windows.control.webContents) {
            closing = false

            windows.control.webContents.send('cancel-close')
        }
    })

    let toClose = []

    //Get all windows & editors which are open
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
        //If a cancel happened, don't do anything more
        if (!closing) {
            return false
        }

        //if there are no windows left to close, tell the control window it can close
        if (toClose.length === 0) {
            windows.control.webContents.send('can-close')

            return false
        }

        //Remove a window from the list to close
        let win = toClose.pop()

        //When the window is closed, move to the next one
        win.once('closed', closeNext)

        win.close()
    }

    closeNext()
})

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
        //Don't use the sendToAllWindows function, as it also sends to the display windows, which doesn't need to recieve database events

        for (let i = 0; i < windowNames.length; i++) {
            if (windows[windowNames[i]]) {
                windows[windowNames[i]].webContents.send(
                    databaseName,
                    from,
                    changes
                )
            }
        }

        for (let id in editors) {
            editors[id].webContents.send(databaseName, from, changes)
        }
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
    //Display a slide
    ipcMain.on('display', (event, data) => {
        for (
            let screenIndex = 0;
            screenIndex < display.screens.length;
            screenIndex++
        ) {
            if (display.screens[screenIndex].window) {
                display.screens[screenIndex].window.webContents.send(
                    'display',
                    data
                )
            }
        }

        lastDisplayData = data
        lastDisplayData.transition = {}
    })

    //Presentation control command, sent from a window other than the control window
    ipcMain.on('presentation-command', (event, argument) => {
        if (windows.control) {
            windows.control.webContents.send('presentation', argument)
        }
    })

    //Display blank, instead of the current slide
    ipcMain.on('display-blank', (event, blank) => {
        if (!windows.control) {
            return false
        }

        if (event.sender === windows.control.webContents) {
            for (
                let screenIndex = 0;
                screenIndex < display.screens.length;
                screenIndex++
            ) {
                if (display.screens[screenIndex].window) {
                    display.screens[screenIndex].window.webContents.send(
                        'display-blank',
                        blank
                    )
                }
            }
        } else {
            windows.control.webContents.send('display-blank', blank)
        }
    })

    //Toggle display output to specific screen
    ipcMain.on('toggle-display-screen', (event, index) => {
        toggleDisplayScreen(index)
    })

    ipcMain.on('disable-display', () => {
        for (let i = display.screens.length - 1; i >= 0; i--) {
            removeDisplayScreen(i)
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

    display.masterScale = settings.get(
        'display.masterScale',
        display.masterScale
    )

    //load default screen, and display show/hide from settings
    //If screen isn't set, use second screen if available, otherwise first
    let defaultScreens = settings.get('display.screens', [])
    for (let i = 0; i < defaultScreens.length; i++) {
        addDisplayScreen(defaultScreens[i])
    }

    updateMasterDisplay()

    screen.on('display-added', (event, newDisplay) => {
        displays = screen.getAllDisplays()

        sendToAllWindows('display-info', getDisplayInfo())
    })

    screen.on('display-removed', (event, oldDisplay) => {
        let oldDisplayIndex = displays.findIndex(
            display => display.id === oldDisplay.id
        )

        displays = screen.getAllDisplays()

        let screenIndex = display.screens.findIndex(subDisplay => {
            return subDisplay.screen === oldDisplayIndex
        })

        if (screenIndex !== -1) {
            removeDisplayScreen(screenIndex)
        }

        for (let i = 0; i < display.screens.length; i++) {
            if (display.screens[i].screen >= displayIndex) {
                display.screens[i].screen -= 1

                updateDisplayScreen(i)
            }
        }

        sendToAllWindows('display-info', getDisplayInfo())
    })

    screen.on('display-metrics-changed', (event, changedDisplay) => {
        let displayIndex = displays.findIndex(
            display => display.id === changedDisplay.id
        )

        displays = screen.getAllDisplays()

        for (
            let screenIndex = 0;
            screenIndex < display.screens.length;
            screenIndex++
        ) {
            if (display.screens[screenIndex].screen === displayIndex) {
                updateDisplayScreen(screenIndex)
            }
        }

        if (display.masterScale !== 'Custom') {
            updateMasterDisplay()
        }
    })

    settings.listen('display.masterScale', value => {
        display.masterScale = value

        updateMasterDisplay()
    })

    settings.listen('display.customWidth', () => {
        if (display.masterScale === 'Custom') {
            updateMasterDisplay()
        }
    })
    settings.listen('display.customHeight', () => {
        if (display.masterScale === 'Custom') {
            updateMasterDisplay()
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

        Menu.setApplicationMenu(appMenus.main)

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
