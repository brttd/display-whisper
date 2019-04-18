const ipcRenderer = require('electron').ipcRenderer

const path = require('path')

const { isColor } = require('dw-color')

const displayNode = document.createElement('div')
displayNode.id = 'display'
document.body.appendChild(displayNode)

document.body.style.background = 'black'

const textNodes = []
const imageNodes = []

const customDisplay = {
    use: false,

    width: 0,
    height: 0
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
            if (node.children[i].childElementCount === 1) {
                textNodes.push(node.children[i])
            } else {
                imageNodes.push(node.children[i])
            }
        }
    }
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

    parentNode.appendChild(node)
}

//TODO:
//When the display window is hidden, requestAnimationFrame is delayed until the window is visible again
//This means all sections show with display hidden are suddenly displayed when it's opened again.
function display(data = {}) {
    requestAnimationFrame(() => {
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
    })
}

function updateCustomDisplay() {
    displayNode.style.width = customDisplay.width + 'px'
    displayNode.style.height = customDisplay.height + 'px'

    let scale = 1

    if (
        customDisplay.width / customDisplay.height >
        window.innerWidth / window.innerHeight
    ) {
        //Fit width
        scale = window.innerWidth / customDisplay.width

        displayNode.style.top =
            (window.innerHeight - customDisplay.height * scale) / 2 + 'px'

        displayNode.style.left = ''
    } else {
        //Fit height
        scale = window.innerHeight / customDisplay.height

        displayNode.style.left =
            (window.innerWidth - customDisplay.width * scale) / 2 + 'px'

        displayNode.style.top = ''

        console
    }

    displayNode.style.transform = 'scale(' + scale + ')'
}
function removeCustomDisplay() {
    displayNode.style.transform = ''
    displayNode.style.top = ''
    displayNode.style.left = ''
    displayNode.style.width = '100%'
    displayNode.style.height = '100%'
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
            ipcRenderer.send('display-command', 'play-next')
        },
        'control.keyboard.playPrevious': () => {
            ipcRenderer.send('display-command', 'play-previous')
        },
        'control.keyboard.selectNext': () => {
            ipcRenderer.send('display-command', 'select-next')
        },
        'control.keyboard.selectPrevious': () => {
            ipcRenderer.send('display-command', 'select-previous')
        },
        'control.keyboard.playSelected': () => {
            ipcRenderer.send('display-command', 'play-selected')
        },
        'control.keyboard.closeDisplay': () => {
            ipcRenderer.send('change-display', { show: false })

            if (blanked) {
                toggleBlank()
            }
        },
        'control.keyboard.toggleDisplay': () => {
            ipcRenderer.send('change-display', {
                show: false
            })

            if (blanked) {
                toggleBlank()
            }
        },
        'control.keyboard.switchDisplayScreen1': () => {
            ipcRenderer.send('change-display', { screen: 0 })
        },
        'control.keyboard.switchDisplayScreen2': () => {
            ipcRenderer.send('change-display', { screen: 1 })
        },
        'control.keyboard.switchDisplayScreen3': () => {
            ipcRenderer.send('change-display', { screen: 2 })
        },
        'control.keyboard.toggleBlank': () => {
            toggleBlank()
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

            case 'display.setSize':
                customDisplay.use = value

                if (value) {
                    if (customDisplay.height && customDisplay.height) {
                        window.requestAnimationFrame(updateCustomDisplay)
                    }
                } else {
                    window.requestAnimationFrame(removeCustomDisplay)
                }
                break
            case 'display.displaySize':
                let values = value.split('x')

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
                    customDisplay.width = width
                    customDisplay.height = height

                    if (customDisplay.use) {
                        window.requestAnimationFrame(updateCustomDisplay)
                    }
                }
                break

            case 'display.setBackground':
                document.body.style.background = value
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

        ['display.setSize', false],
        ['display.displaySize', '1280x720, 16:9 - HD'],
        ['display.setBackground', 'black'],

        ['control.keyboard.repeat', false],

        ['control.keyboard.playNext', 'Space'],
        ['control.keyboard.playPrevious', 'Control+Space'],

        ['control.keyboard.selectNext', 'ArrowDown'],
        ['control.keyboard.selectPrevious', 'ArrowUp'],

        ['control.keyboard.playSelected', 'Enter'],

        ['control.keyboard.closeDisplay', 'Escape'],
        ['control.keyboard.toggleDisplay', 'Shift+KeyD'],
        ['control.keyboard.switchDisplayScreen1', 'Alt+Shift+Digit1'],
        ['control.keyboard.switchDisplayScreen2', 'Alt+Shift+Digit2'],
        ['control.keyboard.switchDisplayScreen3', 'Alt+Shift+Digit3'],

        ['control.keyboard.toggleBlank', 'Period']
    ])
}

window.addEventListener('resize', () => {
    if (customDisplay.use) {
        window.requestAnimationFrame(updateCustomDisplay)
    }
})

ipcRenderer.on('display', (event, data) => display(data))

ipcRenderer.on('display-blank', (event, blank) => {
    if (blank !== blanked) {
        toggleBlank()
    }
})
