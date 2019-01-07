const { ipcRenderer } = require('electron')

const layout = require('dw-layout')
const editor = require('dw-editor')
const richText = require('dw-rich-text')
const logger = require('dw-log')
const Database = require('dw-database')

const Templates = new Database.Group('templates', { load: true, parse: true })

let increaseSizeOnFit = true

let itemLocked = false

const sectionEditor = new layout.List({
    reorderable: true,
    editButton: true,
    removeButton: true,

    addInput: true
})

const templateSelector = new layout.SelectInput({})
const applyTemplateButton = new layout.Button({
    text: 'Apply'
})

const displayEditor = new layout.DisplayEdit(
    {},
    {
        size: '100%',
        shrink: 1,
        grow: 1,
        align: 'stretch',

        background: 'rgb(128, 128, 128)',
        border: true
    }
)

const textBox = displayEditor.add({
    type: 'text'
})

const textControl = new layout.TextStyleEdit(
    {},
    {
        align: 'stretch'
    }
)
const boxControl = new layout.BoxStyleEdit(
    {
        x: false
    },
    {
        align: 'stretch'
    }
)
const backgroundControl = new layout.BackgroundStyleEdit(
    {},
    {
        align: 'stretch'
    }
)
const playControl = new layout.PlayStyleEdit(
    {},
    {
        align: 'stretch'
    }
)

const maxLinesEditor = new layout.NumberInput({
    value: 0,
    max: 100,
    min: 0,
    precision: 0,

    popupMax: 20
})

const fitTextButton = new layout.Button({
    text: 'Fit Text & Unify'
})

const updateSectionsButton = new layout.Button({
    text: 'Update Sections'
})
updateSectionsButton.visible = false

const sectionsBar = new layout.Block({
    items: [
        new layout.Text(
            {
                text: 'Max lines per section'
            },
            { align: 'center' }
        ),
        maxLinesEditor,
        updateSectionsButton,
        fitTextButton
    ],

    childSpacing: '8px'
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

textControl.connect(textBox)
boxControl.connect(textBox)
backgroundControl.connect(displayEditor)

{
    layout.change(maxLinesEditor, {
        align: 'center'
    })
    layout.change(updateSectionsButton, {
        align: 'center'
    })
    layout.change(fitTextButton, {
        align: 'center'
    })
    layout.change(sectionsBar, {
        direction: 'horizontal',

        size: '35px',

        grow: 0,
        shrink: 0,

        padding: 0
    })

    layout.body.add(
        new layout.LayoutBlock({
            items: [
                new layout.LayoutBlock({
                    items: [
                        /* Sections */
                        new layout.LayoutBlock({
                            items: [sectionEditor],

                            size: 20,

                            minWidth: 150,
                            maxWidth: 300
                        }),
                        new layout.LayoutBlock({
                            items: [
                                /* Templates */
                                new layout.LayoutBlock({
                                    items: [
                                        new layout.Block(
                                            {
                                                items: [
                                                    new layout.Text({
                                                        text: 'Templates'
                                                    }),
                                                    new layout.Block(
                                                        {
                                                            items: [
                                                                templateSelector,
                                                                applyTemplateButton
                                                            ],
                                                            childSpacing: '8px'
                                                        },
                                                        {
                                                            direction:
                                                                'horizontal',
                                                            padding: 0
                                                        }
                                                    )
                                                ],

                                                childSpacing: '8px'
                                            },
                                            {
                                                direction: 'vertical',
                                                align: 'end'
                                            }
                                        )
                                    ],

                                    size: 20,
                                    minWidth: 100,
                                    minHeight: 66,
                                    maxHeight: 66
                                }),
                                /* Editor */
                                new layout.LayoutBlock({
                                    items: [
                                        new layout.Block(
                                            {
                                                items: [
                                                    textControl,
                                                    boxControl,
                                                    backgroundControl,
                                                    playControl,
                                                    sectionsBar,
                                                    displayEditor
                                                ],
                                                childSpacing: '8px'
                                            },
                                            {
                                                direction: 'vertical',
                                                overflow: 'hidden'
                                            }
                                        )
                                    ],
                                    size: 80,
                                    minWidth: 500,
                                    minHeight: 400
                                })
                            ],

                            direction: 'vertical',
                            size: 80,

                            small: true
                        })
                    ],

                    direction: 'horizontal'
                }),
                /* OK, Apply, Cancel */
                new layout.LayoutBlock({
                    items: [
                        new layout.Block(
                            {
                                items: [
                                    displayButton,
                                    new layout.Filler(),
                                    okButton,
                                    applyButton,
                                    cancelButton
                                ],
                                childSpacing: '8px'
                            },
                            {
                                //align: 'end'
                            }
                        )
                    ],

                    minWidth: 70,

                    minHeight: 40,
                    maxHeight: 40
                })
            ]
        })
    )
}

layout.menu.add('edit')
layout.menu.add({
    label: 'Edit Templates...',
    window: 'templateEditor'
})

let displaySections = []

let activeIndex = -1

function showSection(index) {
    if (index < 0 || index >= displaySections.length) {
        return false
    }

    activeIndex = index

    displayEditor.set(displaySections[activeIndex])
    textBox.set(displaySections[activeIndex])

    playControl.set(displaySections[activeIndex])
}

function updateSections() {
    displaySections = []

    for (
        let sectionIndex = 0;
        sectionIndex < editor.data.sections.length;
        sectionIndex++
    ) {
        let sectionParts = richText.distributeLines(
            editor.data.sections[sectionIndex].text,
            editor.data.maxLines
        )

        if (sectionParts.length === 1) {
            displaySections.push(
                editor.util.copyObj(editor.data.sections[sectionIndex])
            )
            displaySections[
                displaySections.length - 1
            ]._sectionIndex = sectionIndex
        } else {
            for (
                let partIndex = 0;
                partIndex < sectionParts.length;
                partIndex++
            ) {
                let sectionPart = editor.util.copyObj(
                    editor.data.sections[sectionIndex]
                )

                sectionPart._sectionIndex = sectionIndex
                sectionPart.name += ' - ' + String.fromCharCode(97 + partIndex)
                sectionPart.text = sectionParts[partIndex]
                sectionPart.plainText = richText.removeFormat(
                    sectionParts[partIndex]
                )

                displaySections.push(sectionPart)
            }
        }
    }

    updateSectionsButton.visible = false
    sectionEditor.clear()

    for (let i = 0; i < displaySections.length; i++) {
        sectionEditor.add(displaySections[i].name)
    }
}

function updateSectionsAndSelect() {
    let lastSelected = sectionEditor.selected

    let lastIndex = 0
    if (activeIndex > 0 && activeIndex < displaySections.length) {
        lastIndex = displaySections[activeIndex]._sectionIndex
    }

    updateSections()

    if (sectionEditor.asArray().includes(lastSelected)) {
        sectionEditor.select(lastSelected)
    } else {
        lastIndex = Math.min(displaySections.length - 1, lastIndex)

        sectionEditor.select(lastIndex)
    }
}

function changeSection(index, change) {
    if (index < 0 || index >= displaySections.length) {
        return false
    }

    let actualIndex = displaySections[index]._sectionIndex

    let noTextChange = editor.util.filterObj(
        change,
        {
            text: true,
            plainText: true
        },
        true
    )

    for (let i = 0; i < displaySections.length; i++) {
        if (displaySections[i]._sectionIndex === actualIndex) {
            if (i === index) {
                editor.util.applyObj(displaySections[i], change)
            } else {
                editor.util.applyObj(displaySections[i], noTextChange)
            }
        }
    }

    if (
        typeof change.text === 'string' ||
        typeof change.plainText === 'string'
    ) {
        let newText = []

        for (let i = 0; i < displaySections.length; i++) {
            if (displaySections[i]._sectionIndex === actualIndex) {
                if (i === index) {
                    newText.push(
                        change.text || richText.format(change.plainText)
                    )
                } else {
                    newText.push(displaySections[i].text)
                }
            }
        }

        newText = newText.join('\n')

        change.text = newText
        change.plainText = richText.removeFormat(newText)

        if (editor.data.maxLines > 0) {
            updateSectionsButton.visible = true
        }
    }

    let newSections = []

    for (let i = 0; i < editor.data.sections.length; i++) {
        newSections.push({})
    }

    newSections[actualIndex] = change

    editor.change('sections', newSections)
}

maxLinesEditor.onEvent('change', event => {
    if (event.value >= 0 && isFinite(event.value)) {
        editor.change('maxLines', ~~event.value)

        updateSectionsAndSelect()
    }
})

updateSectionsButton.onEvent('click', () => {
    updateSectionsAndSelect()
})

fitTextButton.onEvent('click', () => {
    layout.Display.getMaxTextSize(displaySections, maxSize => {
        if (isFinite(maxSize) && maxSize > 0) {
            if (!increaseSizeOnFit) {
                let maxSectionSize = 0

                for (let i = 0; i < editor.data.sections.length; i++) {
                    maxSectionSize = Math.max(
                        maxSectionSize,
                        editor.data.sections[i].size
                    )
                }

                maxSize = Math.min(maxSize, maxSectionSize)
            }

            let newSections = []

            for (let i = 0; i < editor.data.sections.length; i++) {
                newSections.push({ size: maxSize })
            }

            editor.change('sections', newSections)

            updateSectionsAndSelect()
        } else {
            logger.error('getMaxTextSize returned invalid value!', maxSize)
        }
    })
})

//Templates
{
    Templates.onEvent('update', () => {
        let lastSelected = templateSelector.value

        templateSelector.options = Templates.list.map(template => {
            return template.name
        })

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
                text: true,
                plainText: true,

                scale: true,

                sectionOverlay: true,
                endOverlay: true
            },
            true
        )

        let sectionChanges = editor.util.filterObj(
            template,
            {
                maxLines: true
            },
            true
        )

        let changes = {
            template: editor.util.filterObj(template, { maxLines: true }, true),

            sections: []
        }

        if (
            typeof template.maxLines === 'number' &&
            isFinite(template.maxLines) &&
            template.maxLines >= 0
        ) {
            changes.maxLines = template.maxLines

            maxLinesEditor.value = changes.maxLines
        }

        for (let i = 0; i < editor.data.sections.length; i++) {
            changes.sections.push(sectionChanges)
        }

        editor.change(changes)

        updateSectionsAndSelect()
    })
}

//Section changes
{
    sectionEditor.onEvent('select', event => {
        showSection(event.index)
    })

    sectionEditor.onEvent('remove', event => {
        if (
            !event.fromUser ||
            event.index < 0 ||
            event.index >= displaySections.length
        ) {
            return false
        }

        let actualIndex = displaySections[event.index]._sectionIndex

        let newSections = editor.util.copyObj(editor.data.sections)
        newSections.splice(actualIndex, 1)

        editor.change('sections', newSections)

        updateSectionsAndSelect()
    })

    sectionEditor.onEvent('reorder', event => {
        if (
            !event.fromUser ||
            displaySections.length <= 1 ||
            event.oldIndex < 0 ||
            event.oldIndex >= displaySections.length ||
            event.index < 0 ||
            event.index > displaySections.length
        ) {
            return false
        }

        if (event.index > event.oldIndex) {
            event.index -= 1
        }

        let actualIndex = displaySections[event.oldIndex]._sectionIndex
        let newIndex = displaySections[event.index]._sectionIndex

        if (actualIndex === newIndex) {
            updateSectionsAndSelect()

            return
        }

        let newSections = editor.util.copyObj(editor.data.sections)

        //Remove the moved section
        let section = newSections.splice(actualIndex, 1)[0]

        //And add it back in the new place
        //If the new place is before the original, then use it
        //If it's after, then subtract one, as the indexing is based of the total amount of items, but newSections array has had one item removed
        newSections.splice(newIndex, 0, section)

        editor.change('sections', newSections)

        updateSectionsAndSelect()
    })

    sectionEditor.onEvent('enter', event => {
        if (
            !event.fromUser ||
            event.index < 0 ||
            event.index >= displaySections.length
        ) {
            return false
        }

        changeSection(displaySections[event.index]._sectionIndex, {
            name: event.text
        })
    })

    sectionEditor.onEvent('add', event => {
        if (!event.fromUser) {
            return false
        }

        let section = editor.util.copyObj(editor.data.template)
        section.text = section.plainText = section.name = ''

        if (event.text.trim() !== '') {
            section.name = event.text

            section.text = richText.format(event.text)
            section.plainText = event.text
        } else {
            section.name =
                'Text ' + (editor.data.sections.length + 1).toString()
        }

        let newSections = []
        for (let i = 0; i < editor.data.sections.length; i++) {
            newSections.push({})
        }

        newSections.push(section)

        editor.change('sections', newSections)

        updateSections()
        sectionEditor.select(sectionEditor.items.length - 1)
    })
}

//content changes
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

    textBox.onEvent('change', event => {
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
})

editor.onEvent('history', () => {
    layout.menu.change('edit', {
        undo: editor.canUndo,
        redo: editor.canRedo
    })
})

editor.onEvent('change', from => {
    if (from === 'undo' || from === 'redo') {
        updateSectionsAndSelect()
    }
})

displayButton.onEvent('click', () => {
    if (activeIndex >= 0 && activeIndex < displaySections.length) {
        let fullDisplay = editor.util.copyObj(displaySections[activeIndex])
        fullDisplay.nodes = [editor.util.copyObj(displaySections[activeIndex])]
        fullDisplay.nodes[0].type = 'text'

        ipcRenderer.send('display', fullDisplay, process.pid)
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

cancelButton.onEvent('click', () => {
    layout.window.close()
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

                    maxLinesEditor.value = data.maxLines

                    updateSections()
                    sectionEditor.select(0)
                }
            }
        )

        return false
    }

    gotData = true
    editor.set(data)

    updateSections()
    sectionEditor.select(0)

    maxLinesEditor.value = data.maxLines
})

ipcRenderer.on('setting', (event, key, value) => {
    if (key === 'display.increaseSizeOnFit') {
        increaseSizeOnFit = value
    }
})

ipcRenderer.send('get-setting', 'display.increaseSizeOnFit', true)

layout.menu.onEvent('edit', event => {
    if (event.label === 'Undo') {
        editor.undo()
    } else if (event.label === 'Redo') {
        editor.redo()
    }
})

layout.window.onEvent('close', event => {
    if (editor.hasChanges) {
        event.wait()

        layout.dialog.showQuestion(
            {
                title: 'Apply changes?',
                message:
                    'You have made changes to this item which have not yet been applied!',
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

ipcRenderer.on('lock', () => {
    itemLocked = true
})
ipcRenderer.on('unlock', () => {
    itemLocked = false
})
