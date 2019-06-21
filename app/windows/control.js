const electron = require('electron')
const { ipcRenderer } = electron

const app = electron.remote.app

const fs = require('fs')
const path = require('path')

const layout = require('dw-layout')

const logger = require('dw-log')
const Database = require('dw-database')
const editor = require('dw-editor')
const keyboard = require('dw-keyboard')
const richText = require('dw-rich-text')

const items = require('dw-items')

const appDataPath = electron.remote.app.getPath('userData')

//**********************
//Timer
//(Because the timer needs to be used by both presentation (code), and item_control (interface), it needs to be declared globally)
//**********************
const timer = new layout.Timer({}, {})

//**********************
//Previews
//**********************
const displays = {
    active: [],
    previous: [],
    next: [],
    preview: []
}
const output = {
    active: {},
    previous: {},
    next: {},
    preview: {}
}

function changeDisplay(display, type) {
    if (output[type]) {
        display.set(output[type])
    } else {
        display.set({})
    }
}

function updateDisplays() {
    for (let i = 0; i < displays.active.length; i++) {
        displays.active[i].set(output.active)
    }

    for (let i = 0; i < displays.previous.length; i++) {
        displays.previous[i].set(output.previous)
    }

    for (let i = 0; i < displays.next.length; i++) {
        displays.next[i].set(output.next)
    }

    for (let i = 0; i < displays.preview.length; i++) {
        displays.preview[i].set(output.preview)
    }
}

function changeDisplay(display, type) {
    if (!output.hasOwnProperty(type)) {
        return false
    }

    if (displays.active.includes(display)) {
        displays.active.splice(displays.active.indexOf(display), 1)
    }

    if (displays.previous.includes(display)) {
        displays.previous.splice(displays.previous.indexOf(display), 1)
    }

    if (displays.next.includes(display)) {
        displays.next.splice(displays.next.indexOf(display), 1)
    }

    if (displays.preview.includes(display)) {
        displays.preview.splice(displays.preview.indexOf(display), 1)
    }

    displays[type].push(display)

    display.set(output[type])
}

//interface items

//These two buttons need to be globally accesible
const blankButton = new layout.Button(
    {
        text: 'Blank',
        toggle: true
    },
    {
        margin: 4
    }
)
const undoRemoveButton = new layout.Button({
    text: 'Undo Remove (0)',

    size: 'large',

    disabled: true
})

//**********************
//Presentation
//**********************
let itemIdCounter = 0
const itemsBlock = new layout.ReorderableBlock(
    {},
    {
        direction: 'vertical',
        align: 'stretch',
        size: '100%',

        overflow: 'scroll',
        overflowX: 'hidden'
    }
)

const presentation = {}
{
    let lastSaveTime = 0
    let lastAutoSaveTime = 0

    let lastEditTime = 0

    let file = ''

    let list = []

    let removeHistory = []

    let loadingPresentation = false

    let activeEditors = []

    let active = {
        index: 0,
        subIndex: 0
    }

    let selected = {
        index: 0,
        subIndex: 0
    }

    let defaultDisplay = {
        background: 'black',
        backgroundImage: '',
        backgroundScale: 'fill',

        nodes: []
    }

    let options = {
        autoSaveInterval: 5,

        removeHistoryCount: 3,

        autoMinimize: false,
        showSectionWhenMinimized: true,

        autoScroll: true,
        scrollSmooth: true,

        autoFitText: true,
        autoFitTextOpen: true,
        increaseSizeOnFit: true,

        reduceTextSize: true,
        minTextSize: 10,
        //Not currently implemented
        ensureContrast: false
    }

    let dropping = false
    let dragging = false

    let timeout = false

    let playMode = 'auto'
    let playOptions = {
        loop: false,
        shuffle: false
    }

    Object.defineProperties(presentation, {
        file: {
            enumerable: true,
            get: () => {
                return file
            },
            set: newFile => {
                file = newFile

                editHasOccured()
            }
        },
        saved: {
            enumerable: true,
            get: () => {
                return lastSaveTime > lastEditTime
            },
            set: value => {
                if (value === true) {
                    lastSaveTime = Date.now()

                    layout.window.setDocumentEdited(false)
                } else {
                    layout.window.setDocumentEdited(true)
                }
            }
        }
    })

    //save functions
    function editHasOccured() {
        lastEditTime = Date.now()

        layout.window.setDocumentEdited(true)
    }

    function addRemoveHistory(obj) {
        if (options.removeHistoryCount === 0) {
            return false
        }

        removeHistory.push(obj)

        if (removeHistory.length > options.removeHistoryCount) {
            removeHistory.splice(
                0,
                removeHistory.length - options.removeHistoryCount
            )
        }

        updateRemoveButton()
    }

    function updateRemoveButton() {
        undoRemoveButton.text =
            'Undo Remove (' + removeHistory.length.toString() + ')'

        undoRemoveButton.disabled = removeHistory.length === 0

        layout.menu.change('edit', 'undo', {
            enabled: removeHistory.length > 0
        })
    }

    //event functions
    let lastClicked = null
    function onItemActive(event) {
        setActive({
            index: itemsBlock.indexOf(event.from),
            subIndex: event.index
        })
    }
    function onItemSelect(event) {
        setSelected({
            index: itemsBlock.indexOf(event.from),
            subIndex: event.index
        })
    }
    function onItemDrag(event) {
        event.from.dragActive = true
        dragging = itemsBlock.indexOf(event.from)

        itemsBlock.hovering = true

        layout.setCursor('grabbing')
    }
    function onItemEdit(event) {
        ipcRenderer.send(
            'start-edit',
            event.from._itemType,
            event.from._data.id,
            event.from._data.getData()
        )

        activeEditors.push(event.from._data.id)

        event.from.editActive = true
    }
    function onItemRemove(event) {
        remove(itemsBlock.indexOf(event.from))
    }

    function onDataChange(changedItem) {
        updateItem(list.findIndex(item => item.id === changedItem.id))
    }

    //presentation functions
    function ensureImageExists(image) {
        return false
    }

    function reduceItemTextSize(index, sections) {
        if (sections.length === 0) {
            return false
        }

        //Keep a copy of the item, in case it's moved whilst the check is going on
        let item = list[index]

        //If any nodes have their text scaled down, this will be set to true
        let changed = false

        //Whenever a node gets a new text size, this is run:
        let onResult = (sectionIndex, nodeIndex, size) => {
            //Update the index, in case the item has been moved
            index = list.indexOf(item)

            if (
                //If the item has been removed
                index === -1 ||
                //Or if the amount of sections has been changed
                sections.length !== itemsBlock.items[index].items.length
            ) {
                //Completely stop checking
                //Because the item has been changed, that means updateItem will have been called again
                //And a new check for max text size will have started running
                return false
            }

            //If the max size is smaller
            if (size < sections[sectionIndex].display.nodes[nodeIndex].size) {
                //Get the current actual display values
                let display =
                    itemsBlock.items[index].items[sectionIndex].display

                //Check if the amount of nodes has changed
                if (
                    sections[sectionIndex].display.nodes.length !==
                    display.nodes.length
                ) {
                    return false
                }

                //If the current display is the same as when the check was started
                if (
                    nodeIndex >= 0 &&
                    nodeIndex < display.nodes.length &&
                    editor.util.same(
                        display.nodes[nodeIndex],
                        sections[sectionIndex].display.nodes[nodeIndex]
                    )
                ) {
                    changed = true

                    //Change the size, and modify the output
                    //(Without actually changing the item values)
                    display.nodes[nodeIndex].size = size

                    itemsBlock.items[index].items[
                        sectionIndex
                    ].display = display
                }
            }

            //When all nodes of the current section have been checked, move onto the next section
            //Since the check is async, it's easier to just move on when the nodeIndex is the final one
            //(And exit early for every other nodeIndex)
            if (nodeIndex < sections[sectionIndex].display.nodes.length - 1) {
                return false
            }

            //Since sections can be empty, find the next section which has a text node
            for (
                let nextSectionIndex = sectionIndex + 1;
                nextSectionIndex < sections.length;
                nextSectionIndex++
            ) {
                let found = false

                for (
                    let i = 0;
                    i < sections[nextSectionIndex].display.nodes.length;
                    i++
                ) {
                    if (
                        sections[nextSectionIndex].display.nodes[i].type ===
                        'text'
                    ) {
                        found = true

                        layout.Display.getMaxTextSize(
                            sections[nextSectionIndex].display.nodes[i],
                            onResult.bind(this, nextSectionIndex, i)
                        )
                    }
                }

                //If one has been found, exit
                if (found) {
                    return false
                }
            }

            //If another section with text nodes hasn't been found, then the item has finished being checked
            //So check if any changes have been made
            if (changed) {
                //If there have been changes, update the item error highlighting
                updateItemErrorHighlight(index)

                //And if the item is in the display, update it
                if (itemInOutput(index)) {
                    updateOutput()
                }
            }
        }

        //Find the first section which has a text node
        for (
            let sectionIndex = 0;
            sectionIndex < sections.length;
            sectionIndex++
        ) {
            let found = false

            for (
                let i = 0;
                i < sections[sectionIndex].display.nodes.length;
                i++
            ) {
                if (sections[sectionIndex].display.nodes[i].type === 'text') {
                    found = true

                    layout.Display.getMaxTextSize(
                        sections[sectionIndex].display.nodes[i],
                        onResult.bind(this, sectionIndex, i)
                    )
                }
            }

            //When one is found, stop looking
            if (found) {
                break
            }
        }
    }

    function updateItemErrorHighlight(index) {
        if (index < 0 || index >= itemsBlock.items.length) {
            return false
        }

        let problems = []

        for (let i = 0; i < itemsBlock.items[index].items.length; i++) {
            for (
                let j = 0;
                j < itemsBlock.items[index].items[i].display.nodes.length;
                j++
            ) {
                if (
                    itemsBlock.items[index].items[i].display.nodes[j].type ===
                    'text'
                ) {
                    if (
                        itemsBlock.items[index].items[i].display.nodes[j].size <
                        options.minTextSize
                    ) {
                        problems.push(i)
                    }
                }
            }
        }

        itemsBlock.items[index].errors = problems
    }
    function updateAllItemErrorHighlights() {
        for (let i = 0; i < itemsBlock.items.length; i++) {
            updateItemErrorHighlight(i)
        }
    }

    function updateItem(index = -1) {
        if (index < 0 || index >= list.length) {
            return false
        }
        let sections = list[index].sections

        itemsBlock.items[index].sections = sections
        itemsBlock.items[index].title = list[index].title

        if (options.reduceTextSize) {
            reduceItemTextSize(index, sections)
        }

        updateItemErrorHighlight(index)

        if (itemInOutput(index)) {
            updatePreviews()
        }
    }
    function updateAllItems() {
        for (let i = 0; i < list.length; i++) {
            updateItem(i)
        }

        updateOutput()
    }

    let scrollPosition = { index: 0, subIndex: 0 }

    function updateScroll() {
        if (
            options.autoScroll === false ||
            scrollPosition.index < 0 ||
            scrollPosition.index >= itemsBlock.items.length ||
            scrollPosition.subIndex < 0 ||
            scrollPosition.subIndex >=
                itemsBlock.items[scrollPosition.index].items.length
        ) {
            return false
        }

        let node =
            itemsBlock.items[scrollPosition.index].items[
                scrollPosition.subIndex
            ].node

        let listHeight = itemsBlock.node.offsetHeight
        let listScroll = itemsBlock.node.scrollTop

        let itemCenter =
            node.offsetTop + node.offsetHeight / 2 - itemsBlock.node.offsetTop

        let listPadding = Math.min(node.offsetHeight * 2.6, listHeight / 2)

        if (itemCenter - listPadding < listScroll) {
            itemsBlock.node.scrollTo({
                top: itemCenter - listPadding,
                left: 0,
                behavior: options.scrollSmooth ? 'smooth' : 'auto'
            })
        } else if (itemCenter + listPadding > listScroll + listHeight) {
            itemsBlock.node.scrollTo({
                top: itemCenter - (listHeight - listPadding),
                left: 0,
                behavior: options.scrollSmooth ? 'smooth' : 'auto'
            })
        }
    }

    function scrollTo(position) {
        if (
            options.autoScroll === false ||
            position.index < 0 ||
            position.index >= list.length ||
            position.subIndex < 0 ||
            position.subIndex >= itemsBlock.items[position.index].items.length
        ) {
            return false
        }

        scrollPosition.index = position.index
        scrollPosition.subIndex = position.subIndex

        //The scrollTo function waits for the end of an animation frame to actually update
        //This is because items may get maximized/minimized when going through the presentation
        //And their height only updates on an animation frame, so by waiting for the end of one, all items should be at the correct height when scrolling
        layout.onFrame.end(updateScroll)
    }

    //Updates previews and sends display message
    function updateOutput() {
        output.active = getDisplay(active, 0)
        output.previous = getDisplay(active, -1)
        output.next = getDisplay(active, 1)
        output.preview = getDisplay(selected, 0)

        updateDisplays()

        ipcRenderer.send('display', output.active)
    }

    //Only updates previews, does not change "active" display
    function updatePreviews() {
        output.previous = getDisplay(active, -1)
        output.next = getDisplay(active, 1)
        output.preview = getDisplay(selected, 0)

        updateDisplays()
    }

    function itemInOutput(index) {
        return (
            //If the item is active
            active.index === index ||
            //If the item is selected
            selected.index === index ||
            //If the item is after the active item, and the active section is the first of the item
            (active.index === index - 1 && active.subIndex === 0) ||
            //If the item is before the active item, and the active section is the last of the item
            (active.index === index + 1 &&
                active.subIndex ===
                    itemsBlock.items[active.index].items.length - 1)
        )
    }

    function isFirstPosition(position) {
        if (position.index === 0 && position.subIndex === 0) {
            return true
        }

        //if it's not the first section in its item, always return false (regardless of item position)
        if (position.subIndex > 0) {
            return false
        }

        //check each item before the given position, if any of them have 1 or more sections, return false
        for (
            let index = 0;
            index < position.index && index < itemsBlock.items.length;
            index++
        ) {
            if (itemsBlock.items[index].items.length > 0) {
                return false
            }
        }

        return true
    }

    function isLastPosition(position) {
        if (
            position.index === itemsBlock.items.length - 1 &&
            position.subIndex >=
                itemsBlock.items[position.index].items.length - 1
        ) {
            return true
        }

        if (position.index >= 0 && position.index < itemsBlock.items.length) {
            //if it's not the last section in its item, always return false (regardless of the item position)
            if (
                position.subIndex <
                itemsBlock.items[position.index].items.length - 1
            ) {
                return false
            }
        }

        //check each item after the given position, if any of them have 1 or more sections, return false
        for (
            let index = itemsBlock.items.length - 1;
            index > position.index && index >= 0;
            index--
        ) {
            if (itemsBlock.items[index].items.length > 0) {
                return false
            }
        }

        return true
    }

    function getFirstPosition() {
        if (
            itemsBlock.items.length === 0 ||
            itemsBlock.items[0].items.length > 0
        ) {
            return { index: 0, subIndex: 0 }
        }

        for (let index = 1; index < itemsBlock.items.length; index++) {
            if (itemsBlock.items[index].items.length > 0) {
                return { index: index, subIndex: 0 }
            }
        }

        return { index: 0, subIndex: 0 }
    }

    function getLastPosition() {
        if (itemsBlock.items.length === 0) return { index: 0, subIndex: 0 }

        if (itemsBlock.items[itemsBlock.items.length - 1].items.length > 0) {
            return {
                index: itemsBlock.items.length - 1,
                subIndex:
                    itemsBlock.items[itemsBlock.items.length - 1].items.length -
                    1
            }
        }

        for (let index = itemsBlock.items.length - 2; index >= 0; index--) {
            if (itemsBlock.items[index].items.length > 0) {
                return {
                    index: index,
                    subIndex: itemsBlock.items[index].items.length - 1
                }
            }
        }

        return { index: 0, subIndex: 0 }
    }

    function getNewPosition(position = { index: 0, subIndex: 0 }, offset = 0) {
        if (list.length === 0) {
            return {
                index: 0,
                subIndex: 0
            }
        } else if (list.length === 1) {
            return {
                index: 0,
                subIndex: Math.max(
                    0,
                    Math.min(
                        list[0].sections.length - 1,
                        position.subIndex + offset
                    )
                )
            }
        }

        if (position.index < 0) {
            position.index = 0
        }

        if (position.index >= list.length) {
            position.index = list.length - 1
        }

        if (offset < 0) {
            if (itemsBlock.items[position.index].sections.length > 0) {
                if (position.subIndex > 0) {
                    return {
                        index: position.index,
                        subIndex: Math.min(
                            position.subIndex - 1,
                            itemsBlock.items[position.index].sections.length - 1
                        )
                    }
                }
            }

            //go backwards, and use the first item which has multiple sections
            let index = position.index - 1
            while (index >= 0) {
                if (itemsBlock.items[index].sections.length > 0) {
                    return {
                        index: index,
                        subIndex: itemsBlock.items[index].sections.length - 1
                    }
                }
                index -= 1
            }

            //if no items backwards, then get the first item with multiple sections after
            index = position.index
            while (index < list.length) {
                if (itemsBlock.items[index].sections.length > 0) {
                    return {
                        index: index,
                        subIndex: 0
                    }
                }
                index -= 1
            }

            //if no items have sections, return 0, 0
            return {
                index: 0,
                subIndex: 0
            }
        } else if (offset > 0) {
            if (itemsBlock.items[position.index].sections.length > 0) {
                if (
                    position.subIndex <
                    itemsBlock.items[position.index].sections.length - 1
                ) {
                    return {
                        index: position.index,
                        subIndex: Math.max(0, position.subIndex + 1)
                    }
                }
            }

            //go forward, and use the first item with 1 or more sections
            let index = position.index + 1
            while (index < list.length) {
                if (itemsBlock.items[index].sections.length > 0) {
                    return {
                        index: index,
                        subIndex: 0
                    }
                }
                index += 1
            }

            index = position.index
            while (index >= 0) {
                if (itemsBlock.items[index].sections.length > 0) {
                    return {
                        index: index,
                        subIndex: itemsBlock.items[index].sections.length - 1
                    }
                }
                index -= 1
            }

            return {
                index: 0,
                subIndex: 0
            }
        } else {
            if (itemsBlock.items[position.index].sections.length > 0) {
                return {
                    index: position.index,
                    subIndex: Math.max(
                        0,
                        Math.min(
                            itemsBlock.items[position.index].sections.length -
                                1,
                            position.subIndex
                        )
                    )
                }
            }

            //go forward, and use the first item with 1 or more sections
            let index = position.index + 1
            while (index < list.length) {
                if (itemsBlock.items[index].sections.length > 0) {
                    return {
                        index: index,
                        subIndex: 0
                    }
                }
                index += 1
            }

            index = position.index - 1
            while (index >= 0) {
                if (itemsBlock.items[index].sections.length > 0) {
                    return {
                        index: index,
                        subIndex: itemsBlock.items[index].sections.length - 1
                    }
                }
                index -= 1
            }

            return {
                index: 0,
                subIndex: 0
            }
        }
    }
    function getDisplay(position, offset = 0) {
        if (typeof offset !== 'number' || !isFinite(offset)) {
            offset = 0
        }

        if (offset === -1 && isFirstPosition(position)) {
            if (playOptions.loop) {
                position = getLastPosition()
            } else {
                position = { index: -1, subIndex: -1 }
            }
        } else if (offset === 1 && isLastPosition(position)) {
            if (playOptions.loop) {
                position = getFirstPosition()
            } else {
                position = { index: -1, subIndex: -1 }
            }
        } else {
            position = getNewPosition(position, offset)
        }

        if (position.index < 0 || position.index >= itemsBlock.items.length) {
            return defaultDisplay
        }

        if (
            position.subIndex < 0 ||
            position.subIndex >= itemsBlock.items[position.index].items.length
        ) {
            return defaultDisplay
        }

        return itemsBlock.items[position.index].items[position.subIndex].display
    }

    //public presentation functions
    function setActive(position, updateScroll = true) {
        if (timeout) {
            clearTimeout(timeout)
        }

        if (typeof position.index !== 'number') {
            position.index = 0
        }

        if (typeof position.subIndex !== 'number') {
            position.subIndex = 0
        }

        if (active.index >= 0 && active.index < itemsBlock.items.length) {
            itemsBlock.items[active.index].active = false

            if (options.autoMinimize) {
                itemsBlock.items[active.index].minimize()
            }
        }

        active = getNewPosition(position, 0)

        if (active.index < itemsBlock.items.length) {
            itemsBlock.items[active.index].active = true

            if (active.subIndex < itemsBlock.items[active.index].items.length) {
                itemsBlock.items[active.index].items[
                    active.subIndex
                ].active = true
            }
        }

        //The setSelected function calls updateOutput, so setActive doesn't need to call it
        setSelected(active, updateScroll)

        if (output.active.autoPlay === true && playMode !== 'manual') {
            let time = output.active.playTime + output.active.transition.time

            //if the transition is 10% or more of the playTime, show the extra time in brackets
            if (
                output.active.transition.time / output.active.playTime >= 0.1 &&
                output.active.transition.time > 0.5
            ) {
                timer.text =
                    output.active.playTime / 1000 +
                    's ( + ' +
                    output.active.transition.time / 1000 +
                    's)'
            } else {
                timer.text = output.active.playTime / 1000 + 's'
            }

            if (playOptions.loop) {
                timer.disabled = false
            } else {
                timer.disabled = isLastPosition(active)
            }

            timer.animate(time)

            timeout = setTimeout(() => {
                forward()
            }, time)
        } else {
            timer.text = ''
            timer.value = 0
        }
    }
    presentation.setActive = setActive

    function setSelected(position, updateScroll = true) {
        if (typeof position.index !== 'number') {
            position.index = 0
        }

        if (typeof position.subIndex !== 'number') {
            position.subIndex = 0
        }

        if (selected.index >= 0 && selected.index < itemsBlock.items.length) {
            itemsBlock.items[selected.index].selected = false
        }

        let lastSelectedItem = selected.index

        selected = getNewPosition(position, 0)

        if (
            options.autoMinimize &&
            lastSelectedItem !== active.index &&
            lastSelectedItem !== selected.index &&
            lastSelectedItem >= 0 &&
            lastSelectedItem < itemsBlock.items.length
        ) {
            itemsBlock.items[lastSelectedItem].minimize()
        }

        if (selected.index < itemsBlock.items.length) {
            itemsBlock.items[selected.index].selected = true

            if (
                selected.subIndex <
                itemsBlock.items[selected.index].items.length
            ) {
                itemsBlock.items[selected.index].items[
                    selected.subIndex
                ].selected = true
            }
        }

        if (updateScroll) {
            scrollTo(selected)
        }

        updateOutput()
    }

    function add(input, template = {}, index = -1) {
        if (!items.list.includes(input.itemType)) {
            return false
        }

        let data = new items[input.itemType](input, template)

        let item = new layout.PresentationItem({
            title: data.title,

            showSectionWhenMinimized: options.showSectionWhenMinimized
        })

        item._data = data
        item._itemType = input.itemType

        data.id =
            itemIdCounter.toString(16) +
            '-' +
            data.constructor.name.toLowerCase()
        itemIdCounter += 1

        if (index >= 0 && index < list.length) {
            let lastSelected = {
                index: selected.index,
                subIndex: selected.subIndex
            }

            if (index <= selected.index) {
                if (selected.index < itemsBlock.items.length) {
                    itemsBlock.items[selected.index].selected = false
                }
            }
            if (index <= active.index) {
                if (active.index < itemsBlock.items.length) {
                    itemsBlock.items[active.index].active = false
                }
            }

            list.splice(index, 0, data)
            itemsBlock.add(item, index)

            if (index <= active.index) {
                setActive(
                    {
                        index: active.index + 1,
                        subIndex: active.subIndex
                    },
                    false
                )
            }

            if (index <= lastSelected.index) {
                setSelected(
                    {
                        index: lastSelected.index + 1,
                        subIndex: lastSelected.subIndex
                    },
                    false
                )
            }
        } else {
            list.push(data)
            itemsBlock.add(item)

            index = list.length - 1
        }

        updateItem(Math.max(0, Math.min(list.length - 1, index)))

        if (typeof data.onChange === 'function') {
            data.onChange(onDataChange.bind(null, data))
        }

        if (options.autoMinimize) {
            item.minimize()
        }

        if (
            //Autofit when not loading a presentation an auto fit setting is true
            //Or autofit when loading a presentation and auto fit on open is true
            (options.autoFitText && !loadingPresentation) ||
            (options.autoFitTextOpen && loadingPresentation)
        ) {
            fitText(list.indexOf(data))
        }

        editHasOccured()

        item.onEvent('active-click', onItemActive)
        item.onEvent('select-click', onItemSelect)
        item.onEvent('edit-click', onItemEdit)
        item.onEvent('drag-click', onItemDrag)
        item.onEvent('remove-click', onItemRemove)
    }
    presentation.add = add

    function addDrop(input, template = {}) {
        if (!items.list.includes(input.itemType)) {
            return false
        }

        dropping = {
            input: input,
            template: template
        }

        itemsBlock.hovering = true
    }
    presentation.addDrop = addDrop

    function fitText(index) {
        if (index < 0 || index >= list.length) {
            return false
        }
        let data = list[index]

        let sectionCollections = data.getTextUnifySections()

        if (sectionCollections.length === 0) {
            return false
        }

        //Visually disable the item
        itemsBlock.items[index].disabled = true
        //And if an editor window is open for it, lock it
        ipcRenderer.send('lock-edit', list[index].id)

        let collectionSizes = []

        //Section sizes is an array of the maximum size of each collection of sections
        //If text size is allowed to increase, max should be infinity
        //Otherwise, max should be the largest size of a section in the collection
        if (options.increaseSizeOnFit) {
            for (let i = 0; i < sectionCollections.length; i++) {
                collectionSizes.push(Infinity)
            }
        } else {
            for (let i = 0; i < sectionCollections.length; i++) {
                collectionSizes.push(
                    sectionCollections[i].reduce((max, section) => {
                        return Math.max(max, section.size)
                    }, 0)
                )
            }
        }

        let sectionIndex = 0

        let onResult = size => {
            //Each time a maximum size is returned for a collection, make sure it doesn't exceed the highest valid size for that collection
            collectionSizes[sectionIndex] = Math.min(
                size,
                collectionSizes[sectionIndex]
            )

            //Then get a size for the next collection
            sectionIndex += 1

            if (sectionIndex < sectionCollections.length) {
                layout.Display.getMaxTextSize(
                    sectionCollections[sectionIndex],
                    onResult
                )
            } else {
                data.unifyTextSections(collectionSizes)

                //The item may have been moved, or removed whilst the text was being fitted, so get the current index of the item
                index = list.indexOf(data)

                if (index >= 0 && index < list.length) {
                    updateItem(index)

                    itemsBlock.items[index].disabled = false
                    ipcRenderer.send('unlock-edit', list[index].id)
                    ipcRenderer.send(
                        'edit-data',
                        list[index].id,
                        list[index].getData()
                    )
                }
            }
        }

        layout.Display.getMaxTextSize(
            sectionCollections[sectionIndex],
            onResult
        )
    }
    presentation.fitText = fitText

    presentation.fitTextAll = () => {
        for (let i = 0; i < list.length; i++) {
            fitText(i)
        }
    }

    function remove(index) {
        if (index < 0 || index >= list.length) {
            return false
        }

        ipcRenderer.send('stop-edit', list[index].id)

        addRemoveHistory({
            item: itemsBlock.items[index],
            data: list[index],
            index: index
        })

        itemsBlock.items[index].selected = false
        itemsBlock.items[index].active = false
        itemsBlock.items[index].editActive = false

        list.splice(index, 1)
        itemsBlock.remove(index)

        let lastSelected = {
            index: selected.index,
            subIndex: selected.subIndex
        }

        if (index <= active.index) {
            setActive({ index: active.index - 1, subIndex: 0 }, false)
        }

        if (index <= lastSelected.index) {
            setSelected({ index: lastSelected.index - 1, subIndex: 0 }, false)
        }

        if (list.length === 0) {
            active.index = active.subIndex = selected.index = selected.subIndex = 0

            updatePreviews()
        }

        editHasOccured()
    }
    presentation.remove = remove

    function undoRemove() {
        if (removeHistory.length === 0) {
            return false
        }

        let history = removeHistory.pop()

        updateRemoveButton()

        if (history.index >= 0 && history.index < list.length) {
            let lastSelected = {
                index: selected.index,
                subIndex: selected.subIndex
            }

            if (history.index <= selected.index) {
                if (selected.index < itemsBlock.items.length) {
                    itemsBlock.items[selected.index].selected = false
                }
            }
            if (history.index <= active.index) {
                if (active.index < itemsBlock.items.length) {
                    itemsBlock.items[active.index].active = false
                }
            }

            list.splice(history.index, 0, history.data)
            itemsBlock.add(history.item, history.index)

            if (history.index <= active.index) {
                setActive(
                    {
                        index: active.index + 1,
                        subIndex: active.subIndex
                    },
                    false
                )
            }
            if (history.index <= lastSelected.index) {
                setSelected(
                    {
                        index: lastSelected.index + 1,
                        subIndex: lastSelected.subIndex
                    },
                    false
                )
            }
        } else {
            list.push(history.data)
            itemsBlock.add(history.item)

            history.index = list.length - 1
        }

        updateItem(Math.max(0, Math.min(list.length - 1, history.index)))

        if (options.autoMinimize) {
            history.item.minimize()
        }

        if (options.autoFitText) {
            fitText(list.indexOf(history.data))
        }

        editHasOccured()
    }
    presentation.undoRemove = undoRemove

    function move(index, newIndex) {
        if (typeof index !== 'number') {
            index = list.indexOf(index)
        }

        if (
            list.length <= 1 ||
            index < 0 ||
            index >= list.length ||
            newIndex < 0 ||
            newIndex > list.length ||
            index === newIndex
        ) {
            return false
        }

        if (active.index < 0 || active.index >= items.length) {
            active = getNewPosition(active)
        }
        let currentActiveId = list[active.index].id

        if (selected.index < 0 || selected.index >= items.length) {
            selected = getNewPosition(selected)
        }
        let currentSelectedId = list[selected.index].id

        if (selected.index >= 0 && selected.index < itemsBlock.items.length) {
            itemsBlock.items[selected.index].selected = false
        }

        itemsBlock.move(index, newIndex)

        let data = list.splice(index, 1)[0]

        if (newIndex > index) {
            newIndex -= 1
        }

        list.splice(newIndex, 0, data)

        for (let i = 0; i < list.length; i++) {
            if (list[i].id === currentActiveId) {
                active.index = i
            }
            if (list[i].id === currentSelectedId) {
                selected.index = i
            }
        }

        if (selected.index < itemsBlock.items.length) {
            itemsBlock.items[selected.index].selected = true

            if (
                selected.subIndex <
                itemsBlock.items[selected.index].items.length
            ) {
                itemsBlock.items[selected.index].items[
                    selected.subIndex
                ].selected = true
            }
        }

        if (active.index === newIndex) {
            scrollTo(active)
        } else if (selected.index === newIndex) {
            scrollTo(selected)
        }

        updateOutput()

        editHasOccured()
    }
    presentation.move = move

    function beginFirst() {
        if (list.length === 0) {
            return false
        }

        setActive({ index: 0, subIndex: 0 })
    }
    presentation.beginFirst = beginFirst

    function beginLast() {
        if (list.length === 0) {
            return false
        }

        let subIndex = itemsBlock.items[list.length - 1].items.length - 1

        setActive({ index: list.length, subIndex: subIndex })
    }
    presentation.beginLast = beginLast

    function forward() {
        if (list.length === 0) {
            return false
        }

        if (
            playOptions.shuffle &&
            list.length !== 1 &&
            active.index < itemsBlock.items.length &&
            active.index >= 0 &&
            active.subIndex === itemsBlock.items[active.index].items.length - 1
        ) {
            //At the end of an item, and shuffle is enabled

            if (list.length === 2) {
                //If there are only two items, go to the other item
                setActive({
                    index: active.index === 0 ? 1 : 0,
                    subIndex: 0
                })
            } else {
                //Get a random index, excluding the last item
                let randomIndex = ~~(Math.random() * (list.length - 1))
                //Then add one if the index is at, or above the current index
                //This ensure all indexs are evenly chosen, and the current index is never chosen.
                if (randomIndex >= active.index) {
                    randomIndex += 1
                }

                setActive({
                    index: randomIndex,
                    subIndex: 0
                })
            }
        } else if (isLastPosition(active)) {
            if (playOptions.loop) {
                setActive(getFirstPosition())
            } else {
                timer.value = 0
                timer.text = ''
                timer.disabled = true
            }
        } else {
            setActive(getNewPosition(active, 1))
        }
    }
    presentation.forward = forward

    function back() {
        if (list.length === 0) {
            return false
        }

        if (
            playOptions.shuffle &&
            list.length !== 1 &&
            active.index < itemsBlock.items.length &&
            active.index >= 0 &&
            active.subIndex === 0
        ) {
            //At the start of an item, and shuffle is enabled
            if (list.length === 2) {
                //If there are only two items, go to the other item
                setActive({
                    index: active.index === 0 ? 1 : 0,
                    subIndex: 0
                })
            } else {
                //Get a random index, excluding the last item
                let randomIndex = ~~(Math.random() * (list.length - 1))
                //Then add one if the index is at, or above the current index
                //This ensure all indexs are evenly chosen, and the current index is never chosen.
                if (randomIndex >= active.index) {
                    randomIndex += 1
                }

                setActive({
                    index: randomIndex,
                    subIndex: 0
                })
            }
        } else if (isFirstPosition(active)) {
            if (playOptions.loop) {
                setActive(getLastPosition())
            } else {
                timer.value = 0
                timer.text = ''
                timer.disabled = true
            }
        } else {
            setActive(getNewPosition(active, -1))
        }
    }
    presentation.back = back

    function selectForward() {
        if (list.length === 0) {
            return false
        }

        setSelected(getNewPosition(selected, 1))
    }
    presentation.selectForward = selectForward

    function selectBack() {
        if (list.length === 0) {
            return false
        }

        setSelected(getNewPosition(selected, -1))
    }
    presentation.selectBack = selectBack

    function selectItemForward() {
        if (list.length === 0) {
            return false
        }

        if (selected.index < list.length - 1) {
            setSelected({ index: selected.index + 1, subIndex: 0 })
        }
    }
    presentation.selectItemForward = selectItemForward
    function selectItemBackward() {
        if (list.length === 0) {
            return false
        }

        if (selected.index > 0) {
            setSelected({ index: selected.index - 1, subIndex: 0 })
        }
    }
    presentation.selectItemBackward = selectItemBackward

    function playSelected() {
        setActive(selected)
    }
    presentation.playSelected = playSelected

    function moveSelectedUp() {
        move(selected.index, selected.index - 1)
    }
    presentation.moveSelectedUp = moveSelectedUp
    function moveSelectedDown() {
        move(selected.index, selected.index + 2)
    }
    presentation.moveSelectedDown = moveSelectedDown
    function moveSelectedTop() {
        move(selected.index, 0)
    }
    presentation.moveSelectedTop = moveSelectedTop
    function moveSelectedBottom() {
        move(selected.index, list.length)
    }
    presentation.moveSelectedBottom = moveSelectedBottom

    function load(data = {}) {
        file = ''
        list = []
        removeHistory = []
        active.index = 0
        active.subIndex = 0

        updateRemoveButton()

        itemsBlock.clear()

        for (let i = 0; i < activeEditors.length; i++) {
            ipcRenderer.send('stop-edit', activeEditors[i])
        }

        activeEditors = []

        if (typeof data.file === 'string') {
            file = data.file
        }

        loadingPresentation = true

        if (Array.isArray(data.list)) {
            for (let i = 0; i < data.list.length; i++) {
                add(data.list[i])
            }
        }

        loadingPresentation = false

        if (list.length === 0) {
            active.index = active.subIndex = selected.index = selected.subIndex = 0

            updatePreviews()
        } else if (typeof data.active === 'object') {
            layout.onFrame.end(() => {
                //Need to set it to 'manual', so that going to the active item doesn't start the autoplay timer
                let actualPlayMode = playMode
                playMode = 'manual'

                setActive({
                    index: data.active.index || 0,
                    subIndex: data.active.subIndex || 0
                })

                playMode = actualPlayMode
            })
        }

        lastEditTime = 0

        layout.window.setDocument(file)

        presentation.saved = true
    }
    presentation.load = load

    function reset() {
        load({})
    }
    presentation.reset = reset

    function getSaveData() {
        let data = {
            file: file,
            list: [],

            active: {
                index: active.index,
                subIndex: active.subIndex
            }
        }

        for (let i = 0; i < list.length; i++) {
            data.list.push(list[i].getData())
        }

        return data
    }
    presentation.getSaveData = getSaveData

    function setPlayMode(mode, options) {
        if (mode === 'manual' || mode === 'auto') {
            playMode = mode
        }

        if (typeof options === 'object') {
            if (typeof options.loop === 'boolean') {
                playOptions.loop = options.loop

                //if at last item, disable timer if loop is false, otherwise enable it
                if (isLastPosition(active)) {
                    timer.disabled = !playOptions.loop
                }
            }

            if (typeof options.shuffle === 'boolean') {
                playOptions.shuffle = options.shuffle
            }
        }

        if (playMode === 'manual') {
            if (timeout) {
                clearTimeout(timeout)
            }

            timer.text = ''
            timer.value = 0
        }

        updatePreviews()
    }
    presentation.setPlayMode = setPlayMode

    function autoSaveCheck() {
        if (
            lastEditTime >= lastAutoSaveTime &&
            Date.now() - lastAutoSaveTime >= options.autoSaveInterval * 1000
        ) {
            fs.writeFile(
                path.join(appDataPath, 'autosave.dpl'),
                JSON.stringify(getSaveData()),
                error => {
                    if (error) {
                        layout.dialog.showNotification({
                            type: 'error',
                            message:
                                'Unable to autosave!\n' + error.message ||
                                error.toString()
                        })

                        logger.error('Unable to save autosave:', error)

                        return false
                    }

                    lastAutoSaveTime = Date.now()

                    layout.window.setDocumentEdited('autosaved')
                }
            )
        }
    }

    let autoSaveTimer = setInterval(
        autoSaveCheck,
        options.autoSaveInterval * 1000
    )

    //Checks if the presentation has been saved, callback(error, canContinue)
    //If not, asks the user if they want to: Save, Discard, or Cancel
    //Save option will do all neccesary save actions
    //Save & Discard will give 'canContinue': true,
    //Cancel will give 'canContinue': false
    //If canContinue is false, no further action should be taken by the callee
    function checkSave(callback) {
        if (!presentation.saved) {
            if (typeof callback !== 'function') {
                return false
            }

            layout.dialog.showQuestion(
                {
                    title: 'Save Presentation?',

                    message: presentation.file
                        ? 'You have made changes to the presentation which have not been saved!'
                        : 'The presentation has not been saved!',
                    detail: presentation.file
                        ? 'Do you want to save your changes?'
                        : 'Do you want to save the presentation?',

                    options: ['Save', 'Discard', 'Cancel']
                },
                (error, result) => {
                    if (result === 'Save') {
                        fileSavePresentation(error => {
                            callback(error, true)
                        })
                    } else if (result === 'Discard') {
                        callback(null, true)
                    } else {
                        callback(null, false)
                    }
                }
            )
            return false
        } else {
            if (typeof callback === 'function') {
                callback(null, true)
            }

            return true
        }
    }

    //File functions
    function loadFile(file) {
        app.addRecentDocument(file)

        fs.readFile(file, (error, data) => {
            if (error) {
                if (error.code === 'ENOENT') {
                    layout.dialog.showNotification({
                        type: 'error',
                        message: 'The file has been removed or renamed.'
                    })
                } else {
                    layout.dialog.showError({
                        title: "Couldn't load file",
                        message: 'Unable to load selected file!',
                        detail:
                            'The contents of the file were invalid:\n' +
                            (error.message || error.toString())
                    })
                }

                logger.error('Error loading presentation file', file, error)

                return false
            }

            try {
                data = JSON.parse(data)
            } catch (error) {
                layout.dialog.showError({
                    title: "Couldn't load file",
                    message: 'Unable to load selected file!',
                    detail:
                        'The contents of the file were invalid:\n' +
                        (error.message || error.toString())
                })

                logger.error('Error loading presentation file', file, error)

                return false
            }

            data.file = file

            presentation.load(data)
        })
    }
    //User file functions
    function fileSavePresentationAs(callback) {
        layout.dialog.showSave(
            {
                title: 'Save Presentation As...',
                button: 'Save',
                filters: [
                    {
                        name: 'Display Whisper Presentation',
                        extensions: ['dpl']
                    }
                ]
            },
            (error, file) => {
                if (error) {
                    layout.dialog.showError({
                        message: 'Unable to select file',
                        detail: error.message || error.toString()
                    })

                    logger.error('Error selecting save file', file, error)

                    if (typeof callback === 'function') {
                        callback(error, file)
                    }
                } else if (file) {
                    presentation.file = file
                    fileSavePresentation(callback)
                } else if (typeof callback === 'function') {
                    callback(null)
                }
            }
        )
    }
    function fileSavePresentation(callback) {
        if (!presentation.file) {
            fileSavePresentationAs(callback)
            return false
        }

        fs.writeFile(
            presentation.file,
            JSON.stringify(presentation.getSaveData()),
            error => {
                if (error) {
                    layout.dialog.showError({
                        message: 'Unable to save file',
                        detail: error.message || error.toString()
                    })
                    logger.error('Error saving presentation file', file, error)

                    if (typeof callback === 'function') {
                        callback(error, false)
                    }
                } else {
                    presentation.saved = true

                    if (typeof callback === 'function') {
                        callback(null, true)
                    }
                }
            }
        )
    }
    function fileNewPresentation() {
        checkSave((error, canContinue) => {
            if (canContinue) {
                presentation.reset()
            }
        })
    }
    function fileOpenPresentation() {
        checkSave((error, canContinue) => {
            if (!canContinue) {
                return false
            }

            layout.dialog.showOpen(
                {
                    title: 'Open Presentation',
                    filters: [
                        {
                            name: 'Presentation',
                            extensions: ['dpl']
                        },
                        {
                            name: 'Other',
                            extensions: ['*']
                        }
                    ]
                },
                (error, file) => {
                    if (error) {
                        layout.dialog.showError({
                            message: 'Unable to open selected file',
                            detail: error.message || error.toString()
                        })
                        logger.error(
                            'Error opening Presentation file',
                            file,
                            error
                        )

                        return false
                    } else if (file) {
                        loadFile(file)
                    }
                }
            )
        })
    }

    //Settings, and keyboard shortcuts
    {
        ipcRenderer.on('setting', (event, key, value) => {
            if (key.startsWith('defaults.')) {
                defaultDisplay[key.slice(9)] = value

                return
            }

            switch (key) {
                case 'display.autoFitText':
                    options.autoFitText = value

                    break
                case 'display.autoFitTextOpen':
                    options.autoFitTextOpen = value

                    break
                case 'display.increaseSizeOnFit':
                    options.increaseSizeOnFit = value

                    break
                case 'display.reduceTextSize':
                    if (
                        options.reduceTextSize !== value &&
                        typeof value === 'boolean'
                    ) {
                        options.reduceTextSize = value

                        //When changing the option to reduce all text to fit, every item needs to be re-calculated
                        updateAllItems()
                    }

                    break
                case 'display.minTextSize':
                    if (
                        options.minTextSize !== value &&
                        typeof value === 'number' &&
                        isFinite(value) &&
                        value > 0
                    ) {
                        options.minTextSize = value

                        //When changing the minimum text size, all items need to have their error highlighting updated
                        updateAllItemErrorHighlights()
                    }

                    break
                case 'general.autoMinimize':
                    options.autoMinimize = value

                    if (value) {
                        for (let i = 0; i < itemsBlock.items.length; i++) {
                            if (i !== active.index && i !== selected.index) {
                                itemsBlock.items[i].minimize()
                            }
                        }
                    }

                    break
                case 'general.showSectionWhenMinimized':
                    options.showSectionWhenMinimized = value

                    for (let i = 0; i < itemsBlock.items.length; i++) {
                        itemsBlock.items[i].showSectionWhenMinimized = value
                    }

                    break
                case 'general.autoSaveInterval':
                    if (
                        typeof value !== 'number' ||
                        value < 3 ||
                        !isFinite(value)
                    ) {
                        return false
                    }

                    clearInterval(autoSaveTimer)

                    options.autoSaveInterval = value

                    autoSaveTimer = setInterval(
                        autoSaveCheck,
                        options.autoSaveInterval * 1000
                    )

                    break
                case 'general.removeHistoryCount':
                    if (
                        typeof value !== 'number' ||
                        value < 0 ||
                        !isFinite(value)
                    ) {
                        return false
                    }

                    options.removeHistoryCount = value

                    if (removeHistory.length > options.removeHistoryCount) {
                        removeHistory.splice(
                            0,
                            removeHistory.length - options.removeHistoryCount
                        )

                        updateRemoveButton()
                    }
                    break
                case 'general.autoScroll':
                    options.autoScroll = value

                    if (value) {
                        scrollTo(selected)
                    }
                    break
                case 'general.scrollSmooth':
                    options.scrollSmooth = value
                    break
            }
        })

        ipcRenderer.send('get-settings', [
            ['defaults.background', 'black'],
            ['defaults.backgroundScale', 'fill'],

            ['display.autoFitText', true],
            ['display.autoFitTextOpen', true],
            ['display.increaseSizeOnFit', true],

            ['display.reduceTextSize', true],
            ['display.minTextSize', 10],

            ['general.autoMinimize', true],
            ['general.showSectionWhenMinimized', true],

            ['general.autoScroll', true],
            ['general.scrollSmooth', true],

            ['general.autoSaveInterval', 30],

            ['general.removeHistoryCount', 3]
        ])
    }

    layout.menu.onEvent('file', item => {
        if (item.value === 'new') {
            fileNewPresentation()
        } else if (item.value === 'open') {
            fileOpenPresentation()
        } else if (item.value === 'save-as') {
            fileSavePresentationAs()
        } else if (item.value === 'save') {
            fileSavePresentation()
        }
    })

    layout.onEvent('file-drop', event => {
        if (event.files.length > 1) {
            layout.dialog.showNotification({
                type: 'message',
                message: 'Please select one file to open.'
            })
        } else if (event.files.length === 1) {
            checkSave((error, canContinue) => {
                if (!canContinue) {
                    return false
                }

                loadFile(event.files[0].path)
            })
        }
    })

    let closing = false
    let canClose = false

    function finishClose() {
        if (lastEditTime >= lastAutoSaveTime) {
            layout.showLoader(layout.body, 'Auto-Saving')

            fs.writeFile(
                path.join(appDataPath, 'autosave.dpl'),
                JSON.stringify(getSaveData()),
                error => {
                    if (error) {
                        logger.error('Unable to autosave on close:', error)
                    }

                    layout.window.close()
                }
            )
        } else {
            layout.window.close()
        }
    }

    layout.window.onEvent('close', event => {
        if (closing & canClose) {
            return
        }

        closing = true
        canClose = false

        event.cancel()

        ipcRenderer.send('close')
    })
    ipcRenderer.on('cancel-close', () => {
        closing = false
        canClose = false
    })
    ipcRenderer.on('can-close', () => {
        if (!closing) {
            return
        }

        canClose = true

        checkSave((error, canContinue) => {
            if (!canContinue) {
                closing = false
                canClose = false

                return false
            }

            finishClose()
        })
    })

    itemsBlock.onEvent('cancel-drop', () => {
        if (typeof dropping === 'object') {
            dropping = false
        }

        if (typeof dragging === 'number') {
            dragging = false
        }
    })
    itemsBlock.onEvent('drop', event => {
        if (typeof dropping === 'object') {
            add(dropping.input, dropping.template, event.index)

            dropping = false
        }

        if (
            typeof dragging === 'number' &&
            dragging >= 0 &&
            dragging < list.length
        ) {
            if (itemsBlock.items.length > dragging) {
                itemsBlock.items[dragging].dragActive = false
            }

            move(dragging, event.index)

            dragging = false
        }
    })

    //Commands from other windows
    {
        ipcRenderer.on('edit', (event, id, data) => {
            let index = list.findIndex(item => item.id === id)

            if (index !== -1) {
                list[index].edit(data)

                updateItem(index)

                editHasOccured()
            }
        })

        ipcRenderer.on('edit-close', (event, id) => {
            let index = list.findIndex(item => item.id === id)

            if (index !== -1) {
                itemsBlock.items[index].editActive = false
            }

            index = activeEditors.indexOf(id)

            if (index !== -1) {
                activeEditors.splice(index, 1)
            }
        })

        ipcRenderer.on('presentation', (event, argument) => {
            switch (argument) {
                case 'play-next':
                    presentation.forward()
                    break
                case 'play-previous':
                    presentation.back()
                    break
                case 'select-next':
                    presentation.selectForward()
                    break
                case 'select-previous':
                    presentation.selectBack()
                    break
                case 'select-next-item':
                    presentation.selectItemForward()
                    break
                case 'select-previous-item':
                    presentation.selectItemBackward()
                    break
                case 'play-selected':
                    presentation.playSelected()
            }
        })
    }

    let lastDisplay = { bounds: {} }
    ipcRenderer.on('display-info', (event, display) => {
        if (
            lastDisplay.bounds.width === display.bounds.width &&
            lastDisplay.bounds.height === display.bounds.height
        ) {
            return false
        }

        lastDisplay = display

        updateAllItems()
    })

    //Loading autosave
    {
        fs.readFile(path.join(appDataPath, 'autosave.dpl'), (error, data) => {
            if (error) {
                logger.error('Unable to load autosave:', error)

                return false
            }

            try {
                data = JSON.parse(data)
            } catch (error) {
                logger.error('Unable to parse autosave:', error)

                return false
            }

            load(data)
        })
    }

    ipcRenderer.on('open-file', (event, file) => {
        checkSave((error, canContinue) => {
            if (!canContinue) {
                return false
            }

            loadFile(file)
        })
    })
}

//======================
//Presentation Block
//======================
const item_presentation = {
    minWidth: 350,
    minHeight: 250,

    main: itemsBlock
}
{
}

//======================
//Menu Bar
//======================
const item_menu = {
    minWidth: 200,
    minHeight: 44,
    maxHeight: 44,

    main: new layout.Block(
        {
            childSpacing: 4
        },
        {
            direction: 'horizontal'
        }
    )
}
//This variable needs to be accesible globally, so that blank button logic can use it
let displaying = false
{
    let activeScreenList = []

    const screenButtons = []
    const screenButtonList = new layout.Block(
        {
            direction: 'horizontal',
            childSpacing: item_menu.main.childSpacing
        },
        {
            grow: false,
            shrink: false,

            padding: 0
        }
    )

    const fitTextAllButton = new layout.Button({
        text: 'Scale Text & Unify - All',
        size: 'large'
    })

    item_menu.main.add(screenButtonList)
    item_menu.main.add(new layout.Filler())
    item_menu.main.add(undoRemoveButton)
    item_menu.main.add(new layout.Filler())
    item_menu.main.add(fitTextAllButton)

    layout.contextMenu.add(
        'display-menu',
        [
            {
                label: 'Active Displays',
                submenu: [
                    {
                        label: 'Screen 1',
                        type: 'checkbox'
                    },
                    {
                        label: 'Screen 2',
                        type: 'checkbox'
                    },
                    {
                        label: 'Screen 3',
                        type: 'checkbox'
                    },
                    {
                        label: 'Screen 4',
                        type: 'checkbox'
                    }
                ]
            }
        ],
        true
    )

    function onScreenButtonPress(event) {
        let index = screenButtons.findIndex(btn => btn === event.from)

        ipcRenderer.send('toggle-display-screen', index)
    }

    fitTextAllButton.onEvent('click', presentation.fitTextAll)

    layout.contextMenu.onEvent('display-menu', event => {
        if (event.label === 'Screen 1') {
            ipcRenderer.send('toggle-display-screen', 0)
        } else if (event.label === 'Screen 2') {
            ipcRenderer.send('toggle-display-screen', 1)
        } else if (event.label === 'Screen 3') {
            ipcRenderer.send('toggle-display-screen', 2)
        } else if (event.label === 'Screen 4') {
            ipcRenderer.send('toggle-display-screen', 3)
        }
    })

    ipcRenderer.on('display-info', (event, display) => {
        //if the amount of screens changes, add/remove buttons
        if (display.screenCount > screenButtons.length) {
            while (screenButtons.length < display.screenCount) {
                let button = new layout.Button({
                    text: (screenButtons.length + 1).toString(),
                    size: 'large'
                })
                button.addClass('highlight')
                button.onEvent('click', onScreenButtonPress)

                screenButtons.push(button)
                screenButtonList.add(button)
            }
        } else if (display.screenCount < screenButtons.length) {
            while (screenButtons.length > display.screenCount) {
                screenButtonList.remove(screenButtons.pop())
            }
        }

        activeScreenList = display.screens

        for (let i = 0; i < display.screenCount; i++) {
            screenButtons[i].active = activeScreenList.includes(i)

            if (display.masterScreen === i) {
                screenButtons[i].text = '[' + (i + 1).toString() + ']'
            } else {
                screenButtons[i].text = (i + 1).toString()
            }
        }

        layout.contextMenu.change('display-menu', [
            {
                submenu: [
                    {
                        checked: activeScreenList.includes(0),
                        visible: display.screenCount >= 1
                    },
                    {
                        checked: activeScreenList.includes(1),
                        visible: display.screenCount >= 2
                    },
                    {
                        checked: activeScreenList.includes(2),
                        visible: display.screenCount >= 3
                    },
                    {
                        checked: activeScreenList.includes(3),
                        visible: display.screenCount >= 4
                    }
                ]
            }
        ])

        if (activeScreenList.length > 0) {
            blankButton.disabled = false

            displaying = true
        } else {
            blankButton.active = false
            blankButton.disabled = true

            displaying = false
        }
    })

    //Keyboard shortcuts
    {
        const keyboardListeners = {}

        ipcRenderer.on('setting', (event, key, value) => {
            switch (key) {
                case 'control.keyboard.disableDisplay':
                    keyboard.unregister(keyboardListeners['dd'])

                    keyboardListeners['dd'] = keyboard.register(
                        value,
                        () => {
                            ipcRenderer.send('disable-display')
                        },
                        { repeat: false }
                    )
                    break
                case 'control.keyboard.toggleDisplayScreen1':
                    keyboard.unregister(keyboardListeners['s1'])

                    keyboardListeners['s1'] = keyboard.register(
                        value,
                        () => {
                            ipcRenderer.send('toggle-display-screen', 0)
                        },
                        { repeat: false }
                    )
                    break
                case 'control.keyboard.toggleDisplayScreen2':
                    keyboard.unregister(keyboardListeners['s2'])

                    keyboardListeners['s2'] = keyboard.register(
                        value,
                        () => {
                            ipcRenderer.send('toggle-display-screen', 1)
                        },
                        { repeat: false }
                    )
                    break
                case 'control.keyboard.toggleDisplayScreen3':
                    keyboard.unregister(keyboardListeners['s3'])

                    keyboardListeners['s3'] = keyboard.register(
                        value,
                        () => {
                            ipcRenderer.send('toggle-display-screen', 2)
                        },
                        { repeat: false }
                    )
                    break
                case 'control.keyboard.toggleDisplayScreen4':
                    keyboard.unregister(keyboardListeners['s4'])

                    keyboardListeners['s4'] = keyboard.register(
                        value,
                        () => {
                            ipcRenderer.send('toggle-display-screen', 3)
                        },
                        { repeat: false }
                    )
                    break
            }
        })

        ipcRenderer.send('get-settings', [
            ['control.keyboard.disableDisplay', 'Escape'],

            ['control.keyboard.toggleDisplayScreen1', 'Alt+Shift+Digit1'],
            ['control.keyboard.toggleDisplayScreen2', 'Alt+Shift+Digit2'],
            ['control.keyboard.toggleDisplayScreen3', 'Alt+Shift+Digit3'],
            ['control.keyboard.toggleDisplayScreen4', 'Alt+Shift+Digit4']
        ])
    }
}

//======================
//Add Block
//======================
const item_add = {
    //310x465 fits text without any overflow
    minWidth: 310,
    minHeight: 465,

    main: new layout.Block(
        {},
        {
            direction: 'vertical'
        }
    ),

    options: {
        tab: 'Song',
        template: 'Default'
    }
}
{
    let songBlock = new layout.Block(
        {
            childSpacing: 8
        },
        {
            direction: 'vertical',
            paddingBottom: 0
        }
    )
    let textBlock = new layout.Block(
        {
            childSpacing: 8
        },
        {
            direction: 'vertical',
            paddingBottom: 0
        }
    )
    let imageBlock = new layout.Block(
        {
            childSpacing: 8
        },
        {
            direction: 'vertical',
            paddingBottom: 0
        }
    )
    let pdfBlock = new layout.Block(
        {
            childSpacing: 8
        },
        {
            direction: 'vertical',
            paddingBottom: 0
        }
    )

    let tabBlock = new layout.TabBlock({
        tabs: [
            {
                name: 'Song',
                content: songBlock
            },
            {
                name: 'Text',
                content: textBlock
            },
            {
                name: 'Image',
                content: imageBlock
            },
            {
                name: 'PDF',
                content: pdfBlock
            }
        ]
    })
    tabBlock.tab = item_add.options.tab

    tabBlock.onEvent('switch', event => {
        item_add.options.tab = event.tab.name

        if (typeof item_add.onOption === 'function') {
            item_add.onOption.call(null, 'tab', event.tab.name)
        }
    })

    let addButton = new layout.Button(
        {
            text: 'Add'
        },
        {}
    )

    let templateSelect = new layout.SelectInput({}, {})
    let templateEditorButton = new layout.Button({
        icon: 'edit'
    })

    item_add.main.add(tabBlock)
    item_add.main.add(
        new layout.Block(
            {
                items: [addButton, templateSelect, templateEditorButton],
                childSpacing: 8
            },
            {
                direction: 'horizontal',
                justify: 'end',
                shrink: false,
                grow: false,

                paddingTop: 0
            }
        )
    )

    const Templates = new Database.Group('templates', {
        load: true,
        parse: true
    })

    let selectedTemplate = false

    //templates
    {
        let defaultTemplate = null

        function addDefaultTemplate() {
            if (defaultTemplate) {
                defaultTemplate.ID = Templates.getUniqueID('t')
                Templates.save('t', defaultTemplate.ID, defaultTemplate)
            } else {
                fs.readFile(
                    path.join(__dirname, '../', 'default-template.json'),
                    (error, data) => {
                        if (error) {
                            logger.error(
                                'Unable to load default template!',
                                error
                            )

                            layout.dialog.showNotification({
                                type: 'error',
                                message:
                                    'Unable to set default template!\nYour version of Display Whisper may be corrupt!'
                            })

                            return false
                        }

                        try {
                            data = JSON.parse(data)
                        } catch (error) {
                            logger.error(
                                'Unable to load default template!',
                                error
                            )

                            layout.dialog.showNotification({
                                type: 'error',
                                message:
                                    'Unable to set default template!\nYour version of Display Whisper may be corrupt!'
                            })

                            return false
                        }

                        defaultTemplate = data
                        addDefaultTemplate()
                    }
                )
            }
        }

        Templates.onEvent('update', () => {
            if (Templates.list.length === 0) {
                addDefaultTemplate()

                return false
            }

            let lastSelected = templateSelect.value

            let allTemplates = Templates.list.map(template => template.name)

            templateSelect.options = allTemplates

            if (allTemplates.includes(lastSelected)) {
                templateSelect.value = lastSelected
            } else {
                templateSelect.index = 0
            }
        })

        Templates.onEvent('error', error => {
            layout.dialog.showNotification({
                type: 'error',
                autoHide: false,

                message:
                    'There is an error with the Template database!\n' +
                    error.message
            })
        })

        templateEditorButton.onEvent('click', () => {
            layout.window.openWindow('templateEditor')
        })

        templateSelect.onEvent('change', event => {
            if (event.index < 0 || event.index >= Templates.list.length) {
                return false
            }

            selectedTemplate = Templates.list[event.index]

            ipcRenderer.send(
                'set-setting',
                'general.defaultTemplate',
                event.value
            )
        })

        let defaultTemplateListenerFunc = (event, key, value) => {
            if (key === 'general.defaultTemplate') {
                ipcRenderer.removeListener(
                    'setting',
                    defaultTemplateListenerFunc
                )

                if (Templates.updating) {
                    Templates.onceEvent('update', () => {
                        templateSelect.value = value
                    })
                } else {
                    templateSelect.value = value
                }
            }
        }

        ipcRenderer.on('setting', defaultTemplateListenerFunc)
        ipcRenderer.send('get-setting', 'general.defaultTemplate')
    }

    item_add.setOption = (name, value) => {
        if (name === 'tab') {
            tabBlock.tab = item_add.options.tab = value
        }
    }

    //song add
    {
        const punctuationCharacters = new RegExp(/[\(\)\-\[\]!"&'+,.:;?_`]/g)

        const Songs = new Database.Group('songs', {
            load: true,
            parse: true,
            transform: data => {
                if (typeof data.name !== 'string') {
                    data.name = ''
                }
                data._name = data.name
                    .toLowerCase()
                    .replace(punctuationCharacters, '')

                if (typeof data.author !== 'string') {
                    data.author = ''
                }
                data._author = data.author
                    .toLowerCase()
                    .replace(punctuationCharacters, '')

                if (typeof data.copyright !== 'string') {
                    data.copyright = ''
                }
                data._copyright = data.copyright
                    .toLowerCase()
                    .replace(punctuationCharacters, '')

                if (!Array.isArray(data.playOrder)) {
                    data.playOrder = []
                }
                if (typeof data.sections !== 'object') data.sections = {}

                data._content = ''
                let added = []
                for (let i = 0; i < data.playOrder.length; i++) {
                    if (!added.includes(data.playOrder[i])) {
                        added.push(data.playOrder[i])
                        if (
                            typeof data.sections[data.playOrder[i]] === 'object'
                        ) {
                            if (
                                typeof data.sections[data.playOrder[i]]
                                    .plainText === 'string'
                            ) {
                                data._content +=
                                    data.sections[
                                        data.playOrder[i]
                                    ].plainText.toLowerCase() + '\n'
                            } else if (
                                typeof data.sections[data.playOrder[i]].text ===
                                'string'
                            ) {
                                data._content +=
                                    data.sections[
                                        data.playOrder[i]
                                    ].plainText.toLowerCase() + '\n'
                            }
                        }
                    }
                }

                data._all = [
                    data._name,
                    data._author,
                    data._copyright,
                    data._content.replace(punctuationCharacters, '')
                ].join('\n')

                if (typeof data._group === 'string') {
                    data.group = data._group
                }
                if (typeof data._ID === 'number') {
                    data.groupID = data._ID
                }

                return data
            }
        })

        const songAddOptions = {
            startBlank: true,
            showIntro: false,
            showOutro: false,
            endBlank: true,

            warnMissingInfo: true
        }

        let updateButton = new layout.Button(
            {
                text: 'Update'
            },
            {
                align: 'center'
            }
        )
        let updateBlock = new layout.Block(
            {
                items: [
                    new layout.Text(
                        {
                            text:
                                'Songs have been modified!\nSearch results not be the same as saved library content.'
                        },
                        {
                            align: 'center'
                        }
                    ),
                    updateButton
                ],
                childSpacing: 8
            },
            {
                direction: 'vertical',
                grow: false,
                shrink: false,

                padding: 0
            }
        )
        updateBlock.visible = false

        let libraryEmptyBlock = new layout.Block(
            {
                items: [
                    new layout.Text(
                        {
                            text: 'Library is empty.'
                        },
                        {
                            size: '100%',

                            align: 'center'
                        }
                    ),
                    new layout.Button({
                        text: 'Add',
                        onClick: () => {
                            layout.window.openWindow('songAdd')
                        }
                    }),
                    new layout.Button({
                        text: 'Import',
                        onClick: () => {
                            layout.window.openWindow('songImport')
                        }
                    })
                ],
                childSpacing: 8
            },
            {
                direction: 'horizontal',
                grow: false,
                shrink: false,

                justify: 'center',
                wrap: true,

                padding: 0
            }
        )
        libraryEmptyBlock.visible = false

        let searchBox = new layout.TextInput(
            {
                placeholder: 'Search'
            },
            {
                size: '100%',
                grow: true,
                shrink: true
            }
        )

        let optionsButton = new layout.Button(
            {
                icon: 'settings',
                toggle: true
            },
            {}
        )

        let options = {
            name: new layout.CheckboxInput({
                label: 'Name',
                value: true
            }),
            author: new layout.CheckboxInput({ label: 'Author' }),
            copyright: new layout.CheckboxInput({ label: 'Copyright' }),
            content: new layout.CheckboxInput({ label: 'Content' }),
            groups: new layout.TextInput(
                { placeholder: 'Groups' },
                {
                    width: '8ch'
                }
            )
        }

        let optionsBlock = new layout.Block(
            {
                childSpacing: 8,
                items: [
                    options.name,
                    options.author,
                    options.copyright,
                    options.content,
                    options.groups
                ]
            },
            {
                direction: 'horizontal',
                grow: false,
                shrink: false,
                wrap: true,

                padding: 0
            }
        )

        let resultsBox = new layout.TableList(
            {
                drag: true,
                popup: true,

                columns: 4,
                columnWidths: ['65%', '35%', '3ch', '5ch']
            },
            {
                size: '100%',
                align: 'stretch'
            }
        )

        songBlock.add(
            new layout.Block(
                {
                    childSpacing: 8,
                    items: [searchBox, optionsButton]
                },
                {
                    direction: 'horizontal',
                    grow: false,
                    shrink: false,

                    padding: 0
                }
            )
        )
        songBlock.add(optionsBlock)

        songBlock.add(updateBlock)
        songBlock.add(libraryEmptyBlock)

        songBlock.add(resultsBox)

        let results = []

        let song = false

        let filters = {
            all: function(item) {
                return item._all.includes(this)
            },

            name: function(item) {
                return item._name.includes(this)
            },
            author: function(item) {
                return item._author.includes(this)
            },
            copyright: function(item) {
                return item._copyright.includes(this)
            },
            content: function(item) {
                return item._content.includes(this)
            },

            name_author: function(item) {
                return item._name.includes(this) || item._author.includes(this)
            },
            name_author_copyright: function(item) {
                return (
                    item._name.includes(this) ||
                    item._author.includes(this) ||
                    item._copyright.includes(this)
                )
            },
            name_author_content: function(item) {
                return (
                    item._name.includes(this) ||
                    item._author.includes(this) ||
                    item._content.includes(this)
                )
            },
            name_copyright: function(item) {
                return (
                    item._name.includes(this) || item._copyright.includes(this)
                )
            },
            name_copyright_content: function(item) {
                return (
                    item._name.includes(this) ||
                    item._copyright.includes(this) ||
                    item._content.includes(this)
                )
            },
            name_content: function(item) {
                return item._name.includes(this) || item._content.includes(this)
            },

            author_copyright: function(item) {
                return (
                    item._author.includes(this) ||
                    item._copyright.includes(this)
                )
            },
            author_copyright_content: function(item) {
                return (
                    item._author.includes(this) ||
                    item._copyright.includes(this) ||
                    item._content.includes(this)
                )
            },
            author_content: function(item) {
                return (
                    item._author.includes(this) || item._content.includes(this)
                )
            },

            copyright_content: function(item) {
                return (
                    item._copyright.includes(this) ||
                    item._content.includes(this)
                )
            }
        }

        let lastUpdateTime = 0
        const minUpdateTime = 0.5 * 1000

        function updateSearch() {
            lastUpdateTime = Date.now()

            resultsBox.clear()
            results = []

            song = false

            if (tabBlock.tab === 'Song') {
                //Since the results have been cleared, no song can be selected, and the add button should be disabled
                addButton.disabled = true
            }

            let searchTerm = searchBox.value
                .replace(punctuationCharacters, '')
                .trim()
                .toLowerCase()

            if (searchTerm.length === 0) {
                return
            }

            if (
                options.name.value &&
                options.author.value &&
                options.copyright.value &&
                options.content.value
            ) {
                results = Songs.list.filter(filters.all, searchTerm)
            } else {
                let filterName = []

                if (options.name.value) {
                    filterName.push('name')
                }
                if (options.author.value) {
                    filterName.push('author')
                }
                if (options.copyright.value) {
                    filterName.push('copyright')
                }
                if (options.content.value) {
                    filterName.push('content')
                }

                if (filterName.length === 0) {
                    filterName.push('all')
                }

                filterName = filterName.join('_')

                results = Songs.list.filter(filters[filterName], searchTerm)
            }

            if (options.groups.value) {
                let groups = options.groups.value
                    .split(',')
                    .reduce((newArr, current) => {
                        current = current.trim().toLowerCase()

                        if (current) {
                            newArr.push(current)
                        }

                        return newArr
                    }, [])

                if (groups.length > 0) {
                    results = results.filter(song =>
                        groups.includes(song.group.trim().toLowerCase())
                    )
                }
            }

            for (let i = 0; i < results.length; i++) {
                resultsBox.add([
                    results[i].name,
                    results[i].author,
                    results[i].group,
                    results[i].groupID
                ])
            }
        }

        function requestUpdateSearch() {
            if (Date.now() - lastUpdateTime >= minUpdateTime) {
                updateSearch()
            } else {
                setTimeout(() => {
                    if (Date.now() - lastUpdateTime >= minUpdateTime) {
                        updateSearch()
                    }
                }, minUpdateTime - (Date.now() - lastUpdateTime) + 20) //extra 20 milliseconds just to make sure theres no problems
            }
        }

        function onSearchOptionChange() {
            if (
                !options.name.value &&
                !options.author.value &&
                !options.copyright.value &&
                !options.content.value
            ) {
                options.name.value = true

                return
            }

            requestUpdateSearch()
        }

        function warnUserMissingInfo(song) {
            if (!songAddOptions.warnMissingInfo) {
                return false
            }

            let missing = []

            if (song.name.trim() === '') {
                missing.push('name')
            }
            if (song.author.trim() === '') {
                missing.push('author')
            }
            if (song.copyright.trim() === '') {
                missing.push('copyright')
            }

            if (missing.length === 0) {
                return false
            }

            message = 'The selected song'

            if (song.name.trim() !== '') {
                message += ' "' + song.name.trim() + '"'
            }

            message += ' (' + song.group + '-' + song.groupID.toString() + ')'
            message += ', is missing '

            if (missing.length === 1) {
                message += missing[0]
            } else {
                //If there's more than one thing missing, "and" needs to be included before the last one
                message += missing.slice(0, missing.length - 1).join(', ')

                if (missing.length > 2) {
                    message += ','
                }

                message += ' and ' + missing[missing.length - 1]
            }

            message += ' information!'

            layout.dialog.showNotification({
                type: 'error',
                message: message,

                autoHide: false
            })
        }

        function getSongPopupText(song) {
            let text = ''

            let displayedSections = []

            for (let i = 0; i < song.playOrder.length; i++) {
                if (
                    song.sections.hasOwnProperty(song.playOrder[i]) &&
                    !displayedSections.includes(song.playOrder[i])
                ) {
                    text +=
                        richText.clean(
                            '<sub><i>' + richText.format(song.playOrder[i])
                        ) + '\n'
                    text += song.sections[song.playOrder[i]].text + '\n\n'

                    displayedSections.push(song.playOrder[i])
                }
            }

            return { text: text.slice(0, -2), title: song.name }
        }

        function addSong(songData, index = -1) {
            for (let key in songAddOptions) {
                selectedTemplate[key] = songAddOptions[key]
            }

            presentation.add(songData, selectedTemplate, index)

            warnUserMissingInfo(songData)
        }

        layout.contextMenu.add('song-add', [
            {
                label: 'Add to Presentation (End)',
                value: 'add-end'
            },
            {
                label: 'Add to Presentation (Start)',
                value: 'add-start'
            },
            {
                label: 'Edit in Library...',
                value: 'edit'
            }
        ])

        optionsBlock.visible = false
        optionsButton.onEvent(
            'toggle',
            event => (optionsBlock.visible = event.active)
        )

        Songs.onEvent('update', () => {
            layout.hideLoader(resultsBox)

            updateBlock.visible = false

            updateSearch()

            if (Songs.list.length === 0) {
                libraryEmptyBlock.visible = true

                searchBox.disabled = true
                optionsButton.disabled = true
                options.name.disabled = true
                options.author.disabled = true
                options.copyright.disabled = true
                options.content.disabled = true
            } else {
                libraryEmptyBlock.visible = false

                searchBox.disabled = false
                optionsButton.disabled = false
                options.name.disabled = false
                options.author.disabled = false
                options.copyright.disabled = false
                options.content.disabled = false
            }
        })
        Songs.onEvent('update-start', () => {
            layout.showLoader(resultsBox)

            searchBox.disabled = true
            optionsButton.disabled = true
            options.name.disabled = true
            options.author.disabled = true
            options.copyright.disabled = true
            options.content.disabled = true
        })
        Songs.onEvent('update-needed', () => {
            updateBlock.visible = true
        })
        layout.showLoader(resultsBox, false)

        Songs.onEvent('error', error => {
            layout.dialog.showNotification({
                type: 'error',
                autoHide: false,

                message:
                    'There is an error with the Song database!\n' +
                    error.message
            })
        })

        updateButton.onEvent('click', () => {
            Songs.update()
            updateBlock.visible = false
        })

        searchBox.onEvent('change', requestUpdateSearch)

        options.name.onEvent('change', onSearchOptionChange)
        options.author.onEvent('change', onSearchOptionChange)
        options.copyright.onEvent('change', onSearchOptionChange)
        options.content.onEvent('change', onSearchOptionChange)
        options.groups.onEvent('change', onSearchOptionChange)

        resultsBox.onEvent('select', event => {
            song = results.find(item => {
                return (
                    item.group === event.text[2] &&
                    item.groupID.toString() === event.text[3]
                )
            })

            if (song) {
                song.itemType = 'song'

                addButton.disabled = false
            } else {
                addButton.disabled = true
            }
        })

        resultsBox.onEvent('popup', event => {
            let popupSong = results.find(item => {
                return (
                    item.group === event.text[2] &&
                    item.groupID.toString() === event.text[3]
                )
            })

            if (popupSong) {
                resultsBox.popup(getSongPopupText(popupSong))
            }
        })

        resultsBox.onEvent('drag', event => {
            song = results.find(item => {
                return (
                    item.group === event.text[2] &&
                    item.groupID.toString() === event.text[3]
                )
            })

            if (song) {
                song.itemType = 'song'

                for (let key in songAddOptions) {
                    selectedTemplate[key] = songAddOptions[key]
                }

                presentation.addDrop(song, selectedTemplate)

                warnUserMissingInfo(song)
            }
        })

        resultsBox.onEvent('enter', event => {
            song = results.find(item => {
                return (
                    item.group === event.text[2] &&
                    item.groupID.toString() === event.text[3]
                )
            })

            if (song) {
                song.itemType = 'song'

                for (let key in songAddOptions) {
                    selectedTemplate[key] = songAddOptions[key]
                }

                presentation.add(song, selectedTemplate, songAddOptions)

                warnUserMissingInfo(song)
            }
        })

        resultsBox.onEvent('contextmenu', event => {
            if (song) {
                layout.contextMenu.enable('song-add')
            }
        })

        layout.contextMenu.onEvent('song-add', event => {
            if (song) {
                if (event.value === 'add-end') {
                    addSong(song)
                } else if (event.value === 'add-start') {
                    addSong(song, 0)
                } else if (event.value === 'edit') {
                    layout.window.openWindow('songDatabase', [
                        'show-song',
                        song.group,
                        song.groupID
                    ])
                }
            }
        })

        addButton.onEvent('click', () => {
            if (item_add.options.tab !== 'Song') {
                return false
            }

            if (song) {
                addSong(song)
            }
        })
        addButton.onEvent('drag', () => {
            if (item_add.options.tab !== 'Song') {
                return false
            }

            if (song) {
                for (let key in songAddOptions) {
                    selectedTemplate[key] = songAddOptions[key]
                }
                presentation.addDrop(song, selectedTemplate)
                warnUserMissingInfo(song)
            }
        })

        tabBlock.onEvent('switch', event => {
            if (event.tab.name === 'Song' && event.fromUser) {
                searchBox.focus()

                if (resultsBox.selected && song) {
                    addButton.disabled = false
                } else {
                    addButton.disabled = true
                }
            }
        })

        ipcRenderer.on('setting', (event, key, value) => {
            switch (key) {
                case 'general.autoUpdateSongs':
                    Songs.autoUpdate = value
                    break
                case 'songs.startBlank':
                    songAddOptions.startBlank = value
                    break
                case 'songs.showIntro':
                    songAddOptions.showIntro = value
                    break
                case 'songs.showOutro':
                    songAddOptions.showOutro = value
                    break
                case 'songs.endBlank':
                    songAddOptions.endBlank = value
                    break

                case 'songs.warnMissingInfo':
                    songAddOptions.warnMissingInfo = value
            }
        })

        ipcRenderer.send('get-settings', [
            ['general.autoUpdateSongs', true],

            ['songs.startBlank', true],
            ['songs.showIntro', false],
            ['songs.showOutro', false],
            ['songs.endBlank', true],

            ['songs.warnMissingInfo', true]
        ])
    }
    //text add
    {
        const styleEditor = new layout.TextStyleEdit(
            {},
            {
                align: 'stretch'
            }
        )
        textBlock.add(styleEditor)

        const boxEditor = new layout.BoxStyleEdit({})

        textBlock.add(boxEditor)

        const fitTextButton = new layout.Button({
            text: 'Scale Text'
        })
        textBlock.add(fitTextButton)

        const preview = new layout.DisplayEdit(
            {},
            {
                shrink: true,
                grow: true,
                size: 'auto',

                border: true,
                background: true
            }
        )
        textBlock.add(preview)

        const textEditor = preview.add({
            type: 'text'
        })

        textEditor.connect(styleEditor)
        textEditor.connect(boxEditor)

        fitTextButton.onEvent('click', () => {
            textEditor.fit()
        })

        templateSelect.onEvent('change', () => {
            preview.set(selectedTemplate)
            textEditor.set(selectedTemplate)
        })

        preview.onEvent('drag', () => {
            let textSection = textEditor.getData()
            textSection.name = 'Text 1'
            presentation.addDrop(
                {
                    itemType: 'text',
                    sections: [textSection]
                },
                selectedTemplate
            )
        })

        addButton.onEvent('drag', () => {
            if (item_add.options.tab !== 'Text') {
                return false
            }
            let textSection = textEditor.getData()
            textSection.name = 'Text 1'
            presentation.addDrop(
                {
                    itemType: 'text',
                    sections: [textSection]
                },
                selectedTemplate
            )
        })

        addButton.onEvent('click', () => {
            if (item_add.options.tab !== 'Text') {
                return false
            }
            let textSection = textEditor.getData()
            textSection.name = 'Text 1'
            presentation.add(
                {
                    itemType: 'text',
                    sections: [textSection]
                },
                selectedTemplate
            )
        })

        tabBlock.onEvent('switch', event => {
            if (event.tab.name === 'Text' && event.fromUser) {
                textEditor.focus()

                addButton.disabled = false
            }
        })
    }
    //image add
    {
        let imageEditor = new layout.ImageStyleEdit({})
        let boxEditor = new layout.BoxStyleEdit({
            align: false
        })

        imageBlock.add(imageEditor)
        imageBlock.add(boxEditor)

        let previewEditor = new layout.DisplayEdit(
            {},
            {
                shrink: true,
                grow: true,
                size: 'auto',

                border: true,
                background: true
            }
        )

        let image = previewEditor.add({ type: 'image' })

        image.url =
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAAAAABX3VL4AAAACXBIWXMAAAsTAAALEwEAmpwYAAAADklEQVQImWP+L8Uw8z8AB6wCtQYJB2cAAAAASUVORK5CYII='

        imageBlock.add(previewEditor)

        imageEditor.connect(image)
        boxEditor.connect(image)

        let imageMultiSelect = new layout.FileInput({
            open: true,

            text: 'Add Multiple',
            button: 'Add',

            multi: true,

            filters: [
                {
                    name: 'Images',
                    extensions: [
                        'png',
                        'jpg',
                        'jpeg',
                        'gif',
                        'tif',
                        'tiff',
                        'bmp'
                    ]
                }
            ]
        })

        imageBlock.add(imageMultiSelect)

        templateSelect.onEvent('change', () => {
            previewEditor.edit(selectedTemplate)
            image.edit(selectedTemplate)
        })

        imageMultiSelect.onEvent('open', event => {
            let imageData = image.getData()
            imageData.itemType = 'image'
            imageData.database = false

            for (let i = 0; i < event.files.length; i++) {
                imageData.url = event.files[i]

                presentation.add(imageData, selectedTemplate)
            }
        })

        previewEditor.onEvent('drag', () => {
            let imageData = image.getData()
            imageData.itemType = 'image'
            if (
                imageData.url.startsWith('data:image\\png;base64') &&
                !imageData.database
            ) {
                layout.dialog.showQuestion(
                    {
                        title: 'Add blank image?',
                        message: 'You have not selected an image.',
                        detail: 'Add blank image item?',
                        options: ['Yes', 'No']
                    },
                    (error, answer) => {
                        if (error) {
                            logger.error(
                                "Couldn't ask user if they want to add blank image",
                                error
                            )
                            return
                        }
                        if (answer === 'Yes') {
                            imageData.url = ''
                            presentation.addDrop(imageData, selectedTemplate)
                        }
                    }
                )
            } else {
                presentation.addDrop(imageData, selectedTemplate)
            }
        })

        addButton.onEvent('drag', () => {
            if (item_add.options.tab !== 'Image') {
                return false
            }

            let imageData = image.getData()
            imageData.itemType = 'image'
            if (
                imageData.url.startsWith('data:image\\png;base64') &&
                !imageData.database
            ) {
                layout.dialog.showQuestion(
                    {
                        title: 'Add blank image?',
                        message: 'You have not selected an image.',
                        detail: 'Add blank image item?',
                        options: ['Yes', 'No']
                    },
                    (error, answer) => {
                        if (error) {
                            logger.error(
                                "Couldn't ask user if they want to add blank image",
                                error
                            )
                            return
                        }
                        if (answer === 'Yes') {
                            imageData.url = ''
                            presentation.addDrop(imageData, selectedTemplate)
                        }
                    }
                )
            } else {
                presentation.addDrop(imageData, selectedTemplate)
            }
        })

        addButton.onEvent('click', () => {
            if (item_add.options.tab !== 'Image') {
                return false
            }
            let imageData = image.getData()
            imageData.itemType = 'image'
            if (
                imageData.url.startsWith('data:image\\png;base64') &&
                !imageData.database
            ) {
                layout.dialog.showQuestion(
                    {
                        title: 'Add blank image?',
                        message: 'You have not selected an image.',
                        detail: 'Add blank image item?',
                        options: ['Yes', 'No']
                    },
                    (error, answer) => {
                        if (error) {
                            logger.error(
                                "Couldn't ask user if they want to add blank image",
                                error
                            )
                            return
                        }
                        if (answer === 'Yes') {
                            imageData.url = ''
                            presentation.add(imageData, selectedTemplate)
                        }
                    }
                )
            } else {
                presentation.add(imageData, selectedTemplate)
            }
        })

        tabBlock.onEvent('switch', event => {
            if (event.tab.name === 'Image' && event.fromUser) {
                image.focus()

                addButton.disabled = false
            }
        })
    }
    //pdf add
    {
        let file = null

        let fileSelect = new layout.FileInput({
            text: 'Select PDF',

            filters: [{ name: 'PDF', extensions: ['pdf'] }],

            read: false
        })
        let backgroundEditor = new layout.ColorInput({
            label: 'Background'
        })

        pdfBlock.add(fileSelect)
        pdfBlock.add(backgroundEditor)

        let preview = new layout.Display(
            {},
            {
                shrink: true,
                grow: true,

                border: true,
                background: true
            }
        )
        preview.set({
            nodes: [
                {
                    type: 'pdf',

                    top: 0,
                    left: 0,
                    right: 100,
                    bottom: 100
                }
            ]
        })

        pdfBlock.add(preview)

        templateSelect.onEvent('change', () => {
            preview.update(selectedTemplate)

            backgroundEditor.value = preview.display.background
        })

        backgroundEditor.onEvent('change', event => {
            preview.update({
                background: event.value
            })
        })

        fileSelect.onEvent('open', event => {
            if (event.filename) {
                file = event.filename

                preview.update({
                    nodes: [
                        {
                            type: 'pdf',

                            file: file,
                            page: 1,

                            top: 0,
                            left: 0,
                            right: 100,
                            bottom: 100
                        }
                    ]
                })

                addButton.disabled = false
            }
        })

        preview.onEvent('drag', () => {
            presentation.addDrop(
                {
                    itemType: 'pdf',

                    file: file,

                    background: preview.display.background
                },
                selectedTemplate
            )
        })

        addButton.onEvent('drag', () => {
            if (item_add.options.tab !== 'PDF') {
                return false
            }

            if (!file) {
                addButton.disabled = true
                return false
            }

            presentation.addDrop(
                {
                    itemType: 'pdf',

                    file: file,

                    background: preview.display.background
                },
                selectedTemplate
            )
        })
        addButton.onEvent('click', () => {
            if (item_add.options.tab !== 'PDF') {
                return false
            }

            if (!file) {
                addButton.disabled = true
                return false
            }

            presentation.add(
                {
                    itemType: 'pdf',

                    file: file,

                    background: preview.display.background
                },
                selectedTemplate
            )
        })

        tabBlock.onEvent('switch', event => {
            if (event.tab.name === 'PDF' && event.fromUser) {
                if (file) {
                    addButton.disabled = false
                } else {
                    addButton.disabled = true
                }
            }
        })
    }
}

//======================
//Control Block
//======================
const item_control = {
    minWidth: 410,
    minHeight: 72,
    maxHeight: 72,

    main: new layout.Block(
        {},
        {
            padding: 4,
            direction: 'vertical'
        }
    ),

    options: {
        playMode: 'Auto',
        playLoop: false,
        playShuffle: false
    }
}
{
    layout.change(timer, { margin: 4 })

    let loopInput = new layout.CheckboxInput(
        {
            tooltip: 'Loop',
            label: 'Loop'
        },
        {
            margin: 4
        }
    )
    let shuffleInput = new layout.CheckboxInput(
        {
            tooltip: 'Shuffle',
            label: 'Shuffle'
        },
        {
            margin: 4
        }
    )
    let modeSelect = new layout.SelectInput(
        {
            tooltip: 'Mode',
            options: ['Auto', 'Manual']
        },
        {
            width: 52,
            margin: 4
        }
    )

    let firstButton = new layout.Button(
        {
            icon: 'play-first'
        },
        {
            margin: 4
        }
    )
    let prevButton = new layout.Button(
        {
            icon: 'play-previous'
        },
        {
            margin: 4,
            marginLeft: 0,
            marginRight: 0
        }
    )
    let nextButton = new layout.Button(
        {
            icon: 'play-next'
        },
        {
            margin: 4,
            marginLeft: 0,
            marginRight: 0
        }
    )
    let lastButton = new layout.Button(
        {
            icon: 'play-last'
        },
        {
            margin: 4
        }
    )

    item_control.main.add(timer)
    item_control.main.add(
        new layout.Block(
            {
                items: [
                    firstButton,
                    prevButton,
                    nextButton,
                    lastButton,
                    new layout.Filler(),
                    blankButton,
                    new layout.Filler(),
                    shuffleInput,
                    loopInput,
                    modeSelect
                ]
            },
            {
                direction: 'horizontal',
                grow: false,
                shrink: false
            }
        )
    )

    loopInput.onEvent('change', event => {
        presentation.setPlayMode(modeSelect.value.toLowerCase(), {
            loop: event.value
        })

        if (typeof item_control.onOption === 'function') {
            item_control.onOption.call(null, 'playLoop', event.value)
        }
    })
    shuffleInput.onEvent('change', event => {
        presentation.setPlayMode(modeSelect.value.toLowerCase, {
            shuffle: event.value
        })

        if (typeof item_control.onOption === 'function') {
            item_control.onOption.call(null, 'playShuffle', event.value)
        }
    })
    modeSelect.onEvent('change', event => {
        presentation.setPlayMode(event.value.toLowerCase())

        if (typeof item_control.onOption === 'function') {
            item_control.onOption.call(null, 'playMode', event.value)
        }
    })

    firstButton.onEvent('click', () => {
        presentation.beginFirst()
    })
    prevButton.onEvent('click', () => {
        presentation.back()
    })
    nextButton.onEvent('click', () => {
        presentation.forward()
    })
    lastButton.onEvent('click', () => {
        presentation.beginLast()
    })

    blankButton.onEvent('click', event => {
        if (!displaying) {
            blankButton.active = false
            blankButton.disabled = true

            return false
        }

        if (!event.fromUser) {
            blankButton.active = !blankButton.active
        }

        ipcRenderer.send('display-blank', blankButton.active)
    })
    undoRemoveButton.onEvent('click', presentation.undoRemove)
    layout.menu.onEvent('edit', item => {
        if (item.value === 'undo') {
            presentation.undoRemove()
        }
    })

    item_control.setOption = (name, value) => {
        if (name === 'playMode') {
            modeSelect.value = item_control.options.playMode = value
        } else if (name === 'playLoop') {
            loopInput.value = item_control.options.playLoop = value
        } else if (name === 'playShuffle') {
            shuffleInput.value = item_control.options.playShuffle = value
        }
    }

    modeSelect.value = 'Auto'

    ipcRenderer.on('display-blank', (event, blank) => {
        blankButton.active = blank
    })

    //keyboard shortcuts
    {
        let repeatShortcuts = false

        const shortcutFunctions = {
            'control.keyboard.toggleBlank': blankButton.click,

            'control.keyboard.playNext': presentation.forward,
            'control.keyboard.playPrevious': presentation.back,

            'control.keyboard.selectNext': presentation.selectForward,
            'control.keyboard.selectPrevious': presentation.selectBack,
            'control.keyboard.selectNextItem': presentation.selectItemForward,
            'control.keyboard.selectPreviousItem':
                presentation.selectItemBackward,

            'control.keyboard.playSelected': presentation.playSelected,

            'control.keyboard.moveSelectedUp': presentation.moveSelectedUp,
            'control.keyboard.moveSelectedDown': presentation.moveSelectedDown,
            'control.keyboard.moveSelectedTop': presentation.moveSelectedTop,
            'control.keyboard.moveSelectedBottom':
                presentation.moveSelectedBottom
        }

        const keyboardListeners = {}

        ipcRenderer.on('setting', (event, key, value) => {
            if (key === 'control.keyboard.repeat') {
                repeatShortcuts = value

                ipcRenderer.send('get-settings', Object.keys(shortcutFunctions))
            } else if (shortcutFunctions.hasOwnProperty(key)) {
                keyboard.unregister(keyboardListeners[key])

                keyboardListeners[key] = keyboard.register(
                    value,
                    shortcutFunctions[key],
                    {
                        repeat: repeatShortcuts
                    }
                )
            }
        })

        ipcRenderer.send('get-settings', [
            ['control.keyboard.repeat', false],

            ['control.keyboard.toggleBlank', 'Period'],
            ['control.keyboard.playNext', 'Space'],
            ['control.keyboard.playPrevious', 'Control+Space'],
            ['control.keyboard.selectNext', 'ArrowDown'],
            ['control.keyboard.selectPrevious', 'ArrowUp'],
            ['control.keyboard.selectNextItem', 'Control+ArrowDown'],
            ['control.keyboard.selectPreviousItem', 'Control+ArrowUp'],
            ['control.keyboard.playSelected', 'Enter'],

            ['control.keyboard.moveSelectedUp', 'PageUp'],
            ['control.keyboard.moveSelectedDown', 'PageDown'],
            ['control.keyboard.moveSelectedTop', 'Control+PageUp'],
            ['control.keyboard.moveSelectedBottom', 'Control+PageDown']
        ])
    }
}

//Preview context menu:
let activePreviewContextMenu = -1
layout.contextMenu.add('preview-display', [
    {
        label: 'Show',
        submenu: [
            {
                label: 'Active',
                type: 'checkbox'
            },
            {
                label: 'Preview',
                type: 'checkbox'
            },
            {
                label: 'Previous',
                type: 'checkbox'
            },
            {
                label: 'Next',
                type: 'checkbox'
            }
        ]
    }
])

//======================
//Preview (1) Block
//======================
const item_display1 = {
    //242 fits the four option buttons
    minWidth: 242,
    minHeight: 100,

    main: new layout.Block(
        {},
        {
            direction: 'vertical',
            overflow: 'hidden'
        }
    ),

    options: { type: 'active' }
}
{
    let display = new layout.Display(
        {},
        {
            grow: true,
            align: 'stretch',

            background: true,
            border: true
        }
    )

    let showButtons = {
        active: new layout.Button(
            {
                text: 'Active'
            },
            {}
        ),
        previous: new layout.Button(
            {
                text: 'Previous'
            },
            {}
        ),
        next: new layout.Button(
            {
                text: 'Next'
            },
            {}
        ),
        preview: new layout.Button(
            {
                text: 'Preview'
            },
            {}
        )
    }

    showButtons[item_display1.options.type].active = true

    item_display1.main.add(display)
    item_display1.main.add(
        new layout.Block(
            {
                items: [
                    showButtons.active,
                    showButtons.preview,
                    showButtons.previous,
                    showButtons.next
                ],
                childSpacing: 4
            },
            {
                shrink: false,
                grow: false
            }
        )
    )

    changeDisplay(display, item_display1.options.type)

    item_display1.setOption = (name, value) => {
        if (name === 'type') {
            if (showButtons[value]) {
                showButtons[value].click()
            }
        }
    }

    function setType(type) {
        showButtons[item_display1.options.type].active = false
        item_display1.options.type = type

        changeDisplay(display, type)

        showButtons[type].active = true

        if (typeof item_display1.onOption === 'function') {
            item_display1.onOption.call(null, 'type', type)
        }
    }

    display.onEvent('contextmenu', () => {
        activePreviewContextMenu = 1

        layout.contextMenu.change('preview-display', [
            {
                submenu: [
                    {
                        checked: item_display1.options.type === 'active'
                    },
                    {
                        checked: item_display1.options.type === 'preview'
                    },
                    {
                        checked: item_display1.options.type === 'previous'
                    },
                    {
                        checked: item_display1.options.type === 'next'
                    }
                ]
            }
        ])

        layout.contextMenu.enable('preview-display')
    })

    layout.contextMenu.onEvent('preview-display', event => {
        if (activePreviewContextMenu !== 1) {
            return false
        }

        setType(event.label.toLowerCase())
    })

    showButtons.active.onEvent('click', setType.bind(null, 'active'))
    showButtons.previous.onEvent('click', setType.bind(null, 'previous'))
    showButtons.next.onEvent('click', setType.bind(null, 'next'))
    showButtons.preview.onEvent('click', setType.bind(null, 'preview'))
}

//======================
//Preview (2) Block
//======================
const item_display2 = {
    //242 fits the four option buttons
    minWidth: 242,
    minHeight: 100,

    main: new layout.Block(
        {},
        {
            direction: 'vertical',
            overflow: 'hidden'
        }
    ),

    options: { type: 'next' }
}
{
    let display = new layout.Display(
        {},
        {
            grow: true,
            align: 'stretch',

            background: true,
            border: true
        }
    )

    let showButtons = {
        active: new layout.Button(
            {
                text: 'Active'
            },
            {}
        ),
        previous: new layout.Button(
            {
                text: 'Previous'
            },
            {}
        ),
        next: new layout.Button(
            {
                text: 'Next'
            },
            {}
        ),
        preview: new layout.Button(
            {
                text: 'Preview'
            },
            {}
        )
    }

    showButtons[item_display2.options.type].active = true

    item_display2.main.add(display)
    item_display2.main.add(
        new layout.Block(
            {
                items: [
                    showButtons.active,
                    showButtons.preview,
                    showButtons.previous,
                    showButtons.next
                ],
                childSpacing: 4
            },
            {
                shrink: false,
                grow: false
            }
        )
    )

    changeDisplay(display, item_display2.options.type)

    item_display2.setOption = (name, value) => {
        if (name === 'type') {
            if (showButtons[value]) {
                showButtons[value].click()
            }
        }
    }

    function setType(type) {
        showButtons[item_display2.options.type].active = false
        item_display2.options.type = type

        changeDisplay(display, type)

        showButtons[type].active = true

        if (typeof item_display2.onOption === 'function') {
            item_display2.onOption.call(null, 'type', type)
        }
    }

    display.onEvent('contextmenu', () => {
        activePreviewContextMenu = 2

        layout.contextMenu.change('preview-display', [
            {
                submenu: [
                    {
                        checked: item_display2.options.type === 'active'
                    },
                    {
                        checked: item_display2.options.type === 'preview'
                    },
                    {
                        checked: item_display2.options.type === 'previous'
                    },
                    {
                        checked: item_display2.options.type === 'next'
                    }
                ]
            }
        ])

        layout.contextMenu.enable('preview-display')
    })

    layout.contextMenu.onEvent('preview-display', event => {
        if (activePreviewContextMenu !== 2) {
            return false
        }

        setType(event.label.toLowerCase())
    })

    showButtons.active.onEvent('click', setType.bind(null, 'active'))
    showButtons.previous.onEvent('click', setType.bind(null, 'previous'))
    showButtons.next.onEvent('click', setType.bind(null, 'next'))
    showButtons.preview.onEvent('click', setType.bind(null, 'preview'))
}

/*
//======================
//Preview (3) Block
//======================
const item_display3 = {
    //242 fits the four option buttons
    minWidth: 242,
    minHeight: 100,

    main: new layout.Block(
        {},
        {
            direction: 'vertical',
            overflow: 'hidden'
        }
    ),

    options: { type: 'preview' }
}
{
    let display = new layout.Display(
        {},
        {
            grow: true,
            align: 'stretch',

            background: true,
            border: true
        }
    )

    let showButtons = {
        active: new layout.Button(
            {
                text: 'Active'
            },
            {}
        ),
        previous: new layout.Button(
            {
                text: 'Previous'
            },
            {}
        ),
        next: new layout.Button(
            {
                text: 'Next'
            },
            {}
        ),
        preview: new layout.Button(
            {
                text: 'Preview'
            },
            {}
        )
    }

    showButtons[item_display3.options.type].active = true

    item_display3.main.add(display)
    item_display3.main.add(
        new layout.Block(
            {
                items: [
                    showButtons.active,
                    showButtons.preview,
                    showButtons.previous,
                    showButtons.next
                ],
                childSpacing: 4
            },
            {
                shrink: false,
                grow: false
            }
        )
    )

    changeDisplay(display, item_display3.options.type)

    item_display3.setOption = (name, value) => {
        if (name === 'type') {
            if (showButtons[value]) {
                showButtons[value].click()
            }
        }
    }

    function setType(type) {
        showButtons[item_display3.options.type].active = false
        item_display3.options.type = type

        changeDisplay(display, type)

        showButtons[type].active = true

        if (typeof item_display3.onOption === 'function') {
            item_display3.onOption.call(null, 'type', type)
        }
    }

    display.onEvent('contextmenu', () => {
        activePreviewContextMenu = 3

        layout.contextMenu.change('preview-display', [
            {
                submenu: [
                    {
                        checked: item_display3.options.type === 'active'
                    },
                    {
                        checked: item_display3.options.type === 'preview'
                    },
                    {
                        checked: item_display3.options.type === 'previous'
                    },
                    {
                        checked: item_display3.options.type === 'next'
                    }
                ]
            }
        ])

        layout.contextMenu.enable('preview-display')
    })

    layout.contextMenu.onEvent('preview-display', event => {
        if (activePreviewContextMenu !== 3) {
            return false
        }

        setType(event.label.toLowerCase())
    })

    showButtons.active.onEvent('click', setType.bind(null, 'active'))
    showButtons.previous.onEvent('click', setType.bind(null, 'previous'))
    showButtons.next.onEvent('click', setType.bind(null, 'next'))
    showButtons.preview.onEvent('click', setType.bind(null, 'preview'))
}

//======================
//Preview (4) Block
//======================
const item_display4 = {
    //242 fits the four option buttons
    minWidth: 242,
    minHeight: 100,

    main: new layout.Block(
        {},
        {
            direction: 'vertical',
            overflow: 'hidden'
        }
    ),

    options: { type: 'previous' }
}
{
    let display = new layout.Display(
        {},
        {
            grow: true,
            align: 'stretch',

            background: true,
            border: true
        }
    )

    let showButtons = {
        active: new layout.Button(
            {
                text: 'Active'
            },
            {}
        ),
        previous: new layout.Button(
            {
                text: 'Previous'
            },
            {}
        ),
        next: new layout.Button(
            {
                text: 'Next'
            },
            {}
        ),
        preview: new layout.Button(
            {
                text: 'Preview'
            },
            {}
        )
    }

    showButtons[item_display4.options.type].active = true

    item_display4.main.add(display)
    item_display4.main.add(
        new layout.Block(
            {
                items: [
                    showButtons.active,
                    showButtons.preview,
                    showButtons.previous,
                    showButtons.next
                ],
                childSpacing: 4
            },
            {
                shrink: false,
                grow: false
            }
        )
    )

    changeDisplay(display, item_display4.options.type)

    item_display4.setOption = (name, value) => {
        if (name === 'type') {
            if (showButtons[value]) {
                showButtons[value].click()
            }
        }
    }

    function setType(type) {
        showButtons[item_display4.options.type].active = false
        item_display4.options.type = type

        changeDisplay(display, type)

        showButtons[type].active = true

        if (typeof item_display4.onOption === 'function') {
            item_display4.onOption.call(null, 'type', type)
        }
    }

    display.onEvent('contextmenu', () => {
        activePreviewContextMenu = 4

        layout.contextMenu.change('preview-display', [
            {
                submenu: [
                    {
                        checked: item_display4.options.type === 'active'
                    },
                    {
                        checked: item_display4.options.type === 'preview'
                    },
                    {
                        checked: item_display4.options.type === 'previous'
                    },
                    {
                        checked: item_display4.options.type === 'next'
                    }
                ]
            }
        ])

        layout.contextMenu.enable('preview-display')
    })

    layout.contextMenu.onEvent('preview-display', event => {
        if (activePreviewContextMenu !== 4) {
            return false
        }

        setType(event.label.toLowerCase())
    })

    showButtons.active.onEvent('click', setType.bind(null, 'active'))
    showButtons.previous.onEvent('click', setType.bind(null, 'previous'))
    showButtons.next.onEvent('click', setType.bind(null, 'next'))
    showButtons.preview.onEvent('click', setType.bind(null, 'preview'))
}
*/

layout.contextMenu.add(
    'library',
    [
        {
            label: 'Open Image Library...',
            window: 'imageDatabase'
        },
        {
            label: 'Open Song Library...',
            window: 'songDatabase'
        },
        {
            label: 'Open Template Editor...',
            window: 'templateEditor'
        }
    ],
    true
)

//**********************
//Dynamic interface layout...
//**********************

//Name to element mappings:
const interfaceItems = {
    menu: item_menu,
    add: item_add,
    playlist: item_presentation,
    control: item_control,
    'preview 1': item_display1,
    'preview 2': item_display2
    /*
    'preview 3': item_display3,
    'preview 4': item_display4
    */
}

//Loading, displaying, & updating layout:
{
    const defaultLayout = {
        direction: 'vertical',
        size: 100,

        items: [
            {
                item: 'menu',
                size: 10
            },
            {
                direction: 'horizontal',
                size: 90,
                items: [
                    {
                        item: 'add',
                        size: 30
                    },
                    {
                        direction: 'vertical',
                        size: 50,
                        items: [
                            {
                                item: 'playlist',
                                size: 50
                            },
                            {
                                item: 'control',
                                size: 50
                            }
                        ]
                    },
                    {
                        direction: 'vertical',
                        size: 20,
                        items: [
                            {
                                item: 'preview 1',
                                size: 50
                            },
                            {
                                item: 'preview 2',
                                size: 50
                            }
                        ]
                    }
                ]
            }
        ]
    }

    let currentLayout = defaultLayout

    function layoutChanged() {
        ipcRenderer.send('set-setting', 'windowLayouts.control', currentLayout)
    }

    function getLayoutBlock(item) {
        if (!(Array.isArray(item.items) || interfaceItems[item.item])) {
            return null
        }

        let block = new layout.LayoutBlock({
            direction: item.direction || 'horizontal',
            size: item.size || 100
        })

        if (Array.isArray(item.items)) {
            for (let i = 0; i < item.items.length; i++) {
                let child = getLayoutBlock(item.items[i])

                if (child) {
                    block.add(child)
                }
            }
        } else {
            let element = interfaceItems[item.item]
            block.add(element.main)

            block.minWidth = element.minWidth
            block.minHeight = element.minHeight

            block.maxWidth = element.maxWidth
            block.maxHeight = element.maxHeight

            if (
                typeof item.options === 'object' &&
                typeof element.setOption === 'function'
            ) {
                for (let property in item.options) {
                    element.setOption.call(
                        null,
                        property,
                        item.options[property]
                    )
                }
            }

            element.onOption = (property, value) => {
                if (typeof item.options !== 'object' || item.options === null) {
                    item.options = {}
                }

                item.options[property] = value
                layoutChanged()
            }
        }

        block.onEvent('sizeChange', event => {
            item.size = event.size

            layoutChanged()
        })

        return block
    }

    let setup = false

    ipcRenderer.on('setting', (event, key, interfaceLayout) => {
        if (key !== 'windowLayouts.control') {
            return false
        }
        if (setup) {
            return false
        }
        setup = true

        if (typeof interfaceLayout !== 'object' || interfaceLayout === null) {
            interfaceLayout = defaultLayout
        }

        currentLayout = interfaceLayout

        layout.body.add(getLayoutBlock(currentLayout))
    })
    ipcRenderer.send('get-setting', 'windowLayouts.control', defaultLayout)
}

//inputs
{
    ipcRenderer.on('setting', (event, key, value) => {
        if (key === 'firstOpen' && value) {
            layout.window.openWindow('help')

            ipcRenderer.send('set-setting', 'firstOpen', false)
        }
    })

    ipcRenderer.send('get-setting', 'firstOpen', true)
}

ipcRenderer.on('update-available', (event, version) => {
    layout.dialog.showNotification(
        {
            autoHide: false,
            type: 'success',
            message:
                'There is a new version (' +
                version +
                ') available! Click to update.'
        },
        () => {
            electron.shell.openExternal(
                'https://display-whisper.brettdoyle.art/update/'
            )
        }
    )
})
