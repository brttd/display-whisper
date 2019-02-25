const { ipcRenderer } = require('electron')

const layout = require('dw-layout')
const richText = require('dw-rich-text')
const logger = require('dw-log')
const Database = require('dw-database')
const editor = require('dw-editor')

const punctuationCharacters = new RegExp(/[\(\)\-\[\]!"&'+,.:;?_`]/g)

const Songs = new Database.Group('songs', {
    load: true,
    parse: true,

    transform: data => {
        if (typeof data.name !== 'string') {
            data.name = ''
        }
        if (typeof data.author !== 'string') {
            data.author = ''
        }
        if (typeof data.copyright !== 'string') {
            data.copyright = ''
        }

        data._nameLower = data.name
            .toLowerCase()
            .replace(punctuationCharacters, '')
        data._authorLower = data.author
            .toLowerCase()
            .replace(punctuationCharacters, '')
        data._copyrightLower = data.copyright
            .toLowerCase()
            .replace(punctuationCharacters, '')

        data._contentLower = ''
        for (let section in data.sections) {
            if (typeof data.sections[section].plainText !== 'string') {
                data.sections[section].plainText =
                    richText.removeFormat(data.sections[section].text) || ''
            }

            data._contentLower +=
                data.sections[section].plainText.toLowerCase() + '\n'
        }

        data._contentLower = data._contentLower.replace(
            punctuationCharacters,
            ''
        )

        data._allLower = [
            data._nameLower,
            data._authorLower,
            data._copyrightLower,
            data._contentLower
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

//Song search + add
const searchBox = new layout.TextInput({
    placeholder: 'Search'
})
const resultsBox = new layout.TableList({
    drag: true,

    columns: 4,
    columnWidths: ['50%', '50%', '3ch', '5ch']
})

//(print) Item list + add text button
const itemList = new layout.List({
    editButton: false,
    removeButton: true,
    reorderable: true
})

const addTextButton = new layout.Button({
    text: 'Add Text'
})

//Editing controls for songs
const songOptionsBlock = new layout.Block(
    {
        childSpacing: 8
    },
    {
        direction: 'vertical'
    }
)

const songSectionList = new layout.List(
    {
        editButton: false,
        removeButton: true,
        reorderable: true,

        addInput: []
    },
    {
        grow: true,
        shrink: true
    }
)
const songType = new layout.SelectInput(
    {
        options: ['Header', 'Paragraph', 'Text']
    },
    {
        width: '5em'
    }
)
const songStyleEditor = new layout.TextStyleEdit({
    font: false,
    size: false,
    color: false,
    lineHeight: false
})
const songTextEditor = new layout.RichTextInput(
    {
        font: 'Inter UI',
        size: 13,
        color: 'black',
        lineHeight: 1.5
    },
    {
        grow: true,
        shrink: true
    }
)
songStyleEditor.connect(songTextEditor)
const songResetButton = new layout.Button({
    text: 'Reset'
})
const songResetAllButton = new layout.Button({
    text: 'Reset All'
})

//Editing controls for text
const textOptionsBlock = new layout.Block(
    {
        childSpacing: 8
    },
    {
        direction: 'vertical'
    }
)

const textStyling = new layout.TextStyleEdit({
    font: false,
    size: false,
    color: false,
    lineHeight: false
})
const textType = new layout.SelectInput(
    {
        options: ['Header', 'Paragraph', 'Text'],

        focus: false
    },
    {
        width: '5em'
    }
)
const textEditor = new layout.RichTextInput({
    font: 'Inter UI',
    size: 13,
    color: 'black',
    lineHeight: 1.5
})
textStyling.connect(textEditor)

//Controls for print settings
const fontInput = new layout.FontInput({
    label: 'Font'
})
const sizeInput = new layout.NumberInput({
    label: 'Size',
    unit: 'pt',

    value: 12,
    min: 0,
    max: 999,
    step: 1,
    precision: 2,

    popupMax: 60
})

const landscapeWarning = new layout.Text({
    text:
        'Currently printing directly in landscape does not work! Use the "Save As PDF" option and print the saved PDF file instead.'
})

const preview = new layout.PrintPreview({})

const testButton = new layout.Button({
    text: 'Test'
})

const printButton = new layout.Button({
    text: 'Print'
})

const pdfButton = new layout.Button({
    text: 'Save As PDF'
})

{
    layout.change(searchBox, {
        align: 'stretch'
    })
    layout.change(resultsBox, {
        align: 'stretch'
    })
    layout.change(preview, {
        grow: true,
        shrink: true,

        size: '100%',

        align: 'stretch'
    })

    layout.change(addTextButton, {
        align: 'end'
    })
    songOptionsBlock.add(songSectionList)
    songOptionsBlock.add(
        new layout.Block(
            {
                childSpacing: 8,

                items: [
                    new layout.Block(
                        {
                            items: [
                                new layout.Text(
                                    { text: 'Type' },
                                    {
                                        marginBottom: 4
                                    }
                                ),
                                songType
                            ]
                        },
                        {
                            direction: 'vertical',
                            grow: false,
                            shrink: false,

                            margin: 4
                        }
                    ),
                    songStyleEditor
                ]
            },
            {
                direction: 'horizontal',

                grow: false,
                shrink: false,

                padding: 0
            }
        )
    )
    songOptionsBlock.add(songTextEditor)
    songOptionsBlock.add(
        new layout.Block(
            {
                childSpacing: 8,
                items: [songResetButton, songResetAllButton]
            },
            {
                direction: 'horizontal',
                align: 'end',

                padding: 0,

                grow: false,
                shrink: false
            }
        )
    )

    layout.change(songStyleEditor, {
        marginLeft: 0
    })

    layout.change(textType, {
        width: '5em'
    })

    layout.change(textStyling, {
        margin: 4
    })

    layout.change(textEditor, {
        padding: 2,
        paddingLeft: 4,
        paddingRight: 4
    })

    textOptionsBlock.add(
        new layout.Block(
            {
                items: [
                    new layout.Block(
                        {
                            items: [
                                new layout.Text(
                                    {
                                        text: 'Type'
                                    },
                                    {
                                        marginBottom: 4
                                    }
                                ),
                                textType
                            ]
                        },
                        {
                            direction: 'vertical',
                            grow: false,
                            shrink: false,

                            margin: 4,
                            marginRight: 0
                        }
                    ),
                    textStyling
                ]
            },
            {
                direction: 'horizontal',
                grow: false,
                shrink: false
            }
        )
    )
    textOptionsBlock.add(textEditor)

    layout.change(landscapeWarning, {
        grow: false,
        shrink: false,

        margin: 4,
        padding: 2,
        paddingLeft: 6,
        paddingRight: 6,

        background: 'hsl(0, 60%, 75%)'
    })

    songOptionsBlock.visible = false
    textOptionsBlock.visible = false

    landscapeWarning.visible = false

    layout.body.add(
        new layout.LayoutBlock({
            items: [
                new layout.LayoutBlock({
                    items: [
                        new layout.Block(
                            {
                                items: [searchBox, resultsBox],
                                childSpacing: 8
                            },
                            {
                                direction: 'vertical'
                            }
                        )
                    ],

                    minWidth: 80,
                    maxWidth: 300,
                    minHeight: 100,

                    size: 30
                }),
                new layout.LayoutBlock({
                    items: [
                        new layout.LayoutBlock({
                            items: [
                                new layout.LayoutBlock({
                                    items: [
                                        new layout.Block(
                                            {
                                                items: [
                                                    itemList,
                                                    addTextButton
                                                ],
                                                childSpacing: 8
                                            },
                                            {
                                                direction: 'vertical'
                                            }
                                        )
                                    ],
                                    minWidth: 100,
                                    minHeight: 100,

                                    size: 30
                                }),
                                new layout.LayoutBlock({
                                    items: [
                                        new layout.Block(
                                            {
                                                items: [
                                                    songOptionsBlock,
                                                    textOptionsBlock
                                                ]
                                            },
                                            {
                                                direction: 'vertical'
                                            }
                                        )
                                    ],

                                    minWidth: 319,
                                    minHeight: 200,

                                    size: 70
                                })
                            ],
                            minWidth: 200,
                            size: 40,
                            small: true
                        }),
                        new layout.LayoutBlock({
                            items: [
                                new layout.Block(
                                    {
                                        items: [
                                            new layout.Block(
                                                {
                                                    items: [
                                                        new layout.Block(
                                                            {
                                                                items: [
                                                                    fontInput,
                                                                    sizeInput
                                                                ],
                                                                childSpacing: 8
                                                            },
                                                            {
                                                                direction:
                                                                    'horizontal',
                                                                grow: false,
                                                                shrink: false,

                                                                padding: 0
                                                            }
                                                        )
                                                    ]
                                                },
                                                {
                                                    direction: 'horizontal',
                                                    wrap: true,

                                                    grow: false,
                                                    shrink: false
                                                }
                                            ),
                                            preview,
                                            landscapeWarning,
                                            new layout.Block(
                                                {
                                                    items: [
                                                        printButton,
                                                        pdfButton
                                                    ],
                                                    childSpacing: 8
                                                },
                                                {
                                                    direction: 'horizontal',
                                                    grow: false,
                                                    shrink: false,
                                                    align: 'end',

                                                    padding: 0
                                                }
                                            )
                                        ],
                                        childSpacing: 8
                                    },
                                    {
                                        direction: 'vertical'
                                    }
                                )
                            ],

                            minWidth: 228,
                            size: 60
                        })
                    ],
                    minWidth: 200,
                    minHeight: 200,
                    size: 70,

                    direction: 'horizontal',
                    small: true
                })
            ],

            small: true,
            direction: 'horizontal'
        })
    )
}

const searchFilters = {
    all: function(item) {
        return item._allLower.includes(this)
    }
}

const options = {
    boldName: true,
    italicizeAuthor: true,
    italicizeChorus: true
}

let activeIndex = -1

editor.set({
    items: [],

    font: '',
    fontSize: sizeInput.value,

    margin: preview.margin,
    columns: preview.columns,

    orientation: 'portrait'
})

/*
Item format:

//text item
{
    type: 'text',

    data: {
        type: 'Text' | 'Heading' | 'Paragraph',

        align: ...,

        text: '...',
        plainText: '...'
    }
}

//song item
{
    type: 'song,

    song: {...},

    sections: [
        {
            type: 'Text' | 'Heading' | 'Paragraph',

            data: '...'?,
            section: '...'?,

            text: '...',
            plainText: '...',

            align: '...',
        },
        ...
    ]
}
*/

//If the currently selected item is of the given type, returns true
function isActive(type) {
    if (activeIndex < 0 || activeIndex >= editor.data.items.length) {
        return false
    }

    return editor.data.items[activeIndex].type === type
}

//Updates the search results list
function updateSearch() {
    resultsBox.clear()

    let searchTerm = searchBox.value
        .toLowerCase()
        .replace(punctuationCharacters, '')
        .trim()

    if (searchTerm.length === 0) {
        return false
    }

    let results = Songs.list.filter(searchFilters.all, searchTerm)

    for (let i = 0; i < results.length; i++) {
        resultsBox.add([
            results[i].name,
            results[i].author,
            results[i].group,
            results[i].groupID
        ])
    }
}

//Changes song item to default layout
function resetSong(item) {
    item.sections = [
        {
            type: 'Header',

            data: 'name',

            text:
                (options.boldName ? '<b>' : '') +
                richText.format(item.song.name),
            plainText: item.song.name,

            align: 'center'
        },
        {
            type: 'Text',

            data: 'author',

            text:
                (options.italicizeAuthor ? '<i>' : '') +
                richText.format(item.song.author),
            plainText: item.song.author,

            align: 'center'
        }
    ]

    for (let i = 0; i < item.song.playOrder.length; i++) {
        item.sections.push({
            type: 'Paragraph',

            section: item.song.playOrder[i],

            text:
                (options.italicizeChorus &&
                item.song.playOrder[i].toLowerCase().startsWith('chorus')
                    ? '<i>'
                    : '') +
                item.song.sections[item.song.playOrder[i]].text.trim(),
            plainText: item.song.sections[
                item.song.playOrder[i]
            ].plainText.trim(),

            align: 'center'
        })
    }

    item.sections.push(
        {
            type: 'Text',

            data: 'author',

            text:
                (options.italicizeAuthor ? '<i>' : '') +
                richText.format(item.song.author),
            plainText: item.song.author,

            align: 'center'
        },
        {
            type: 'Text',

            data: 'copyright',

            text: richText.format(item.song.copyright),
            plainText: item.song.copyright,

            align: 'center'
        }
    )

    return item
}

//Selects the item at given index, and updates editing controls
function selectItem(index) {
    if (index < 0 || index >= editor.data.items.length) {
        return false
    }

    activeIndex = index
    itemList.select(index)

    let item = editor.data.items[activeIndex]

    if (item.type === 'song') {
        textOptionsBlock.visible = false
        songOptionsBlock.visible = true

        songSectionList.clear()

        for (let i = 0; i < item.sections.length; i++) {
            if (item.sections[i].data) {
                songSectionList.add('Song ' + item.sections[i].data)
            } else if (item.sections[i].section) {
                songSectionList.add(item.sections[i].section)
            } else {
                songSectionList.add('Error: Invalid section!')
            }
        }

        songSectionList.addInput = [
            'Song name',
            'Song author',
            'Song copyright'
        ].concat(Object.keys(item.song.sections))

        songSectionList.select(0, false, true)
    } else if (item.type === 'text') {
        songOptionsBlock.visible = false
        textOptionsBlock.visible = true

        textEditor.set(item.data)

        textType.value = item.data.type
    } else {
        layout.dialog.showNotification({
            type: 'warning',

            message:
                'There is a problem with the item you have selected!\nPlease remove it, or reload the window!'
        })

        logger.error('Invalid item was selected in print', item)

        songOptionsBlock.visible = false
        textOptionsBlock.visible = false
    }
}

let lastRequestTime = 0
let minCoolTime = 250

function doUpdate() {
    preview.clear()

    preview.font = editor.data.font
    preview.fontSize = editor.data.fontSize
    preview.margin = editor.data.margin
    preview.columns = editor.data.columns

    for (let i = 0; i < editor.data.items.length; i++) {
        let item = editor.data.items[i]
        if (item.type === 'text') {
            preview.addText({
                type: item.data.type,

                align: item.data.align,

                text: item.data.text,
                plainText: item.data.plainText
            })
        } else if (item.type === 'song') {
            for (let j = 0; j < item.sections.length; j++) {
                preview.addText({
                    type: item.sections[j].type,

                    text: item.sections[j].text,
                    plainText: item.sections[j].plainText,

                    align: item.sections[j].align
                })
            }
        }
    }
}
//Updates the print preview
function updatePreview() {
    lastRequestTime = Date.now()

    setTimeout(() => {
        if (Date.now() - lastRequestTime >= minCoolTime) {
            doUpdate()
        }
    }, minCoolTime + 2)
}

//Adds a new item to the list, updating itemList control aswell
function addItem(item, index = -1) {
    if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
        let newItems = editor.util.copyObj(editor.data.items)

        newItems.length = editor.data.items.length

        if (index >= 0 && index < editor.data.items.length) {
            newItems.splice(index, 0, item)
            editor.change('items', newItems)

            if (item.type === 'song') {
                itemList.add('Song - ' + item.song.name, index)
            } else if (item.type === 'text') {
                itemList.add('Text', index)
            } else {
                itemList.add('Error: Invalid item!', index)

                logger.error('An invalid item was added', item)
            }

            selectItem(index)
        } else {
            newItems.push(item)
            editor.change('items', newItems)

            if (item.type === 'song') {
                itemList.add('Song - ' + item.song.name)
            } else if (item.type === 'text') {
                itemList.add('Text')
            } else {
                itemList.add('Error: Invalid item!')

                logger.error('An invalid item was added', item)
            }

            selectItem(newItems.length - 1)
        }

        updatePreview()
    }
}

function changeItem(index, change) {
    if (index < 0 || index > editor.data.items.length) {
        return false
    }

    let changes = []
    changes.length = editor.data.items.length

    changes[index] = change

    editor.change('items', changes)

    updatePreview()
}

function changeSongSection(index, sectionIndex, change) {
    if (index < 0 || index >= editor.data.items.length) {
        return false
    }
    if (editor.data.items[index].type !== 'song') {
        return false
    }

    if (
        sectionIndex < 0 ||
        sectionIndex >= editor.data.items[index].sections.length
    ) {
        return false
    }

    let sectionChanges = []
    sectionChanges.length = editor.data.items[index].sections.length

    sectionChanges[sectionIndex] = change

    changeItem(index, { sections: sectionChanges })
}

function updatePrintSettings() {
    preview.font = fontInput.value = editor.data.font
    preview.fontSize = sizeInput.value = editor.data.fontSize

    preview.margin = editor.data.margin
    preview.columns = editor.data.columns
}

//Song/text add
{
    searchBox.onEvent('change', () => {
        updateSearch()
    })

    let lastDragged = false
    resultsBox.onEvent('drag', event => {
        let song = Songs.get(event.text[2], parseFloat(event.text[3]))

        if (song) {
            lastDragged = song

            itemList.drop()
        }
    })

    addTextButton.onEvent('click', () => {
        addItem({
            type: 'text',
            data: {
                type: 'Text',
                align: 'left',
                text: '',
                plainText: ''
            }
        })
    })
    addTextButton.onEvent('drag', () => {
        lastDragged = 'text'
        itemList.drop()
    })

    itemList.onEvent('drop', event => {
        if (lastDragged === 'text') {
            addItem(
                {
                    type: 'text',

                    data: {
                        type: 'Text',

                        align: 'left',

                        text: '',
                        plainText: ''
                    }
                },
                event.index
            )
        } else if (lastDragged) {
            //If it's not text, but lastDragged !== false, then it's a song
            addItem(
                resetSong({
                    type: 'song',
                    song: lastDragged,
                    sections: []
                }),
                event.index
            )
        }

        lastDragged = false
    })
}

//item list changes
{
    itemList.onEvent('select', event => {
        if (!event.fromUser) {
            return false
        }

        selectItem(event.index)
    })

    itemList.onEvent('remove', event => {
        if (event.index === activeIndex) {
            textOptionsBlock.visible = false
            songOptionsBlock.visible = false
        }

        if (event.index >= 0 && event.index < editor.data.items.length) {
            let newItems = editor.util.copyObj(editor.data.items)
            newItems.splice(event.index, 1)

            editor.change('items', newItems)

            if (event.index <= activeIndex) {
                selectItem(Math.max(0, event.index - 1))
            }
        }

        updatePreview()
    })
    itemList.onEvent('reorder', event => {
        if (
            event.index >= 0 &&
            event.index <= editor.data.items.length &&
            event.oldIndex >= 0 &&
            event.oldIndex <= editor.data.items.length
        ) {
            let newItems = editor.util.copyObj(editor.data.items)

            let item = newItems[event.oldIndex]

            newItems.splice(event.index, 0, item)

            if (event.index <= event.oldIndex) {
                newItems.splice(event.oldIndex + 1, 1)
            } else {
                newItems.splice(event.oldIndex, 1)
            }

            editor.change('items', newItems)

            if (event.index < activeIndex) {
                selectItem(activeIndex)
            } else {
                selectItem(activeIndex)
            }
        }

        updatePreview()
    })
}

//song changes
{
    songSectionList.onEvent('select', event => {
        if (
            !isActive('song') ||
            event.index < 0 ||
            event.index >= editor.data.items[activeIndex].sections.length
        ) {
            return false
        }

        let item = editor.data.items[activeIndex]

        songType.value = item.sections[event.index].type

        songTextEditor.set(item.sections[event.index])

        songTextEditor.focus()
    })

    songSectionList.onEvent('add', event => {
        if (!event.fromUser || !isActive('song')) {
            return false
        }

        let item = editor.data.items[activeIndex]

        let newSections = editor.util.copyObj(item.sections)

        if (item.song.sections.hasOwnProperty(event.text)) {
            newSections.splice(event.index, 0, {
                type: 'Paragraph',
                section: event.text,

                text:
                    (options.italicizeChorus &&
                    event.text.toLowerCase().startsWith('chorus')
                        ? '<i>'
                        : '') + item.song.sections[event.text].text.trim(),
                plainText: item.song.sections[event.text].plainText.trim(),

                align: 'center'
            })
        } else {
            let type = 'Text'
            let data = 'name'

            switch (event.text.toLowerCase()) {
                case 'song name':
                    type = 'Header'
                    break
                case 'song author':
                    data = 'author'
                    break
                case 'song copyright':
                    data = 'copyright'
                    break
            }

            newSections.splice(event.index, 0, {
                type: type,

                data: data,

                text:
                    (data === 'name' && options.boldName
                        ? '<b>'
                        : data === 'author' && options.italicizeAuthor
                        ? '<i>'
                        : '') + item.song[data],
                plainText: item.song[data],

                align: 'center'
            })
        }

        changeItem(activeIndex, {
            sections: newSections
        })
    })
    songSectionList.onEvent('reorder', event => {
        if (
            event.fromUser &&
            event.index >= 0 &&
            event.index < editor.data.items[activeIndex].sections.length &&
            event.oldIndex >= 0 &&
            event.oldIndex <= editor.data.items[activeIndex].sections.length
        ) {
            let newSections = editor.util.copyObj(
                editor.data.items[activeIndex].sections
            )

            let part = newSections[event.oldIndex]

            newSections.splice(event.index, 0, part)

            if (event.index <= event.oldIndex) {
                newSections.splice(event.oldIndex + 1, 1)
            } else {
                newSections.splice(event.oldIndex, 1)
            }

            changeItem(activeIndex, { sections: newSections })

            songSectionList.select(0)
        }
    })
    songSectionList.onEvent('remove', event => {
        if (!event.fromUser || !isActive('song')) {
            return false
        }

        if (
            event.index >= 0 &&
            event.index < editor.data.items[activeIndex].sections.length
        ) {
            let newSections = editor.util.copyObj(
                editor.data.items[activeIndex].sections
            )

            newSections.splice(event.index, 1)

            changeItem(activeIndex, { sections: newSections })

            songSectionList.select(0)
        }
    })

    songResetButton.onEvent('click', () => {
        if (
            !isActive('song') ||
            songSectionList.index < 0 ||
            songSectionList.index >=
                editor.data.items[activeIndex].sections.length
        ) {
            return false
        }

        let item = editor.data.items[activeIndex]
        let section = item.sections[songSectionList.index]

        section.align = 'center'

        if (section.data) {
            section.type = 'Text'

            section.text = richText.format(item.song[section.data])
            section.plainText = item.song[section.data]

            if (section.data === 'name') {
                section.type = 'Header'

                if (options.boldName) {
                    section.text = '<b>' + section.text
                }
            } else if (section.data === 'author' && options.italicizeAuthor) {
                section.text = '<i>' + section.text
            }
        } else if (section.section) {
            section.type = 'Paragraph'

            section.text = item.song.sections[section.section].text
            section.plainText = item.song.sections[section.section].plainText

            if (
                section.section.toLowerCase().startsWith('chorus') &&
                options.italicizeChorus
            ) {
                section.text = '<i>' + section.text
            }
        }

        changeSongSection(activeIndex, songSectionList.index, section)

        songSectionList.select(songSectionList.index)
    })

    songResetAllButton.onEvent('click', () => {
        if (!isActive('song')) {
            return false
        }

        changeItem(
            activeIndex,
            resetSong(editor.util.copyObj(editor.data.items[activeIndex]))
        )

        selectItem(activeIndex)
    })

    songType.onEvent('change', event => {
        if (
            !event.fromUser ||
            !isActive('song') ||
            songSectionList.index < 0 ||
            songSectionList.index >=
                editor.data.items[activeIndex].sections.length
        ) {
            return false
        }

        changeSongSection(activeIndex, songSectionList.index, {
            type: event.value
        })
    })

    songTextEditor.onEvent('change', event => {
        if (
            !event.fromUser ||
            !isActive('song') ||
            songSectionList.index < 0 ||
            songSectionList.index >=
                editor.data.items[activeIndex].sections.length
        ) {
            return false
        }

        changeSongSection(
            activeIndex,
            songSectionList.index,
            editor.util.filterObj(event, {
                text: true,
                plainText: true,
                align: true
            })
        )
    })
}

//text changes
{
    textEditor.onEvent('change', event => {
        if (!event.fromUser || !isActive('text')) {
            return false
        }

        changeItem(activeIndex, {
            data: editor.util.filterObj(event, {
                align: true,
                text: true,
                plainText: true
            })
        })
    })

    textType.onEvent('change', event => {
        if (!event.fromUser || !isActive('text')) {
            return false
        }

        changeItem(activeIndex, { data: { type: event.value } })
    })
}

//print options
{
    fontInput.onEvent('change', event => {
        if (event.fromUser) {
            editor.change('font', event.value)
        }

        preview.font = editor.data.font

        ipcRenderer.send('set-setting', 'print.font', event.value)
    })
    sizeInput.onEvent('change', event => {
        if (event.fromUser) {
            editor.change('fontSize', event.value)
        }

        preview.fontSize = editor.data.fontSize

        ipcRenderer.send('set-setting', 'print.fontSize', event.value)
    })
}

preview.onEvent('change', event => {
    if (typeof event.landscape === 'boolean') {
        landscapeWarning.visible = event.landscape
        printButton.disabled = event.landscape
    }

    if (event.fromUser) {
        if (typeof event.size === 'string') {
            editor.change('size', event.size)

            ipcRenderer.send('set-setting', 'print.size', event.size)
        }

        if (typeof event.landscape === 'boolean') {
            editor.change('landscape', event.landscape)

            ipcRenderer.send('set-setting', 'print.landscape', event.landscape)
        }

        if (typeof event.margin === 'number') {
            editor.change('margin', event.margin)

            ipcRenderer.send('set-setting', 'print.margin', event.margin)
        }

        if (typeof event.columns === 'number') {
            editor.change('columns', event.columns)

            ipcRenderer.send('set-setting', 'print.columns', event.columns)
        }
    }
})

Songs.onEvent('update-start', () => {
    layout.showLoader(resultsBox)
})
layout.showLoader(resultsBox)
Songs.onEvent('update', () => {
    layout.hideLoader(resultsBox)

    updateSearch()
})

Songs.onEvent('error', error => {
    layout.dialog.showNotification({
        type: 'error',
        autoHide: false,

        message: 'There is an error with the Song database!\n' + error.message
    })
})

testButton.onEvent('click', preview.setupTest)

printButton.onEvent('click', preview.print)
pdfButton.onEvent('click', preview.save)

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
        selectItem(activeIndex)

        updatePreview()
        updatePrintSettings()
    }
})

layout.window.onEvent('close', event => {
    if (editor.hasChanges) {
        event.confirm(
            'Your print setup will be lost! Are you sure you want to close?'
        )
    }
})

let shownInfo = false

let recievedSettings = []

ipcRenderer.on('setting', (event, key, value) => {
    //Only when a setting is given for the first time update it
    if (recievedSettings.includes(key)) {
        return false
    }
    recievedSettings.push(key)

    if (
        key === 'print.showInfo' &&
        value === true &&
        !shownInfo &&
        !editor.hasChanges
    ) {
        shownInfo = true

        editor.changeBase('items', [
            {
                type: 'text',

                data: {
                    type: 'Paragraph',

                    align: 'left',

                    text: richText.format(
                        "The print contents are show in the upper middle list.\nAdd songs with the search on the left, and text with the 'Add Text' button.\nTo change a print item, select it."
                    )
                }
            }
        ])

        itemList.add('Text')
        selectItem(0)

        updatePreview()

        return true
    }

    switch (key) {
        case 'print.font':
            editor.changeBase('font', value)

            fontInput.value = value

            break
        case 'print.fontSize':
            editor.changeBase('fontSize', value)

            sizeInput.value = value

            break
        case 'print.size':
            editor.changeBase('size', value)

            preview.size = value

            break
        case 'print.landscape':
            editor.changeBase('landscape', value)

            preview.landscape = value

            break
        case 'print.margin':
            editor.changeBase('margin', value)

            preview.margin = value

            break
        case 'print.columns':
            editor.changeBase('columns', value)

            preview.columns = value

            break
    }
})

ipcRenderer.send('get-setting', 'print.showInfo', true)

ipcRenderer.send('get-settings', [
    ['print.font', 'Arial'],
    ['print.fontSize', 12],
    ['print.size', 'A4'],
    ['print.landscape', false],
    ['print.margin', 1],
    ['print.columns', 1]
])
