const { ipcRenderer, shell } = require('electron')

const fs = require('fs')
const path = require('path')

const layout = require('dw-layout')

const logger = require('dw-log')
const Database = require('dw-database')
const editor = require('dw-editor')
const keyboard = require('dw-keyboard')
const richText = require('dw-rich-text')

const items = require('dw-items')

let appDataPath

const lists = []

//**********************
//Previews
//**********************
const displayPreviews = []

const validPreviews = ['active', 'selected', 'previous', 'next']

function updateDisplayPreviews(index) {
    if (index < 0 || index >= lists.length) {
        return false
    }

    for (let i = 0; i < displayPreviews.length; i++) {
        if (displayPreviews[i].index === index) {
            displayPreviews[i].display.set(
                lists[index].output[displayPreviews[i].preview]
            )
        }
    }
}
let onDisplayOutputsChange

//**********************
//Menu Buttons
//**********************
const undoRemoveButton = new layout.Button({
    text: 'Undo Remove (0)',

    size: 'large',

    disabled: true
})
const blankButton = new layout.Button({
    text: 'Blank',
    toggle: true,

    size: 'large',

    disabled: true
})
const fitTextAllButton = new layout.Button({
    text: 'Scale Text & Unify - All',

    size: 'large'
})
const addListButton = new layout.Button({
    icon: 'add'
})

const presentation = {}

//======================
//Presentation Block
//======================
const item_presentation = {
    minWidth: 350,
    minHeight: 250,

    main: new layout.Block(
        {},
        {
            direction: 'vertical',
            align: 'stretch',
            size: '100%',

            overflow: 'auto'
        }
    )
}
{
    let itemsBlock = new layout.LayoutBlock(
        {},
        {
            direction: 'vertical',
            align: 'stretch',
            size: '100%',

            overflow: 'auto'
        }
    )
    item_presentation.main.add(itemsBlock)

    let lastSaveTime = 0
    let lastAutoSaveTime = 0
    let autoSaveTimer

    let lastEditTime = 0

    let file = ''

    let display = {
        activeScreens: [],

        screenCount: 0,
        masterScreen: -1
    }

    /*
    {
        screens: [],

        list: [],
        itemsBlock: {},

        active: {},
        selected: {},

        output: {}

        timeout: ...,

        timer: {},

        scrollPosition: {}
    }
    */
    let focusedListIndex = -1

    let removeHistory = []

    let loadingPresentation = false

    let itemIdCounter = 0

    let activeEditors = []

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

    let playMode = 'auto'
    let playOptions = {
        loop: false,
        shuffle: false
    }

    let outputsChangeListeners = []

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

    //display outputs
    onDisplayOutputsChange = listener => {
        if (typeof listener === 'function') {
            outputsChangeListeners.push(listener)
        }
    }
    function outputsChanged() {
        for (let i = 0; i < outputsChangeListeners.length; i++) {
            outputsChangeListeners[i]()
        }
    }

    //save functions
    function editHasOccured() {
        lastEditTime = Date.now()

        layout.window.setDocumentEdited(true)
    }

    //history
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

    //Item event functions
    function onItemActive(event) {
        let listIndex = lists.findIndex(
            list => list.id === event.from._data.listId
        )

        if (listIndex !== -1) {
            setActive(listIndex, {
                index: lists[listIndex].itemsBlock.indexOf(event.from),
                subIndex: event.index
            })

            focusList(listIndex)
        }
    }
    function onItemSelect(event) {
        let listIndex = lists.findIndex(
            list => list.id === event.from._data.listId
        )

        if (listIndex !== -1) {
            setSelected(listIndex, {
                index: lists[listIndex].itemsBlock.indexOf(event.from),
                subIndex: event.index
            })

            focusList(listIndex)
        }
    }
    function onItemDrag(event) {
        let listIndex = lists.findIndex(
            list => list.id === event.from._data.listId
        )

        if (listIndex === -1) {
            return false
        }

        event.from.dragActive = true

        dragging = {
            listId: event.from._data.listId,
            listIndex: listIndex,

            index: lists[listIndex].itemsBlock.indexOf(event.from)
        }

        for (let i = 0; i < lists.length; i++) {
            lists[i].itemsBlock.hovering = true
        }

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

        let listIndex = lists.findIndex(
            list => list.id === event.from._data.listId
        )
        if (listIndex !== -1) {
            focusList(listIndex)
        }
    }
    function onItemRemove(event) {
        let listIndex = lists.findIndex(
            list => list.id === event.from._data.listId
        )

        if (listIndex !== -1) {
            remove(listIndex, lists[listIndex].itemsBlock.indexOf(event.from))

            focusList(listIndex)
        }
    }

    function onDataChange(changedItem) {
        let listIndex = lists.findIndex(list => list.id === changedItem.listId)

        if (listIndex !== -1) {
            updateItem(
                listIndex,
                lists[listIndex].list.findIndex(
                    item => item.id === changedItem.id
                )
            )
        }
    }

    //presentation item functions
    function ensureImageExists(image) {
        return false
    }

    function reduceItemTextSize(listIndex, index, sections) {
        if (
            listIndex < 0 ||
            listIndex >= lists.length ||
            sections.length === 0
        ) {
            return false
        }

        let listId = lists[listIndex].id

        //Keep a copy of the item, in case it's moved whilst the check is going on
        let item = lists[listIndex].list[index]

        //If any nodes have their text scaled down, this will be set to true
        let changed = false

        //Whenever a node gets a new text size, this is run:
        let onResult = (sectionIndex, nodeIndex, size) => {
            //Update the index, in case the item has been moved
            listIndex = lists.findIndex(list => list.id === listId)
            if (listIndex === -1) {
                return false
            }

            index = lists[listIndex].list.indexOf(item)

            if (
                //If the item has been removed
                index === -1 ||
                //Or if the amount of sections has been changed
                sections.length !==
                    lists[listIndex].itemsBlock.items[index].items.length
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
                    lists[listIndex].itemsBlock.items[index].items[sectionIndex]
                        .display

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

                    lists[listIndex].itemsBlock.items[index].items[
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
                updateItemErrorHighlight(listIndex, index)

                //And if the item is in the display, update it
                if (itemInOutput(listIndex, index)) {
                    updateOutput(listIndex)
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

    function updateItemErrorHighlight(listIndex, index) {
        if (
            listIndex < 0 ||
            listIndex >= lists.length ||
            index < 0 ||
            index >= lists[listIndex].itemsBlock.items.length
        ) {
            return false
        }

        let problems = []

        for (
            let i = 0;
            i < lists[listIndex].itemsBlock.items[index].items.length;
            i++
        ) {
            for (
                let j = 0;
                j <
                lists[listIndex].itemsBlock.items[index].items[i].display.nodes
                    .length;
                j++
            ) {
                if (
                    lists[listIndex].itemsBlock.items[index].items[i].display
                        .nodes[j].type === 'text'
                ) {
                    if (
                        lists[listIndex].itemsBlock.items[index].items[i]
                            .display.nodes[j].size < options.minTextSize
                    ) {
                        problems.push(i)
                    }
                }
            }
        }

        lists[listIndex].itemsBlock.items[index].errors = problems
    }
    function updateAllItemErrorHighlights(listIndex) {
        if (listIndex >= 0 && listIndex < lists.length) {
            for (let i = 0; i < lists[listIndex].itemsBlock.items.length; i++) {
                updateItemErrorHighlight(listIndex, i)
            }
        }
    }

    function updateItem(listIndex, index = -1) {
        if (
            listIndex < 0 ||
            listIndex >= lists.length ||
            index < 0 ||
            index >= lists[listIndex].list.length
        ) {
            return false
        }
        let sections = lists[listIndex].list[index].sections

        lists[listIndex].itemsBlock.items[index].sections = sections
        lists[listIndex].itemsBlock.items[index].title =
            lists[listIndex].list[index].title

        let prevSelection = {
            index: lists[listIndex].selected.index,
            subIndex: lists[listIndex].selected.subIndex
        }

        if (lists[listIndex].active.index === index) {
            //Update active position of list, and only autoplay if the list is currently autoplaying
            setActive(
                listIndex,
                lists[listIndex].active,
                true,
                lists[listIndex].timeout !== false
            )
            //Since the active position has been updated, selection also needs to be updated
            setSelected(listIndex, prevSelection)
        } else if (prevSelection.index === index) {
            setSelected(listIndex, prevSelection)
        }

        if (options.reduceTextSize) {
            reduceItemTextSize(listIndex, index, sections)
        }

        updateItemErrorHighlight(listIndex, index)

        if (itemInOutput(listIndex, index)) {
            updatePreviews(listIndex)
        }
    }

    function fitText(listIndex, index) {
        if (
            listIndex < 0 ||
            listIndex >= lists.length ||
            index < 0 ||
            index >= lists[listIndex].list.length
        ) {
            return false
        }
        let data = lists[listIndex].list[index]

        let listId = lists[listIndex].id

        let sectionCollections = data.getTextUnifySections()

        if (sectionCollections.length === 0) {
            return false
        }

        //Visually disable the item
        lists[listIndex].itemsBlock.items[index].disabled = true
        //And if an editor window is open for it, lock it
        ipcRenderer.send('lock-edit', lists[listIndex].list[index].id)

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

                listIndex = lists.findIndex(list => list.id === listId)

                if (listIndex === -1) {
                    return false
                }

                //The item may have been moved, or removed whilst the text was being fitted, so get the current index of the item
                index = lists[listIndex].list.indexOf(data)

                if (index >= 0 && index < lists[listIndex].list.length) {
                    updateItem(listIndex, index)

                    lists[listIndex].itemsBlock.items[index].disabled = false
                    ipcRenderer.send(
                        'unlock-edit',
                        lists[listIndex].list[index].id
                    )
                    ipcRenderer.send(
                        'edit-data',
                        lists[listIndex].list[index].id,
                        lists[listIndex].list[index].getData()
                    )
                }
            }
        }

        layout.Display.getMaxTextSize(
            sectionCollections[sectionIndex],
            onResult
        )
    }

    //presentation list functions
    function focusList(listIndex) {
        if (listIndex >= 0 && listIndex < lists.length) {
            if (focusedListIndex >= 0 && focusedListIndex < lists.length) {
                lists[focusedListIndex].itemsBlock.node.style.borderColor =
                    'hsl(0, 0%, 70%)'

                lists[focusedListIndex].mainBlock.node.style.background =
                    'white'
            }

            focusedListIndex = listIndex

            if (lists.length > 1) {
                lists[focusedListIndex].itemsBlock.node.style.borderColor =
                    'hsl(200, 66%, 60%)'

                lists[focusedListIndex].mainBlock.node.style.background =
                    'hsl(200, 60%, 90%)'
            }
        }
    }

    function updateAllItems(listIndex) {
        if (listIndex >= 0 && listIndex < lists.length) {
            for (let i = 0; i < lists[listIndex].list.length; i++) {
                updateItem(listIndex, i)
            }

            updateOutput(listIndex)
        }
    }

    function updateScroll(listIndex) {
        if (
            options.autoScroll === false ||
            listIndex < 0 ||
            listIndex >= lists.length ||
            lists[listIndex].scrollPosition.index < 0 ||
            lists[listIndex].scrollPosition.index >=
                lists[listIndex].itemsBlock.items.length ||
            lists[listIndex].scrollPosition.subIndex < 0 ||
            lists[listIndex].scrollPosition.subIndex >=
                lists[listIndex].itemsBlock.items[
                    lists[listIndex].scrollPosition.index
                ].items.length
        ) {
            return false
        }

        let node =
            lists[listIndex].itemsBlock.items[
                lists[listIndex].scrollPosition.index
            ].items[lists[listIndex].scrollPosition.subIndex].node

        let listHeight = lists[listIndex].itemsBlock.node.offsetHeight
        let listScroll = lists[listIndex].itemsBlock.node.scrollTop

        let itemCenter =
            node.offsetTop +
            node.offsetHeight / 2 -
            lists[listIndex].itemsBlock.node.offsetTop

        let listPadding = Math.min(node.offsetHeight * 2.6, listHeight / 2)

        if (itemCenter - listPadding < listScroll) {
            lists[listIndex].itemsBlock.node.scrollTo({
                top: itemCenter - listPadding,
                left: 0,
                behavior: options.scrollSmooth ? 'smooth' : 'auto'
            })
        } else if (itemCenter + listPadding > listScroll + listHeight) {
            lists[listIndex].itemsBlock.node.scrollTo({
                top: itemCenter - (listHeight - listPadding),
                left: 0,
                behavior: options.scrollSmooth ? 'smooth' : 'auto'
            })
        }
    }
    function updateScrollByListId(listId) {
        updateScroll(lists.findIndex(list => list.id === listId))
    }
    function scrollTo(listIndex, position) {
        if (
            options.autoScroll === false ||
            listIndex < 0 ||
            listIndex >= lists.length ||
            position.index < 0 ||
            position.index >= lists[listIndex].list.length ||
            position.subIndex < 0 ||
            position.subIndex >=
                lists[listIndex].itemsBlock.items[position.index].items.length
        ) {
            return false
        }

        lists[listIndex].scrollPosition.index = position.index
        lists[listIndex].scrollPosition.subIndex = position.subIndex

        //The scrollTo function waits for the end of an animation frame to actually update
        //This is because items may get maximized/minimized when going through the presentation
        //And their height only updates on an animation frame, so by waiting for the end of one, all items should be at the correct height when scrolling
        layout.onFrame.end(updateScrollByListId.bind(lists[listIndex].id))
    }

    function itemInOutput(listIndex, index) {
        if (listIndex < 0 || listIndex >= lists.length) {
            return false
        }

        return (
            //If the item is active
            lists[listIndex].active.index === index ||
            //If the item is selected
            lists[listIndex].selected.index === index ||
            //If the item is after the active item, and the active section is the first of the item
            (lists[listIndex].active.index === index - 1 &&
                lists[listIndex].active.subIndex === 0) ||
            //If the item is before the active item, and the active section is the last of the item
            (lists[listIndex].active.index === index + 1 &&
                lists[listIndex].active.subIndex ===
                    lists[listIndex].itemsBlock.items[
                        lists[listIndex].active.index
                    ].items.length -
                        1)
        )
    }

    function isFirstPosition(listIndex, position) {
        if (listIndex < 0 || listIndex >= lists.length) {
            return false
        }

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
            index < position.index &&
            index < lists[listIndex].itemsBlock.items.length;
            index++
        ) {
            if (lists[listIndex].itemsBlock.items[index].items.length > 0) {
                return false
            }
        }

        return true
    }
    function isLastPosition(listIndex, position) {
        if (listIndex < 0 || listIndex >= lists.length) {
            return false
        }

        if (
            position.index === lists[listIndex].itemsBlock.items.length - 1 &&
            position.subIndex >=
                lists[listIndex].itemsBlock.items[position.index].items.length -
                    1
        ) {
            return true
        }

        if (
            position.index >= 0 &&
            position.index < lists[listIndex].itemsBlock.items.length
        ) {
            //if it's not the last section in its item, always return false (regardless of the item position)
            if (
                position.subIndex <
                lists[listIndex].itemsBlock.items[position.index].items.length -
                    1
            ) {
                return false
            }
        }

        //check each item after the given position, if any of them have 1 or more sections, return false
        for (
            let index = lists[listIndex].itemsBlock.items.length - 1;
            index > position.index && index >= 0;
            index--
        ) {
            if (lists[listIndex].itemsBlock.items[index].items.length > 0) {
                return false
            }
        }

        return true
    }

    function getFirstPosition(listIndex) {
        if (
            listIndex < 0 ||
            listIndex >= lists.length ||
            lists[listIndex].itemsBlock.items.length === 0 ||
            lists[listIndex].itemsBlock.items[0].items.length > 0
        ) {
            return { index: 0, subIndex: 0 }
        }

        for (
            let index = 1;
            index < lists[listIndex].itemsBlock.items.length;
            index++
        ) {
            if (lists[listIndex].itemsBlock.items[index].items.length > 0) {
                return { index: index, subIndex: 0 }
            }
        }

        return { index: 0, subIndex: 0 }
    }
    function getLastPosition(listIndex) {
        if (listIndex < 0 || listIndex >= lists.length) {
            return false
        }

        if (lists[listIndex].itemsBlock.items.length === 0) {
            return { index: 0, subIndex: 0 }
        }

        if (
            lists[listIndex].itemsBlock.items[
                lists[listIndex].itemsBlock.items.length - 1
            ].items.length > 0
        ) {
            return {
                index: lists[listIndex].itemsBlock.items.length - 1,
                subIndex:
                    lists[listIndex].itemsBlock.items[
                        lists[listIndex].itemsBlock.items.length - 1
                    ].items.length - 1
            }
        }

        for (
            let index = lists[listIndex].itemsBlock.items.length - 2;
            index >= 0;
            index--
        ) {
            if (lists[listIndex].itemsBlock.items[index].items.length > 0) {
                return {
                    index: index,
                    subIndex:
                        lists[listIndex].itemsBlock.items[index].items.length -
                        1
                }
            }
        }

        return { index: 0, subIndex: 0 }
    }

    function getNewPosition(
        listIndex,
        position = { index: 0, subIndex: 0 },
        offset = 0
    ) {
        if (
            listIndex < 0 ||
            listIndex >= lists.length ||
            lists[listIndex].list.length === 0
        ) {
            return {
                index: 0,
                subIndex: 0
            }
        } else if (lists[listIndex].list.length === 1) {
            return {
                index: 0,
                subIndex: Math.max(
                    0,
                    Math.min(
                        lists[listIndex].list[0].sections.length - 1,
                        position.subIndex + offset
                    )
                )
            }
        }

        if (position.index < 0) {
            position.index = 0
        }

        if (position.index >= lists[listIndex].list.length) {
            position.index = lists[listIndex].list.length - 1
        }

        if (offset < 0) {
            if (
                lists[listIndex].itemsBlock.items[position.index].sections
                    .length > 0
            ) {
                if (position.subIndex > 0) {
                    return {
                        index: position.index,
                        subIndex: Math.min(
                            position.subIndex - 1,
                            lists[listIndex].itemsBlock.items[position.index]
                                .sections.length - 1
                        )
                    }
                }
            }

            //go backwards, and use the first item which has multiple sections
            let index = position.index - 1
            while (index >= 0) {
                if (
                    lists[listIndex].itemsBlock.items[index].sections.length > 0
                ) {
                    return {
                        index: index,
                        subIndex:
                            lists[listIndex].itemsBlock.items[index].sections
                                .length - 1
                    }
                }
                index -= 1
            }

            //if no items backwards, then get the first item with multiple sections after
            index = position.index
            while (index < lists[listIndex].list.length) {
                if (
                    lists[listIndex].itemsBlock.items[index].sections.length > 0
                ) {
                    return {
                        index: index,
                        subIndex: 0
                    }
                }
                //TODO: this should be += 1 ?
                index += 1
            }

            //if no items have sections, return 0, 0
            return {
                index: 0,
                subIndex: 0
            }
        } else if (offset > 0) {
            if (
                lists[listIndex].itemsBlock.items[position.index].sections
                    .length > 0
            ) {
                if (
                    position.subIndex <
                    lists[listIndex].itemsBlock.items[position.index].sections
                        .length -
                        1
                ) {
                    return {
                        index: position.index,
                        subIndex: Math.max(0, position.subIndex + 1)
                    }
                }
            }

            //go forward, and use the first item with 1 or more sections
            let index = position.index + 1
            while (index < lists[listIndex].list.length) {
                if (
                    lists[listIndex].itemsBlock.items[index].sections.length > 0
                ) {
                    return {
                        index: index,
                        subIndex: 0
                    }
                }
                index += 1
            }

            index = position.index
            while (index >= 0) {
                if (
                    lists[listIndex].itemsBlock.items[index].sections.length > 0
                ) {
                    return {
                        index: index,
                        subIndex:
                            lists[listIndex].itemsBlock.items[index].sections
                                .length - 1
                    }
                }
                index -= 1
            }

            return {
                index: 0,
                subIndex: 0
            }
        } else {
            if (
                lists[listIndex].itemsBlock.items[position.index].sections
                    .length > 0
            ) {
                return {
                    index: position.index,
                    subIndex: Math.max(
                        0,
                        Math.min(
                            lists[listIndex].itemsBlock.items[position.index]
                                .sections.length - 1,
                            position.subIndex
                        )
                    )
                }
            }

            //go forward, and use the first item with 1 or more sections
            let index = position.index + 1
            while (index < lists[listIndex].list.length) {
                if (
                    lists[listIndex].itemsBlock.items[index].sections.length > 0
                ) {
                    return {
                        index: index,
                        subIndex: 0
                    }
                }
                index += 1
            }

            index = position.index - 1
            while (index >= 0) {
                if (
                    lists[listIndex].itemsBlock.items[index].sections.length > 0
                ) {
                    return {
                        index: index,
                        subIndex:
                            lists[listIndex].itemsBlock.items[index].sections
                                .length - 1
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

    function getDisplay(listIndex, position, offset = 0) {
        if (listIndex < 0 || listIndex >= lists.length) {
            return defaultDisplay
        }

        if (typeof offset !== 'number' || !isFinite(offset)) {
            offset = 0
        }

        if (offset === -1 && isFirstPosition(listIndex, position)) {
            if (playOptions.loop) {
                position = getLastPosition(listIndex)
            } else {
                position = { index: -1, subIndex: -1 }
            }
        } else if (offset === 1 && isLastPosition(listIndex, position)) {
            if (playOptions.loop) {
                position = getFirstPosition(listIndex)
            } else {
                position = { index: -1, subIndex: -1 }
            }
        } else {
            position = getNewPosition(listIndex, position, offset)
        }

        if (
            position.index < 0 ||
            position.index >= lists[listIndex].itemsBlock.items.length
        ) {
            return defaultDisplay
        }

        if (
            position.subIndex < 0 ||
            position.subIndex >=
                lists[listIndex].itemsBlock.items[position.index].items.length
        ) {
            return defaultDisplay
        }

        return lists[listIndex].itemsBlock.items[position.index].items[
            position.subIndex
        ].display
    }
    //Updates previews and sends display message
    function updateOutput(listIndex) {
        if (listIndex < 0 || listIndex >= lists.length) {
            return false
        }

        lists[listIndex].output.active = getDisplay(
            listIndex,
            lists[listIndex].active,
            0
        )
        lists[listIndex].output.previous = getDisplay(
            listIndex,
            lists[listIndex].active,
            -1
        )
        lists[listIndex].output.next = getDisplay(
            listIndex,
            lists[listIndex].active,
            1
        )
        lists[listIndex].output.selected = getDisplay(
            listIndex,
            lists[listIndex].selected,
            0
        )

        updateDisplayPreviews(listIndex)

        ipcRenderer.send(
            'display',
            lists[listIndex].output.active,
            lists[listIndex].screens
        )
    }
    //Only updates previews, does not change "active" display
    function updatePreviews(listIndex) {
        if (listIndex < 0 || listIndex >= lists.length) {
            return false
        }

        lists[listIndex].output.previous = getDisplay(
            listIndex,
            lists[listIndex].active,
            -1
        )
        lists[listIndex].output.next = getDisplay(
            listIndex,
            lists[listIndex].active,
            1
        )
        lists[listIndex].output.selected = getDisplay(
            listIndex,
            lists[listIndex].selected,
            0
        )

        updateDisplayPreviews(listIndex)
    }

    function setActive(
        listIndex,
        position,
        updateScroll = true,
        autoPlay = true
    ) {
        if (listIndex < 0 || listIndex >= lists.length) {
            return false
        }

        if (lists[listIndex].timeout) {
            clearTimeout(lists[listIndex].timeout)
            lists[listIndex].timeout = false
        }

        if (typeof position.index !== 'number') {
            position.index = 0
        }

        if (typeof position.subIndex !== 'number') {
            position.subIndex = 0
        }

        if (
            lists[listIndex].active.index >= 0 &&
            lists[listIndex].active.index <
                lists[listIndex].itemsBlock.items.length
        ) {
            lists[listIndex].itemsBlock.items[
                lists[listIndex].active.index
            ].active = false

            if (options.autoMinimize) {
                lists[listIndex].itemsBlock.items[
                    lists[listIndex].active.index
                ].minimize()
            }
        }

        lists[listIndex].active = getNewPosition(listIndex, position, 0)

        if (
            lists[listIndex].active.index <
            lists[listIndex].itemsBlock.items.length
        ) {
            lists[listIndex].itemsBlock.items[
                lists[listIndex].active.index
            ].active = true

            if (
                lists[listIndex].active.subIndex <
                lists[listIndex].itemsBlock.items[lists[listIndex].active.index]
                    .items.length
            ) {
                lists[listIndex].itemsBlock.items[
                    lists[listIndex].active.index
                ].items[lists[listIndex].active.subIndex].active = true
            }
        }

        //The setSelected function calls updateOutput, so setActive doesn't need to call it
        setSelected(listIndex, lists[listIndex].active, updateScroll)

        if (
            lists[listIndex].output.active.autoPlay === true &&
            playMode !== 'manual' &&
            autoPlay
        ) {
            let time =
                lists[listIndex].output.active.playTime +
                lists[listIndex].output.active.transition.time

            //if the transition is 10% or more of the playTime, show the extra time in brackets
            if (
                lists[listIndex].output.active.transition.time /
                    lists[listIndex].output.active.playTime >=
                    0.1 &&
                lists[listIndex].output.active.transition.time > 0.5
            ) {
                lists[listIndex].timer.text =
                    lists[listIndex].output.active.playTime / 1000 +
                    's ( + ' +
                    lists[listIndex].output.active.transition.time / 1000 +
                    's)'
            } else {
                lists[listIndex].timer.text =
                    lists[listIndex].output.active.playTime / 1000 + 's'
            }

            if (playOptions.loop) {
                lists[listIndex].timer.disabled = false
            } else {
                lists[listIndex].timer.disabled = isLastPosition(
                    listIndex,
                    lists[listIndex].active
                )
            }

            lists[listIndex].timer.animate(time)

            let listId = lists[listIndex].id

            lists[listIndex].timeout = setTimeout(() => {
                forward(lists.findIndex(list => list.id === listId))
            }, time)
        } else {
            lists[listIndex].timer.text = ''
            lists[listIndex].timer.value = 0
        }
    }
    function setSelected(listIndex, position, updateScroll = true) {
        if (listIndex < 0 || listIndex >= lists.length) {
            return false
        }

        if (typeof position.index !== 'number') {
            position.index = 0
        }

        if (typeof position.subIndex !== 'number') {
            position.subIndex = 0
        }

        if (
            lists[listIndex].selected.index >= 0 &&
            lists[listIndex].selected.index <
                lists[listIndex].itemsBlock.items.length
        ) {
            lists[listIndex].itemsBlock.items[
                lists[listIndex].selected.index
            ].selected = false
        }

        let lastSelectedItem = lists[listIndex].selected.index

        lists[listIndex].selected = getNewPosition(listIndex, position, 0)

        if (
            options.autoMinimize &&
            lastSelectedItem !== lists[listIndex].active.index &&
            lastSelectedItem !== lists[listIndex].selected.index &&
            lastSelectedItem >= 0 &&
            lastSelectedItem < lists[listIndex].itemsBlock.items.length
        ) {
            lists[listIndex].itemsBlock.items[lastSelectedItem].minimize()
        }

        if (
            lists[listIndex].selected.index <
            lists[listIndex].itemsBlock.items.length
        ) {
            lists[listIndex].itemsBlock.items[
                lists[listIndex].selected.index
            ].selected = true

            if (
                lists[listIndex].selected.subIndex <
                lists[listIndex].itemsBlock.items[
                    lists[listIndex].selected.index
                ].items.length
            ) {
                lists[listIndex].itemsBlock.items[
                    lists[listIndex].selected.index
                ].items[lists[listIndex].selected.subIndex].selected = true
            }
        }

        if (updateScroll) {
            scrollTo(listIndex, lists[listIndex].selected)
        }

        updateOutput(listIndex)
    }

    //list content functions
    function add(listIndex, input, template = {}, index = -1) {
        if (
            !items.list.includes(input.itemType) ||
            listIndex < 0 ||
            listIndex >= lists.length
        ) {
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

        data.listId = lists[listIndex].id

        if (index >= 0 && index < lists[listIndex].list.length) {
            let lastSelected = {
                index: lists[listIndex].selected.index,
                subIndex: lists[listIndex].selected.subIndex
            }

            if (index <= lists[listIndex].selected.index) {
                if (
                    lists[listIndex].selected.index <
                    lists[listIndex].itemsBlock.items.length
                ) {
                    lists[listIndex].itemsBlock.items[
                        lists[listIndex].selected.index
                    ].selected = false
                }
            }
            if (index <= lists[listIndex].active.index) {
                if (
                    lists[listIndex].active.index <
                    lists[listIndex].itemsBlock.items.length
                ) {
                    lists[listIndex].itemsBlock.items[
                        lists[listIndex].active.index
                    ].active = false
                }
            }

            lists[listIndex].list.splice(index, 0, data)
            lists[listIndex].itemsBlock.add(item, index)

            if (index <= lists[listIndex].active.index) {
                setActive(
                    listIndex,
                    {
                        index: lists[listIndex].active.index + 1,
                        subIndex: lists[listIndex].active.subIndex
                    },
                    false
                )
            }

            if (index <= lastSelected.index) {
                setSelected(
                    listIndex,
                    {
                        index: lastSelected.index + 1,
                        subIndex: lastSelected.subIndex
                    },
                    false
                )
            }
        } else {
            lists[listIndex].list.push(data)
            lists[listIndex].itemsBlock.add(item)

            index = lists[listIndex].list.length - 1
        }

        updateItem(
            listIndex,
            Math.max(0, Math.min(lists[listIndex].list.length - 1, index))
        )

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
            fitText(listIndex, lists[listIndex].list.indexOf(data))
        }

        editHasOccured()

        item.onEvent('active-click', onItemActive)
        item.onEvent('select-click', onItemSelect)
        item.onEvent('edit-click', onItemEdit)
        item.onEvent('drag-click', onItemDrag)
        item.onEvent('remove-click', onItemRemove)
    }
    presentation.add = (input, template) => {
        if (focusedListIndex !== -1) {
            add(focusedListIndex, input, template)
        } else {
            logger.error(
                'presentation.add was called when there was no focused list!'
            )
        }
    }
    presentation.addDrop = (input, template = {}) => {
        if (!items.list.includes(input.itemType)) {
            return false
        }

        dropping = {
            input: input,
            template: template
        }

        for (let i = 0; i < lists.length; i++) {
            lists[i].itemsBlock.hovering = true
        }
    }

    function remove(listIndex, index) {
        if (
            listIndex < 0 ||
            listIndex >= lists.length ||
            index < 0 ||
            index >= lists[listIndex].list.length
        ) {
            return false
        }

        ipcRenderer.send('stop-edit', lists[listIndex].list[index].id)

        addRemoveHistory({
            listId: lists[listIndex].id,

            item: lists[listIndex].itemsBlock.items[index],
            data: lists[listIndex].list[index],
            index: index
        })

        lists[listIndex].itemsBlock.items[index].selected = false
        lists[listIndex].itemsBlock.items[index].active = false
        lists[listIndex].itemsBlock.items[index].editActive = false

        lists[listIndex].list.splice(index, 1)
        lists[listIndex].itemsBlock.remove(index)

        let lastSelected = {
            index: lists[listIndex].selected.index,
            subIndex: lists[listIndex].selected.subIndex
        }

        if (index <= lists[listIndex].active.index) {
            setActive(
                listIndex,
                { index: lists[listIndex].active.index - 1, subIndex: 0 },
                false
            )
        }

        if (index <= lastSelected.index) {
            setSelected(
                listIndex,
                { index: lastSelected.index - 1, subIndex: 0 },
                false
            )
        }

        if (lists[listIndex].list.length === 0) {
            lists[listIndex].active.index = lists[
                listIndex
            ].active.subIndex = lists[listIndex].selected.index = lists[
                listIndex
            ].selected.subIndex = 0

            updatePreviews(listIndex)
        }

        editHasOccured()
    }

    function move(listIndex, index, newIndex) {
        if (listIndex < 0 || listIndex >= lists.length) {
            return false
        }

        if (typeof index !== 'number') {
            index = lists[listIndex].list.indexOf(index)
        }

        if (
            lists[listIndex].list.length <= 1 ||
            index < 0 ||
            index >= lists[listIndex].list.length ||
            newIndex < 0 ||
            newIndex > lists[listIndex].list.length ||
            index === newIndex
        ) {
            return false
        }

        if (
            lists[listIndex].active.index < 0 ||
            lists[listIndex].active.index >= items.length
        ) {
            lists[listIndex].active = getNewPosition(
                listIndex,
                lists[listIndex].active
            )
        }
        let currentActiveId =
            lists[listIndex].list[lists[listIndex].active.index].id

        if (
            lists[listIndex].selected.index < 0 ||
            lists[listIndex].selected.index >= items.length
        ) {
            lists[listIndex].selected = getNewPosition(
                listIndex,
                lists[listIndex].selected
            )
        }
        let currentSelectedId =
            lists[listIndex].list[lists[listIndex].selected.index].id

        if (
            lists[listIndex].selected.index >= 0 &&
            lists[listIndex].selected.index <
                lists[listIndex].itemsBlock.items.length
        ) {
            lists[listIndex].itemsBlock.items[
                lists[listIndex].selected.index
            ].selected = false
        }

        lists[listIndex].itemsBlock.move(index, newIndex)

        let data = lists[listIndex].list.splice(index, 1)[0]

        if (newIndex > index) {
            newIndex -= 1
        }

        lists[listIndex].list.splice(newIndex, 0, data)

        for (let i = 0; i < lists[listIndex].list.length; i++) {
            if (lists[listIndex].list[i].id === currentActiveId) {
                lists[listIndex].active.index = i
            }
            if (lists[listIndex].list[i].id === currentSelectedId) {
                lists[listIndex].selected.index = i
            }
        }

        if (
            lists[listIndex].selected.index <
            lists[listIndex].itemsBlock.items.length
        ) {
            lists[listIndex].itemsBlock.items[
                lists[listIndex].selected.index
            ].selected = true

            if (
                lists[listIndex].selected.subIndex <
                lists[listIndex].itemsBlock.items[
                    lists[listIndex].selected.index
                ].items.length
            ) {
                lists[listIndex].itemsBlock.items[
                    lists[listIndex].selected.index
                ].items[lists[listIndex].selected.subIndex].selected = true
            }
        }

        if (lists[listIndex].active.index === newIndex) {
            scrollTo(listIndex, lists[listIndex].active)
        } else if (lists[listIndex].selected.index === newIndex) {
            scrollTo(listIndex, lists[listIndex].selected)
        }

        updateOutput(listIndex)

        editHasOccured()
    }

    function moveList(
        sourceListIndex,
        sourceIndex,
        targetListIndex,
        targetIndex
    ) {
        if (
            sourceListIndex < 0 ||
            sourceListIndex >= lists.length ||
            targetListIndex < 0 ||
            targetListIndex >= lists.length ||
            sourceIndex < 0 ||
            sourceIndex >= lists[sourceListIndex].list.length
        ) {
            return false
        }

        if (
            lists[targetListIndex].selected.index >= 0 &&
            lists[targetListIndex].selected.index <
                lists[targetListIndex].itemsBlock.items.length
        ) {
            lists[targetListIndex].itemsBlock.items[
                lists[targetListIndex].selected.index
            ].selected = false
        }

        let data = lists[sourceListIndex].list[sourceIndex]
        let item = lists[sourceListIndex].itemsBlock.items[sourceIndex]

        lists[sourceListIndex].list.splice(sourceIndex, 1)
        lists[sourceListIndex].itemsBlock.remove(item)

        if (targetIndex <= 0) {
            //start of list
            lists[targetListIndex].list.splice(0, 0, data)
            lists[targetListIndex].itemsBlock.add(item, 0)
        } else if (targetIndex >= lists[targetListIndex].list.length) {
            //end of list
            lists[targetListIndex].list.push(data)
            lists[targetListIndex].itemsBlock.add(item)
        } else {
            //middle of list
            lists[targetListIndex].list.splice(targetIndex, 0, data)
            lists[targetListIndex].itemsBlock.add(item, targetIndex)
        }

        item.selected = false
        item.active = false

        data.listId = lists[targetListIndex].id

        //update active + selected
        let sourceSelected = {
            index: lists[sourceListIndex].selected.index,
            subIndex: lists[sourceListIndex].selected.subIndex
        }

        if (lists[sourceListIndex].active.index >= sourceIndex) {
            if (
                lists[sourceListIndex].active.index >= 0 &&
                lists[sourceListIndex].active.index <
                    lists[sourceListIndex].itemsBlock.items.length
            ) {
                lists[sourceListIndex].itemsBlock.items[
                    lists[sourceListIndex].active.index
                ].active = false
            }

            if (
                lists[sourceListIndex].selected.index >= 0 &&
                lists[sourceListIndex].selected.index <
                    lists[sourceListIndex].itemsBlock.items.length
            ) {
                lists[sourceListIndex].itemsBlock.items[
                    lists[sourceListIndex].selected.index
                ].selected = false
            }

            setActive(sourceListIndex, {
                index: lists[sourceListIndex].active.index - 1,
                subIndex: lists[sourceListIndex].active.subIndex
            })

            if (sourceSelected.index >= sourceIndex) {
                setSelected(sourceListIndex, {
                    index: sourceSelected.index - 1,
                    subIndex: sourceSelected.subIndex
                })
            } else {
                setSelected(sourceListIndex, sourceSelected)
            }
        } else if (sourceSelected.index >= sourceIndex) {
            setSelected(sourceListIndex, {
                index: sourceSelected.index - 1,
                subIndex: sourceSelected.subIndex
            })
        }

        let targetSelected = {
            index: lists[targetListIndex].selected.index,
            subIndex: lists[targetListIndex].selected.subIndex
        }

        if (targetIndex <= lists[targetListIndex].active.index) {
            if (
                lists[targetListIndex].active.index + 1 >= 0 &&
                lists[targetListIndex].active.index + 1 <
                    lists[targetListIndex].itemsBlock.items.length
            ) {
                lists[targetListIndex].itemsBlock.items[
                    lists[targetListIndex].active.index + 1
                ].active = false
            }

            setActive(targetListIndex, {
                index: lists[targetListIndex].active.index + 1,
                subIndex: lists[targetListIndex].active.subIndex
            })
        }

        if (targetSelected.index >= targetIndex) {
            setSelected(targetListIndex, {
                index: targetSelected.index + 1,
                subIndex: targetSelected.subIndex
            })
        } else {
            setSelected(targetListIndex, targetSelected)
        }
    }

    function undoRemove() {
        if (removeHistory.length === 0) {
            return false
        }

        let history = removeHistory.pop()

        updateRemoveButton()

        if (history.list) {
            lists.splice(history.index, 0, history.list)
            itemsBlock.add(history.list.mainBlock.parent, history.index)

            focusList(Math.max(0, Math.min(lists.length, focusedListIndex)))

            outputsChanged()

            addListButton.disabled = lists.length >= options.maxLists

            if (lists.length > 1) {
                for (let i = 0; i < lists.length; i++) {
                    lists[i].removeButton.disabled = false
                }
            }
        } else {
            let listIndex = lists.findIndex(list => list.id === history.listId)

            if (listIndex < 0 || listIndex >= lists.length) {
                return false
            }

            if (
                history.index >= 0 &&
                history.index < lists[listIndex].list.length
            ) {
                let lastSelected = {
                    index: lists[listIndex].selected.index,
                    subIndex: lists[listIndex].selected.subIndex
                }

                if (history.index <= lists[listIndex].selected.index) {
                    if (
                        lists[listIndex].selected.index <
                        lists[listIndex].itemsBlock.items.length
                    ) {
                        lists[listIndex].itemsBlock.items[
                            lists[listIndex].selected.index
                        ].selected = false
                    }
                }
                if (history.index <= lists[listIndex].active.index) {
                    if (
                        lists[listIndex].active.index <
                        lists[listIndex].itemsBlock.items.length
                    ) {
                        lists[listIndex].itemsBlock.items[
                            lists[listIndex].active.index
                        ].active = false
                    }
                }

                lists[listIndex].list.splice(history.index, 0, history.data)
                lists[listIndex].itemsBlock.add(history.item, history.index)

                if (history.index <= lists[listIndex].active.index) {
                    setActive(
                        listIndex,
                        {
                            index: lists[listIndex].active.index + 1,
                            subIndex: lists[listIndex].active.subIndex
                        },
                        false
                    )
                }
                if (history.index <= lastSelected.index) {
                    setSelected(
                        listIndex,
                        {
                            index: lastSelected.index + 1,
                            subIndex: lastSelected.subIndex
                        },
                        false
                    )
                }
            } else {
                lists[listIndex].list.push(history.data)
                lists[listIndex].itemsBlock.add(history.item)

                history.index = lists[listIndex].list.length - 1
            }

            updateItem(
                Math.max(
                    0,
                    Math.min(lists[listIndex].list.length - 1, history.index)
                )
            )

            if (options.autoMinimize) {
                history.item.minimize()
            }

            if (options.autoFitText) {
                fitText(listIndex, lists[listIndex].list.indexOf(history.data))
            }
        }

        editHasOccured()
    }

    function beginFirst(listIndex) {
        if (
            listIndex < 0 ||
            listIndex >= lists.length ||
            lists[listIndex].list.length === 0
        ) {
            return false
        }

        setActive(listIndex, { index: 0, subIndex: 0 })
    }

    function forward(listIndex) {
        if (
            listIndex < 0 ||
            listIndex >= lists.length ||
            lists[listIndex].list.length === 0
        ) {
            return false
        }

        if (
            playOptions.shuffle &&
            lists[listIndex].list.length !== 1 &&
            lists[listIndex].active.index <
                lists[listIndex].itemsBlock.items.length &&
            lists[listIndex].active.index >= 0 &&
            lists[listIndex].active.subIndex ===
                lists[listIndex].itemsBlock.items[lists[listIndex].active.index]
                    .items.length -
                    1
        ) {
            //At the end of an item, and shuffle is enabled

            if (lists[listIndex].list.length === 2) {
                //If there are only two items, go to the other item
                setActive(listIndex, {
                    index: lists[listIndex].active.index === 0 ? 1 : 0,
                    subIndex: 0
                })
            } else {
                //Get a random index, excluding the last item
                let randomIndex = ~~(
                    Math.random() *
                    (lists[listIndex].list.length - 1)
                )
                //Then add one if the index is at, or above the current index
                //This ensure all indexs are evenly chosen, and the current index is never chosen.
                if (randomIndex >= lists[listIndex].active.index) {
                    randomIndex += 1
                }

                setActive(listIndex, {
                    index: randomIndex,
                    subIndex: 0
                })
            }
        } else if (isLastPosition(listIndex, lists[listIndex].active)) {
            if (playOptions.loop) {
                setActive(listIndex, getFirstPosition(listIndex))
            } else {
                lists[listIndex].timer.value = 0
                lists[listIndex].timer.text = ''
                lists[listIndex].timer.disabled = true
            }
        } else {
            setActive(
                listIndex,
                getNewPosition(listIndex, lists[listIndex].active, 1)
            )
        }
    }
    presentation.forward = () => {
        if (focusedListIndex !== -1) {
            forward(focusedListIndex)
        } else {
            logger.error(
                'presentation.forward was called when there was no focused list!'
            )
        }
    }

    function back(listIndex) {
        if (
            listIndex < 0 ||
            listIndex >= lists.length ||
            lists[listIndex].list.length === 0
        ) {
            return false
        }

        if (
            playOptions.shuffle &&
            lists[listIndex].list.length !== 1 &&
            lists[listIndex].active.index <
                lists[listIndex].itemsBlock.items.length &&
            lists[listIndex].active.index >= 0 &&
            lists[listIndex].active.subIndex === 0
        ) {
            //At the start of an item, and shuffle is enabled
            if (lists[listIndex].list.length === 2) {
                //If there are only two items, go to the other item
                setActive(listIndex, {
                    index: lists[listIndex].active.index === 0 ? 1 : 0,
                    subIndex: 0
                })
            } else {
                //Get a random index, excluding the last item
                let randomIndex = ~~(
                    Math.random() *
                    (lists[listIndex].list.length - 1)
                )
                //Then add one if the index is at, or above the current index
                //This ensure all indexs are evenly chosen, and the current index is never chosen.
                if (randomIndex >= lists[listIndex].active.index) {
                    randomIndex += 1
                }

                setActive(listIndex, {
                    index: randomIndex,
                    subIndex: 0
                })
            }
        } else if (isFirstPosition(listIndex, lists[listIndex].active)) {
            if (playOptions.loop) {
                setActive(listIndex, getLastPosition(listIndex))
            } else {
                lists[listIndex].timer.value = 0
                lists[listIndex].timer.text = ''
                lists[listIndex].timer.disabled = true
            }
        } else {
            setActive(
                listIndex,
                getNewPosition(listIndex, lists[listIndex].active, -1)
            )
        }
    }
    presentation.back = () => {
        if (focusedListIndex !== -1) {
            back(focusedListIndex)
        } else {
            logger.error(
                'presentation.back was called when there was no focused list!'
            )
        }
    }

    function selectForward(listIndex) {
        if (
            listIndex < 0 ||
            listIndex >= lists.length ||
            lists[listIndex].list.length === 0
        ) {
            return false
        }

        setSelected(
            listIndex,
            getNewPosition(listIndex, lists[listIndex].selected, 1)
        )
    }
    presentation.selectForward = () => {
        if (focusedListIndex !== -1) {
            selectForward(focusedListIndex)
        } else {
            logger.error(
                'presentation.selectForward was called when there was no focused list!'
            )
        }
    }

    function selectBack(listIndex) {
        if (
            listIndex < 0 ||
            listIndex >= lists.length ||
            lists[listIndex].list.length === 0
        ) {
            return false
        }

        setSelected(
            listIndex,
            getNewPosition(listIndex, lists[listIndex].selected, -1)
        )
    }
    presentation.selectBack = () => {
        if (focusedListIndex !== -1) {
            selectBack(focusedListIndex)
        } else {
            logger.error(
                'presentation.selectBack was called when there was no focused list!'
            )
        }
    }

    function selectItemForward(listIndex) {
        if (
            listIndex < 0 ||
            listIndex >= lists.length ||
            lists[listIndex].list.length === 0
        ) {
            return false
        }

        if (
            lists[listIndex].selected.index <
            lists[listIndex].list.length - 1
        ) {
            setSelected(listIndex, {
                index: lists[listIndex].selected.index + 1,
                subIndex: 0
            })
        }
    }
    presentation.selectItemForward = () => {
        if (focusedListIndex !== -1) {
            selectItemForward(focusedListIndex)
        } else {
            logger.error(
                'presentation.selectItemForward was called when there was no focused list!'
            )
        }
    }
    function selectItemBackward(listIndex) {
        if (
            listIndex < 0 ||
            listIndex >= lists.length ||
            lists[listIndex].list.length === 0
        ) {
            return false
        }

        if (lists[listIndex].selected.index > 0) {
            setSelected(listIndex, {
                index: lists[listIndex].selected.index - 1,
                subIndex: 0
            })
        }
    }
    presentation.selectItemBackward = () => {
        if (focusedListIndex !== -1) {
            selectItemBackward(focusedListIndex)
        } else {
            logger.error(
                'presentation.selectItemBackward was called when there was no focused list!'
            )
        }
    }

    function playSelected(listIndex) {
        if (listIndex >= 0 && listIndex < lists.length) {
            setActive(listIndex, lists[listIndex].selected)
        }
    }
    presentation.playSelected = () => {
        if (focusedListIndex !== -1) {
            playSelected(focusedListIndex)
        } else {
            logger.error(
                'presentation.playSelected was called when there was no focused list!'
            )
        }
    }

    function moveSelectedUp(listIndex) {
        if (listIndex >= 0 && listIndex < lists.length) {
            move(
                listIndex,
                lists[listIndex].selected.index,
                lists[listIndex].selected.index - 1
            )
        }
    }
    presentation.moveSelectedUp = () => {
        if (focusedListIndex !== -1) {
            moveSelectedUp(focusedListIndex)
        } else {
            logger.error(
                'presentation.moveSelectedUp was called when there was no focused list!'
            )
        }
    }
    function moveSelectedDown(listIndex) {
        if (listIndex >= 0 && listIndex < lists.length) {
            move(
                listIndex,
                lists[listIndex].selected.index,
                lists[listIndex].selected.index + 2
            )
        }
    }
    presentation.moveSelectedDown = () => {
        if (focusedListIndex !== -1) {
            moveSelectedDown(focusedListIndex)
        } else {
            logger.error(
                'presentation.moveSelectedDown was called when there was no focused list!'
            )
        }
    }

    function moveSelectedTop(listIndex) {
        if (listIndex >= 0 && listIndex < lists.length) {
            move(listIndex, lists[listIndex].selected.index, 0)
        }
    }
    presentation.moveSelectedTop = () => {
        if (focusedListIndex !== -1) {
            moveSelectedTop(focusedListIndex)
        } else {
            logger.error(
                'presentation.moveSelectedTop was called when there was no focused list!'
            )
        }
    }
    function moveSelectedBottom(listIndex) {
        if (listIndex >= 0 && listIndex < lists.length) {
            move(
                listIndex,
                lists[listIndex].selected.index,
                lists[listIndex].list.length
            )
        }
    }
    presentation.moveSelectedBottom = () => {
        if (focusedListIndex !== -1) {
            moveSelectedBottom(focusedListIndex)
        } else {
            logger.error(
                'presentation.moveSelectedBottom was called when there was no focused list!'
            )
        }
    }

    presentation.setPlayMode = function(mode, options) {
        if (mode === 'manual' || mode === 'auto') {
            playMode = mode
        }

        if (typeof options === 'object') {
            if (typeof options.loop === 'boolean') {
                playOptions.loop = options.loop

                for (let i = 0; i < lists.length; i++) {
                    if (isLastPosition(i, lists[i].active)) {
                        //if at last item, disable timer if loop is false, otherwise enable it
                        lists[i].timer.disabled = !playOptions.loop
                    }
                }
            }

            if (typeof options.shuffle === 'boolean') {
                playOptions.shuffle = options.shuffle
            }
        }

        if (playMode === 'manual') {
            for (let i = 0; i < lists.length; i++) {
                if (lists[i].timeout) {
                    clearTimeout(lists[i].timeout)
                    lists[i].timeout = false
                }

                lists[i].timer.text = ''
                lists[i].timer.value = 0
            }
        }

        for (let i = 0; i < lists.length; i++) {
            updatePreviews(i)
        }
    }

    //List events
    function onListDrop(event) {
        let listIndex = lists.findIndex(list => list.itemsBlock === event.from)

        if (listIndex === -1) {
            dropping = false
            dragging = false

            return false
        }

        if (typeof dropping === 'object') {
            add(listIndex, dropping.input, dropping.template, event.index)

            dropping = false
        }

        if (typeof dragging === 'object') {
            if (
                dragging.index <
                lists[dragging.listIndex].itemsBlock.items.length
            ) {
                lists[dragging.listIndex].itemsBlock.items[
                    dragging.index
                ].dragActive = false
            }

            if (dragging.listIndex === listIndex) {
                move(listIndex, dragging.index, event.index)
            } else {
                moveList(
                    dragging.listIndex,
                    dragging.index,
                    listIndex,
                    event.index
                )
            }

            dragging = false
        }
    }
    function onListDropCancel() {
        if (typeof dropping === 'object') {
            dropping = false
        }

        if (typeof dragging === 'object') {
            lists[dragging.listIndex].itemsBlock.items[
                dragging.index
            ].dragActive = false

            dragging = false
        }
    }
    function onListButtonFirst(event) {
        let listIndex = lists.findIndex(
            list => list.controlBlock === event.from.parent
        )

        beginFirst(listIndex)

        focusList(listIndex)
    }
    function onListButtonPrevious(event) {
        let listIndex = lists.findIndex(
            list => list.controlBlock === event.from.parent
        )

        back(listIndex)

        focusList(listIndex)
    }
    function onListButtonNext(event) {
        let listIndex = lists.findIndex(
            list => list.controlBlock === event.from.parent
        )

        forward(listIndex)

        focusList(listIndex)
    }
    function onListScreenButton(event) {
        let listIndex = lists.findIndex(
            list => list.screenBlock === event.from.parent
        )

        if (listIndex !== -1) {
            let screenIndex = event.from.screenIndex

            //Regardless of whether or not this list is going to enable/disable the screen, any other lists need to have the screen removed
            for (let i = 0; i < lists.length; i++) {
                if (i !== listIndex && lists[i].screens.includes(screenIndex)) {
                    lists[i].screens.splice(
                        lists[i].screens.indexOf(screenIndex),
                        1
                    )

                    updateListScreenButtons(i)
                }
            }

            event.from.active !== event.from.active

            if (event.from.active) {
                ipcRenderer.send('enable-display-screen', screenIndex)

                ipcRenderer.send('display', lists[listIndex].output.active, [
                    screenIndex
                ])

                if (!lists[listIndex].screens.includes(screenIndex)) {
                    lists[listIndex].screens.push(screenIndex)
                }
            } else {
                ipcRenderer.send('disable-display-screen', screenIndex)

                let index = lists[listIndex].screens.indexOf(screenIndex)

                if (index !== -1) {
                    lists[listIndex].screens.splice(index, 1)
                }
            }

            focusList(listIndex)
        }
    }

    function onListRemoveButton(event) {
        let listIndex = lists.findIndex(
            list => list.topBlock === event.from.parent
        )

        if (listIndex >= 0 && listIndex < lists.length) {
            removeList(listIndex)
        }
    }

    function updateListScreenButtons(listIndex) {
        if (listIndex < 0 || listIndex >= lists.length) {
            return false
        }

        //Add extra buttons
        while (lists[listIndex].screenButtons.length <= display.screenCount) {
            lists[listIndex].screenButtons.push(
                new layout.Button({
                    text: lists[listIndex].screenButtons.length.toString(),
                    toggle: true,

                    onClick: onListScreenButton,

                    size: 'large'
                })
            )

            lists[listIndex].screenButtons[
                lists[listIndex].screenButtons.length - 1
            ].screenIndex = lists[listIndex].screenButtons.length - 1

            lists[listIndex].screenButtons[
                lists[listIndex].screenButtons.length - 1
            ].addClass('highlight')
        }

        //Show more buttons in interface
        for (
            let i = lists[listIndex].screenBlock.items.length;
            i < display.screenCount;
            i++
        ) {
            lists[listIndex].screenBlock.add(lists[listIndex].screenButtons[i])
        }

        //Show less buttons in interface
        while (
            lists[listIndex].screenBlock.items.length > display.screenCount
        ) {
            lists[listIndex].screenBlock.remove(
                lists[listIndex].screenBlock.items[
                    lists[listIndex].screenBlock.items.length - 1
                ]
            )
        }

        for (let i = 0; i < display.screenCount; i++) {
            if (display.masterScreen === i) {
                lists[listIndex].screenButtons[i].text =
                    '[' + (i + 1).toString() + ']'
            } else {
                lists[listIndex].screenButtons[i].text = (i + 1).toString()
            }

            //If the main process says this screen isn't active, remove it from the list
            if (
                lists[listIndex].screens.includes(i) &&
                !display.activeScreens.includes(i)
            ) {
                lists[listIndex].screens.splice(
                    lists[listIndex].screens.indexOf(i),
                    1
                )
            }

            lists[listIndex].screenButtons[i].active = lists[
                listIndex
            ].screens.includes(i)
        }
    }

    //List functions
    function addList() {
        if (lists.length >= options.maxLists) {
            return false
        }

        let newList = {
            mainBlock: new layout.Block(
                {},
                {
                    direction: 'vertical'
                }
            ),

            //top bar + remove button
            topBlock: new layout.Block(
                {
                    items: [new layout.Filler()],
                    childSpacing: 8
                },
                {
                    direction: 'horizontal',
                    padding: 2,

                    shrink: false,
                    grow: false
                }
            ),
            removeButton: new layout.Button({
                icon: 'remove',

                onClick: onListRemoveButton,

                size: 'large'
            }),

            //screen properties + interface
            screens: [],

            screenButtons: [],
            screenBlock: new layout.Block(
                {
                    childSpacing: 8
                },
                {
                    direction: 'horizontal',
                    padding: 0,

                    shrink: false,
                    grow: false
                }
            ),

            //list properties + interface
            list: [],
            itemsBlock: new layout.ReorderableBlock(
                {},
                {
                    direction: 'vertical',

                    overflow: 'scroll',
                    overflowX: 'hidden',

                    background: 'white',

                    borderTop: '2px solid hsl(0, 0%, 70%)',
                    borderBottom: '2px solid hsl(0, 0%, 70%)'
                }
            ),

            active: {
                index: 0,
                subIndex: 0
            },
            selected: {
                index: 0,
                subIndex: 0
            },

            scrollPosition: {},

            output: {
                active: {},
                selected: {},
                next: {},
                previous: {}
            },

            //control properties + interface
            timeout: false,

            controlBlock: new layout.Block(
                {
                    items: [
                        new layout.Button({
                            icon: 'play-first',

                            onClick: onListButtonFirst
                        }),
                        new layout.Button({
                            icon: 'play-previous',

                            onClick: onListButtonPrevious
                        }),
                        new layout.Button({
                            icon: 'play-next',

                            onClick: onListButtonNext
                        })
                    ],
                    childSpacing: 8
                },
                {
                    direction: 'horizontal',
                    padding: 2,

                    shrink: false,
                    grow: false
                }
            ),

            timer: new layout.Timer({}, {})
        }

        newList.id = itemIdCounter.toString(16) + '-list'
        itemIdCounter += 1

        newList.mainBlock.add(newList.topBlock)
        newList.topBlock.add(newList.screenBlock, 0)
        newList.topBlock.add(newList.removeButton)

        newList.mainBlock.add(newList.itemsBlock)
        newList.mainBlock.add(newList.controlBlock)

        newList.controlBlock.add(newList.timer)

        newList.itemsBlock.onEvent('cancel-drop', onListDropCancel)
        newList.itemsBlock.onEvent('drop', onListDrop)

        let newSize = 100 / (lists.length + 1)

        for (let i = 0; i < lists.length; i++) {
            itemsBlock.items[i].size -= newSize / lists.length
        }

        lists.push(newList)
        itemsBlock.add(
            new layout.LayoutBlock({
                items: [newList.mainBlock],

                size: newSize,

                minHeight: 200
            })
        )

        updateListScreenButtons(lists.length - 1)
        focusList(lists.length - 1)

        outputsChanged()

        addListButton.disabled = lists.length >= options.maxLists

        if (lists.length === 1) {
            newList.removeButton.disabled = true
        } else {
            for (let i = 0; i < lists.length; i++) {
                lists[i].removeButton.disabled = false
            }
        }
    }
    function removeList(listIndex) {
        if (listIndex < 0 || listIndex >= lists.length) {
            return false
        }

        let removedList = lists.splice(listIndex, 1)[0]

        addRemoveHistory({
            list: removedList,

            index: listIndex
        })

        if (removedList.timeout) {
            clearTimeout(removedList.timeout)
            removedList.timeout = false
        }
        removedList.timer.text = ''
        removedList.timer.value = 0

        for (let i = 0; i < removedList.list.length; i++) {
            if (activeEditors.includes(removedList.list[i].id)) {
                ipcRenderer.send('stop-edit', removedList.list[i].id)
                removedList.itemsBlock.items[i].editActive = false
            }
        }

        let extraSpace = removedList.mainBlock.parent.size

        itemsBlock.remove(removedList.mainBlock.parent)

        for (let i = 0; i < lists.length; i++) {
            itemsBlock.items[i].size += extraSpace / lists.length
        }

        if (focusedListIndex > listIndex) {
            focusedListIndex -= 1
        }

        focusList(Math.max(0, Math.min(lists.length, focusedListIndex)))

        outputsChanged()

        addListButton.disabled = lists.length >= options.maxLists

        if (lists.length === 1) {
            lists[0].removeButton.disabled = true
        }
    }

    function getListSaveData(listIndex) {
        if (listIndex < 0 || listIndex >= lists.length) {
            return {}
        }

        let data = {
            list: [],

            active: {
                index: lists[listIndex].active.index,
                subIndex: lists[listIndex].active.subIndex
            }
        }

        for (let i = 0; i < lists[listIndex].list.length; i++) {
            data.list.push(lists[listIndex].list[i].getData())
        }

        return data
    }

    presentation.load = function(data = {}) {
        file = ''

        while (lists.length > 0) {
            removeList(lists.length - 1)
        }

        removeHistory = []
        updateRemoveButton()

        if (typeof data.file === 'string') {
            file = data.file
        }

        loadingPresentation = true

        if (Array.isArray(data.lists)) {
            for (let i = 0; i < data.lists.length; i++) {
                addList()

                for (let j = 0; j < data.lists[i].list.length; j++) {
                    add(i, data.lists[i].list[j])
                }

                setActive(i, data.lists[i].active, true, false)
            }
        } else if (Array.isArray(data.list)) {
            for (let i = 0; i < data.list.length; i++) {
                add(0, data.list[i])
            }

            setActive(0, data.active, true, false)
        }

        if (lists.length === 0) {
            addList()
        }

        loadingPresentation = false

        lastEditTime = 0

        layout.window.setDocument(file)

        presentation.saved = true
    }
    presentation.reset = function() {
        presentation.load({})
    }

    presentation.getSaveData = function() {
        let data = {
            file: file,

            lists: []
        }

        for (let i = 0; i < lists.length; i++) {
            data.lists.push(getListSaveData(i))
        }

        return data
    }

    function autoSaveCheck() {
        if (
            lastEditTime >= lastAutoSaveTime &&
            Date.now() - lastAutoSaveTime >= options.autoSaveInterval * 1000 &&
            appDataPath
        ) {
            fs.writeFile(
                path.join(appDataPath, 'autosave.dpl'),
                JSON.stringify(presentation.getSaveData()),
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

    //User list events
    undoRemoveButton.onEvent('click', undoRemove)

    layout.menu.onEvent('edit', item => {
        if (item.value === 'undo') {
            undoRemove()
        }
    })

    blankButton.onEvent('click', event => {
        if (!event.fromUser) {
            blankButton.active = !blankButton.active
        }

        ipcRenderer.send('display-blank', blankButton.active)
    })
    ipcRenderer.on('display-blank', (event, blank) => {
        blankButton.active = blank
    })

    fitTextAllButton.onEvent('click', () => {
        for (let i = 0; i < lists.length; i++) {
            for (let j = 0; j < lists[i].list.length; j++) {
                fitText(i, j)
            }
        }
    })

    addListButton.onEvent('click', addList)

    //User file events
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

    ipcRenderer.on('open-file', (e, file) => {
        checkSave((error, canContinue) => {
            if (!canContinue) {
                return false
            }

            loadFile(file)
        })
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

    //Window closing save confirmation
    {
        let closing = false
        let canClose = false

        function finishClose() {
            if (lastEditTime >= lastAutoSaveTime && appDataPath) {
                layout.showLoader(layout.body, 'Auto-Saving')

                fs.writeFile(
                    path.join(appDataPath, 'autosave.dpl'),
                    JSON.stringify(presentation.getSaveData()),
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
    }

    //Settings, and keyboard shortcuts
    {
        const shortcutFunctions = {
            'control.keyboard.disableDisplay': () => {
                ipcRenderer.send('disable-display')
            },

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
                presentation.moveSelectedBottom,

            'control.keyboard.focusListUp': () => {
                focusList(focusedListIndex - 1)
            },
            'control.keyboard.focusListDown': () => {
                focusList(focusedListIndex + 1)
            },

            'control.keyboard.focusList1': focusList.bind(null, 0),
            'control.keyboard.focusList2': focusList.bind(null, 1),
            'control.keyboard.focusList3': focusList.bind(null, 2)
        }

        const keyboardListeners = {}

        let repeatShortcuts = false

        ipcRenderer.on('setting', (e, key, value) => {
            if (key === 'defaults.background') {
                defaultDisplay.background = value

                return false
            } else if (key === 'control.keyboard.repeat') {
                repeatShortcuts = value

                ipcRenderer.send('get-settings', Object.keys(shortcutFunctions))

                return false
            } else if (shortcutFunctions.hasOwnProperty(key)) {
                keyboard.unregister(keyboardListeners[key])

                keyboardListeners[key] = keyboard.register(
                    value,
                    shortcutFunctions[key],
                    {
                        repeat: repeatShortcuts
                    }
                )

                return false
            } else if (key.startsWith('presentation.')) {
                options[key.slice(13)] = value

                switch (key) {
                    case 'presentation.reduceTextSize':
                        for (let i = 0; i < lists.length; i++) {
                            updateAllItems(i)
                        }

                        break
                    case 'presentation.minTextSize':
                        if (
                            typeof value !== 'number' ||
                            !isFinite(value) ||
                            value < 0
                        ) {
                            options.minTextSize = 10
                        }

                        for (let i = 0; i < lists.length; i++) {
                            updateAllItemErrorHighlights(i)
                        }

                        break
                    case 'presentation.autoMinimize':
                        if (value) {
                            for (let i = 0; i < lists.length; i++) {
                                for (
                                    let j = 0;
                                    j < lists[i].itemsBlock.items.length;
                                    j++
                                ) {
                                    if (
                                        j !== lists[i].active.index &&
                                        j !== lists[i].selected.index
                                    ) {
                                        lists[i].itemsBlock.items[j].minimize()
                                    }
                                }
                            }
                        }

                        break
                    case 'presentation.showSectionWhenMinimized':
                        for (let i = 0; i < lists.length; i++) {
                            for (
                                let j = 0;
                                j < lists[i].itemsBlock.items.length;
                                j++
                            ) {
                                lists[i].itemsBlock.items[
                                    j
                                ].showSectionWhenMinimized = value
                            }
                        }

                        break
                    case 'presentation.autoScroll':
                        if (value) {
                            for (let i = 0; i < lists.length; i++) {
                                scrollTo(i, lists[i].selected)
                            }
                        }

                        break
                    case 'presentation.autoSaveInterval':
                        if (
                            typeof value !== 'number' ||
                            value < 3 ||
                            !isFinite(value)
                        ) {
                            options.autoSaveInterval = 30
                        }

                        clearInterval(autoSaveTimer)

                        autoSaveTimer = setInterval(
                            autoSaveCheck,
                            options.autoSaveInterval * 1000
                        )

                        break
                    case 'presentation.removeHistoryCount':
                        if (
                            typeof value !== 'number' ||
                            value < 0 ||
                            !isFinite(value)
                        ) {
                            options.removeHistoryCount = 5
                        }

                        options.removeHistoryCount = value

                        if (removeHistory.length > options.removeHistoryCount) {
                            removeHistory.splice(
                                0,
                                removeHistory.length -
                                    options.removeHistoryCount
                            )

                            updateRemoveButton()
                        }

                        break
                    case 'presentation.maxLists':
                        addListButton.disabled =
                            lists.length >= options.maxLists

                        break
                }
            }
        })

        ipcRenderer.send('get-settings', [
            ['defaults.background', 'black'],

            ['presentation.maxLists', 3],

            ['presentation.autoFitText', true],
            ['presentation.autoFitTextOpen', true],
            ['presentation.increaseSizeOnFit', true],

            ['presentation.reduceTextSize', true],
            ['presentation.minTextSize', 10],

            ['presentation.autoMinimize', true],
            ['presentation.showSectionWhenMinimized', true],

            ['presentation.autoScroll', true],
            ['presentation.scrollSmooth', true],

            ['presentation.autoSaveInterval', 30],

            ['presentation.removeHistoryCount', 5],

            ['control.keyboard.repeat', false],

            ['control.keyboard.disableDisplay', 'Escape'],

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
            ['control.keyboard.moveSelectedBottom', 'Control+PageDown'],

            ['control.keyboard.focusListUp', 'Control+Shift+ArrowUp'],
            ['control.keyboard.focusListDown', 'Control+Shift+ArrowDown'],

            ['control.keyboard.focusList1', 'Control+Shift+Digit1'],
            ['control.keyboard.focusList2', 'Control+Shift+Digit2'],
            ['control.keyboard.focusList3', 'Control+Shift+Digit3']
        ])
    }

    //Commands from other windows
    {
        ipcRenderer.on('edit', (e, id, data) => {
            let listIndex = -1
            let index = -1

            for (let i = 0; i < lists.length; i++) {
                index = lists[i].list.findIndex(item => item.id === id)

                if (index !== -1) {
                    listIndex = i
                    break
                }
            }

            if (index !== -1) {
                lists[listIndex].list[index].edit(data)

                updateItem(listIndex, index)

                editHasOccured()
            }
        })

        ipcRenderer.on('edit-close', (e, id) => {
            let listIndex = -1
            let index = -1

            for (let i = 0; i < lists.length; i++) {
                index = lists[i].list.findIndex(item => item.id === id)

                if (index !== -1) {
                    listIndex = i
                    break
                }
            }

            if (index !== -1) {
                lists[listIndex].itemsBlock.items[index].editActive = false
            }

            index = activeEditors.indexOf(id)

            if (index !== -1) {
                activeEditors.splice(index, 1)
            }
        })

        let presentationFunctions = {
            'play-next': presentation.forward,
            'play-previous': presentation.back,

            'select-next': presentation.selectForward,
            'select-previous': presentation.selectBack,
            'select-next-item': presentation.selectItemForward,
            'select-previous-item': presentation.selectItemBackward,

            'play-selected': presentation.playSelected
        }

        ipcRenderer.on('presentation', (e, argument) => {
            if (presentationFunctions.hasOwnProperty(argument)) {
                presentationFunctions[argument]()
            }
        })
    }

    //Display data
    let lastDisplay = { bounds: {} }
    ipcRenderer.on('display-info', (e, newDisplay) => {
        display.activeScreens = newDisplay.screens
        display.screenCount = newDisplay.screenCount
        display.masterScreen = newDisplay.masterScreen

        for (let i = 0; i < lists.length; i++) {
            updateListScreenButtons(i)
        }

        //Enable/disable blank button
        if (display.activeScreens.length > 0) {
            blankButton.disabled = false
        } else {
            blankButton.active = false
            blankButton.disabled = true
        }

        //Check if display size has changed, if so update presentation items
        if (
            lastDisplay.bounds.width !== newDisplay.bounds.width ||
            lastDisplay.bounds.height !== newDisplay.bounds.height
        ) {
            lastDisplay = newDisplay

            for (let i = 0; i < lists.length; i++) {
                updateAllItems(i)
            }
        }
    })

    //Autosave
    let loadAutosave = () => {
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

            presentation.load(data)
        })

        loadAutosave = () => {}
    }
    ipcRenderer.on('app-data-path', (e, path) => {
        appDataPath = path

        loadAutosave()
    })
    ipcRenderer.send('get-app-data-path')

    autoSaveTimer = setInterval(autoSaveCheck, options.autoSaveInterval * 1000)
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
{
    item_menu.main.add(undoRemoveButton)
    item_menu.main.add(new layout.Filler())
    item_menu.main.add(blankButton)
    item_menu.main.add(new layout.Filler())
    item_menu.main.add(fitTextAllButton)
}

//======================
//Control Block
//======================
const item_control = {
    minWidth: 410,
    minHeight: 40,
    maxHeight: 40,

    main: new layout.Block(
        {
            childSpacing: 8
        },
        {
            direction: 'horizontal'
        }
    ),

    options: {
        playMode: 'Auto',
        playLoop: false,
        playShuffle: false
    }
}
{
    let loopInput = new layout.CheckboxInput(
        {
            tooltip: 'Loop',
            label: 'Loop'
        },
        {}
    )
    let shuffleInput = new layout.CheckboxInput(
        {
            tooltip: 'Shuffle',
            label: 'Shuffle'
        },
        {}
    )
    let modeSelect = new layout.SelectInput(
        {
            tooltip: 'Mode',
            options: ['Auto', 'Manual']
        },
        {
            width: 52
        }
    )

    item_control.main.add(addListButton)
    item_control.main.add(new layout.Filler())
    item_control.main.add(shuffleInput)
    item_control.main.add(loopInput)
    item_control.main.add(modeSelect)

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
//Previews Block
//======================
class DisplayPreview {
    constructor() {
        this.minWidth = 100
        this.minHeight = 100
        this.main = new layout.Block(
            {
                items: [
                    new layout.Block(
                        {
                            childSpacing: 4
                        },
                        {
                            direction: 'horizontal',
                            justify: 'end',
                            grow: false,
                            shrink: false
                        }
                    )
                ]
            },
            {
                direction: 'vertical',
                overflow: 'hidden'
            }
        )

        this.display = new layout.Display(
            {},
            {
                grow: true,
                align: 'stretch',

                background: true,
                border: true
            }
        )
        this.main.add(this.display)

        this.input = new layout.SelectInput(
            {},
            {
                width: 63
            }
        )
        this.main.items[0].add(this.input)

        this.index = 0
        this.preview = validPreviews[0]

        this.options = {
            index: this.index,
            preview: this.preview
        }

        onDisplayOutputsChange(() => {
            this.updateOptions()
        })

        this.input.onEvent('change', event => {
            let parts = event.value.split(' ')
            let index = parseInt(parts[0]) - 1

            if (
                index < 0 ||
                index >= lists.length ||
                !validPreviews.includes(parts[1])
            ) {
                this.updateOptions()

                return false
            }

            if (this.index !== index || this.preview !== parts[1]) {
                this.index = index
                this.preview = parts[1]

                this.input.value =
                    (this.index + 1).toString() + ' ' + this.preview

                this.display.set(lists[this.index].output[this.preview])

                this.saveOptions()
            }
        })

        this.updateOptions()

        this.setOption = this.setOption.bind(this)

        displayPreviews.push(this)
    }

    updateOptions() {
        let allOptions = []

        for (let i = 0; i < lists.length; i++) {
            for (let j = 0; j < validPreviews.length; j++) {
                allOptions.push((i + 1).toString() + ' ' + validPreviews[j])
            }
        }

        this.input.options = allOptions

        let value = (this.index + 1).toString() + ' ' + this.preview

        this.input.value = value

        if (!allOptions.includes(value)) {
            this.display.set({
                background: 'grey',
                nodes: []
            })
        }

        this.saveOptions()
    }

    saveOptions() {
        if (typeof this.onOption === 'function') {
            this.onOption('index', this.index)
            this.onOption('preview', this.preview)
        }
    }

    setOption(name, value) {
        if (name === 'index' && isFinite(value) && value >= 0) {
            this.index = value
        } else if (name === 'preview' && validPreviews.includes(value)) {
            this.preview = value
        }

        this.input.value = (this.index + 1).toString() + ' ' + this.preview
    }
}

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
    add: item_add,
    menu: item_menu,
    playlist: item_presentation,
    control: item_control,
    'preview 1': new DisplayPreview(),
    'preview 2': new DisplayPreview()
}

//Loading, displaying, & updating layout:
{
    const defaultLayout = {
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
                        item: 'menu',
                        size: 10
                    },
                    {
                        item: 'playlist',
                        size: 80
                    },
                    {
                        item: 'control',
                        size: 10
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

            if (typeof element.setOption === 'function') {
                ipcRenderer.send(
                    'get-setting',
                    'controlWindow.' + item.item,
                    {}
                )
            }

            element.onOption = (property, value) => {
                ipcRenderer.send(
                    'set-setting',
                    'controlWindow.' + item.item + '.' + property,
                    value
                )
            }
        }

        return block
    }

    layout.body.add(getLayoutBlock(defaultLayout))

    ipcRenderer.on('setting', (event, key, interfaceOptions) => {
        if (
            key.startsWith('controlWindow.') &&
            typeof interfaceOptions === 'object'
        ) {
            let item = key.slice(14)

            if (interfaceItems.hasOwnProperty(item)) {
                let itemKeys = Object.keys(interfaceOptions)

                for (let i = 0; i < itemKeys.length; i++) {
                    interfaceItems[item].setOption(
                        itemKeys[i],
                        interfaceOptions[itemKeys[i]]
                    )
                }
            }
        }
    })
}

//If first time opening application, show help window
ipcRenderer.on('setting', (e, key, value) => {
    if (key === 'firstOpen' && value) {
        layout.window.openWindow('help')

        ipcRenderer.send('set-setting', 'firstOpen', false)
    }
})

ipcRenderer.send('get-setting', 'firstOpen', true)

ipcRenderer.on('update-available', (e, version) => {
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
            shell.openExternal('https://display-whisper.brettdoyle.art/update/')
        }
    )
})
