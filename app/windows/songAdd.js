const layout = require('dw-layout')
const logger = require('dw-log')
const richText = require('dw-rich-text')
const editor = require('dw-editor')
const Database = require('dw-database')

const Songs = new Database.Group('songs', {
    load: true,
    parse: true
})

const fileSelect = new layout.FileInput({
    open: true,

    text: 'Select File',
    button: 'Select',

    filters: [
        {
            name: 'Text',
            extensions: ['txt']
        },
        {
            name: 'All Files',
            extensions: ['*']
        }
    ]
})

const groupBox = new layout.TextInput({
    label: 'Group',

    maxLength: 3,

    autoFocusNext: true
})

const nameBox = new layout.TextInput({
    label: 'Name',

    autoFocusNext: true
})
const authorBox = new layout.TextInput({
    label: 'Author',

    autoFocusNext: true
})
const copyrightBox = new layout.TextInput({
    label: 'Copyright'
})
const copyrightSymbolButton = new layout.Button({
    text: '©',
    size: 'small'
})

const addButton = new layout.Button({
    text: 'Add'
})

const sourceEditor = new layout.TextMultiLineInput({
    label: 'Source'
})
const updateButton = new layout.Button({
    text: 'Update',
    size: 'small'
})

const sectionsList = new layout.List({
    reorderable: false,
    removeButton: true,
    editButton: true,

    addInput: true
})
const playOrderList = new layout.List({
    reorderable: true,
    removeButton: true,
    editButton: false,

    addInput: []
})
const sectionText = new layout.Text({})
const sectionTime = new layout.NumberInput({
    tooltip: 'Time',
    unit: 's',
    label: 'Time',

    min: 0,
    max: 60 * 60 * 24,
    step: 1,
    precision: 1,

    popupMin: 0,
    popupMax: 60 * 2
})
const timeScale = 1000
const sectionEditor = new layout.RichTextInput(
    {
        font: 'Inter UI',
        size: 13,
        color: 'black',
        lineHeight: 1.5
    },
    {
        padding: 4
    }
)

const textStyleEditor = new layout.TextStyleEdit({
    font: false,
    size: false,
    color: false,
    lineHeight: false,
    align: false
})

textStyleEditor.connect(sectionEditor)

const sectionNames = ['verse', 'chorus', 'interlude', 'bridge', 'ending']
const defaultSectionName = 'Verse'

const blankLine = new RegExp(/\n\s*\n/gm)
const digits = new RegExp(/\d/g)
const notDigits = new RegExp(/\D/g)
const number = new RegExp(/^\d+$/)

let activeIndex = -1

{
    layout.change(layout.body, {
        direction: 'vertical'
    })

    layout.change(nameBox, {
        size: '25%',
        shrink: true,
        grow: true,
        minWidth: '13ch',
        maxWidth: '30ch'
    })
    layout.change(authorBox, {
        size: '25%',
        shrink: true,
        grow: true,
        minWidth: '13ch',
        maxWidth: '30ch'
    })
    layout.change(copyrightBox, {
        size: '25%',
        shrink: true,
        grow: true,
        minWidth: '13ch',
        maxWidth: '30ch'
    })
    layout.change(copyrightSymbolButton, {
        align: 'end'
    })

    layout.change(addButton, {
        align: 'end'
    })

    layout.change(sectionsList, {
        size: '50%',
        shrink: true,
        grow: true,

        minHeight: '6em'
    })
    layout.change(playOrderList, {
        size: '50%',
        shrink: true,
        grow: true,

        minHeight: '6em'
    })

    layout.change(sectionText, {
        align: 'center',
        textAlign: 'left',

        size: '100%',
        grow: true,
        shrink: true,

        overflow: 'ellipsis',
        wrap: 'nowrap'
    })

    layout.body.add(
        new layout.LayoutBlock({
            items: [
                /* Top section */
                new layout.LayoutBlock({
                    items: [
                        new layout.Block(
                            {
                                items: [
                                    /* File select + add button */
                                    new layout.Block(
                                        {
                                            items: [
                                                fileSelect,
                                                new layout.Filler(),
                                                addButton
                                            ],
                                            childSpacing: 8
                                        },
                                        {
                                            direction: 'horizontal',
                                            grow: false,
                                            shrink: false,

                                            padding: 0
                                        }
                                    ),
                                    /* Info */
                                    new layout.Block(
                                        {
                                            items: [
                                                groupBox,
                                                nameBox,
                                                authorBox,
                                                copyrightBox,
                                                copyrightSymbolButton
                                            ],

                                            childSpacing: 8
                                        },
                                        {
                                            direction: 'horizontal',
                                            grow: false,
                                            shrink: false,

                                            padding: 0,
                                            wrap: true
                                        }
                                    )
                                ]
                            },
                            {
                                direction: 'vertical',
                                padding: 4
                            }
                        )
                    ],

                    small: true,

                    minWidth: 560,
                    minHeight: 92,
                    maxHeight: 92,
                    size: 10
                }),
                /* Middle section */
                new layout.LayoutBlock({
                    items: [
                        /* Source */
                        new layout.LayoutBlock({
                            items: [
                                new layout.Block(
                                    {
                                        items: [
                                            new layout.Block(
                                                {
                                                    items: [
                                                        new layout.Text(
                                                            {
                                                                text: 'Source'
                                                            },
                                                            {
                                                                padding: 0,
                                                                paddingLeft: 4,
                                                                paddingRight: 4
                                                            }
                                                        ),
                                                        new layout.Filler(),
                                                        updateButton
                                                    ]
                                                },
                                                {
                                                    direction: 'horizontal',
                                                    shrink: false,
                                                    grow: false,
                                                    padding: 4,
                                                    paddingBottom: '0'
                                                }
                                            ),
                                            sourceEditor
                                        ],
                                        childSpacing: 8
                                    },
                                    {
                                        direction: 'vertical'
                                    }
                                )
                            ],

                            small: true,
                            minWidth: 250,
                            minHeight: 150,
                            size: 40
                        }),
                        /* Sections + PlayOrder */
                        new layout.LayoutBlock({
                            items: [
                                new layout.Block(
                                    {
                                        items: [
                                            new layout.Text(
                                                { text: 'Sections' },
                                                {
                                                    padding: 0,
                                                    paddingLeft: 4,
                                                    paddingRight: 4
                                                }
                                            ),
                                            sectionsList,
                                            new layout.Text(
                                                { text: 'Play Order' },
                                                {
                                                    padding: 0,
                                                    paddingLeft: 4,
                                                    paddingRight: 4
                                                }
                                            ),
                                            playOrderList
                                        ],
                                        childSpacing: 8
                                    },
                                    {
                                        direction: 'vertical'
                                    }
                                )
                            ],

                            small: true,
                            minWidth: 200,
                            minHeight: 250,
                            size: 20
                        }),
                        /* Section Editor */
                        new layout.LayoutBlock({
                            items: [
                                new layout.Block(
                                    {
                                        items: [
                                            new layout.Block(
                                                {
                                                    items: [
                                                        sectionText,
                                                        sectionTime,
                                                        textStyleEditor
                                                    ],
                                                    childSpacing: 8
                                                },
                                                {
                                                    direction: 'horizontal',
                                                    grow: false,
                                                    shrink: false,
                                                    wrap: true,

                                                    padding: 0
                                                }
                                            ),
                                            sectionEditor
                                        ],
                                        childSpacing: 8
                                    },
                                    {
                                        direction: 'vertical'
                                    }
                                )
                            ],
                            small: true,
                            minWidth: 250,
                            minHeight: 150,
                            size: 40
                        })
                    ],

                    small: true,
                    direction: 'horizontal',
                    size: 90
                })
            ],

            small: true,
            direction: 'vertical'
        })
    )

    sectionTime.node.firstChild.style.marginBottom = '4px'
}

function getSafeName(name, data = editor.data) {
    let counter = parseFloat(name.replace(notDigits, ''))

    if (counter < 1 || !isFinite(counter)) {
        counter = 1
    }

    name = name.replace(digits, '').trim()

    while (
        data.sections.some(
            section => section.name === name + ' ' + counter.toString()
        )
    ) {
        counter += 1
    }

    return name + ' ' + counter.toString()
}

function addSection(data, string) {
    if (typeof string !== 'string') {
        return false
    }

    let name = ''

    let firstLine = string.split('\n')[0]
    let lower = firstLine.toLowerCase()

    for (let i = 0; i < sectionNames.length; i++) {
        if (lower.startsWith(sectionNames[i])) {
            name = firstLine.slice(0, sectionNames[i].length)
        }
    }

    if (name) {
        //Remove the name, and anything after a ':' character
        firstLine = firstLine.slice(name.length, firstLine.length)

        let numberPart = firstLine.split(':')[0].trim()

        if (numberPart === '' || number.test(numberPart)) {
            name = getSafeName(name + ' ' + numberPart, data)

            let index = 0

            if (firstLine.includes(':')) {
                index = string.indexOf(':') + 1
            } else {
                index = string.indexOf('\n')
            }

            string = string.slice(index, string.length)
        } else {
            name = getSafeName(defaultSectionName, data)
        }
    } else {
        name = getSafeName(defaultSectionName, data)
    }

    string = string.trim()

    data.sections.push({
        name: name,

        text: richText.format(string),
        plainText: string,

        playTime: 0
    })

    return name
}

function extractSections(string) {
    if (typeof string !== 'string') {
        return false
    }

    let parts = string.split(blankLine).map(part => part.trim())

    let lastPlayOrder = editor.util.copyObj(editor.data.playOrder)

    let data = {
        sections: [],
        playOrder: []
    }

    let choruses = []

    for (let i = 0; i < parts.length; i++) {
        if (parts[i].length > 0) {
            let name = addSection(data, parts[i])

            if (name) {
                data.playOrder.push(name)

                if (name.toLowerCase().startsWith('chorus')) {
                    choruses.push(name)
                }
            }
        }
    }

    if (
        lastPlayOrder.every(name => {
            return data.sections.some(section => section.name === name)
        }) &&
        lastPlayOrder.length > 0
    ) {
        data.playOrder = lastPlayOrder
    } else {
        if (choruses.length === 1) {
            let index = data.playOrder.indexOf(choruses[0])

            for (let i = index + 2; i <= data.playOrder.length; i += 2) {
                data.playOrder.splice(i, 0, choruses[0])
            }
        }
    }

    data.sections.sort((a, b) => a.name.localeCompare(b.name))

    return data
}

function updateLists() {
    let lastSelected = sectionsList.selected

    sectionsList.clear()
    playOrderList.clear()

    editor.data.sections.forEach(section => sectionsList.add(section.name))
    editor.data.playOrder.forEach(name => playOrderList.add(name))

    playOrderList.addInput = editor.data.sections.map(section => section.name)

    if (editor.data.sections.length === 0) {
        setSectionEditorDisabled(true)
    }

    if (sectionsList.indexOf(lastSelected) !== -1) {
        sectionsList.select(lastSelected, false, true)
    } else {
        sectionsList.select(0, false, true)
    }
}

function updateAll() {
    groupBox.value = editor.data.group

    nameBox.value = editor.data.name
    authorBox.value = editor.data.author
    copyrightBox.value = editor.data.copyright

    sectionText.value = ''
    sectionTime.value = 0
    sectionEditor.text = ''

    updateLists()
}

function saveSong(data) {
    if (Songs.updating === true) {
        layout.showLoader(layout.body, 'Saving')

        Songs.onceEvent('update', () => {
            layout.hideLoader(layout.body)

            saveSong(data)
        })
    } else {
        if (data.group.trim() === '') {
            data.group = 'S'
        }

        data.groupID = Songs.getUniqueID(data.group)

        Songs.save(data.group, data.groupID, data, error => {
            if (error) {
                layout.dialog.showNotification({
                    type: 'error',
                    message:
                        'Unable to save song!\n' + error.message ||
                        error.toString()
                })

                logger.error(
                    'Error adding song ' +
                        data.group +
                        '-' +
                        data.groupID.toString() +
                        ':',
                    error
                )

                return false
            }

            layout.dialog.showNotification({
                type: 'success',
                message:
                    'Song added with ID ' +
                    data.group +
                    '-' +
                    data.groupID.toString()
            })

            editor.set({
                group: '',

                name: '',
                author: '',
                copyright: '',

                sections: [],
                playOrder: []
            })

            updateAll()
        })
    }
}

function setSectionEditorDisabled(disabled) {
    sectionTime.disabled = disabled
    sectionEditor.disabled = disabled

    playOrderList.disabled = disabled
}

copyrightSymbolButton.onEvent('click', () => {
    let copyrightString = copyrightBox.value

    if (copyrightString === '') {
        copyrightString = '© '
    } else if (copyrightString[0] !== ' ') {
        copyrightString = '© ' + copyrightString
    } else {
        copyrightString = '©' + copyrightString
    }

    copyrightBox.value = copyrightString

    editor.change('copyright', copyrightString)
})

fileSelect.onEvent('open', event => {
    let lines = event.content.split('\n')
    let content = ''

    let newData = {
        group: '',
        name: '',
        author: '',
        copyright: '',
        sections: [],
        playOrder: []
    }

    for (let i = 0; i < lines.length; i++) {
        let lower = lines[i].toLowerCase()
        if (lower.startsWith('name:')) {
            newData['name'] = lines[i].slice(5).trim()
        } else if (lower.startsWith('title:')) {
            newData['name'] = lines[i].slice(6).trim()
        } else if (lower.startsWith('author:')) {
            newData['author'] = lines[i].slice(7).trim()
        } else if (lower.startsWith('copyright:')) {
            newData['copyright'] = lines[i].slice(10).trim()
        } else {
            content += lines[i] + '\n'
        }
    }

    sourceEditor.value = content

    editor.util.applyObj(newData, extractSections(content))

    editor.set(newData)

    updateAll()
})

//Sections selecting/reordering/deleting/adding
{
    sectionsList.onEvent('select', event => {
        activeIndex = editor.data.sections.findIndex(
            section => section.name === event.text
        )

        if (activeIndex === -1) {
            setSectionEditorDisabled(true)

            return false
        }

        setSectionEditorDisabled(false)

        sectionText.text = editor.data.sections[activeIndex].name || ''

        sectionEditor.text = editor.data.sections[activeIndex].text
        sectionTime.value =
            editor.data.sections[activeIndex].playTime / timeScale

        if (event.fromUser) {
            playOrderList.select(editor.data.sections[activeIndex].name)
        }
    })
    sectionsList.onEvent('add', event => {
        if (!event.fromUser) {
            return false
        }

        let name = getSafeName(event.text)

        let newSections = editor.util.copyObj(editor.data.sections)
        newSections.push({
            name: name,
            text: '',
            plainText: '',

            playTime: 0
        })

        newSections.sort((a, b) => a.name.localeCompare(b.name))

        editor.change('sections', newSections)

        sectionsList.change(event.text, name)
        sectionsList.select(name)

        updateLists()
    })
    sectionsList.onEvent('remove', event => {
        if (!event.fromUser) {
            return false
        }

        editor.change({
            sections: editor.data.sections.filter(
                section => section.name !== event.text
            ),
            playOrder: editor.data.playOrder.filter(name => name !== event.text)
        })

        if (event.index === activeIndex) {
            sectionTime.value = 0
            sectionEditor.text = ''
        }

        updateLists()
    })
    sectionsList.onEvent('change', event => {
        let index = editor.data.sections.findIndex((section, index) => {
            if (index === event.index) {
                return false
            }

            return section.name === event.text
        })

        if (index === -1) {
            sectionsList.setHighlight(event.index, '')
        } else {
            sectionsList.setHighlight(event.index, 'error')
        }
    })
    sectionsList.onEvent('enter', event => {
        let notUnique = editor.data.sections.find((section, index) => {
            if (index === event.index) {
                return false
            }

            return section.name === event.text
        })

        let newName = event.text

        if (notUnique) {
            newName = getSafeName(newName)
        }

        let change = {
            sections: [],

            playOrder: editor.data.playOrder.map(name => {
                if (name === editor.data.sections[event.index].name) {
                    return newName
                }

                return name
            })
        }

        for (let i = 0; i < editor.data.sections.length; i++) {
            change.sections.push({})
        }

        change.sections[event.index].name = newName

        editor.change(change)

        updateLists()
    })

    playOrderList.onEvent('select', event => {
        if (event.fromUser) {
            sectionsList.select(event.text)
        }
    })
    function updatePlayOrder(event) {
        if (!event.fromUser) {
            return false
        }

        editor.change('playOrder', playOrderList.asArray())
    }
    playOrderList.onEvent('remove', updatePlayOrder)
    playOrderList.onEvent('add', updatePlayOrder)
    playOrderList.onEvent('reorder', updatePlayOrder)
}

//Content changes
{
    sectionEditor.onEvent('change', event => {
        if (!event.fromUser) {
            return false
        }

        if (activeIndex < 0 && activeIndex >= editor.data.sections.length) {
            return false
        }

        let changedSections = []

        changedSections.length = editor.data.sections.length
        changedSections[activeIndex] = editor.util.filterObj(
            event,
            {
                from: true,
                fromUser: true
            },
            true
        )

        editor.change('sections', changedSections)
    })

    sectionTime.onEvent('change', event => {
        if (!event.fromUser) {
            return false
        }

        if (activeIndex < 0 && activeIndex >= editor.data.sections.length) {
            return false
        }
        let changedSections = []

        changedSections.length = editor.data.sections.length
        changedSections[activeIndex] = {
            playTime: event.value * timeScale
        }

        editor.change('sections', changedSections)
    })

    nameBox.onEvent('change', event => {
        if (!event.fromUser) {
            return false
        }

        editor.change('name', event.value)
    })

    authorBox.onEvent('change', event => {
        if (!event.fromUser) {
            return false
        }

        editor.change('author', event.value)
    })

    copyrightBox.onEvent('change', event => {
        if (!event.fromUser) {
            return false
        }

        editor.change('copyright', event.value)
    })

    groupBox.onEvent('change', event => {
        if (!event.fromUser) {
            return false
        }

        editor.change('group', event.value)
    })
}

editor.onEvent('history', () => {
    layout.menu.change('edit', 'undo', {
        enabled: editor.canUndo
    })
    layout.menu.change('edit', 'redo', {
        enabled: editor.canRedo
    })
})

layout.menu.onEvent('edit', item => {
    if (item === 'undo') {
        editor.undo()
    } else if (item === 'redo') {
        editor.redo()
    }
})

editor.onEvent('change', from => {
    if (from === 'undo' || from === 'redo') {
        updateAll()
    }
})

addButton.onEvent('click', () => {
    let song = {
        group: editor.data.group,

        name: editor.data.name,
        author: editor.data.author,
        copyright: editor.data.copyright,

        sections: {},
        playOrder: editor.data.playOrder
    }

    for (let i = 0; i < editor.data.sections.length; i++) {
        song.sections[editor.data.sections[i].name] = {
            text: editor.data.sections[i].text,
            plainText: editor.data.sections[i].plainText,
            playTime: editor.data.sections[i].playTime
        }
    }

    saveSong(song)

    editor.set({
        group: '',
        name: '',
        author: '',
        copyright: '',
        sections: [],
        playOrder: []
    })

    updateAll()
})

updateButton.onEvent('click', () => {
    editor.change(extractSections(sourceEditor.value))

    updateLists()
})

layout.window.onEvent('close', event => {
    if (editor.hasChanges) {
        event.confirm(
            'You have entered song information without adding it to the library. All information entered will be lost! Are you sure you want to close?'
        )
    }
})

editor.set({
    group: '',
    name: '',
    author: '',
    copyright: '',
    sections: [],
    playOrder: []
})

setSectionEditorDisabled(true)

Songs.onEvent('error', error => {
    layout.dialog.showNotification({
        type: 'error',
        autoHide: false,

        message: 'There is an error with the Song database!\n' + error.message
    })
})
