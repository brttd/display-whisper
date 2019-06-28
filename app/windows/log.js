const { ipcRenderer } = require('electron')
const fs = require('fs')
const path = require('path')

let filePath
let logPath

let copyButton = document.createElement('button')
copyButton.textContent = 'Copy'

let reloadButton = document.createElement('button')
reloadButton.textContent = 'Reload'

let clearButton = document.createElement('button')
clearButton.textContent = 'Clear'

let openButton = document.createElement('button')
openButton.textContent = 'Open File'

copyButton.disabled = true
reloadButton.disabled = true
clearButton.disabled = true
openButton.disabled = true

function loadLog() {
    fs.readFile(logPath, { encoding: 'utf8' }, (error, data) => {
        if (error) {
            log.innerText =
                'Error: Unable to load log file:\n' + error.toString()

            return false
        }

        log.innerText = data
    })
}

copyButton.addEventListener('click', () => {
    let sel = window.getSelection()

    //If the user already has selection, then keep a copy of it
    let oldRange
    if (sel.rangeCount >= 1) {
        oldRange = sel.getRangeAt(0)
    }

    //Change the selection to the whole log node
    let range = document.createRange()
    range.selectNodeContents(log)
    sel.removeAllRanges()
    sel.addRange(range)

    document.execCommand('copy')

    //Remove log selection, and attempt to re-select previous selection

    sel.removeAllRanges()
    if (oldRange) {
        sel.addRange(oldRange)
    }
})

reloadButton.addEventListener('click', loadLog)

clearButton.addEventListener('click', () => {
    let add = 1
    while (fs.existsSync(filePath + '-' + add.toString() + '.txt')) {
        add += 1
    }

    fs.rename(logPath, filePath + '-' + add.toString() + '.txt', error => {
        if (error) {
            log.innerText =
                "Error: Couldn't clear log!\nFailed renaming log file:\n" +
                error.toString()
        } else {
            log.innerText = ''
        }
    })
})

openButton.addEventListener('click', () => {
    require('electron').shell.openExternal(logPath)
})

document.body.insertBefore(document.createElement('div'), log)
document.body.firstChild.appendChild(copyButton)
document.body.firstChild.appendChild(reloadButton)
document.body.firstChild.appendChild(clearButton)
document.body.firstChild.appendChild(openButton)

ipcRenderer.on('app-data-path', (e, appDataPath) => {
    filePath = path.join(appDataPath, 'log')
    logPath = filePath + '.txt'

    loadLog()

    copyButton.disabled = false
    reloadButton.disabled = false
    clearButton.disabled = false
    openButton.disabled = false
})
ipcRenderer.send('get-app-data-path')
