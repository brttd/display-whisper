const { ipcRenderer } = require('electron')

const layout = require('dw-layout')

const logger = require('dw-log')
const Database = require('dw-database')
const editor = require('dw-editor')
const richText = require('dw-rich-text')

const Songs = new Database.Group('songs', { load: false, parse: true })
const Templates = new Database.Group('templates', { load: true, parse: true })

const newlineRegex = new RegExp(/\n/g)

let increaseSizeOnFit = true

let itemLocked = false

layout.window.setSize({
    min: {
        width: 600,
        height: 350
    }
})

const playOrderEditor = new layout.List(
    {
        label: 'Play Order',
        editButton: false,
        removeButton: true,
        reorderable: true,

        addInput: ["You shouldn't see this!"]
    },
    {
        border: false
    }
)

const songsBlock = new layout.Block({}, { direction: 'vertical', padding: 0 })

const songNameInput = new layout.TextInput(
    {
        label: 'Title:'
    },
    {
        size: '20ch',
        grow: true,
        shrink: true
    }
)
const songAuthorInput = new layout.TextInput(
    {
        label: 'Author:'
    },
    {
        size: '20ch',
        grow: true,
        shrink: true
    }
)
const songCopyrightInput = new layout.TextInput(
    {
        label: 'Copyright:'
    },
    {
        size: '20ch',
        grow: true,
        shrink: true
    }
)
const editButton = new layout.Button({ text: 'Edit' })
const saveButton = new layout.Button({ text: 'Save' })
const saveNewButton = new layout.Button({ text: 'Save as New' })
const reloadButton = new layout.Button({ text: 'Reload' })

const templateSelector = new layout.SelectInput({})
const applyTemplateButton = new layout.Button({ text: 'Apply' })

const textControl = new layout.TextStyleEdit({})
const boxControl = new layout.BoxStyleEdit({})
const backgroundControl = new layout.BackgroundStyleEdit({})
const playControl = new layout.PlayStyleEdit({})

const showSectionOverlay = new layout.CheckboxInput({
    label: 'Show Section Overlay'
})
const showEndOverlay = new layout.CheckboxInput({ label: 'Show End Overlay' })
const maxLines = new layout.NumberInput({
    value: 0,
    max: 100,
    min: 0,
    precision: 0,

    popupMax: 20
})

const fitTextButton = new layout.Button({
    text: 'Scale Text & Unify',
    size: 'large'
})

const updateSectionsButton = new layout.Button({ text: 'Update Sections' })
updateSectionsButton.visible = false

const sectionsBar = new layout.Block({
    items: [
        showSectionOverlay,
        showEndOverlay,
        new layout.Text(
            {
                text: 'Max lines per section'
            },
            { align: 'center' }
        ),
        maxLines,
        updateSectionsButton
    ],

    childSpacing: 8
})

const displayEditor = new layout.DisplayEdit({})

const contentTextBox = displayEditor.add({ type: 'text' })

const sectionOverlayTextBox = displayEditor.add({ type: 'text' })

const endOverlayTextBox = displayEditor.add({ type: 'text' })

const displayButton = new layout.Button({ text: 'Display' })

const okButton = new layout.Button({ text: 'OK' })

const applyButton = new layout.Button({ text: 'Apply' })
const cancelButton = new layout.Button({ text: 'Cancel' })

textControl.connect(contentTextBox)
boxControl.connect(contentTextBox)

textControl.connect(sectionOverlayTextBox)
boxControl.connect(sectionOverlayTextBox)

textControl.connect(endOverlayTextBox)
boxControl.connect(endOverlayTextBox)

backgroundControl.connect(displayEditor)

{
    layout.change(maxLines, {
        align: 'center'
    })
    layout.change(updateSectionsButton, {
        align: 'center'
    })
    layout.change(fitTextButton, {
        align: 'end',
        margin: 4
    })
    layout.change(showSectionOverlay, {
        align: 'center'
    })
    layout.change(showEndOverlay, {
        align: 'center'
    })

    layout.change(sectionsBar, {
        direction: 'horizontal',

        size: '35px',

        grow: false,
        shrink: false,

        padding: 0
    })

    layout.change(displayEditor, {
        flex: '1 1 auto',

        background: true,
        border: true
    })

    songsBlock.add(
        new layout.Block(
            {
                childSpacing: 8,
                items: [songNameInput, songAuthorInput, songCopyrightInput]
            },
            {
                direction: 'horizontal',
                grow: false,
                shrink: false,

                padding: 0
            }
        )
    )
    songsBlock.add(
        new layout.Block(
            {
                childSpacing: 8,
                items: [editButton, saveButton, saveNewButton, reloadButton]
            },
            {
                direction: 'horizontal',
                grow: false,
                shrink: false,

                padding: 0
            }
        )
    )

    layout.body.add(
        new layout.LayoutBlock({
            items: [
                new layout.LayoutBlock({
                    items: [
                        /* Sections */
                        new layout.LayoutBlock({
                            items: [playOrderEditor],

                            size: 20,
                            minWidth: 150,
                            maxWidth: 300,
                            minHeight: 200
                        }),
                        new layout.LayoutBlock({
                            items: [
                                /* Songs + Templates */
                                new layout.LayoutBlock({
                                    items: [
                                        new layout.Block(
                                            {
                                                items: [
                                                    songsBlock,
                                                    new layout.Filler(),

                                                    fitTextButton,

                                                    new layout.Block(
                                                        {
                                                            items: [
                                                                new layout.Text(
                                                                    {
                                                                        text:
                                                                            'Templates'
                                                                    }
                                                                ),
                                                                new layout.Block(
                                                                    {
                                                                        items: [
                                                                            templateSelector,
                                                                            applyTemplateButton
                                                                        ],
                                                                        childSpacing: 8
                                                                    },
                                                                    {
                                                                        direction:
                                                                            'horizontal',
                                                                        padding: 0
                                                                    }
                                                                )
                                                            ],
                                                            childSpacing: 8
                                                        },
                                                        {
                                                            direction:
                                                                'vertical',
                                                            grow: false,

                                                            align: 'end',

                                                            padding: 0
                                                        }
                                                    )
                                                ]
                                            },
                                            {
                                                direction: 'horizontal',
                                                padding: 4
                                            }
                                        )
                                    ],

                                    size: 20,
                                    minWidth: 550,
                                    minHeight: 90,
                                    maxHeight: 90
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
                                                childSpacing: 8
                                            },
                                            {
                                                direction: 'vertical',
                                                overflow: 'hidden'
                                            }
                                        )
                                    ],

                                    size: 70,
                                    minWidth: 500,
                                    minHeight: 400
                                })
                                /* OK, Apply, Cancel */
                            ],

                            direction: 'vertical',
                            size: 80,

                            small: true
                        })
                    ],

                    size: 90,
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
                                childSpacing: 8
                            },
                            {
                                direction: 'horizontal'
                                //align: 'end'
                            }
                        )
                    ],

                    size: 10,
                    minWidth: 30,
                    minHeight: 40,
                    maxHeight: 40
                })
            ],

            direction: 'vertical'
        })
    )
}

const introName = 'Song - Intro'
const outroName = 'Song - Outro'
const blankName = 'Song - Blank'

let displaySections = []
let activeIndex = -1

function updateSections() {
    displaySections = []

    for (
        let sectionIndex = 0;
        sectionIndex < editor.data.playOrder.length;
        sectionIndex++
    ) {
        let displayIndex = displaySections.length

        if (editor.data.playOrder[sectionIndex] === introName) {
            displaySections.push(editor.util.copyObj(editor.data.intro))

            displaySections[displayIndex]._sectionName = introName
            displaySections[displayIndex]._sectionSplitIndex = 0
            displaySections[displayIndex]._sectionSplitCount = 0

            displaySections[displayIndex].name = 'Intro'
        } else if (editor.data.playOrder[sectionIndex] === outroName) {
            displaySections.push(editor.util.copyObj(editor.data.outro))

            displaySections[displayIndex]._sectionName = outroName
            displaySections[displayIndex]._sectionSplitIndex = 0
            displaySections[displayIndex]._sectionSplitCount = 0

            displaySections[displayIndex].name = 'Outro'
        } else if (editor.data.playOrder[sectionIndex] === blankName) {
            displaySections.push(editor.util.copyObj(editor.data.blank))

            displaySections[displayIndex]._sectionName = blankName
            displaySections[displayIndex]._sectionSplitIndex = 0
            displaySections[displayIndex]._sectionSplitCount = 0

            displaySections[displayIndex].name = 'Blank'
        } else if (
            editor.data.sections.hasOwnProperty(
                editor.data.playOrder[sectionIndex]
            )
        ) {
            let section = editor.util.copyObj(
                editor.data.sections[editor.data.playOrder[sectionIndex]]
            )
            section.name = editor.data.playOrder[sectionIndex]

            let sectionParts = richText.distributeLines(
                section.text,
                editor.data.maxLines
            )

            if (sectionParts.length === 1) {
                displaySections.push(section)

                displaySections[displayIndex]._sectionName = displaySections[
                    displayIndex
                ].name = section.name
                displaySections[displayIndex]._sectionSplitIndex = 0
                displaySections[displayIndex]._sectionSplitCount = 1
            } else {
                for (
                    let partIndex = 0;
                    partIndex < sectionParts.length;
                    partIndex++
                ) {
                    let partSection = editor.util.copyObj(section)

                    partSection._sectionIndex = sectionIndex
                    partSection._sectionSplitIndex = partIndex
                    partSection._sectionSplitCount = sectionParts.length

                    partSection._sectionName = section.name
                    partSection.name =
                        section.name +
                        ' - ' +
                        String.fromCharCode(97 + partIndex)

                    partSection.text = sectionParts[partIndex]
                    partSection.plainText = richText.removeFormat(
                        sectionParts[partIndex]
                    )

                    displaySections.push(partSection)
                }
            }
        } else {
            displaySections.push(editor.util.copyObj(editor.data.template))
            displaySections[displayIndex]._sectionName = displaySections[
                displayIndex
            ].name = 'Missing Section!'

            displaySections[displayIndex]._sectionSplitIndex = 0
            displaySections[displayIndex]._sectionSplitCount = 0
        }

        displaySections[displayIndex]._sectionIndex = sectionIndex
    }

    updateSectionsButton.visible = false
    playOrderEditor.clear()

    for (let i = 0; i < displaySections.length; i++) {
        playOrderEditor.add(displaySections[i].name || 'MISSING SECTION')
    }

    let inputs = Object.keys(editor.data.sections).map(
        name => 'Section: ' + name
    )
    inputs.unshift('Intro', 'Outro', 'Blank')

    playOrderEditor.addInput = inputs
}

function updateSectionsAndSelect() {
    let lastSelected = playOrderEditor.selected

    updateSections()

    if (!playOrderEditor.asArray().includes(lastSelected)) {
        let index = 0

        if (activeIndex >= 0 && activeIndex < displaySections.length) {
            for (let i = 0; i < displaySections.length; i++) {
                if (
                    displaySections[i]._sectionName ===
                    displaySections[activeIndex]._sectionName
                ) {
                    index = i
                    break
                }
            }
        }

        playOrderEditor.select(index)
    } else {
        playOrderEditor.select(lastSelected)
    }
}

function isLastSongSection(index) {
    if (index < 0 || index >= displaySections.length) {
        return false
    }

    for (let i = index + 1; i < displaySections.length; i++) {
        if (
            displaySections[i]._sectionIndex !==
            displaySections[index]._sectionIndex
        ) {
            if (
                displaySections[i]._sectionName !== introName &&
                displaySections[i]._sectionName !== outroName &&
                displaySections[i]._sectionName !== blankName
            ) {
                return false
            }
        }
    }

    return true
}

function getTextReplacement(text, section) {
    if (section) {
        text = richText.dataReplace(text, {
            section: richText.format(section._sectionName),

            sectionParts: richText.format(
                section._sectionSplitCount.toString()
            ),
            sectionPart: richText.format(
                (section._sectionSplitIndex + 1).toString()
            ),
            sectionSplit:
                section._sectionSplitCount > 1
                    ? richText.format(
                          (section._sectionSplitIndex + 1).toString() +
                              '/' +
                              section._sectionSplitCount.toString()
                      )
                    : '\u00A0',

            index: richText.format(section._sectionIndex.toString()),
            total: richText.format(editor.data.playOrder.length.toString())
        })
    }

    return richText.dataReplace(text, {
        name: richText.format(editor.data.name),
        author: richText.format(editor.data.author),
        copyright: richText.format(editor.data.copyright)
    })
}

function showSection(index) {
    if (index < 0 || index >= displaySections.length) {
        return false
    }

    activeIndex = index

    if (
        displaySections[activeIndex]._sectionName === introName ||
        displaySections[activeIndex]._sectionName === outroName ||
        displaySections[activeIndex]._sectionName === blankName
    ) {
        showEndOverlay.visible = false
        sectionOverlayTextBox.hide()
        endOverlayTextBox.hide()

        showSectionOverlay.visible = false
        maxLines.disabled = true

        displayEditor.edit(displaySections[activeIndex])

        contentTextBox.edit(displaySections[activeIndex])

        sectionOverlayTextBox.edit(editor.data.sectionOverlay)

        playControl.set(displaySections[activeIndex])

        if (displaySections[activeIndex]._sectionName === introName) {
            contentTextBox.edit({ text: editor.data.intro.text })
            contentTextBox.show()
        } else if (displaySections[activeIndex]._sectionName === outroName) {
            contentTextBox.edit({ text: editor.data.outro.text })
            contentTextBox.show()
        } else if (displaySections[activeIndex]._sectionName === blankName) {
            contentTextBox.hide()
            sectionOverlayTextBox.hide()
            showSectionOverlay.value = false
        }
    } else {
        showSectionOverlay.visible = true
        maxLines.disabled = false

        displayEditor.edit(editor.data.template)
        displayEditor.edit(displaySections[activeIndex])

        contentTextBox.edit(editor.data.template)
        contentTextBox.edit(displaySections[activeIndex])
        contentTextBox.show()

        if (editor.data.sectionOverlay.show) {
            sectionOverlayTextBox.show()
        } else {
            sectionOverlayTextBox.hide()
        }

        showSectionOverlay.value = editor.data.sectionOverlay.show

        playControl.set(displaySections[activeIndex])

        endOverlayTextBox.hide()

        if (isLastSongSection(activeIndex)) {
            showEndOverlay.visible = true

            showEndOverlay.value = editor.data.endOverlay.show

            if (editor.data.endOverlay.show) {
                endOverlayTextBox.show()
            }
        } else {
            showEndOverlay.visible = false
        }
    }

    updateIntroOutroText()
    updateSectionOverlayText()
    updateEndOverlayText()
}

function changeSection(name, change) {
    let styleChange = editor.util.filterObj(
        change,
        { text: true, plainText: true },
        true
    )
    for (let i = 0; i < displaySections.length; i++) {
        if (displaySections[i]._sectionName === name) {
            editor.util.applyObj(displaySections[i], styleChange)
        }
    }

    if (editor.data.sections.hasOwnProperty(name)) {
        editor.change('sections', name, change)
    } else if (name === introName) {
        editor.change('intro', change)
    } else if (name === outroName) {
        editor.change('outro', change)
    } else if (name === blankName) {
        editor.change('blank', styleChange)
    }
}

function updateSongInputs() {
    songNameInput.value = editor.data.name
    songAuthorInput.value = editor.data.author
    songCopyrightInput.value = editor.data.copyright
}

function updateSongLibraryButtons() {
    if (Songs.has(editor.data.group, editor.data.groupID)) {
        editButton.disabled = false
        saveButton.disabled = false
        reloadButton.disabled = false
    } else {
        editButton.disabled = true
        saveButton.disabled = true
        reloadButton.disabled = true
    }
}

function updateIntroOutroText() {
    if (activeIndex < 0 || activeIndex >= displaySections.length) {
        return false
    }

    if (displaySections[activeIndex]._sectionName === introName) {
        if (contentTextBox._focused) {
            contentTextBox.edit({
                text: editor.data.intro.text
            })
        } else {
            contentTextBox.edit({
                text: getTextReplacement(editor.data.intro.text)
            })
        }
    } else if (displaySections[activeIndex]._sectionName === outroName) {
        if (contentTextBox._focused) {
            contentTextBox.edit({
                text: editor.data.outro.text
            })
        } else {
            contentTextBox.edit({
                text: getTextReplacement(editor.data.outro.text)
            })
        }
    }
}
function updateSectionOverlayText() {
    if (activeIndex < 0 || activeIndex >= displaySections.length) {
        return false
    }

    if (
        displaySections[activeIndex]._sectionName === introName ||
        displaySections[activeIndex]._sectionName === outroName ||
        displaySections[activeIndex]._sectionName === blankName
    ) {
        sectionOverlayTextBox.hide()

        showSectionOverlay.visible = false

        return false
    }

    if (sectionOverlayTextBox._focused) {
        sectionOverlayTextBox.edit(editor.data.template.sectionOverlay)
        sectionOverlayTextBox.edit(editor.data.sectionOverlay)
    } else {
        sectionOverlayTextBox.edit(editor.data.template.sectionOverlay)
        sectionOverlayTextBox.edit(editor.data.sectionOverlay)
        sectionOverlayTextBox.edit({
            text: getTextReplacement(
                editor.data.sectionOverlay.text,
                displaySections[activeIndex]
            )
        })
    }
}
function updateEndOverlayText() {
    if (isLastSongSection(activeIndex)) {
        if (endOverlayTextBox._focused) {
            endOverlayTextBox.edit(editor.data.template.endOverlay)
            endOverlayTextBox.edit(editor.data.endOverlay)
        } else {
            endOverlayTextBox.edit(editor.data.template.endOverlay)
            endOverlayTextBox.edit(editor.data.endOverlay)
            endOverlayTextBox.edit({
                text: getTextReplacement(editor.data.endOverlay.text)
            })
        }
    } else {
        endOverlayTextBox.hide()
        showEndOverlay.visible = false
    }
}

maxLines.onEvent('change', event => {
    if (event.fromUser && event.value >= 0 && isFinite(event.value)) {
        editor.change('maxLines', ~~event.value)

        updateSectionsAndSelect()
    }
})

updateSectionsButton.onEvent('click', updateSectionsAndSelect)

fitTextButton.onEvent('click', () => {
    let collections = {
        sections: [],

        intro: [
            {
                text: getTextReplacement(editor.data.intro.text),

                font: editor.data.intro.font,
                size: editor.data.intro.size,

                lineHeight: editor.data.intro.lineHeight,

                opacity: editor.data.intro.opacity,

                top: editor.data.intro.top,
                left: editor.data.intro.left,
                right: editor.data.intro.right,
                bottom: editor.data.intro.bottom
            }
        ],
        outro: [
            {
                text: getTextReplacement(editor.data.outro.text),

                font: editor.data.outro.font,
                size: editor.data.outro.size,

                lineHeight: editor.data.outro.lineHeight,

                opacity: editor.data.outro.opacity,

                top: editor.data.outro.top,
                left: editor.data.outro.left,
                right: editor.data.outro.right,
                bottom: editor.data.outro.bottom
            }
        ],
        sectionOverlay: [],
        endOverlay: [
            {
                text: getTextReplacement(editor.data.endOverlay.text),

                font: editor.data.endOverlay.font,
                size: editor.data.endOverlay.size,

                lineHeight: editor.data.endOverlay.lineHeight,

                opacity: editor.data.endOverlay.opacity,

                top: editor.data.endOverlay.top,
                left: editor.data.endOverlay.left,
                right: editor.data.endOverlay.right,
                bottom: editor.data.endOverlay.bottom
            }
        ]
    }

    let totalSectionCount = editor.data.playOrder.reduce((count, section) => {
        if (
            section !== introName &&
            section !== outroName &&
            section !== blankName
        ) {
            count += 1
        }

        return count
    }, 0)

    for (let section in editor.data.sections) {
        let parts = richText.distributeLines(
            editor.data.sections[section].text,
            editor.data.maxLines
        )

        for (let partIndex = 0; partIndex < parts.length; partIndex++) {
            collections.sections.push({
                text: parts[partIndex],

                font: editor.data.sections[section].font,
                size: editor.data.sections[section].size,

                lineHeight: editor.data.sections[section].lineHeight,

                opacity: editor.data.sections[section].opacity,

                top: editor.data.sections[section].top,
                left: editor.data.sections[section].left,
                right: editor.data.sections[section].right,
                bottom: editor.data.sections[section].bottom
            })

            let sectionOverlayText = getTextReplacement(
                editor.data.sectionOverlay.text
            )

            sectionOverlayText = richText.dataReplace(sectionOverlayText, {
                section: richText.format(section),

                sectionParts: richText.format(parts.length.toString()),
                sectionPart: richText.format((partIndex + 1).toString()),
                sectionSplit:
                    parts.length > 1
                        ? richText.format(
                              (partIndex + 1).toString() +
                                  '/' +
                                  parts.length.toString()
                          )
                        : '\u00A0',

                //Note: The section overlay is tested once per section, NOT once per play order section
                //Since the only value which changes inbetween repeats of the same section is {index}, the total count of sections is being used instead.
                //This generally shouldn't be a problem, but if there are than 9 sections in the play order, all of them will be tested with a two digit {index} value (And if more than 99, with three digits).
                index: richText.format(totalSectionCount.toString()),
                total: richText.format(totalSectionCount.toString())
            })

            collections.sectionOverlay.push({
                text: sectionOverlayText,

                font: editor.data.sectionOverlay.font,
                size: editor.data.sectionOverlay.size,

                lineHeight: editor.data.sectionOverlay.lineHeight,

                opacity: editor.data.sectionOverlay.opacity,

                top: editor.data.sectionOverlay.top,
                left: editor.data.sectionOverlay.left,
                right: editor.data.sectionOverlay.right,
                bottom: editor.data.sectionOverlay.bottom
            })
        }
    }

    layout.Display.getMaxTextSize(collections.sections, maxSize => {
        if (isFinite(maxSize) && maxSize > 0) {
            if (!increaseSizeOnFit) {
                let maxSectionSize = 0

                for (let i = 0; i < collections.sections.length; i++) {
                    maxSectionSize = Math.max(
                        maxSectionSize,
                        collections.sections[i].size
                    )
                }

                maxSize = Math.min(maxSectionSize, maxSize)
            }

            let allChanges = {
                sections: {}
            }

            for (let section in editor.data.sections) {
                allChanges.sections[section] = { size: maxSize }
            }

            let toGet = ['intro', 'outro', 'sectionOverlay', 'endOverlay']

            let getNext = () => {
                if (toGet.length === 0) {
                    editor.change(allChanges)

                    updateSectionsAndSelect()

                    return
                }

                let name = toGet.pop()

                if (!collections.hasOwnProperty(name)) {
                    return getNext()
                }

                layout.Display.getMaxTextSize(collections[name], maxSize => {
                    if (isFinite(maxSize) && maxSize > 0) {
                        if (!increaseSizeOnFit) {
                            let maxSectionSize = 0
                            for (let i = 0; i < collections[name].length; i++) {
                                maxSectionSize = Math.max(
                                    maxSectionSize,
                                    collections[name][i].size
                                )
                            }

                            maxSize = Math.min(maxSectionSize, maxSize)
                        }

                        allChanges[name] = { size: maxSize }
                    }

                    getNext()
                })
            }

            getNext()
        } else {
            logger.error('getMaxTextSize returned invalid value!', maxSize)
        }
    })
})

//Songs
{
    function getSongSaveData() {
        let song = {
            group: editor.data.group,
            groupID: editor.data.groupID,

            name: editor.data.name,
            author: editor.data.author,
            copyright: editor.data.copyright,

            sections: {},
            playOrder: editor.util.copyObj(editor.data.playOrder)
        }

        for (let section in editor.data.sections) {
            song.sections[section] = {
                name: section,
                text: editor.data.sections[section].text,
                plainText: editor.data.sections[section].plainText
            }
        }

        //Remove all intro, outro, & blank sections from the playOrder
        for (let i = song.playOrder.length - 1; i >= 0; i--) {
            if (
                song.playOrder[i] === introName ||
                song.playOrder[i] === outroName ||
                song.playOrder[i] === blankName
            ) {
                song.playOrder.splice(i, 1)
            }
        }

        return song
    }

    songNameInput.onEvent('change', event => {
        if (!event.fromUser) {
            return false
        }

        editor.change('name', event.value)

        updateIntroOutroText()
        updateSectionOverlayText()
        updateEndOverlayText()
    })
    songAuthorInput.onEvent('change', event => {
        if (!event.fromUser) {
            return false
        }

        editor.change('author', event.value)

        updateIntroOutroText()
        updateSectionOverlayText()
        updateEndOverlayText()
    })
    songCopyrightInput.onEvent('change', event => {
        if (!event.fromUser) {
            return false
        }

        editor.change('copyright', event.value)

        updateIntroOutroText()
        updateSectionOverlayText()
        updateEndOverlayText()
    })

    Songs.onEvent('update', () => {
        layout.hideLoader(songsBlock)
        updateSongLibraryButtons()
    })
    Songs.onEvent('update-start', () => {
        layout.showLoader(songsBlock)
    })
    layout.showLoader(songsBlock)

    Songs.onEvent('error', error => {
        layout.dialog.showNotification({
            type: 'error',
            autoHide: false,

            message:
                'There is an error with the Song database!\n' + error.message
        })
    })

    editButton.onEvent('click', () => {
        layout.window.openWindow('songDatabase', [
            'show-song',
            editor.data.group,
            editor.data.groupID
        ])
    })

    saveButton.onEvent('click', () => {
        if (!Songs.validID(editor.data.group, editor.data.groupID)) {
            return saveNewButton.click()
        }

        Songs.save(
            editor.data.group,
            editor.data.groupID,
            getSongSaveData(),
            error => {
                if (error) {
                    layout.dialog.showNotification({
                        type: 'error',
                        message:
                            'Unable to save song!\n' + error.message ||
                            error.toString()
                    })

                    logger.error(
                        'Unable to save song',
                        editor.data.group +
                            '-' +
                            editor.data.groupID.toString(),
                        ':',
                        error
                    )

                    return false
                }

                layout.dialog.showNotification({
                    type: 'success',
                    message: 'Saved song'
                })
            }
        )
    })

    saveNewButton.onEvent('click', () => {
        if (!Songs.validGroup(editor.data.group)) {
            editor.changeHidden('group', 'S')
        }

        editor.changeHidden('groupID', Songs.getUniqueID(editor.data.group))

        Songs.save(
            editor.data.group,
            editor.data.groupID,
            getSongSaveData(),
            error => {
                if (error) {
                    layout.dialog.showNotification({
                        type: 'error',
                        message:
                            'Unable to save song!\n' + error.message ||
                            error.toString()
                    })

                    logger.error(
                        'Unable to save song',
                        editor.data.group +
                            '-' +
                            editor.data.groupID.toString(),
                        ':',
                        error
                    )

                    return false
                }
                layout.dialog.showNotification({
                    type: 'success',
                    message:
                        'Saved song with ID ' +
                        editor.data.group +
                        '-' +
                        editor.data.groupID.toString()
                })
            }
        )
    })

    reloadButton.onEvent('click', () => {
        if (!Songs.validID(editor.data.group, editor.data.groupID)) {
            layout.dialog.showNotification({
                type: 'warning',
                message: 'No song in library with same ID!'
            })

            return false
        }

        Songs.get(editor.data.group, editor.data.groupID, (error, data) => {
            if (error || !data) {
                if (!error) {
                    error = new Error("Data file couldn't be loaded")
                }

                layout.dialog.showNotification({
                    type: 'error',
                    message:
                        'Unable to load song!\n' + error.message ||
                        error.toString()
                })

                logger.error(
                    'Unable to load song',
                    editor.data.group + '-' + editor.data.groupID.toString(),
                    ':',
                    error
                )

                return false
            }

            let newSections = {}
            let newPlayOrder = []

            for (let sectionName in data.sections) {
                if (editor.data[sectionName]) {
                    newSections[sectionName] = editor.util.copyObj(
                        editor.data[sectionName]
                    )
                } else {
                    newSections[sectionName] = editor.util.filterObj(
                        editor.data.template,
                        {
                            font: true,
                            size: true,
                            color: true,

                            lineHeight: true,

                            background: true,
                            backgroundImage: true,
                            backgroundScale: true,

                            align: true,
                            y: true,

                            opacity: true,

                            top: true,
                            left: true,
                            right: true,
                            bottom: true,

                            playTime: true,
                            autoPlay: true,

                            transition: {
                                type: true,
                                time: true
                            }
                        }
                    )

                    newSections[sectionName].text =
                        data.sections[sectionName].text
                    newSections[sectionName].plainText =
                        data.sections[sectionName].plainText
                }
            }

            let sectionsToKeep = [introName, blankName]

            let i = 0
            while (
                sectionsToKeep.includes(editor.data.playOrder[i]) &&
                i < editor.data.playOrder.length
            ) {
                newPlayOrder.push(editor.data.playOrder[i])
                i++
            }

            newPlayOrder = newPlayOrder.concat(data.playOrder)

            sectionsToKeep = [outroName, blankName]
            let endSections = []
            let min = i

            i = editor.data.playOrder.length - 1
            while (
                i > min &&
                sectionsToKeep.includes(editor.data.playOrder[i])
            ) {
                endSections.unshift(editor.data.playOrder[i])
                i--
            }

            newPlayOrder = newPlayOrder.concat(endSections)

            editor.change({
                name: data.name,
                author: data.author,
                copyright: data.copyright,

                sections: newSections,
                playOrder: newPlayOrder
            })

            updateSectionsAndSelect()

            updateSongInputs()
        })
    })
}

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

        //Remove all template info which isn't display options
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
                author: true,
                copyright: true,

                text: true,
                plainText: true,

                //This is used for image display only
                scale: true
            },
            true
        )

        let sectionChanges = editor.util.filterObj(
            template,
            {
                intro: true,
                outro: true,
                blank: true,

                endOverlay: true,
                sectionOverlay: true,

                maxLines: true
            },
            true
        )
        let sectionDisplayChanges = editor.util.filterObj(
            sectionChanges,
            {
                transition: true
            },
            true
        )

        let changes = {
            template: template,

            sections: {}
        }

        if (!editor.util.isObj(template.intro)) {
            template.intro = {}
        }
        template.intro = editor.util.applyObj(
            template.intro,
            sectionDisplayChanges
        )

        if (!editor.util.isObj(template.outro)) {
            template.outro = {}
        }
        template.outro = editor.util.applyObj(
            template.outro,
            sectionDisplayChanges
        )

        if (!editor.util.isObj(template.blank)) {
            template.blank = {}
        }
        template.blank = editor.util.applyObj(
            template.blank,
            sectionDisplayChanges
        )

        if (editor.util.isObj(template.sectionOverlay)) {
            changes.sectionOverlay = template.sectionOverlay
        }
        if (editor.util.isObj(template.endOverlay)) {
            changes.endOverlay = template.endOverlay
        }

        if (editor.util.isObj(template.intro)) {
            changes.intro = template.intro
        }
        if (editor.util.isObj(template.outro)) {
            changes.outro = template.outro
        }
        if (editor.util.isObj(template.blank)) {
            changes.blank = template.blank
        }

        if (
            typeof template.maxLines === 'number' &&
            isFinite(template.maxLines) &&
            template.maxLines > 0
        ) {
            changes.maxLines = template.maxLines

            maxLines.value = changes.maxLines
        }

        for (let section in editor.data.sections) {
            changes.sections[section] = sectionChanges
        }

        editor.change(changes)

        updateSectionsAndSelect()
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

//Section selecting/editing
{
    playOrderEditor.onEvent('select', event => {
        showSection(event.index)
    })

    playOrderEditor.onEvent('add', event => {
        if (!event.fromUser) {
            return false
        }

        if (event.text.startsWith('Section:')) {
            editor.change(
                'playOrder',
                editor.data.playOrder.concat(
                    event.text.replace('Section: ', '')
                )
            )
        } else if (event.text === 'Intro') {
            editor.change('playOrder', editor.data.playOrder.concat(introName))
        } else if (event.text === 'Outro') {
            editor.change('playOrder', editor.data.playOrder.concat(outroName))
        } else if (event.text === 'Blank') {
            editor.change('playOrder', editor.data.playOrder.concat(blankName))
        }

        updateSections()
        playOrderEditor.select(playOrderEditor.items.length - 1)
    })

    playOrderEditor.onEvent('remove', event => {
        if (!event.fromUser) {
            return false
        }

        if (event.index >= 0 && event.index < displaySections.length) {
            let index = displaySections[event.index]._sectionIndex

            let newPlayOrder = editor.util.copyObj(editor.data.playOrder)
            newPlayOrder.splice(index, 1)

            editor.change('playOrder', newPlayOrder)

            updateSectionsAndSelect()
        }
    })

    playOrderEditor.onEvent('reorder', event => {
        if (!event.fromUser) {
            return false
        }
        if (displaySections.length <= 1) {
            return false
        }

        if (
            event.oldIndex >= 0 &&
            event.oldIndex < displaySections.length &&
            event.index >= 0 &&
            event.index <= displaySections.length
        ) {
            displaySections.splice(
                event.index,
                0,
                displaySections[event.oldIndex]
            )

            let newPlayOrder = []
            let added = []
            let finalIndex = -1

            for (let i = 0; i < displaySections.length; i++) {
                if (
                    !added.includes(displaySections[i]._sectionIndex) &&
                    (displaySections[i]._sectionIndex !==
                        displaySections[event.index]._sectionIndex ||
                        i === event.index)
                ) {
                    newPlayOrder.push(displaySections[i]._sectionName)
                    added.push(displaySections[i]._sectionIndex)

                    if (i === event.index) {
                        finalIndex = newPlayOrder.length - 1
                    }
                }
            }

            editor.change('playOrder', newPlayOrder)

            updateSections()
            playOrderEditor.select(finalIndex)
        }
    })

    contentTextBox.onEvent('focus', updateIntroOutroText)
    contentTextBox.onEvent('blur', updateIntroOutroText)

    sectionOverlayTextBox.onEvent('focus', updateSectionOverlayText)
    sectionOverlayTextBox.onEvent('blur', updateSectionOverlayText)

    endOverlayTextBox.onEvent('focus', updateEndOverlayText)
    endOverlayTextBox.onEvent('blur', updateEndOverlayText)
}

//Content changes
{
    showSectionOverlay.onEvent('change', event => {
        if (!event.fromUser) {
            return false
        }
        if (activeIndex < 0 || activeIndex >= displaySections.length) {
            return false
        }

        if (
            displaySections[activeIndex]._sectionName === introName ||
            displaySections[activeIndex]._sectionName === outroName ||
            displaySections[activeIndex]._sectionName === blankName
        ) {
            //At the moment do nothing, as intro/outro/blank don't do anything
        } else {
            editor.change('sectionOverlay', 'show', event.value)
        }

        if (event.value) {
            sectionOverlayTextBox.show()
        } else {
            sectionOverlayTextBox.hide()
        }
    })

    sectionOverlayTextBox.onEvent('change', event => {
        if (!event.fromUser) {
            return false
        }
        if (activeIndex < 0 || activeIndex >= displaySections.length) {
            return false
        }

        editor.change(
            'sectionOverlay',
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

    showEndOverlay.onEvent('change', event => {
        if (!event.fromUser) {
            return false
        }

        if (!isLastSongSection(activeIndex)) {
            return false
        }

        editor.change('endOverlay', 'show', event.value)

        if (event.value) {
            endOverlayTextBox.show()
        } else {
            endOverlayTextBox.hide()
        }
    })

    endOverlayTextBox.onEvent('change', event => {
        if (!event.fromUser) {
            return false
        }

        editor.change(
            'endOverlay',
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

    displayEditor.onEvent('change', event => {
        if (!event.fromUser) {
            return false
        }
        if (activeIndex < 0 || activeIndex >= displaySections.length) {
            return false
        }

        changeSection(
            displaySections[activeIndex]._sectionName,
            editor.util.filterObj(event, { from: true, fromUser: true }, true)
        )

        if (
            displaySections[activeIndex]._sectionName === introName ||
            displaySections[activeIndex]._sectionName === outroName ||
            displaySections[activeIndex]._sectionName === blankName
        ) {
            editor.changeHidden({
                template: editor.util.filterObj(
                    event,
                    { from: true, fromUser: true },
                    true
                )
            })
        }
    })

    contentTextBox.onEvent('change', event => {
        if (!event.fromUser) {
            return false
        }

        if (activeIndex < 0 || activeIndex >= displaySections.length) {
            return false
        }

        if (typeof event.text === 'string') {
            let sectionName = displaySections[activeIndex]._sectionName
            let sectionIndex = displaySections[activeIndex]._sectionIndex
            let sectionSplitIndex =
                displaySections[activeIndex]._sectionSplitIndex

            //When changing a section, if a section is split into multiple parts, the seperate parts need to be collected back into a single string before being applied to the base editor data
            let newText = []

            for (let i = 0; i < displaySections.length; i++) {
                if (displaySections[i]._sectionName === sectionName) {
                    //Each displayed section needs to have the same text in it:
                    //So the displayed sections need to be edited to ensure they all contain the same text data
                    if (
                        displaySections[i]._sectionSplitIndex ===
                        sectionSplitIndex
                    ) {
                        editor.util.applyObj(displaySections[i], {
                            text: event.text,
                            plainText:
                                event.plainText ||
                                richText.removeFormat(event.text)
                        })
                    }

                    if (displaySections[i]._sectionIndex === sectionIndex) {
                        newText.push(displaySections[i].text)
                    }
                }
            }

            newText = newText.join('\n')

            //The event passed to the changeSection method needs to contain the text for the whole section, instead of just for whatever part was edited
            event.text = newText
            event.plainText = richText.removeFormat(newText)

            //Since the text has changed, the splitting of sections might need to be updated.
            //So the user should be shown the update sections button
            if (
                editor.data.maxLines > 0 &&
                (newText.match(newlineRegex) || '').length >=
                    editor.data.maxLines
            ) {
                updateSectionsButton.visible = true
            }
        }

        changeSection(
            displaySections[activeIndex]._sectionName,
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

        if (activeIndex < 0 || activeIndex >= displaySections.length) {
            return false
        }

        changeSection(
            displaySections[activeIndex]._sectionName,
            editor.util.filterObj(
                event,
                {
                    from: true,
                    fromUser: true
                },
                true
            )
        )

        if (
            displaySections[activeIndex]._sectionName === introName ||
            displaySections[activeIndex]._sectionName === outroName ||
            displaySections[activeIndex]._sectionName === blankName
        ) {
            editor.changeHidden({
                template: editor.util.filterObj(
                    event,
                    { from: true, fromUser: true },
                    true
                )
            })
        }
    })
}

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

cancelButton.onEvent('click', layout.window.close)

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
        updateSectionsAndSelect()
    }

    layout.window.setDocumentEdited(editor.hasChanges)
})

editor.onEvent('output', data => {
    ipcRenderer.send('edit', data)

    layout.window.setDocument(editor.data.name)
    layout.window.setDocumentEdited(false)
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

                    maxLines.value = editor.data.maxLines

                    updateSections()
                    playOrderEditor.select(0)

                    updateSongInputs()
                }
            }
        )

        return false
    }

    gotData = true
    editor.set(data)

    maxLines.value = editor.data.maxLines

    layout.window.setDocument(editor.data.name)

    updateSections()
    playOrderEditor.select(0)

    updateSongLibraryButtons()

    updateSongInputs()
})

ipcRenderer.on('setting', (event, key, value) => {
    if (key === 'display.increaseSizeOnFit') {
        increaseSizeOnFit = value
    }
})

ipcRenderer.send('get-setting', 'display.increaseSizeOnFit', true)

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

ipcRenderer.on('lock', () => {
    itemLocked = true
})
ipcRenderer.on('unlock', () => {
    itemLocked = false
})
