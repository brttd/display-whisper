const ipcRenderer = require('electron').ipcRenderer

const layout = require('dw-layout')
const editor = require('dw-editor')
const Database = require('dw-database')

const Templates = new Database.Group('templates', { load: true, parse: true })

let itemLocked = false

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

const imageBox = displayEditor.add({ type: 'image' })

const imageControl = new layout.ImageStyleEdit({}, { align: 'stretch' })
const boxControl = new layout.BoxStyleEdit(
    {
        x: false,
        y: false
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

imageControl.connect(imageBox)
boxControl.connect(imageBox)
backgroundControl.connect(displayEditor)

const displayButton = new layout.Button({ text: 'Display' })

const okButton = new layout.Button({ text: 'OK' })
const applyButton = new layout.Button({ text: 'Apply' })
const cancelButton = new layout.Button({ text: 'Cancel' })

layout.change(layout.body, {
    direction: 'vertical'
})
layout.body.add(
    new layout.LayoutBlock({
        items: [
            /* Templates */
            new layout.LayoutBlock({
                items: [
                    new layout.Block(
                        {
                            items: [
                                new layout.Text({ text: 'Templates' }),
                                new layout.Block(
                                    {
                                        items: [
                                            templateSelector,
                                            applyTemplateButton
                                        ],
                                        childSpacing: '8px'
                                    },
                                    {
                                        padding: 0,
                                        direction: 'horizontal'
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
                                imageControl,
                                boxControl,
                                backgroundControl,
                                playControl,
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

                size: 70,
                minWidth: 450,
                minHeight: 400
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
                        {}
                    )
                ],

                size: 10,
                minWidth: 100,
                minHeight: 40,
                maxHeight: 40
            })
        ],

        direction: 'vertical',
        small: true
    })
)

layout.menu.add('edit')
layout.menu.add({
    label: 'Image Library...',
    window: 'imageDatabase'
})
layout.menu.add({
    label: 'Edit Templates...',
    window: 'templateEditor'
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

            return false
        }

        editor.change(
            editor.util.filterObj(
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

                    database: true,
                    url: true,

                    font: true,
                    size: true,
                    color: true,

                    lineHeight: true,

                    align: true,
                    maxLines: true,

                    x: true,
                    y: true,

                    sectionOverlay: true,
                    endOverlay: true
                },
                true
            )
        )

        update()
    })
}

function update() {
    displayEditor.set(editor.data)
    imageBox.set(editor.data)
    playControl.set(editor.data)
}

let onChange = event => {
    if (!event.fromUser) {
        return false
    }

    editor.change(
        editor.util.filterObj(event, { from: true, fromUser: true }, true)
    )
}

displayEditor.onEvent('change', onChange)
imageBox.onEvent('change', onChange)
playControl.onEvent('change', onChange)

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
        update()
    }
})

displayButton.onEvent('click', () => {
    let display = editor.util.copyObj(editor.data)
    display.nodes = [editor.util.copyObj(editor.data)]
    display.nodes[0].type = 'image'
    ipcRenderer.send('display', display, process.pid)
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

ipcRenderer.on('edit-data', (event, data) => {
    editor.set(data)

    imageBox.focus()
    update()
})

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

                    return false
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
