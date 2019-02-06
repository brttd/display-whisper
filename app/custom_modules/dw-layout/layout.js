//TODO: Rename to dw-interface

//Check that the module has been used inside a valid document
if (typeof document !== 'object' || typeof window !== 'object') {
    throw new Error('Layout module used outside of a valid HTML document!')
}
document.body.style.opacity = 0

const { remote, ipcRenderer } = require('electron')
const { dialog, Menu, MenuItem } = remote

const fs = require('fs')
const path = require('path')

const fontList = require('font-list')

const richText = require('dw-rich-text')
const color = require('dw-color')
const logger = require('dw-log')
const keyboard = require('dw-keyboard')
const Database = require('dw-database')

const objUtil = require('dw-editor').util

//Global variables
const thisWin = remote.getCurrentWindow()

//Used for quick conversion of number/string to css pixel unit string
const mapToPx = value => {
    if (typeof value === 'number') {
        return value.toString() + 'px'
    }

    return value
}

//Mappings between js style names, and CSS style names
const stylesMap = {
    overflow: 'overflow',
    overflowX: 'overflowX',
    overflowY: 'overflowY',

    margin: 'margin',
    marginTop: 'marginTop',
    marginLeft: 'marginLeft',
    marginRight: 'marginRight',
    marginBottom: 'marginBottom',

    padding: 'padding',
    paddingTop: 'paddingTop',
    paddingLeft: 'paddingLeft',
    paddingRight: 'paddingRight',
    paddingBottom: 'paddingBottom',

    border: 'border',
    borderTop: 'borderTop',
    borderLeft: 'borderLeft',
    borderRight: 'borderRight',
    borderBottom: 'borderBottom',

    outline: 'outline',
    background: 'background',

    size: 'flexBasis',
    shrink: 'flexShrink',
    grow: 'flexGrow',
    flex: 'flex',

    align: 'alignSelf',
    alignItems: 'alignItems',

    textAlign: 'textAlign',

    justify: 'justifyContent',

    direction: 'flexDirection',
    wrap: 'flexWrap',

    width: 'width',
    minWidth: 'minWidth',
    maxWidth: 'maxWidth',

    height: 'height',
    minHeight: 'minHeight',
    maxHeight: 'maxHeight'
}
//Mappings between js style values, and CSS style values
//(Either an object with direct mappings, or a function)
const styleValuesMap = {
    border: {
        black: '1px solid black',
        true: '1px solid hsl(0, 0%, 70%)',
        false: 'none'
    },
    borderTop: {
        black: '1px solid black',
        true: '1px solid hsl(0, 0%, 70%)',
        false: 'none'
    },
    borderLeft: {
        black: '1px solid black',
        true: '1px solid hsl(0, 0%, 70%)',
        false: 'none'
    },
    borderRight: {
        black: '1px solid black',
        true: '1px solid hsl(0, 0%, 70%)',
        false: 'none'
    },
    borderBottom: {
        black: '1px solid black',
        true: '1px solid hsl(0, 0%, 70%)',
        false: 'none'
    },

    grow: {
        false: '0',
        true: '1'
    },
    shrink: {
        false: '0',
        true: '1'
    },
    align: {
        start: 'flex-start',
        end: 'flex-end'
    },
    direction: {
        vertical: 'column',
        horizontal: 'row'
    },
    wrap: {
        true: 'wrap',
        false: 'nowrap'
    },
    justify: {
        start: 'flex-start',
        end: 'flex-end'
    },

    margin: mapToPx,
    marginTop: mapToPx,
    marginLeft: mapToPx,
    marginRight: mapToPx,
    marginBottom: mapToPx,

    padding: mapToPx,
    paddingTop: mapToPx,
    paddingLeft: mapToPx,
    paddingRight: mapToPx,
    paddingBottom: mapToPx,

    width: mapToPx,
    minWidth: mapToPx,
    maxWidth: mapToPx,

    height: mapToPx,
    minHeight: mapToPx,
    maxHeight: mapToPx
}
//Used for storing unqiue item specific mappings.
//Each item can add it's own functions, which are called when that property is changed for the item
const itemStylesMap = {}

let idCounter = 0

//Each exported layout item type, stored by name
let items = {}

function loadCSS(name) {
    name = __dirname + '/' + name

    document.head.appendChild(document.createElement('link'))
    document.head.lastChild.rel = 'stylesheet'
    document.head.lastChild.type = 'text/css'
    document.head.lastChild.href = name
}

//Private utility functions
function round(value, precision = 0) {
    //Rounds <value> to the <precision> decimal places
    return Math.round(value * Math.pow(10, precision)) / Math.pow(10, precision)
}

//TODO: this is doing element layout reads, very un-optimized
function convertMouse(event = new MouseEvent(), node = false) {
    if (node) {
        let clientRect = node.getBoundingClientRect()

        return {
            screenX: event.screenX,
            screenY: event.screenY,
            pageX: event.pageX,
            pageY: event.pageY,

            clientX: event.clientX,
            clientY: event.clientY,

            //offset?
            layerX: event.clientX - clientRect.left,
            layerY: event.clientY - clientRect.top,

            x: event.pageX - clientRect.left + node.scrollLeft,
            y: event.pageY - clientRect.top + node.scrollTop,

            movementX: event.movementX,
            movementY: event.movementY,

            button: event.button,
            buttons: event.buttons,

            shiftKey: event.shiftKey,
            ctrlKey: event.ctrlKey,
            altKey: event.altKey,
            metaKey: event.metaKey,

            path: event.path,
            target: event.target,

            fromUser: event.fromUser || false,
            from: null
        }
    } else {
        return {
            screenX: event.screenX,
            screenY: event.screenY,
            pageX: event.pageX,
            pageY: event.pageY,

            clientX: event.clientX,
            clientY: event.clientY,

            //offset?
            layerX: event.layerX,
            layerY: event.layerY,

            x: event.clientX,
            y: event.clientY,

            movementX: event.movementX,
            movementY: event.movementY,

            button: event.button,
            buttons: event.buttons,

            shiftKey: event.shiftKey,
            ctrlKey: event.ctrlKey,
            altKey: event.altKey,
            metaKey: event.metaKey,

            path: event.path,
            target: event.target,

            fromUser: event.fromUser || false,
            from: null
        }
    }
}

function validNode(node = {}) {
    //Returns true if the given object is a DOM node
    return (
        node !== null &&
        node !== undefined &&
        node.nodeType &&
        node.nodeType === 1
    )
}
function validItem(item = {}) {
    //Returns true if the given object is a layout item.
    //Using "instanceof Item" would be nicer, but there some display items don't extend Item
    if (typeof item === 'object' && item !== null && item.node) {
        return validNode(item.node)
    }

    return false
}

function getUniqueId(name) {
    idCounter += 1

    return name.toLowerCase() + '-' + idCounter.toString(16)
}

function getIconUrl(name) {
    return name
        ? path.join(
              __dirname,
              '../../icons/',
              name.split('-')[0] + '.svg#' + name
          )
        : ''
}

function formatUrl(url) {
    if (!url) {
        return ''
    }
    //Replace all instances of the os path seperator with forward slashes
    url = url.replace(new RegExp('\\' + path.sep, 'g'), '/')

    return 'url("' + path.posix.normalize(url) + '")'
}

function sendEventTo(event, listeners) {
    if (Array.isArray(listeners)) {
        for (let i = 0; i < listeners.length; i++) {
            listeners[i](event)
        }
    }
}

//Can be bound in an .addEventListener call, for a simpler code structure
function passEventTo(listeners, event) {
    for (let i = 0; i < listeners.length; i++) {
        listeners[i](event)
    }
}

//Make all functions bound to the given context
function bindFunctions(item) {
    for (let i = 1; i < arguments.length; i++) {
        if (typeof arguments[i] === 'function') {
            item[arguments[i].name] = arguments[i].bind(item)
        }
    }
}

//JS style functions
function setNodeStyle(node, property, value) {
    //Sets the given property to the given value on the given node
    //Uses stylesMap to find full CSS property name
    //And stylesValuesMap to find full CSS value

    if (stylesMap.hasOwnProperty(property)) {
        if (styleValuesMap.hasOwnProperty(property)) {
            if (typeof styleValuesMap[property] === 'function') {
                value = styleValuesMap[property](value)
            } else if (styleValuesMap[property].hasOwnProperty(value)) {
                value = styleValuesMap[property][value]
            }
        }

        node.style[stylesMap[property]] = value
    }
}

function addStyles(item, styles = {}) {
    //Adds all valid styles in the given object to the given item
    //If the item has custom functions for modifiying styles, will call them before applying
    let node

    if (validItem(item)) {
        node = item.node
    } else if (validNode(item)) {
        node = item
    } else {
        return false
    }

    let itemMaps = false

    //Go through each item name in the custom item styles mapping
    //If there is an exported item with that name, check if the given item is an instace of it
    for (let itemClass in itemStylesMap) {
        if (item instanceof items[itemClass]) {
            itemMaps = itemStylesMap[itemClass]
        }
    }

    if (itemMaps) {
        for (let property in styles) {
            if (itemMaps.hasOwnProperty(property)) {
                let change = itemMaps[property].call(
                    null,
                    item,
                    styles[property]
                )
                setNodeStyle(
                    change.node || node,
                    change.property || property,
                    change.value || styles[property]
                )
            } else {
                setNodeStyle(node, property, styles[property])
            }
        }
    } else {
        for (let property in styles) {
            setNodeStyle(node, property, styles[property])
        }
    }

    if (typeof styles.id === 'string') {
        node.id = styles.id
    }

    if (typeof styles.class === 'string') {
        let classes = styles.class.split(' ')
        for (let i = 0; i < classes.length; i++) {
            node.classList.add(classes[i])
        }
    }
}

//Can be used by item custom style mappings to disallow a certain style property
function disableStyle() {
    return { value: '' }
}

//Functions to quickly create nodes with standard attributes
function getSeparatorNode() {
    let elem = document.createElement('div')
    elem.className = 'separator'

    return elem
}

function getIconSVG(name) {
    /*
    <svg viewBox="0 0 100 100" class="icon shape-codepen">
        <use xlink:href="/images/svg-defs.svg#shape-codepen"></use>
    </svg>
    */
    let svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.innerHTML = '<use xlink:href="' + getIconUrl(name) + '"></use>'

    return svg
}

//(Layout) Global objects
const currentDisplay = {}
{
    let changeListeners = []
    let oneChangeListeners = []

    currentDisplay.width = 0
    currentDisplay.height = 0

    Object.defineProperty(currentDisplay, 'ratio', {
        get: () => currentDisplay.width / currentDisplay.height,
        set: () => null
    })

    currentDisplay.onEvent = (eventName, listener) => {
        if (eventName === 'change' && typeof listener === 'function') {
            changeListeners.push(listener)
        }
    }
    currentDisplay.onceEvent = (eventName, listener) => {
        if (eventName === 'change' && typeof listener === 'function') {
            oneChangeListeners.push(listener)
        }
    }

    ipcRenderer.on('display-info', (event, display) => {
        currentDisplay.width = display.bounds.width
        currentDisplay.height = display.bounds.height

        let allListeners = changeListeners.concat(oneChangeListeners)
        oneChangeListeners = []

        sendEventTo(
            {
                fromUser: false,
                from: currentDisplay
            },
            allListeners
        )
    })
}

const fonts = {}
{
    let preloading = false
    let shouldPreload = false

    let updateListeners = []

    fonts.loaded = false
    fonts.all = []
    fonts.allLower = []

    fonts.isFont = name => fonts.all.includes(name)

    fonts.onEvent = (eventName, listener = () => {}) => {
        if (eventName === 'update') {
            updateListeners.push(listener)
        }
    }

    function preloadFonts() {
        if (preloading || !fonts.loaded) {
            return false
        }
        preloading = true

        let elem = document.createElement('span')
        elem.style.opacity = '0'
        elem.style.position = 'fixed'
        elem.style.top = '10000px'
        elem.style.userSelect = 'none'

        elem.textContent = 'Hello World'

        elem.style.fontFamily = fonts.all[0]

        document.body.appendChild(elem)

        let index = 1

        let preloadNext = () => {
            elem.style.fontFamily = fonts.all[index]
            index += 1

            if (index < fonts.all.length) {
                setTimeout(body.onIdle.bind(null, preloadNext), 100)
            } else {
                document.body.removeChild(elem)
                elem = null
            }
        }

        body.onIdle(preloadNext)
    }

    fontList
        .getFonts()
        .then(fontNames => {
            fonts.all = fontNames
                .map(name => {
                    if (name[0] === '"' && name[name.length - 1] === '"') {
                        name = name.slice(1, name.length - 1)
                    }

                    return name
                })
                .sort()

            fonts.allLower = fonts.all.map(font => font.toLowerCase().trim())

            fonts.loaded = true

            if (shouldPreload) {
                body.onIdle(preloadFonts)
            }

            sendEventTo(
                {
                    fromUser: false,
                    from: fonts
                },
                updateListeners
            )
        })
        .catch(error => {
            logger.error('Unable to load fonts:', error)
        })

    fonts.preload = () => {
        if (fonts.loaded) {
            body.onIdle(preloadFonts)
        } else {
            shouldPreload = true
        }
    }
}

const Images = new Database('images', {
    load: false,
    parse: false,
    extensions: 'image'
})

Images.onEvent('error', error => {
    exports.dialog.showNotification({
        type: 'error',
        autoHide: false,

        message: 'There is an error with the Image database!\n' + error.message
    })
})

class Item {
    /*
    //base class (not publically exposed, used to reduce common code used in items)

    Constructor arguments:
        Node (HTML Element): Item .node element.
        styles (Object): CSS properties, applied to .node.
    
    Properties:
        node (HTMLElement): The main element of the item.
        events (object): A mapping of event names to arrays of listeners for that event.
        parent (Item): Item which contains the instance of this item. Only set by parent items (such as blocks).
        visible (get/set) (Boolean): Whether or not the item is shown.
    
    Methods:
        onEvent(eventName: string, listener: function): Calls listener whenever the event occurs.
        addClass(className: string): Adds the given class(es) to the main item node.
        removeClass(className: string): Removes the given class(es) from the main item node.
    
    Events:
        'click': Standard mouse event
    */
    constructor(node = document.createElement('div'), styles = {}) {
        this.node = node

        this.events = {}
        //this.parent = null

        addStyles(this, styles)
    }

    get visible() {
        return !this.node.classList.contains('hide')
    }
    set visible(visible) {
        //Only update if the visibility is changing
        if (
            typeof visible === 'boolean' &&
            visible === this.node.classList.contains('hide')
        ) {
            if (visible) {
                this.node.classList.remove('hide')
            } else {
                this.node.classList.add('hide')
            }

            if (this.parent && this.parent.onResize) {
                if (this.parent.checkResize) {
                    this.parent.checkResize()
                } else if (this.parent.onResize) {
                    this.parent.onResize()
                }
            }
        }
    }

    onEvent(eventName, listener = () => {}) {
        if (!this.events[eventName]) {
            if (eventName === 'click') {
                this.events.click = []

                this.node.addEventListener(
                    'click',
                    passEventTo.bind(this, this.events.click, {
                        fromUser: true,
                        from: this
                    })
                )
            } else if (eventName === 'contextmenu') {
                this.events.contextmenu = []

                this.node.addEventListener(
                    'contextmenu',
                    passEventTo.bind(this, this.events.contextmenu, {
                        fromUser: true,
                        from: this
                    })
                )
            } else {
                this.events[eventName] = []
            }
        }

        this.events[eventName].push(listener)
    }

    addClass(className) {
        if (typeof className !== 'string') {
            return false
        }

        let classes = className.split(' ')

        for (let i = 0; i < classes.length; i++) {
            this.node.classList.add(classes[i])
        }
    }
    removeClass(className) {
        if (typeof className !== 'string') {
            return false
        }

        let classes = className.split(' ')

        for (let i = 0; i < classes.length; i++) {
            this.node.classList.remove(classes[i])
        }
    }
}
items.Item = Item

//================================
//FOCUS MODEL
//================================
/*
When an item is focused, it (should) call the body inputFocused method, thus sending out an 'input-focus' event.
This happens regardless of whether the focus came from the user or not.
An item can not emit the 'input-focus' event, if it's ._globalFocus property is false. This should only happen if a parent will emit the event instead.

When an item hears a 'input-focus' event from the body (and itself used to be focused), the following checks should happen:
If the item is the same as the focused item, stop.
If the focused item is in the items 'shareFocusWith' list, stop.

If the item was focused, and doesn't have the newly focused item in it's shareFocusWith list, then it should blur (un-focus) itself.

*/
class focusItem extends Item {
    /*
    Constructor arguments:
        node: Passed to Item.
        styles: Passed to Item.
        focus (Boolean): Whether or not this item should emit global focus events.
    
    Properties:
        _focused (Boolean): If the item is currently focused.
        _globalFocus (Boolean): If the item should emit global (from body) focus events.
        _shareFocusWith (Array: Item): List of items this Item can "share focus" (Be focused at same time) with
    
    Methods:
        shareFocusWith(item: Item): Makes this Item able to share focus with given item
        groupShareFocusWith(item: Item): Makes this Item able to share focus with given item, and all items that it can share focus with
        focus(): Makes the item focused
        blur(): Makes the item not focused
    */
    constructor(node, styles, focus = true) {
        super(node, styles)

        this._focused = false
        this._globalFocus = true

        if (focus === false) {
            this._globalFocus = false
        }

        this._shareFocusWith = []

        body.onEvent('input-focus', event => {
            if (
                event.item === this ||
                this._shareFocusWith.includes(event.item)
            ) {
                return false
            }

            this.blur()
        })
    }

    shareFocusWith(item) {
        if (validItem(item) && !this._shareFocusWith.includes(item)) {
            this._shareFocusWith.push(item)
        }
    }

    groupShareFocusWith(item) {
        if (validItem(item) && !this._shareFocusWith.includes(item)) {
            this._shareFocusWith.push(item)

            if (Array.isArray(item._shareFocusWith)) {
                for (let i = 0; i < item._shareFocusWith.length; i++) {
                    this.groupShareFocusWith(item._shareFocusWith[i])
                }
            }

            if (typeof item.groupShareFocusWith === 'function') {
                item.groupShareFocusWith(this)
            }
        }
    }

    blur() {
        this._focused = false

        this.removeClass('focus')
    }

    focus(fromUser = false) {
        this._focused = true

        this.addClass('focus')

        if (this._globalFocus) {
            body.inputFocused(this, fromUser)
        }
    }
}

//Helper function, to make all focus events that come from given item also be sent through second item
//Used for passing focus from child to parent
function passFocusThrough(focusItem, item, globalFocus = true) {
    if (!validItem(focusItem) || !validItem(item)) {
        return false
    }

    if (typeof focusItem.shareFocusWith === 'function') {
        focusItem.shareFocusWith(item)
    }

    if (globalFocus) {
        focusItem.onEvent('focus', event => {
            event.from = item

            body.inputFocused(item, event.fromUser)

            sendEventTo(event, item.events.focus)
        })
    } else {
        focusItem.onEvent('focus', event => {
            event.from = item
            sendEventTo(event, item.events.focus)
        })
    }
}

//body
const body = new Item(document.body)
{
    body.addClass('block')

    //Style values
    {
        document.documentElement.style.width = document.documentElement.style.height = body.node.style.width = body.node.style.height =
            '100%'

        document.documentElement.style.overflow = body.node.style.overflow =
            'hidden'
        body.node.style.margin = '0'
    }

    let size = {
        width: 0,
        height: 0
    }

    let bodyDirection = 'horizontal'
    body.node.style.flexDirection = 'row'

    let bodyItemResizeFunctions = []

    body.items = []

    body.events['input-focus'] = []
    body.events.resize = []
    body.events.scroll = []
    body.events.focus = []
    body.events.blur = []

    function onBodyResize() {
        for (let i = 0; i < bodyItemResizeFunctions.length; i++) {
            body.onFrame.end(bodyItemResizeFunctions[i])
        }
    }
    function checkBodyResize() {
        onBodyResize()
    }

    let writeBodyDirection = () => {
        body.node.style.flexDirection =
            bodyDirection === 'vertical' ? 'column' : 'row'
    }

    Object.defineProperty(body, 'direction', {
        get: () => {
            return bodyDirection
        },
        set: direction => {
            if (direction !== 'horizontal' && direction !== 'vertical') {
                return false
            }

            bodyDirection = direction

            body.onFrame.end(writeBodyDirection)
        }
    })
    Object.defineProperty(exports, 'direction', {
        get: () => {
            return bodyDirection
        },
        set: direction => {
            if (direction !== 'horizontal' && direction !== 'vertical') {
                return false
            }

            bodyDirection = direction

            body.onFrame.end(writeBodyDirection)
        }
    })

    body.inputFocused = function(item, fromUser = true) {
        sendEventTo(
            {
                item: item,

                fromUser: fromUser,
                from: this
            },
            this.events['input-focus']
        )
    }

    body.onResize = onBodyResize
    body.checkResize = checkBodyResize

    body.add = exports.add = function(item, index = body.items.length) {
        if (validItem(item) && body.items.indexOf(item) === -1) {
            if (index >= 0 && index < body.items.length) {
                body.items.splice(index, 0, item)
                body.node.insertBefore(item.node, body.items[index].node)
            } else {
                index = body.items.length

                body.items.push(item)
                body.node.appendChild(item.node)
            }

            item.parent = body

            if (item instanceof items.LayoutBlock) {
                item.updateMin()
            }

            if (typeof item.onResize === 'function') {
                bodyItemResizeFunctions.push(item.onResize)
            }

            body.onResize()
        }
    }

    body.remove = exports.remove = function(index) {
        if (validItem(index)) {
            index = body.items.indexOf(index)
        }

        if (index >= 0 && index < body.items.length) {
            let item = body.items.splice(index, 1)[0]

            item.parent = null
            body.node.removeChild(item.node)

            let index = bodyItemResizeFunctions.indexOf(item.onResize)
            if (index !== -1) {
                bodyItemResizeFunctions.splice(index, 1)
            }

            body.onResize()
        }
    }

    body.clear = exports.clear = function() {
        for (let i = 0; i < body.items.length; i++) {
            body.items[i].parent = null
        }

        body.items = []
        body.node.innerHTML = ''

        bodyItemResizeFunctions = []
    }

    //drawing stuff
    {
        let needsFrameRequest = true
        let needsIdleRequest = true

        let functions = {
            start: [],
            end: [],

            idle: []
        }

        function callIdleFunctions(deadline) {
            let idleFunctions = functions.idle.splice(0, 20)

            for (let i = 0; i < idleFunctions.length; i++) {
                idleFunctions[i]()
            }

            if (deadline.timeRemaining() > 0 && functions.idle.length > 0) {
                return callIdleFunctions(deadline)
            }

            requestFrameFunction()
        }

        function callFrameFunctions() {
            let frameFunctions = functions.start
                .splice(0, functions.start.length)
                .concat(functions.end.splice(0, functions.end.length))

            for (let i = 0; i < frameFunctions.length; i++) {
                frameFunctions[i]()
            }

            requestFrameFunction()
        }

        function requestFrameFunction() {
            if (functions.start.length === 0 && functions.end.length === 0) {
                needsFrameRequest = true

                if (functions.idle.length === 0) {
                    needsIdleRequest = true
                } else {
                    requestIdleCallback(callIdleFunctions)
                }
            } else {
                requestAnimationFrame(callFrameFunctions)
            }
        }

        body.onFrame = exports.onFrame = {
            start: func => {
                if (functions.start.includes(func)) {
                    return false
                }

                functions.start.push(func)

                if (needsFrameRequest) {
                    needsFrameRequest = false

                    requestAnimationFrame(callFrameFunctions)
                }
            },

            end: func => {
                if (functions.end.includes(func)) {
                    return false
                }

                functions.end.push(func)

                if (needsFrameRequest) {
                    needsFrameRequest = false

                    requestAnimationFrame(callFrameFunctions)
                }
            }
        }

        body.onIdle = exports.onIdle = func => {
            if (functions.idle.includes(func)) {
                return false
            }

            functions.idle.push(func)

            if (needsIdleRequest) {
                needsIdleRequest = false

                requestIdleCallback(callIdleFunctions)
            }
        }

        window.addEventListener('load', () => {
            body.onIdle(() => {
                document.body.style.transition = 'opacity 0.4s'
                document.body.style.opacity = 1

                setTimeout(() => {
                    document.body.style.transition = ''
                }, 1500)

                body.onResize()
            })
        })
    }

    //Cursor stuff
    {
        let validCursors = [
            'none',
            'context-menu',
            'help',
            'pointer',

            'progress',
            'wait',
            'cell',
            'crosshair',
            'text',
            'vertical-text',

            'alias',
            'copy',
            'move',
            'no-drop',
            'not-allowed',
            'all-scroll',
            'col-resize',
            'row-resize',
            'n-resize',
            'e-resize',
            's-resize',
            'w-resize',
            'ne-resize',
            'nw-resize',
            'se-resize',
            'sw-resize',
            'ew-resize',
            'ns-resize',
            'nesw-resize',
            'nwse-resize',

            'zoom-in',
            'zoom-out',

            'grab',
            'grabbing'
        ]
        let lastCursor = ''
        let persistCursor = false

        function setCursor(cursor, persist = false) {
            persistCursor = persist

            if (lastCursor) {
                body.removeClass('cursor-' + lastCursor)

                lastCursor = ''
            }

            if (validCursors.includes(cursor)) {
                body.addClass('cursor-' + cursor)

                lastCursor = cursor
            }
        }

        Object.defineProperty(body, 'cursor', {
            get: () => lastCursor,
            set: setCursor
        })
        Object.defineProperty(exports, 'cursor', {
            get: () => lastCursor,
            set: setCursor
        })

        body.setCursor = exports.setCursor = setCursor

        window.addEventListener('mouseup', () => {
            if (!persistCursor) {
                body.setCursor('')
            }
        })
    }

    //File stuff
    {
        let cancelEvent = event => {
            event.stopPropagation()
            event.preventDefault()
        }

        document.body.addEventListener('dragenter', cancelEvent, true)
        document.body.addEventListener('dragover', cancelEvent, true)

        document.body.addEventListener('drop', event => {
            sendEventTo(
                {
                    fromUser: true,
                    from: body,

                    files: event.dataTransfer.files
                },
                body.events['file-drop']
            )
        })
    }

    let sendResizeEvent = () => {
        sendEventTo({ fromUser: true, from: body }, body.events.resize)
    }
    let sendScrollEvent = () => {
        sendEventTo({ fromUser: true, from: body }, body.events.scroll)
    }

    window.addEventListener('resize', () => {
        size.width = window.innerWidth
        size.height = window.innerHeight

        body.onFrame.start(body.onResize)

        body.onFrame.end(sendResizeEvent)
    })
    document.body.addEventListener('scroll', () => {
        body.onFrame.end(sendScrollEvent)
    })
    window.addEventListener('focus', () => {
        sendEventTo(
            {
                fromUser: true,
                from: body
            },
            body.events.focus
        )
    })
    window.addEventListener('blur', () => {
        sendEventTo(
            {
                fromUser: true,
                from: body
            },
            body.events.blur
        )
    })

    exports.onEvent = body.onEvent = (eventName, listener) => {
        if (typeof eventName !== 'string' || typeof listener !== 'function') {
            return false
        }

        if (!body.events[eventName]) {
            body.events[eventName] = []

            window.addEventListener(
                eventName,
                passEventTo.bind(null, body.events[eventName])
            )
        }

        body.events[eventName].push(listener)
    }

    //Block certain keys from doing their default actions
    {
        let alwaysPrevent = ['Tab']

        window.addEventListener('keydown', event => {
            if (document.activeElement === document.body) {
                event.preventDefault()
            } else if (alwaysPrevent.includes(event.code)) {
                event.preventDefault()
            }
        })
    }

    exports.body = body
}

exports.change = addStyles

//Main items
{
    loadCSS('main.css')

    class Text extends Item {
        /*
        Shows text.

        Constructor data:
            text (string): Text content of item.
        
        Properties:
            text (get/set): Retrieve/update the text content
        
        Methods:
            N/A
        
        Events:
            N/A
        */
        constructor(data = {}, styles = {}) {
            super(document.createElement('p'), styles)
            this.addClass('text')

            this.node.textContent = data.text || ' '
        }

        get text() {
            return this.node.textContent
        }
        set text(text) {
            if (typeof text === 'string') {
                //Always show at least one character
                if (text === '') {
                    this.node.textContent = ' '
                } else {
                    this.node.textContent = text
                }
            }
        }
    }
    exports.Text = items.Text = Text
    itemStylesMap.Text = {
        align: (item, value) => {
            item.node.style.textAlign = value

            return {}
        },
        overflow: (item, value) => {
            if (value === 'ellipsis' || value === 'clip') {
                item.node.style.textOverflow = value

                return { value: 'hidden' }
            }

            return {}
        },
        wrap: (item, value) => {
            if (value === true || value === 'wrap') {
                item.node.style.whiteSpace = 'normal'
            } else if (value === false || value === 'nowrap') {
                item.node.style.whiteSpace = 'nowrap'
            }

            return {}
        }
    }

    class Image extends Item {
        /*
        Displays a single image, scaled to fit.

        Constructor data:
            url (string): Image url.
            color (string: CSS Color): Background color.

        Properties:
            color (get/set) (string: CSS Color): Background color.
            url (get/set) (string): Image url.
        
        Methods:
            N/A

        Events:
            N/A
        */
        constructor(data = {}, styles = {}) {
            super(document.createElement('div'), styles)
            this.addClass('image')

            this.color = data.color
            this.url = data.url
            this._url = ''
        }

        get color() {
            return this.node.style.backgroundColor
        }
        set color(background) {
            if (color.isColor(background)) {
                this.node.style.backgroundColor = background
            }
        }

        get url() {
            return this._url
        }
        set url(url) {
            if (typeof url === 'string') {
                this._url = url
                this.node.style.backgroundImage = formatUrl(this._url)
            }
        }
    }
    exports.Image = items.Image = Image

    class Filler extends Item {
        /*
        Fill up unused space, used for adding spacing between items.

        Constructor data:
            N/A

        Properties:
            N/A
        
        Methods:
            N/A

        Events:
            N/A
        */
        constructor(data = {}, styles = {}) {
            super(document.createElement('div'), styles)

            this.addClass('filler')
        }
    }
    exports.Filler = items.Filler = Filler
    itemStylesMap.Filler = {
        margin: disableStyle,
        marginTop: disableStyle,
        marginLeft: disableStyle,
        marginRight: disableStyle,
        marginBottom: disableStyle,

        padding: disableStyle,
        paddingTop: disableStyle,
        paddingLeft: disableStyle,
        paddingRight: disableStyle,
        paddingBottom: disableStyle
    }

    class Block extends Item {
        /*
        Shows multiple items in a row/column.

        Constructor data:
            items (Array: Items): List of items to be added to block.
            childSpacing (Number: Pixels): Spacing between child elements (and padding).

        Properties:
            items (Array: Items): List of items currently in block.
        
        Methods:
            add (item: Item, index(?): number): Adds given item to the block. If index is specified, will be inserted before the item currently in that position. Otherwise appended to the end.
            remove (item(?): Item || index(?): number): Removes given item from block. If index is given, removes item at that position.
            move (index: number, newIndex: number): Moves the item at the given index to the new index.
            clear: Removes all items from block.

        Events:
        */
        constructor(data = {}, styles = {}) {
            super(document.createElement('div'), {})
            this.addClass('block')

            this.spacing = 0

            if (typeof (data.childSpacing === 'number')) {
                if (isFinite(data.childSpacing) && data.childSpacing >= 0) {
                    this.spacing = data.childSpacing
                }
            }

            if (this.spacing) {
                addStyles(this, {
                    padding: this.spacing / 2
                })
            }

            addStyles(this, styles)

            this.items = []
            this._itemResizeFunctions = []

            //Width, height at last read
            this._width = 0
            this._height = 0
            //Used to check if element has changed size
            this._pWidth = 0
            this._pHeight = 0

            bindFunctions(this, this.onResize, this.readSize, this.checkSize)

            if (Array.isArray(data.items)) {
                for (let i = 0; i < data.items.length; i++) {
                    this.add(data.items[i])
                }
            }
        }

        get childSpacing() {
            return this.spacing
        }

        onResize(toParent = false) {
            if (toParent && this.parent) {
                this.parent.onResize(true)

                return
            }

            for (let i = 0; i < this._itemResizeFunctions.length; i++) {
                this._itemResizeFunctions[i]()
            }
        }

        readSize() {
            this._width = this.node.offsetWidth
            this._height = this.node.offsetHeight
        }
        checkSize() {
            if (
                this._width !== this._pWidth ||
                this._height !== this._pHeight
            ) {
                this._pWidth = this._width
                this._pHeight = this._height

                if (this.parent) {
                    this.parent.checkResize()

                    return
                }
            }

            this.onResize()
        }

        checkResize() {
            body.onFrame.start(this.readSize)
            body.onFrame.end(this.checkSize)
        }

        add(item, index = -1) {
            if (validItem(item) && !this.items.includes(item)) {
                if (this.spacing) {
                    //All items apart from Blocks should have margin set
                    if (item instanceof Block === false) {
                        addStyles(item, {
                            margin: this.spacing / 2
                        })
                    }
                }

                item.parent = this

                if (index >= 0 && index < this.items.length) {
                    this.items.splice(index, 0, item)
                    this.node.insertBefore(item.node, this.node.children[index])
                } else {
                    this.items.push(item)
                    this.node.appendChild(item.node)
                }

                if (typeof item.onResize === 'function') {
                    this._itemResizeFunctions.push(item.onResize)
                }

                this.checkResize()
            }
        }

        remove(index = -1) {
            //If an item is passed instead of a number, find the index of the item
            if (validItem(index)) {
                index = this.items.findIndex(item => item === index)
            }

            if (index >= 0 && index < this.items.length) {
                let item = this.items.splice(index, 1)[0]
                item.parent = null

                this.node.removeChild(item.node)

                index = this._itemResizeFunctions.indexOf(item.onResize)
                if (index !== -1) {
                    this._itemResizeFunctions.splice(index, 1)
                }

                this.checkResize()
            }
        }

        clear() {
            for (let i = 0; i < this.items.length; i++) {
                this.items[i].parent = null
            }

            this.items = []
            this._itemResizeFunctions = []

            this.node.innerHTML = ''

            if (this.parent) {
                this.parent.checkResize()
            }
        }
    }
    exports.Block = items.Block = Block
}

//Layout items
{
    loadCSS('layout.css')

    const dividerSize = 5

    class LayoutBlock extends Item {
        /*
        Used for responsize, resizable layouts. Adds dividers between child elements so that sections can be resized

        Constructor data:
            direction (string: 'vertical' or 'horizontal'): How to arrange child items.
            size (number): Percentage size of parent.
            minWidth (number): Minimum width, in pixels.
            maxWidth (number): Maximum width, in pixels.
            minHeight (number): Minimum height, in pixels.
            maxHeight (number): Minimum height, in pixels.
            items (array: Items): Children.
            small (boolean): If true, divider lines will be show in thin style.
        
        Properties:
            direction (get/set) (string: 'vertical' or 'horizontal'): How children items are arranged.
            size (get/set) (number): Percentage size of parent.
            minWidth (get/set) (number): Minimum width, in pixels.
            maxWidth (get/set) (number): Maximum width, in pixels.
            minHeight (get/set) (number): Minimum height, in pixels.
            maxHeight (get/set) (number): Minimum height, in pixels.
        
        Methods:
            updateMin: Changes min/max Width/Height values to reflect child min/maxes. If item is direct child of body, will change window min/max size
            add (item: Item): Adds item as child, updating dividers and sizes.
            remove (item: Item): Removes child, updating dividers and sizes.
            clear: Removes all children.
            setDividerPosition (divider: item, position: number): Moves the given child divider to the given position, resizing items as neccesary.
        
        Events:
            sizeChange (size: number): Emitted when the .size property is set.
            directionChange (direction: string): Emitted when the .direction property is set.
        */
        constructor(data = {}) {
            super(document.createElement('div'))
            this.addClass('layout-block')

            this.items = []
            this._itemResizeFunctions = []

            this._direction = 'vertical'
            this._size = 0

            this._small = false

            this._min = { width: 0, height: 0 }
            this._max = { width: 0, height: 0 }

            //Size at last read
            this._width = 0
            this._height = 0
            //Used for checking if item has changed size
            this._pWidth = 0
            this._pHeight = 0

            bindFunctions(
                this,
                this.onResize,
                this.readSize,
                this.checkSize,
                this.writeStyle
            )

            if (typeof data.direction === 'string') {
                this.direction = data.direction
            } else {
                this.direction = 'vertical'
            }
            if (typeof data.size === 'number') {
                this.size = data.size
            }
            if (data.small) {
                this._small = true
            }

            this.minWidth = data.minWidth
            this.minHeight = data.minHeight
            this.maxWidth = data.maxWidth
            this.maxHeight = data.maxHeight

            if (Array.isArray(data.items)) {
                for (let i = 0; i < data.items.length; i++) {
                    this.add(data.items[i])
                }
            }
        }

        get nodeWidth() {
            return this._width
        }
        get nodeHeight() {
            return this._height
        }

        get size() {
            return this._size
        }
        set size(size) {
            if (typeof size !== 'number' || !isFinite(size) || size <= 0) {
                return false
            }

            this._size = size

            body.onFrame.end(this.writeStyle)
        }

        get direction() {
            return this._direction
        }
        set direction(direction) {
            if (direction !== 'vertical' && direction !== 'horizontal') {
                return false
            }

            this._direction = direction

            body.onFrame.end(this.writeStyle)
        }

        get minSize() {
            if (!this.parent instanceof LayoutBlock) {
                return 0
            }

            if (this.parent.direction === 'vertical') {
                return (this.minHeight / this.parent.nodeHeight) * 100
            } else if (this.parent.direction === 'horizontal') {
                return (this.minWidth / this.parent.nodeWidth) * 100
            }

            return 0
        }
        get maxSize() {
            if (!this.parent instanceof LayoutBlock) {
                return 0
            }

            if (this.parent.direction === 'vertical') {
                return (this.maxHeight / this.parent.nodeHeight) * 100
            } else if (this.parent.direction === 'horizontal') {
                return (this.maxWidth / this.parent.nodeWidth) * 100
            }

            return Infinity
        }

        get minWidth() {
            return this._min.width
        }
        set minWidth(width) {
            if (typeof width !== 'number' || !isFinite(width) || width < 0) {
                return false
            }

            this._min.width = width

            body.onFrame.end(this.writeStyle)
        }
        get minHeight() {
            return this._min.height
        }
        set minHeight(height) {
            if (typeof height !== 'number' || !isFinite(height) || height < 0) {
                return false
            }

            this._min.height = height

            body.onFrame.end(this.writeStyle)
        }

        get maxWidth() {
            return this._max.width === 0 ? Infinity : this._max.width
        }
        set maxWidth(width) {
            if (width === Infinity) {
                width = 0
            }

            if (typeof width !== 'number' || !isFinite(width) || width < 0) {
                return false
            }

            this._max.width = width

            body.onFrame.end(this.writeStyle)
        }
        get maxHeight() {
            return this._max.height === 0 ? Infinity : this._max.height
        }
        set maxHeight(height) {
            if (height === Infinity) {
                height = 0
            }

            if (typeof height !== 'number' || !isFinite(height) || height < 0) {
                return false
            }

            this._max.height = height

            body.onFrame.end(this.writeStyle)
        }

        onResize(toParent) {
            if (!this.parent) {
                return false
            } else if (toParent) {
                this.parent.onResize(true)

                return
            }

            for (let i = 0; i < this._itemResizeFunctions.length; i++) {
                this._itemResizeFunctions[i]()
            }
        }

        readSize() {
            this._top = this.node.offsetTop
            this._left = this.node.offsetLeft

            this._width = this.node.offsetWidth
            this._height = this.node.offsetHeight
        }

        checkSize() {
            if (!this.parent) {
                return false
            }

            if (
                this._width !== this._pWidth ||
                this._height !== this._pHeight
            ) {
                this._pWidth = this._width
                this._pHeight = this._height

                this.parent.checkResize()

                return
            }

            this.onResize()
        }

        checkResize() {
            if (!this.parent) {
                return false
            }

            body.onFrame.start(this.readSize)
            body.onFrame.end(this.checkSize)
        }

        writeStyle() {
            this.node.style.flexBasis = this._size + '%'

            if (this._direction === 'vertical') {
                this.node.style.flexDirection = 'column'

                this.addClass('vertical')
                this.removeClass('horizontal')
            } else if (this._direction === 'horizontal') {
                this.node.style.flexDirection = 'row'

                this.addClass('horizontal')
                this.removeClass('vertical')
            }

            this.node.style.minWidth = this._min.width + 'px'
            this.node.style.minHeight = this._min.height + 'px'

            if (this._max.width === 0) {
                this.node.style.maxWidth = ''
            } else {
                this.node.style.maxWidth = this._max.width + 'px'
            }
            if (this._max.height === 0) {
                this.node.style.maxHeight = ''
            } else {
                this.node.style.maxHeight = this._max.height + 'px'
            }

            this.checkResize()
        }

        updateMin() {
            if (
                this.items.length === 0 ||
                !(this.items[0] instanceof LayoutBlock)
            ) {
                return false
            }

            let newMin = { width: 0, height: 0 }
            let newMax = { width: 0, height: 0 }

            //TODO: old way of doing it works, check why new one doesn;t

            if (this._direction === 'vertical') {
                this._min.width = this._min.height = 0
                this._max.width = this._max.height = 0

                for (let i = 0; i < this.items.length; i += 2) {
                    if (this.items[i] instanceof LayoutBlock) {
                        this.minWidth = Math.max(
                            this.minWidth,
                            this.items[i].minWidth
                        )
                        this.minHeight += this.items[i].minHeight

                        newMin.width = Math.max(
                            newMin.width,
                            this.items[i].minWidth
                        )
                        newMin.height += this.items[i].minHeight

                        this.maxWidth = Math.min(
                            this.maxWidth,
                            this.items[i].maxWidth
                        )
                        this.maxHeight += this.items[i].maxHeight

                        newMax.width = Math.min(
                            newMax.width,
                            this.items[i].maxWidth
                        )
                        newMax.height += this.items[i].maxHeight
                    }
                }

                this.minHeight += ~~(this.items.length / 2) * dividerSize
                this.maxHeight += ~~(this.items.length / 2) * dividerSize
            } else if (this._direction === 'horizontal') {
                this._min.width = this._min.height = 0
                this._max.width = this._max.height = 0

                for (let i = 0; i < this.items.length; i += 2) {
                    if (this.items[i] instanceof LayoutBlock) {
                        this.minWidth += this.items[i].minWidth
                        this.minHeight = Math.max(
                            this.minHeight,
                            this.items[i].minHeight
                        )

                        this.maxWidth += this.items[i].maxWidth
                        this.maxHeight = Math.min(
                            this.maxHeight,
                            this.items[i].maxHeight
                        )
                    }
                }

                this.minWidth += ~~(this.items.length / 2) * dividerSize
                this.maxWidth += ~~(this.items.length / 2) * dividerSize
            }

            /*
            let newMin = { width: 0, height: 0 }
            let newMax = { width: 0, height: 0 }

            if (this._direction === 'vertical') {
                for (let i = 0; i < this.items.length; i += 2) {
                    if (this.items[i] instanceof LayoutBlock) {
                        newMin.width = Math.max(
                            newMin.width,
                            this.items[i].minWidth
                        )
                        newMin.height += this.items[i].minHeight

                        newMax.width = Math.min(
                            newMax.width,
                            this.items[i].maxWidth
                        )
                        newMax.height += this.items[i].maxHeight
                    }
                }

                newMin.height += ~~(this.items.length / 2) * dividerSize
                newMax.height += ~~(this.items.length / 2) * dividerSize
            } else if (this._direction === 'horizontal') {
                for (let i = 0; i < this.items.length; i += 2) {
                    if (this.items[i] instanceof LayoutBlock) {
                        newMin.width += this.items[i].minWidth
                        newMin.height = Math.max(
                            newMin.height,
                            this.items[i].minHeight
                        )

                        newMax.width += this.items[i].maxWidth
                        newMax.height = Math.min(
                            newMax.height,
                            this.items[i].maxHeight
                        )
                    }
                }

                newMin.width += ~~(this.items.length / 2) * dividerSize
                newMax.width += ~~(this.items.length / 2) * dividerSize
            }

            this.minWidth = newMin.width
            this.minWidth = newMin.width

            this.maxWidth = newMax.width
            this.minHeight = newMax.height
            */

            if (this.parent === body) {
                exports.window.setMinSize({
                    width: this.minWidth,
                    height: this.minHeight
                })
            }
        }

        add(item) {
            if (!validItem(item)) {
                return false
            }

            if (this.items.length >= 1) {
                let newDivider = new LayoutDivider({
                    direction: this._direction,
                    small: this._small
                })

                newDivider.parent = this

                this.items.push(newDivider)
                this.node.appendChild(newDivider.node)
            }

            item.parent = this

            this.items.push(item)
            this.node.appendChild(item.node)

            if (typeof item.onResize === 'function') {
                this._itemResizeFunctions.push(item.onResize)
            }

            this.updateMin()
            this.checkResize()
        }
        remove(itemOrIndex) {
            let index = -1

            if (typeof itemOrIndex === 'number') {
                //If it's a number, needs to be multiplied by 2, since dividers are also stored in items array
                index = itemOrIndex * 2
            } else if (validItem(itemOrIndex)) {
                index = this.items.indexOf(itemOrIndex)
            }

            if (!isFinite(index) || index <= 0) {
                return false
            }

            let item = this.items[index]

            //remove divider
            if (index === 0) {
                if (this.items.length > 1) {
                    this.node.removeChild(this.items[1].node)

                    this.items[1].parent = null

                    this.items.splice(1, 1)
                }
            } else {
                index -= 1

                this.node.removeChild(this.items[index].node)

                this.items[index].parent = null

                this.items.splice(index, 1)
            }

            this.node.removeChild(item.node)

            item.parent = null

            index = this._itemResizeFunctions.indexOf(item.onResize)
            if (index !== -1) {
                this._itemResizeFunctions.splice(index, 1)
            }

            this.updateMin()
            this.checkResize()
        }

        clear() {
            for (let i = this.items.length - 1; i >= 0; i--) {
                this.node.removeChild(this.items[i].node)
                this.items[i].parent = null
            }

            this.items = []
            this._itemResizeFunctions = []

            this.updateMin()

            if (this.parent) {
                this.parent.checkResize()
            }
        }

        setDividerPosition(divider, position) {
            let index = this.items.indexOf(divider)

            if (index === -1) {
                return false
            }

            for (let i = 0; i < index - 1; i += 2) {
                if (this.items[i] instanceof LayoutBlock) {
                    position -= this.items[i].size
                }
            }

            position = round(position, 2)

            let prev = this.items[index - 1]
            let next = this.items[index + 1]

            if (!prev instanceof LayoutBlock || !next instanceof LayoutBlock) {
                return false
            }

            let space = prev.size + next.size

            //Make it no less than the minimum, no greater than maximum
            position = Math.max(prev.minSize, position)
            position = Math.min(prev.maxSize, position)

            position = Math.max(space - next.maxSize, position)
            position = Math.min(space - next.minSize, position)

            prev.size = position
            next.size = space - position
        }
    }
    exports.LayoutBlock = items.LayoutBlock = LayoutBlock

    class LayoutDivider extends Item {
        /*
        Divider lines, used in LayoutBlock to resize sections

        Constructor data:
            direction (string: 'vertical' or 'horizontal'): Which direction to display as.
            small (boolean): If true, displayed with thin style.
        
        Properties:
            direction (set) (boolean): Direction.
        
        Methods:
            N/A
        
        Events:
            N/A
        */
        constructor(data = {}) {
            super(document.createElement('div'))
            this.addClass('layout-divider')

            this._direction = 'vertical'

            if (typeof data.direction === 'string') {
                this.direction = data.direction
            }

            if (data.small) {
                this.addClass('small')
            }

            let mousedown = false
            this.node.addEventListener('mousedown', () => {
                if (this.parent instanceof LayoutBlock === false) {
                    return false
                }

                mousedown = true

                body.setCursor(
                    this._direction === 'horizontal'
                        ? 'col-resize'
                        : 'row-resize'
                )
            })

            let mouse = {
                x: 0,
                y: 0
            }

            let updateParent = function() {
                if (this.parent instanceof LayoutBlock === false) {
                    return false
                }

                let position = 50

                if (this._direction === 'horizontal') {
                    position = mouse.x / this.parent.nodeWidth
                } else if (this._direction === 'vertical') {
                    position = mouse.y / this.parent.nodeHeight
                }

                this.parent.setDividerPosition(this, position * 100)
            }.bind(this)

            body.onEvent('mousemove', event => {
                if (
                    !mousedown ||
                    this.parent instanceof LayoutBlock === false
                ) {
                    return false
                }

                mouse.x = event.pageX - this.parent._left
                mouse.y = event.pageY - this.parent._top

                body.onFrame.start(updateParent)
            })

            body.onEvent('blur', () => {
                mousedown = false
            })

            body.onEvent('mouseup', () => {
                mousedown = false
            })
        }

        set direction(direction) {
            if (direction !== 'vertical' && direction !== 'horizontal') {
                return false
            }

            this._direction = direction

            this.removeClass('vertical horizontal')
            this.addClass(this._direction)
        }
    }
    items.LayoutDivider = LayoutDivider
}

//Interactive items
{
    loadCSS('interactive.css')

    class TabBlock extends focusItem {
        /*
        Used for switching between different items, with a tab list at the top for each item.

        Constructor data:
            tabs (Object): mapping of tab names to the items they display.
        
        Properties:
            tab (get/set) (string): The name of the active tab.
        
        Methods:
            set (sections: Object): Removes any currently visible tabs, and adds all from given sections object.
        
        Events:
            'switch' {tab: '...'}
        */
        constructor(data = {}, styles = {}) {
            super(document.createElement('div'), styles, data.focus)
            this.addClass('tab-block')

            this.tabsNode = document.createElement('div')
            this.tabsNode.className = 'tabs'

            this.node.appendChild(this.tabsNode)

            this.contentNode = document.createElement('div')
            this.contentNode.className = 'content'

            this.node.appendChild(this.contentNode)

            this.tabs = []
            this.activeIndex = -1

            this.lastActiveIndex = -1

            this._width = 0
            this._height = 0

            this._pWidth = 0
            this._pHeight = 0

            bindFunctions(this, this.onResize, this.readSize, this.checkSize)

            this.tabsNode.addEventListener('click', event => {
                if (event.target.tagName === 'BUTTON') {
                    this.setTab(event.target.textContent, true)
                }
            })

            this.set(data.tabs)
        }

        get tab() {
            if (this.activeIndex < 0 || this.activeIndex >= this.tabs.length) {
                return
            }

            return this.tabs[this.activeIndex].name
        }
        set tab(name) {
            return this.setTab(name, false)
        }

        get index() {
            return this.activeIndex
        }
        set index(index) {
            if (index >= 0 && index < this.tabs.length) {
                this.setTab(index, false)

                return true
            } else {
                return false
            }
        }

        onResize(toParent) {
            if (toParent && this.parent) {
                this.parent.onResize(true)

                return
            }

            if (
                this.activeIndex >= 0 &&
                this.activeIndex < this.tabs.length &&
                typeof this.tabs[this.activeIndex].content.onResize ===
                    'function'
            ) {
                this.tabs[this.activeIndex].content.onResize()
            }
        }

        readSize() {
            this._width = this.node.offsetWidth
            this._height = this.node.offsetHeight
        }
        checkSize() {
            if (
                this._width !== this._pWidth ||
                this._height !== this._pHeight
            ) {
                this._pWidth = this._width
                this._pHeight = this._height

                if (this.parent) {
                    this.parent.checkResize()

                    return
                }
            }

            this.onResize()
        }

        checkResize() {
            body.onFrame.start(this.readSize)
            body.onFrame.end(this.checkSize)
        }

        setTab(index, fromUser = false) {
            if (typeof index === 'string') {
                index = this.tabs.findIndex(tab => tab.name === index)
            }

            if (
                typeof index !== 'number' ||
                !isFinite(index) ||
                index < 0 ||
                index >= this.tabs.length
            ) {
                return false
            }

            if (this.activeIndex >= 0 && this.activeIndex < this.tabs.length) {
                this.tabsNode.children[this.activeIndex].classList.remove(
                    'active'
                )
                this.tabs[this.activeIndex].content.node.style.display = 'none'
            }

            this.activeIndex = index

            this.tabsNode.children[this.activeIndex].classList.add('active')
            this.tabs[this.activeIndex].content.node.style.display = ''

            this.checkResize()

            this.focus(fromUser)

            sendEventTo(
                {
                    tab: this.tabs[this.activeIndex],

                    fromUser: fromUser,
                    from: this
                },
                this.events.switch
            )
        }

        set(tabs) {
            if (!Array.isArray(tabs)) {
                return false
            }

            while (this.tabs.length > 0) {
                this.contentNode.removeChild(this.contentNode.firstChild)
                this.tabs.shift()
            }

            for (let i = 0; i < tabs.length; i++) {
                if (
                    typeof tabs[i] === 'object' &&
                    !Array.isArray(tabs[i]) &&
                    tabs[i] !== null
                ) {
                    if (
                        validItem(tabs[i].content) &&
                        typeof tabs[i].name === 'string'
                    ) {
                        this.tabs.push({
                            name: tabs[i].name,
                            content: tabs[i].content
                        })

                        tabs[i].content.node.style.display = 'none'

                        this.contentNode.appendChild(tabs[i].content.node)

                        if (
                            this.tabsNode.childElementCount < this.tabs.length
                        ) {
                            this.tabsNode.appendChild(
                                document.createElement('button')
                            )
                        }

                        this.tabsNode.children[
                            this.tabs.length - 1
                        ].textContent = tabs[i].name
                    }
                }
            }

            while (this.tabsNode.childElementCount > this.tabs.length) {
                this.tabsNode.removeChild(this.tabsNode.lastChild)
            }

            if (this.tabs.length > 0) {
                this.index = 0
            }
        }
    }
    exports.TabBlock = items.TabBlock = TabBlock

    class ReorderableBlock extends Item {
        /*
        Block item, with dividers before/after each item, and reorder methods/events.

        Constructor data:
            items (Array: Items): Children.
        
        Properties:
            items (Array): Children array.
            hovering (boolean): Whether or not to show highlight on dividers on mouse over.
        
        Methods:
            add (item: Item, index: number): Adds item as child, if index is given then it will be inserted at that position, otherwise appended to the end.
            remove (index: number): Removes the child at the given index.
            move (index: number, newIndex: number): Moves child from at index to new position.
            indexOf (item: Item): Returns the index position of the child.
            clear: Removes all children.
        
        Events:
            drop (index: number): Emitted when user releases mouse after hovering.
            reorder (index: number, oldIndex: number): Emitted when child is moved to new position.

        */
        constructor(data, styles) {
            super(document.createElement('div'), styles)
            this.addClass('reorderable-block')

            this.node.appendChild(getSeparatorNode())

            this._offsetTop = 0
            this._scrollTop = 0

            this.items = []
            this._itemResizeFunctions = []

            this.hovering = false

            this.lastIndexHover = -1

            bindFunctions(
                this,
                this.onResize,
                this.readScroll,
                this.readSize,
                this.checkSize
            )

            if (Array.isArray(data.items)) {
                for (let i = 0; i < data.items.length; i++) {
                    this.add(data.items[i])
                }
            }

            this.node.addEventListener('mousemove', mouse => {
                if (this.hovering) {
                    let newIndex = this.mouseIndex(mouse)

                    if (newIndex === this.lastIndexHover) {
                        return false
                    }

                    if (this.lastIndexHover >= 0) {
                        this.node.children[
                            this.lastIndexHover * 2
                        ].classList.remove('active')
                    }

                    this.lastIndexHover = newIndex

                    this.node.children[this.lastIndexHover * 2].classList.add(
                        'active'
                    )
                }
            })

            this.node.addEventListener('mouseup', mouse => {
                if (this.lastIndexHover >= 0) {
                    this.node.children[
                        this.lastIndexHover * 2
                    ].classList.remove('active')
                }

                if (this.hovering) {
                    sendEventTo(
                        {
                            index: this.mouseIndex(mouse),

                            fromUser: true,
                            from: this
                        },
                        this.events.drop
                    )
                }

                this.lastIndexHover = -1
            })
            this.node.addEventListener('mouseleave', () => {
                if (this.lastIndexHover >= 0) {
                    this.node.children[
                        this.lastIndexHover * 2
                    ].classList.remove('active')

                    this.lastIndexHover = -1
                }
            })

            this.node.addEventListener('scroll', () => {
                body.onFrame.start(this.readScroll)
            })

            body.onEvent('mouseup', () => {
                if (this.lastIndexHover >= 0) {
                    this.node.children[
                        this.lastIndexHover * 2
                    ].classList.remove('active')
                }

                this.hovering = false

                this.lastIndexHover = -1
            })
        }

        onResize(toParent) {
            if (!this.parent) {
                return false
            } else if (toParent) {
                this.parent.onResize(true)

                return
            }

            for (let i = 0; i < this._itemResizeFunctions.length; i++) {
                this._itemResizeFunctions[i]()
            }
        }

        readScroll() {
            this._scrollTop = this.node.scrollTop
        }

        readSize() {
            this._width = this.node.offsetWidth
            this._height = this.node.offsetHeight

            //Update all item offset top/height
            this._offsetTop = this.node.offsetTop
            for (let i = 0; i < this.items.length; i++) {
                this.items[i]._nodeOffsetTop =
                    this.items[i].node.offsetTop - this._offsetTop
                this.items[i]._nodeOffsetHeight = this.items[
                    i
                ].node.offsetHeight
            }
        }

        checkSize() {
            if (!this.parent) {
                return false
            }

            if (
                this._width !== this._pWidth ||
                this._height !== this._pHeight
            ) {
                this._pWidth = this._width
                this._pHeight = this._height

                this.parent.checkResize()

                return
            }

            this.onResize()
        }

        checkResize() {
            if (!this.parent) {
                return false
            }

            body.onFrame.start(this.readSize)
            body.onFrame.end(this.checkSize)
        }

        mouseIndex(mouse) {
            if (this.items.length === 0) {
                return 0
            }

            let mouseY = mouse.clientY - this._offsetTop + this._scrollTop

            if (
                mouseY <
                this.items[0]._nodeOffsetTop +
                    this.items[0]._nodeOffsetHeight / 2
            ) {
                return 0
            }

            for (let i = this.items.length - 1; i >= 0; i--) {
                if (
                    mouseY >=
                    this.items[i]._nodeOffsetTop +
                        this.items[i]._nodeOffsetHeight / 2
                ) {
                    return i + 1
                }
            }

            return -1
        }

        add(item, index = this.items.length) {
            if (validItem(item) && !this.items.includes(item)) {
                if (index >= 0 && index < this.items.length) {
                    this.node.insertBefore(
                        item.node,
                        this.items[index].node.previousSibling
                    )

                    this.items.splice(index, 0, item)
                } else {
                    this.items.push(item)

                    this.node.insertBefore(item.node, this.node.lastChild)
                }

                item._nodeOffsetHeight = 0
                item._nodeOffsetTop = 0

                item.parent = this

                this.node.insertBefore(getSeparatorNode(), item.node)

                if (typeof item.onResize === 'function') {
                    this._itemResizeFunctions.push(item.onResize)
                }

                this.checkResize()
            }
        }

        remove(index) {
            if (validItem(index)) {
                index = this.indexOf(index)
            }

            if (
                typeof index === 'number' &&
                index >= 0 &&
                index < this.items.length
            ) {
                let item = this.items.splice(index, 1)[0]

                item.parent = null

                this.node.removeChild(
                    item.node.previousSibling || item.node.nextSibling
                )
                this.node.removeChild(item.node)

                index = this._itemResizeFunctions.indexOf(item.onResize)
                if (index !== -1) {
                    this._itemResizeFunctions.splice(index, 1)
                }

                this.checkResize()
            }
        }

        move(index, newIndex, fromUser = false) {
            if (validItem(index)) {
                index = this.items.indexOf(index)
            }

            let validIndex =
                index >= 0 && index < this.items.length && index !== newIndex
            let validNewIndex =
                newIndex >= 0 &&
                newIndex <= this.items.length &&
                newIndex !== index + 1

            if (validIndex && validNewIndex) {
                let item = this.items.splice(index, 1)[0]
                let divider = item.node.previousSibling

                let event = {
                    index: newIndex,
                    oldIndex: index,

                    fromUser: fromUser,
                    from: this
                }

                if (newIndex > index) {
                    newIndex -= 1
                }

                if (newIndex >= this.items.length) {
                    this.node.appendChild(item.node)
                    this.node.appendChild(divider)
                } else {
                    this.node.insertBefore(
                        item.node,
                        this.items[newIndex].node.previousSibling
                    )
                    this.node.insertBefore(divider, item.node)
                }

                this.items.splice(newIndex, 0, item)

                body.onFrame.start(this.readSize)

                sendEventTo(event, this.events.reorder)
            }
        }

        indexOf(item) {
            return this.items.indexOf(item)
        }

        clear() {
            for (let i = 0; i < this.items.length; i++) {
                this.items[i].parent = null
            }
            this.items = []

            //TODO: recycle separators
            this.node.innerHTML = ''

            this.node.appendChild(getSeparatorNode())

            if (this.parent) {
                this.parent.checkResize()
            }
        }
    }
    exports.ReorderableBlock = items.ReorderableBlock = ReorderableBlock
}

//Input items
{
    loadCSS('input.css')

    let inputAutoFocusSkipClasses = [exports.Filler, exports.Text]

    class InputItem extends focusItem {
        /*
        Used as wrapper for input items

        Constructor arguments:
            type (string): Input node type. A input element is created, assigned the type, and given a new random id.
            label (string): Text displayed above input, linked to input node. If not given, no label is created.
            focus (boolean): globalFocus property

        Properties:
            inputNode (HTML Element): The items input node.
            autoFocusNext (boolean): If true, when the user presses enter on the input, it will automatically focus the next sibling, if it's a input item.
            disabled (get/set) (boolean): Retrieve/set the disabled state of the input.
            label (get) (string)
        
        Methods:
            addInputClass (className: string): Adds class(es) to the inputNode.
            removeInputClass (className: string): Removes class(es) to the inputNode.

        Events:
            'focus'
            'blur'
        */
        constructor(type, label, focus = true, styles = {}) {
            super(document.createElement('div'), {}, focus)
            this.inputNode = document.createElement('input')
            this.inputNode.id = getUniqueId(this.inputNode.tagName)
            this.inputNode.type = type

            if (typeof label === 'string') {
                this.node.appendChild(document.createElement('label'))
                this.node.firstChild.textContent = label

                this.node.firstChild.setAttribute('for', this.inputNode.id)
            }

            this.node.appendChild(this.inputNode)

            addStyles(this, styles)

            this.autoFocusNext = false

            this.inputNode.addEventListener('focus', () => {
                this._focused = true

                if (this._globalFocus === true) {
                    body.inputFocused(this, !this._codeFocused)
                }

                sendEventTo(
                    {
                        fromUser: !this._codeFocused,
                        from: this
                    },
                    this.events.focus
                )

                this._codeFocused = false
            })

            //TODO: fix
            //Blur event always has fromUser: true. This shouldn't happen when calling .blur
            this.inputNode.addEventListener('blur', () => {
                this._focused = false
                sendEventTo(
                    {
                        fromUser: true,
                        from: this
                    },
                    this.events.blur
                )
            })
            this.inputNode.addEventListener('keydown', keyEvent => {
                if (keyEvent.key === 'Enter') {
                    if (this.autoFocusNext === true && this.parent) {
                        let index = this.parent.items.indexOf(this)

                        while (index < this.parent.items.length) {
                            if (
                                typeof this.parent.items[index + 1].focus ===
                                'function'
                            ) {
                                this.parent.items[index + 1].focus()

                                break
                            } else {
                                let exit = true

                                for (
                                    let i = 0;
                                    i < inputAutoFocusSkipClasses.length;
                                    i++
                                ) {
                                    if (
                                        this.parent.items[index + 1] instanceof
                                        inputAutoFocusSkipClasses[i]
                                    ) {
                                        index += 1
                                        exit = false
                                    }
                                }
                                if (exit) {
                                    break
                                }
                            }
                        }

                        if (index < this.parent.items.length) {
                            if (
                                this.parent.items[index + 1] instanceof
                                InputItem
                            )
                                this.parent.items[index + 1].focus()
                        }
                    }
                }
            })
        }

        get disabled() {
            return this.inputNode.disabled
        }
        set disabled(disabled) {
            if (typeof disabled === 'boolean') {
                this.inputNode.disabled = disabled
            }
        }

        get label() {
            if (this.node.firstChild.tagName === 'LABEL') {
                return this.node.firstChild.textContent
            }

            return ''
        }

        focus(fromUser = false) {
            this._codeFocused = !fromUser

            this.inputNode.focus()
        }
        blur(fromUser = false) {
            this.inputNode.blur()
        }
    }
    itemStylesMap.InputItem = {
        margin: (item, value) => {
            //Margin should also change spacing between the label and input element
            if (item.node.firstChild !== item.inputNode) {
                item.node.firstChild.style.marginBottom = mapToPx(value)
            }

            return {}
        }
    }
    items.InputItem = InputItem

    //Vertical distance between popup origin, and popup box
    let popupArrowHeight = 7

    class InputPopup {
        constructor(data = {}) {
            this.node = document.createElement('div')
            this.node.className = 'popup'

            this.arrowNode = document.createElement('div')
            this.arrowNode.className = 'arrow'
            this.node.appendChild(this.arrowNode)

            this.box = {
                maxWidth: 100,
                minWidth: 0,
                maxHeight: 100,
                minHeight: 0,

                padding: 4,

                width: 0,
                height: 0,

                top: 0,
                left: 0,
                right: 0,
                bottom: 0
            }

            if (isFinite(data.maxWidth) && data.maxWidth > 0) {
                this.box.maxWidth = data.maxWidth
            }
            if (isFinite(data.minWidth) && data.minWidth > 0) {
                this.box.minWidth = data.minWidth
            }
            if (isFinite(data.maxHeight) && data.maxHeight > 0) {
                this.box.maxHeight = data.maxHeight
            }
            if (isFinite(data.minHeight) && data.minHeight > 0) {
                this.box.minHeight = data.minHeight
            }

            if (isFinite(data.padding) && data.padding > 0) {
                this.box.padding = data.padding
            }
        }

        _move(position) {
            this.box.left =
                position.x + position.width / 2 - this.box.maxWidth / 2

            this.box.left = Math.min(
                window.innerWidth - this.box.maxWidth - this.box.padding,
                this.box.left
            )
            this.box.left = Math.max(this.box.padding, this.box.left)

            this.node.style.left = this.box.left + 'px'

            this.box.width = Math.min(
                this.box.maxWidth,
                window.innerWidth - this.box.padding * 2
            )

            this.box.width = Math.max(this.box.minWidth, this.box.width)
            this.node.style.width = this.box.width + 'px'

            let spaceBelow =
                window.innerHeight -
                (position.y + position.height) -
                popupArrowHeight
            let spaceAbove = position.y - popupArrowHeight

            if (spaceBelow < this.box.maxHeight && spaceBelow < spaceAbove) {
                //Show popup above position
                this.node.style.bottom =
                    window.innerHeight - position.y + popupArrowHeight + 'px'
                this.node.style.top = ''

                this.node.classList.add('above')

                this.box.height = Math.min(
                    this.box.maxHeight,
                    spaceAbove - this.box.padding
                )
                this.box.height = Math.max(this.box.minHeight, this.box.height)

                this.box.top = position.y - popupArrowHeight - this.box.height
            } else {
                //Show popup below position
                this.node.style.top =
                    position.y + position.height + popupArrowHeight + 'px'
                this.node.style.bottom = ''

                this.node.classList.remove('above')

                this.box.height = Math.min(
                    this.box.maxHeight,
                    spaceBelow - this.box.padding
                )
                this.box.height = Math.max(this.box.minHeight, this.box.height)

                this.box.top = position.y + position.height + popupArrowHeight
            }
            this.node.style.height = this.box.height + 'px'

            this.arrowNode.style.left =
                Math.min(
                    this.box.width - 22,
                    position.x - this.box.left + (position.width / 2 - 6)
                ) + 'px'
        }

        hide() {
            if (this.node.parentNode === document.body) {
                document.body.removeChild(this.node)
            }
        }
    }

    //Button (and Drag) don't retain focus. Interacting with them will make other items blur, but they don't stay focused
    class Button extends Item {
        /*
        Standard button input.

        Constructor data:
            size (string): 'large'.
            disabled (boolean): Disabled state.
            icon (string): Icon name. If undefined, no icon will be shown.
            text (string): Text shown in button.
            active (boolean): If button should be activated.
            toggle (boolean): If button should respond to clicks by toggling active state. If true, will emit 'toggle' events, with .active property
            tooltip (string): Shown when button is hovered.
            onClick (function): Called when button is clicked.
        
        Properties:
            icon (get/set) (string): Retrieve/set icon.
            text (get/set) (string): Retrieve/set text in button.
            tooltip (get/set) (string): Retrieve/set button tooltip.
            disabled (get/set) (boolean)
            active (get/set) (boolean)
        
        Methods:
            click

        Events:
            'click',
            'toggle',
            'drag'
        */
        constructor(data = {}, styles = {}) {
            super(document.createElement('button'), styles)
            this.addClass('input-button')

            this.textNode = document.createElement('span')
            this.iconNode = getIconSVG('')

            this.node.appendChild(this.textNode)

            this.icon = data.icon
            this.text = data.text
            this.tooltip = data.tooltip

            if (data.size === 'large') {
                this.addClass(data.size)
            }

            if (data.disabled === true) {
                this.node.disabled = true
            }

            //override default click behaviour
            //(If events.click is not defined, calling onEvent(click) will cause normal mouse click logic to be implemented)
            this.events.click = []

            if (typeof data.onClick === 'function') {
                this.node.addEventListener('click', data.onClick)
            }

            if (data.active === true) {
                this.active = true
            }

            if (data.toggle === true) {
                this._toggle = true
            } else {
                this._toggle = false
            }

            this.node.addEventListener('click', () => {
                this.node.blur()

                if (data.focus !== false) {
                    body.inputFocused(this, true)
                }

                if (this._toggle) {
                    this.node.classList.toggle('active')

                    sendEventTo(
                        {
                            active: this.node.classList.contains('active'),

                            fromUser: true,
                            from: this
                        },
                        this.events.toggle
                    )
                } else {
                    if (this.node.classList.contains('active')) {
                        this.node.classList.remove('active')
                    }
                }

                sendEventTo(
                    {
                        fromUser: true,
                        from: this
                    },
                    this.events.click
                )
            })

            body.onEvent('blur', () => this.node.blur())
            body.onEvent('mouseup', () => this.node.blur())
        }

        onEvent(eventName, listener = () => {}) {
            if (eventName === 'drag' && !this.events.drag) {
                this.events.drag = [listener]

                this._mousedown = false

                this.node.addEventListener('mousedown', () => {
                    this._mousedown = true
                })

                this.node.addEventListener('mouseleave', event => {
                    if (this._mousedown) {
                        event.fromUser = true
                        event.from = this
                        sendEventTo(event, this.events.drag)
                    }
                })

                body.onEvent('mouseup', () => {
                    this._mousedown = false
                })
            } else {
                super.onEvent(...arguments)
            }
        }

        get icon() {
            return this.iconNode.firstChild.getAttribute('xlink:href').slice(1)
        }
        set icon(icon) {
            if (icon && typeof icon === 'string') {
                this.node.insertBefore(this.iconNode, this.textNode)

                this.iconNode.firstChild.setAttribute(
                    'xlink:href',
                    getIconUrl(icon)
                )
            } else if (this.iconNode.parentNode === this.node) {
                this.node.removeChild(this.iconNode)
            }
        }
        get text() {
            return this.textNode.textContent
        }
        set text(text) {
            if (typeof text === 'string') {
                this.textNode.textContent = text
            }
        }
        get tooltip() {
            return this.node.title
        }
        set tooltip(tooltip) {
            if (typeof tooltip === 'string') {
                this.node.title = tooltip
            }
        }

        get disabled() {
            return this.node.disabled
        }
        set disabled(disabled) {
            if (typeof disabled === 'boolean') {
                this.node.disabled = disabled
            }
        }

        get active() {
            return this.node.classList.contains('active')
        }
        set active(active) {
            if (active) {
                this.node.classList.add('active')
            } else {
                this.node.classList.remove('active')
            }

            if (this._toggle) {
                sendEventTo(
                    {
                        active: this.node.classList.contains('active'),

                        fromUser: false,
                        from: this
                    },
                    this.events.toggle
                )
            }
        }

        click() {
            sendEventTo(
                {
                    fromUser: false,
                    from: this
                },
                this.events.click
            )
        }
    }
    exports.Button = items.Button = Button

    class CheckboxInput extends InputItem {
        /*
        Standard checkbox input. Label is shown after input.

        Constructor data:
            disabled (boolean)
            value (boolean)
            onChange (function)
        
        Properties (extends InputItem):
            value (get/set) (boolean): Retrieve the checked state.
        
        Methods (extends InputItem):
            N/A

        Events (extends InputItem):
            'change':
                value (boolean)
                oldValue (boolean): Checked state before the event was sent
        */
        constructor(data = {}, styles = {}) {
            super('checkbox', data.label, data.focus, styles)
            this.addClass('input-checkbox')

            //The checkbox needs to be before the label
            this.node.insertBefore(this.inputNode, this.node.firstChild)

            this.disabled = data.disabled

            if (typeof data.value === 'boolean') {
                this.inputNode.checked = data.value
            }

            if (typeof data.onChange === 'function') {
                this.onEvent('change', data.onChange)
            }

            this._oldValue = this.inputNode.checked

            this.inputNode.addEventListener('change', () => {
                this.inputNode.blur()

                sendEventTo(
                    {
                        value: this.inputNode.checked,
                        oldValue: this._oldValue,

                        fromUser: true,
                        from: this
                    },
                    this.events.change
                )

                this._oldValue = this.inputNode.checked
            })
        }

        get value() {
            return this.inputNode.checked
        }
        set value(value) {
            if (typeof value === 'boolean') {
                this.inputNode.checked = value

                sendEventTo(
                    {
                        value: this.inputNode.checked,
                        oldValue: this._oldValue,

                        fromUser: false,
                        from: this
                    },
                    this.events.change
                )

                this._oldValue = this.inputNode.checked
            }
        }
    }
    //inputItem class has style mappings for margin, these need to be reset:
    itemStylesMap.CheckboxInput = {
        margin: () => {
            return {}
        }
    }
    exports.CheckboxInput = items.CheckboxInput = CheckboxInput

    class TextInput extends InputItem {
        /*
        Standard single line text input.

        Constructor data:
            autoFocusNext (boolean)
            disabled (boolean)
            placeholder (string)
            tooltip (string)
            value (string)
        
        Properties (extends InputItem):
            placeholder (get/set) (string): placeholder text
            tooltip (get/set) (string): tooltip text
            value (get/set) (string): current text in input
        
        Methods (extends InputItem):
            N/A
        
        Events (extends InputItem):
            'change':
                value (string)
                oldValue (string): Value of input before change event happened.
            'enter':
                value (string)
        */
        constructor(data = {}, styles = {}) {
            super('text', data.label, data.focus, styles)
            this.addClass('input-text')

            if (typeof data.autoFocusNext === 'boolean') {
                this.autoFocusNext = data.autoFocusNext
            }

            this.disabled = data.disabled

            this._maxLength = Infinity

            this.tooltip = data.tooltip
            this.placeholder = data.placeholder

            this.maxLength = data.maxLength

            //the get/set also sends events, so just set the value directly
            if (typeof data.value === 'string') {
                this.inputNode.value = data.value
            }

            this._oldValue = this.inputNode.value
            this.inputNode.addEventListener('input', () => {
                if (this.inputNode.value.length > this._maxLength) {
                    this.inputNode.value = this.inputNode.value.slice(
                        0,
                        this._maxLength
                    )

                    if (this.inputNode.value === this._oldValue) {
                        return false
                    }
                }

                sendEventTo(
                    {
                        value: this.inputNode.value,
                        oldValue: this._oldValue,

                        fromUser: true,
                        from: this
                    },
                    this.events.change
                )

                this._oldValue = this.inputNode.value
            })

            this.inputNode.addEventListener('keydown', keyEvent => {
                if (keyEvent.key === 'Enter') {
                    sendEventTo(
                        {
                            value: this.inputNode.value,

                            fromUser: true,
                            from: this
                        },
                        this.events.enter
                    )

                    this.blur()
                }
            })

            this.inputNode.addEventListener(
                'contextmenu',
                () => {
                    exports.contextMenu.showInput([
                        {
                            role: 'cut'
                        },
                        {
                            role: 'copy'
                        },
                        {
                            role: 'paste'
                        },
                        {
                            role: 'selectall'
                        }
                    ])
                },
                true
            )

            //TODO: listen to context menu events
        }

        get placeholder() {
            return this.inputNode.placeholder
        }
        set placeholder(placeholder) {
            if (typeof placeholder === 'string') {
                this.inputNode.placeholder = placeholder
            }
        }
        get tooltip() {
            return this.inputNode.tooltip
        }
        set tooltip(tooltip) {
            if (typeof tooltip === 'string') {
                this.inputNode.tooltip = tooltip
            }
        }

        get maxLength() {
            return this._maxLength
        }
        set maxLength(maxLength) {
            if (isFinite(maxLength) && maxLength > 0) {
                this._maxLength = maxLength

                this.inputNode.maxLength = this._maxLength
            } else if (maxLength === Infinity || maxLength === 0) {
                this._maxLength = Infinity

                this.inputNode.removeAttribute('maxlength')
            }
        }

        get value() {
            return this.inputNode.value
        }
        set value(value) {
            if (typeof value === 'string') {
                if (value.length > this._maxLength) {
                    value = value.slice(0, this._maxLength)
                }

                this.inputNode.value = value

                sendEventTo(
                    {
                        value: value,
                        oldValue: this._oldValue,

                        fromUser: false,
                        from: this
                    },
                    this.events.change
                )

                this._oldValue = this.inputNode.value
            }
        }
    }
    exports.TextInput = items.TextInput = TextInput
    let inputExtraWidth = '14px'
    itemStylesMap.TextInput = {
        width: (item, value) => {
            return {
                value: 'calc(' + value + ' + ' + inputExtraWidth + ')'
            }
        },
        maxWidth: (item, value) => {
            return {
                value: 'calc(' + value + ' + ' + inputExtraWidth + ')'
            }
        },
        minWidth: (item, value) => {
            return {
                value: 'calc(' + value + ' + ' + inputExtraWidth + ')'
            }
        },
        size: item => {
            item.inputNode.style.width = 'calc(100% - ' + inputExtraWidth + ')'

            return {}
        },
        align: (item, value) => {
            if (value === 'stretch') {
                item.inputNode.style.width =
                    'calc(100% - ' + inputExtraWidth + ')'
            }

            return { value: value }
        }
    }

    class TextMultiLineInput extends focusItem {
        /*
        Text input block.

        Constructor data:
            disabled (boolean)
            tooltip (string)
            placeholder (string)
            value (string)
        
        Properties:
            disabled (get/set) (boolean)
            label (get) (string)
            placeholder (get/set) (string)
            tooltip (get/set) (string)
            value (get/set) (string)
        
        Methods:
            focus
            blur
        
        Events:
            change (value: string, oldValue: string)
            focus
            blur
        */
        constructor(data = {}, styles = {}) {
            super(document.createElement('div'), styles, data.focus)
            this.inputNode = document.createElement('textarea')
            this.inputNode.id = getUniqueId('textMultiLine')
            this.addClass('input-text-multiLine')

            if (typeof label === 'string') {
                this.node.appendChild(document.createElement('label'))
                this.node.firstChild.textContent = label

                this.node.firstChild.setAttribute('for', this.inputNode.id)
            }

            this.node.appendChild(this.inputNode)

            this.disabled = data.disabled

            this.tooltip = data.tooltip
            this.placeholder = data.placeholder

            if (typeof data.value === 'string') {
                this.inputNode.value = data.value
            }

            this.inputNode.addEventListener('focus', () => {
                this._focused = true
                if (this._globalFocus) {
                    body.inputFocused(this, !this._codeFocused)
                }
                sendEventTo(
                    {
                        fromUser: !this._codeFocused,
                        from: this
                    },
                    this.events.focus
                )
                this._codeFocused = false
            })

            this.inputNode.addEventListener('blur', () => {
                this._focused = false
                sendEventTo(
                    {
                        fromUser: true,
                        from: this
                    },
                    this.events.blur
                )
            })

            this._oldValue = this.inputNode.value
            this.inputNode.addEventListener('input', () => {
                this._oldValue = this.inputNode.value

                sendEventTo(
                    {
                        value: this.inputNode.value,
                        oldValue: this._oldValue,

                        fromUser: true,
                        from: this
                    },
                    this.events.change
                )
            })

            this.inputNode.addEventListener(
                'contextmenu',
                () => {
                    exports.contextMenu.showInput([
                        {
                            role: 'cut'
                        },
                        {
                            role: 'copy'
                        },
                        {
                            role: 'paste'
                        },
                        {
                            role: 'selectall'
                        }
                    ])
                },
                true
            )

            //TODO: listen to context menu events
        }

        get disabled() {
            return this.inputNode.disabled
        }
        set disabled(disabled) {
            if (typeof disabled === 'boolean') {
                this.inputNode.disabled = disabled
            }
        }

        get label() {
            if (this.node.firstChild.tagName === 'LABEL') {
                return this.node.firstChild.textContent
            }

            return ''
        }

        get placeholder() {
            return this.inputNode.placeholder
        }
        set placeholder(placeholder) {
            if (typeof placeholder === 'string') {
                this.inputNode.placeholder = placeholder
            }
        }

        get tooltip() {
            return this.inputNode.tooltip
        }
        set tooltip(tooltip) {
            if (typeof tooltip === 'string') {
                this.inputNode.tooltip = tooltip
            }
        }

        get value() {
            return this.inputNode.value
        }
        set value(value) {
            if (typeof (value === 'string')) {
                this.inputNode.value = value

                sendEventTo(
                    {
                        value: value,
                        oldValue: this._oldValue,

                        fromUser: false,
                        from: this
                    },
                    this.events.change
                )
            }
        }

        focus() {
            this._codeFocused = true

            this.inputNode.focus()
        }
        blur() {
            this.inputNode.blur()
        }
    }
    exports.TextMultiLineInput = items.TextMultiLineInput = TextMultiLineInput

    //Number input popup control
    let numberPopup = new InputPopup({
        maxWidth: 200,

        minHeight: 18,
        maxHeight: 18
    })
    {
        numberPopup.node.classList.add('number')

        let sliderNode = document.createElement('div')
        sliderNode.className = 'slider'
        numberPopup.node.appendChild(sliderNode)

        let numberRange = {
            min: 0,
            max: 0,

            value: 0
        }

        let sliderWidth = 0
        let sliderLeft = 0

        let sliderButtonSize = 12
        let sliderPadding = 3

        let mouseDown = false

        numberPopup.dragCallback = null

        function moveSlider(value) {
            numberRange.currentValue = Math.max(
                numberRange.min,
                Math.min(numberRange.max, value)
            )

            let pos =
                ((numberRange.currentValue - numberRange.min) /
                    (numberRange.max - numberRange.min)) *
                sliderWidth

            sliderNode.style.left = pos + sliderPadding - 1 + 'px'
        }

        function onMouseMove(event) {
            if (mouseDown) {
                let newPos = Math.max(
                    0,
                    Math.min(sliderWidth, event.pageX - sliderLeft)
                )

                sliderNode.style.left = newPos + sliderPadding - 1 + 'px'

                if (typeof numberPopup.dragCallback === 'function') {
                    let actualNumber =
                        (newPos / sliderWidth) *
                            (numberRange.max - numberRange.min) +
                        numberRange.min

                    numberRange.currentValue = actualNumber

                    numberPopup.dragCallback({
                        value: actualNumber,

                        from: numberPopup,
                        fromUser: true
                    })
                }
            }
        }

        numberPopup.show = function(position, number) {
            numberPopup.move(position)

            if (typeof number.min === 'number' && isFinite(number.min)) {
                numberRange.min = number.min
            } else {
                numberRange.min = 0
            }
            if (typeof number.max === 'number' && isFinite(number.max)) {
                numberRange.max = number.max
            } else {
                numberRange.max = 10
            }

            if (typeof number.value === 'number' && isFinite(number.value)) {
                moveSlider(number.value || 0)
            } else {
                moveSlider(0)
            }

            document.body.appendChild(numberPopup.node)
        }
        numberPopup.move = function(position) {
            numberPopup._move(position)

            sliderWidth =
                numberPopup.box.width - sliderPadding * 2 - sliderButtonSize
            sliderLeft =
                numberPopup.box.left + sliderPadding + sliderButtonSize / 2

            moveSlider(numberRange.currentValue)
        }
        numberPopup.hide = function() {
            mouseDown = false
            sliderNode.classList.remove('active')
            numberPopup.dragCallback = null

            if (numberPopup.node.parentNode === document.body) {
                document.body.removeChild(numberPopup.node)
            }
        }

        Object.defineProperty(numberPopup, 'value', {
            set: moveSlider
        })

        numberPopup.node.addEventListener('mousedown', event => {
            mouseDown = true
            sliderNode.classList.add('active')

            onMouseMove(event)
        })
        body.onEvent('mouseup', () => {
            mouseDown = false
            sliderNode.classList.remove('active')
        })
        body.onEvent('blur', () => {
            mouseDown = false
            sliderNode.classList.remove('active')
        })

        body.onEvent('mousemove', onMouseMove)
    }
    class NumberInput extends focusItem {
        /*
        Standard number input. Can have units displayed to the right.

        Constructor data:
            autoFocusNext (boolean)
            disabled (boolean)
            placeholder (string)
            tooltip (string)
            unit (string): Shown at end of input.
            max (number): Upper limit.
            min (number): Lower limit.
            step (number): Increment amount.
            value (number)
        
        Properties (extends InputItem):
            placeholder (get/set) (string)
            tooltip (get/set) (string)
            max (get/set) (number)
            min (get/set) (number)
            step (get/set) (number)
            value (get/set) (number)
        
        Methods (extends InputItem):
        
        Events (extends InputItem):
            'change':
                value (number)
                oldValue (number): Value before change event happened.
            'enter':
                value (number)
        */
        constructor(data = {}, styles = {}) {
            super(document.createElement('div'), {}, data.focus)
            this.addClass('input-number')

            this.inputNode = document.createElement('input')
            this.inputNode.id = getUniqueId(this.inputNode.tagName)
            this.inputNode.type = 'number'

            if (typeof data.label === 'string') {
                this.node.appendChild(document.createElement('label'))
                this.node.firstChild.textContent = data.label

                this.node.firstChild.setAttribute('for', this.inputNode.id)
            }

            this.node.appendChild(this.inputNode)

            if (typeof data.unit === 'string') {
                this.node.appendChild(document.createElement('label'))

                this.node.lastChild.textContent = data.unit
                this.node.lastChild.className = 'unit'

                this.node.lastChild.setAttribute('for', this.inputNode.id)
            }

            addStyles(this, styles)

            this.autoFocusNext = false
            if (typeof data.autoFocusNext === 'boolean') {
                this.autoFocusNext = data.autoFocusNext
            }

            this._options = {
                min: 0,
                max: 10,
                step: 1,

                precision: 3,

                popupMin: 0,
                setPopupMin: false,

                popupMax: 10,
                setPopupMax: false
            }

            this.max = data.max
            this.min = data.min
            this.step = data.step
            this.precision = data.precision

            if (typeof data.popupMin === 'number' && isFinite(data.popupMin)) {
                this._options.popupMin = data.popupMin
                this._options.setPopupMin = true
            } else {
                this._options.popupMin = this._options.min
            }
            if (typeof data.popupMax === 'number' && isFinite(data.popupMax)) {
                this._options.popupMax = data.popupMax
                this._options.setPopupMax = true
            } else {
                this._options.popupMax = this._options.max
            }

            this._value = 0
            this._oldValue = 0

            this.placeholder = data.placeholder
            this.tooltip = data.tooltip

            this.disabled = data.disabled

            bindFunctions(
                this,
                this.showPopup,
                this.movePopup,
                this.onPopupDrag
            )

            this.value = data.value

            this.inputNode.addEventListener('focus', () => {
                this._focused = true

                this.inputNode.classList.add('active')
                this.inputNode.style.zIndex = '11'

                this.openPopup()

                if (this._globalFocus === true) {
                    body.inputFocused(this, !this._codeFocused)
                }

                sendEventTo(
                    {
                        fromUser: !this._codeFocused,
                        from: this
                    },
                    this.events.focus
                )

                this._codeFocused = false
            })
            this.inputNode.addEventListener('input', () => {
                this._value = round(
                    parseFloat(this.inputNode.value),
                    this._options.precision
                )

                if (this._value !== parseFloat(this.inputNode.value)) {
                    this.inputNode.value = this._value
                }

                if (this._value !== this._oldValue) {
                    numberPopup.value = this._value

                    sendEventTo(
                        {
                            value: this._value,
                            oldValue: this._oldValue,

                            fromUser: true,
                            from: this
                        },
                        this.events.change
                    )

                    this._oldValue = this._value
                }
            })
            this.inputNode.addEventListener('keydown', keyEvent => {
                if (keyEvent.key === 'Enter') {
                    sendEventTo(
                        {
                            value: parseFloat(this.inputNode.value),

                            fromUser: true,
                            from: this
                        },
                        this.events.enter
                    )

                    this.blur()

                    if (this.autoFocusNext === true && this.parent) {
                        let index = this.parent.items.indexOf(this)

                        while (index < this.parent.items.length) {
                            if (
                                typeof this.parent.items[index + 1].focus ===
                                'function'
                            ) {
                                this.parent.items[index + 1].focus()

                                break
                            } else {
                                let exit = true

                                for (
                                    let i = 0;
                                    i < inputAutoFocusSkipClasses.length;
                                    i++
                                ) {
                                    if (
                                        this.parent.items[index + 1] instanceof
                                        inputAutoFocusSkipClasses[i]
                                    ) {
                                        index += 1
                                        exit = false
                                    }
                                }

                                if (exit) {
                                    break
                                }
                            }
                        }

                        if (index < this.parent.items.length) {
                            if (
                                this.parent.items[index + 1] instanceof
                                InputItem
                            ) {
                                this.parent.items[index + 1].focus()
                            }
                        }
                    }
                }
            })

            body.onEvent('blur', this.blur.bind(this))
            body.onEvent('mousedown', event => {
                if (
                    this.node !== event.target &&
                    this.node.contains(event.target) === false &&
                    numberPopup.node !== event.target &&
                    numberPopup.node.contains(event.target) === false
                ) {
                    this.blur()
                }
            })

            body.onEvent('resize', this.movePopup)
            body.onEvent('scroll', this.movePopup)

            this.inputNode.addEventListener(
                'contextmenu',
                () => {
                    exports.contextMenu.showInput([
                        {
                            role: 'cut'
                        },
                        {
                            role: 'copy'
                        },
                        {
                            role: 'paste'
                        },
                        {
                            role: 'selectall'
                        }
                    ])
                },
                true
            )
        }

        get disabled() {
            return this.inputNode.disabled
        }
        set disabled(disabled) {
            if (typeof disabled === 'boolean') {
                this.inputNode.disabled = disabled
            }
        }

        get label() {
            if (this.node.firstChild.tagName === 'LABEL') {
                return this.node.firstChild.textContent
            }

            return ''
        }

        get placeholder() {
            return this.inputNode.placeholder
        }
        set placeholder(placeholder) {
            if (typeof placeholder === 'string') {
                this.inputNode.placeholder = placeholder
            }
        }
        get tooltip() {
            return this.inputNode.tooltip
        }
        set tooltip(tooltip) {
            if (typeof tooltip === 'string') {
                this.inputNode.tooltip = tooltip
            }
        }

        get precision() {
            return this._options.precision
        }
        set precision(precision) {
            if (
                typeof precision === 'number' &&
                isFinite(precision) &&
                precision >= 0
            ) {
                this._options.precision = Math.round(precision)

                this.min = this._options.min
                this.max = this._options.max
                this.step = this._options.step

                if (
                    this._value !== round(this._value, this._options.precision)
                ) {
                    this.value = this._value
                }
            }
        }

        get max() {
            return this._options.max
        }
        set max(max) {
            if (
                typeof max === 'number' &&
                isFinite(max) &&
                max >= this._options.min
            ) {
                max = round(max, this._options.precision)

                this._options.max = this.inputNode.max = max

                if (!this._options.setPopupMax) {
                    this._options.popupMax = this._options.max
                }
            }
        }

        get min() {
            return this._options.min
        }
        set min(min) {
            if (
                typeof min === 'number' &&
                isFinite(min) &&
                min <= this._options.max
            ) {
                min = round(min, this._options.precision)

                this._options.min = this.inputNode.min = min

                if (!this._options.setPopupMin) {
                    this._options.popupMin = this._options.min
                }
            }
        }

        get step() {
            return this._options.step
        }
        set step(step) {
            if (typeof step === 'number' && isFinite(step) && step > 0) {
                step = round(step, this._options.precision)

                this._options.step = this.inputNode.step = step
            }
        }

        get value() {
            return this._value
        }
        set value(value) {
            if (typeof value === 'number' && isFinite(value)) {
                this._value = round(
                    Math.max(
                        this._options.min,
                        Math.min(this._options.max, value)
                    ),
                    this._options.precision
                )

                this.inputNode.value = this._value

                sendEventTo(
                    {
                        value: this._value,
                        oldValue: this._oldValue,

                        fromUser: false,
                        from: this
                    },
                    this.events.change
                )

                this._oldValue = this._value
            }
        }

        onPopupDrag(event) {
            this._value = this.inputNode.value = round(
                event.value,
                this._options.precision
            )

            sendEventTo(
                {
                    value: this._value,
                    oldValue: this._oldValue,

                    fromUser: event.fromUser,
                    from: this
                },
                this.events.change
            )

            this._oldValue = this._value
        }

        showPopup() {
            numberPopup.show(this.inputNode.getBoundingClientRect(), {
                value: this._value,

                min: this._options.popupMin,
                max: this._options.popupMax
            })
        }
        movePopup() {
            if (this._focused) {
                numberPopup.move(this.inputNode.getBoundingClientRect())
            }
        }

        openPopup() {
            body.onFrame.start(this.showPopup)

            numberPopup.dragCallback = this.onPopupDrag
        }

        focus(fromUser = false) {
            this._codeFocused = !fromUser

            this.inputNode.focus()
        }
        blur() {
            if (!this._focused) {
                return false
            }

            this._focused = false

            this.inputNode.classList.remove('active')
            this.inputNode.style.zIndex = ''

            numberPopup.hide()

            sendEventTo(
                {
                    fromUser: true,
                    from: this
                },
                this.events.blur
            )

            this.inputNode.blur()
        }
    }
    exports.NumberInput = items.NumberInput = NumberInput
    itemStylesMap.NumberInput = {
        width: (item, value) => {
            return {
                node: item.inputNode,
                value: 'calc(' + value + ' + 1px)'
            }
        },
        maxWidth: (item, value) => {
            return {
                node: item.inputNode,
                value: 'calc(' + value + ' + 1px)'
            }
        },
        minWidth: (item, value) => {
            return {
                node: item.inputNode,
                value: 'calc(' + value + ' + 1px)'
            }
        },
        align: (item, value) => {
            if (value === 'stretch') {
                if (item.node.childElementCount === 3) {
                    setNodeStyle(
                        item.inputNode,
                        'width',
                        'calc(100% - 10px - ' +
                            item.lastChange.offsetWidth +
                            'px)'
                    )
                } else {
                    setNodeStyle(item.inputNode, 'width', 'calc(100% - 10px)')
                }
            }

            return { value: value }
        }
    }

    //hue, saturation, brightness numbers -> {red, green, blue} object
    function hsbToStrRGB(hue, saturation, brightness) {
        //from https://stackoverflow.com/a/17243070

        let f = (hue / 360) * 6 - Math.floor((hue / 360) * 6)
        let p = brightness * (1 - saturation)
        let q = brightness * (1 - f * saturation)
        let t = brightness * (1 - (1 - f) * saturation)

        let red = brightness
        let green = t
        let blue = p

        if (hue >= 60 && hue < 120) {
            red = q
            green = brightness
            blue = p
        } else if (hue >= 120 && hue < 180) {
            red = p
            green = brightness
            blue = t
        } else if (hue >= 180 && hue < 240) {
            red = p
            green = q
            blue = brightness
        } else if (hue >= 240 && hue < 300) {
            red = t
            green = p
            blue = brightness
        } else if (hue >= 300 && hue < 360) {
            red = brightness
            green = p
            blue = q
        }

        return {
            red: Math.round(red * 255),
            green: Math.round(green * 255),
            blue: Math.round(blue * 255)
        }
    }

    //red, green, blue numbers -> {hue, saturation, brightness} object
    function rgbToHSB(red, green, blue) {
        //from https://stackoverflow.com/a/17243070

        let max = Math.max(red, green, blue)
        let min = Math.min(red, green, blue)

        let diff = max - min
        let hue = 0

        if (max !== min) {
            if (max === red) {
                hue = green - blue + diff * (green < blue ? 6 : 0)
            } else if (max === green) {
                hue = blue - red + diff * 2
            } else if (max === blue) {
                hue = red - green + diff * 4
            }
            hue /= 6 * diff
        }

        return {
            hue: (hue *= 360),
            saturation: (max === 0 ? 0 : diff / max) * 100,
            brightness: max / 2.5
        }
    }

    //Color input popup control
    let colorPopup = new InputPopup({
        maxWidth: 200,
        maxHeight: 150
    })
    {
        colorPopup.node.classList.add('color')

        let boxPadding = 4
        //hue input box adds 20, numbers input adds 28
        let boxExtraVerticalHeight = 48

        let currentColor = {
            hue: 0,
            saturation: 0,
            brightness: 0,

            red: 0,
            green: 0,
            blue: 0
        }

        let inputSize = {
            top: 0,
            left: 0,
            width: 0
        }

        let currentInput = ''

        let inputBox = document.createElement('div')
        inputBox.className = 'input'
        colorPopup.node.appendChild(inputBox)

        //saturation-lightness box
        let sbNode = document.createElement('div')
        sbNode.className = 'satlight'
        inputBox.appendChild(sbNode)

        let sbSlider = document.createElement('div')
        sbSlider.className = 'slider'
        sbNode.appendChild(sbSlider)

        let hueNode = document.createElement('div')
        hueNode.className = 'hue'
        inputBox.appendChild(hueNode)

        let hueSlider = document.createElement('div')
        hueSlider.className = 'slider'
        hueNode.appendChild(hueSlider)

        //r, g, b, number inputs
        numberInputs = {}
        {
            let numberInputBox = document.createElement('div')
            numberInputBox.className = 'numbers'

            let colors = ['red', 'green', 'blue']

            function onNumberChange() {
                let newColor = rgbToHSB(
                    currentColor.red,
                    currentColor.green,
                    currentColor.blue
                )

                currentColor.hue = newColor.hue
                currentColor.saturation = newColor.saturation
                currentColor.brightness = newColor.brightness

                if (typeof colorPopup.changeCallback === 'function') {
                    colorPopup.changeCallback({
                        value:
                            'rgb(' +
                            currentColor.red +
                            ',' +
                            currentColor.green +
                            ',' +
                            currentColor.blue +
                            ')',

                        from: colorPopup,
                        fromUser: true
                    })
                }

                if (needsUpdate) {
                    needsUpdate = false
                    requestAnimationFrame(updateInputBox)
                }
            }

            function onInputChange(color) {
                let value = parseFloat(this.value)
                if (isFinite(value)) {
                    currentColor[color] = value

                    onNumberChange()
                }
            }

            function onInputBlur(color) {
                this.value = currentColor[color]
            }

            for (let i = 0; i < colors.length; i++) {
                numberInputs[colors[i]] = document.createElement('input')
                numberInputs[colors[i]].type = 'number'
                numberInputs[colors[i]].max = 255
                numberInputs[colors[i]].min = 0
                numberInputs[colors[i]].step = 1
                numberInputs[colors[i]].value = 0
                numberInputs[colors[i]].id =
                    'color-popup-' + colors[i] + '-input'
                numberInputBox.appendChild(document.createElement('label'))
                numberInputBox.lastElementChild.textContent = colors[
                    i
                ][0].toUpperCase()
                numberInputBox.lastElementChild.for = numberInputs[colors[i]].id
                numberInputBox.appendChild(numberInputs[colors[i]])

                numberInputs[colors[i]].addEventListener(
                    'change',
                    onInputChange.bind(numberInputs[colors[i]], colors[i])
                )
                numberInputs[colors[i]].addEventListener(
                    'keydown',
                    onInputChange.bind(numberInputs[colors[i]], colors[i])
                )

                numberInputs[colors[i]].addEventListener(
                    'blur',
                    onInputBlur.bind(numberInputs[colors[i]], colors[i])
                )
            }

            colorPopup.node.appendChild(numberInputBox)
        }

        let needsUpdate = true
        function updateInputBox() {
            needsUpdate = true

            sbNode.style.background =
                'linear-gradient(to right, white, hsl(' +
                currentColor.hue +
                ',100%,50%))'

            sbSlider.style.top = 100 - currentColor.brightness + '%'
            sbSlider.style.left = currentColor.saturation + '%'
            hueSlider.style.left = currentColor.hue / 3.6 + '%'
        }

        function onDrag(mouse) {
            if (currentInput === 'sb') {
                currentColor.brightness = Math.max(
                    0,
                    Math.min(
                        100,
                        100 -
                            ((mouse.pageY - inputSize.top) / inputSize.height) *
                                100
                    )
                )

                currentColor.saturation = Math.max(
                    0,
                    Math.min(
                        100,
                        ((mouse.pageX - inputSize.left) / inputSize.width) * 100
                    )
                )
            } else if (currentInput === 'hue') {
                currentColor.hue = Math.max(
                    0,
                    Math.min(
                        360,
                        ((mouse.pageX - inputSize.left) / inputSize.width) * 360
                    )
                )
            } else {
                return false
            }

            let newColor = hsbToStrRGB(
                currentColor.hue,
                currentColor.saturation / 100,
                currentColor.brightness / 100
            )

            currentColor.red = numberInputs.red.value = newColor.red
            currentColor.green = numberInputs.green.value = newColor.green
            currentColor.blue = numberInputs.blue.value = newColor.blue

            if (typeof colorPopup.changeCallback === 'function') {
                colorPopup.changeCallback({
                    value:
                        'rgb(' +
                        currentColor.red +
                        ',' +
                        currentColor.green +
                        ',' +
                        currentColor.blue +
                        ')',

                    from: colorPopup,
                    fromUser: true
                })
            }

            if (needsUpdate) {
                needsUpdate = false
                requestAnimationFrame(updateInputBox)
            }
        }

        function removeActiveHighlight() {
            if (currentInput === 'sb') {
                sbSlider.classList.remove('active')
            } else if (currentInput === 'hue') {
                hueSlider.classList.remove('active')
            }
        }

        colorPopup.show = function(position, data) {
            colorPopup.move(position)

            document.body.appendChild(colorPopup.node)

            let newColor = color.extractRGB(data.value)
            currentColor.red = numberInputs.red.value = newColor.r
            currentColor.green = numberInputs.green.value = newColor.g
            currentColor.blue = numberInputs.blue.value = newColor.b

            newColor = rgbToHSB(newColor.r, newColor.g, newColor.b)
            currentColor.hue = newColor.hue
            currentColor.saturation = newColor.saturation
            currentColor.brightness = newColor.brightness

            updateInputBox()
        }
        colorPopup.move = function(position) {
            colorPopup._move(position)

            inputSize.top = colorPopup.box.top + boxPadding
            inputSize.left = colorPopup.box.left + boxPadding
            inputSize.width = colorPopup.box.width - boxPadding * 2
            inputSize.height =
                colorPopup.box.height - boxPadding * 2 - boxExtraVerticalHeight
        }
        colorPopup.hide = function() {
            removeActiveHighlight()
            currentInput = ''
            colorPopup.changeCallback = null

            if (colorPopup.node.parentNode === document.body) {
                document.body.removeChild(colorPopup.node)
            }
        }

        sbNode.addEventListener('mousedown', event => {
            removeActiveHighlight()
            currentInput = 'sb'

            sbSlider.classList.add('active')

            onDrag(event)
        })
        hueNode.addEventListener('mousedown', event => {
            removeActiveHighlight()
            currentInput = 'hue'

            hueSlider.classList.add('active')

            onDrag(event)
        })

        body.onEvent('mouseup', () => {
            removeActiveHighlight()
            currentInput = ''
        })
        body.onEvent('blur', () => {
            removeActiveHighlight()
            currentInput = ''
        })

        body.onEvent('mousemove', onDrag)
    }

    let blankColor =
        'url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAAAAABX3VL4AAAACXBIWXMAAAsTAAALEwEAmpwYAAAADklEQVQImWP+L8Uw8z8AB6wCtQYJB2cAAAAASUVORK5CYII=)'
    class ColorInput extends focusItem {
        /*
        Standard color input.

        Constructor data:
            disabled (boolean)
            tooltip (string)
            value (string: COLOR)
            focus (boolean): If false, will not emit global body input-focus event.
        
        Properties:
            disabled (get/set) (boolean)
            label (get) (string)
            tooltip (get/set) (string)
            value (get/set) (string: CSS Color)
        
        Methods:
            focus
            blur
        
        Events:
            'change':
                value (string: COLOR)
                oldValue (string: COLOR): Value before change event happened.
            'enter':
                value (string: COLOR)
        */
        constructor(data = {}, styles = {}) {
            super(document.createElement('div'), {}, data.focus)

            this.addClass('input-color')

            if (typeof data.label === 'string') {
                this.node.appendChild(document.createElement('label'))
                this.node.firstChild.textContent = data.label
            }

            addStyles(this, styles)

            this.buttonNode = document.createElement('button')
            this.node.appendChild(this.buttonNode)

            this.colorSquare = document.createElement('div')
            this.colorSquare.style.backgroundImage = blankColor
            this.buttonNode.appendChild(this.colorSquare)
            this.buttonNode.appendChild(getIconSVG('expand-x'))

            this.disabled = data.disabled

            this.tooltip = data.tooltip

            bindFunctions(
                this,
                this.showPopup,
                this.movePopup,
                this.onPopupChange
            )

            this._value = 'rgb(0,0,0)'
            this.value = data.value

            this.buttonNode.addEventListener('click', () => {
                this.buttonNode.blur()
                this._focused = true

                if (this._globalFocus) {
                    body.inputFocused(this, !this._codeFocused)
                }
                sendEventTo(
                    {
                        fromUser: !this._codeFocused,
                        from: this
                    },
                    this.events.focus
                )

                this.openPopup()

                this.buttonNode.classList.add('active')
                this._codeFocused = false
            })

            body.onEvent('mousedown', event => {
                if (
                    event.target === this.node ||
                    this.node.contains(event.target) ||
                    colorPopup.node.contains(event.target) ||
                    event.target === colorPopup.node ||
                    event.target === document.body
                ) {
                    return false
                }

                this.blur()
            })
            body.onEvent('blur', this.blur.bind(this))

            body.onEvent('resize', this.movePopup)
            body.onEvent('scroll', this.movePopup)
        }

        get disabled() {
            return this.buttonNode.disabled
        }
        set disabled(disabled) {
            if (typeof disabled === 'boolean') {
                this.buttonNode.disabled = disabled
            }
        }

        get label() {
            if (this.node.firstChild.tagName === 'LABEL') {
                return this.node.firstChild.textContent
            }

            return ''
        }

        get tooltip() {
            return this.buttonNode.tooltip
        }
        set tooltip(tooltip) {
            if (typeof tooltip === 'string') {
                this.buttonNode.tooltip = tooltip
            }
        }

        get value() {
            return this._value
        }
        set value(value) {
            if (color.isColor(value)) {
                this._value = color.toRGB(value)

                this.colorSquare.style.background = this._value

                sendEventTo(
                    {
                        value: this._value,
                        oldValue: this._oldValue,

                        fromUser: false,
                        from: this
                    },
                    this.events.change
                )

                this._oldValue = this._value
            }
        }

        onPopupChange(event) {
            this._value = event.value

            this.colorSquare.style.background = this._value

            sendEventTo(
                {
                    value: this._value,
                    oldValue: this._oldValue,

                    fromUser: event.fromUser,
                    from: this
                },
                this.events.change
            )

            this._oldValue = this._value
        }

        showPopup() {
            colorPopup.show(this.buttonNode.getBoundingClientRect(), {
                value: this._value
            })
        }
        movePopup() {
            if (this._focused) {
                colorPopup.move(this.buttonNode.getBoundingClientRect())
            }
        }

        openPopup() {
            body.onFrame.start(this.showPopup)

            colorPopup.changeCallback = this.onPopupChange
        }

        focus(fromUser = false) {
            this._codeFocused = !fromUser
            this.buttonNode.click()
        }
        blur(fromUser = false) {
            if (!this._focused) {
                return false
            }

            this._focused = false

            colorPopup.hide()

            sendEventTo(
                {
                    fromUser: fromUser,
                    from: this
                },
                this.events.blur
            )

            this.buttonNode.classList.remove('active')
        }
    }
    itemStylesMap.ColorInput = {
        margin: (item, value) => {
            if (item.node.firstChild !== item.inputNode) {
                item.node.firstChild.style.marginBottom = mapToPx(value)
            }

            return {}
        }
    }
    exports.ColorInput = items.ColorInput = ColorInput

    class SelectInput extends focusItem {
        /*
        Standard drop-down select input.

        Constructor data:
            disabled (boolean)
            label (string): Shown above dropdown box.
            tooltip (string)
            options (array: string)
            value (string)
            index (number)
        
        Properties:
            disabled (get/set) (boolean)
            tooltip (get/set) (string)
            options (get/set) (array: string)
            value (get/set) (string)
            index (get/set) (number)
        
        Methods:
            add (value, index?): adds value as an option (optional index: at what position to add the new item).
            remove (value/index): Removes the specified value/index from options.
            indexOf (item: string): Returns the index of the given option.
            focus
            blur
        
        Events:
            focus
            blur
            change (value)

        */
        constructor(data = {}, styles = {}) {
            super(document.createElement('div'), {}, data.focus)
            this.inputNode = document.createElement('select')
            this.inputNode.id = getUniqueId(this.inputNode.tagName)

            if (typeof data.label === 'string') {
                this.node.appendChild(document.createElement('label'))
                this.node.firstChild.textContent = data.label

                this.node.firstChild.setAttribute('for', this.inputNode.id)
            }

            this.node.appendChild(this.inputNode)

            addStyles(this, styles)

            this.addClass('input-select')

            this.disabled = data.disabled

            this.tooltip = data.tooltip

            this.options = data.options

            if (typeof data.value === 'string') {
                for (let i = 0; i < this.inputNode.children.length; i++) {
                    if (this.inputNode.children[i].value === data.value) {
                        this.inputNode.selectedIndex = i
                    }
                }
            } else if (typeof data.index === 'number') {
                if (
                    data.index >= 0 &&
                    data.index < this.inputNode.childElementCount
                ) {
                    this.inputNode.selectedIndex = data.index
                }
            }

            //TODO: check difference between 'input' and 'change' events
            this._oldValue = this.inputNode.value
            this.inputNode.addEventListener('input', () => {
                this.blur()

                sendEventTo(
                    {
                        value: this.inputNode.value,
                        oldValue: this._oldValue,

                        index: this.options.indexOf(this.inputNode.value),

                        fromUser: true,
                        from: this
                    },
                    this.events.change
                )

                this._oldValue = this.inputNode.value
            })

            this.inputNode.addEventListener('focus', () => {
                this._focused = true

                if (this._globalFocus) {
                    body.inputFocused(this, !this._codeFocused)
                }

                sendEventTo(
                    {
                        fromUser: !this._codeFocused,
                        from: this
                    },
                    this.events.focus
                )

                this._codeFocused = false
            })

            //TODO: Create custom drop down list
        }

        get disabled() {
            return this.inputNode.disabled
        }
        set disabled(disabled) {
            if (typeof disabled === 'boolean') {
                this.inputNode.disabled = disabled
            }
        }

        get tooltip() {
            return this.inputNode.tooltip
        }
        set tooltip(tooltip) {
            if (typeof tooltip === 'string') {
                this.inputNode.tooltip = tooltip
            }
        }

        get options() {
            let list = []

            for (let i = 0; i < this.inputNode.options.length; i++) {
                list.push(this.inputNode.options[i].value)
            }

            return list
        }
        set options(options) {
            if (!Array.isArray(options)) {
                return false
            }

            for (let i = this.inputNode.options.length - 1; i >= 0; i--) {
                this.inputNode.remove(0)
            }

            for (let i = 0; i < options.length; i++) {
                let elem = document.createElement('option')
                elem.value = elem.textContent = options[i]
                this.inputNode.add(elem)
            }
        }

        get value() {
            return this.inputNode.value
        }
        set value(value) {
            if (typeof value === 'string') {
                let index = this.indexOf(value)

                if (index === -1) {
                    return false
                }

                this.inputNode.selectedIndex = index

                sendEventTo(
                    {
                        value: this.inputNode.value,
                        oldValue: this._oldValue,

                        index: this.options.indexOf(this.inputNode.value),

                        fromUser: false,
                        from: this
                    },
                    this.events.change
                )

                this._oldValue = this.inputNode.value
            }
        }
        get index() {
            return this.inputNode.selectedIndex
        }
        set index(index) {
            if (index >= 0 && index < this.inputNode.length) {
                this.value = this.inputNode.children[index].value
            }
        }

        indexOf(string) {
            if (typeof string !== 'string') {
                return -1
            }

            for (let i = 0; i < this.inputNode.children.length; i++) {
                if (this.inputNode.children[i].value === string) {
                    return i
                }
            }

            return -1
        }

        add(option, index = this.inputNode.length) {
            if (typeof option === 'string' && !this.options.includes(option)) {
                let newElem = document.createElement('option')
                newElem.value = option
                newElem.innerText = option

                if (index < this.inputNode.length && index >= 0) {
                    this.inputNode.add(option, index)
                } else {
                    this.inputNode.add(newElem)
                }
            }
        }
        remove(item) {
            if (
                typeof item === 'number' &&
                item >= 0 &&
                item < this.data.options.length
            ) {
                this.data.options.splice(item, 1)
                this.inputNode.remove(item)
            } else if (typeof item === 'string') {
                let index = this.data.options.indexOf(item)
                if (index !== -1) {
                    this.data.options.splice(index, 1)
                    this.node.remove(index)
                }
            }
        }

        focus() {
            this._codeFocused = true
            this.inputNode.focus()
        }
        blur() {
            this.inputNode.blur()
        }
    }
    exports.SelectInput = items.SelectInput = SelectInput
    itemStylesMap.SelectInput = {
        width: item => {
            return {
                node: item.inputNode
            }
        },
        maxWidth: item => {
            return {
                node: item.inputNode
            }
        },
        minWidth: item => {
            return {
                node: item.inputNode
            }
        }
    }

    //Font input dropdown list
    let fontDropDown = {}
    {
        let mainNode = document.createElement('div')
        mainNode.className = 'font-dropdown'

        let listNode = document.createElement('div')
        listNode.className = 'list'

        let maxHeight = 700
        let minHeight = 200

        mainNode.appendChild(listNode)

        fontDropDown.node = mainNode

        fontDropDown.hoverCallback = null
        fontDropDown.clickCallback = null

        listNode.addEventListener('mouseover', event => {
            if (
                typeof fontDropDown.hoverCallback === 'function' &&
                event.target.tagName === 'LI'
            ) {
                fontDropDown.hoverCallback({
                    value: event.target.textContent,

                    fromUser: true,
                    from: fontDropDown
                })
            }
        })
        listNode.addEventListener('click', event => {
            if (
                typeof fontDropDown.clickCallback === 'function' &&
                event.target.tagName === 'LI'
            ) {
                fontDropDown.clickCallback({
                    value: event.target.textContent,

                    fromUser: true,
                    from: fontDropDown
                })
            }
        })

        function updateList() {
            listNode.innerHTML = ''

            for (let i = 0; i < fonts.all.length; i++) {
                listNode.appendChild(document.createElement('li'))

                listNode.lastChild.textContent = fonts.all[i]
                listNode.lastChild.style.fontFamily = fonts.all[i]
            }
        }

        fontDropDown.show = function(position) {
            fontDropDown.move(position)

            for (let i = 0; i < listNode.childNodes.length; i++) {
                listNode.childNodes[i].style.display = ''
            }

            document.body.appendChild(mainNode)
        }
        fontDropDown.move = function(position) {
            mainNode.style.left = position.left + 'px'
            mainNode.style.width = position.width + 'px'

            //If the space above is greather than below, and the space below is less than the minimum height
            if (
                window.innerHeight - position.bottom < minHeight &&
                position.top > window.innerHeight - position.bottom
            ) {
                mainNode.style.bottom =
                    window.innerHeight - position.top - 2 + 'px'
                mainNode.style.top = ''

                mainNode.style.maxHeight =
                    Math.min(maxHeight, position.top - 4) + 'px'
            } else {
                mainNode.style.top = position.bottom - 2 + 'px'
                mainNode.style.bottom = ''

                mainNode.style.maxHeight =
                    Math.min(
                        maxHeight,
                        window.innerHeight - position.bottom - 4
                    ) + 'px'
            }
        }
        fontDropDown.hide = function() {
            if (mainNode.parentNode === document.body) {
                document.body.removeChild(mainNode)
            }

            fontDropDown.hoverCallback = null
            fontDropDown.clickCallback = null
        }

        Object.defineProperty(fontDropDown, 'search', {
            set: search => {
                search = search.toLowerCase()

                for (let i = 0; i < listNode.childNodes.length; i++) {
                    if (
                        listNode.childNodes[i].textContent
                            .toLowerCase()
                            .includes(search)
                    ) {
                        listNode.childNodes[i].style.display = ''
                    } else {
                        listNode.childNodes[i].style.display = 'none'
                    }
                }
            }
        })

        fonts.onEvent('update', updateList)
    }

    class FontInput extends focusItem {
        /*
        A drop-down input for selecting a font.

        Constructor data:
            disabled (boolean)
            label (string): Shown above input box.
            tooltip (string)
            value (string)
        
        Properties:
            disabled (get/set) (boolean)
            value (get/set) (string)
        
        Methods:
            openDropDown
            focus
            blur
        */
        constructor(data = {}, styles = {}) {
            super(document.createElement('div'), {}, data.focus)
            this.addClass('input-font')

            this.inputNode = document.createElement('input')
            this.inputNode.id = getUniqueId(this.inputNode.tagName)
            this.inputNode.type = 'text'

            if (typeof data.label === 'string') {
                this.node.appendChild(document.createElement('label'))
                this.node.firstChild.textContent = data.label

                this.node.firstChild.setAttribute('for', this.inputNode.id)
            }

            this.node.appendChild(this.inputNode)

            bindFunctions(
                this,
                this.showDropDown,
                this.moveDropDown,
                this.onDropDownHover,
                this.onDropDownClick
            )

            addStyles(this, styles)

            this.disabled = data.disabled

            this._value = ''
            this._oldValue = ''

            this._tempValue = ''

            this.value = data.value

            this.inputNode.addEventListener('focus', () => {
                this.openDropDown()

                this._focused = true

                this.inputNode.value = ''
                this.inputNode.style.zIndex = '11'

                if (this._globalFocus) {
                    body.inputFocused(this, !this._codeFocused)
                }

                sendEventTo(
                    {
                        fromUser: !this._codeFocused,
                        from: this
                    },
                    this.events.focus
                )

                this._codeFocused = false
            })

            this.inputNode.addEventListener('input', () => {
                if (this._focused) {
                    fontDropDown.search = this.inputNode.value.toLowerCase()
                }
            })

            this.inputNode.addEventListener(
                'contextmenu',
                () => {
                    exports.contextMenu.showInput([
                        {
                            role: 'cut'
                        },
                        {
                            role: 'copy'
                        },
                        {
                            role: 'paste'
                        },
                        {
                            role: 'selectall'
                        }
                    ])
                },
                true
            )

            //TODO: Listen to context menu events

            body.onEvent('mousedown', event => {
                if (
                    !(
                        this.node === event.target ||
                        fontDropDown.node === event.target ||
                        this.node.contains(event.target) ||
                        fontDropDown.node.contains(event.target)
                    )
                ) {
                    this.blur()
                }
            })

            body.onEvent('blur', this.blur.bind(this))

            body.onEvent('resize', this.moveDropDown)
            body.onEvent('scroll', this.moveDropDown)

            fonts.onEvent('update', event => {
                if (this._tempValue && !this._value) {
                    this.value = this._tempValue
                }
            })

            fonts.preload()
        }

        get disabled() {
            return this.inputNode.disabled
        }
        set disabled(disabled) {
            if (typeof disabled === 'boolean') {
                this.inputNode.disabled = disabled
            }
        }

        get value() {
            return this._value
        }
        set value(value) {
            if (typeof value !== 'string') {
                return false
            }

            if (value[0] === '"' && value[value.length - 1] === '"') {
                value = value.slice(1, value.length - 1)
            }

            let index = fonts.allLower.indexOf(value.toLowerCase().trim())

            if (index !== -1) {
                this._value = fonts.all[index]

                this.inputNode.value = this._value

                sendEventTo(
                    {
                        value: this._value,
                        oldValue: this._oldValue,

                        fromUser: false,
                        from: this
                    },
                    this.events.change
                )

                if (this._focused) {
                    this.blur()
                }

                this._oldValue = this._value
            } else {
                this._tempValue = value
            }
        }

        onDropDownHover(event) {
            event.from = this

            sendEventTo(event, this.events.hover)

            this._oldValue = event._value
        }
        onDropDownClick(event) {
            this.inputNode.value = event.value
            this._value = event.value

            sendEventTo(
                {
                    value: this.value,
                    oldValue: this._oldValue,

                    fromUser: event.fromUser,
                    from: this
                },
                this.events.change
            )

            this._oldValue = event.value

            this.blur()
        }

        showDropDown() {
            let bounds = this.inputNode.getBoundingClientRect()

            fontDropDown.show({
                top: bounds.y,
                bottom: bounds.y + bounds.height,

                left: bounds.x,

                width: bounds.width
            })
        }
        moveDropDown() {
            if (!this._focused) {
                return false
            }
            let bounds = this.inputNode.getBoundingClientRect()

            fontDropDown.move({
                top: bounds.y,
                bottom: bounds.y + bounds.height,

                left: bounds.x,

                width: bounds.width
            })
        }

        openDropDown() {
            body.onFrame.start(this.showDropDown)

            fontDropDown.hoverCallback = this.onDropDownHover
            fontDropDown.clickCallback = this.onDropDownClick

            this.inputNode.classList.add('active')
        }

        focus(fromUser = false) {
            this._codeFocused = !fromUser

            this.inputNode.focus()
        }
        blur() {
            if (!this._focused) {
                return false
            }

            this._focused = false

            this.inputNode.blur()
            this.inputNode.classList.remove('active')

            this.inputNode.style.zIndex = ''
            this.inputNode.value = this._value

            if (this._oldValue !== this._value) {
                sendEventTo(
                    {
                        value: this._value,
                        oldValue: this._oldValue,

                        fromUser: true,
                        from: this
                    },
                    this.events.change
                )
            }

            this._oldValue = this._value

            fontDropDown.hide()
        }
    }
    exports.FontInput = items.FontInput = FontInput

    class KeyInput extends focusItem {
        /*
        A input for choosing keyboard shortcuts. Displayed as button, when pressed opens popup for user to input shortcut.

        Constructor data:
            disabled (boolean)
            value (string)
            focus (boolean)
        
        Properties:
            disabled (get/set) (boolean)
            value (get/set) (string)
            modifiers (get/set) (boolean)

        */
        constructor(data = {}, styles = {}) {
            //TODO: label
            super(document.createElement('button'), styles, data.focus)
            this.addClass('input-key')

            {
                this.overlayNode = document.createElement('div')
                this.overlayNode.className = 'key-overlay'
                this.overlayNode.style.display = 'none'
                body.node.appendChild(this.overlayNode)

                this.popupNode = document.createElement('div')
                this.popupNode.className = 'popup'
                this.overlayNode.appendChild(this.popupNode)

                this.popupNode.appendChild(document.createElement('p'))
                this.popupNode.firstChild.textContent = data.text

                this.keyTextNode = document.createElement('span')
                this.keyTextNode.className = 'key'
                this.keyTextNode.textContent = ' '
                this.popupNode.appendChild(this.keyTextNode)

                this.node.id = getUniqueId('key')

                this.textNode = document.createElement('span')
                this.textNode.innerText = ' '
                this.node.appendChild(this.textNode)
            }

            if (data.disabled === true) {
                this.node.disabled = true
            }

            this.value = data.value

            this._oldValue = this.shortcut

            this.node.addEventListener('click', () => {
                this.node.blur()

                this.focus(true)
            })

            keyboard.onEvent('shortcut-change', event => {
                if (!this._focused) {
                    return false
                }

                this.keyTextNode.textContent =
                    keyboard.getDisplay(event.shortcut) || ' '
            })
            keyboard.onEvent('shortcut-finish', event => {
                if (!this._focused) {
                    return false
                }

                sendEventTo(
                    {
                        value: event.shortcut,
                        oldValue: this._oldValue,

                        fromUser: true,
                        from: this
                    },
                    this.events.change
                )

                this._oldValue = event.shortcut

                this.textNode.textContent = keyboard.getDisplay(this.shortcut)
            })

            body.onEvent('blur', this.blur.bind(this))
            this.overlayNode.addEventListener('click', event => {
                if (event.target === this.overlayNode) {
                    this.blur()
                }
            })
        }

        get disabled() {
            return this.node.disabled
        }
        set disabled(disabled) {
            if (typeof disabled === 'boolean') {
                this.node.disabled = disabled
            }
        }

        get value() {
            return this._oldValue
        }
        set value(shortcut) {
            if (typeof shortcut === 'string' && shortcut) {
                shortcut = keyboard.cleanShortcut(shortcut)

                sendEventTo(
                    {
                        value: shortcut,
                        oldValue: this._oldValue,

                        fromUser: false,
                        from: this
                    },
                    this.events.change
                )
                this._oldValue = shortcut

                this.textNode.textContent = keyboard.getDisplay(shortcut)

                return shortcut
            }
        }

        focus(fromUser = false) {
            this._focused = true

            if (this._globalFocus) {
                body.inputFocused(this, fromUser)
            }

            sendEventTo(
                {
                    fromUser: fromUser,
                    from: this
                },
                this.events.focus
            )

            this.keyTextNode.textContent = ' '

            this.node.classList.add('active')
            this.overlayNode.style.display = ''
        }
        blur() {
            this._focused = false

            this.node.classList.remove('active')

            this.overlayNode.style.display = 'none'
        }
    }
    exports.KeyInput = items.KeyInput = KeyInput

    let validEncodings = [
        'hex',
        'utf8',
        'utf-8',
        'ucs2',
        'ucs-2',
        'ascii',
        'latin1',
        'base64',
        'utf16le',
        'utf-16le'
    ]

    class FileInput extends focusItem {
        /*
        Allows user to select files. Button input, which opens file select dialog.

        Constructor data:
            icon (string)
            text (string)
            tooltip (string)
            disabled (boolean)
            defaultPath (string)
            buttonLabel (string)
            filters (array)
            properties (array)
            encoding (string)
        
        Properties:
            disabled (get/set) (boolean)
            text (get/set) (string)
            tooltip (get/set) (string)
        
        Methods:
            open (filename: string, contents)
        
        Events:
            open:
                If 'multiSelections' is in properties, then:
                    files: array
                else:
                    filename: string
                    content: string/something
        */
        constructor(data = {}, styles = {}) {
            super(document.createElement('button'), styles, data.focus)
            this.addClass('input-file')

            this.node.id = getUniqueId('file')

            this.textNode = document.createElement('span')

            this.node.appendChild(this.textNode)

            this.options = {
                save: false,

                multi: false,
                folder: false,

                path: '',
                button: '',

                filters: []
            }

            this.icon = data.icon
            this.text = data.text
            this.tooltip = data.tooltip

            if (data.disabled === true) {
                this.node.disabled = true
            }

            if (typeof data.save === 'boolean') {
                this.options.save = data.save
            } else if (typeof data.open === 'boolean') {
                this.options.save = !data.open
            }
            if (typeof data.multi === 'boolean') {
                this.options.multi = data.multi
            }
            if (typeof data.folder === 'boolean') {
                this.options.folder = data.folder
            }
            if (typeof data.path === 'string') {
                this.options.path = data.path
            }
            if (typeof data.button === 'string') {
                this.options.button = data.button
            }
            if (validEncodings.includes(data.encoding)) {
                this.options.encoding = data.encoding
            }

            if (Array.isArray(data.filters)) {
                for (let i = 0; i < data.filters.length; i++) {
                    if (typeof data.filters[i] === 'object') {
                        if (
                            typeof data.filters[i].name === 'string' &&
                            Array.isArray(data.filters[i].extensions) &&
                            data.filters[i].extensions.every(
                                ext => typeof ext === 'string'
                            )
                        ) {
                            this.options.filters.push({
                                name: data.filters[i].name,
                                extensions: data.filters[i].extensions
                            })
                        }
                    }
                }
            }

            bindFunctions(this, this.onDialogReturn)

            this.node.addEventListener('click', () => {
                this.focus(true)
            })

            this.node.addEventListener('focus', () => {
                this.node.blur(true)
            })
        }

        get disabled() {
            return this.node.disabled
        }
        set disabled(disabled) {
            if (typeof disabled === 'boolean') {
                this.node.disabled = disabled
            }
        }

        get text() {
            return this.textNode.textContent
        }
        set text(text) {
            if (typeof text === 'string') {
                this.textNode.textContent = text
            }
        }

        get tooltip() {
            return this.node.title
        }
        set tooltip(tooltip) {
            if (typeof tooltip === 'string') {
                this.node.title = tooltip
            }
        }

        onDialogReturn(error, value) {
            this.blur()

            if (error || !value) {
                return false
            }

            if (this.options.save) {
                sendEventTo(
                    {
                        filename: value,

                        fromUser: true,
                        from: this
                    },
                    this.events.save
                )
            } else {
                if (this.options.multi) {
                    sendEventTo(
                        {
                            files: value,

                            fromUser: true,
                            from: this
                        },
                        this.events.open
                    )
                } else {
                    fs.readFile(value, 'utf8', (error, content) => {
                        if (error) {
                            logger.error('File open error:', error)
                        } else {
                            sendEventTo(
                                {
                                    filename: value,
                                    content: content,

                                    fromUser: true,
                                    from: this
                                },
                                this.events.open
                            )
                        }
                    })
                }
            }
        }

        focus(fromUser = false) {
            if (this._focused) {
                return false
            }

            this._focused = true

            if (this.options.save) {
                exports.dialog.showSave(
                    {
                        title: this.text,
                        button: this.options.button,

                        path: this.options.path,

                        filters: this.options.filters
                    },
                    this.onDialogReturn
                )
            } else {
                exports.dialog.showOpen(
                    {
                        title: this.text,
                        button: this.options.button,

                        path: this.options.path,

                        multi: this.options.multi,
                        openFolder: this.options.folder,

                        filters: this.options.filters
                    },
                    this.onDialogReturn
                )
            }

            this.addClass('active')

            if (this._globalFocus) {
                body.inputFocused(this, fromUser)
            }
        }
        blur(fromUser = false) {
            this._focused = false

            this.removeClass('active')
        }

        open(filename, contents, fromUser = false) {
            sendEventTo(
                {
                    filename: filename,
                    contents: contents,

                    fromUser: fromUser,
                    from: this
                },
                this.events.open
            )
        }
        save(filename, fromUser = false) {
            sendEventTo(
                {
                    filename: filename,

                    fromUser: fromUser,
                    from: this
                },
                this.events.save
            )
        }
    }
    exports.FileInput = items.FileInput = FileInput

    //Image input dropdown box
    let imagePopup = new InputPopup({
        maxWidth: 600,
        minWidth: 100,
        maxHeight: 500,
        minHeight: 71
    })
    {
        imagePopup.node.classList.add('image')

        let imageMaxWidth = 100
        let boxExtraWidth = 13
        let boxExtraHeight = 79

        let maxRows = 6
        let maxColumns = 4

        let fileNode = document.createElement('button')
        imagePopup.node.appendChild(fileNode)

        let libraryNode = document.createElement('div')
        libraryNode.className = 'library'

        let openImageLibraryNode = document.createElement('span')
        openImageLibraryNode.textContent = 'Edit'
        openImageLibraryNode.className = 'edit-button'

        libraryNode.appendChild(document.createElement('span'))
        libraryNode.lastChild.textContent = 'Library'
        libraryNode.appendChild(openImageLibraryNode)

        let emptyLibraryNode = document.createElement('div')
        emptyLibraryNode.className = 'library empty'
        {
            emptyLibraryNode.appendChild(document.createElement('span'))
            emptyLibraryNode.lastChild.textContent = 'Image library is empty.'

            let openLibraryButton = document.createElement('button')
            openLibraryButton.textContent = 'Open Library'

            emptyLibraryNode.appendChild(openLibraryButton)

            openLibraryButton.addEventListener('click', event => {
                ipcRenderer.send('open-window', 'imageDatabase')
            })
        }

        let scrollNode = document.createElement('div')
        scrollNode.className = 'list-scroll'

        imagePopup.node.appendChild(scrollNode)

        let listNode = document.createElement('div')
        listNode.className = 'list'

        scrollNode.appendChild(listNode)

        let fileDialogOpen = false

        imagePopup.hoverCallback = null
        imagePopup.clickCallback = null

        Object.defineProperty(imagePopup, 'fileDialogOpen', {
            get: () => {
                return fileDialogOpen
            }
        })

        function updateList() {
            listNode.innerHTML = ''

            for (let i = 0; i < Images.files.length; i++) {
                listNode.appendChild(document.createElement('div'))

                listNode.lastChild.appendChild(document.createElement('span'))
                listNode.lastChild.lastChild.textContent = Images.files[
                    i
                ].split('.')[0]

                listNode.lastChild.appendChild(document.createElement('img'))
                listNode.lastChild.lastChild.src = path.join(
                    Images.directory,
                    Images.files[i]
                )

                listNode.lastChild.setAttribute('file', Images.files[i])
            }
        }

        function scrollList() {
            let elem = listNode.querySelector('.active')
            if (elem) {
                let elemScroll = elem.offsetTop - listNode.offsetTop
                if (elemScroll + elem.offsetHeight > scrollNode.offsetHeight) {
                    scrollNode.scrollTo({
                        top:
                            elemScroll +
                            elem.offsetHeight / 2 -
                            scrollNode.offsetHeight / 2,
                        left: 0,
                        behavior: 'smooth'
                    })
                }
            }
        }

        imagePopup.show = function(position, image) {
            imagePopup.move(position)

            fileNode.textContent = 'Select File'
            fileNode.classList.remove('active')

            let currentActive = listNode.querySelector('.active')
            if (currentActive) {
                currentActive.classList.remove('active')
            }
            currentActive = null

            if (image.value) {
                if (image.database) {
                    currentActive = listNode.querySelector(
                        '[file="' + image.value + '"]'
                    )

                    if (currentActive) {
                        currentActive.classList.add('active')
                    }
                } else {
                    fileNode.textContent = path.win32.basename(image.value)
                    fileNode.classList.add('active')
                }
            }

            if (currentActive) {
                scrollNode.scrollTop = 0

                if (imagePopup.node.parentNode !== document.body) {
                    body.onFrame.end(scrollList)
                }
            }

            document.body.appendChild(imagePopup.node)
        }
        imagePopup.move = function(position) {
            imagePopup.box.minWidth = position.width

            if (Images.files.length === 0) {
                imagePopup.box.maxWidth = 255
                imagePopup.box.maxHeight = imagePopup.box.minHeight
            } else {
                imagePopup.box.maxWidth =
                    boxExtraWidth +
                    imageMaxWidth * Math.min(maxRows, Images.files.length)

                imagePopup.box.maxHeight =
                    boxExtraHeight +
                    imageMaxWidth *
                        Math.min(
                            maxColumns,
                            Math.max(1, Images.files.length / maxRows)
                        )
            }

            imagePopup._move(position)
        }

        fileNode.addEventListener('click', () => {
            if (fileDialogOpen) {
                return false
            }

            fileNode.classList.add('active')
            fileNode.blur()

            fileDialogOpen = true

            exports.dialog.showOpen(
                {
                    title: 'Select Image',
                    buttonLabel: 'Select',
                    filters: [
                        {
                            name: 'Images',
                            extensions: Images.extensions.map(ext =>
                                ext.slice(1)
                            )
                        }
                    ]
                },
                (error, imagePath) => {
                    if (error) {
                        logger.error(
                            "Couldn't open image selection dialog",
                            error
                        )
                        return false
                    }
                    fileDialogOpen = false

                    fileNode.classList.remove('active')

                    if (
                        typeof imagePath !== 'string' ||
                        !path.isAbsolute(imagePath)
                    ) {
                        return false
                    }

                    if (typeof imagePopup.clickCallback === 'function') {
                        imagePopup.clickCallback({
                            value: imagePath,
                            database: false,

                            fromUser: true,
                            from: imagePopup
                        })
                    }
                }
            )
        })

        listNode.addEventListener('click', event => {
            if (event.target === listNode) {
                return false
            }

            if (typeof imagePopup.clickCallback !== 'function') {
                return false
            }

            let img = event.target.getAttribute('file')

            if (event.target.tagName !== 'DIV') {
                img = event.target.parentNode.getAttribute('file')
            }

            imagePopup.clickCallback({
                value: img,
                database: true,

                fromUser: true,
                from: imagePopup
            })
        })

        openImageLibraryNode.addEventListener('click', event => {
            ipcRenderer.send('open-window', 'imageDatabase')
        })

        Images.onEvent('update', () => {
            if (Images.files.length === 0) {
                if (libraryNode.parentNode === imagePopup.node) {
                    imagePopup.node.removeChild(libraryNode)
                }
                if (scrollNode.parentNode === imagePopup.node) {
                    imagePopup.node.removeChild(scrollNode)
                }

                imagePopup.node.appendChild(emptyLibraryNode)
            } else {
                if (emptyLibraryNode.parentNode === imagePopup.node) {
                    imagePopup.node.removeChild(emptyLibraryNode)
                }

                imagePopup.node.appendChild(libraryNode)
                imagePopup.node.appendChild(scrollNode)

                updateList()
            }
        })
    }
    class ImageInput extends focusItem {
        /*
        Image select input. Allows user to choose image from database, or from filesystem.

        Constructor data:
            label (string)
            disabled (boolean)
            value (string)
            focus (boolean)
        
        Properties:
            disabled (get/set) (boolean)
            value (get/set) (string)
            database (get) (boolean): Whether or not the selected image is from the database.
        
        Methods:
            focus
            blur
        
        Events:
            change (value: string, oldValue: string, database: boolean)

        */
        constructor(data = {}, styles = {}) {
            super(document.createElement('div'), {}, data.focus)
            this.addClass('input-image')

            this.buttonNode = document.createElement('button')
            this.buttonNode.id = getUniqueId(this.buttonNode.tagName)

            this.buttonNode.textContent = 'Select Image'

            if (typeof data.label === 'string') {
                this.node.appendChild(document.createElement('label'))
                this.node.firstChild.textContent = data.label

                this.node.firstChild.setAttribute('for', this.buttonNode.id)
            }

            this.node.appendChild(this.buttonNode)

            bindFunctions(
                this,
                this.showDropDown,
                this.moveDropDown,
                this.onDropDownHover,
                this.onDropDownClick
            )

            addStyles(this, styles)

            this.disabled = data.disabled

            this._value = ''
            this._oldValue = ''
            this._database = false

            this.value = data.value

            this.buttonNode.addEventListener('click', () => {
                this.openDropDown()

                this._focused = true
                this.buttonNode.blur()

                if (this._globalFocus) {
                    body.inputFocused(this, !this._codeFocused)
                }

                sendEventTo(
                    {
                        fromUser: !this._codeFocused,
                        from: this
                    },
                    this.events.focus
                )

                this._codeFocused = false
            })

            //TODO: make hovering over image in list emit event.
            body.onEvent('mousedown', event => {
                if (
                    event.target === this.node ||
                    this.node.contains(event.target) ||
                    event.target === imagePopup.node ||
                    imagePopup.node.contains(event.target) ||
                    event.target === document.body
                ) {
                    return false
                }

                this.blur()
            })

            body.onEvent('blur', () => {
                //If the user clicks the "Select File" button on the image drop down, the open file dialog will be shown
                //Because this is a seperate window, it is focused, and the window that the image input item is in gets blurred.
                if (imagePopup.fileDialogOpen) {
                    return false
                }

                this.blur()
            })

            body.onEvent('scroll', this.moveDropDown)
            body.onEvent('resize', this.moveDropDown)
        }

        get disabled() {
            return this.buttonNode.disabled
        }
        set disabled(disabled) {
            if (typeof disabled === 'boolean') {
                this.buttonNode.disabled = disabled
            }
        }

        get value() {
            if (this._database) {
                return path.join(Images.directory, this._value)
            }

            return this._value
        }
        set value(value) {
            if (typeof value !== 'string') {
                return false
            }

            if (path.dirname(value) === Images.directory) {
                value = path.win32.basename(value)
            }

            if (path.isAbsolute(value)) {
                this._value = value
                this._database = false
            } else {
                this._value = value
                this._database = true
            }

            if (this._value.trim() === '' || !fs.existsSync(this.value)) {
                this._value = ''
                this._database = false

                this.buttonNode.textContent = 'Select Image'
            } else {
                this.buttonNode.textContent = path.win32.basename(this._value)
            }

            sendEventTo(
                {
                    vaue: this.value,
                    database: this._database,

                    fromUser: false,
                    from: this
                },
                this.events.change
            )

            this._oldValue = this._value
        }

        get database() {
            return this._database
        }

        onDropDownHover(event) {
            sendEventTo(
                {
                    value: event._database
                        ? path.join(Images.directory, event.value)
                        : event.value,
                    database: event._database,

                    fromUser: event.fromUser,
                    from: this
                },
                this.events.hover
            )

            this._oldValue = event._value
        }
        onDropDownClick(event) {
            this._value = event.value
            this._database = event.database

            this.buttonNode.textContent = path.win32.basename(this._value)

            sendEventTo(
                {
                    value: this.value,
                    database: this._database,

                    fromUser: event.fromUser,
                    from: this
                },
                this.events.change
            )

            this._oldValue = this._value

            this.blur()
        }

        showDropDown() {
            imagePopup.show(this.buttonNode.getBoundingClientRect(), {
                value: this._value,
                database: this._database
            })
        }
        moveDropDown() {
            if (!this._focused) {
                return false
            }

            imagePopup.move(this.buttonNode.getBoundingClientRect())
        }

        openDropDown() {
            body.onFrame.start(this.showDropDown)

            imagePopup.hoverCallback = this.onDropDownHover
            imagePopup.clickCallback = this.onDropDownClick

            this.buttonNode.classList.add('active')
            this.buttonNode.style.zIndex = '11'
        }

        focus(fromUser = false) {
            this._codeFocused = !fromUser

            this.buttonNode.click()
        }
        blur() {
            if (!this._focused) {
                return false
            }

            this._focused = false

            this.buttonNode.classList.remove('active')
            this.buttonNode.style.zIndex = ''

            if (this._value) {
                this.buttonNode.textContent = path.win32.basename(this._value)
            } else {
                this.buttonNode.textContent = 'Select Image'
            }

            if (this._oldValue !== this._value) {
                sendEventTo(
                    {
                        value: this.value,
                        database: this._database,

                        fromUser: true,
                        from: this
                    },
                    this.events.change
                )
            }

            this._oldValue = this._value

            imagePopup.hide()
        }
    }
    exports.ImageInput = items.ImageInput = ImageInput

    let basicTextCommands = [
        'bold',
        'italic',
        'underline',
        'strikethrough',
        'subscript',
        'superscript'
    ]

    let richTextIframeStyles = `
    html {
        overflow: hidden;
    }
    ::-webkit-scrollbar {
        width: 1ch;
        height: 1ch;

        background: hsl(0, 0%, 80%);
    }
    ::-webkit-scrollbar-button {
        display: none;
    }
    ::-webkit-scrollbar-track,
    ::-webkit-scrollbar-corner,
    ::-webkit-scrollbar-track-piece {
        display: none;
        background: transparent;
    }
    ::-webkit-scrollbar-thumb {
        background: hsl(0, 0%, 50%);
    }
    ::-webkit-scrollbar-thumb:active {
        background: hsl(0, 0%, 20%);
    }
    body {
        margin: 0;
        overflow: overlay;
    }
    .container {
        width: 100%;
        height: 100%;
        display: flex;
        cursor: text;
    }
    .alignContainer {
        width: 100%;
        max-height: 100%;
        display: block;
    }
    .textContainer {
        width: 100%;
        display: inline-block;
        outline: none;
        
        line-height: 1.5;
                
        white-space: pre-wrap;

        overflow: hidden;
        overflow-wrap: break-word;
        word-break: normal;

        hyphens: auto;
    }
    `
    let richTextYMap = {
        top: 'flex-start',
        center: 'center',
        bottom: 'flex-end'
    }

    let richTextCommands = [
        'bold',
        'italic',
        'underline',
        'strikethrough',
        'subscript',
        'superscript'
    ]

    //TODO: this code is a bit of a mess, needs to be reviewed
    class RichTextInput extends focusItem {
        /*
        Text input box which allows text styling, such as bold, italic, etc. Also has text align properties, and scale.

        Constructor data:
            text (string): Rich-text format text.
            plainText (string): Plain-text format, used if text isn't given.
            font (string)
            size (number)
            color (string: COLOR)
            lineHeight (number)
            align (string)
        
        Properties:
            scale (get/set) (number)

            text (get/set) (string)
            plainText (get/set) (string)

            font (get/set) (string)
            size (get/set) (number)
            color (get/set) (string)
            lineHeight (get/set) (number)
            align (get/set) (string)
            
            //TODO: move to editTextBox item
            y (get/set) (string)
        
        Methods:
            edit
            set
            textEdit
            connect
            focus
            blur
        
        Events:
            change (text: string)
            select-change (bold: boolean, italic: boolean, underline: boolean, strikethrough: boolean, superscript: boolean, subscript: boolean)
            focus
            blur
        */
        constructor(data = {}, styles = {}) {
            super(document.createElement('div'), styles, data.focus)
            this.addClass('input-richText')

            this.iframe = document.createElement('iframe')
            this.node.appendChild(this.iframe)

            /*
            If the mouse goes over the iframe, the iframe will mess up mouse events for the rest of the page.
            To stop this, set pointer events to none.

            Then, when a mouseenter event happens:
                If the mouse is down, keep pointer-events: none
                Otherwise, remove it (allowing iframe to get proper mouse events)
            If a mouseup event happens inside the node, always remove pointerEvents: none
            
            This means the user can hover over the iframe as usual, but if the click and drag outside, dragging into the iframe will work smoothly
            */
            this.iframe.style.pointerEvents = 'none'

            this.node.addEventListener('mouseenter', event => {
                if (event.buttons === 0) {
                    this.iframe.style.pointerEvents = ''
                }
            })

            this.node.addEventListener('mouseup', () => {
                this.iframe.style.pointerEvents = ''
            })
            this.node.addEventListener('mouseleave', () => {
                this.iframe.style.pointerEvents = 'none'
            })

            this._scale = 1

            this.textInfo = {
                font: 'sans-serif',
                size: 1,
                color: 'grey',
                lineHeight: 1.5,
                align: 'left',
                y: 'top',

                text: '',
                plainText: ''
            }

            if (typeof data.font === 'string') {
                this.textInfo.font = data.font
            }
            if (
                typeof data.size === 'number' &&
                isFinite(data.size) &&
                data.size >= 0
            ) {
                this.textInfo.size = data.size
            }
            if (
                typeof data.lineHeight === 'number' &&
                isFinite(data.lineHeight) &&
                data.lineHeight > 0
            ) {
                this.textInfo.lineHeight = data.lineHeight
            }
            if (color.isColor(data.color)) {
                this.textInfo.color = data.color
            }
            if (
                data.align === 'left' ||
                data.align === 'center' ||
                data.align === 'right'
            ) {
                this.textInfo.align = data.align
            }
            if (
                data.y === 'top' ||
                data.y === 'center' ||
                data.y === 'bottom'
            ) {
                this.textInfo.y = data.y
            }

            if (typeof data.text === 'string') {
                this.textInfo.text = richText.clean(data.text)
                this.textInfo.plainText = richText.removeFormat(data.text)
            }

            this.iframe.onload = this._onIframeLoad.bind(this)

            this.disabled = data.disabled

            this.node.addEventListener('click', () => {
                if (this.textNode) {
                    this._codeFocused = false
                    //this.textNode.focus()
                }
            })
        }

        _onTextNodeChange(fromUser = true) {
            this.textInfo.text = richText.fromNode(this.textNode)
            this.textInfo.plainText = this.textNode.textContent

            sendEventTo(
                {
                    text: this.textInfo.text,
                    plainText: this.textInfo.plainText,

                    fromUser: fromUser,
                    from: this
                },
                this.events.change
            )
        }

        _onIframeLoad() {
            this.textDocument = this.iframe.contentDocument
            this.textWindow = this.iframe.contentWindow

            this.textWindow.onunload = this._onIframeUnload

            {
                let style = this.textDocument.createElement('style')
                style.type = 'text/css'
                style.appendChild(
                    this.textDocument.createTextNode(richTextIframeStyles)
                )

                this.textDocument.head.appendChild(style)

                let fontLink = this.textDocument.createElement('link')
                fontLink.href = '../fonts/fonts.css'
                fontLink.rel = 'stylesheet'

                let originalFontLink = document.head.getElementsByTagName(
                    'link'
                )[0]

                if (
                    originalFontLink &&
                    originalFontLink.href.includes('fonts.css')
                ) {
                    fontLink.href = originalFontLink.href
                }

                this.textDocument.head.appendChild(fontLink)
            }

            this.container = this.textDocument.createElement('div')
            this.container.className = 'container'
            this.container.style.fontSize = this._scale + 'px'
            this.textDocument.body.appendChild(this.container)

            this.container.appendChild(this.textDocument.createElement('div'))
            this.container.lastChild.className = 'alignContainer'

            this.textNode = this.textDocument.createElement('div')
            this.textNode.className = 'textContainer'
            this.textNode.contentEditable = true

            this.textNode.style.fontFamily = this.textInfo.font
            this.textNode.style.fontSize = this.textInfo.size.toString() + 'em'
            this.textNode.style.lineHeight = this.textInfo.lineHeight.toString()
            this.textNode.style.color = this.textInfo.color
            this.textNode.style.textAlign = this.textInfo.align
            this.container.style.alignItems = richTextYMap[this.textInfo.y]

            if (this.textInfo.text) {
                this.textNode.innerHTML = this.textInfo.text
            }

            this.container.lastChild.appendChild(this.textNode)

            this.textNode.addEventListener(
                'input',
                this._onTextNodeChange.bind(this)
            )

            this.textNode.addEventListener('paste', event => {
                let text = event.clipboardData.getData('text/plain')
                event.preventDefault()

                this.textDocument.execCommand('insertHTML', false, text)

                //TODO: this seems weird?
                this.textNode.innerHTML = richText
                    .fromNode(this.textNode)
                    .trim()

                //TODO: is this needed?
                this._onTextNodeChange()
            })

            this.textDocument.addEventListener('selectionchange', () => {
                let event = {
                    fromUser: true,
                    from: this
                }

                for (let i = 0; i < richTextCommands.length; i++) {
                    event[richTextCommands[i]] = {
                        state: this.textDocument.queryCommandState(
                            richTextCommands[i]
                        ),
                        indeterm: this.textDocument.queryCommandIndeterm(
                            richTextCommands[i]
                        )
                    }
                }

                sendEventTo(event, this.events['select-change'])
            })

            this.textNode.addEventListener('focus', () => {
                if (this._focused) {
                    return false
                }

                this._focused = true

                if (this._globalFocus) {
                    body.inputFocused(this, !this._codeFocused)
                }

                //This should happen on mouseenter, but just in case it didnt
                this.iframe.style.pointerEvents = ''

                sendEventTo(
                    {
                        fromUser: !this._codeFocused,
                        from: this
                    },
                    this.events.focus
                )

                this._codeFocused = false
            })

            //When the container is clicked, .textNode is focused anyway
            //But the blinking text caret will only show if .focus is called
            this.container.addEventListener('click', event => {
                if (event.target !== this.textNode) {
                    if (!this.textNode.focused) {
                        this.textNode.focus()
                    }
                }
            })

            this.textNode.addEventListener('blur', () => {
                this._focused = false

                this.iframe.style.pointerEvents = 'none'

                sendEventTo(
                    {
                        fromUser: true,
                        from: this
                    },
                    this.events.blur
                )
            })

            //stop keys such as tab, etc doing special things:
            this.textDocument.addEventListener('keydown', event => {
                if (event.code === 'Tab') {
                    event.preventDefault()
                }
            })
        }
        _onIframeUnload() {
            this.textDocument = null
            this.textWindow = null

            this.container = null
            this.textNode = null
        }

        get disabled() {
            return this.node.classList.contains('disabled')
        }
        set disabled(disabled) {
            if (disabled === true) {
                this.node.classList.add('disabled')
            } else if (disabled === false) {
                this.node.classList.remove('disabled')
            }
        }

        get scale() {
            return this._scale
        }
        set scale(scale) {
            this._scale = scale

            if (this.container) {
                this.container.style.fontSize = this._scale + 'px'
            }
        }

        get text() {
            return this.textInfo.text
        }
        set text(str) {
            if (!typeof str === 'string') {
                return false
            }

            this.textInfo.text = richText.clean(str)
            this.textInfo.plainText = richText.removeFormat(this.textInfo.text)

            if (this.textNode) {
                this.textNode.innerHTML = this.textInfo.text
            }

            sendEventTo(
                {
                    text: this.textInfo.text,
                    plainText: this.textInfo.plainText,

                    fromUser: false,
                    from: this
                },
                this.events.change
            )
        }
        get plainText() {
            return this.textInfo.plainText
        }
        set plainText(str) {
            if (!typeof str === 'string') {
                return false
            }

            this.textInfo.text = richText.format(str)
            this.textInfo.plainText = str

            if (this.textNode) {
                this.textNode.textContent = this.textInfo.plainText
            }

            sendEventTo(
                {
                    text: this.textInfo.text,
                    plainText: this.textInfo.plainText,

                    fromUser: false,
                    from: this
                },
                this.events.change
            )
        }

        get font() {
            return this.textInfo.font
        }
        set font(font) {
            if (!typeof font === 'string') {
                return false
            }

            this.textInfo.font = font

            if (this.textNode) {
                this.textNode.style.fontFamily = this.textInfo.font
            }

            sendEventTo(
                {
                    font: this.textInfo.font,

                    fromUser: false,
                    from: this
                },
                this.events.change
            )
        }

        get size() {
            return this.textInfo.size
        }
        set size(size) {
            if (typeof size !== 'number' || !isFinite(size) || size < 0) {
                return false
            }

            this.textInfo.size = size

            if (this.textNode) {
                this.textNode.style.fontSize =
                    this.textInfo.size.toString() + 'em'
            }

            sendEventTo(
                {
                    size: this.textInfo.size,

                    fromUser: false,
                    from: this
                },
                this.events.change
            )
        }

        get lineHeight() {
            return this.textInfo.lineHeight
        }
        set lineHeight(lineHeight) {
            if (
                typeof lineHeight !== 'number' ||
                !isFinite(lineHeight) ||
                lineHeight < 0
            ) {
                return false
            }

            this.textInfo.lineHeight = lineHeight

            if (this.textNode) {
                this.textNode.style.lineHeight = this.textInfo.lineHeight.toString()
            }

            sendEventTo(
                {
                    lineHeight: this.textInfo.lineHeight,

                    fromUser: false,
                    from: this
                },
                this.events.change
            )
        }

        get color() {
            return this.textInfo.color
        }
        set color(new_color) {
            if (!color.isColor(new_color)) {
                return false
            }

            this.textInfo.color = new_color

            if (this.textNode) {
                this.textNode.style.color = this.textInfo.color
            }

            sendEventTo(
                {
                    color: this.textInfo.color,

                    fromUser: false,
                    from: this
                },
                this.events.change
            )
        }

        get align() {
            return this.textInfo.align
        }
        set align(align) {
            if (align !== 'left' && align !== 'center' && align !== 'right') {
                return false
            }

            this.textInfo.align = align

            if (this.textNode) {
                this.textNode.style.textAlign = this.textInfo.align
            }

            sendEventTo(
                {
                    align: this.textInfo.align,

                    fromUser: false,
                    from: this
                },
                this.events.change
            )
        }

        get y() {
            return this.textInfo.y
        }
        set y(y) {
            if (y !== 'top' && y !== 'center' && y !== 'bottom') {
                return false
            }
            this.textInfo.y = y

            if (this.container) {
                this.container.style.alignItems = richTextYMap[this.textInfo.y]
            }

            sendEventTo(
                {
                    y: y,

                    fromUser: false,
                    from: this
                },
                this.events.change
            )
        }

        edit(data = {}, fromUser = false) {
            if (
                typeof data !== 'object' ||
                data === null ||
                Array.isArray(data)
            ) {
                return false
            }

            let allChanges = {}

            if (typeof data.text === 'string') {
                this.textInfo.text = richText.clean(data.text)
                this.textInfo.plainText = richText.removeFormat(
                    this.textInfo.text
                )

                if (this.textNode) {
                    this.textNode.innerHTML = this.textInfo.text
                }

                allChanges.text = this.textInfo.text
                allChanges.plainText = this.textInfo.plainText
            } else if (typeof data.plainText === 'string') {
                this.textInfo.text = richText.format(data.plainText)
                this.textInfo.plainText = data.plainText

                if (this.textNode) {
                    this.textNode.textContent = this.textInfo.plainText
                }

                allChanges.text = this.textInfo.text
                allChanges.plainText = this.textInfo.plainText
            }

            if (typeof data.font === 'string') {
                this.textInfo.font = data.font

                if (this.textNode) {
                    this.textNode.style.fontFamily = this.textInfo.font
                }

                allChanges.font = this.textInfo.font
            }

            if (
                typeof data.size === 'number' &&
                isFinite(data.size) &&
                data.size >= 0
            ) {
                this.textInfo.size = data.size

                if (this.textNode) {
                    this.textNode.style.fontSize =
                        this.textInfo.size.toString() + 'em'
                }

                allChanges.size = this.textInfo.size
            }

            if (
                typeof data.lineHeight === 'number' &&
                isFinite(data.lineHeight) &&
                data.lineHeight > 0
            ) {
                this.textInfo.lineHeight = data.lineHeight

                if (this.textNode) {
                    this.textNode.style.lineHeight = this.textInfo.lineHeight.toString()
                }

                allChanges.lineHeight = this.textInfo.lineHeight
            }

            if (color.isColor(data.color)) {
                this.textInfo.color = data.color

                if (this.textNode) {
                    this.textNode.style.color = this.textInfo.color
                }

                allChanges.color = this.textInfo.color
            }

            if (
                data.align === 'left' ||
                data.align === 'center' ||
                data.align === 'right'
            ) {
                this.textInfo.align = data.align

                if (this.textNode) {
                    this.textNode.style.textAlign = this.textInfo.align
                }

                allChanges.align = this.textInfo.align
            }

            if (
                data.y === 'top' ||
                data.y === 'center' ||
                data.y === 'bottom'
            ) {
                this.textInfo.y = data.y

                if (this.container) {
                    this.container.style.alignItems =
                        richTextYMap[this.textInfo.y]
                }

                allChanges.y = this.textInfo.y
            }

            if (Object.keys(allChanges).length > 0) {
                allChanges.fromUser = fromUser
                allChanges.from = this

                sendEventTo(allChanges, this.events.change)
            }
        }
        set(data = {}) {
            this.edit(data)
        }

        textEdit(command, arg, fromUser = false) {
            if (this.textNode) {
                if (basicTextCommands.includes(command)) {
                    this.textDocument.execCommand(command, false, null)

                    this._onTextNodeChange(fromUser)
                } else if (command === 'font') {
                    this.edit({ font: arg }, fromUser)
                } else if (command === 'size') {
                    this.edit({ size: parseFloat(arg) }, fromUser)
                } else if (command === 'line-height') {
                    this.edit({ lineHeight: parseFloat(arg) }, fromUser)
                } else if (command === 'color') {
                    this.edit({ color: arg }, fromUser)
                } else if (command === 'align') {
                    this.edit({ align: arg }, fromUser)
                } else if (command === 'y') {
                    this.edit({ y: arg }, fromUser)
                }
            }
        }

        connect(item) {
            if (item instanceof exports.TextStyleEdit) {
                item.connect(this)
            }
        }

        focus(fromUser = false) {
            if (this._focused) {
                return false
            }

            this._focused = true
            this._codeFocused = !fromUser

            //TODO: all of this is handled in textnode.onfocus

            if (this._globalFocus) {
                body.inputFocused(this, fromUser)
            }

            if (this.textNode) {
                this.textNode.focus()
            }

            sendEventTo(
                {
                    fromUser: fromUser,
                    from: this
                },
                this.events.focus
            )
        }
        blur(fromUser = false) {
            if (!this._focused) {
                return false
            }

            this._focused = false
            if (this.textNode) {
                this.textNode.blur()
            }
        }
    }
    exports.RichTextInput = items.RichTextInput = RichTextInput

    //TODO: Code for textListItem, List, and TableList needs to be reviewed

    //TODO: Make list items show gray when selected and not "active"
    class TextListItem extends Item {
        /*
        Sub item, used inside List item.

        Constructor data:
            text (string)
            editButton (boolean)
            removeButton (boolean)
            select (boolean)
        
        Properties:
            active (set) (boolean)
            text (get/set) (string)
            editButton (set) (boolean)
            removeButton (set) (boolean)
        
        Methods:
            setHighlight (state: string)
            remove
        
        Events:
            change (text: string, oldText: string)
            enter
            remove
            drag
            focus
            blur
        */

        constructor(data = {}) {
            super(document.createElement('div'))
            this.addClass('item')

            this.textNode = document.createElement('input')
            this.textNode.type = 'text'
            this.textNode.disabled = true

            this.editNode = document.createElement('button')
            this.editNode.appendChild(getIconSVG('edit'))

            this.removeNode = document.createElement('button')
            this.removeNode.appendChild(getIconSVG('remove'))

            this.node.appendChild(this.editNode)
            this.node.appendChild(this.textNode)
            this.node.appendChild(this.removeNode)

            this.text = data.text
            this.editButton = data.editButton
            this.removeButton = data.removeButton

            if (data.select === true) {
                this.node.addEventListener('click', event => {
                    //If the user clicks on of the buttons, the item shouldn't be selected
                    if (
                        event.target === this.node ||
                        event.target === this.textNode
                    ) {
                        sendEventTo(
                            {
                                ctrlKey: event.ctrlKey,

                                fromUser: true,
                                from: this
                            },
                            this.events.select
                        )
                    }
                })
            }

            //when the edit button is clicked, make the text editable, and focus it
            //Then, when the user presses 'enter', or the text loses focus, make the text un-editable
            this.editNode.addEventListener('click', () => {
                this.textNode.disabled = false
                this.textNode.focus()
                this.textNode.select()

                sendEventTo(
                    {
                        fromUser: true,
                        from: this
                    },
                    this.events.focus
                )
            })
            this.textNode.addEventListener('keydown', event => {
                if (event.code === 'Enter') {
                    this.textNode.blur()
                }
            })

            let lastChange = this.textNode.value
            this.textNode.addEventListener('input', () => {
                sendEventTo(
                    {
                        text: this.textNode.value,
                        oldText: lastChange,

                        fromUser: true,
                        from: this
                    },
                    this.events.change
                )
                lastChange = this.textNode.value
            })

            let lastEnter = this.textNode.value
            //TODO: stop emitting 'enter' on blur? (it'll break some things)
            this.textNode.addEventListener('blur', () => {
                this.textNode.disabled = true

                sendEventTo(
                    {
                        text: this.textNode.value,
                        oldText: lastEnter,

                        fromUser: true,
                        from: this
                    },
                    this.events.enter
                )
                lastEnter = this.textNode.value
            })

            this.removeNode.addEventListener('click', () => {
                sendEventTo(
                    {
                        fromUser: true,
                        from: this
                    },
                    this.events.remove
                )
            })

            //send a drag event when the user moves the mouse outside the element, after clicking down on it
            let mouseDown = false
            this.node.addEventListener('mousedown', () => {
                //TODO: only listen for left-click
                mouseDown = true
            })
            body.onEvent('mouseup', () => {
                mouseDown = false

                this.node.classList.remove('dragging')
            })
            this.node.addEventListener('mouseleave', () => {
                if (mouseDown) {
                    sendEventTo(
                        {
                            fromUser: true,
                            from: this
                        },
                        this.events.drag
                    )
                    this.node.classList.add('dragging')
                }
            })
        }

        set active(active) {
            if (active === true) {
                this.node.classList.add('active')
            } else if (active === false) {
                this.node.classList.remove('active')
            }
        }

        get text() {
            return this.textNode.value
        }
        set text(text) {
            if (typeof text === 'string') {
                let event = {
                    text: text,
                    oldText: this.textNode.value,

                    fromUser: false,
                    from: this
                }

                this.textNode.value = text

                sendEventTo(event, this.events.change)
            }
        }
        set editButton(edit) {
            if (edit === true) {
                this.editNode.style.display = ''
            } else if (edit === false) {
                this.editNode.style.display = 'none'
            }
        }
        set removeButton(remove) {
            if (remove === true) {
                this.removeNode.style.display = ''
            } else if (remove === false) {
                this.removeNode.style.display = 'none'
            }
        }

        setHighlight(state = '') {
            //TODO: add other states
            if (state === 'error') {
                this.addClass('error')
            } else {
                this.removeClass('error')
            }
        }

        //TODO: add 'change'/'edit' methods, and 'drag' method

        remove() {
            sendEventTo(
                {
                    fromUser: false,
                    from: this
                },
                this.events.remove
            )
        }
    }
    items.TextListItem = TextListItem

    class List extends focusItem {
        /*
        A list of text items, can be edited, reordered, removed, and added.

        Constructor data:
            editButton (boolean): Show a edit button to user to allow changes to individual text items. False by default
            removeButton (boolean): Show a remove button to user to allow individual items to be removed. False by default
            reorderable (boolean): Allow the user to drag items to new positions. False by default
            select (boolean): Allow the user to select an item in the list, highlighting it (and emitting an event). True by default
            multiSelect (boolean): Allow the user to select more than one item (by pressing ctrl). False by default

            items (array): List of strings to be added to list
        
        Properties:
            editButton (get/set) (boolean): Show a edit button to user to allow changes to individual text items. False by default
            removeButton (get/set) (boolean): Show a remove button to user to allow individual items to be removed. False by default
            reorderable (get/set) (boolean): Allow the user to drag items to new positions. False by default

        Methods:
            add (data: {text: string}, index(?): number): Inserts text into list at specified index, or at the end
            remove (text: string || index: number): Removes the specified entry, or the entry at the specified index
            clear: Removes all items from list
            reorder (index: number, newIndex: number): Moves item at index to newIndex
        
        Events:
            'select': When an item is selected:
                index (number): index of most recently selected item
                text (string): the text of the most recently selected item
                list (array): List of all items selected, if multiselect is true
            
            'change': When an item is edited:
                index (number): index of the item which changed
                text (string): The new text of the item
                oldText (string): The previous text of the item
            
            'remove': When an item is removed:
                index (number): the index at which the item was
                text (string): the text the item had
            
            'drag': When an item is dragged:
                index (number): the index of the item
                text (string): the text of the item
            
            'reorder': When an item is dragged to a new position:
                index (number): the original index of the item which was moved
                newIndex (number): the new index of the item which was moved
                text (string):  the text of the item which was moved
        */
        constructor(data = {}, styles = {}) {
            super(document.createElement('div'), styles, data.focus)
            this.addClass('input-list')

            this.listNode = document.createElement('div')
            this.listNode.className = 'list-scroll'
            this.node.appendChild(this.listNode)

            this.listNode.appendChild(getSeparatorNode())

            this.addNode = document.createElement('div')
            this.addNode.className = 'add'

            this.addSelectInput = document.createElement('select')

            this.addSelectIconNode = document.createElement('div')
            this.addSelectIconNode.className = 'icon'
            this.addSelectIconNode.appendChild(getIconSVG('expand-x'))

            this.addTextInput = document.createElement('input')
            this.addTextInput.type = 'text'

            this.addButton = document.createElement('button')
            this.addButton.appendChild(getIconSVG('add'))
            this.addNode.appendChild(this.addButton)

            this.node.append(this.addNode)

            this.options = {
                editButton: false,
                removeButton: false,
                reorderable: false,

                addInput: false,

                select: true,
                multiSelect: false
            }

            //TODO
            //if (data.disabled === true) {this.listNode.disabled = true}

            this.items = []

            this._selected = []

            this.editButton = data.editButton
            this.removeButton = data.removeButton
            this.reorderable = data.reorderable
            this.addInput = data.addInput

            this.disabled = data.disabled

            if (typeof data.select === 'boolean') {
                this.options.select = data.select
            }

            if (typeof data.multiSelect === 'boolean') {
                this.options.multiSelect = data.multiSelect
            }

            if (Array.isArray(data.items)) {
                for (let i = 0; i < data.items.length; i++) {
                    this.add(data.items[i])
                }
            }

            //Add Input
            {
                let oldValue = ''

                this.addSelectInput.addEventListener('input', () => {
                    sendEventTo(
                        {
                            value: this.addSelectInput.value,
                            oldValue: oldValue,

                            fromUser: true,
                            from: this
                        },
                        this.events['add-change']
                    )
                    oldValue = this.addSelectInput.value
                })

                this.addTextInput.addEventListener('input', () => {
                    sendEventTo(
                        {
                            value: this.addTextInput.value,
                            oldValue: oldValue,

                            fromUser: true,
                            from: this
                        },
                        this.events['add-change']
                    )
                    oldValue = this.addTextInput.value
                })

                let onFocus = () => {
                    if (this._focused) {
                        return false
                    }

                    this._focused = true

                    if (this._globalFocus) {
                        body.inputFocused(this, event.fromUser)
                    }

                    sendEventTo(
                        {
                            fromUser: event.fromUser,
                            from: this
                        },
                        this.events.focus
                    )
                }

                this.addSelectInput.addEventListener('focus', onFocus)
                this.addTextInput.addEventListener('focus', onFocus)

                //TODO: Add click & drag adding
                this.addButton.addEventListener('click', () => {
                    onFocus()
                    this.add(oldValue, this.items.length, true)
                })
            }

            this.dragging = null
            this.dropping = false

            let lastIndex = -1

            this.listNode.addEventListener('mousemove', event => {
                //TODO: Replace with something that doesn't do node offset reads
                let mouse = convertMouse(event, this.listNode)

                if (this.dragging !== null || this.dropping) {
                    if (lastIndex >= 0 && lastIndex <= this.items.length) {
                        this.listNode.children[lastIndex * 2].classList.remove(
                            'active'
                        )
                    }

                    lastIndex = this.mouseIndex(mouse)

                    if (lastIndex >= 0 && lastIndex <= this.items.length) {
                        this.listNode.children[lastIndex * 2].classList.add(
                            'active'
                        )
                    }
                }
            })
            this.listNode.addEventListener('mouseleave', () => {
                if (lastIndex >= 0 && lastIndex <= this.items.length) {
                    this.listNode.children[lastIndex * 2].classList.remove(
                        'active'
                    )
                }
                lastIndex = -1
            })
            this.listNode.addEventListener('mouseup', event => {
                //TODO: Replace with something that doesn't do node offset reads
                let mouse = convertMouse(event, this.listNode)

                if (lastIndex >= 0 && lastIndex <= this.items.length) {
                    this.listNode.children[lastIndex * 2].classList.remove(
                        'active'
                    )
                }

                if (this.dragging !== null) {
                    lastIndex = this.mouseIndex(mouse)

                    this.reorder(
                        this.items.indexOf(this.dragging),
                        lastIndex,
                        true
                    )
                } else if (this.dropping) {
                    this.dropping = false

                    lastIndex = this.mouseIndex(mouse)

                    sendEventTo(
                        {
                            index: lastIndex,

                            fromUser: true,
                            from: this
                        },
                        this.events.drop
                    )
                }
            })
            body.onEvent('mouseup', () => {
                this.dragging = null
                this.dropping = false

                if (lastIndex >= 0 && lastIndex <= this.items.length) {
                    this.listNode.children[lastIndex * 2].classList.remove(
                        'active'
                    )
                }
            })

            body.onEvent('mousedown', event => {
                if (!this.listNode.contains(event.target)) {
                    this.blur()
                }
            })

            body.onEvent('blur', this.blur.bind(this))

            body.onEvent('keydown', event => {
                if (this._focused && this._selected.length === 1) {
                    if (event.key === 'ArrowDown') {
                        let index = this.items.indexOf(this._selected[0])

                        if (index < this.items.length) {
                            this.select(index + 1, false, true)
                        }
                    } else if (event.key === 'ArrowUp') {
                        let index = this.items.indexOf(this._selected[0])

                        if (index > 0) {
                            this.select(index - 1, false, true)
                        }
                    }
                }
            })
        }

        get disabled() {
            return this.node.classList.contains('disabled')
        }
        set disabled(disabled) {
            if (disabled === true) {
                this.node.classList.add('disabled')
            } else if (disabled === false) {
                this.node.classList.remove('disabled')
            }

            this.addSelectInput.disabled = this.addTextInput.disabled = disabled
        }

        get editButton() {
            return this.options.editButton
        }
        set editButton(edit) {
            if (typeof edit === 'boolean' && edit !== this.options.editButton) {
                this.options.editButton = edit

                for (let i = 0; i < this.items.length; i++) {
                    this.items[i].editButton = this.options.editButton
                }
            }
        }
        get removeButton() {
            return this.options.removeButton
        }
        set removeButton(remove) {
            if (
                typeof remove === 'boolean' &&
                remove !== this.options.removeButton
            ) {
                this.options.removeButton = remove

                for (let i = 0; i < this.items.length; i++) {
                    this.items[i].removeButton = this.options.removeButton
                }
            }
        }

        get reorderable() {
            return this.options.reorderable
        }
        set reorderable(reorderable) {
            if (typeof reorderable === 'boolean') {
                this.options.reorderable = reorderable
            }
        }

        get addInput() {
            return this.options.addInput
        }
        set addInput(input) {
            if (typeof input === 'boolean' || Array.isArray(input)) {
                this.options.addInput = input

                if (Array.isArray(this.options.addInput)) {
                    this.options.addInput = this.options.addInput.filter(
                        option => typeof option === 'string'
                    )

                    if (this.options.addInput.length === 0) {
                        this.options.addInput = false
                    }
                }
            }

            if (this.options.addInput === false) {
                if (this.addNode.parentNode) {
                    this.node.removeChild(this.addNode)
                }
            } else {
                this.node.appendChild(this.addNode)
            }

            if (Array.isArray(this.addInput)) {
                if (this.addTextInput.parentNode) {
                    this.addNode.removeChild(this.addTextInput)
                }

                this.addNode.insertBefore(
                    this.addSelectIconNode,
                    this.addNode.firstChild
                )

                this.addNode.insertBefore(
                    this.addSelectInput,
                    this.addNode.firstChild
                )

                let lastIndex = this.options.addInput.indexOf(
                    this.addSelectInput.value
                )

                if (lastIndex === -1) {
                    lastIndex = 0
                }

                while (this.addSelectInput.childElementCount > 0) {
                    this.addSelectInput.removeChild(
                        this.addSelectInput.firstChild
                    )
                }

                for (let i = 0; i < this.options.addInput.length; i++) {
                    this.addSelectInput.appendChild(
                        document.createElement('option')
                    )

                    this.addSelectInput.lastChild.textContent = this.options.addInput[
                        i
                    ]
                    this.addSelectInput.lastChild.value = this.options.addInput[
                        i
                    ]
                }

                this.addSelectInput.selectedIndex = lastIndex

                this.addSelectInput.dispatchEvent(new Event('input'))
            } else {
                if (this.addSelectInput.parentNode) {
                    this.addNode.removeChild(this.addSelectInput)
                    this.addNode.removeChild(this.addSelectIconNode)
                }

                this.addNode.insertBefore(
                    this.addTextInput,
                    this.addNode.firstChild
                )

                this.addTextInput.dispatchEvent(new Event('input'))
            }
        }

        get selected() {
            if (this.multiSelect) {
                return this._selected.map(item => item.text)
            } else if (this._selected.length === 1) {
                return this._selected[0].text
            }
            return null
        }
        set selected(selected) {
            this.select(selected)
        }

        get index() {
            if (this._selected.length === 1) {
                return this.items.indexOf(this._selected[0])
            }

            return null
        }

        indexOf(string) {
            for (let i = 0; i < this.items.length; i++) {
                if (this.items[i].text === string) {
                    return i
                }
            }

            return -1
        }

        drop() {
            this.dropping = true
        }

        add(data = {}, index = this.items.length, fromUser = false) {
            if (typeof data === 'string') data = { text: data }

            if (typeof data.text === 'string') {
                let event = {
                    index: index,
                    text: data.text,

                    fromUser: fromUser,
                    from: this
                }

                if (typeof data.editButton !== 'boolean') {
                    data.editButton = this.options.editButton
                }

                if (typeof data.removeButton !== 'boolean') {
                    data.removeButton = this.options.removeButton
                }

                if (typeof data.select !== 'boolean') {
                    data.select = this.options.select
                }

                let item = new TextListItem(data)

                if (index >= 0 && index < this.items.length) {
                    this.listNode.insertBefore(
                        item.node,
                        this.items[index].node
                    )

                    this.items.splice(index, 0, item)

                    this.listNode.insertBefore(
                        getSeparatorNode(),
                        item.node.nextElementSibling
                    )
                } else if (this.addItem) {
                    this.items.push(item)
                    this.listNode.insertBefore(item.node, this.addItem.node)

                    this.listNode.insertBefore(
                        getSeparatorNode(),
                        this.addItem.node
                    )
                } else {
                    this.items.push(item)
                    this.listNode.appendChild(item.node)

                    this.listNode.appendChild(getSeparatorNode())
                }

                sendEventTo(event, this.events.add)

                item.onEvent('focus', event => {
                    if (this._focused) {
                        return false
                    }

                    this._focused = true

                    if (this._globalFocus) {
                        body.inputFocused(this, event.fromUser)
                    }

                    sendEventTo(
                        {
                            fromUser: event.fromUser,
                            from: this
                        },
                        this.events.focus
                    )
                })

                item.onEvent('select', event => {
                    if (!this._focused) {
                        if (this._globalFocus) {
                            body.inputFocused(this, event.fromUser)
                        }

                        if (event.fromUser) {
                            this._focused = true
                        }
                    }

                    this.select(
                        this.items.indexOf(item),
                        event.ctrlKey,
                        event.fromUser
                    )
                })
                item.onEvent('change', event => {
                    event.index = this.items.indexOf(item)
                    sendEventTo(event, this.events.change)
                })
                item.onEvent('enter', event => {
                    event.index = this.items.indexOf(item)
                    sendEventTo(event, this.events.enter)
                })
                item.onEvent('remove', event => {
                    this.remove(this.items.indexOf(item), true)

                    if (this._globalFocus) {
                        body.inputFocused(this, event.fromUser)
                    }
                })
                item.onEvent('drag', event => {
                    if (this.options.reorderable) {
                        this.dragging = item
                    }

                    body.inputFocused(this, event.fromUser)

                    sendEventTo(
                        {
                            index: this.items.indexOf(item),
                            text: item.text,

                            fromUser: event.fromUser,
                            from: this
                        },
                        this.events.drag
                    )
                })
            }
        }

        change(index, newText) {
            if (typeof index === 'string') {
                for (let i = 0; i < this.items.length; i++) {
                    if (this.items[i].text === index) {
                        this.change(i, newText)
                    }
                }
            } else if (
                typeof newText === 'string' &&
                typeof index === 'number'
            ) {
                if (index >= 0 && index < this.items.length) {
                    this.items[index].text = newText
                }
            }
        }

        remove(index, fromUser = false) {
            if (typeof index === 'string') {
                index = this.items.findIndex(item => item.text === index)
            }

            if (index >= 0 && index < this.items.length) {
                let event = {
                    index: index,
                    text: this.items[index].text,

                    fromUser: fromUser,
                    from: this
                }

                this.listNode.removeChild(
                    this.items[index].node.nextElementSibling
                )
                this.listNode.removeChild(this.items[index].node)
                this.items.splice(index, 1)

                sendEventTo(event, this.events.remove)
            }
        }

        clear() {
            while (this.items.length > 0) this.remove(0)
        }

        reorder(index, newIndex, fromUser = false) {
            if (
                index >= 0 &&
                index < this.items.length &&
                newIndex >= 0 &&
                newIndex <= this.items.length &&
                newIndex !== index &&
                this.options.reorderable
            ) {
                let event = {
                    index: newIndex,
                    oldIndex: index,

                    fromUser: fromUser,
                    from: this
                }

                let item = this.items[index]
                let separator = item.node.nextElementSibling

                if (newIndex >= this.items.length) {
                    if (this.addItem) {
                        this.listNode.insertBefore(item.node, this.addItem.node)
                        this.listNode.insertBefore(separator, this.addItem.node)
                    } else {
                        this.listNode.appendChild(item.node)
                        this.listNode.appendChild(separator)
                    }
                } else {
                    //insert the node before the separator preceeding the node currently at the index
                    //then insert the separator before the node
                    this.listNode.insertBefore(
                        item.node,
                        this.items[newIndex].node
                    )
                    this.listNode.insertBefore(
                        separator,
                        item.node.nextElementSibling
                    )
                }

                this.items.splice(newIndex, 0, item)

                if (newIndex <= index) {
                    this.items.splice(index + 1, 1)
                } else {
                    this.items.splice(index, 1)
                }

                sendEventTo(event, this.events.reorder)
            }
        }

        select(indexOrList, add = false, fromUser = false) {
            if (typeof indexOrList === 'string') {
                indexOrList = this.indexOf(indexOrList)

                //when passing a string which isn't in the list, current item shouldn't be de-selected
                if (indexOrList === -1) {
                    indexOrList = -100
                }
            }

            if (Array.isArray(indexOrList) && this.options.multiSelect) {
                if (!add) {
                    for (let i = 0; i < this._selected.length; i++) {
                        this._selected[i].active = false
                    }

                    this._selected = []
                }

                for (let i = 0; i < indexOrList.length; i++) {
                    if (
                        indexOrList[i] >= 0 &&
                        indexOrList < this.items.length
                    ) {
                        this._selected.push(this.items[indexOrList[i]])
                    }
                }

                for (let i = 0; i < this._selected.length; i++) {
                    this._selected[i].active = true
                }

                sendEventTo(
                    {
                        list: this._selected.map(item => {
                            return {
                                index: this.items.indexOf(item),
                                text: item.text
                            }
                        }),

                        fromUser: fromUser,
                        from: this
                    },
                    this.events.select
                )
            } else if (
                typeof indexOrList === 'number' &&
                indexOrList >= 0 &&
                indexOrList < this.items.length
            ) {
                if (this.options.multiSelect && add) {
                    if (!this._selected.includes(this.items[indexOrList])) {
                        this._selected.push(this.items[indexOrList])
                    }
                } else {
                    for (let i = 0; i < this._selected.length; i++) {
                        this._selected[i].active = false
                    }

                    this._selected = [this.items[indexOrList]]
                }

                this.items[indexOrList].active = true

                if (this.options.multiSelect) {
                    sendEventTo(
                        {
                            index: indexOrList,
                            text: this.items[indexOrList].text,

                            list: this._selected.map(item => {
                                return {
                                    index: this.items.indexOf(item),
                                    text: item.text
                                }
                            }),

                            fromUser: fromUser,
                            from: this
                        },
                        this.events.select
                    )
                } else {
                    sendEventTo(
                        {
                            index: indexOrList,
                            text: this._selected[0].text,

                            fromUser: fromUser,
                            from: this
                        },
                        this.events.select
                    )
                }
            } else if (indexOrList === -1) {
                for (let i = 0; i < this._selected.length; i++) {
                    this._selected[i].active = false
                }

                this._selected = []
            }
        }

        setHighlight(indexOrList, state) {
            if (typeof indexOrList === 'number') {
                this.items[indexOrList].setHighlight(state)
            } else if (Array.isArray(indexOrList)) {
                for (let i = 0; i < this.items.length; i++) {
                    this.items[i].setHighlight(indexOrList[i] || '')
                }
            } else if (indexOrList === 'add') {
                if (state === 'error') {
                    this.addNode.classList.add('error')
                } else {
                    this.addNode.classList.remove('error')
                }
            }
        }

        mouseIndex(mouse) {
            if (this.items.length === 0) {
                return 0
            }

            let mouseY = mouse.layerY + this.listNode.scrollTop
            let listTop = this.listNode.offsetTop

            if (
                mouseY <
                this.items[0].node.offsetTop +
                    this.items[0].node.offsetHeight / 2 -
                    listTop
            ) {
                return 0
            }

            for (let i = this.items.length - 1; i >= 0; i--) {
                if (
                    mouseY >=
                    this.items[i].node.offsetTop +
                        this.items[i].node.offsetHeight / 2 -
                        listTop
                ) {
                    return i + 1
                }
            }

            return -1
        }

        asArray() {
            return this.items.map(item => item.text)
        }

        focus(fromUser = false) {
            this._focused = true

            if (this._globalFocus) {
                body.inputFocused(this, fromUser)
            }
        }
        blur(fromUser = false) {
            this._focused = false

            this.dragging = null
            this.dropping = false
        }
    }
    exports.List = items.List = List

    class TableList extends focusItem {
        /*
        A table display item.

        Constructor data:
            disabled (boolean)
            columns (number)
            columnWidths (array: numbers): Width of each column.
            items (array: arrays: strings): Each row, with items for each column
        
        Properties:
            disabled (get/set) (boolean)
        
        Methods:
            clear
            add (data: Array: string, index: number)
            select (index/text)
        
        Events:
            select
            enter
            drag
            focus
            blur
        */
        constructor(data = {}, styles = {}) {
            super(document.createElement('div'), styles, data.focus)
            this.addClass('input-tableList')

            this.tableNode = document.createElement('table')

            this.colgroupNode = document.createElement('colgroup')
            this.tableNode.appendChild(this.colgroupNode)

            this.listNode = document.createElement('tbody')
            this.listNode.className = 'list-scroll'
            this.tableNode.appendChild(this.listNode)

            this.node.appendChild(this.tableNode)

            this.node.tabIndex = -1

            this.listDocumentFragment = document.createDocumentFragment()

            this.options = {
                drag: false,

                columns: 1,
                columnWidths: []
            }

            if (data.disabled === true) {
                this.node.disabled = true
            }

            if (data.drag === true) {
                this.options.drag = true
            }

            this.items = []
            this._index = -1

            bindFunctions(this, this.writeListContent, this.scrollToElem)

            if (
                typeof data.columns === 'number' &&
                isFinite(data.columns) &&
                data.columns > 1
            ) {
                this.options.columns = data.columns
            }

            if (Array.isArray(data.columnWidths)) {
                let min = Math.min(
                    data.columnWidths.length,
                    this.options.columns
                )

                for (let i = 0; i < min; i++) {
                    this.options.columnWidths.push(data.columnWidths[i])

                    this.colgroupNode.appendChild(document.createElement('col'))

                    this.colgroupNode.lastChild.style.width = this.options.columnWidths[
                        i
                    ]
                }
            }

            if (Array.isArray(data.items)) {
                for (let i = 0; i < data.items.length; i++) {
                    this.add(data.items[i])
                }
            }

            let mousedown = false

            this.listNode.addEventListener('mousedown', event => {
                if (event.target.tagName === 'TR') {
                    this.select(
                        Array.prototype.indexOf.call(
                            this.listNode.children,
                            event.target
                        ),
                        true
                    )
                } else if (event.target.tagName === 'TD') {
                    this.select(
                        Array.prototype.indexOf.call(
                            this.listNode.children,
                            event.target.parentNode
                        ),
                        true
                    )
                } else {
                    mousedown = false
                    return false
                }

                mousedown = true

                if (this._focused) {
                    return false
                }

                this._focused = true

                if (this._globalFocus) {
                    body.inputFocused(this, true)
                }

                sendEventTo(
                    {
                        fromUser: true,
                        from: this
                    },
                    this.events.focus
                )
            })

            this.listNode.addEventListener('mouseout', event => {
                if (!mousedown || !this.options.drag) {
                    return false
                }

                let elem

                if (event.target.tagName === 'TR') {
                    elem = event.target
                } else if (event.target.parentNode.tagName === 'TR') {
                    elem = event.target.parentNode
                } else {
                    return false
                }

                mousedown = false

                let index = Array.prototype.indexOf.call(
                    this.listNode.children,
                    elem
                )

                if (
                    this._index >= 0 &&
                    this._index < this.listNode.childElementCount &&
                    this._index !== index
                ) {
                    this.listNode.children[this._index].classList.remove(
                        'select'
                    )

                    this.select(index, true)
                }

                let selected = this.listNode.querySelector('.drag')
                if (selected) {
                    selected.classList.remove('drag')
                }

                elem.classList.add('drag')

                sendEventTo(
                    {
                        text: this.items[index],

                        fromUser: true,
                        from: this
                    },
                    this.events.drag
                )
            })

            this.node.addEventListener('keydown', event => {
                if (this._focused) {
                    if (this.listNode.childElementCount === 0) {
                        return false
                    }

                    if (event.key === 'ArrowUp') {
                        if (this._index === -1) {
                            this.select(
                                this.listNode.childElementCount - 1,
                                true
                            )
                        } else {
                            this.select(Math.max(0, this._index - 1), true)
                        }
                    } else if (event.key === 'ArrowDown') {
                        if (this._index === -1) {
                            this.select(0, true)
                        } else {
                            this.select(
                                Math.min(
                                    this.listNode.childElementCount - 1,
                                    this._index + 1
                                ),
                                true
                            )
                        }
                    } else if (event.key === 'Enter') {
                        if (
                            this._index >= 0 &&
                            this._index < this.listNode.childElementCount
                        ) {
                            sendEventTo(
                                {
                                    text: this.items[this._index],

                                    fromUser: true,
                                    from: this
                                },
                                this.events.enter
                            )
                        }
                    }

                    event.preventDefault()
                }
            })

            body.onEvent('mouseup', () => {
                mousedown = false

                let selected = this.listNode.querySelector('.drag')

                if (selected) {
                    selected.classList.remove('drag')
                }
            })
            body.onEvent('blur', () => {
                mousedown = false

                let selected = this.listNode.querySelector('.drag')

                if (selected) {
                    selected.classList.remove('drag')
                }
            })
        }

        get disabled() {
            return this.node.classList.contains('disabled')
        }
        set disabled(disabled) {
            if (disabled) {
                this.node.classList.add('disabled')
            } else {
                this.node.classList.remove('disabled')
            }
        }

        get selectedIndex() {
            return this._index
        }

        get selected() {
            if (this._index >= 0 && this._index < this.items.length) {
                return this.items[this._index]
            }
            return null
        }

        clear() {
            this.listNode.innerHTML = ''

            while (this.listDocumentFragment.childElementCount > 0) {
                this.listDocumentFragment.removeChild(
                    this.listDocumentFragment.lastChild
                )
            }

            this.items = []
            this._index = -1
        }

        add(data) {
            if (!Array.isArray(data)) {
                return false
            }

            data = data.map(item => '' + item)

            let node = document.createElement('tr')

            for (let i = 0; i < this.options.columns && i < data.length; i++) {
                node.appendChild(document.createElement('td'))
                node.children[i].textContent = data[i]
            }

            this.items.push(data)
            this.listDocumentFragment.appendChild(node)

            body.onFrame.end(this.writeListContent)
        }

        set(list) {
            if (!Array.isArray(list)) {
                return false
            }

            this.clear()

            for (let i = 0; i < list.length; i++) {
                this.add(list[i])
            }
        }

        writeListContent() {
            this.listNode.appendChild(this.listDocumentFragment)
            this.listDocumentFragment.innerHTML = ''
        }

        scrollToElem() {
            if (
                this._scrollIndex >= 0 &&
                this._scrollIndex < this.listNode.childElementCount
            ) {
                this.listNode.children[
                    this._scrollIndex
                ].scrollIntoViewIfNeeded({
                    behavior: 'smooth',
                    block: 'nearest',
                    inline: 'nearest'
                })

                this._scrollIndex = -1
            }
        }

        select(indexOrText, fromUser = false) {
            if (indexOrText === this._index) {
                return false
            }

            this._oldIndex = this._index

            if (
                this._index >= 0 &&
                this._index < this.listNode.childElementCount
            ) {
                this.listNode.children[this._index].classList.remove('select')
                this._index = -1
            }

            if (
                typeof indexOrText === 'number' &&
                indexOrText >= 0 &&
                indexOrText < this.items.length
            ) {
                this._index = indexOrText

                if (this._index < this.listNode.childElementCount) {
                    this.listNode.children[this._index].classList.add('select')
                } else if (
                    this._index - this.listNode.childElementCount <
                    this.listDocumentFragment.childElementCount
                ) {
                    this.listDocumentFragment.children[
                        this._index - this.listNode.childElementCount
                    ].classList.add('select')
                }

                this._scrollIndex = this._index
                body.onFrame.end(this.scrollToElem)

                sendEventTo(
                    {
                        text: this.items[this._index],

                        oldText:
                            this._oldIndex >= 0 &&
                            this._oldIndex < this.items.length
                                ? this.items[this._oldIndex]
                                : [],

                        fromUser: fromUser,
                        from: this
                    },
                    this.events.select
                )
            } else if (Array.isArray(indexOrText)) {
                indexOrText = indexOrText.map(item => '' + item)

                if (
                    this._index >= 0 &&
                    this._index < this.listNode.childElementCount
                ) {
                    this.listNode.children[this._index].classList.remove(
                        'select'
                    )
                }

                this._index = this.items.findIndex(item =>
                    objUtil.same(item, indexOrText)
                )

                if (this._index !== -1) {
                    if (this._index < this.listNode.childElementCount) {
                        this.listNode.children[this._index].classList.add(
                            'select'
                        )
                    } else if (
                        this._index - this.listNode.childElementCount <
                        this.listDocumentFragment.childElementCount
                    ) {
                        this.listDocumentFragment.children[
                            this._index - this.listNode.childElementCount
                        ].classList.add('select')
                    }

                    this._scrollIndex = this._index
                    body.onFrame.end(this.scrollToElem)

                    sendEventTo(
                        {
                            text: this.items[this._index],

                            oldText:
                                this._oldIndex >= 0 &&
                                this._oldIndex < this.items.length
                                    ? this.items[this._oldIndex]
                                    : [],

                            fromUser: fromUser,
                            from: this
                        },
                        this.events.select
                    )
                }
            }
        }
    }
    exports.TableList = items.TableList = TableList
}

//Editor items
{
    loadCSS('editor.css')

    class editorFocusItem extends focusItem {
        constructor(node, styles, focus = true) {
            super(node, styles, focus)
            this.addClass('editor')

            this.inputItems = []

            this.items = this.inputItems

            this._parent = null
        }

        get parent() {
            return this._parent
        }
        set parent(parent) {
            this._parent = parent

            for (let i = 0; i < this.inputItems.length; i++) {
                this.inputItems[i].parent = this
            }
        }

        onResize(toParent) {
            if (!this._parent) {
                return false
            }

            if (toParent) {
                this._parent.onResize(true)

                return
            }

            for (let i = 0; i < this.inputItems.length; i++) {
                this.inputItems[i].onResize()
            }
        }

        checkResize() {
            if (this._parent) {
                this._parent.checkResize()
            } else {
                this.onResize()
            }
        }

        shareFocusWith(item) {
            super.shareFocusWith(item)

            for (let i = 0; i < this.inputItems.length; i++) {
                if (typeof this.inputItems[i].shareFocusWith === 'function') {
                    this.inputItems[i].shareFocusWith(item)
                }
            }
        }

        groupShareFocusWith(item) {
            if (validItem(item) && !this._shareFocusWith.includes(item)) {
                this._shareFocusWith.push(item)

                if (Array.isArray(item._shareFocusWith)) {
                    for (let i = 0; i < item._shareFocusWith.length; i++) {
                        this.groupShareFocusWith(item._shareFocusWith[i])
                    }
                }

                if (typeof item.groupShareFocusWith === 'function') {
                    item.groupShareFocusWith(this)
                }
            }
        }
    }

    class TextStyleEdit extends editorFocusItem {
        /*
        Controls for changing text.

        Constructor data:
            font (boolean): If false, font input will be hidden
            size (boolean): If false, size input will be hidden
            color (boolean): If false, color input will be hidden
            lineHeight (boolean): If false, line-height input will be hidden

            style (boolean): If false, all style (bold, italic, underline, strikethrough, subscript, superscript) inputs will be hidden
            bold, italic, underline, strikethrough, subscript, superscript (boolean): If false, relevant input will be hidden

            align (boolean): If false, align buttons will be hidden.
        
        Properties:
            disabled (set) (boolean)
        
        Methods:
            connect (item: Item): Connects controls to text edit item.
        
        Events:
            N/A
        */
        constructor(data = {}, styles = {}) {
            super(document.createElement('div'), styles)
            this.addClass('textEdit')

            //(Having seperate blocks for each group of options means that when they wrap, they do it in a more sensible manner (all style buttons will go to a new line, instead of 1 at a time))

            //font options
            {
                this.fontBlock = document.createElement('div')
                this.fontBlock.className = 'section font'

                this.fontBlock.appendChild(document.createElement('span'))
                this.fontBlock.firstChild.textContent = 'Font'
                this.fontBlock.firstChild.className = 'title'

                this.font = new exports.FontInput(
                    {
                        focus: false,
                        disabled: true,
                        placeholder: 'font',
                        tooltip: 'font'
                    },
                    {}
                )
                this.inputItems.push(this.font)
                this.size = new exports.NumberInput(
                    {
                        focus: false,
                        disabled: true,
                        placeholder: 'size',
                        tooltip: 'size',
                        unit: 'px',

                        min: 0,
                        max: 999,
                        precision: 1,

                        popupMin: 5,
                        popupMax: 200
                    },
                    {
                        width: '6ch'
                    }
                )
                this.inputItems.push(this.size)

                this.color = new exports.ColorInput(
                    {
                        focus: false,
                        disabled: true,
                        tooltip: 'color'
                    },
                    {}
                )
                this.inputItems.push(this.color)

                if (data.font !== false) {
                    this.fontBlock.appendChild(this.font.node)
                }
                if (data.size !== false) {
                    this.fontBlock.appendChild(this.size.node)
                }
                if (data.color !== false) {
                    this.fontBlock.appendChild(this.color.node)
                }

                if (this.fontBlock.childElementCount > 1) {
                    this.node.appendChild(this.fontBlock)
                }

                this.font.onEvent('change', event => {
                    if (event.fromUser) {
                        this.sendEdit('font', event.value, event.fromUser)
                    }
                })
                this.font.onEvent('hover', event => {
                    if (event.fromUser) {
                        this.sendEdit('font', event.value, event.fromUser)
                    }
                })
                this.size.onEvent('change', event => {
                    if (event.fromUser) {
                        this.sendEdit('size', event.value, event.fromUser)
                    }
                })
                this.color.onEvent('change', event => {
                    if (event.fromUser) {
                        this.sendEdit('color', event.value, event.fromUser)
                    }
                })
            }

            //line-height
            {
                this.lineBlock = document.createElement('div')
                this.lineBlock.className = 'section line'

                this.lineBlock.appendChild(document.createElement('span'))
                this.lineBlock.firstChild.textContent = 'Line Height'
                this.lineBlock.firstChild.className = 'title'

                this.lineHeight = new exports.NumberInput(
                    {
                        focus: false,
                        disabled: true,
                        placeholder: 'line height',
                        tooltip: 'line height',

                        min: 0.1,
                        max: 5,
                        step: 0.1,
                        precision: 2,

                        popupMin: 1,
                        popupMax: 3,

                        unit: '%'
                    },
                    {
                        width: '6ch'
                    }
                )
                this.inputItems.push(this.lineHeight)

                this.lineBlock.appendChild(this.lineHeight.node)

                if (data.lineHeight !== false) {
                    this.node.appendChild(this.lineBlock)
                }

                this.lineHeight.onEvent('change', event => {
                    if (event.fromUser) {
                        this.sendEdit(
                            'line-height',
                            event.value,
                            event.fromUser
                        )
                    }
                })
            }

            //style block
            {
                this.styleBlock = document.createElement('div')
                this.styleBlock.className = 'section style'

                this.styleBlock.appendChild(document.createElement('span'))
                this.styleBlock.firstChild.textContent = 'Style'
                this.styleBlock.firstChild.className = 'title'

                this.bold = new exports.Button(
                    {
                        focus: false,
                        disabled: true,
                        icon: 'text-bold'
                    },
                    {}
                )
                this.inputItems.push(this.bold)
                this.italic = new exports.Button(
                    {
                        focus: false,
                        disabled: true,
                        icon: 'text-italic'
                    },
                    {}
                )
                this.inputItems.push(this.italic)
                this.underline = new exports.Button(
                    {
                        focus: false,
                        disabled: true,
                        icon: 'text-underline'
                    },
                    {}
                )
                this.inputItems.push(this.underline)
                this.strikethrough = new exports.Button(
                    {
                        focus: false,
                        disabled: true,
                        icon: 'text-strikethrough'
                    },
                    {}
                )
                this.inputItems.push(this.strikethrough)
                this.subscript = new exports.Button(
                    {
                        focus: false,
                        disabled: true,
                        icon: 'text-subscript'
                    },
                    {}
                )
                this.inputItems.push(this.subscript)
                this.superscript = new exports.Button(
                    {
                        focus: false,
                        disabled: true,
                        icon: 'text-superscript'
                    },
                    {}
                )
                this.inputItems.push(this.superscript)

                if (data.style !== false) {
                    if (data.bold !== false) {
                        this.styleBlock.appendChild(this.bold.node)
                    }

                    if (data.italic !== false) {
                        this.styleBlock.appendChild(this.italic.node)
                    }

                    if (data.underline !== false) {
                        this.styleBlock.appendChild(this.underline.node)
                    }

                    if (data.strikethrough !== false) {
                        this.styleBlock.appendChild(this.strikethrough.node)
                    }

                    if (data.subscript !== false) {
                        this.styleBlock.appendChild(this.subscript.node)
                    }

                    if (data.superscript !== false) {
                        this.styleBlock.appendChild(this.superscript.node)
                    }
                }

                if (this.styleBlock.childElementCount > 1) {
                    this.node.appendChild(this.styleBlock)
                }

                this.bold.onEvent(
                    'click',
                    this.sendEdit.bind(this, 'bold', true)
                )
                this.italic.onEvent(
                    'click',
                    this.sendEdit.bind(this, 'italic', true)
                )
                this.underline.onEvent(
                    'click',
                    this.sendEdit.bind(this, 'underline', true)
                )
                this.strikethrough.onEvent(
                    'click',
                    this.sendEdit.bind(this, 'strikethrough', true)
                )
                this.subscript.onEvent(
                    'click',
                    this.sendEdit.bind(this, 'subscript', true)
                )
                this.superscript.onEvent(
                    'click',
                    this.sendEdit.bind(this, 'superscript', true)
                )
            }

            //align block
            {
                this.alignBlock = document.createElement('div')
                this.alignBlock.className = 'section align'

                this.alignBlock.appendChild(document.createElement('span'))
                this.alignBlock.firstChild.textContent = 'Align'
                this.alignBlock.firstChild.className = 'title'

                this.alignLeft = new exports.Button(
                    {
                        focus: false,
                        disabled: true,
                        icon: 'text-align-left'
                    },
                    {}
                )
                this.inputItems.push(this.alignLeft)

                this.alignCenter = new exports.Button(
                    {
                        focus: false,
                        disabled: true,
                        icon: 'text-align-center'
                    },
                    {}
                )
                this.inputItems.push(this.alignCenter)
                this.alignRight = new exports.Button(
                    {
                        focus: false,
                        disabled: true,
                        icon: 'text-align-right'
                    },
                    {}
                )
                this.inputItems.push(this.alignRight)

                this.verticalAlign = new exports.SelectInput(
                    {
                        focus: false,
                        disabled: true,
                        options: ['Top', 'Center', 'Bottom']
                    },
                    {}
                )
                this.inputItems.push(this.verticalAlign)

                this.alignBlock.appendChild(this.alignLeft.node)
                this.alignBlock.appendChild(this.alignCenter.node)
                this.alignBlock.appendChild(this.alignRight.node)

                //TODO: make this default to being used, instead of defaulting to not
                if (data.y === true) {
                    this.alignBlock.appendChild(this.verticalAlign.node)
                }

                if (data.align !== false) {
                    this.node.appendChild(this.alignBlock)
                }

                this.alignLeft.onEvent('click', () => {
                    this.alignLeft.active = true
                    this.alignCenter.active = false
                    this.alignRight.active = false

                    this.sendEdit('align', 'left', true)
                })
                this.alignCenter.onEvent('click', () => {
                    this.alignLeft.active = false
                    this.alignCenter.active = true
                    this.alignRight.active = false

                    this.sendEdit('align', 'center', true)
                })
                this.alignRight.onEvent('click', () => {
                    this.alignLeft.active = false
                    this.alignCenter.active = false
                    this.alignRight.active = true

                    this.sendEdit('align', 'right', true)
                })

                this.verticalAlign.onEvent('change', event => {
                    if (event.fromUser) {
                        this.sendEdit(
                            'y',
                            event.value.toLowerCase(),
                            event.fromUser
                        )
                    }
                })
            }

            for (let i = 0; i < this.inputItems.length; i++) {
                passFocusThrough(this.inputItems[i], this, true)
            }

            this.textItems = []
            this.activeItem = null
        }

        set disabled(disabled) {
            if (typeof disabled !== 'boolean') return false

            for (let i = 0; i < this.inputItems.length; i++) {
                this.inputItems[i].disabled = disabled
            }

            if (disabled === true) {
                this.bold.active = false
                this.italic.active = false
                this.underline.active = false
                this.strikethrough.active = false
                this.subscript.active = false
                this.superscript.active = false

                this.alignLeft.active = false
                this.alignCenter.active = false
                this.alignRight.active = false
            }
        }

        connect(item) {
            if (this.textItems.indexOf(item) !== -1) {
                return false
            }

            if (
                !(
                    item instanceof exports.RichTextInput ||
                    item.text instanceof exports.RichTextInput
                )
            ) {
                return false
            }

            this.textItems.push(item)

            this.groupShareFocusWith(item)

            let text = item
            if (item instanceof exports.RichTextInput !== true) text = item.text

            item.onEvent('focus', () => {
                this.font.value = text.font
                this.size.value = text.size
                this.color.value = text.color
                this.lineHeight.value = text.lineHeight

                this.alignLeft.active = false
                this.alignCenter.active = false
                this.alignRight.active = false

                if (text.align === 'left') {
                    this.alignLeft.active = true
                } else if (text.align === 'center') {
                    this.alignCenter.active = true
                } else if (text.align === 'right') {
                    this.alignRight.active = true
                }

                if (item.y === 'top') {
                    this.verticalAlign.value = 'Top'
                } else if (item.y === 'center') {
                    this.verticalAlign.value = 'Center'
                } else if (item.y === 'bottom') {
                    this.verticalAlign.value = 'Bottom'
                }

                this.disabled = false

                this.activeItem = item
            })

            text.onEvent('change', event => {
                if (!event.fromUser) {
                    if (event.font && event.font !== this.font.value) {
                        this.font.value = event.font
                    }
                    if (event.size && event.size !== this.size.value) {
                        this.size.value = event.size
                    }
                    if (event.color && event.color !== this.color.value) {
                        this.color.value = event.color
                    }
                    if (
                        event.lineHeight &&
                        event.lineHeight !== this.lineHeight.value
                    ) {
                        this.lineHeight.value = event.lineHeight
                    }

                    if (event.align === 'left') {
                        this.alignLeft.active = true
                    } else if (event.align === 'center') {
                        this.alignCenter.active = true
                    } else if (event.align === 'right') {
                        this.alignRight.active = true
                    }

                    if (event.y === 'top') {
                        this.verticalAlign.value = 'Top'
                    } else if (event.y === 'center') {
                        this.verticalAlign.value = 'Center'
                    } else if (event.y === 'bottom') {
                        this.verticalAlign.value = 'Bottom'
                    }
                }
            })

            text.onEvent('select-change', format => {
                if (format.bold.state) {
                    this.bold.active = true
                } else {
                    this.bold.active = false
                }

                if (format.italic.state) {
                    this.italic.active = true
                } else {
                    this.italic.active = false
                }

                if (format.underline.state) {
                    this.underline.active = true
                } else {
                    this.underline.active = false
                }

                if (format.strikethrough.state) {
                    this.strikethrough.active = true
                } else {
                    this.strikethrough.active = false
                }

                if (format.subscript.state) {
                    this.subscript.active = true
                } else {
                    this.subscript.active = false
                }

                if (format.superscript.state) {
                    this.superscript.active = true
                } else {
                    this.superscript.active = false
                }
            })
        }

        focus() {
            this.disabled = false
        }
        blur() {
            this.activeItem = null
            this.disabled = true
        }

        sendEdit() {
            if (this.activeItem) {
                this.activeItem.textEdit(...arguments)
            }
        }
    }
    exports.TextStyleEdit = items.TextStyleEdit = TextStyleEdit
    itemStylesMap.TextStyleEdit = {
        margin: (item, value) => {
            value = mapToPx(value)

            item.fontBlock.style.margin = item.lineBlock.style.margin = item.styleBlock.style.margin = item.alignBlock.style.margin =
                '0'

            item.fontBlock.style.marginRight = item.lineBlock.style.marginRight = item.styleBlock.style.marginRight = value

            for (let i = 0; i < item.inputItems.length; i++) {
                item.inputItems[i].node.style.marginTop = value
            }

            item.font.node.style.marginRight = item.size.node.style.marginRight = value

            item.verticalAlign.node.style.marginLeft = value

            return {}
        }
    }

    class ImageStyleEdit extends editorFocusItem {
        /*
        Controls for changing images.

        Constructor data:
            image (boolean): If false, image input will be hidden.
            scale (boolean): If false, scale input will be hidden.
        
        Properties:
            disabled (set) (boolean)
        
        Methods:
            connect (item: Item): Connects controls to the image edit item.
        */
        constructor(data = {}, styles = {}) {
            super(document.createElement('div'), styles)

            //image
            {
                this.imageBlock = document.createElement('div')
                this.imageBlock.className = 'section'

                this.image = new exports.ImageInput({
                    focus: false,
                    disabled: true,
                    label: 'Image'
                })
                this.inputItems.push(this.image)

                if (data.image !== false) {
                    this.imageBlock.appendChild(this.image.node)
                }

                if (this.imageBlock.childElementCount > 0) {
                    this.node.appendChild(this.imageBlock)
                }

                this.image.onEvent('change', event => {
                    if (event.fromUser) {
                        this.sendEdit(
                            {
                                url: event.value,
                                database: event.database
                            },
                            event.fromUser
                        )
                    }
                })
            }

            //scale
            {
                this.scaleBlock = document.createElement('div')
                this.scaleBlock.className = 'section'

                this.scale = new exports.SelectInput({
                    focus: false,
                    disabled: true,
                    label: 'Scale',

                    options: ['Fill', 'Fit', 'Stretch']
                })
                this.inputItems.push(this.scale)

                if (data.scale !== false) {
                    this.scaleBlock.appendChild(this.scale.node)
                }

                if (this.scaleBlock.childElementCount > 0) {
                    this.node.appendChild(this.scaleBlock)
                }

                this.scale.onEvent('change', event => {
                    if (event.fromUser) {
                        this.sendEdit(
                            { scale: event.value.toLowerCase() },
                            event.fromUser
                        )
                    }
                })
            }

            for (let i = 0; i < this.inputItems.length; i++) {
                passFocusThrough(this.inputItems[i], this, true)
            }

            this.activeItem = null
            this.imageItems = []
        }

        set disabled(disabled) {
            if (typeof disabled !== 'boolean') {
                return false
            }

            for (let i = 0; i < this.inputItems.length; i++) {
                this.inputItems[i].disabled = disabled
            }
        }

        connect(item) {
            //This doesn't actually check if it's a valid image item :|
            if (item instanceof BoxEdit) {
                if (this.imageItems.indexOf(item) === -1) {
                    this.imageItems.push(item)

                    this.groupShareFocusWith(item)

                    item.onEvent('focus', () => {
                        if (typeof item.url === 'string') {
                            this.image.value = item.url
                        }

                        if (item.scale === 'fill') {
                            this.scale.value = 'Fill'
                        } else if (item.scale === 'fit') {
                            this.scale.value = 'Fit'
                        } else if (item.scale === 'stretch') {
                            this.scale.value = 'Stretch'
                        }

                        this.disabled = false

                        this.activeItem = item
                    })

                    item.onEvent('blur', () => {
                        if (this.activeItem === item) {
                            this.activeItem = null
                        }

                        this.disabled = true
                    })

                    item.onEvent('change', event => {
                        if (
                            typeof item.url === 'string' &&
                            this.image.value !== item.url
                        ) {
                            this.image.value = item.url
                        }

                        if (event.scale === 'fill') {
                            this.scale.value = 'Fill'
                        } else if (event.scale === 'fit') {
                            this.scale.value = 'Fit'
                        } else if (event.scale === 'stretch') {
                            this.scale.value = 'Stretch'
                        }
                    })
                }
            }
        }

        focus() {
            this.disabled = false
        }
        blur() {
            this.activeItem = null
            this.disabled = true
        }

        sendEdit() {
            if (this.activeItem) {
                this.activeItem.edit(...arguments)
            }
        }
    }
    exports.ImageStyleEdit = items.ImageStyleEdit = ImageStyleEdit
    itemStylesMap.ImageStyleEdit = {
        margin: (item, value) => {
            value = mapToPx(value)

            if (item.node.childElementCount > 1) {
                item.imageBlock.style.marginRight = value
            }

            for (let i = 0; i < item.inputItems.length; i++) {
                item.inputItems[i].node.firstChild.style.marginBottom = value
            }

            return {}
        }
    }

    class BoxStyleEdit extends editorFocusItem {
        /*
        Controls for changing box edit items.

        Constructor data:
            position (boolean): If false, all position inputs (left, right, top, bottom) will be hidden
            left, right, top, bottom (boolean): If false, the relevant input will be hidden.

            align (boolean): If false, x & y align inputs will be hidden.
            x (boolean): If false, x input will be hidden.
            y (boolean): If false, y input will be hidden.
        
        Properties:
            disabled (set) (boolean)
        
        Methods:
            connect (item: Item): Connects controls to box edit item.
        
        Events:
            N/A
        */
        constructor(data = {}, styles = {}) {
            super(document.createElement('div'), styles)

            //position
            {
                this.positionBlock = document.createElement('div')
                this.positionBlock.className = 'section'

                this.left = new exports.NumberInput(
                    {
                        focus: false,
                        disabled: true,
                        label: 'Left',
                        unit: '%',

                        min: 0,
                        max: 100,
                        precision: 2,

                        autoFocusNext: true
                    },
                    {
                        width: '8ch',
                        grow: false
                    }
                )
                this.inputItems.push(this.left)

                this.right = new exports.NumberInput(
                    {
                        focus: false,
                        disabled: true,
                        label: 'Right',
                        unit: '%',

                        min: 0,
                        max: 100,
                        precision: 2,

                        autoFocusNext: true
                    },
                    {
                        width: '8ch',
                        grow: false
                    }
                )
                this.inputItems.push(this.right)

                this.top = new exports.NumberInput(
                    {
                        focus: false,
                        disabled: true,
                        label: 'Top',
                        unit: '%',

                        min: 0,
                        max: 100,
                        precision: 2,

                        autoFocusNext: true
                    },
                    {
                        width: '8ch',
                        grow: false
                    }
                )
                this.inputItems.push(this.top)

                this.bottom = new exports.NumberInput(
                    {
                        focus: false,
                        disabled: true,
                        label: 'Bottom',
                        unit: '%',

                        min: 0,
                        max: 100,

                        precision: 2
                    },
                    {
                        width: '8ch',
                        grow: false
                    }
                )
                this.inputItems.push(this.bottom)

                if (data.left !== false) {
                    this.positionBlock.appendChild(this.left.node)
                }

                if (data.right !== false) {
                    this.positionBlock.appendChild(this.right.node)
                }

                if (data.top !== false) {
                    this.positionBlock.appendChild(this.top.node)
                }

                if (data.bottom !== false) {
                    this.positionBlock.appendChild(this.bottom.node)
                }

                if (
                    data.position !== false &&
                    this.positionBlock.childElementCount > 0
                ) {
                    this.node.appendChild(this.positionBlock)
                }

                this.left.onEvent('change', event => {
                    if (event.fromUser) {
                        let maxValue = Math.min(event.value, this.right.value)

                        if (maxValue !== event.value) {
                            this.left.value = maxValue
                        }

                        this.sendEdit({ left: maxValue }, event.fromUser)
                    }
                })
                this.right.onEvent('change', event => {
                    if (event.fromUser) {
                        let maxValue = Math.max(event.value, this.left.value)

                        if (maxValue !== event.value) {
                            this.right.value = maxValue
                        }

                        this.sendEdit({ right: maxValue }, event.fromUser)
                    }
                })
                this.top.onEvent('change', event => {
                    if (event.fromUser) {
                        let maxValue = Math.min(event.value, this.bottom.value)

                        if (maxValue !== event.value) {
                            this.top.value = maxValue
                        }

                        this.sendEdit({ top: maxValue }, event.fromUser)
                    }
                })
                this.bottom.onEvent('change', event => {
                    if (event.fromUser) {
                        let maxValue = Math.max(event.value, this.top.value)

                        if (maxValue !== event.value) {
                            this.bottom.value = maxValue
                        }

                        this.sendEdit({ bottom: maxValue }, event.fromUser)
                    }
                })
            }

            //align
            {
                this.alignBlock = document.createElement('div')
                this.alignBlock.className = 'section'

                this.y = new exports.SelectInput(
                    {
                        focus: false,
                        disabled: true,
                        label: 'Vertical',
                        options: ['Top', 'Center', 'Bottom']
                    },
                    {}
                )
                this.inputItems.push(this.y)

                this.x = new exports.SelectInput(
                    {
                        focus: false,
                        disabled: true,
                        label: 'Horizontal',
                        options: ['Left', 'Center', 'Right']
                    },
                    {}
                )
                this.inputItems.push(this.x)

                if (data.y !== false) {
                    this.alignBlock.appendChild(this.y.node)
                }

                if (data.x !== false) {
                    this.alignBlock.appendChild(this.x.node)
                }

                if (
                    data.align !== false &&
                    this.alignBlock.childElementCount > 0
                ) {
                    this.node.appendChild(this.alignBlock)
                }

                this.y.onEvent('change', event => {
                    if (event.fromUser) {
                        this.sendEdit(
                            { y: event.value.toLowerCase() },
                            event.fromUser
                        )
                    }
                })
                this.x.onEvent('change', event => {
                    if (event.fromUser) {
                        this.sendEdit(
                            { y: event.value.toLowerCase() },
                            event.fromUser
                        )
                    }
                })
            }

            for (let i = 0; i < this.inputItems.length; i++) {
                passFocusThrough(this.inputItems[i], this, true)
            }

            this.activeItem = null

            this.boxItems = []
        }

        set disabled(disabled) {
            if (typeof disabled !== 'boolean') {
                return false
            }

            for (let i = 0; i < this.inputItems.length; i++) {
                this.inputItems[i].disabled = disabled
            }
        }

        connect(item) {
            if (item instanceof BoxEdit) {
                if (this.boxItems.indexOf(item) === -1) {
                    this.boxItems.push(item)

                    this.groupShareFocusWith(item)

                    item.onEvent('focus', () => {
                        this.top.value = item.top
                        this.left.value = item.left
                        this.right.value = item.right
                        this.bottom.value = item.bottom

                        if (item.y === 'top') {
                            this.y.value = 'Top'
                        } else if (item.y === 'center') {
                            this.y.value = 'Center'
                        } else if (item.y === 'bottom') {
                            this.y.value = 'Bottom'
                        }

                        this.disabled = false

                        this.activeItem = item
                    })
                    item.onEvent('blur', () => {
                        if (this.activeItem === item) {
                            this.activeItem = null
                        }

                        this.disabled = true
                    })

                    item.onEvent('change', event => {
                        if (event.fromUser) {
                            this.top.value = event.top
                            this.left.value = event.left
                            this.right.value = event.right
                            this.bottom.value = event.bottom
                        }
                    })
                }
            } else {
                item.connect(this)
            }
        }

        focus() {
            this.disabled = false
        }
        blur() {
            this.activeItem = null
            this.disabled = true
        }

        sendEdit() {
            if (this.activeItem) {
                this.activeItem.edit(...arguments)
            }
        }
    }
    exports.BoxStyleEdit = items.BoxStyleEdit = BoxStyleEdit
    itemStylesMap.BoxStyleEdit = {
        margin: (item, value) => {
            value = mapToPx(value)

            item.positionBlock.style.marginRight = value

            item.left.node.firstChild.style.marginBottom = item.right.node.firstChild.style.marginBottom = item.top.node.firstChild.style.marginBottom = item.bottom.node.firstChild.style.marginBottom = value

            item.left.node.style.marginRight = item.right.node.style.marginRight = item.top.node.style.marginRight = value

            item.y.node.firstChild.style.marginBottom = value
            item.y.node.style.marginRight = value

            item.x.node.firstChild.style.marginBottom = value
            item.x.node.style.marginRight = value

            return {}
        }
    }

    class BackgroundStyleEdit extends editorFocusItem {
        /*
        Controls for changing backgrounds.

        Constructor data:
            color (boolean): If false, color input will be hidden.
            image (boolean): If false, image input will be hidden.
            scale (boolean): If false, scale input will be hidden.
        
        Properties:
            disabled (set) (boolean)
        
        Methods:
            connect (item: Item): Connects controls to given display edit item.
        
        Events:
            N/A
        */
        constructor(data = {}, styles = {}) {
            super(document.createElement('div'), styles)

            {
                this.mainBlock = document.createElement('div')
                this.mainBlock.className = 'section'

                this.mainBlock.appendChild(document.createElement('span'))
                this.mainBlock.firstChild.textContent = 'Background'
                this.mainBlock.firstChild.className = 'title'

                this.color = new exports.ColorInput(
                    {
                        focus: false,
                        disabled: true,

                        tooltip: 'color'
                    },
                    {}
                )
                this.inputItems.push(this.color)

                this.useImage = new exports.CheckboxInput(
                    {
                        focus: false,
                        disabled: true,

                        tooltip: 'Image'
                    },
                    {}
                )
                this.inputItems.push(this.useImage)

                this.image = new exports.ImageInput(
                    {
                        focus: false,
                        disabled: true,

                        tooltip: 'Image'
                    },
                    {}
                )
                this.inputItems.push(this.image)

                this.scale = new exports.SelectInput(
                    {
                        focus: false,
                        disabled: true,

                        tooltip: 'image',
                        options: ['Fill', 'Fit', 'Stretch']
                    },
                    {}
                )
                this.inputItems.push(this.scale)

                if (data.color !== false) {
                    this.mainBlock.appendChild(this.color.node)
                }

                if (data.image !== false) {
                    this.mainBlock.appendChild(this.useImage.node)
                    this.mainBlock.appendChild(this.image.node)
                }

                if (data.scale !== false) {
                    this.mainBlock.appendChild(this.scale.node)
                }

                if (this.mainBlock.childElementCount > 1) {
                    this.node.appendChild(this.mainBlock)
                }

                this.color.onEvent('change', event => {
                    if (event.fromUser) {
                        this.sendEdit(
                            { background: event.value },
                            event.fromUser
                        )
                    }
                })

                this.useImage.onEvent('change', event => {
                    if (!this.color.disabled) {
                        this.image.disabled = !event.value
                        this.scale.disabled = !event.value
                    }

                    if (event.fromUser) {
                        if (event.value === true) {
                            this.sendEdit(
                                {
                                    backgroundImage: this.image.value
                                },
                                event.fromUser
                            )
                        } else {
                            this.sendEdit(
                                {
                                    backgroundImage: ''
                                },
                                event.fromUser
                            )
                        }
                    }
                })

                this.image.onEvent('change', event => {
                    if (event.fromUser && this.useImage.value) {
                        this.sendEdit(
                            {
                                backgroundImage: event.value
                            },
                            event.fromUser
                        )
                    }
                })

                this.scale.onEvent('change', event => {
                    if (event.fromUser) {
                        this.sendEdit(
                            { backgroundScale: event.value.toLowerCase() },
                            event.fromUser
                        )
                    }
                })
            }

            for (let i = 0; i < this.inputItems.length; i++) {
                passFocusThrough(this.inputItems[i], this, true)
            }

            this.activeItem = null
            this.displayItems = []
        }

        set disabled(disabled) {
            if (typeof disabled !== 'boolean') {
                return false
            }

            for (let i = 0; i < this.inputItems.length; i++) {
                this.inputItems[i].disabled = disabled
            }

            if (!disabled) {
                this.image.disabled = !this.useImage.value
                this.scale.disabled = !this.useImage.value
            }
        }

        connect(item) {
            if (item instanceof exports.DisplayEdit) {
                this.activeItem = item

                this.groupShareFocusWith(item)

                this.color.value = item.background
                this.image.value = item.backgroundImage

                if (item.backgroundScale === 'fill') {
                    this.scale.value = 'Fill'
                } else if (item.backgroundScale === 'fit') {
                    this.scale.value = 'Fit'
                } else if (item.backgroundScale === 'stretch') {
                    this.scale.value = 'Stretch'
                }

                if (item.backgroundImage === '') {
                    this.useImage.value = true
                } else if (item.backgroundImage) {
                    this.useImage.value = false
                }

                this.disabled = false

                item.onEvent('change', event => {
                    if (!event.fromUser) {
                        this.color.value = event.background
                        this.image.value = event.backgroundImage

                        if (event.backgroundScale === 'fill') {
                            this.scale.value = 'Fill'
                        } else if (event.backgroundScale === 'fit') {
                            this.scale.value = 'Fit'
                        } else if (event.backgroundScale === 'stretch') {
                            this.scale.value = 'Stretch'
                        }

                        if (event.backgroundImage === '') {
                            this.useImage.value = false
                        } else if (event.backgroundImage) {
                            this.useImage.value = true
                        }
                    }
                })
            }
        }

        focus() {
            this.disabled = false
        }
        blur() {
            for (let i = 0; i < this.inputItems.length; i++) {
                if (typeof this.inputItems[i].blur === 'function') {
                    this.inputItems[i].blur()
                }
            }
            //this.disabled = true
            //this.activeItem = null
        }

        sendEdit() {
            if (this.activeItem) {
                this.activeItem.edit(...arguments)
            }
        }
    }
    exports.BackgroundStyleEdit = items.BackgroundStyleEdit = BackgroundStyleEdit
    itemStylesMap.BackgroundStyleEdit = {
        margin: (item, value) => {
            value = mapToPx(value)

            for (let i = 0; i < item.inputItems.length; i++) {
                item.inputItems[i].node.style.marginTop = value
            }

            item.color.node.style.marginRight = item.useImage.node.style.marginRight = item.image.node.style.marginRight = value

            return {}
        }
    }

    //should be displayed in seconds, stored in milliseconds
    const playTimeScale = 1000

    class PlayStyleEdit extends editorFocusItem {
        /*
        Controls for changing play options.

        Constructor data:
            time (boolean): If false, time input will be hidden.
            autoPlay (boolean): If false, autoPlay input will be hidden.

            transition (boolean): If false, transition type and time inputs will be hidden.
            type (boolean): If false, transition type input will be hidden.
            transitionTime (boolean): If false, transition time input will be hidden.
        
        Properties:
            disabled (set) (boolean)
        
        Methods:
            set (data: object)
        
        Events
            change (autoPlay: boolean, time: number, transition: {type: string, time: number})
        */
        constructor(data = {}, styles = {}) {
            super(document.createElement('div'), styles)

            //play
            {
                this.playBlock = document.createElement('div')
                this.playBlock.className = 'section'

                this.playBlock.appendChild(document.createElement('span'))
                this.playBlock.firstChild.textContent = 'Play'
                this.playBlock.firstChild.className = 'title'

                this.time = new exports.NumberInput({
                    focus: false,
                    disabled: true,

                    tooltip: 'time',
                    unit: 's',

                    min: 0,
                    max: 60 * 60 * 24,
                    step: 1,

                    precision: 1,

                    popupMin: 0,
                    popupMax: 60 * 2
                })
                this.inputItems.push(this.time)

                this.autoPlay = new exports.CheckboxInput({
                    focus: false,
                    disabled: true,

                    tooltip: 'autoplay',

                    label: 'Autoplay'
                })
                this.inputItems.push(this.autoPlay)

                if (data.time !== false)
                    this.playBlock.appendChild(this.time.node)

                if (data.autoPlay !== false)
                    this.playBlock.appendChild(this.autoPlay.node)

                if (this.playBlock.childElementCount > 1)
                    this.node.appendChild(this.playBlock)

                this.time.onEvent('change', event => {
                    if (event.fromUser) {
                        this.sendEdit({
                            fromUser: event.fromUser,
                            playTime: event.value * playTimeScale
                        })
                    }
                })

                this.autoPlay.onEvent('change', event => {
                    if (event.fromUser) {
                        this.sendEdit({
                            fromUser: event.fromUser,
                            autoPlay: event.value
                        })
                    }
                })
            }

            //transition
            {
                this.transitionBlock = document.createElement('div')
                this.transitionBlock.className = 'section'

                this.transitionBlock.appendChild(document.createElement('span'))
                this.transitionBlock.firstChild.textContent = 'Transition'
                this.transitionBlock.firstChild.className = 'title'

                this.type = new exports.SelectInput(
                    {
                        focus: false,
                        disabled: true,

                        tooltip: 'type',

                        options: ['fade', 'slide', 'zoom']
                    },
                    {}
                )
                this.inputItems.push(this.type)

                this.transitionTime = new exports.NumberInput(
                    {
                        focus: false,
                        disabled: true,

                        tooltip: 'time',
                        step: 0.1,

                        min: 0,
                        max: 60 * 60,
                        unit: 's',
                        precision: 2,

                        popupMax: 10
                    },
                    {}
                )
                this.inputItems.push(this.transitionTime)

                if (data.type !== false) {
                    this.transitionBlock.appendChild(this.type.node)
                }

                if (data.transitionTime !== false) {
                    this.transitionBlock.appendChild(this.transitionTime.node)
                }

                if (
                    this.transitionBlock.childElementCount > 1 &&
                    data.transition !== false
                ) {
                    this.node.appendChild(this.transitionBlock)
                }

                this.type.onEvent('change', event => {
                    if (event.fromUser) {
                        this.sendEdit({
                            fromUser: event.fromUser,
                            transition: { type: event.value }
                        })
                    }
                })
                this.transitionTime.onEvent('change', event => {
                    if (event.fromUser) {
                        this.sendEdit({
                            fromUser: event.fromUser,
                            transition: { time: event.value * playTimeScale }
                        })
                    }
                })
            }

            for (let i = 0; i < this.inputItems.length; i++) {
                passFocusThrough(this.inputItems[i], this, true)
            }

            this.disabled = false

            this.activeItem = null
            this.displayItems = []
        }

        set disabled(disabled) {
            if (typeof disabled !== 'boolean') {
                return false
            }

            for (let i = 0; i < this.inputItems.length; i++) {
                this.inputItems[i].disabled = disabled
            }
        }

        set(data) {
            if (typeof data.playTime === 'number' && isFinite(data.playTime)) {
                this.time.value = data.playTime / playTimeScale
            }

            if (typeof data.autoPlay === 'boolean') {
                this.autoPlay.value = data.autoPlay
            }

            if (typeof data.transition === 'object') {
                data = data.transition
            }

            if (this.type.options.includes(data.type)) {
                this.type.value = data.type
            }

            if (typeof data.time === 'number') {
                this.transitionTime.value = data.time / playTimeScale
            }
        }

        sendEdit(edit) {
            sendEventTo(edit, this.events.change)
        }
    }
    exports.PlayStyleEdit = items.PlayStyleEdit = PlayStyleEdit
    itemStylesMap.PlayStyleEdit = {
        margin: (item, value) => {
            value = mapToPx(value)
            
            item.playBlock.style.margin = item.transitionBlock.style.margin =
                '0'

            for (let i = 0; i < item.inputItems.length; i++) {
                item.inputItems[i].node.style.marginTop = value
            }

            if (item.node.childElementCount > 1) {
                item.playBlock.style.marginRight = value
            } else {
                item.playBlock.style.marginRight = ''
            }

            if (item.playBlock.childElementCount > 2) {
                item.time.node.style.marginRight = item.type.node.style.marginRight = value
            } else {
                item.time.node.style.marginRight = ''
            }

            return {}
        }
    }
}

//Display items

let boxHitSize = 7
let cursorNames = {
    '': '',
    t: 'ns-resize',
    l: 'ew-resize',
    r: 'ew-resize',
    b: 'ns-resize',
    tl: 'nwse-resize',
    tr: 'nesw-resize',
    bl: 'nesw-resize',
    br: 'nwse-resize',

    m: 'move'
}

const positionPrecision = 1
class BoxEdit {
    /*
    Wrapper class for display edit items, handles position/size (does not extend base item class).

    Constructor data:
        focus (boolean)
    
    Properties:
        handleColor (color: CSS color)
        visible (get/set) (boolean)
        focused (get) (boolean)
        top (get/set) (number)
        left (get/set) (number)
        right (get/set) (number)
        bottom (get/set) (number)
    
    Methods:
        focus
        blur
        hide
        show
        edit (data: object)
        getData

    Events:
        change (top: number, left: number, right: number, bottom: number)
        focus
        blur
    */
    constructor(data = {}) {
        this.node = document.createElement('div')
        this.node.className = 'box-edit'

        {
            this.topBar = document.createElement('div')
            this.topBar.className = 'bar top'

            this.rightBar = document.createElement('div')
            this.rightBar.className = 'bar right'

            this.bottomBar = document.createElement('div')
            this.bottomBar.className = 'bar bottom'

            this.leftBar = document.createElement('div')
            this.leftBar.className = 'bar left'

            this.node.appendChild(this.topBar)
            this.node.appendChild(this.rightBar)
            this.node.appendChild(this.bottomBar)
            this.node.appendChild(this.leftBar)
        }

        this._focused = false
        this._shareFocusWith = []

        this._globalFocus = true
        if (data.focus === false) {
            this._globalFocus = false
        }

        this.events = {}

        this.values = {
            top: 10,
            left: 10,
            right: 90,
            bottom: 90
        }

        this.resizing = ''
        this.previewResizing = ''
        this.mouseOffset = { x: 0, y: 0 }

        bindFunctions(this, this.updatePosition)

        this.node.addEventListener('mousedown', () => {
            if (!this.parent) {
                return false
            }
            this.focus()
            this.resizing = this.previewResizing
            this.previewResizing = ''
            body.setCursor(cursorNames[this.resizing])
        })

        body.onEvent('mouseup', () => {
            if (body.cursor === cursorNames[this.resizing]) {
                body.setCursor('')
            }

            this.resizing = ''
        })

        body.onEvent('input-focus', event => {
            if (
                event.item === this ||
                this._shareFocusWith.includes(event.item) ||
                this._shareFocusWith.includes(event.item.parent)
            ) {
                return false
            }

            this.blur()
        })
    }

    onEvent(eventName, listener = () => {}) {
        if (!this.events[eventName]) {
            this.events[eventName] = []
        }

        this.events[eventName].push(listener)
    }

    set handleColor(color) {
        this.node.style.color = color
    }

    get visible() {
        return this.node.style.display !== 'none'
    }
    set visible(visible) {
        if (visible) {
            this.node.style.display = ''
        } else {
            this.node.style.display = 'none'
        }
    }

    get focused() {
        return this.node.classList.contains('focus')
    }

    get top() {
        return this.values.top
    }
    get left() {
        return this.values.left
    }
    get right() {
        return this.values.right
    }
    get bottom() {
        return this.values.bottom
    }

    focus(fromUser = false) {
        if (this._focused) {
            return false
        }

        this.node.classList.add('focus')

        this._focused = true

        if (this._globalFocus === true) {
            body.inputFocused(this, fromUser)
        }

        sendEventTo(
            {
                fromUser: fromUser,
                from: this
            },
            this.events.focus
        )
    }
    blur(fromUser = false) {
        this.node.classList.remove('focus')

        this._focused = false

        sendEventTo(
            {
                fromUser: fromUser,
                from: this
            },
            this.events.blur
        )
    }

    shareFocusWith(item) {
        if (validItem(item) && !this._shareFocusWith.includes(item)) {
            this._shareFocusWith.push(item)
        }
    }

    groupShareFocusWith(item) {
        if (item instanceof BoxEdit) {
            return false
        }
        if (validItem(item) && !this._shareFocusWith.includes(item)) {
            this._shareFocusWith.push(item)

            if (Array.isArray(item._shareFocusWith)) {
                for (let i = 0; i < item._shareFocusWith.length; i++) {
                    this.groupShareFocusWith(item._shareFocusWith[i])
                }
            }

            if (typeof item.groupShareFocusWith === 'function') {
                item.groupShareFocusWith(this)
            }
        }
    }

    hide() {
        this.visible = false
    }
    show() {
        this.visible = true
    }

    updatePosition() {
        this.node.style.top = this.values.top + '%'
        this.node.style.left = this.values.left + '%'
        this.node.style.right = (100 - this.values.right).toString() + '%'
        this.node.style.bottom = (100 - this.values.bottom).toString() + '%'

        //this.node.style.width = (this.values.right - this.values.left) + '%'
        //this.node.style.height = (this.values.bottom - this.values.top) + '%'
    }

    mouseMove(mouse) {
        if (this.resizing === '') {
            if (
                mouse.percX < 0 ||
                mouse.percX > 1 ||
                mouse.percY < 0 ||
                mouse.percY > 1
            ) {
                return false
            }
            this.mouseOffset.x = this.values.left / 100 - mouse.percX
            this.mouseOffset.y = this.values.top / 100 - mouse.percY

            if (body.cursor === cursorNames[this.previewResizing]) {
                this.previewResizing = this.getMouseDirections(mouse)

                if (mouse.ctrlKey && this.previewResizing) {
                    this.previewResizing = 'm'
                }

                body.setCursor(cursorNames[this.previewResizing])
            }

            return false
        }

        if (this.resizing === 'm') {
            let width = this.values.right - this.values.left
            let height = this.values.bottom - this.values.top

            mouse.percX += this.mouseOffset.x
            mouse.percY += this.mouseOffset.y

            mouse.percX = Math.max(0, Math.min(1 - width / 100, mouse.percX))
            mouse.percY = Math.max(0, Math.min(1 - height / 100, mouse.percY))

            this.values.left = round(mouse.percX * 100, positionPrecision)
            this.values.right = round(
                mouse.percX * 100 + width,
                positionPrecision
            )

            this.values.top = round(mouse.percY * 100, positionPrecision)
            this.values.bottom = round(
                mouse.percY * 100 + height,
                positionPrecision
            )
        }

        mouse.percX = Math.max(0, Math.min(1, mouse.percX))
        mouse.percY = Math.max(0, Math.min(1, mouse.percY))

        if (this.resizing.includes('t')) {
            this.values.top = Math.min(
                round(mouse.percY * 100, positionPrecision),
                this.values.bottom
            )
        } else if (this.resizing.includes('b')) {
            this.values.bottom = Math.max(
                round(mouse.percY * 100, positionPrecision),
                this.values.top
            )
        }

        if (this.resizing.includes('l')) {
            this.values.left = Math.min(
                round(mouse.percX * 100, positionPrecision),
                this.values.right
            )
        } else if (this.resizing.includes('r')) {
            this.values.right = Math.max(
                round(mouse.percX * 100, positionPrecision),
                this.values.left
            )
        }

        body.onFrame.end(this.updatePosition)

        sendEventTo(
            {
                //TODO: only include values which changed
                top: this.values.top,
                left: this.values.left,
                right: this.values.right,
                bottom: this.values.bottom,

                fromUser: true,
                from: this
            },
            this.events.change
        )
    }

    getMouseDirections(mouse) {
        //Multiple the top/left/right/bottom percentage values by the actual parent box size, to get the absolute pixel positions
        mouse.top = Math.round(mouse.y - (this.values.top / 100) * this.parent.client.height)
        mouse.left = Math.round(mouse.x - (this.values.left / 100) * this.parent.client.width)
        mouse.right = Math.round(mouse.x - (this.values.right / 100) * this.parent.client.width)
        mouse.bottom = Math.round(mouse.y - (this.values.bottom / 100) * this.parent.client.height)

        let directions = ''

        if (
            mouse.top > -boxHitSize &&
            mouse.left > -boxHitSize &&
            mouse.right < boxHitSize &&
            mouse.bottom < boxHitSize
        ) {
            if (
                Math.abs(mouse.top) < boxHitSize &&
                Math.abs(mouse.top) < Math.abs(mouse.bottom)
            ) {
                directions += 't'
            } else if (Math.abs(mouse.bottom) < boxHitSize) {
                directions += 'b'
            }

            if (
                Math.abs(mouse.left) < boxHitSize &&
                Math.abs(mouse.left) < Math.abs(mouse.right)
            ) {
                directions += 'l'
            } else if (Math.abs(mouse.right) < boxHitSize) {
                directions += 'r'
            }
        }

        return directions
    }

    edit(data = {}, fromUser = false) {
        let event = {}

        if (typeof data.top === 'number' && isFinite(data.top)) {
            this.values.top = round(data.top, positionPrecision)

            event.top = data.top
        }

        if (typeof data.left === 'number' && isFinite(data.left)) {
            this.values.left = round(data.left, positionPrecision)

            event.left = data.left
        }

        if (typeof data.right === 'number' && isFinite(data.right)) {
            this.values.right = round(data.right, positionPrecision)

            event.right = data.right
        }

        if (typeof data.bottom === 'number' && isFinite(data.bottom)) {
            this.values.bottom = round(data.bottom, positionPrecision)

            event.bottom = data.bottom
        }

        if (this.values.top > this.values.bottom) {
            this.values.top = this.values.bottom = round(
                (this.values.top + this.values.bottom) / 2,
                positionPrecision
            )
        }

        if (this.values.left > this.values.right) {
            this.values.left = this.values.right = round(
                (this.values.left + this.values.right) / 2,
                positionPrecision
            )
        }

        if (Object.keys(event).length > 0) {
            event.fromUser = fromUser
            event.from = this

            body.onFrame.end(this.updatePosition)

            sendEventTo(event, this.events.change)
        }
    }

    getData() {
        let values = {}
        for (let key in this.values) {
            values[key] = this.values[key]
        }

        return values
    }
}

{
    loadCSS('display.css')

    class Node {
        /*
        Wrapper item for display items (does not extend base item class).

        Constructor data:
            top (number)
            left (number)
            right (number)
            bottom (number)
        
        Properties:
        
        Events:
            N/A
        */
        constructor(data = {}) {
            this.node = document.createElement('div')
            this.node.className = 'display-node'

            this.node.style.top = '0%'
            this.node.style.left = '0%'
            this.node.style.right = '0%'
            this.node.style.bottom = '0%'

            //Used in Display.display getter
            this.values = {
                top: 0,
                left: 0,
                right: 0,
                bottom: 0
            }

            this.update(data)
        }

        update(data = {}) {
            if (typeof data.top === 'number') {
                this.node.style.top = data.top + '%'
            }

            if (typeof data.left === 'number') {
                this.node.style.left = data.left + '%'
            }

            if (typeof data.right === 'number') {
                this.node.style.right = 100 - data.right + '%'
            }

            if (typeof data.bottom === 'number') {
                this.node.style.bottom = 100 - data.bottom + '%'
            }
        }
    }

    class TextNode extends Node {
        /*
        Text node for display item.

        Constructor data (extends Node):
            text (string)
            plainText (string)
            font (string)
            size (number)
            color (string)
            lineHeight (number)
            align (string)
            y (string)
        
        Properties:
        
        Methods:
            update (data: object)
        */
        constructor(data = {}) {
            super()

            this.textNode = document.createElement('p')
            this.textNode.className = 'text'
            this.node.appendChild(this.textNode)

            this.textNode.style.fontFamily = 'arial'
            this.textNode.style.fontSize = '10px'
            this.textNode.style.color = 'grey'

            this.textNode.style.lineHeight = '1.5'

            this.textNode.style.textAlign = 'left'
            this.textNode.style.alignSelf = 'flex-start'

            //.values is used to get display properties, so the type must be set for text nodes
            this.values.type = 'text'

            this.values.text = ''
            this.values.plainText = ''

            this.values.font = ''
            this.values.size = 0
            this.values.color = ''

            this.values.lineHeight = 1.5

            this.values.align = ''
            this.values.y = ''

            this.update(data)
        }

        update(data = {}) {
            super.update(data)

            if (
                typeof data.text === 'string' &&
                data.text !== this.values.text
            ) {
                this.textNode.innerHTML = this.values.text = richText.clean(
                    data.text
                )

                this.values.plainText = richText.removeFormat(this.values.text)
            } else if (
                typeof data.plainText === 'string' &&
                data.plainText !== this.values.plainText
            ) {
                this.textNode.textContent = this.values.plainText =
                    data.plainText

                this.values.text = richText.format(data.plainText)
            }

            if (
                typeof data.font === 'string' &&
                data.font !== this.values.font
            ) {
                this.textNode.style.fontFamily = this.values.font = data.font
            }

            if (
                typeof data.size === 'number' &&
                isFinite(data.size) &&
                data.size > 0 &&
                data.size !== this.values.size
            ) {
                this.values.size = data.size
                this.textNode.style.fontSize = this.values.size + 'px'
            }

            if (color.isColor(data.color) && data.color !== this.values.color) {
                this.textNode.style.color = this.values.color = data.color
            }

            if (
                typeof data.lineHeight === 'number' &&
                isFinite(data.lineHeight) &&
                data.lineHeight > 0 &&
                data.lineHeight !== this.values.lineHeight
            ) {
                this.values.lineHeight = data.lineHeight
                this.textNode.style.lineHeight = this.values.lineHeight
            }

            if (
                (data.align === 'left' ||
                    data.align === 'center' ||
                    data.align === 'right') &&
                data.align !== this.values.align
            ) {
                this.textNode.style.textAlign = this.values.align = data.align
            }

            if (
                (data.y === 'top' ||
                    data.y === 'center' ||
                    data.y === 'bottom') &&
                data.y !== this.values.y
            ) {
                this.values.y = data.y

                this.textNode.style.alignSelf =
                    this.values.y === 'top'
                        ? 'flex-start'
                        : this.values.y === 'bottom'
                        ? 'flex-end'
                        : 'center'
            }
        }
    }

    class ImageNode extends Node {
        /*
        Image node for display item (extends Node item).

        Constructor data:
            url (string)
            scale (number)
        
        Properties:
            N/A
        
        Methods:
            update (data: object)
        */
        constructor(data = {}) {
            super()
            this.imageNode = document.createElement('div')
            this.imageNode.className = 'image'
            this.imageNode.style.backgroundSize = 'cover'

            this.node.appendChild(this.imageNode)

            //.values is used to get display properties, so the type must be set for image nodes
            this.values.type = 'image'

            this.values.url = ''
            this.values.scale = ''

            this.update(data)
        }

        update(data = {}) {
            super.update(data)

            if (typeof data.url === 'string' && data.url !== this.values.url) {
                this.values.url = data.url

                this.imageNode.style.backgroundImage = formatUrl(data.url)
            }

            if (data.scale !== this.values.scale) {
                if (data.scale === 'fit') {
                    this.values.scale = data.scale

                    this.imageNode.style.backgroundSize = 'contain'
                } else if (data.scale === 'fill') {
                    this.values.scale = data.scale

                    this.imageNode.style.backgroundSize = 'cover'
                } else if (data.scale === 'stretch') {
                    this.values.scale = data.scale

                    this.imageNode.style.backgroundSize = '100% 100%'
                }
            }
        }
    }

    class Display extends Item {
        /*
        For previewing what will be displayed.

        Constructor data:
            background (string)
            backgroundImage (string)
            backgroundScale (number)
            nodes (array)
        
        Properties:
            display (get) (object)
        
        Methods:
            add (data: object): Adds new node
            set (data: object): Changes display to given values
            update (data: object): Updates display to given values
        */
        constructor(data = {}, styles = {}) {
            super(document.createElement('div'))
            this.addClass('display')

            this.screenNode = document.createElement('div')
            this.screenNode.className = 'screen'

            this.node.appendChild(this.screenNode)

            this.data = {
                background: 'black',
                backgroundImage: '',
                backgroundScale: 'fill',

                nodes: []
            }
            this.nodes = []

            this.ratio = 1
            this.lastPaintScale = 0
            this.displayScale = 1
            this.screenOffset = { x: 0, y: 0 }

            this.setNode = {
                width: false,
                height: false
            }
            this.nodeSize = {
                width: 0,
                height: 0
            }

            this.screenNode.style.backgroundColor = 'black'
            this.screenNode.style.backgroundImage = ''
            this.screenNode.style.backgroundSize = 'cover'

            this.screenNode.style.width = currentDisplay.width + 'px'
            this.screenNode.style.height = currentDisplay.height + 'px'

            bindFunctions(
                this,
                this.onResize,
                this.repaint,
                this.repaint2,
                this.repaint3,
                this.readSize,
                this.writeSize,

                this.writeNodes,
                this.writeContent
            )

            this.set(data)

            this.updateDisplay()

            addStyles(this, styles)

            currentDisplay.onEvent('change', () => {
                this.screenNode.style.width = currentDisplay.width + 'px'
                this.screenNode.style.height = currentDisplay.height + 'px'

                body.onFrame.end(this.writeSize)
            })
        }

        onEvent(event, listener) {
            if (event === 'drag' && !this.events.drag) {
                this.events.drag = [listener]

                let mousedown = false
                this.node.addEventListener('mousedown', () => {
                    mousedown = true
                })
                body.onEvent('mouseup', () => {
                    mousedown = false
                })
                body.onEvent('blur', () => {
                    mousedown = false
                })

                this.node.addEventListener('mouseleave', () => {
                    if (mousedown) {
                        mousedown = false

                        sendEventTo(
                            {
                                fromUser: true,
                                from: this
                            },
                            this.events.drag
                        )
                    }
                })
            } else {
                super.onEvent(event, listener)
            }
        }

        get display() {
            return {
                background: this.data.background,
                backgroundImage: this.data.backgroundImage,
                backgroundScale: this.data.backgroundScale,

                nodes: this.data.nodes
            }
        }

        onResize() {
            body.onFrame.start(this.readSize)
            body.onFrame.end(this.writeSize)
        }

        readSize() {
            this.nodeSize.width = this.node.offsetWidth
            this.nodeSize.height = this.node.offsetHeight

            if (this.nodeSize.width !== 0 && this.nodeSize.height !== 0) {
                this.ratio = this.nodeSize.width / this.nodeSize.height
            }
        }

        writeSize() {
            if (this.nodeSize.width === 0 || this.nodeSize.height === 0) {
                return false
            }

            this.screenOffset.x = 0
            this.screenOffset.y = 0

            if (
                (this.setNode.height || currentDisplay.ratio > this.ratio) &&
                !this.setNode.width
            ) {
                //Scale based on width
                this.displayScale = this.nodeSize.width / currentDisplay.width

                if (this.setNode.height) {
                    this.node.style.height =
                        ~~(currentDisplay.height * this.displayScale + 0.5) +
                        'px'
                } else {
                    this.screenOffset.y =
                        (this.nodeSize.height -
                            currentDisplay.height * this.displayScale) /
                        2
                }
            } else {
                //Scale based on height
                this.displayScale = this.nodeSize.height / currentDisplay.height

                if (this.setNode.width) {
                    this.node.style.width =
                        ~~(currentDisplay.width * this.displayScale + 0.5) +
                        'px'
                } else {
                    this.screenOffset.x =
                        (this.nodeSize.width -
                            currentDisplay.width * this.displayScale) /
                        2
                }
            }

            this.screenNode.style.transform =
                'scale(' +
                this.displayScale +
                ') translate(' +
                this.screenOffset.x / this.displayScale +
                'px,' +
                this.screenOffset.y / this.displayScale +
                'px)'
        }

        writeNodes() {
            //Remove all extra children
            for (
                let i = this.nodes.length - 1;
                i >= this.data.nodes.length;
                i--
            ) {
                this.screenNode.removeChild(this.nodes.pop().node)
            }

            //Add any new children
            for (let i = this.nodes.length; i < this.data.nodes.length; i++) {
                if (this.data.nodes[i].type === 'image') {
                    this.nodes.push(new ImageNode(this.data.nodes[i]))
                } else {
                    this.nodes.push(new TextNode(this.data.nodes[i]))
                }
                this.screenNode.appendChild(this.nodes[i].node)
            }

            //Change the type of any nodes
            for (let i = 0; i < this.data.nodes.length; i++) {
                if (this.nodes[i].values.type !== this.data.nodes[i].type) {
                    let oldNodeElement = this.screenNode.childNodes[i]

                    if (this.data.nodes[i].type === 'image') {
                        this.nodes[i] = new ImageNode(this.data.nodes[i])
                    } else {
                        this.nodes[i] = new TextNode(this.data.nodes[i])
                    }

                    this.screenNode.insertBefore(
                        this.nodes[i].node,
                        oldNodeElement
                    )
                    this.screenNode.removeChild(oldNodeElement)
                }
            }

            for (let i = 0; i < this.nodes.length; i++) {
                this.nodes[i].displayScale = this.displayScale
            }
        }

        writeContent() {
            this.screenNode.style.backgroundColor = this.data.background

            this.screenNode.style.backgroundImage = formatUrl(
                this.data.backgroundImage
            )

            if (this.data.backgroundScale === 'fill') {
                this.screenNode.style.backgroundSize = 'cover'
            } else if (this.data.backgroundScale === 'fit') {
                this.screenNode.style.backgroundSize = 'contain'
            } else if (this.data.backgroundScale === 'stretch') {
                this.screenNode.style.backgroundSize = '100% 100%'
            }

            for (let i = 0; i < this.nodes.length; i++) {
                this.nodes[i].displayScale = this.displayScale
            }
        }

        add(data) {
            this.data.nodes.push(data)

            body.onFrame.end(this.writeNodes)
        }

        set(data = {}) {
            if (typeof data.background === 'string') {
                this.data.background = data.background
            }

            if (typeof data.backgroundImage === 'string') {
                this.data.backgroundImage = data.backgroundImage
            }

            if (typeof data.backgroundScale === 'string') {
                this.data.backgroundScale = data.backgroundScale
            }

            if (Array.isArray(data.nodes)) {
                this.data.nodes = data.nodes

                for (
                    let i = 0;
                    i < this.nodes.length && i < this.data.nodes.length;
                    i++
                ) {
                    this.nodes[i].update(this.data.nodes[i])
                }

                body.onFrame.end(this.writeNodes)
            }

            body.onFrame.end(this.writeContent)
        }

        update(data = {}) {
            if (typeof data.background === 'string') {
                this.data.background = data.background
            }

            if (typeof data.backgroundImage === 'string') {
                this.data.backgroundImage = data.backgroundImage
            }

            if (typeof data.backgroundScale === 'string') {
                this.data.backgroundScale = data.backgroundScale
            }

            if (Array.isArray(data.nodes)) {
                //For each existing (displayed) node which is being changed
                for (
                    let i = 0;
                    i < this.nodes.length && i < data.nodes.length;
                    i++
                ) {
                    this.nodes[i].update(data.nodes[i])
                }

                //For each existing (not displayed) node which is being changed
                for (
                    let i = 0;
                    i < this.data.nodes.length && i < data.nodes.length;
                    i++
                ) {
                    objUtil.applyObj(this.data.nodes[i], data.nodes[i])
                }

                //For each new node
                for (
                    let i = this.data.nodes.length;
                    i < data.nodes.length;
                    i++
                ) {
                    this.data.nodes.push(data.nodes[i])
                }

                body.onFrame.end(this.writeNodes)
            }

            body.onFrame.end(this.writeContent)
        }

        updateDisplay() {
            body.onFrame.end(this.writeContent)
        }
    }
    exports.Display = items.Display = Display
    itemStylesMap.Display = {
        width: (item, value) => {
            item.setNode.width = value === 'display'

            if (value === 'display') {
                return { value: '' }
            }

            return {}
        },
        height: (item, value) => {
            item.setNode.height = value === 'display'

            if (value === 'display') {
                return { value: '' }
            }

            return {}
        }
    }

    //display edit items
    class TextBoxEdit extends BoxEdit {
        /*
        For editing text items in display edit item.

        Constructor data (extends BoxEdit):
            Same as richTextInput constructor data
        
        Properties:
            y (get/set) (string)
        
        Methods:
            focus
            blur
            connect (item: Item): Connects to controls.
            edit (data: object)
            textEdit: Sends edits to text input.
            set (data: object)
            getData: returns object with data in display format.
        
        Events:
            change: Same as richTextInput change
        */
        constructor(data = {}) {
            super({
                focus: data.focus
            })

            this.text = new exports.RichTextInput(
                {
                    focus: false
                },
                {
                    overflow: 'hidden'
                }
            )
            this.text.addClass('textInput')
            this.text.shareFocusWith(this)

            //This is needed so that scrollbars overwrite the resize bars of the box
            //When mouse comes from outside, the iframe has pointer-events: none, and so resize bars take all mouse events
            //But when the mouse is inside the iframe (and then has pointer-events), the resize bars have a lower z-index
            this.text.iframe.style.zIndex = 3
            //this.text.iframe.style.position = 'relative' (this doesn't seem required for z-index to work)

            this.node.appendChild(this.text.node)

            this.values.text = ''
            this.values.plainText = ''

            this.values.font = ''
            this.values.size = 0
            this.values.color = ''

            this.values.lineHeight = 1.5

            this.values.align = ''
            this.values.y = ''

            this.text.onEvent('change', change => {
                for (let property in change) {
                    if (property !== 'fromUser' && property !== 'from') {
                        this.values[property] = change[property]
                    }
                }

                change.from = this
                sendEventTo(change, this.events.change)
            })

            this.text.onEvent('focus', event => {
                this.focus(event.fromUser)
            })

            this.set(data)
        }

        set displayScale(scale) {
            this.text.scale = scale
        }

        get font() {
            return this.values.font
        }
        get size() {
            return this.values.size
        }
        get color() {
            return this.values.color
        }

        get lineHeight() {
            return this.values.lineHeight
        }

        get align() {
            return this.values.align
        }
        get y() {
            return this.values.y
        }

        focus(fromUser = false) {
            if (this._focused) {
                return false
            }

            this._focused = true

            this.node.classList.add('focus')

            if (!this.text._focused) {
                this.text.focus()
            }

            if (this._globalFocus) {
                body.inputFocused(this, fromUser)
            }

            sendEventTo(
                {
                    fromUser: fromUser,
                    from: this
                },
                this.events.focus
            )
        }
        blur() {
            if (!this._focused) {
                return false
            }
            this._focused = false

            this.node.classList.remove('focus')

            if (this.text._focused) {
                this.text.blur()
            }

            sendEventTo(
                {
                    fromUser: false,
                    from: this
                },
                this.events.blur
            )
        }

        shareFocusWith(item) {
            this.text.shareFocusWith(item)
            super.shareFocusWith(item)
        }

        groupShareFocusWith(item) {
            this.text.groupShareFocusWith(item)
            super.groupShareFocusWith(item)
        }

        connect(item) {
            if (item instanceof BoxEdit !== true) {
                item.connect(this)
            }
        }

        fit(increase = true) {
            exports.Display.getMaxTextSize(this.values, size => {
                if (!isFinite(size) || size < 0) {
                    return false
                }
                if (size >= this.values.size && increase === false) {
                    return false
                }

                this.edit({ size: size })
            })
        }

        edit(data, fromUser = false) {
            this.text.edit(data, fromUser)
            super.edit(data, fromUser)
        }
        textEdit() {
            this.text.textEdit(...arguments)
        }

        set(data) {
            this.edit(data)
        }
    }

    class ImageBoxEdit extends BoxEdit {
        /*
        For editing images in display edit items.

        Constructor data (extends BoxEdit):
            url (string)
            database (boolean)
            scale (string)
        
        Properties (extends BoxEdit):
            url (get/set) (string)
            database (get/set) (boolean)
            scale (get/set) (string)
        
        Methods (extends BoxEdit):
            focus
            blur
            connect (item: Item): Connects to controls
            edit (data: object)
            set (data: object)
            getData: returns data in display format.
        
        Events:
            change (url: string, database: boolean, scale: string)
        */
        constructor(data = {}) {
            super({
                focus: data.focus
            })

            this.imageNode = document.createElement('div')
            this.imageNode.className = 'image'
            this.imageNode.style.backgroundSize = 'cover'

            this.imageNode.src = ''

            this.node.appendChild(this.imageNode)

            this.values.url = ''
            this.values.database = false
            this.values.scale = ''

            this.set(data)

            this.imageNode.addEventListener('click', () => {
                this.focus(true)
            })
        }

        get url() {
            return this.values.url
        }

        get database() {
            return this.values.database
        }

        get scale() {
            return this.values.scale
        }
        set scale(scale) {
            if (scale === 'fill') {
                this.imageNode.style.backgroundSize = 'cover'
            } else if (scale === 'fit') {
                this.imageNode.style.backgroundSize = 'contain'
            } else if (scale === 'stretch') {
                this.imageNode.style.backgroundSize = '100% 100%'
            } else {
                return false
            }

            this.values.scale = scale

            sendEventTo(
                {
                    scale: this.values.scale,

                    fromUser: false,
                    from: this
                },
                this.events.change
            )
        }

        focus(fromUser = false) {
            if (this._focused) {
                return false
            }
            this.node.classList.add('focus')

            if (this._globalFocus) {
                body.inputFocused(this, fromUser)
            }

            sendEventTo(
                {
                    fromUser: fromUser,
                    from: this
                },
                this.events.focus
            )
        }
        blur() {
            this.node.classList.remove('focus')

            sendEventTo(
                {
                    fromUser: false,
                    from: this
                },
                this.events.blur
            )
        }

        connect(item) {
            if (item instanceof BoxEdit !== true) {
                item.connect(this)
            }
        }

        edit(data, fromUser = false) {
            if (typeof data.url === 'string') {
                this.values.url = data.url
                this.imageNode.style.backgroundImage = formatUrl(data.url)

                sendEventTo(
                    {
                        url: this.values.url,

                        fromUser: fromUser,
                        from: this
                    },
                    this.events.change
                )
            }

            if (typeof data.database === 'boolean') {
                this.values.database = data.database

                sendEventTo(
                    {
                        database: this.values.database,

                        fromUser: fromUser,
                        from: this
                    },
                    this.events.change
                )
            }

            if (
                data.scale === 'fit' ||
                data.scale === 'fill' ||
                data.scale === 'stretch'
            ) {
                this.values.scale = data.scale

                if (data.scale === 'fill') {
                    this.imageNode.style.backgroundSize = 'cover'
                } else if (data.scale === 'fit') {
                    this.imageNode.style.backgroundSize = 'contain'
                } else if (data.scale === 'stretch') {
                    this.imageNode.style.backgroundSize = '100% 100%'
                }

                sendEventTo(
                    {
                        scale: this.values.scale,

                        fromUser: fromUser,
                        from: this
                    },
                    this.events.change
                )
            }

            super.edit(data, fromUser)
        }

        set(data) {
            this.edit(data)
        }
    }

    class DisplayEdit extends Item {
        constructor(data = {}, styles = {}) {
            super(document.createElement('div'))
            this.addClass('display-edit')

            this.screenNode = document.createElement('div')
            this.screenNode.className = 'screen'

            this.node.appendChild(this.screenNode)

            this.data = {
                background: 'black',
                backgroundImage: '',
                backgroundScale: 'fill'
            }
            this.nodes = []

            this.ratio = 1
            this.displayScale = 1
            this.screenOffset = { x: 0, y: 0 }

            this.setNode = {
                width: false,
                height: false
            }
            this.nodeSize = {
                width: 0,
                height: 0
            }
            this.screeNodeSize = {
                width: 0,
                height: 0
            }

            this.nodeOffset = {
                top: 0,
                left: 0
            }

            this.client = {
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,

                width: 0,
                height: 0,

                x: 0,
                y: 0
            }

            bindFunctions(this, this.onResize, this.readSize, this.writeSize)

            this.edit(this.data)

            addStyles(this, styles)

            currentDisplay.onEvent('change', () => {
                body.onFrame.end(this.writeSize)
            })

            body.onEvent('mousemove', event => {
                let mouse = this.convertMouse(event)

                for (let i = 0; i < this.nodes.length; i++) {
                    this.nodes[i].mouseMove(mouse)
                }
            })
        }

        get background() {
            return this.data.background
        }
        set background(background) {
            if (color.isColor(background)) {
                this.screenNode.style.backgroundColor = this.data.background = background

                sendEventTo(
                    {
                        background: background,

                        fromUser: false,
                        from: this
                    },
                    this.events.change
                )

                this.updateHandles()
            }
        }

        get backgroundImage() {
            return this.data.backgroundImage
        }
        set backgroundImage(backgroundImage) {
            if (typeof backgroundImage !== 'string') {
                return false
            }

            this.data.backgroundImage = backgroundImage
            this.screenNode.style.backgroundImage = formatUrl(
                this.data.backgroundImage
            )

            sendEventTo(
                {
                    backgroundImage: backgroundImage,

                    fromUser: false,
                    from: this
                },
                this.events.change
            )
        }

        get backgroundScale() {
            return this.data.backgroundScale
        }
        set backgroundScale(backgroundScale) {
            if (
                backgroundScale === 'fit' ||
                backgroundScale === 'fill' ||
                backgroundScale === 'stretch'
            ) {
                this.data.backgroundScale = backgroundScale

                if (backgroundScale === 'fit') {
                    this.screenNode.style.backgroundSize = 'contain'
                } else if (backgroundScale === 'fill') {
                    this.screenNode.style.backgroundSize = 'cover'
                } else {
                    this.screenNode.style.backgroundSize = '100% 100%'
                }

                sendEventTo(
                    {
                        backgroundScale: backgroundScale,

                        fromUser: false,
                        from: this
                    },
                    this.events.change
                )
            }
        }

        onEvent(event, listener) {
            if (event === 'drag' && !this.events.drag) {
                this.events.drag = [listener]

                let mousedown = false
                this.node.addEventListener('mousedown', () => {
                    mousedown = true
                })
                body.onEvent('mouseup', () => {
                    mousedown = false
                })
                body.onEvent('blur', () => {
                    mousedown = false
                })

                this.node.addEventListener('mouseleave', () => {
                    if (mousedown) {
                        mousedown = false

                        sendEventTo(
                            {
                                fromUser: true,
                                from: this
                            },
                            this.events.drag
                        )
                    }
                })
            } else {
                super.onEvent(event, listener)
            }
        }

        onResize() {
            body.onFrame.start(this.readSize)
            body.onFrame.end(this.writeSize)
        }

        readSize() {
            this.nodeSize.width = this.node.offsetWidth
            this.nodeSize.height = this.node.offsetHeight

            this.nodeOffset.top = this.node.offsetTop
            this.nodeOffset.left = this.node.offsetLeft

            if (this.nodeSize.width !== 0 && this.nodeSize.height !== 0) {
                this.ratio = this.nodeSize.width / this.nodeSize.height

                //this.screenNode.width = this.screenNode.offsetWidth
                //this.screenNode.height = this.screenNode.offsetHeight
            }
        }

        writeSize() {
            if (this.nodeSize.width === 0 || this.nodeSize.height === 0) {
                return false
            }

            this.screenOffset.x = 0
            this.screenOffset.y = 0

            if (
                (this.setNode.height || currentDisplay.ratio > this.ratio) &&
                !this.setNode.width
            ) {
                //Scale based on width
                this.displayScale = this.nodeSize.width / currentDisplay.width

                if (this.setNode.height) {
                    this.node.style.height =
                        ~~(currentDisplay.height * this.displayScale + 0.5) +
                        'px'
                } else {
                    this.screenOffset.y =
                        (this.nodeSize.height -
                            currentDisplay.height * this.displayScale) /
                        2
                }
            } else {
                //scale based on height
                this.displayScale = this.nodeSize.height / currentDisplay.height

                if (this.setNode.width) {
                    this.node.style.widows =
                        ~~(currentDisplay.width * this.displayScale + 0.5) +
                        'px'
                } else {
                    this.screenOffset.x =
                        (this.nodeSize.width -
                            currentDisplay.width * this.displayScale) /
                        2
                }
            }

            this.screenNode.style.width =
                currentDisplay.width * this.displayScale + 'px'
            this.screenNode.style.height =
                currentDisplay.height * this.displayScale + 'px'

            this.screenNode.style.left = this.screenOffset.x + 'px'
            this.screenNode.style.top = this.screenOffset.y + 'px'

            this.client.top = this.screenOffset.y + this.nodeOffset.top
            this.client.left = this.screenOffset.x + this.nodeOffset.left
            this.client.width = currentDisplay.width * this.displayScale
            this.client.height = currentDisplay.height * this.displayScale

            for (let i = 0; i < this.nodes.length; i++) {
                this.nodes[i].displayScale = this.displayScale
            }
        }

        updateHandles() {
            let handleColor = 'rgb(255, 255, 255)'

            if (color.brightness(this.background) > 50)
                handleColor = 'rgb(0, 0, 0)'

            for (let i = 0; i < this.nodes.length; i++) {
                this.nodes[i].handleColor = handleColor
            }
        }

        convertMouse(mouse) {
            return {
                x: mouse.clientX - this.client.left,
                y: mouse.clientY - this.client.top,

                percX: (mouse.clientX - this.client.left) / this.client.width,
                percY: (mouse.clientY - this.client.top) / this.client.height,

                displayX:
                    (mouse.clientX - this.client.left) / this.displayScale,
                displayY: (mouse.clientY - this.client.top) / this.displayScale,

                ctrlKey: mouse.ctrlKey,
                shiftKey: mouse.shiftKey,
                altKey: mouse.altKey,
                metaKey: mouse.metaKey,

                client: this.client
            }
        }

        add(data = {}, index = this.nodes.length) {
            let item = null
            if (data.type === 'text') {
                item = new TextBoxEdit(data)
            } else if (data.type === 'image') {
                item = new ImageBoxEdit(data)
            } else {
                return false
            }

            item.parent = this

            if (index >= 0 && index < this.nodes.length) {
                this.screenNode.insertBefore(item.node, this.nodes[index].node)
                this.nodes.splice(index, 0, item)
            } else {
                this.screenNode.appendChild(item.node)
                this.nodes.push(item)
            }

            item.handleColor =
                color.brightness(this.background) > 50
                    ? 'rgb(0, 0, 0)'
                    : 'rgb(255, 255, 255)'

            item.displayScale = this.displayScale

            return item
        }

        //TODO: remove?
        replace(itemOrIndex, data) {
            if (this.nodes.indexOf(itemOrIndex) !== -1)
                itemOrIndex = this.nodes.indexOf(itemOrIndex)

            if (
                typeof itemOrIndex === 'number' &&
                itemOrIndex >= 0 &&
                itemOrIndex < this.nodes.length
            ) {
                let item = this.add(data, itemOrIndex)

                //only remove the item at the original index if a new item was succesfully created
                if (item) {
                    this.remove(itemOrIndex + 1)
                    return item
                }
            }

            return null
        }

        remove(itemOrIndex) {
            if (this.nodes.indexOf(itemOrIndex) !== -1) {
                itemOrIndex = this.nodes.indexOf(itemOrIndex)
            } else if (typeof itemOrIndex !== 'number') {
                return false
            }

            if (itemOrIndex >= 0 && itemOrIndex < this.nodes.length) {
                this.screenNode.removeChild(this.nodes[itemOrIndex].node)

                this.nodes.splice(itemOrIndex, 1)
            }
        }

        edit(data = {}, fromUser = false) {
            if (typeof data.background === 'string') {
                this.screenNode.style.backgroundColor = this.data.background =
                    data.background

                this.updateHandles()

                sendEventTo(
                    {
                        background: data.background,

                        fromUser: fromUser,
                        from: this
                    },
                    this.events.change
                )
            }

            if (typeof data.backgroundImage === 'string') {
                this.data.backgroundImage = data.backgroundImage
                this.screenNode.style.backgroundImage = formatUrl(
                    this.data.backgroundImage
                )

                sendEventTo(
                    {
                        backgroundImage: data.backgroundImage,

                        fromUser: fromUser,
                        from: this
                    },
                    this.events.change
                )
            }

            if (
                data.backgroundScale === 'fill' ||
                data.backgroundScale === 'fit' ||
                data.backgroundScale === 'stretch'
            ) {
                this.data.backgroundScale = data.backgroundScale

                if (this.data.backgroundScale === 'fill') {
                    this.screenNode.style.backgroundSize = 'cover'
                } else if (this.data.backgroundScale === 'fit') {
                    this.screenNode.style.backgroundSize = 'contain'
                } else if (this.data.backgroundScale === 'stretch') {
                    this.screenNode.style.backgroundSize = '100% 100%'
                }

                sendEventTo(
                    {
                        backgroundScale: data.backgroundScale,

                        fromUser: fromUser,
                        from: this
                    },
                    this.events.change
                )
            }

            if (Array.isArray(data.nodes)) {
                let min = Math.min(data.nodes.length, this.data.nodes.length)

                for (let i = 0; i < min; i++) {
                    if (typeof data.nodes[i] === 'object') {
                        this.nodes[i].edit(data.nodes[i])
                    }
                }

                if (data.nodes[i].length > min) {
                    for (let i = min; i < data.nodes[i].length; i++) {
                        if (typeof data.nodes[i] === 'object') {
                            this.add(data.nodes[i])
                        }
                    }
                }
            }
        }

        set(data = {}) {
            this.edit(data)
        }
    }
    exports.DisplayEdit = items.DisplayEdit = DisplayEdit
    itemStylesMap.DisplayEdit = {
        width: (item, value) => {
            item.setNode.width = value === 'display'

            if (value === 'display') {
                return { value: '' }
            }

            return {}
        },
        height: (item, value) => {
            item.setNode.height = value === 'display'

            if (value === 'display') {
                return { value: '' }
            }

            return {}
        }
    }
}

//Display methods
{
    const testContainer = document.createElement('div')
    const testElements = []

    const testSize = 100

    const maxConcurrentTests = 100

    const whitespaceRegex = new RegExp(/(\s+)/)

    let textSizeQueue = []

    let writtenCount = 0

    let running = false

    //TODO: Move this to display stylesheet
    testContainer.style.position = 'fixed'
    testContainer.style.top = '5000px'
    testContainer.style.left = '5000px'
    testContainer.style.pointerEvents = 'none'
    testContainer.style.opacity = '0'

    for (let i = 0; i < maxConcurrentTests; i++) {
        testElements.push(document.createElement('div'))

        testElements[i].style.position = 'fixed'

        testElements[i].style.display = 'inline-block'
        testElements[i].style.lineHeight = '1.5'
        testElements[i].style.whiteSpace = 'pre'

        testContainer.appendChild(testElements[i])
    }

    function getHeight(lines, fontSize, width) {
        let height = 0

        for (let i = 0; i < lines.length; i++) {
            let lineWidth = 0

            for (let j = 0; j < lines[i].widthRatios.length; j++) {
                let partWidth = lines[i].widthRatios[j] * fontSize

                if (lineWidth + partWidth > width) {
                    height += lines[i].heightRatio * fontSize

                    lineWidth = 0

                    while (partWidth > width) {
                        height += lines[i].heightRatio * fontSize

                        partWidth -= width
                    }
                }

                lineWidth += partWidth
            }

            height += lines[i].heightRatio * fontSize
        }

        return height
    }

    function readTextTest(index) {
        if (textSizeQueue.length === 0) {
            return false
        }

        let width = testElements[index].offsetWidth
        let height = testElements[index].offsetHeight

        if (width === 0 || height === 0) {
            textSizeQueue[index].callback(Infinity)

            return false
        }

        /*
        First, check if the base size of the text (when layed out with no line wrapping), will fit into the container box when scaled based on height
        *⎯⎯⎯⎯⎯*⎯⎯⎯⎯⎯⎯⎯*⎯⎯⎯⎯*
        |    |▀▀▀▀  |    |
        |    |▀▀▀   |    |
        |    |▀▀▀▀▀▀|    |
        *⎯⎯⎯⎯⎯*⎯⎯⎯⎯⎯⎯⎯*⎯⎯⎯⎯*
        If the (width / height) ratio of the text is less than the (width / height) of the container box,
        that means that no line wrapping needs to occur, and the optimal font-size can be found by dividing the size of the text box by the difference between the text box height, and container box height.
        */
        if (
            width / height <=
            textSizeQueue[index].width / textSizeQueue[index].height
        ) {
            //Return the optimal size, rounded down to the nearest integer (which is done by "~~")
            textSizeQueue[index].callback(
                ~~(testSize / (height / textSizeQueue[index].height))
            )
        } else {
            //Get the sizes of each line
            //Where each item in the array is an object, with two properties:
            //widthRatios: An array, where each value is the width of each white-space seperated text content, divided by the font size
            //heightRatio: The height of the text, divided by the font size
            let lineSizes = []

            for (let i = 0; i < testElements[index].children.length; i++) {
                lineSizes.push({
                    //Always include a zero, so that ones with no text content get 0 width, instead of undefined width
                    widthRatios: [0],

                    //No line should have a height ratio below 1.5 (which is the line-height for text)
                    heightRatio: Math.max(
                        1.5,
                        testElements[index].children[i].offsetHeight / testSize
                    )
                })

                for (
                    let j = 0;
                    j < testElements[index].children[i].childElementCount;
                    j++
                ) {
                    lineSizes[i].widthRatios.push(
                        testElements[index].children[i].children[j]
                            .offsetWidth / testSize
                    )
                }
            }

            //The early ratio check means that scaling the text based on it's height will cause line wrapping
            //That means the text cannot fit if scaled directly to fit by height
            //So as a starting estimate, set the maximum text size to be scaled to fit height (Which is too large, but a good low maximum)
            //And set the minimum text size to be scaled to fit width (Which will always fit)

            //Round max up by adding 0.49, and round min down by subtracting 0.49
            let maxSize = round(
                testSize / (height / textSizeQueue[index].height) + 0.049,
                1
            )
            let minSize = round(
                testSize / (width / textSizeQueue[index].width) - 0.049,
                1
            )

            let iterCount = 0

            //Continue refining min & max, while min & max are differ by a valu of more than 0.1,
            //(since when they're 0.1 apart, rounding the middle will always give the larger value, meaning the max will never be set to the min)
            //(Also subtract 0.00001, to deal with floating point rounding issues)
            while (minSize < maxSize - 0.10001 && iterCount++ < 50) {
                //Get the middle value between min & max, rounding it to one decimal place
                let size = round((maxSize + minSize) / 2, 1)

                //Then find the estimated height of all the text, when put into the container box (with line wrapping) at the given size
                let height = getHeight(
                    lineSizes,
                    size,
                    textSizeQueue[index].width
                )

                if (height > textSizeQueue[index].height) {
                    //If the height is too large, reduce the max size
                    //(Since <size> doesn't fit in the container, and is smaller than the current max size)
                    maxSize = size
                } else if (height < textSizeQueue[index].height) {
                    //If the height is too small, then increase the minimum size
                    minSize = size
                } else {
                    //If the height is exactly right, set both min & max to correct size
                    maxSize = minSize = size
                }
            }

            //Return the minimum font size, rounded down to the nearest integer (Which is what "~~" does)
            textSizeQueue[index].callback(~~minSize)
        }
    }

    function readTests() {
        for (let i = 0; i < writtenCount; i++) {
            readTextTest(i)
        }

        textSizeQueue.splice(0, writtenCount)

        writeTests()
    }

    function writeTests() {
        if (textSizeQueue.length === 0) {
            running = false

            document.body.removeChild(testContainer)
            return false
        }

        writtenCount = Math.min(textSizeQueue.length, maxConcurrentTests)

        for (let i = 0; i < writtenCount; i++) {
            testElements[i].style.top = textSizeQueue[i].top
            testElements[i].style.left = textSizeQueue[i].left
            testElements[i].style.right = textSizeQueue[i].right
            testElements[i].style.bottom = textSizeQueue[i].bottom

            testElements[i].style.fontFamily = textSizeQueue[i].font
            testElements[i].style.fontSize = testSize + 'px'
            testElements[i].style.lineHeight = textSizeQueue[i].lineHeight

            //TODO: if text doesn't contain any html characters, set textContent instead? Might be more efficient to bypass html validation, etc

            //Set the html content of the block
            //For each line in the text content, convert the line to a <div>
            //Split each line into parts of whitespace, non-whitespace (for line wrapping)
            //(And if the line is empty, use a single space character for it instead)
            //And create a <span> inside the div for each text part
            //(The widths of each span are then used when working out best text size with line wrapping)
            testElements[i].innerHTML = richText
                .lines(textSizeQueue[i].text)
                .map(
                    textLine =>
                        '<div>' +
                        richText
                            .split(textLine || ' ', whitespaceRegex)
                            .map(textBlock =>
                                textBlock.length
                                    ? '<span>' + textBlock + '</span>'
                                    : ''
                            )
                            .join('') +
                        '</div>'
                )
                .join('')
        }

        body.onFrame.start(readTests)
    }

    function getValidTextNode(textNode) {
        if (
            typeof textNode !== 'object' ||
            textNode === null ||
            !isFinite(textNode.top) ||
            !isFinite(textNode.left) ||
            !isFinite(textNode.right) ||
            !isFinite(textNode.bottom) ||
            textNode.size < 0 ||
            textNode.lineHeight < 0 ||
            typeof textNode.font !== 'string' ||
            (typeof textNode.text !== 'string' &&
                typeof textNode.plainText !== 'string')
        ) {
            return false
        }

        if (
            currentDisplay.width * ((textNode.right - textNode.left) / 100) <
                1 ||
            currentDisplay.height * ((textNode.bottom - textNode.top) / 100) < 1
        ) {
            return false
        }

        return {
            top: textNode.top,
            left: textNode.left,
            right: textNode.right,
            bottom: textNode.bottom,

            width:
                (currentDisplay.width * (textNode.right - textNode.left)) / 100,
            height:
                (currentDisplay.height * (textNode.bottom - textNode.top)) /
                100,

            size:
                isFinite(textNode.size) && textNode.size >= 0
                    ? textNode.size
                    : testSize,
            font: textNode.font,

            lineHeight:
                isFinite(textNode.lineHeight) && textNode.lineHeight > 0
                    ? textNode.lineHeight
                    : 1.5,

            text:
                typeof textNode.text === 'string'
                    ? textNode.text
                    : richText.format(textNode.plainText)
        }
    }

    function getMaxTextSize(textNode, callback) {
        if (typeof callback !== 'function') {
            return false
        }

        if (currentDisplay.width === 0 || currentDisplay.height === 0) {
            currentDisplay.onceEvent(
                'change',
                getMaxTextSize.bind(null, textNode, callback)
            )

            return false
        }

        if (Array.isArray(textNode)) {
            let textNodes = []
            let resultCount = 0

            let maxSize = 0

            let onResult = size => {
                maxSize = Math.min(size, maxSize)

                resultCount += 1

                if (resultCount === textNodes.length) {
                    callback(maxSize)
                }
            }

            for (let i = 0; i < textNode.length; i++) {
                let node = getValidTextNode(textNode[i])

                if (node && node.text) {
                    if (node.size > maxSize) {
                        maxSize = node.size

                        for (let j = i - 1; j >= 0; j--) {
                            textNodes[j].size = maxSize
                        }
                    }

                    node.callback = onResult

                    textNodes.push(node)

                    textSizeQueue.push(node)
                }
            }
            maxSize = Infinity

            if (textNodes.length === 0) {
                callback(Infinity)

                return false
            }

            if (!running) {
                running = true
                document.body.appendChild(testContainer)

                body.onFrame.end(writeTests)
            }
        } else {
            textNode = getValidTextNode(textNode)

            if (!textNode || !textNode.text) {
                callback(Infinity)

                return false
            }

            textNode.callback = callback

            textSizeQueue.push(textNode)

            if (!running) {
                running = true
                document.body.appendChild(testContainer)

                body.onFrame.end(writeTests)
            }
        }
    }

    exports.Display.getMaxTextSize = getMaxTextSize
}

//Special items + methods
{
    loadCSS('special.css')

    class PlaylistItem extends Item {
        /*
        A block, for a whole item in the playlist.

        Constructor data:
            title (String): Shown at top of item (if the item has only one section, or if title is empty, will not be shown)
            showSectionWhenMinimized: If true, will display the first section when the item is minimized. True by default.
            items (Array: PlaylistItemSection): Sections added to item
        
        Properties:
            previewHeight (get/set) (number): Preview height in pixels.
            title (get/set) (String): Title shown at top of item
            active (get/set) (boolean): If the item is currently active
            editActive (set) (boolean)
            dragActive (set) (boolean)
            selected (get/set) (boolean)
            errors (get/set) (Array)
            sections (get/set) (Array)
        
        Methods:
            add (section: PlaylistItemSection, index?: number): Adds the provided section to the item. If an index is provided, it is inserted at that position, otherwise at the end
            remove (item: PlaylistItemSection / index: number): Removes the specified section from the item.
            indexOf (item: PlaylistItemSection): Returns the index of the specified section in the items list of sections
            expand
            minimize
        
        Events:
            drag-click
            edit-click
            remove-click
            active-click (index: number)
        */
        constructor(data = {}, styles = {}) {
            super(document.createElement('div'), styles)

            this.addClass('playlistItem')

            //buttons & other items
            {
                this.dragButton = new exports.Button(
                    {
                        icon: 'move-y'
                    },
                    {
                        align: 'stretch',
                        class: 'highlight'
                    }
                )
                this.editButton = new exports.Button(
                    {
                        icon: 'edit'
                    },
                    {
                        align: 'stretch',
                        class: 'highlight'
                    }
                )
                this.toggleButton = new exports.Button({
                    icon: 'expand-y'
                })
                this.itemsBlock = new exports.Block(
                    {},
                    {
                        direction: 'vertical'
                    }
                )
                this.removeButton = new exports.Button(
                    {
                        icon: 'remove'
                    },
                    {
                        align: 'stretch',
                        class: 'highlight'
                    }
                )

                this.titleNode = document.createElement('div')
                this.titleNode.className = 'title'

                this.node.appendChild(this.dragButton.node)
                this.node.appendChild(this.editButton.node)
                {
                    let block = document.createElement('div')
                    block.className = 'content'

                    let topBlock = document.createElement('div')
                    topBlock.className = 'bar'
                    topBlock.appendChild(this.toggleButton.node)
                    topBlock.appendChild(this.titleNode)

                    block.appendChild(topBlock)
                    block.appendChild(this.itemsBlock.node)

                    this.node.appendChild(block)
                }
                this.node.appendChild(this.removeButton.node)

                this.events['drag-click'] = []
                this.events['edit-click'] = []
                this.events['remove-click'] = []

                this.dragButton.node.addEventListener(
                    'mousedown',
                    passEventTo.bind(this, this.events['drag-click'], {
                        fromUser: true,
                        from: this
                    })
                )
                this.editButton.onEvent(
                    'click',
                    passEventTo.bind(this, this.events['edit-click'], {
                        fromUser: true,
                        from: this
                    })
                )
                this.removeButton.onEvent(
                    'click',
                    passEventTo.bind(this, this.events['remove-click'], {
                        fromUser: true,
                        from: this
                    })
                )

                this.toggleButton.onEvent('click', () => {
                    if (this.properties.minimized) {
                        this.expand()
                    } else {
                        this.minimize()
                    }
                })

                this.titleNode.addEventListener('click', () => {
                    sendEventTo(
                        {
                            index: 0,

                            fromUser: true,
                            from: this
                        },
                        this.events['select-click']
                    )
                })

                let titleMouseDown = false
                this.titleNode.addEventListener('mousedown', () => {
                    titleMouseDown = true
                })
                this.titleNode.addEventListener('mouseout', () => {
                    if (titleMouseDown) {
                        sendEventTo(
                            {
                                fromUser: true,
                                from: this
                            },
                            this.events['drag-click']
                        )
                    }
                })
                body.onEvent('mouseup', () => {
                    titleMouseDown = false
                })
                body.onEvent('blur', () => {
                    titleMouseDown = false
                })
            }

            this.properties = {
                previewHeight: 80,

                title: '',

                editing: false,

                dragging: false,

                active: false,
                selected: false,
                disabled: false,

                errors: false,

                minimized: false
            }
            this.needsChange = {
                title: false,

                editing: false,
                dragging: false,
                active: false,
                selected: false,
                disabled: false,

                errors: false,

                minimized: false,

                sectionCount: false
            }

            this.items = []

            this._disabled = false

            bindFunctions(
                this,
                this.onResize,
                this.writeContent,
                this.onItemSelectClick,
                this.onItemActiveClick
            )

            this.title = data.title
            this.sections = data.sections

            if (typeof data.disabled === true) {
                this.disabled = data.disabled
            }

            this._showSectionWhenMinimized = true
            if (typeof data.showSectionWhenMinimized === 'boolean') {
                this._showSectionWhenMinimized = data.showSectionWhenMinimized
            }

            currentDisplay.onEvent('change', () => {
                if (this.minimized) {
                    this.minimize()
                }
            })
        }

        get previewHeight() {
            return this.properties.previewHeight
        }
        set previewHeight(height) {
            if (
                typeof height !== 'number' ||
                height <= 0 ||
                !isFinite(height)
            ) {
                return false
            }

            this.properties.previewHeight = height
            for (let i = 0; i < this.items.length; i++) {
                this.items[i].height = this.properties.previewHeight
            }
        }

        get title() {
            return this.properties.title
        }
        set title(title) {
            if (typeof title === 'string') {
                this.properties.title = title

                this.needsChange.title = true
                body.onFrame.end(this.writeContent)
            }
        }

        set showSectionWhenMinimized(value) {
            this._showSectionWhenMinimized = !!value

            if (this.properties.minimized) {
                this.minimize()
            }
        }

        set editActive(active) {
            this.properties.editing = active

            this.needsChange.editing = true
            body.onFrame.end(this.writeContent)
        }
        set dragActive(active) {
            this.properties.dragging = active

            this.needsChange.dragging = true
            body.onFrame.end(this.writeContent)
        }

        get active() {
            return this.properties.active
        }
        set active(active) {
            if (typeof active === 'boolean') {
                this.properties.active = active

                if (active) {
                    this.expand()
                } else {
                    for (let i = 0; i < this.items.length; i++) {
                        this.items[i].active = false
                    }
                }

                this.needsChange.active = true
                body.onFrame.end(this.writeContent)
            }
        }

        get selected() {
            return this.properties.selected
        }
        set selected(selected) {
            if (typeof selected === 'boolean') {
                this.properties.selected = selected

                if (!selected) {
                    for (let i = 0; i < this.items.length; i++) {
                        this.items[i].selected = false
                    }
                }

                this.needsChange.selected = true
                body.onFrame.end(this.writeContent)
            }
        }

        get disabled() {
            return this.properties.disabled
        }
        set disabled(disabled) {
            if (disabled == this.properties.disabled) {
                return this.properties.disabled
            }

            this.properties.disabled = disabled

            this.needsChange.disabled = true
            body.onFrame.end(this.writeContent)
        }

        get errors() {}
        set errors(errors = []) {
            this.properties.errors = errors

            for (let i = 0; i < this.items.length; i++) {
                this.items[i].error = errors.includes(i)
            }

            this.needsChange.errors = true
            body.onFrame.end(this.writeContent)
        }

        get sections() {
            return this.items
        }
        set sections(sections) {
            if (!Array.isArray(sections)) {
                return false
            }

            for (let i = 0; i < sections.length && i < this.items.length; i++) {
                this.items[i].title = sections[i].title || ''
                this.items[i].content = sections[i].content || ''
                this.items[i].display = sections[i].display || {}
            }

            if (sections.length > this.items.length) {
                for (let i = this.items.length; i < sections.length; i++) {
                    this.add(sections[i])
                }
            } else if (sections.length < this.items.length) {
                this.items.splice(sections.length, this.items.length)

                this.needsChange.sectionCount = true
                body.onFrame.end(this.writeContent)
            }
        }

        get minimized() {
            return this.properties.minimized
        }

        onResize() {
            for (let i = 0; i < this.items.length; i++) {
                this.items[i].onResize()
            }
        }

        onItemSelectClick(event) {
            sendEventTo(
                {
                    index: this.indexOf(event.from),

                    fromUser: true,
                    from: this
                },
                this.events['select-click']
            )
        }

        onItemActiveClick(event) {
            sendEventTo(
                {
                    index: this.indexOf(event.from),

                    fromUser: true,
                    from: this
                },
                this.events['active-click']
            )
        }

        add(data, index = -1) {
            if (!editor.util.isObj(data)) {
                return false
            }

            let item = new PlaylistItemSection()

            item.height = this.properties.previewHeight
            item.parent = this

            this.items.push(item)

            if (index >= 0 && index < this.items.length - 1) {
                for (let i = this.items.length - 1; i > index; i--) {
                    this.items[i].title = this.items[i - 1].title
                    this.items[i].content = this.items[i - 1].content
                    this.items[i].display = this.items[i - 1].display
                }

                this.items[index].title = data.title
                this.items[index].content = data.content
                this.items[index].display = data.display
            } else {
                this.items[this.items.length - 1].title = data.title
                this.items[this.items.length - 1].content = data.content
                this.items[this.items.length - 1].display = data.display
            }

            this.needsChange.sectionCount = true

            item.onEvent('select-click', this.onItemSelectClick)

            item.onEvent('active-click', this.onItemActiveClick)

            item.onEvent('selected', () => {
                if (this.indexOf(item) !== 0) {
                    this.expand()
                }
            })

            body.onFrame.end(this.writeContent)
        }

        indexOf(item) {
            return this.items.indexOf(item)
        }

        remove(itemOrIndex) {
            if (itemOrIndex instanceof PlaylistItemSection) {
                itemOrIndex = this.indexOf(itemOrIndex)
            }

            if (itemOrIndex >= 0 && itemOrIndex < this.items.length) {
                //If it's the last item, it can simply be remove without changing anything
                if (itemOrIndex !== this.items.length - 1) {
                    //But if it's not the last item,
                    //Then it, and every item after it, needs to be updated to contain the item after it

                    for (let i = itemOrIndex; i < this.items.length - 1; i++) {
                        this.items[i].title = this.items[i + 1].title
                        this.items[i].content = this.items[i + 1].content
                        this.items[i].display = this.items[i + 1].display
                    }
                }

                this.items.pop()

                this.needsChange.sectionCount = true

                body.onFrame.end(this.writeContent)
            }
        }

        expand() {
            this.properties.minimized = false

            this.needsChange.minimized = true
            body.onFrame.end(this.writeContent)
        }
        minimize() {
            this.properties.minimized = true

            this.needsChange.minimized = true
            body.onFrame.end(this.writeContent)
        }

        writeContent() {
            if (this.needsChange.title) {
                this.titleNode.textContent = this.properties.title

                this.needsChange.title = false
            }

            if (this.needsChange.editing) {
                //TODO: Move class adding/removing to onFrame call
                this.editButton.active = this.properties.editing

                this.needsChange.editing = false
            }
            if (this.needsChange.dragging) {
                this.dragButton.active = this.properties.dragging

                this.needsChange.dragging = false
            }

            if (this.needsChange.active) {
                this.toggleButton.active = this.properties.active

                if (this.properties.active) {
                    this.node.classList.add('active')
                    this.toggleButton.node.classList.add('highlight')
                } else {
                    this.node.classList.remove('active')
                    this.toggleButton.node.classList.remove('highlight')
                }

                this.needsChange.active = false
            }

            if (this.needsChange.selected) {
                if (this.properties.selected) {
                    this.node.classList.add('selected')
                } else {
                    this.node.classList.remove('selected')
                }

                this.needsChange.selected = false
            }

            if (this.needsChange.disabled) {
                this.editButton.disabled = this.properties.disabled

                this.needsChange.disabled = false
            }

            if (this.needsChange.errors) {
                if (this.properties.errors.length === 0) {
                    this.node.classList.remove('error')
                } else {
                    this.node.classList.add('error')
                }

                this.needsChange.errors = false
            }

            if (this.needsChange.minimized) {
                this.toggleButton.active = this.properties.active

                if (this.properties.active) {
                    this.toggleButton.node.classList.add('highlight')
                } else {
                    this.toggleButton.node.classList.remove('highlight')
                }

                if (this.properties.minimized) {
                    if (
                        this._showSectionWhenMinimized &&
                        this.items.length >= 1
                    ) {
                        //Minimized, showing first section
                        this.itemsBlock.node.style.height =
                            this.properties.previewHeight.toString() + 'px'

                        this.toggleButton.icon = 'expand-x'
                    } else if (this.items.length >= 1) {
                        //Minimized, not showing first section
                        this.itemsBlock.node.style.height = '0px'

                        this.toggleButton.icon = 'expand-x'
                    } else {
                        //Not minimized
                        this.itemsBlock.node.style.height = ''

                        this.toggleButton.icon = 'expand-y'

                        this.properties.minimized = false
                    }
                } else {
                    //Not minimized
                    this.itemsBlock.node.style.height = ''

                    this.toggleButton.icon = 'expand-y'
                }

                this.needsChange.minimized = false

                if (this.parent && this.parent.checkResize) {
                    this.parent.checkResize()
                }
            }

            if (this.needsChange.sectionCount) {
                //Remove all extra items
                for (
                    let i = this.itemsBlock.items.length - 1;
                    i >= this.items.length;
                    i--
                ) {
                    this.itemsBlock.remove(i)
                }

                //Add any new items
                for (
                    let i = this.itemsBlock.items.length;
                    i < this.items.length;
                    i++
                ) {
                    this.itemsBlock.add(this.items[i])
                }

                if (this.items.length > 1) {
                    this.toggleButton.node.style.display = ''
                } else {
                    this.toggleButton.node.style.display = 'none'

                    if (this.properties.minimized) {
                        this.itemsBlock.node.style.height = ''

                        this.toggleButton.icon = 'expand-y'

                        this.properties.minimized = false
                    }
                }

                this.needsChange.sectionCount = false

                if (this.parent && this.parent.checkResize) {
                    this.parent.checkResize()
                }
            }
        }
    }
    exports.PlaylistItem = items.PlaylistItem = PlaylistItem

    class PlaylistItemSection extends Item {
        /*
        A section (individual slide) to use in a playlist item block.

        Constructor data:
            display (Display Object): Shown in display, returned by .display
            title (String): Shown at top of info section
            content (String): Shown in info section
        
        Properties:
            height (get/set) (number): Display preview height in pixels.
            display (get/set) (Display Object): What the section shows.
            active (get/set) (boolean): If the section is currently active (being displayed). If true: select button is highlighted.
            error (get/set) (boolean): If true, displayed with red background.
            selected (get/set) (boolean): If the section is currently selected by the user
            title (get/set) (String): The title shown at top of info section
            content (get/set) (String): The content shown in info section
        
        Methods:

        Events:
            active-click
        */
        constructor(data = {}, styles = {}) {
            super(document.createElement('div'), styles)

            this.addClass('section')

            //display, play button, and other items
            {
                this.displayItem = new exports.Display(data.display, {
                    height: '80px',
                    width: 'display',
                    shrink: false,
                    grow: false,
                    size: 'auto'
                })

                this.activeButton = new exports.Button(
                    {
                        icon: 'play'
                    },
                    {
                        align: 'stretch',
                        class: 'highlight'
                    }
                )

                this.titleNode = document.createElement('div')
                this.titleNode.className = 'title'
                this.contentNode = document.createElement('div')
                this.contentNode.className = 'content'

                this.node.appendChild(this.displayItem.node)
                this.node.appendChild(this.activeButton.node)

                this.infoNode = document.createElement('div')
                this.infoNode.style.height = '80px'
                this.infoNode.className = 'info'
                this.infoNode.appendChild(this.titleNode)
                this.infoNode.appendChild(this.contentNode)

                this.node.appendChild(this.infoNode)

                this.items = [this.displayItem, this.activeButton]

                this.events['select-click'] = []
                this.events['active-click'] = []

                this.displayItem.onEvent(
                    'click',
                    passEventTo.bind(this, this.events['select-click'], {
                        fromUser: true,
                        from: this
                    })
                )
                this.infoNode.addEventListener(
                    'click',
                    passEventTo.bind(this, this.events['select-click'], {
                        fromUser: true,
                        from: this
                    })
                )

                this.activeButton.onEvent(
                    'click',
                    passEventTo.bind(this, this.events['active-click'], {
                        fromUser: true,
                        from: this
                    })
                )
            }

            this.properties = {
                height: 0,

                title: '',
                content: '',

                active: false,
                selected: false,

                error: false
            }
            this.needsChange = {
                height: false,

                title: false,
                content: false,
                active: false,
                selected: false,
                error: false
            }

            bindFunctions(this, this.writeContent)

            this.title = data.title
            this.content = data.content

            this._display = data.display || {}

            this.onResize = this.displayItem.onResize.bind(this.displayItem)

            this.parent = null
        }

        get height() {
            return this.properties.height
        }
        set height(height) {
            if (isFinite(height) && height > 0) {
                this.properties.height = height

                this.needsChange.height = true
                body.onFrame.end(this.writeContent)
            }
        }

        get display() {
            //TODO: use proper display class property
            return this._display
        }
        set display(data) {
            this._display = data
            this.displayItem.set(this._display)
        }

        get active() {
            return this.properties.active
        }
        set active(active) {
            if (typeof active === 'boolean') {
                this.properties.active = active

                this.needsChange.active = true

                body.onFrame.end(this.writeContent)
            }
        }

        get selected() {
            return this.properties.selected
        }
        set selected(selected) {
            if (typeof selected === 'boolean') {
                this.properties.selected = selected

                if (selected) {
                    sendEventTo(
                        { fromUser: false, from: this },
                        this.events.selected
                    )
                }

                this.needsChange.selected = true
                body.onFrame.end(this.writeContent)
            }
        }

        get error() {
            return this.properties.error
        }
        set error(error = false) {
            if (typeof error === 'boolean') {
                this.properties.error = error

                this.needsChange.error = true
                body.onFrame.end(this.writeContent)
            }
        }

        get title() {
            return this.properties.title
        }
        set title(title) {
            if (typeof title === 'string') {
                this.properties.title = title

                this.needsChange.title = true
                body.onFrame.end(this.writeContent)
            }
        }

        get content() {
            return this.properties.content
        }
        set content(content) {
            if (typeof content === 'string') {
                this.properties.content = content

                this.needsChange.content = true
                body.onFrame.end(this.writeContent)
            }
        }

        writeContent() {
            if (this.needsChange.height) {
                addStyles(this.displayItem, {
                    height: this.properties.height
                })
                this.infoNode.style.height = this.properties.height

                this.needsChange.height = false
            }

            if (this.needsChange.title) {
                this.titleNode.textContent = this.properties.title

                this.needsChange.title = false
            }

            if (this.needsChange.content) {
                this.contentNode.textContent = this.properties.content

                this.needsChange.content = false
            }

            if (this.needsChange.active) {
                if (this.properties.active) {
                    this.node.classList.add('active')
                } else {
                    this.node.classList.remove('active')
                }

                this.activeButton.active = this.properties.active

                this.needsChange.active = false
            }

            if (this.needsChange.selected) {
                if (this.properties.selected) {
                    this.node.classList.add('selected')
                } else {
                    this.node.classList.remove('selected')
                }

                this.needsChange.selected = false
            }

            if (this.needsChange.error) {
                if (this.properties.error) {
                    this.node.classList.add('error')
                } else {
                    this.node.classList.remove('error')
                }

                this.needsChange.error = false
            }
        }
    }
    exports.playlistItemSection = items.PlaylistItemSection = PlaylistItemSection

    exports.showLoader = (item, text = 'Loading', animate = true) => {
        if (!validItem(item)) {
            return false
        }

        item.node.style.position = 'relative'

        if (typeof text === 'boolean') {
            animate = text
        }

        if (typeof text !== 'string' || text.trim().length === 0) {
            text = 'Loading'
        }

        if (
            item.node.childElementCount === 0 ||
            item.node.lastChild.className !== 'loader'
        ) {
            item.node.appendChild(document.createElement('div'))
            item.node.lastChild.className = 'loader'

            item.node.lastChild.appendChild(document.createElement('div'))

            item.node.lastChild.lastChild.appendChild(
                document.createElement('span')
            )
            item.node.lastChild.lastChild.lastChild.textContent = text

            if (animate) {
                item.node.lastChild.lastChild.className = 'animate'
            }
        }
    }
    exports.hideLoader = item => {
        if (!validItem(item) || item.node.childElementCount === 0) {
            return false
        }

        if (item.node.lastChild.className === 'loader') {
            item.node.removeChild(item.node.lastChild)
        }
    }

    class Timer extends Item {
        /*
        A timer bar.

        Constructor data:
            text (string)
            disabled (boolean)
            value (number)
        
        Properties:
            disabled (get/set) (boolean)
            text (get/set) (string)
            value (get/set) (number)
        
        Methods:
            animate (time: number): Shows the bar filling, for the given amount of time.
        
        Events:
            N/A
        */
        constructor(data = {}, styles = {}) {
            super(document.createElement('div'), styles)

            this.addClass('timer')

            this.barNode = document.createElement('div')
            this.barNode.className = 'bar'

            this.node.appendChild(this.barNode)

            this.textNode = document.createElement('span')
            this.textNode.className = 'text'

            this.node.appendChild(this.textNode)

            this.text = data.text
            this.disabled = data.disabled
            this.value = data.value
        }

        get disabled() {
            return this.node.classList.contains('disabled')
        }

        set disabled(disabled) {
            if (disabled) {
                this.node.classList.add('disabled')
            } else {
                this.node.classList.remove('disabled')
            }
        }

        get text() {
            return this.textNode.textContent
        }
        set text(text = '') {
            if (typeof text === 'string') {
                this.textNode.textContent = text
            }
        }

        get value() {
            return 0
        }
        set value(value = 0) {
            this.barNode.style.transition = ''
            this.barNode.style.width = value + '%'
        }

        animate(time) {
            if (typeof time !== 'number') {
                return false
            }

            requestAnimationFrame(() => {
                this.barNode.style.transition = ''
                this.barNode.style.width = '0%'

                requestAnimationFrame(() => {
                    this.barNode.style.transition =
                        'width ' + time + 'ms linear'

                    this.barNode.style.width = '100%'
                })
            })
        }
    }
    exports.Timer = items.Timer = Timer
}

//Print item
{
    loadCSS('print.css')

    let fs

    const printSizes = {
        A3: {
            width: 297,
            height: 420
        },
        A4: {
            width: 210,
            height: 297
        },
        A5: {
            width: 148,
            height: 210
        },
        Legal: {
            width: 215.9,
            height: 355.6
        },
        Letter: {
            width: 215.9,
            height: 279.4
        },
        Tabloid: {
            width: 279,
            height: 432
        }
    }

    let printElem = null

    let printStyleNode = document.createElement('style')
    let setPageSize = null
    let setPageLandscape = null
    {
        document.head.appendChild(printStyleNode)

        let printStyleSheet = printStyleNode.sheet
        let landscape = false
        let size = 'A4'

        function updateStyle() {
            while (printStyleSheet.cssRules.length > 0) {
                printStyleSheet.deleteRule(0)
            }

            printStyleSheet.insertRule(
                '@page { size: ' +
                    size +
                    ' ' +
                    (landscape ? 'landscape' : 'portrait') +
                    ' }',
                0
            )

            if (landscape === true) {
                printStyleSheet.insertRule(
                    '@media print { html { min-width: ' +
                        printSizes[size].height +
                        'mm } }',
                    1
                )
            } else {
                printStyleSheet.insertRule(
                    '@media print { html { min-width: ' +
                        printSizes[size].width +
                        'mm } }',
                    1
                )
            }
        }

        setPageLandscape = function(newLandscape) {
            if (landscape !== !!newLandscape) {
                landscape = !!newLandscape

                updateStyle()
            }
        }

        setPageSize = function(newSize) {
            if (printSizes.hasOwnProperty(newSize)) {
                size = newSize

                updateStyle()
            }
        }

        setPageLandscape('portrait')
    }

    class PrintPreview extends Item {
        /*
        A printing interface, which displays a preview.
        Text can be added, and the result page layout modified & printed.

        Constructor data:
            n/a
        
        Properties:
            size (get/set) (string): Page size to use. Valid options are 'A3', 'A4', 'A5', 'Legal', 'Letter', & 'Tabloid'.
            orientation (get/set) (string): Page orientation. Valid options are 'portrait' & 'landscape'.
            columns (get/set) (number): Number of columns which text is displayed in.
            margin (get/set) (number): Page margins.
            font (get/set) (string): Text font.
            fontSize (get/set) (number): Text size.
        
        Methods:
            clear: Removes all page content.
            addText ({type: string, text: string}): Adds the given text content.
            set (Array: {type: string, text: string}): Removes any existing content, and adds given list of content.
            print: Starts the user printing process.
            save: Starts the user save as pdf process.
        */
        constructor(data = {}, styles = {}) {
            super(document.createElement('div'), styles)

            if (!fs) {
                fs = require('fs')
            }

            this.addClass('printPreview')
            this.node.id = getUniqueId('print')

            //controls
            {
                this.controlNode = document.createElement('div')
                this.controlNode.className = 'controls'

                this.sizeControl = new exports.SelectInput(
                    {
                        tooltip: 'Page Size',
                        label: 'Size',
                        options: [
                            'A3',
                            'A4',
                            'A5',
                            'Legal',
                            'Letter',
                            'Tabloid'
                        ],
                        value: 'A4'
                    },
                    {
                        width: '7ch',
                        margin: 4
                    }
                )
                this.controlNode.appendChild(this.sizeControl.node)

                this.landscapeControl = new exports.CheckboxInput(
                    {
                        tooltip: 'Landscape Orientation',
                        label: 'Landscape',
                        value: false
                    },
                    {
                        margin: 4,

                        align: 'end'
                    }
                )
                this.controlNode.appendChild(this.landscapeControl.node)

                this.marginControl = new exports.NumberInput(
                    {
                        placeholder: 'Margin',
                        tooltip: 'Page Margin',
                        label: 'Margin',
                        unit: 'cm',

                        min: 0,
                        max: 100,
                        step: 0.1,
                        precision: 2,

                        popupMax: 5,

                        value: 1
                    },
                    {
                        width: '6ch',
                        margin: 4
                    }
                )
                this.controlNode.appendChild(this.marginControl.node)

                this.columnControl = new exports.NumberInput(
                    {
                        placeholder: 'Columns',
                        tooltip: 'Page Columns',
                        label: 'Columns',

                        min: 1,
                        max: 10,
                        step: 1,
                        precision: 0,

                        popupMax: 4,

                        value: 1
                    },
                    {
                        width: '6ch',
                        margin: 4
                    }
                )
                this.controlNode.appendChild(this.columnControl.node)

                this.viewNode = document.createElement('div')
                this.viewNode.className = 'view'

                this.zoomControl = new exports.NumberInput(
                    {
                        placeholder: 'zoom',
                        tooltip: 'Preview Zoom',
                        label: 'Zoom',
                        unit: '%',
                        min: 1,
                        max: 500,
                        step: 1,

                        precision: 1,

                        popupMin: 20,
                        popupMax: 200,

                        value: 100
                    },
                    {
                        width: '6ch',
                        margin: 4
                    }
                )
                this.viewNode.appendChild(this.zoomControl.node)

                this.zoomFit = new exports.Button(
                    {
                        text: 'Fit'
                    },
                    {
                        align: 'end',
                        margin: 4,

                        marginLeft: 0
                    }
                )
                this.zoomFull = new exports.Button(
                    {
                        text: 'Full'
                    },
                    {
                        align: 'end',
                        margin: 4,

                        marginLeft: 0
                    }
                )
                this.viewNode.appendChild(this.zoomFit.node)
                this.viewNode.appendChild(this.zoomFull.node)

                this.controlNode.appendChild(this.viewNode)

                this.node.appendChild(this.controlNode)

                this.sizeControl.onEvent('change', event => {
                    if (event.fromUser) {
                        this.setSize(event.value, event.fromUser)
                    }
                })
                this.landscapeControl.onEvent('change', event => {
                    if (event.fromUser) {
                        this.setLandscape(event.value, event.fromUser)
                    }
                })
                this.marginControl.onEvent('change', event => {
                    if (event.fromUser) {
                        this.setMargin(event.value, event.fromUser)
                    }
                })
                this.columnControl.onEvent('change', event => {
                    if (event.fromUser) {
                        this.setColumns(event.value, event.fromUser)
                    }
                })

                this.zoomControl.onEvent('change', event => {
                    if (event.fromUser) {
                        this.zoom = event.value / 100
                    }
                })

                this.zoomFit.onEvent('click', event => {
                    this._oldWidth = 0
                    this.onResize()
                })
                this.zoomFull.onEvent('click', event => {
                    this.zoom = 1
                })
                this.zoomFull.onEvent('contextmenu', event => {
                    if (event.ctrlKey && event.shiftKey && event.altKey) {
                        this.setupTest()
                    }
                })
            }

            //Page nodes
            {
                this.scrollNode = document.createElement('div')
                this.scrollNode.className = 'scroll'

                this.node.appendChild(this.scrollNode)

                this.pagesNode = document.createElement('div')
                this.pagesNode.className = 'pages'

                this.scrollNode.appendChild(this.pagesNode)

                this.scrollNode.addEventListener('wheel', event => {
                    if (event.ctrlKey && event.deltaY !== 0) {
                        if (event.deltaY > 1) {
                            this.zoom *= 1.1
                        } else {
                            this.zoom *= 0.9
                        }
                    }
                })

                let mouseDown = false

                this.scrollNode.addEventListener('mousedown', event => {
                    if (event.button === 0) {
                        mouseDown = true
                    }
                })
                body.onEvent('mouseup', () => {
                    mouseDown = false
                })
                body.onEvent('blur', () => {
                    mouseDown = false
                })

                body.onEvent('mousemove', event => {
                    if (mouseDown) {
                        this.scrollNode.scrollLeft -= event.movementX
                        this.scrollNode.scrollTop -= event.movementY
                    }
                })
            }

            this.pageNodes = []

            this.contentNodes = []

            this._options = {
                size: 'A4',
                landscape: false,

                margin: 1,
                columns: 1,

                font: '',
                fontSize: 12,

                print: {
                    width: printSizes.A4.width,
                    height: printSizes.A4.height
                },

                zoom: 1
            }

            this._oldWidth = 0
            this._width = 0

            if (typeof data.size === 'string') {
                this.setSize(data.size)
            }
            if (typeof data.landscape === 'boolean') {
                this.setLandscape(data.landscape)
            }
            if (typeof data.margin === 'number') {
                this.setMargin(data.margin)
            }
            if (typeof data.columns === 'number') {
                this.setColumns(data.columns)
            }

            if (printElem === null) {
                printElem = document.createElement('div')
                printElem.className = 'printElement'
                document.body.appendChild(printElem)
            }

            bindFunctions(
                this,
                this.onResize,
                this.readSize,
                this.writeSize,
                this.writePageLayout,
                this.updateContentLayout,
                this.offsetScroll
            )
        }

        get zoom() {
            return this._options.zoom
        }
        set zoom(zoom) {
            if (isFinite(zoom)) {
                zoom = Math.max(Math.min(zoom, 5), 0.01)

                this.scrollOffset += 1 - this._options.zoom / zoom

                this._options.zoom = zoom

                if (
                    round(this.zoomControl.value, 2) !==
                    round(this._options.zoom * 100, 2)
                ) {
                    this.zoomControl.value = round(this._options.zoom * 100, 2)
                }

                body.onFrame.end(this.offsetScroll)

                this.writeSize()
            }
        }

        offsetScroll() {
            this.scrollNode.scrollLeft +=
                (this.scrollOffset * this.scrollNode.scrollWidth) / 2
            this.scrollOffset = 0
        }

        get size() {
            return this._options.size
        }
        set size(size) {
            return this.setSize(size)
        }
        setSize(size, fromUser = false) {
            if (
                printSizes.hasOwnProperty(size) &&
                size !== this._options.size
            ) {
                this._options.size = size

                if (this._options.landscape) {
                    this._options.print.width = printSizes[size].height
                    this._options.print.height = printSizes[size].width
                } else {
                    this._options.print.width = printSizes[size].width
                    this._options.print.height = printSizes[size].height
                }

                this.sizeControl.value = size

                body.onFrame.end(this.writePageLayout)

                sendEventTo(
                    {
                        size: size,

                        fromUser: fromUser,
                        from: this
                    },
                    this.events.change
                )
            }
        }

        get landscape() {
            return this._options.landscape
        }
        set landscape(landscape) {
            return this.setLandscape(landscape)
        }
        setLandscape(landscape, fromUser = false) {
            //convert to boolean
            landscape = !!landscape

            if (landscape !== this._options.landscape) {
                this._options.landscape = landscape

                if (this.landscapeControl.value !== landscape) {
                    this.landscapeControl.value = landscape
                }

                if (this._options.landscape) {
                    this._options.print.width =
                        printSizes[this._options.size].height
                    this._options.print.height =
                        printSizes[this._options.size].width
                } else {
                    this._options.print.width =
                        printSizes[this._options.size].width
                    this._options.print.height =
                        printSizes[this._options.size].height
                }

                body.onFrame.end(this.writePageLayout)

                sendEventTo(
                    {
                        landscape: landscape,

                        fromUser: fromUser,
                        from: this
                    },
                    this.events.change
                )
            }
        }

        get margin() {
            return this._options.margin
        }
        set margin(margin) {
            return this.setMargin(margin)
        }
        setMargin(margin, fromUser = false) {
            if (
                isFinite(margin) &&
                margin >= 0 &&
                margin !== this._options.margin
            ) {
                this._options.margin = margin

                if (
                    round(this.marginControl.value, 2) !==
                    round(this._options.margin, 2)
                ) {
                    this.marginControl.value = round(this._options.margin, 2)
                }

                this.writePageLayout()

                sendEventTo(
                    {
                        margin: margin,

                        fromUser: fromUser,
                        from: this
                    },
                    this.events.change
                )
            }
        }

        get columns() {
            return this._options.columns
        }
        set columns(columns) {
            return this.setColumns(columns)
        }
        setColumns(columns, fromUser = false) {
            if (
                isFinite(columns) &&
                columns > 0 &&
                round(columns, 0) !== this._options.columns
            ) {
                this._options.columns = Math.min(round(columns, 0), 10)

                if (this.columnControl.value !== this._options.columns) {
                    this.columnControl.value = this._options.columns
                }

                this.writePageLayout()

                sendEventTo(
                    {
                        columns: columns,

                        fromUser: fromUser,
                        from: this
                    },
                    this.events.change
                )
            }
        }

        get font() {
            return this._options.font
        }
        set font(font) {
            if (fonts.isFont(font)) {
                this._options.font = font

                this.pagesNode.style.fontFamily = font

                this.updateContentLayout()
            } else if (!fonts.loaded) {
                //fonts.onEvent('update')
            }
        }

        get fontSize() {
            return this.options.fontSize
        }
        set fontSize(fontSize) {
            if (
                typeof fontSize === 'number' &&
                isFinite(fontSize) &&
                fontSize > 0
            ) {
                this._options.fontSize = fontSize
                this.pagesNode.style.fontSize = fontSize + 'pt'

                this.updateContentLayout()
            }
        }

        updateContentLayout() {
            if (this.contentNodes.length === 0) {
                return false
            }

            if (this.pageNodes.length === 0) {
                this._addPage()
            }

            this.pageNodes[0].innerHTML = ''

            let pageIndex = 0

            for (let i = 0; i < this.contentNodes.length; i++) {
                let height = this.pageNodes[pageIndex].offsetHeight

                this.pageNodes[pageIndex].appendChild(this.contentNodes[i])

                if (this.pageNodes[pageIndex].offsetHeight > height) {
                    pageIndex += 1

                    if (pageIndex === this.pageNodes.length) {
                        this._addPage()
                    }

                    this.pageNodes[pageIndex].innerHTML = ''

                    this.pageNodes[pageIndex].appendChild(this.contentNodes[i])
                }
            }

            //Remove all excess pages
            for (let i = this.pageNodes.length - 1; i > pageIndex; i--) {
                this.pagesNode.removeChild(this.pageNodes.pop().parentNode)
            }
        }

        readSize() {
            //8px for scrollbar, 20px for padding around page
            this._width = this.scrollNode.offsetWidth - 28

            if (this._oldWidth === 0) {
                if (this.pageNodes.length > 0) {
                    this.zoom = Math.min(
                        this._width / this.pageNodes[0].offsetWidth,
                        (this.scrollNode.offsetHeight - 20) /
                            this.pageNodes[0].offsetHeight
                    )

                    this._oldWidth = this._width
                }
            } else if (this._width !== this._oldWidth) {
                this.zoom *= this._width / this._oldWidth

                this._oldWidth = this._width
            }
        }
        writePageLayout() {
            for (let i = 0; i < this.pageNodes.length; i++) {
                this.pageNodes[i].style.width = this._options.print.width + 'mm'
                this.pageNodes[i].style.minHeight =
                    this._options.print.height + 'mm'

                this.pageNodes[i].style.padding = this._options.margin + 'cm'
                this.pageNodes[i].style.columns = this._options.columns
            }

            body.onFrame.end(this.updateContentLayout)

            body.onFrame.end(this.writeSize)
        }
        writeSize() {
            for (let i = 0; i < this.pageNodes.length; i++) {
                this.pageNodes[i].style.transform =
                    'scale(' + this._options.zoom + ')'

                this.pageNodes[i].parentNode.style.width =
                    this._options.print.width * this._options.zoom + 'mm'
                this.pageNodes[i].parentNode.style.height =
                    this._options.print.height * this._options.zoom + 'mm'
            }
        }

        onResize() {
            body.onFrame.start(this.readSize)
        }

        clear() {
            this.pagesNode.innerHTML = ''
            this.pageNodes = []
            this.contentNodes = []

            this._addPage()
        }

        set(content) {
            if (Array.isArray(content)) {
                this.clear()

                for (let i = 0; i < content.length; i++) {
                    this.addText(content[i])
                }
            }
        }

        addText(data) {
            if (this.pageNodes.length === 0) {
                this._addPage()
            }

            if (
                typeof data === 'object' &&
                data !== null &&
                !Array.isArray(data)
            ) {
                data.type = data.type || ''

                let elem = null

                if (data.type.toLowerCase() === 'header') {
                    elem = document.createElement('h1')
                } else if (data.type.toLowerCase() === 'text') {
                    elem = document.createElement('span')
                } else {
                    elem = document.createElement('p')
                }

                if (
                    data.align === 'left' ||
                    data.align === 'center' ||
                    data.align === 'right'
                ) {
                    elem.style.textAlign = data.align
                }

                if (typeof data.text === 'string') {
                    elem.innerHTML = richText.clean(data.text)
                } else if (typeof data.plainText === 'string') {
                    elem.textContent = data.plainText
                }

                this.contentNodes.push(elem)

                let height = this.pageNodes[this.pageNodes.length - 1]
                    .offsetHeight

                this.pageNodes[this.pageNodes.length - 1].appendChild(elem)

                if (
                    this.pageNodes[this.pageNodes.length - 1].offsetHeight >
                    height
                ) {
                    this._addPage()

                    this.pageNodes[this.pageNodes.length - 1].appendChild(elem)
                }
            }
        }

        _addPage() {
            this.pageNodes.push(document.createElement('div'))
            this.pageNodes[this.pageNodes.length - 1].className = 'page-scale'

            this.pageNodes[this.pageNodes.length - 1].style.width =
                this._options.print.width + 'mm'
            this.pageNodes[this.pageNodes.length - 1].style.minHeight =
                this._options.print.height + 'mm'

            this.pageNodes[this.pageNodes.length - 1].style.padding =
                this._options.margin + 'cm'

            this.pageNodes[
                this.pageNodes.length - 1
            ].style.columns = this._options.columns

            this.pagesNode.appendChild(document.createElement('div'))
            this.pagesNode.lastChild.className = 'page'
            this.pagesNode.lastChild.appendChild(
                this.pageNodes[this.pageNodes.length - 1]
            )

            if (this._oldWidth === 0) {
                body.onFrame.start(this.readSize)
            } else {
                this.pageNodes[this.pageNodes.length - 1].style.transform =
                    'scale(' + this._options.zoom + ')'

                this.pageNodes[
                    this.pageNodes.length - 1
                ].parentNode.style.width =
                    this._options.print.width * this._options.zoom + 'mm'
                this.pageNodes[
                    this.pageNodes.length - 1
                ].parentNode.style.height =
                    this._options.print.height * this._options.zoom + 'mm'
            }
        }

        _updatePrintElem() {
            printElem.innerHTML = ''

            for (let i = 0; i < this.pageNodes.length; i++) {
                printElem.appendChild(document.createElement('div'))
                printElem.lastChild.className = 'page'

                printElem.lastChild.innerHTML = this.pageNodes[i].innerHTML
                printElem.lastChild.style.padding = this._options.margin + 'cm'
                printElem.lastChild.style.columns = this._options.columns
            }

            printElem.style.fontFamily = this._options.font
            printElem.style.fontSize = this._options.fontSize + 'pt'

            setPageSize(this._options.size)
            setPageLandscape(this._options.landscape)
        }

        setupTest() {
            this.clear()

            for (let i = 0; i < 20; i++) {
                let node = document.createElement('div')

                node.style.background =
                    'hsl(' + (i * 36).toString() + ', 90%, 50%)'
                node.style.width = '21mm'
                node.style.height = '21mm'
                node.style.display = 'inline-block'
                node.style.verticalAlign = 'top'

                this.pageNodes[0].appendChild(node)
            }

            this.margin = 0
            this.columns = 0
        }

        print(options = {}) {
            exports.showLoader(body, 'Printing')

            this._updatePrintElem()

            if (this._options.landscape === true) {
                exports.dialog.showMessage({
                    type: 'warning',

                    title: 'Orientation option must be set',
                    message:
                        "To print in Landscape, you must change the \
                    'Orientation' to 'Landscape' in Print Settings",
                    detail:
                        "If orientation isn't set to Landscape, text will be printed incorrectly!"
                })
            }

            requestAnimationFrame(() => {
                /*
                Electron webcontents.print callback does not seem to properly work.
                If the printing suceeds, it will run. But if the user cancels the print, it does not run.
                */
                thisWin.webContents.print({
                    silent: false,
                    printBackground: true
                })

                exports.hideLoader(body)
            })
        }

        save(options = {}, callback = () => {}) {
            exports.showLoader(body, 'Saving')

            this._updatePrintElem()

            requestAnimationFrame(() => {
                thisWin.webContents.printToPDF(
                    {
                        marginsType: 0,
                        pageSize: this._options.size,
                        printBackground: true,
                        printSelectionOnly: false,

                        landscape: this._options.landscape
                    },
                    (error, PDFData) => {
                        if (error) {
                            exports.hideLoader(body)

                            callback(error)
                            return false
                        }

                        exports.dialog.showSave(
                            {
                                title: 'Save PDF',
                                filters: [
                                    {
                                        name: 'PDF',
                                        extensions: ['pdf']
                                    }
                                ]
                            },
                            (error, filename) => {
                                if (error) {
                                    exports.hideLoader(body)
                                    callback(error)

                                    return false
                                }

                                if (!filename) {
                                    exports.hideLoader(body)

                                    callback(null, false)

                                    return false
                                }

                                fs.writeFile(filename, PDFData, error => {
                                    exports.hideLoader(body)

                                    if (error) {
                                        callback(error)
                                        return false
                                    }

                                    callback(null, filename)
                                })
                            }
                        )
                    }
                )
            })
        }
    }
    exports.PrintPreview = items.PrintPreview = PrintPreview
    itemStylesMap.PrintPreview = {
        padding: () => {
            return {
                value: ''
            }
        }
    }
}

//Window methods
{
    const extraSize = {
        width: 20,
        height: 80
    }
    let events = {}
    exports.window = {}

    exports.window.onEvent = function(eventName, listener) {
        if (typeof eventName !== 'string' || typeof listener !== 'function') {
            return false
        }

        if (!Array.isArray(events[eventName])) {
            events[eventName] = []
        }

        if (events[eventName].includes(listener)) {
            return false
        }

        events[eventName].push(listener)
    }

    exports.window.setMinSize = function(size) {
        if (typeof size !== 'object' || size === null) {
            return false
        }
        if (typeof size.width !== 'number' || typeof size.height !== 'number') {
            return false
        }

        size.width += extraSize.width
        size.height += extraSize.height

        thisWin.setMinimumSize(size.width, size.height)

        let actualSize = thisWin.getSize()

        if (actualSize[0] < size.width || actualSize[1] < size.height) {
            thisWin.setSize(
                Math.max(actualSize[0], size.width),
                Math.max(actualSize[1], size.height)
            )
        }
    }

    exports.window.setMaxSize = function(size) {
        if (typeof size !== 'object' || size === null) {
            return false
        }
        if (typeof size.width !== 'number' || typeof size.height !== 'number') {
            return false
        }

        size.width += extraSize.width
        size.height += extraSize.height

        thisWin.setMaximumSize(size.width, size.height)

        let actualSize = thisWin.getSize()

        if (actualSize[0] > size.width || actualSize[1] > size.height) {
            thisWin.setSize(
                Math.min(actualSize[0], size.width),
                Math.min(actualSize[1], size.height)
            )
        }
    }

    exports.window.setSize = function(size) {
        if (typeof size !== 'object' || size === null) {
            return false
        }

        if (typeof size.width === 'number' && typeof size.height === 'number') {
            thisWin.setSize(size.width, size.height)
        }

        exports.window.setMinSize(size.min)
        exports.window.setMaxSize(size.max)
    }

    exports.window.setTitle = function(title) {
        if (typeof title === 'string') {
            thisWin.setTitle(title)
        }
    }

    exports.window.close = function() {
        thisWin.close()
    }

    exports.window.openWindow = function(name, message) {
        ipcRenderer.send('open-window', name, message)
    }

    /*
    For windows to show a confirmation dialog before actually closing, the window needs to be able to prevent itself closing.

    Using "thisWin.on('close', event => {event.preventDefault()})" doesn't work from the renderer process (Possibly a bug).

    Setting event.returnValue in window 'beforeunload' event does work.
    However, that's synchronous, and callback functions might by async.

    To provide the ability to asynchronously cancel the closing, the 'beforeunload' handler does this:

    Cancels the closing (by setting .returnValue to false)
    Calls each 'close' event callback, giving them a 'wait', 'close', 'cancel' and 'confirm' method
    If none of the callbacks have called any of the given functions (after one tick), it will then close
    Closing sets a variable, and then calls thisWin.close()
    When the 'beforeunload' handler is fired, if that variable is set it immediately exits (without cancelling the close) 
    */
    let closing = false

    function forceClose() {
        closing = true

        //Calling .close directly from 'beforeunload' event doesn't work
        //Waiting till next tick seems to fix the issue
        process.nextTick(() => {
            thisWin.close()

            if (thisWin.getParentWindow()) {
                thisWin.getParentWindow().focus()
            }
        })
    }

    //Close event
    window.addEventListener('beforeunload', event => {
        if (closing || !events.close) {
            return undefined
        }

        event.returnValue = false

        let actionTaken = false
        let doNothing = false

        wait = () => {
            doNothing = true

            thisWin.focus()
        }

        close = () => {
            if (actionTaken) {
                return false
            }
            actionTaken = true

            forceClose()
        }

        cancel = () => {
            ipcRenderer.send('close-canceled')
            actionTaken = true
        }

        confirm = text => {
            if (actionTaken) {
                return false
            }
            actionTaken = true

            if (typeof text !== 'string') {
                text = 'Are you sure you want to close this window?'
            }

            exports.dialog.showQuestion(
                {
                    title: 'Close window?',
                    message: text,
                    options: ['Yes', 'No']
                },
                (error, answer) => {
                    if (answer === 'Yes') {
                        forceClose()
                    } else {
                        ipcRenderer.send('close-canceled')
                    }
                }
            )
        }

        for (let i = 0; i < events.close.length; i++) {
            events.close[i]({
                wait: wait,

                close: close,
                cancel: cancel,
                confirm: confirm
            })
        }

        //Wait, and then check if any of the callbacks:
        //Called an action (actionTaken = true)
        //Said they would call an action (doNothing = true)
        process.nextTick(() => {
            if (actionTaken === false && doNothing === false) {
                forceClose()
            }
        })
    })
}

//Dialog methods
{
    exports.dialog = {}

    const notifContain = document.createElement('div')
    notifContain.className = 'notification'
    notifContain.style.top = '-50px'

    const notifBox = document.createElement('div')
    notifBox.className = 'box'

    const notifText = document.createElement('span')
    notifText.className = 'text'

    const notifClose = document.createElement('div')
    notifClose.className = 'icon close'
    notifClose.appendChild(getIconSVG('close'))

    notifContain.appendChild(notifBox)
    notifBox.appendChild(notifText)
    notifBox.appendChild(notifClose)
    document.body.appendChild(notifContain)

    exports.dialog.showOpen = (options, callback) => {
        if (typeof options !== 'object' || options === null) {
            if (typeof callback === 'function') {
                callback(
                    new Error('showOpen was not given valid options object!')
                )
            }
            return false
        }

        let newOptions = {
            title: typeof options.title === 'string' ? options.title : 'Open',
            message: typeof options.message === 'string' ? options.message : '',

            buttonLabel:
                typeof options.button === 'string' ? options.button : 'Open',

            filters: [],
            properties: ['openFile', 'createDirectory']
        }

        if (typeof options.path === 'string') {
            newOptions.defaultPath = options.path
        }
        if (options.multi === true) {
            newOptions.properties.push('multiSelections')
        }
        if (options.showHidden === true) {
            newOptions.properties.push('showHiddenFiles')
        }
        if (options.openFolder === true) {
            newOptions.properties.shift()
            newOptions.properties.push('openDirectory')
        }

        if (Array.isArray(options.filters)) {
            for (let i = 0; i < options.filters.length; i++) {
                if (
                    typeof options.filters[i] === 'object' &&
                    Array.isArray(options.filters[i].extensions)
                ) {
                    newOptions.filters.push({
                        name: options.filters[i].name || '',
                        extensions: options.filters[i].extensions.map(ext => {
                            if (typeof ext !== 'string') return ''

                            return ext.replace('.', '')
                        })
                    })
                }
            }
        }

        if (typeof callback === 'function') {
            dialog.showOpenDialog(thisWin, newOptions, filePaths => {
                if (filePaths) {
                    if (options.multi === true) {
                        callback(null, filePaths)
                    } else {
                        callback(null, filePaths[0])
                    }
                } else {
                    callback(null)
                }
            })
        } else {
            let filePaths = dialog.showOpenDialog(thisWin, newOptions)

            if (options.multi) {
                return filePaths
            } else {
                return filePaths[0]
            }
        }
    }
    exports.dialog.showSave = (options, callback) => {
        if (typeof options !== 'object' || options === null) {
            if (typeof callback === 'function') {
                callback(
                    new Error('showSave was not given valid options object!')
                )
            }
            return false
        }

        let newOptions = {
            title: typeof options.title === 'string' ? options.title : 'Save',
            message: typeof options.message === 'string' ? options.message : '',
            name: typeof options.name === 'string' ? options.name : '',

            buttonLabel:
                typeof options.button === 'string' ? options.button : 'Save',

            filters: []
        }

        if (typeof options.path === 'string') {
            newOptions.defaultPath = options.path
        }

        if (Array.isArray(options.filters)) {
            for (let i = 0; i < options.filters.length; i++) {
                if (
                    typeof options.filters[i] === 'object' &&
                    Array.isArray(options.filters[i].extensions)
                ) {
                    newOptions.filters.push({
                        name: options.filters[i].name || '',
                        extensions: options.filters[i].extensions.map(ext => {
                            if (typeof ext !== 'string') return ''

                            return ext.replace('.', '')
                        })
                    })
                }
            }
        }

        if (typeof callback === 'function') {
            dialog.showSaveDialog(thisWin, newOptions, file => {
                callback(null, file)
                return file
            })
        } else {
            return dialog.showSaveDialog(thisWin, newOptions)
        }
    }

    let hideError = false

    exports.dialog.showQuestion = (options, callback) => {
        if (typeof options !== 'object' || options === null) {
            if (typeof callback === 'function') {
                callback(
                    new Error(
                        'showQuestion was not given valid options object!'
                    )
                )
            }
            return false
        }

        options = {
            type: 'question',

            noLink: true,

            title:
                typeof options.title === 'string' ? options.title : 'Question',
            message:
                typeof options.message === 'string'
                    ? options.message
                    : 'Something needs to be done',
            detail: typeof options.detail === 'string' ? options.detail : '',

            checkboxLabel:
                typeof options.checkbox === 'string'
                    ? options.checkbox
                    : undefined,
            checkboxLabel:
                typeof options.checkboxChecked === 'string'
                    ? options.checkboxChecked
                    : false,

            buttons: options.options
        }

        if (typeof options.checkboxLabel !== 'string') {
            delete options.checkboxLabel
            delete options.checkboxChecked
        }

        if (!Array.isArray(options.buttons)) {
            options.buttons = ['OK', 'Cancel']
        }

        if (options.buttons.length === 0) {
            options.buttons.push('OK')
        }

        if (typeof callback === 'function') {
            dialog.showMessageBox(
                thisWin,
                options,
                (index, checkboxChecked) => {
                    callback(null, options.buttons[index], checkboxChecked)
                }
            )
        } else {
            return options.buttons[dialog.showMessageBox(thisWin, options)]
        }
    }

    exports.dialog.showMessage = (options, callback) => {
        if (typeof options !== 'object' || options === null) {
            if (typeof callback === 'function') {
                callback(
                    new Error('showMessage was not given valid options object!')
                )
            }
            return false
        }

        options = {
            type: 'none',

            noLink: true,

            title:
                typeof options.title === 'string' ? options.title : 'Message',
            message:
                typeof options.message === 'string'
                    ? options.message
                    : 'Something has occurred!',
            detail: typeof options.detail === 'string' ? options.detail : ''
        }

        dialog.showMessageBox(thisWin, options, () => {})
    }

    exports.dialog.showError = (options, callback) => {
        if (hideError) return false

        if (typeof options !== 'object' || options === null) {
            if (typeof callback === 'function') {
                callback(
                    new Error('showError was not given valid options object!')
                )
            }
            return false
        }

        options = {
            type: 'error',

            noLink: true,

            title: typeof options.title === 'string' ? options.title : 'Error',
            message:
                typeof options.message === 'string'
                    ? options.message
                    : 'An error has occurred!',
            detail: typeof options.detail === 'string' ? options.detail : '',

            checkboxLabel: "Don't show more error messages from this window",
            checkboxChecked: false
        }

        dialog.showMessageBox(thisWin, options, (response, checked) => {
            hideError = checked
        })
    }

    let validTypes = ['success', 'warning', 'error']
    let lastAutoCloseTime = 0
    let autoCloseTime = 1000 * 6

    let notificationClickCallback = false

    exports.dialog.showNotification = (options, callback = false) => {
        if (typeof options !== 'object' || options === null) {
            if (typeof callback === 'function') {
                callback(
                    new Error('showError was not given valid options object!')
                )
            }
            return false
        }

        options = {
            type: validTypes.includes(options.type) ? options.type : '',

            message:
                typeof options.message === 'string'
                    ? options.message
                    : 'Something has occurred!',

            autoHide:
                typeof options.autoHide === 'boolean' ? options.autoHide : true
        }

        notifBox.className = 'box ' + options.type
        notifText.textContent = options.message

        notifContain.style.top = '0'

        lastAutoCloseTime = Date.now()

        notificationClickCallback = callback

        if (options.autoHide) {
            setTimeout(() => {
                if (Date.now() - lastAutoCloseTime >= autoCloseTime) {
                    notifContain.style.top =
                        (-notifBox.offsetHeight * 1.5).toString() + 'px'
                }
            }, autoCloseTime + 1)
        }
    }

    notifBox.addEventListener('click', event => {
        if (
            event.target === notifClose ||
            event.target.parentNode === notifClose
        ) {
            return false
        }

        if (typeof notificationClickCallback === 'function') {
            notificationClickCallback()

            notifContain.style.top =
                (-notifBox.offsetHeight * 1.5).toString() + 'px'
        }
    })

    notifClose.addEventListener('click', () => {
        notifContain.style.top =
            (-notifBox.offsetHeight * 1.5).toString() + 'px'
    })
}

//Menu methods
{
    listeners = {}

    exports.menu = {}
    {
        const acceleratorItems = []

        function onMenuItemAccelerator(item) {
            if (item.enabled === false) {
                return false
            }

            let eventName = item.parentItem.toLowerCase()

            if (Array.isArray(listeners[eventName])) {
                for (let i = 0; i < listeners[eventName].length; i++) {
                    listeners[eventName][i](item.message)
                }
            }
        }

        exports.menu.change = function(label, item, state) {
            ipcRenderer.send('change-menu', label, item, state)

            for (let i = 0; i < acceleratorItems.length; i++) {
                if (
                    acceleratorItems[i].parentItem.toLowerCase() ===
                        label.toLowerCase() &&
                    (acceleratorItems[i].message.toLowerCase() ===
                        item.toLowerCase() ||
                        acceleratorItems[i].label === item.toLowerCase())
                ) {
                    objUtil.applyObj(acceleratorItems[i], state)
                }
            }
        }

        exports.menu.onEvent = function(eventName, listener) {
            if (
                typeof eventName !== 'string' ||
                typeof listener !== 'function'
            ) {
                return false
            }

            eventName = eventName.toLowerCase()

            if (!Array.isArray(listeners[eventName])) {
                listeners[eventName] = []
            }

            listeners[eventName].push(listener)
        }

        ipcRenderer.on('menu', (event, eventName, value) => {
            eventName = eventName.toLowerCase()

            if (Array.isArray(listeners[eventName])) {
                for (let i = 0; i < listeners[eventName].length; i++) {
                    listeners[eventName][i](value)
                }
            }
        })

        ipcRenderer.on('register-menu-accelerator', (event, menuItem) => {
            acceleratorItems.push(menuItem)

            keyboard.register(
                menuItem.accelerator,
                onMenuItemAccelerator.bind(null, menuItem)
            )
        })
    }

    exports.contextMenu = {}
    {
        let listeners = {
            click: []
        }

        let contextMenu = new Menu()
        let emptyMenu = Menu.buildFromTemplate([])

        let inputSeparator = new MenuItem({
            global: true,
            input: true,
            type: 'separator'
        })

        let globalSeparator = new MenuItem({
            global: true,
            input: false,
            type: 'separator'
        })

        contextMenu.append(inputSeparator)

        function getObjFromItem(item) {
            return {
                label: item.label,
                sublabel: item.sublabel,
                icon: item.icon,
                enabled: item.enabled,
                checked: item.checked,

                parent: item.parent ? getObjFromItem(item.parent) : null
            }
        }

        function onItemClick(item) {
            let customEvent = getObjFromItem(item)

            customEvent.fromUser = true
            customEvent.from = null

            if (item.global === true) {
                for (let i = 0; i < listeners.click.length; i++) {
                    listeners.click[i](customEvent)
                }
            } else if (
                typeof item.scope === 'string' &&
                Array.isArray(listeners[item.scope])
            ) {
                for (let i = 0; i < listeners[item.scope].length; i++) {
                    listeners[item.scope][i](customEvent)
                }
            }
        }

        function cleanItems(items, options = {}) {
            if (!Array.isArray(items)) {
                return []
            }

            let cleaned = []

            for (let i = 0; i < items.length; i++) {
                if (typeof items[i] === 'object' && items[i] !== null) {
                    if (items[i].hasOwnProperty('submenu')) {
                        items[i].submenu = cleanItems(items[i].submenu, options)
                    }

                    cleaned.push({
                        global: options.global || false,
                        input: options.input || false,
                        scope: options.scope || '',

                        click: onItemClick,
                        role: items[i].role,
                        type: items[i].type,
                        label: items[i].label,
                        sublabel: items[i].sublabel,
                        icon: items[i].icon,
                        enabled: items[i].enabled,
                        checked: items[i].checked,
                        submenu: items[i].submenu
                    })
                }
            }

            return cleaned
        }

        let checks = ['scope', 'label', 'sublabel', 'icon', 'type', 'role']

        function isSame(item, template) {
            for (let i = 0; i < checks.length; i++) {
                if (typeof template[checks[i]] !== 'undefined') {
                    if (item[checks[i]] !== template[checks[i]]) {
                        return false
                    }
                }
            }

            return true
        }

        function makeSame(item, template) {
            if (typeof template.enabled === 'boolean') {
                item.enabled = template.enabled
            }
            if (typeof template.checked === 'boolean') {
                item.checked = template.checked
            }

            if (Array.isArray(template.submenu) && item.submenu !== null) {
                let itemIndex = 0

                for (let i = 0; i < item.submenu.items.length; i++) {
                    item.submenu.items[i].visible = false

                    if (itemIndex < template.submenu.length) {
                        if (
                            isSame(
                                item.submenu.items[i],
                                template.submenu[itemIndex]
                            )
                        ) {
                            item.submenu.items[i].visible = true

                            makeSame(
                                item.submenu.items[i],
                                template.submenu[itemIndex]
                            )
                        }
                    }
                }
            }
        }

        function visibleItems(item) {
            let count = 0

            for (let i = 0; i < item.items.length; i++) {
                if (
                    item.items[i].visible === true &&
                    item.items[i].type !== 'separator'
                ) {
                    if (item.items[i].submenu === null) {
                        count += 1
                    } else {
                        count += visibleItems(item.items[i].submenu)
                    }
                }
            }

            return count
        }

        function addParentProperties(item) {
            if (item.submenu) {
                for (let i = 0; i < item.submenu.items.length; i++) {
                    item.submenu.items[i].parent = item

                    addParentProperties(item.submenu.items[i])
                }
            }
        }

        exports.contextMenu.setGlobal = function(items) {
            if (!Array.isArray(items)) {
                return false
            }
            items = cleanItems(items, { global: true })

            contextMenu = Menu.buildFromTemplate(items)

            contextMenu.insert(0, globalSeparator)
            contextMenu.insert(0, inputSeparator)
        }

        exports.contextMenu.showInput = function(items, rank = 0) {
            if (Array.isArray(items)) {
                items = cleanItems(items, { global: true, input: true })

                if (items.length > 0) {
                    inputSeparator.visible = true

                    let index = 0
                    let itemIndex = 0

                    for (
                        let i = 0;
                        i < contextMenu.items.length &&
                        contextMenu.items[i] !== inputSeparator;
                        i++
                    ) {
                        if (contextMenu.items[i].rank <= rank) {
                            index = i
                        }
                    }

                    for (
                        let i = index;
                        i < contextMenu.items.length &&
                        contextMenu.items[i] !== inputSeparator &&
                        itemIndex < items.length;
                        i++
                    ) {
                        if (isSame(contextMenu.items[i], items[itemIndex])) {
                            contextMenu.items[i].visible = true

                            makeSame(contextMenu.items[i], items[itemIndex])

                            itemIndex += 1
                        }
                    }

                    for (let i = itemIndex; i < items.length; i++) {
                        contextMenu.insert(index, new MenuItem(items[i]))

                        contextMenu.items[index].parent = contextMenu

                        addParentProperties(contextMenu.items[index])

                        index += 1
                    }
                }
            }
        }

        exports.contextMenu.show = function(items, scope) {
            if (Array.isArray(items)) {
                items = cleanItems(items, { scope: scope })

                if (items.length > 0) {
                    globalSeparator.visible = true
                    let itemIndex = 0

                    let index = contextMenu.items.indexOf(inputSeparator) + 1

                    for (
                        let i = index;
                        i < contextMenu.items.length &&
                        contextMenu.items[i] !== globalSeparator &&
                        itemIndex < items.length;
                        i++
                    ) {
                        if (isSame(contextMenu.items[i], items[itemIndex])) {
                            contextMenu.items[i].visible = true

                            makeSame(contextMenu.items[i], items[itemIndex])

                            itemIndex += 1
                            index += 1
                        }
                    }

                    for (let i = itemIndex; i < items.length; i++) {
                        contextMenu.insert(
                            index,
                            new MenuItem(items[itemIndex])
                        )
                        contextMenu.items[
                            contextMenu.items.length - 1
                        ].parent = contextMenu

                        addParentProperties(
                            contextMenu.items[contextMenu.items.length - 1]
                        )

                        index += 1
                        itemIndex += 1
                    }
                }
            }
            return null
        }

        exports.contextMenu.onEvent = function(event, listener) {
            if (typeof listener === 'function') {
                let eventName = ''
                if (event.endsWith('-click')) {
                    eventName = event.replace('-click', '')
                } else if (event === 'click') {
                    eventName = 'click'
                }

                if (eventName) {
                    if (!listeners.hasOwnProperty(eventName)) {
                        listeners[eventName] = []
                    }

                    listeners[eventName].push(listener)
                }
            }
        }

        body.onEvent('contextmenu', () => {
            inputSeparator.visible = false
            globalSeparator.visible = false
            if (!visibleItems(contextMenu)) {
                emptyMenu.popup({
                    window: thisWin
                })
            } else {
                contextMenu.popup({
                    window: thisWin
                })
            }
            for (let i = 0; i < contextMenu.items.length; i++) {
                if (
                    contextMenu.items[i].global === false ||
                    contextMenu.items[i].input === true
                ) {
                    contextMenu.items[i].visible = false
                }
            }
            inputSeparator.visible = false
            globalSeparator.visible = false
        })
    }
}

//Special global messages
{
    ipcRenderer.on('show-message', (event, text, type) => {
        exports.dialog.showNotification({
            type: type,
            message: text
        })
    })

    ipcRenderer.on('update-available', (event, version) => {
        exports.dialog.showNotification(
            {
                autoHide: false,
                type: 'success',
                message:
                    'There is a new version (' +
                    version +
                    ') available! Click to update.'
            },
            () => {
                exports.window.openExternal(
                    'https://brettdoyle.art/display-whisper/update'
                )
            }
        )
    })
}
