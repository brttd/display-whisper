const { ipcRenderer } = require('electron')

const layout = require('dw-layout')

const logger = require('dw-log')
const Database = require('dw-database')
const editor = require('dw-editor')
const richText = require('dw-rich-text')

const Templates = new Database.Group('templates', { load: true, parse: true })

let increaseSizeOnFit = true

let itemLocked = false

const sectionEditor = new layout.List(
    {
        reorderable: true,
        editButton: true,
        removeButton: true,

        addInput: true
    },
    {
        border: false
    }
)

const templateSelector = new layout.SelectInput({})
const applyTemplateButton = new layout.Button({
    text: 'Apply'
})

const nodesEditor = new layout.List({
    reorderable: true,
    editButton: false,
    removeButton: true,

    addInput: ['Text', 'Image']
})

const displayEditor = new layout.DisplayEdit(
    {},
    {
        size: '100%',
        shrink: true,
        grow: true,
        align: 'stretch',

        background: true,
        border: true
    }
)

const backgroundControl = new layout.BackgroundStyleEdit({})
const playControl = new layout.PlayStyleEdit({})

const boxControl = new layout.BoxStyleEdit({})
const textControl = new layout.TextStyleEdit({})
const imageControl = new layout.ImageStyleEdit({})

const fitTextButton = new layout.Button({
    text: 'Scale Text'
})

const displayButton = new layout.Button({
    text: 'Display'
})

const okButton = new layout.Button({
    text: 'OK'
})
const applyButton = new layout.Button({
    text: 'Apply'
})
const cancelButton = new layout.Button({
    text: 'Cancel'
})

layout.body.add(
    new layout.LayoutBlock({
        items: [
            new layout.LayoutBlock({
                items: [
                    //Sections
                    new layout.LayoutBlock({
                        items: [sectionEditor],

                        size: 20,

                        minWidth: 120,
                        maxWidth: 200
                    }),
                    //Templates, Editor
                    new layout.LayoutBlock({
                        items: [
                            //Templates
                            new layout.LayoutBlock({
                                items: [],

                                size: 10,

                                minWidth: 100,
                                minHeight: 66,
                                maxHeight: 66
                            }),
                            //Editor + Nodes list
                            new layout.LayoutBlock({
                                items: [
                                    //Editor
                                    new layout.LayoutBlock({
                                        items: [
                                            new layout.Block(
                                                {
                                                    items: [
                                                        playControl,
                                                        backgroundControl,
                                                        boxControl,
                                                        textControl,
                                                        imageControl,
                                                        displayEditor
                                                    ],

                                                    childSpacing: 8
                                                },
                                                {
                                                    direction: 'vertical'
                                                }
                                            )
                                        ],

                                        size: 70
                                    }),
                                    //Nodes list
                                    new layout.LayoutBlock({
                                        items: [nodesEditor],

                                        size: 30,

                                        minWidth: 120,
                                        maxWidth: 120
                                    })
                                ],

                                size: 90,
                                direction: 'horizontal'
                            })
                        ],

                        size: 80
                    })
                ],

                direction: 'horizontal'
            }),
            //Disply, OK, Apply, Cancel
            new layout.LayoutBlock({
                items: [
                    new layout.Block({
                        items: [
                            displayButton,
                            new layout.Filler(),
                            okButton,
                            applyButton,
                            cancelButton
                        ],
                        childSpacing: 8
                    })
                ],

                minWidth: 70,
                minHeight: 40,
                maxHeight: 40
            })
        ]
    })
)

backgroundControl.connect(displayEditor)

const editNodes = []
const textNodeStorage = []
const imageNodeStorage = []

let activeIndex = -1

function changeSection(index, change) {
    if (index < 0 || index >= editor.data.sections.length) {
        return false
    }

    let newSections = []

    for (let i = 0; i < editor.data.sections.length; i++) {
        newSections.push({})
    }

    newSections[index] = change

    editor.change('sections', newSections)
}

function changeSectionNode(sectionIndex, nodeIndex, nodeChange) {
    if (
        sectionIndex < 0 ||
        sectionIndex >= editor.data.sections.length ||
        nodeIndex < 0 ||
        nodeIndex >= editor.data.sections[sectionIndex].nodes.length
    ) {
        return false
    }

    let newSections = []

    for (let i = 0; i < editor.data.sections.length; i++) {
        newSections.push({})
    }

    newSections[sectionIndex].nodes = []

    for (let i = 0; i < editor.data.sections[sectionIndex].nodes.length; i++) {
        newSections[sectionIndex].nodes.push({})
    }

    newSections[sectionIndex].nodes[nodeIndex] = nodeChange

    editor.change('sections', newSections)
}

function onNodeChange(event) {
    changeSectionNode(
        activeIndex,
        editNodes.indexOf(event.from),
        editor.util.filterObj(
            event,
            {
                from: true,
                fromUser: true
            },
            true
        )
    )
}
function onNodeFocus(event) {
    nodesEditor.select(editNodes.indexOf(event.from))
}

function addTextNode() {
    textNodeStorage.push(
        displayEditor.add({
            type: 'text'
        })
    )

    boxControl.connect(textNodeStorage[textNodeStorage.length - 1])
    textControl.connect(textNodeStorage[textNodeStorage.length - 1])

    textNodeStorage[textNodeStorage.length - 1].onEvent('change', onNodeChange)
    textNodeStorage[textNodeStorage.length - 1].onEvent('focus', onNodeFocus)
}
function addImageNode() {
    imageNodeStorage.push(
        displayEditor.add({
            type: 'image'
        })
    )

    boxControl.connect(imageNodeStorage[imageNodeStorage.length - 1])
    imageControl.connect(imageNodeStorage[imageNodeStorage.length - 1])

    imageNodeStorage[imageNodeStorage.length - 1].onEvent(
        'change',
        onNodeChange
    )
    imageNodeStorage[imageNodeStorage.length - 1].onEvent('focus', onNodeFocus)
}

function showSection(index, nodeFocusIndex) {
    if (index < 0 || index >= editor.data.sections.length) {
        return false
    }

    activeIndex = index

    displayEditor.set(
        editor.util.filterObj(
            editor.data.sections[activeIndex],
            {
                nodes: true
            },
            true
        )
    )
    playControl.set(editor.data.sections[activeIndex])

    for (let i = 0; i < textNodeStorage.length; i++) {
        textNodeStorage[i].hide()
    }
    for (let i = 0; i < imageNodeStorage.length; i++) {
        imageNodeStorage[i].hide()
    }

    editNodes.splice(0, editNodes.length)

    let textCount = 0
    let imageCount = 0

    nodesEditor.clear()

    for (let i = 0; i < editor.data.sections[activeIndex].nodes.length; i++) {
        if (editor.data.sections[activeIndex].nodes[i].type === 'text') {
            if (textCount >= textNodeStorage.length) {
                addTextNode()
            }

            editNodes.push(textNodeStorage[textCount])

            textCount += 1

            nodesEditor.add('Text')
        } else if (
            editor.data.sections[activeIndex].nodes[i].type === 'image'
        ) {
            if (imageCount >= imageNodeStorage.length) {
                addImageNode()
            }

            editNodes.push(imageNodeStorage[imageCount])

            imageCount += 1

            nodesEditor.add('Image')
        }

        editNodes[i].edit(editor.data.sections[activeIndex].nodes[i])

        editNodes[i].show()
    }

    if (editNodes.length > 0) {
        editNodes[0].focus()
    }
}

function updateSectionList() {
    let lastSelected = sectionEditor.selected

    sectionEditor.clear()

    for (let i = 0; i < editor.data.sections.length; i++) {
        sectionEditor.add(editor.data.sections[i].name)
    }

    if (sectionEditor.asArray().includes(lastSelected)) {
        sectionEditor.select(lastSelected)
    } else {
        sectionEditor.select(0)
    }
}

//Templates
{
    Templates.onEvent('update', () => {
        let lastSelected = templateSelector.value

        templateSelector.options = Templates.list.map(template => template.name)

        if (templateSelector.options.includes(lastSelected)) {
            templateSelector.value = lastSelected
        } else {
            templateSelector.index = 0
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

    applyTemplateButton.onEvent('click', () => {
        let template = Templates.list[templateSelector.index]

        if (!template) {
            layout.dialog.showNotification({
                type: 'error',
                message:
                    'Unable to apply template! Could not find template with that name.'
            })

            logger.error(
                "User tried to apply template which wasn't found!",
                templateSelector.value
            )

            return false
        }

        template = editor.util.filterObj(
            template,
            {
                ID: true,
                _ID: true,
                _filename: true,
                _group: true,

                group: true,
                groupID: true,

                name: true,

                top: true,
                left: true,
                right: true,
                bottom: true,

                opacity: true,

                font: true,
                size: true,
                color: true,

                align: true,
                y: true,

                scale: true,

                maxLines: true,
                sectionOverlay: true,
                endOverlay: true
            },
            true
        )

        let sectionChanges = editor.util.filterObj(
            template,
            {
                text: true,
                image: true
            },
            true
        )

        let textNodeChanges = editor.util.filterObj(
            template.text,
            {
                text: true,
                plainText: true,

                top: true,
                left: true,
                right: true,
                bottom: true
            },
            true
        )
        let imageNodeChanges = editor.util.filterObj(
            template.image,
            {
                url: true,
                database: true,

                top: true,
                left: true,
                right: true,
                bottom: true
            },
            true
        )

        let changes = {
            template: template,

            sections: []
        }

        for (let i = 0; i < editor.data.sections.length; i++) {
            changes.sections.push(editor.util.copyObj(sectionChanges))
            changes.sections[i].nodes = []

            if (editor.data.sections[i].nodes.length === 1) {
                if (editor.data.sections[i].nodes[0].type === 'text') {
                    changes.sections[i].nodes.push(
                        editor.util.copyObj(template.text)
                    )
                } else if (editor.data.sections[i].nodes[0].type === 'image') {
                    changes.sections[i].nodes.push(
                        editor.util.copyObj(template.image)
                    )
                } else {
                    changes.sections[i].nodes.push({})
                }
            } else {
                for (let j = 0; j < editor.data.sections[i].nodes.length; j++) {
                    if (editor.data.sections[i].nodes[j].type === 'text') {
                        changes.sections[i].nodes.push(
                            editor.util.copyObj(textNodeChanges)
                        )
                    } else if (
                        editor.data.sections[i].nodes[j].type === 'image'
                    ) {
                        changes.sections[i].nodes.push(
                            editor.util.copyObj(imageNodeChanges)
                        )
                    } else {
                        changes.sections[i].nodes.push({})
                    }
                }
            }
        }

        editor.change(changes)

        updateSectionList()
    })

    let defaultTemplateListenerFunc = (event, key, value) => {
        if (key === 'general.defaultTemplate') {
            ipcRenderer.removeListener('setting', defaultTemplateListenerFunc)

            if (Templates.updating) {
                Templates.onceEvent('update', () => {
                    templateSelector.value = value
                })
            } else {
                templateSelector.value = value
            }
        }
    }

    ipcRenderer.on('setting', defaultTemplateListenerFunc)
    ipcRenderer.send('get-setting', 'general.defaultTemplate')
}

//Sections
{
    sectionEditor.onEvent('select', event => {
        showSection(event.index)
    })

    sectionEditor.onEvent('remove', event => {
        if (
            !event.fromUser ||
            event.index < 0 ||
            event.index >= editor.data.sections.length
        ) {
            return false
        }

        let newSections = editor.util.copyObj(editor.data.sections)
        newSections.splice(event.index, 1)

        editor.change('sections', newSections)

        updateSectionList()
    })

    sectionEditor.onEvent('reorder', event => {
        if (
            !event.fromUser ||
            editor.data.sections.length <= 1 ||
            event.oldIndex < 0 ||
            event.oldIndex >= editor.data.sections.length ||
            event.index < 0 ||
            event.index > editor.data.sections.length
        ) {
            return false
        }

        let index = event.index

        if (index > event.oldIndex) {
            index -= 1
        } else if (event.oldIndex === index) {
            updateSectionList()

            return
        }

        let newSections = editor.util.copyObj(editor.data.sections)

        //Remove the moved section
        let section = newSections.splice(event.oldIndex, 1)[0]

        //And add it back in the new place
        //If the new place is before the original, then use it
        //If it's after, then subtract one, as the indexing is based of the total amount of items, but newSections array has had one item removed
        newSections.splice(index, 0, section)

        editor.change('sections', newSections)

        updateSectionList()
    })

    sectionEditor.onEvent('enter', event => {
        if (
            !event.fromUser ||
            event.index < 0 ||
            event.index >= editor.data.sections.length
        ) {
            return false
        }

        changeSection(event.index, {
            name: event.text
        })
    })

    sectionEditor.onEvent('add', event => {
        if (!event.fromUser) {
            return false
        }

        let section = editor.util.copyObj(editor.data.template)

        if (event.text.trim() === '') {
            section.name =
                'Section ' + (editor.data.sections.length + 1).toString()
        } else {
            section.name = event.text.trim()
        }

        section.nodes = []

        let newSections = []
        for (let i = 0; i < editor.data.sections.length; i++) {
            newSections.push({})
        }

        newSections.push(section)

        editor.change('sections', newSections)

        updateSectionList()
        sectionEditor.select(sectionEditor.items.length - 1)
    })
}

//Nodes
{
    nodesEditor.onEvent('select', event => {
        if (
            event.fromUser &&
            event.index >= 0 &&
            event.index < editNodes.length
        ) {
            editNodes[event.index].focus()
        }
    })
    nodesEditor.onEvent('remove', event => {
        if (
            !event.fromUser ||
            activeIndex < 0 ||
            activeIndex >= editor.data.sections.length
        ) {
            return false
        }

        let sectionChange = {
            nodes: []
        }

        for (let i = 0; i < event.index; i++) {
            sectionChange.nodes.push({})
        }

        for (let i = event.index + 1; i < editNodes.length; i++) {
            sectionChange.nodes.push(editNodes[i].getData())
        }

        changeSection(activeIndex, sectionChange)
        showSection(
            activeIndex,
            Math.min(event.index, sectionChange.nodes.length - 1)
        )
    })
    nodesEditor.onEvent('reorder', event => {
        if (
            !event.fromUser ||
            activeIndex < 0 ||
            activeIndex >= editor.data.sections.length ||
            event.oldIndex < 0 ||
            event.oldIndex >= editor.data.sections[activeIndex].nodes.length ||
            event.index < 0 ||
            event.index >= editor.data.sections[activeIndex].nodes.length
        ) {
            return false
        }

        if (event.index === event.oldIndex) {
            showSection(activeIndex, event.index)
        }

        let sectionChange = {
            nodes: []
        }

        for (
            let i = 0;
            i < editor.data.sections[activeIndex].nodes.length;
            i++
        ) {
            sectionChange.push({})
        }

        sectionChange.nodes[event.oldIndex] =
            editor.data.sections[activeIndex].nodes[event.index]

        sectionChange.nodes[event.index] =
            editor.data.sections[activeIndex].nodes[event.oldIndex]

        changeSection(activeIndex, sectionChange)

        showSection(activeIndex, event.index)
    })
    nodesEditor.onEvent('add', event => {
        if (
            !event.fromUser ||
            activeIndex < 0 ||
            activeIndex >= editor.data.sections.length
        ) {
            return false
        }

        let newNode = {}

        if (event.text === 'Text') {
            let index = -1

            for (let i = 0; i < textNodeStorage.length; i++) {
                if (!textNodeStorage[i].visible) {
                    index = i
                    break
                }
            }

            if (index === -1) {
                addTextNode()
                index = textNodeStorage.length - 1
            }

            editNodes.push(textNodeStorage[index])

            newNode = editor.util.copyObj(editor.data.template.text)
            newNode.type = 'text'
        } else if (event.text === 'Image') {
            let index = -1

            for (let i = 0; i < imageNodeStorage.length; i++) {
                if (!imageNodeStorage[i].visible) {
                    index = i
                    break
                }
            }

            if (index === -1) {
                addImageNode()
                index = imageNodeStorage.length - 1
            }

            editNodes.push(imageNodeStorage[index])

            newNode = editor.util.copyObj(editor.data.template.image)
            newNode.type = 'image'
        }

        editNodes[editNodes.length - 1].edit(newNode)
        editNodes[editNodes.length - 1].show()

        let sectionChange = {
            nodes: []
        }

        for (let i = 0; i < editNodes.length; i++) {
            sectionChange.nodes.push({})
        }

        sectionChange.nodes[editNodes.length - 1] = editNodes[
            editNodes.length - 1
        ].getData()

        changeSection(activeIndex, sectionChange)
    })
}

//Background + Play changes
{
    displayEditor.onEvent('change', event => {
        if (!event.fromUser) {
            return false
        }

        changeSection(
            activeIndex,
            editor.util.filterObj(
                event,
                {
                    from: true,
                    fromUser: true
                },
                true
            )
        )
    })

    playControl.onEvent('change', event => {
        if (!event.fromUser) {
            return false
        }

        changeSection(
            activeIndex,
            editor.util.filterObj(
                event,
                {
                    from: true,
                    fromUser: true
                },
                true
            )
        )
    })
}

editor.onEvent('output', data => {
    ipcRenderer.send('edit', data)

    if (editor.data.sections.length > 0) {
        layout.window.setDocument(editor.data.sections[0].name)
    } else {
        layout.window.setDocument('')
    }

    layout.window.setDocumentEdited(false)
})

layout.menu.onEvent('edit', item => {
    if (item.value === 'undo') {
        editor.undo()
    } else if (item.value === 'redo') {
        editor.redo()
    }
})

editor.onEvent('change', from => {
    if (from === 'undo' || from === 'redo') {
        updateSectionList()
    }

    layout.window.setDocumentEdited(editor.hasChanges)
})

editor.onEvent('history', () => {
    layout.menu.change('edit', 'undo', {
        enabled: editor.canUndo
    })
    layout.menu.change('edit', 'redo', {
        enabled: editor.canRedo
    })
})

displayButton.onEvent('click', () => {
    if (activeIndex >= 0 && activeIndex < editor.data.sections.length) {
        ipcRenderer.send(
            'display',
            editor.util.copyObj(editor.data.sections[activeIndex])
        )
    }
})

okButton.onEvent('click', () => {
    if (itemLocked) {
        layout.dialog.showNotification(
            'The item is being modified in the presentation! Please wait.'
        )

        return false
    }

    editor.apply()

    layout.window.close()
})

applyButton.onEvent('click', () => {
    if (itemLocked) {
        layout.dialog.showNotification(
            'The item is being modified in the presentation! Please wait.'
        )

        return false
    }

    editor.apply()
})

cancelButton.onEvent('click', layout.window.close)

layout.window.onEvent('close', event => {
    if (editor.hasChanges) {
        event.wait()

        layout.dialog.showQuestion(
            {
                title: 'Apply changes?',
                message:
                    'You have made changes to this item which have not been applied!',
                detail: 'Do you want to apply your changes?',

                options: ['Apply', 'Discard', 'Cancel']
            },
            (error, answer) => {
                if (answer === 'Apply') {
                    ipcRenderer.send('edit', editor.changes)
                } else if (answer === 'Cancel') {
                    event.cancel()
                    return
                }

                event.close()
            }
        )
    }
})

let gotData = false
ipcRenderer.on('edit-data', (event, data) => {
    if (gotData) {
        layout.dialog.showQuestion(
            {
                title: 'Update?',
                message:
                    'The item has been modified in the presentation! Do you want to see the new changes?',
                detail: "Any changes you've made will be lost!",
                options: ['Yes', 'No']
            },
            (error, answer) => {
                if (error) {
                    logger.error(
                        "Couldn't ask user if they wanted to update to new item data",
                        error
                    )

                    return false
                }

                if (answer === 'Yes') {
                    editor.set(data)

                    updateSectionList()

                    if (editor.data.sections.length > 0) {
                        layout.window.setDocument(editor.data.sections[0].name)
                    } else {
                        layout.window.setDocument('')
                    }
                }
            }
        )

        return false
    }

    gotData = true
    editor.set(data)

    updateSectionList()

    if (editor.data.sections.length > 0) {
        layout.window.setDocument(editor.data.sections[0].name)
    } else {
        layout.window.setDocument('')
    }
})

ipcRenderer.on('lock', () => {
    itemLocked = true
})
ipcRenderer.on('unlock', () => {
    itemLocked = false
})

ipcRenderer.on('setting', (event, key, value) => {
    if (key === 'display.increaseSizeOnFit') {
        increaseSizeOnFit = value
    }
})

ipcRenderer.send('get-setting', 'display.increaseSizeOnFit', true)
