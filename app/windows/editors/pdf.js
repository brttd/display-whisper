const ipcRenderer = require('electron').ipcRenderer

const pdfjs = require('../../pdfjs/pdf')
pdfjs.GlobalWorkerOptions.workerSrc = '../pdfjs/pdf.worker.js'

const layout = require('dw-layout')

const Database = require('dw-database')
const editor = require('dw-editor')

const Templates = new Database.Group('templates', { load: true, parse: true })

let itemLocked = false

const templateSelector = new layout.SelectInput({})
const applyTemplateButton = new layout.Button({
    text: 'Apply'
})

const displayPreview = new layout.Display(
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

const pageList = new layout.List(
    {
        editButton: false,
        removeButton: false
    },
    {
        width: '15ch',

        grow: false,
        shrink: false
    }
)

const fileSelector = new layout.FileInput({
    text: 'Select PDF',

    filters: [{ name: 'PDF', extensions: ['pdf'] }],

    read: false
})

const fileNameDisplay = new layout.Text(
    {},
    {
        align: 'center',

        overflow: 'hidden'
    }
)
fileNameDisplay.node.style.wordBreak = 'keep-all'
fileNameDisplay.node.style.textOverflow = 'ellipsis'

const backgroundControl = new layout.ColorInput({
    label: 'Background'
})
const playControl = new layout.PlayStyleEdit(
    {},
    {
        align: 'stretch'
    }
)

const displayButton = new layout.Button({ text: 'Display' })

const okButton = new layout.Button({ text: 'OK' })
const applyButton = new layout.Button({ text: 'Apply' })
const cancelButton = new layout.Button({ text: 'Cancel' })

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
                                        childSpacing: 8
                                    },
                                    {
                                        padding: 0,
                                        direction: 'horizontal'
                                    }
                                )
                            ],

                            childSpacing: 8
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
                                new layout.Block(
                                    {
                                        items: [playControl, backgroundControl],
                                        childSpacing: 8
                                    },
                                    {
                                        direction: 'horizontal',
                                        wrap: true,

                                        grow: false,
                                        shrink: false,

                                        padding: 0,

                                        borderBottom: true,
                                        paddingBottom: 4,
                                        marginBottom: 4
                                    }
                                ),
                                new layout.Block(
                                    {
                                        items: [fileSelector, fileNameDisplay],
                                        childSpacing: 8
                                    },
                                    {
                                        direction: 'horizontal',
                                        grow: false,
                                        shrink: false,

                                        padding: 0
                                    }
                                ),
                                new layout.Block(
                                    {
                                        items: [displayPreview, pageList],
                                        childSpacing: 8
                                    },
                                    {
                                        direction: 'horizontal',

                                        padding: 0
                                    }
                                )
                            ],

                            childSpacing: 8
                        },
                        {
                            direction: 'vertical',
                            overflow: 'hidden'
                        }
                    )
                ],

                size: 70,

                //420x270 fits controls + 16:9 display with no wasted space
                minWidth: 420,
                minHeight: 270
            }),

            /* Display, OK, Apply, Cancel */
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
                            childSpacing: 8
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

let loadedFile = ''

function loadPDF() {
    if (loadedFile === editor.data.file) {
        return false
    }

    pageList.disabled = true

    loadedFile = editor.data.file

    pdfjs.getDocument('file://' + loadedFile).then(
        pdf => {
            pageList.clear()

            for (let i = 0; i < pdf.numPages; i++) {
                pageList.add('Page ' + (i + 1).toString())
            }

            pageList.select(0)

            pageList.disabled = false
        },
        error => {
            console.error(error)
        }
    )
}

function update() {
    displayPreview.edit({
        background: editor.data.background,

        nodes: [
            {
                type: 'pdf',
                file: editor.data.file,
                page: pageList.index + 1,

                top: 0,
                left: 0,
                right: 100,
                bottom: 100
            }
        ]
    })

    playControl.edit(editor.data)

    fileNameDisplay.text = editor.data.file

    loadPDF()
}

let onChange = event => {
    if (!event.fromUser) {
        return false
    }

    editor.change(
        editor.util.filterObj(event, { from: true, fromUser: true }, true)
    )

    update()
}

pageList.onEvent('select', event => {
    displayPreview.edit({
        nodes: [
            {
                type: 'pdf',
                page: pageList.index + 1
            }
        ]
    })
})

backgroundControl.onEvent('change', event => {
    onChange({
        background: event.value,

        fromUser: event.fromUser
    })
})
playControl.onEvent('change', onChange)

fileSelector.onEvent('open', event => {
    if (event.filename) {
        onChange({
            file: event.filename,

            fromUser: event.fromUser
        })
    }
})

editor.onEvent('output', data => {
    ipcRenderer.send('edit', data)

    layout.window.setDocument(editor.data.url)
    layout.window.setDocumentEdited(false)
})

editor.onEvent('history', () => {
    layout.menu.change('edit', 'undo', {
        enabled: editor.canUndo
    })
    layout.menu.change('edit', 'redo', {
        enabled: editor.canRedo
    })
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
        update()
    }

    layout.window.setDocumentEdited(editor.hasChanges)
})

displayButton.onEvent('click', () => {
    ipcRenderer.send(
        'display',
        {
            background: editor.data.background,

            nodes: [
                {
                    type: 'pdf',
                    file: editor.data.file,
                    page: pageList.index + 1,

                    top: 0,
                    left: 0,
                    right: 100,
                    bottom: 100
                }
            ]
        },
        process.pid
    )
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
                if (answer === 'Yes') {
                    editor.set(data)

                    backgroundControl.value = editor.data.background

                    update()
                }
            }
        )

        return false
    }

    gotData = true
    editor.set(data)

    backgroundControl.value = editor.data.background

    update()

    layout.window.setDocument(editor.data.url)
})

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
