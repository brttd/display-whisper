const electron = require('electron')
const ipcRenderer = electron.ipcRenderer
const userDataPath = (electron.app || electron.remote.app).getPath('userData')

const fs = require('fs')
const path = require('path')

const util = require('util')

const logFilePath = path.join(userDataPath, 'log.txt')

let debug = false

let shownError = false

function getCircularReplacer() {
    const seen = new WeakSet()

    return (key, value) => {
        if (typeof value === 'object' && value !== null) {
            if (seen.has(value)) {
                return
            }

            seen.add(value)
        }

        return value
    }
}

function argsToString(args) {
    return Array.prototype.slice
        .apply(args)
        .map(arg =>
            typeof arg === 'string'
                ? arg
                : JSON.stringify(arg, getCircularReplacer(), 2)
        )
        .join(' ')
}

let linesToWrite = []

function writeToFile() {
    let line = linesToWrite.shift()

    fs.appendFile(logFilePath, line, error => {
        if (error) {
            if (debug) {
                console.error("Log couldn't write to file!", error)

                if (!shownError) {
                    shownError = true

                    if (layout) {
                        layout.dialog.showError({
                            title: 'Display Whisper Error',
                            message:
                                'There was an error while trying to write to the log!',
                            detail: error.message || error.toString()
                        })
                    } else if (ipcRenderer) {
                        ipcRenderer.send('show-dialog', 'error', {
                            title: 'Display Whisper Error',
                            content:
                                'There was an error while trying to write to the log!\n' +
                                (error.message || error.toString())
                        })
                    } else if (dialog) {
                        dialog.showErrorBox(
                            'Display Whisper Error',
                            'There was an error while trying to write to the log!\n' +
                                (error.message || error.toString())
                        )
                    }
                }
            }
        }

        if (linesToWrite.length > 0) {
            writeToFile()
        }
    })
}

function addToLog(args, type = 'log') {
    linesToWrite.push(
        '[' + type.toUpperCase() + '] ' + argsToString(args) + '\n'
    )

    if (linesToWrite.length === 1) {
        writeToFile()
    }
}

Object.defineProperty(exports, 'writing', {
    get: () => {
        return linesToWrite.length > 0
    }
})

exports.log = function() {
    addToLog(arguments, 'log')

    if (debug) {
        console.log(...arguments)
    }
}

exports.info = function() {
    addToLog(arguments, 'info')

    if (debug) {
        console.info(...arguments)
    }
}

exports.warn = function() {
    addToLog(arguments, 'warn')

    if (debug) {
        console.warn(...arguments)
    }
}

exports.error = function() {
    addToLog(arguments, 'error')

    if (debug) {
        console.error(...arguments)

        if (layout) {
            //If in a window which is using the layout module, use it's error dialog method
            layout.dialog.showError({
                title: 'Display Whisper Error',
                message: argsToString(arguments)
            })
        } else if (ipcRenderer) {
            //Else if available, use ipc messaging
            ipcRenderer.send('show-dialog', 'error', {
                title: 'Display Whisper Error',
                content: argsToString(arguments)
            })
        } else if (dialog) {
            //Else if available, use base electron dialog without any inbetween
            dialog.showErrorBox(
                'Display Whisper Error',
                argsToString(arguments)
            )
        }
    }
}

Object.defineProperty(exports, 'debug', {
    get: () => {
        return debug
    },
    set: value => {
        if (value) {
            debug = true
        } else {
            debug = false
        }
    }
})

if (ipcRenderer) {
    ipcRenderer.on('setting', (event, key, value) => {
        if (key === 'debug.enable') {
            debug = value
        }
    })

    ipcRenderer.send('get-setting', 'debug.enable', false)
}
