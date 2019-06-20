const ipcRenderer = require('electron').ipcRenderer

const path = require('path')

const { isColor } = require('dw-color')

const pdfjs = require('../pdfjs/pdf')
pdfjs.GlobalWorkerOptions.workerSrc = '../pdfjs/pdf.worker.js'

const displayNode = document.createElement('div')
displayNode.id = 'display'
document.body.appendChild(displayNode)

document.body.style.background = 'black'

const pdfDocumentCache = []

const canvasNodes = []
const textNodes = []
const imageNodes = []

const displayQueue = []
let delayedDisplay = null

const masterDisplay = {
    width: 0,
    height: 0,

    letterbox: true,
    letterboxColor: 'black'
}

const blankNode = document.createElement('div')
blankNode.style.background = 'black'

let defaults = {
    background: 'black',
    backgroundImage: '',
    backgroundScale: 'cover',

    text: '',

    font: 'Arial',
    size: 50,
    color: 'white',

    lineHeight: 1.5,

    align: 'left',
    y: 'top',

    url: '',
    data: '',

    scale: 'contain',

    opacity: 100,

    top: 20,
    left: 20,
    right: 80,
    bottom: 80,

    transition: {
        type: 'fade',
        time: 1000,

        slide: {
            origin: 'right'
        },

        zoom: {
            origin: 'center'
        }
    }
}

let validTransitionTypes = ['fade', 'slide', 'zoom']
let validTransitionOrigins = [
    'top left',
    'top',
    'top right',
    'right',
    'bottom right',
    'bottom',
    'bottom left',
    'left',
    'center'
]

let blanked = false

function formatUrl(url) {
    return url
        ? 'url("' +
              path.posix.normalize(
                  url.replace(new RegExp('\\' + path.sep, 'g'), '/')
              ) +
              '")'
        : ''
}

function removeOldDisplayNode() {
    if (displayNode.childElementCount > 2) {
        let node = displayNode.firstElementChild
        displayNode.removeChild(node)

        for (let i = 0; i < node.childElementCount; i++) {
            if (node.children[i].tagName === 'P') {
                textNodes.push(node.children[i])
            } else if (node.children[i].tagName === 'DIV') {
                imageNodes.push(node.children[i])
            } else if (node.children[i].tagName === 'CANVAS') {
                canvasNodes.push(node.children[i])
            }
        }
    }
}

function onPdfDocumentLoad(pdf) {
    this.document = pdf

    this.pages = []

    for (let i = 0; i < this.document.numPages; i++) {
        this.pages.push()

        this.document.getPage(i + 1).then(page => {
            this.pages[i] = page
            this.pages[i]._viewport = page.getViewport(1)
        })
    }
}
function onPdfDocumentError(error) {
    this.error = error
}

function addNode(data = {}, parentNode = displayNode.lastChild) {
    let node

    if (data.type === 'text') {
        if (textNodes.length === 0) {
            node = document.createElement('div')
            node.appendChild(document.createElement('p'))
        } else {
            node = textNodes.pop()
        }

        if (typeof data.text === 'string') {
            node.firstChild.innerHTML = data.text
        } else if (typeof data.plainText === 'string') {
            node.firstChild.textContent = data.plainText
        } else {
            node.firstChild.textContent = defaults.text
        }

        if (typeof data.font === 'string') {
            node.firstChild.style.fontFamily = '"' + data.font + '"'
        } else {
            node.firstChild.style.fontFamily = '"' + defaults.font + '"'
        }

        if (typeof data.size === 'number' && isFinite(data.size)) {
            node.style.fontSize = data.size + 'px'
        } else {
            node.style.fontSize = defaults.size + 'px'
        }

        if (isColor(data.color)) {
            node.firstChild.style.color = data.color
        } else {
            node.firstChild.style.color = defaults.color
        }

        if (typeof data.lineHeight === 'number' && isFinite(data.lineHeight)) {
            node.style.lineHeight = data.lineHeight
        } else {
            node.style.lineHeight = defaults.lineHeight
        }

        if (
            data.align === 'left' ||
            data.align === 'center' ||
            data.align === 'right'
        ) {
            node.firstChild.style.textAlign = data.align
        } else {
            node.firstChild.style.textAlign = defaults.align
        }

        if (data.y === 'top' || data.y == 'center' || data.y === 'bottom') {
            if (data.y === 'top') {
                node.firstChild.style.alignSelf = 'flex-start'
            } else if (data.y === 'bottom') {
                node.firstChild.style.alignSelf = 'flex-end'
            } else {
                node.firstChild.style.alignSelf = data.y
            }
        } else {
            if (defaults.y === 'top') {
                node.firstChild.style.alignSelf = 'flex-start'
            } else if (defaults.y === 'bottom') {
                node.firstChild.style.alignSelf = 'flex-end'
            } else {
                node.firstChild.style.alignSelf = defaults.y
            }
        }
    } else if (data.type === 'image') {
        node = imageNodes.pop() || document.createElement('div')

        node.style.backgroundImage = formatUrl(data.url)

        if (data.scale === 'fit') {
            node.style.backgroundSize = 'contain'
        } else if (data.scale === 'fill') {
            node.style.backgroundSize = 'cover'
        } else if (data.scale === 'stretch') {
            node.style.backgroundSize = '100% 100%'
        } else {
            node.style.backgroundSize = defaults.scale
        }
    } else if (data.type === 'pdf') {
        let doc = pdfDocumentCache.find(document => document.file === data.file)

        if (!doc) {
            doc = {
                documentLoader: pdfjs.getDocument({
                    url: 'file://' + data.file,

                    disableFontFace: false
                }).promise,

                file: data.file
            }

            pdfDocumentCache.push(doc)

            doc.documentLoader.then(
                onPdfDocumentLoad.bind(doc),
                onPdfDocumentError.bind(doc)
            )
        }

        if (doc.error) {
        } else if (doc.document) {
            let pageNumber = Math.max(
                1,
                Math.min(data.page, doc.document.numPages)
            )

            if (doc.pages[pageNumber - 1]) {
                renderPdfPage(parentNode, doc.pages[pageNumber - 1])
            } else {
                doc.document.getPage(pageNumber).then(page => {
                    renderPdfPage(parentNode, page)
                })
            }
        } else {
            doc.documentLoader.then(pdf => {
                pdf.getPage(
                    Math.max(1, Math.min(data.page, pdf.numPages))
                ).then(page => {
                    renderPdfPage(parentNode, page)
                })
            })
        }

        parentNode._delay = true
        return
    }

    if (typeof data.top === 'number' && isFinite(data.top)) {
        node.style.top = data.top + '%'
    } else {
        node.style.top = defaults.top + '%'
    }

    if (typeof data.left === 'number' && isFinite(data.left)) {
        node.style.left = data.left + '%'
    } else {
        node.style.left = defaults.left + '%'
    }

    if (typeof data.right === 'number' && isFinite(data.right)) {
        node.style.right = 100 - data.right + '%'
    } else {
        node.style.right = 100 - defaults.right + '%'
    }

    if (typeof data.bottom === 'number' && isFinite(data.bottom)) {
        node.style.bottom = 100 - data.bottom + '%'
    } else {
        node.style.bottom = 100 - defaults.bottom + '%'
    }

    if (typeof data.opacity === 'number' && isFinite(data.opacity)) {
        node.style.opacity = Math.max(0, Math.min(1, data.opacity / 100))
    }

    parentNode.appendChild(node)
}

function renderPdfPage(parentNode, page) {
    let viewport = page._viewport || page.getViewport(1)

    let canvas = canvasNodes.pop() || document.createElement('canvas')
    canvas._context = canvas._context || canvas.getContext('2d')

    let scale = Math.min(
        masterDisplay.width / viewport.width,
        masterDisplay.height / viewport.height
    )

    canvas.width = viewport.width * scale
    canvas.height = viewport.height * scale

    canvas.style.width = canvas.width + 'px'
    canvas.style.height = canvas.height + 'px'

    page.render({
        canvasContext: canvas._context,
        viewport: page.getViewport(scale)
    }).promise.then(() => {
        delayedDisplay === parentNode ? finishDisplay() : null
    })

    parentNode.appendChild(canvas)
}

function finishDisplay() {
    if (!delayedDisplay) {
        return false
    }

    let newDisplay = delayedDisplay
    let data = newDisplay._data

    delayedDisplay = null

    if (blanked) {
        displayNode.insertBefore(newDisplay, blankNode)
    } else {
        displayNode.appendChild(newDisplay)
    }

    if (typeof data.transition === 'object' && data.transition.time >= 0) {
        if (
            typeof data.transition.time !== 'number' ||
            !isFinite(data.transition.time)
        ) {
            data.transition.time = defaults.transition.time
        }

        if (!validTransitionTypes.includes(data.transition.type)) {
            data.transition.type = defaults.transition.type
        }

        switch (data.transition.type) {
            case 'fade':
                newDisplay.style.opacity = '0'

                newDisplay.style.transition =
                    'opacity ' + data.transition.time + 'ms'

                //The opacity: 0 rule needs to be applied (and painted),
                //then on the next frame the opacity: 1 rule needs to be set for the transition animation to happen
                requestAnimationFrame(() => {
                    newDisplay.style.opacity = '1'
                })

                break
            case 'zoom':
                newDisplay.style.transform = 'scale(0)'

                if (validTransitionOrigins.includes(data.transition.origin)) {
                    newDisplay.style.transformOrigin = data.transition.origin
                } else {
                    newDisplay.style.transformOrigin =
                        defaults.transition.zoom.origin
                }

                newDisplay.style.transition =
                    'transform ' + data.transition.time + 'ms'

                requestAnimationFrame(() => {
                    newDisplay.style.transform = 'scale(1)'
                })

                break
            case 'slide':
                if (
                    !validTransitionOrigins.includes(data.transition.origin) ||
                    data.transition.origin === 'center'
                ) {
                    data.transition.origin = defaults.transition.slide.origin
                }

                switch (data.transition.origin) {
                    case 'top right':
                        newDisplay.style.transform = 'translate(100%, -100%)'
                        break
                    case 'right':
                        newDisplay.style.transform = 'translate(100%, 0)'
                        break
                    case 'bottom right':
                        newDisplay.style.transform = 'translate(100%, 100%)'
                        break
                    case 'bottom':
                        newDisplay.style.transform = 'translate(0, 100%)'
                        break
                    case 'bottom left':
                        newDisplay.style.transform = 'translate(-100%, 100%)'
                        break
                    case 'top left':
                        newDisplay.style.transform = 'translate(-100%, -100%)'
                        break
                    case 'top':
                    default:
                        newDisplay.style.transform = 'translate(0, -100%)'
                        break
                }

                newDisplay.style.transition =
                    'transform ' + data.transition.time + 'ms'

                requestAnimationFrame(() => {
                    newDisplay.style.transform = 'translate(0, 0)'
                })
        }

        setTimeout(() => {
            requestAnimationFrame(removeOldDisplayNode)
        }, data.transition.time)
    } else {
        requestAnimationFrame(removeOldDisplayNode)
    }

    if (!masterDisplay.letterbox) {
        if (data.transition.time > 0 && data.transition.type === 'fade') {
            document.body.style.transition =
                'background ' + data.transition.time + 'ms'

            requestAnimationFrame(() => {
                document.body.style.background =
                    newDisplay.style.backgroundColor
            })
        } else {
            document.body.style.transition = ''

            document.body.style.background = newDisplay.style.backgroundColor
        }
    }

    let queued = displayQueue.splice(0, displayQueue.length)

    for (let i = 0; i < queued.length; i++) {
        display(queued[i])
    }
}

function display(data = {}) {
    if (delayedDisplay) {
        displayQueue.push(data)
        return
    }

    requestAnimationFrame(() => {
        if (delayedDisplay) {
            displayQueue.push(data)
            return
        }

        let newDisplay = document.createElement('div')

        if (isColor(data.background)) {
            newDisplay.style.backgroundColor = data.background
        } else {
            newDisplay.style.backgroundColor = defaults.background
        }

        if (typeof data.backgroundImage === 'string') {
            newDisplay.style.backgroundImage = formatUrl(data.backgroundImage)
        } else {
            newDisplay.style.backgroundImage = formatUrl(
                defaults.backgroundImage
            )
        }

        if (data.backgroundScale === 'fill') {
            newDisplay.style.backgroundSize = 'cover'
        } else if (data.backgroundScale === 'fit') {
            newDisplay.style.backgroundSize = 'contain'
        } else if (data.backgroundScale === 'stretch') {
            newDisplay.style.backgroundSize = '100% 100%'
        } else {
            newDisplay.style.backgroundSize = defaults.backgroundSize
        }

        if (Array.isArray(data.nodes)) {
            for (let i = 0; i < data.nodes.length; i++) {
                addNode(data.nodes[i], newDisplay)
            }
        }

        if (newDisplay._delay) {
            delayedDisplay = newDisplay
            newDisplay._data = data

            setTimeout(() => {
                delayedDisplay === newDisplay ? finishDisplay() : null
            }, 300)

            return
        }

        if (blanked) {
            displayNode.insertBefore(newDisplay, blankNode)
        } else {
            displayNode.appendChild(newDisplay)
        }

        if (typeof data.transition === 'object' && data.transition.time >= 0) {
            if (
                typeof data.transition.time !== 'number' ||
                !isFinite(data.transition.time)
            ) {
                data.transition.time = defaults.transition.time
            }

            if (!validTransitionTypes.includes(data.transition.type)) {
                data.transition.type = defaults.transition.type
            }

            switch (data.transition.type) {
                case 'fade':
                    newDisplay.style.opacity = '0'

                    newDisplay.style.transition =
                        'opacity ' + data.transition.time + 'ms'

                    //The opacity: 0 rule needs to be applied (and painted),
                    //then on the next frame the opacity: 1 rule needs to be set for the transition animation to happen
                    requestAnimationFrame(() => {
                        newDisplay.style.opacity = '1'
                    })

                    break
                case 'zoom':
                    newDisplay.style.transform = 'scale(0)'

                    if (
                        validTransitionOrigins.includes(data.transition.origin)
                    ) {
                        newDisplay.style.transformOrigin =
                            data.transition.origin
                    } else {
                        newDisplay.style.transformOrigin =
                            defaults.transition.zoom.origin
                    }

                    newDisplay.style.transition =
                        'transform ' + data.transition.time + 'ms'

                    requestAnimationFrame(() => {
                        newDisplay.style.transform = 'scale(1)'
                    })

                    break
                case 'slide':
                    if (
                        !validTransitionOrigins.includes(
                            data.transition.origin
                        ) ||
                        data.transition.origin === 'center'
                    ) {
                        data.transition.origin =
                            defaults.transition.slide.origin
                    }

                    switch (data.transition.origin) {
                        case 'top right':
                            newDisplay.style.transform =
                                'translate(100%, -100%)'
                            break
                        case 'right':
                            newDisplay.style.transform = 'translate(100%, 0)'
                            break
                        case 'bottom right':
                            newDisplay.style.transform = 'translate(100%, 100%)'
                            break
                        case 'bottom':
                            newDisplay.style.transform = 'translate(0, 100%)'
                            break
                        case 'bottom left':
                            newDisplay.style.transform =
                                'translate(-100%, 100%)'
                            break
                        case 'top left':
                            newDisplay.style.transform =
                                'translate(-100%, -100%)'
                            break
                        case 'top':
                        default:
                            newDisplay.style.transform = 'translate(0, -100%)'
                            break
                    }

                    newDisplay.style.transition =
                        'transform ' + data.transition.time + 'ms'

                    requestAnimationFrame(() => {
                        newDisplay.style.transform = 'translate(0, 0)'
                    })
            }

            setTimeout(() => {
                requestAnimationFrame(removeOldDisplayNode)
            }, data.transition.time)
        } else {
            requestAnimationFrame(removeOldDisplayNode)
        }

        if (!masterDisplay.letterbox) {
            if (data.transition.time > 0 && data.transition.type === 'fade') {
                document.body.style.transition =
                    'background ' + data.transition.time + 'ms'

                requestAnimationFrame(() => {
                    document.body.style.background =
                        newDisplay.style.backgroundColor
                })
            } else {
                document.body.style.transition = ''

                document.body.style.background =
                    newDisplay.style.backgroundColor
            }
        }
    })
}

function updateMasterDisplay() {
    displayNode.style.width = masterDisplay.width + 'px'
    displayNode.style.height = masterDisplay.height + 'px'

    let scale = 1

    if (
        masterDisplay.width / masterDisplay.height >
        window.innerWidth / window.innerHeight
    ) {
        //Fit width
        scale = window.innerWidth / masterDisplay.width

        displayNode.style.top =
            (window.innerHeight - masterDisplay.height * scale) / 2 + 'px'

        displayNode.style.left = ''
    } else {
        //Fit height
        scale = window.innerHeight / masterDisplay.height

        displayNode.style.left =
            (window.innerWidth - masterDisplay.width * scale) / 2 + 'px'

        displayNode.style.top = ''

        console
    }

    displayNode.style.transform = 'scale(' + scale + ')'
}

function toggleBlank() {
    if (blanked) {
        displayNode.removeChild(blankNode)
    } else {
        displayNode.appendChild(blankNode)
    }

    blanked = !blanked

    ipcRenderer.send('display-blank', blanked)
}

//Settings, keyboard shortcuts, etc
{
    const keyboard = require('dw-keyboard')

    let listeners = {}
    let repeat = false

    let keyboardFunctions = {
        'control.keyboard.playNext': () => {
            ipcRenderer.send('presentation-command', 'play-next')
        },
        'control.keyboard.playPrevious': () => {
            ipcRenderer.send('presentation-command', 'play-previous')
        },
        'control.keyboard.selectNext': () => {
            ipcRenderer.send('presentation-command', 'select-next')
        },
        'control.keyboard.selectPrevious': () => {
            ipcRenderer.send('presentation-command', 'select-previous')
        },
        'control.keyboard.selectNextItem': () => {
            ipcRenderer.send('presentation-command', 'select-next-item')
        },
        'control.keyboard.selectPreviousItem': () => {
            ipcRenderer.send('presentation-command', 'select-previous-item')
        },
        'control.keyboard.playSelected': () => {
            ipcRenderer.send('presentation-command', 'play-selected')
        },

        'control.keyboard.toggleBlank': () => {
            toggleBlank()
        },

        'control.keyboard.disableDisplay': () => {
            ipcRenderer.send('disable-display')
            ipcRenderer.send('display-blank', false)
        },

        'control.keyboard.toggleDisplayScreen1': () => {
            ipcRenderer.send('toggle-display-screen', 0)
        },
        'control.keyboard.toggleDisplayScreen2': () => {
            ipcRenderer.send('toggle-display-screen', 1)
        },
        'control.keyboard.toggleDisplayScreen3': () => {
            ipcRenderer.send('toggle-display-screen', 2)
        },
        'control.keyboard.toggleDisplayScreen4': () => {
            ipcRenderer.send('toggle-display-screen', 3)
        }
    }

    ipcRenderer.on('setting', (event, key, value) => {
        if (key === 'control.keyboard.repeat') {
            repeat = value

            //The repeat value affects the play/selext next/previous shortcuts, so they need to be re-registered.
            //Easiest way to re-register is to request the setting again
            ipcRenderer.send('get-setting', 'control.keyboard.playNext')
            ipcRenderer.send('get-setting', 'control.keyboard.playPrevious')
            ipcRenderer.send('get-setting', 'control.keyboard.selectNext')
            ipcRenderer.send('get-setting', 'control.keyboard.selectPrevious')

            return false
        } else if (key.startsWith('control.keyboard.')) {
            keyboard.unregister(listeners[key])

            listeners[key] = keyboard.register(value, keyboardFunctions[key], {
                repeat: repeat
            })

            return false
        }

        switch (key) {
            case 'display.hideCursor':
                if (value) {
                    document.body.style.cursor = 'none'
                } else {
                    document.body.style.cursor = ''
                }

                break

            case 'display.useLetterbox':
                masterDisplay.letterbox = value

                if (masterDisplay.letterbox) {
                    document.body.style.background =
                        masterDisplay.letterboxColor
                } else {
                    if (displayNode.childElementCount > 0) {
                        document.body.style.background =
                            displayNode.lastElementChild.style.backgroundColor
                    } else {
                        document.body.style.background = defaults.background
                    }
                }
                break

            case 'display.letterboxColor':
                if (isColor(value)) {
                    masterDisplay.letterboxColor = value

                    if (masterDisplay.letterbox) {
                        document.body.style.background = value
                    }
                }
                break

            case 'defaults.background':
                defaults.background = value

                displayNode.style.background = value

                break
            case 'defaults.backgroundScale':
                if (value === 'fit') {
                    defaults.backgroundScale = 'contain'
                } else if (value === 'fill') {
                    defaults.backgroundScale = 'cover'
                } else if (value === 'strech') {
                    defaults.backgroundScale = '100% 100%'
                }

                break
            case 'defaults.font':
                defaults.font = value

                break
            case 'defaults.size':
                defaults.size = value

                break
            case 'defaults.color':
                defaults.color = value

                break
            case 'defaults.lineHeight':
                defaults.lineHeight = value

                break
            case 'defaults.transitionType':
                defaults.transition.type = value

                break
            case 'defaults.transitionTime':
                defaults.transition.time = value

                break
        }
    })

    ipcRenderer.send('get-settings', [
        ['defaults.background', 'black'],
        ['defaults.backgroundScale', 'fill'],
        ['defaults.font', 'Arial'],
        ['defaults.size', 100],
        ['defaults.color', 'white'],
        ['defaults.lineHeight', 1.5],

        ['defaults.transitionType', 'fade'],
        ['defaults.transitionTime', 0],

        ['display.hideCursor', false],

        ['display.useLetterbox', true],
        ['display.letterboxColor', 'black'],

        ['control.keyboard.repeat', false],

        ['control.keyboard.playNext', 'Space'],
        ['control.keyboard.playPrevious', 'Control+Space'],

        ['control.keyboard.selectNext', 'ArrowDown'],
        ['control.keyboard.selectPrevious', 'ArrowUp'],
        ['control.keyboard.selectNextItem', 'Control+ArrowDown'],
        ['control.keyboard.selectPreviousItem', 'Control+ArrowUp'],

        ['control.keyboard.playSelected', 'Enter'],

        ['control.keyboard.toggleBlank', 'Period'],

        ['control.keyboard.disableDisplay', 'Escape'],
        ['control.keyboard.toggleDisplayScreen1', 'Alt+Shift+Digit1'],
        ['control.keyboard.toggleDisplayScreen2', 'Alt+Shift+Digit2'],
        ['control.keyboard.toggleDisplayScreen3', 'Alt+Shift+Digit3']
    ])
}

window.addEventListener('resize', () => {
    window.requestAnimationFrame(updateMasterDisplay)
})
ipcRenderer.on('display-info', (event, display) => {
    if (
        isFinite(display.bounds.width) &&
        isFinite(display.bounds.height) &&
        display.bounds.width > 0 &&
        display.bounds.height > 0
    ) {
        masterDisplay.width = display.bounds.width
        masterDisplay.height = display.bounds.height

        window.requestAnimationFrame(updateMasterDisplay)
    }
})

ipcRenderer.on('display', (event, data) => display(data))

ipcRenderer.on('display-blank', (event, blank) => {
    if (blank !== blanked) {
        toggleBlank()
    }
})
