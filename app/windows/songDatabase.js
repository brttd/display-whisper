const { ipcRenderer } = require('electron')

const layout = require('dw-layout')
const richText = require('dw-rich-text')
const logger = require('dw-log')
const editor = require('dw-editor')
const Database = require('dw-database')

//Song search items
const searchBox = new layout.TextInput({
    placeholder: 'Search'
})
const filterName = new layout.CheckboxInput({
    label: 'Name',
    value: true
})
const filterAuthor = new layout.CheckboxInput({
    label: 'Author',
    value: true
})
const filterCopyright = new layout.CheckboxInput({
    label: 'Copyright',
    value: false
})
const filterContent = new layout.CheckboxInput({
    label: 'Content',
    value: false
})
const resultsBox = new layout.TableList({
    columns: 4,
    columnWidths: ['50%', '50%', '3ch', '5ch']
})

const removeAllButton = new layout.Button({
    text: 'Remove All'
})

//Buttons for other windows
const openCheckButton = new layout.Button({
    text: 'Check',
    onClick: () => {
        layout.window.openWindow('songCheck')
    }
})
const openAddButton = new layout.Button({
    text: 'Add',
    onClick: () => {
        layout.window.openWindow('songAdd')
    }
})
const openImportButton = new layout.Button({
    text: 'Import',
    onClick: () => {
        layout.window.openWindow('songImport')
    }
})
const openExportButton = new layout.Button({
    text: 'Export',
    onClick: () => {
        layout.window.openWindow('songExport')
    }
})

//Song data editing items
const nameBox = new layout.TextInput({
    label: 'Name',

    autoFocusNext: true
})
const authorBox = new layout.TextInput({
    label: 'Author',

    autoFocusNext: true
})
const copyrightBox = new layout.TextInput({
    label: 'Copyright',

    autoFocusNext: true
})

const sectionsEditor = new layout.List({
    reorderable: false,
    editButton: true,
    removeButton: true,

    addInput: true
})
const playOrderEditor = new layout.List({
    reorderable: true,
    editButton: false,
    removeButton: true,

    addInput: []
})

const textStyleEditor = new layout.TextStyleEdit({
    font: false,
    size: false,
    color: false,
    lineHeight: false,
    align: false
})
const playTimeEditor = new layout.PlayStyleEdit({
    transition: false,
    autoPlay: false
})
const textEditor = new layout.RichTextInput({
    font: 'Inter UI',
    size: 13,
    color: 'black',
    lineHeight: 1.5
})

textStyleEditor.connect(textEditor)

//Song control buttons
const saveButton = new layout.Button({
    text: 'Save'
})
const duplicateButton = new layout.Button({
    text: 'Duplicate'
})
const removeButton = new layout.Button({
    text: 'Remove'
})

//blocks, etc
{
    layout.change(searchBox, {
        align: 'stretch'
    })

    layout.change(resultsBox, {
        align: 'stretch'
    })

    layout.change(sectionsEditor, {
        size: '50%',
        align: 'stretch'
    })
    layout.change(playOrderEditor, {
        size: '50%',
        align: 'stretch'
    })
    layout.change(textEditor, {
        size: '100%',
        shrink: true,
        align: 'stretch'
    })

    layout.change(nameBox, {
        size: '30% ',
        maxWidth: '30ch',
        shrink: true,
        grow: true
    })
    layout.change(authorBox, {
        size: '30%',
        maxWidth: '30ch',
        shrink: true,
        grow: true
    })
    layout.change(copyrightBox, {
        size: '30%',
        maxWidth: '30ch',
        shrink: true,
        grow: true
    })

    layout.change(textEditor, {
        padding: 2,
        paddingLeft: 4,
        paddingRight: 4
    })

    let infoBlock = new layout.Block(
        {
            items: [nameBox, authorBox, copyrightBox],
            childSpacing: 8
        },
        {
            wrap: true
        }
    )
    let sectionsBlock = new layout.Block(
        {
            items: [
                new layout.Text(
                    {
                        text: 'Sections'
                    },
                    {
                        grow: false,
                        shrink: false,

                        padding: 0,
                        paddingLeft: 4,
                        paddingRight: 4
                    }
                ),
                sectionsEditor,

                new layout.Text(
                    {
                        text: 'Play Order'
                    },
                    {
                        grow: false,
                        shrink: false,

                        padding: 0,
                        paddingLeft: 4,
                        paddingRight: 4
                    }
                ),
                playOrderEditor
            ],
            childSpacing: 8
        },
        {
            direction: 'vertical',

            overflow: 'hidden'
        }
    )
    let editorBlock = new layout.Block(
        {
            items: [
                new layout.Block(
                    {
                        items: [textStyleEditor, playTimeEditor],
                        childSpacing: 8
                    },
                    {
                        direction: 'horizontal',
                        grow: false,
                        shrink: false,
                        padding: 0
                    }
                ),
                textEditor
            ],
            childSpacing: 8
        },
        {
            direction: 'vertical',
            size: '66.666%'
        }
    )
    layout.body.add(
        new layout.LayoutBlock({
            items: [
                /* Search */
                new layout.LayoutBlock({
                    items: [
                        new layout.Block(
                            {
                                items: [
                                    searchBox,
                                    new layout.Block(
                                        {
                                            items: [
                                                filterName,
                                                filterAuthor,
                                                filterCopyright,
                                                filterContent
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
                                    resultsBox,
                                    new layout.Block(
                                        {
                                            items: [
                                                openCheckButton,
                                                new layout.Filler(),
                                                removeAllButton,
                                                new layout.Filler(),
                                                openAddButton,
                                                openImportButton,
                                                openExportButton
                                            ],
                                            childSpacing: 8
                                        },
                                        {
                                            direction: 'horizontal',

                                            grow: false,
                                            shrink: false,
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

                    small: true,
                    minWidth: 325,
                    maxWidth: 500,
                    minHeight: 250,
                    size: 30
                }),
                new layout.LayoutBlock(
                    {
                        items: [
                            /* Info */
                            new layout.LayoutBlock({
                                items: [infoBlock],

                                small: true,
                                minWidth: 400,
                                minHeight: 58,
                                maxHeight: 58,
                                size: 10
                            }),
                            /* Sections */
                            new layout.LayoutBlock({
                                items: [
                                    new layout.LayoutBlock({
                                        items: [sectionsBlock],

                                        small: true,
                                        minWidth: 150,
                                        maxWidth: 400,
                                        minHeight: 250,
                                        size: 30
                                    }),
                                    new layout.LayoutBlock({
                                        items: [editorBlock],

                                        small: true,
                                        minWidth: 200,
                                        minHeight: 200,
                                        size: 70
                                    })
                                ],

                                small: true,
                                direction: 'horizontal',
                                minHeight: 250,
                                size: 80
                            }),
                            /* remove */
                            new layout.LayoutBlock({
                                items: [
                                    new layout.Block(
                                        {
                                            items: [
                                                new layout.Filler(),
                                                saveButton,
                                                duplicateButton,
                                                removeButton
                                            ],
                                            childSpacing: 8
                                        },
                                        {
                                            direction: 'horizontal',
                                            grow: false,
                                            shrink: false
                                        }
                                    )
                                ],

                                small: true,
                                minWidth: 150,
                                minHeight: 40,
                                maxHeight: 40,
                                size: 10
                            })
                        ],

                        small: true,
                        size: 70
                    },
                    {
                        direction: 'vertical'
                    }
                )
            ],

            small: true,
            direction: 'horizontal'
        })
    )
}

//List of song properties which are displayed in search results
const resultsText = ['name', 'author', 'group', 'groupID']

//The name of the currently selected section
let currentSection = ''

let searchResults = []

//Different functions for filtering songs
const searchFilters = {
    all: function(item) {
        return item._allLower.includes(this)
    },

    content: function(item) {
        return item._contentLower.includes(this)
    },
    name: function(item) {
        return item._nameLower.includes(this)
    },
    author: function(item) {
        return item._authorLower.includes(this)
    },
    copyright: function(item) {
        return item._copyrightLower.includes(this)
    },

    content_name: function(item) {
        return (
            item._contentLower.includes(this) || item._nameLower.includes(this)
        )
    },
    content_name_author: function(item) {
        return (
            item._contentLower.includes(this) ||
            item._nameLower.includes(this) ||
            item._authorLower.includes(this)
        )
    },
    content_name_copyright: function(item) {
        return (
            item._contentLower.includes(this) ||
            item._nameLower.includes(this) ||
            item._copyrightLower.includes(this)
        )
    },

    content_author: function(item) {
        return (
            item._contentLower.includes(this) ||
            item._authorLower.includes(this)
        )
    },
    content_author_copyright: function(item) {
        return (
            item._contentLower.includes(this) ||
            item._authorLower.includes(this) ||
            item._copyrightLower.includes(this)
        )
    },

    content_copyright: function(item) {
        return (
            item._contentLower.includes(this) ||
            item._copyrightLower.includes(this)
        )
    },

    name_author: function(item) {
        return (
            item._nameLower.includes(this) || item._authorLower.includes(this)
        )
    },
    name_copyright: function(item) {
        return (
            item._nameLower.includes(this) ||
            item._copyrightLower.includes(this)
        )
    },
    name_author_copyright: function(item) {
        return (
            item._nameLower.includes(this) ||
            item._authorLower.includes(this) ||
            item._copyrightLower.includes(this)
        )
    },

    author_copyright: function(item) {
        return (
            item._authorLower.includes(this) ||
            item._copyrightLower.includes(this)
        )
    }
}

const lastSearch = {
    filter: searchFilters.all,
    search: ''
}

const punctuationCharacters = new RegExp(/[\(\)\*\-\[\]!"&'+,.:;?_`]/g)

const Songs = new Database.Group('songs', {
    load: true,
    parse: true,

    //Whenever a song is loaded/added, some extra information is added to make searching easier
    //(So that a search function doesn't have to caller .toLower() on every string property)
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

        if (!Array.isArray(data.playOrder)) {
            data.playOrder = []
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

//Used to clear out all temporary data (used for searching), when saving a song
function removeSearchData(data) {
    return editor.util.filterObj(
        data,
        {
            _nameLower: true,
            _authorLower: true,
            _copyrightLower: true,
            _contentLower: true,
            _allLower: true
        },
        true
    )
}

//Make all song edit inputs enabled/disabled
function setDisabled(disabled) {
    nameBox.disabled = authorBox.disabled = copyrightBox.disabled = disabled

    sectionsEditor.disabled = playOrderEditor.disabled = disabled

    playTimeEditor.disabled = textEditor.disabled = disabled

    duplicateButton.disabled = disabled
    removeButton.disabled = disabled
}

function save(callback) {
    if (typeof editor.data.group === 'string' && editor.data.group !== '') {
        Songs.save(
            editor.data.group,
            editor.data.groupID,
            removeSearchData(editor.data),
            error => {
                if (error) {
                    layout.dialog.showNotification({
                        type: 'error',
                        message:
                            'Unable to save!\n' + error.message ||
                            error.toString()
                    })

                    logger.error('Unable to save song: ' + error)

                    if (typeof callback === 'function') {
                        callback(error)
                    }

                    return false
                } else if (typeof callback === 'function') {
                    callback()
                }
            }
        )
    } else {
        let error = new Error('No group in song data.')

        logger.error('Unable to save song', error)

        if (typeof callback === 'function') {
            callback(error)
        }
    }
}

function remove() {
    if (typeof editor.data.group === 'string' && editor.data.group !== '') {
        Songs.remove(editor.data.group, editor.data.groupID, error => {
            if (error) {
                layout.dialog.showNotification({
                    type: 'error',
                    message:
                        'Unable to remove song!\n' + error.message ||
                        error.toString()
                })

                logger.error("Couldn't remove song: " + error)

                return false
            }
        })

        resetSong()
    }
}

function showSearchResults() {
    searchResults = Songs.list
        .filter(lastSearch.filter, lastSearch.search)
        .sort((a, b) => {
            return a.name.localeCompare(b.name)
        })

    resultsBox.clear()

    for (let i = 0; i < searchResults.length; i++) {
        resultsBox.add(
            resultsText.map(part => {
                return searchResults[i][part].toString()
            })
        )
    }

    if (editor.data.group) {
        let index = searchResults.findIndex(
            song =>
                song.group === editor.data.group &&
                song.groupID === editor.data.groupID
        )

        resultsBox.select(index)
    }

    if (Songs.files.length === 0) {
        removeAllButton.disabled = true
    } else {
        removeAllButton.disabled = false
    }
}

function updateSearch() {
    lastSearch.search = searchBox.value
        .toLowerCase()
        .replace(punctuationCharacters, '')
        .trim()

    if (
        filterName.value &&
        filterAuthor.value &&
        filterCopyright.value &&
        filterContent.value
    ) {
        lastSearch.filter = searchFilters.all
    } else {
        let filter = []

        if (filterContent.value) {
            filter.push('content')
        }
        if (filterName.value) {
            filter.push('name')
        }
        if (filterAuthor.value) {
            filter.push('author')
        }
        if (filterCopyright.value) {
            filter.push('copyright')
        }

        if (filter.length === 0) {
            filter.push('all')
        }

        filter = filter.join('_')

        if (searchFilters.hasOwnProperty(filter)) {
            lastSearch.filter = searchFilters[filter]
        } else {
            logger.error('No filter with name', filter)

            return false
        }
    }

    showSearchResults()
}

//Sets all song information to empty
function resetSong() {
    editor.set({
        group: '',
        groupID: 0,

        name: '',
        author: '',
        copyright: '',

        playOrder: [],

        sections: {}
    })
    currentSection = ''

    nameBox.value = authorBox.value = copyrightBox.value = textEditor.text = ''

    playTimeEditor.set({ playTime: 0 })

    sectionsEditor.clear()
    sectionsEditor.addInput = ''
    playOrderEditor.clear()
    playOrderEditor.addInput = []

    setDisabled(true)
}

//Changes the song to the given ID, and updates all editing items
function loadSong(group, groupID, force = false) {
    if (typeof groupID === 'string') {
        groupID = parseInt(groupID)
    }

    if (
        group === editor.data.group &&
        groupID === editor.data.groupID &&
        force === false
    ) {
        return false
    }

    resetSong()

    Songs.get(group, groupID, (error, data) => {
        if (error) {
            layout.dialog.showNotification({
                type: 'error',
                message:
                    'Error loading song "' +
                        group +
                        '-' +
                        groupID.toString() +
                        '"\n' +
                        error.message || error.toString()
            })

            logger.error(
                'Unable to load song ' + group + '-' + groupID.toString() + ':',
                error
            )
        } else if (data === undefined) {
            layout.dialog.showNotification({
                type: 'error',
                message:
                    'No song exists with the ID "' +
                    group +
                    '-' +
                    groupID.toString() +
                    '"!'
            })

            logger.error(
                'Tried to load non-existant song ' +
                    group +
                    '-' +
                    groupID.toString()
            )
        } else {
            editor.set(data)

            currentSection = ''

            //update editors
            nameBox.value = editor.data.name
            authorBox.value = editor.data.author
            copyrightBox.value = editor.data.copyright

            //update playOrder
            playOrderEditor.clear()
            updateSectionsList()

            editor.changeBase(
                'playOrder',
                editor.data.playOrder.filter(item =>
                    editor.has('sections', item)
                )
            )

            for (let i = 0; i < editor.data.playOrder.length; i++) {
                playOrderEditor.add(editor.data.playOrder[i])
            }

            if (editor.data.playOrder.length > 0) {
                playOrderEditor.select(0, false, true)
            } else {
                sectionsEditor.select(0, false, true)
            }

            setDisabled(false)

            let searchResultsIndex = searchResults.findIndex(song => {
                return (
                    song.group === editor.data.group &&
                    song.groupID === editor.data.groupID
                )
            })

            resultsBox.select(searchResultsIndex)
        }
    })
}

function updateSectionsList() {
    sectionsEditor.clear()

    let sections = []

    for (let section in editor.data.sections) {
        if (
            editor.data.sections.hasOwnProperty(section) &&
            typeof editor.data.sections[section] === 'object'
        ) {
            sections.push(section)
        }
    }

    sections = sections.sort()

    for (let i = 0; i < sections.length; i++) {
        sectionsEditor.add(sections[i])
    }

    playOrderEditor.addInput = sections
}

//Used when undo/redo happens
function onSongChange(change) {
    if (change.hasOwnProperty('name')) {
        nameBox.value = editor.data.name
    }
    if (change.hasOwnProperty('author')) {
        authorBox.value = editor.data.author
    }
    if (change.hasOwnProperty('copyright')) {
        copyrightBox.value = editor.data.copyright
    }

    if (
        change.hasOwnProperty('sections') ||
        change.hasOwnProperty('playOrder')
    ) {
        updateSectionsList()

        selectSection(currentSection)
    }
}

//Get a unique section name
function makeSectionNameUnique(name) {
    let list = []

    for (let section in editor.data.sections) {
        if (
            editor.data.sections.hasOwnProperty(section) &&
            typeof editor.data.sections[section] === 'object'
        ) {
            list.push(section)
        }
    }

    //if the name isn't unique, add ' 2' to the end of it
    //if it is unique, then return it
    if (list.includes(name)) {
        name += ' 2'
    } else {
        return name
    }

    let number = 2
    while (list.includes(name)) {
        //if the name isn't unique, increase the number at the end by one
        number += 1
        name = name.slice(0, -number.toString().length) + number.toString()
    }

    return name
}

function selectSection(name) {
    currentSection = name

    sectionsEditor.select(currentSection)
    playOrderEditor.select(currentSection)

    if (typeof editor.data.sections[currentSection] === 'object') {
        textEditor.text = editor.data.sections[currentSection].text

        playTimeEditor.set({
            playTime: editor.data.sections[currentSection].playTime
        })
    }
}

//song search/load/remove
{
    searchBox.onEvent('change', updateSearch)

    function onFilterChange() {
        if (
            !filterName.value &&
            !filterAuthor.value &&
            !filterCopyright.value &&
            !filterContent.value
        ) {
            filterName.value = true

            return
        }

        if (searchBox.value !== '') {
            updateSearch()
        }
    }

    filterName.onEvent('change', onFilterChange)
    filterAuthor.onEvent('change', onFilterChange)
    filterCopyright.onEvent('change', onFilterChange)
    filterContent.onEvent('change', onFilterChange)

    resultsBox.onEvent('select', event => {
        if (event.fromUser) {
            if (editor.hasChanges) {
                layout.dialog.showQuestion(
                    {
                        title: 'Save Song?',
                        message:
                            'You have made changes to the song "' +
                            editor.data.name +
                            '" which have not been saved!',
                        detail:
                            'The changes will be lost unless you save them.',

                        options: ['Save', 'Discard', 'Cancel']
                    },
                    (error, answer) => {
                        if (answer === 'Cancel') {
                            resultsBox.select(event.oldText)

                            return false
                        }

                        if (answer === 'Save') {
                            editor.apply()
                        }

                        loadSong(event.text[2], event.text[3])
                    }
                )
            } else {
                loadSong(event.text[2], event.text[3])
            }
        }
    })
}

//Save & Remove
{
    //This causes the 'output' event to happen, and the handler for that should call the save function
    saveButton.onEvent('click', editor.apply)

    duplicateButton.onEvent('click', () => {
        let newSong = editor.util.copyObj(editor.data)

        if (!Songs.validGroup(newSong.group)) {
            newSong.group = 'S'
        }

        newSong.groupID = Songs.getUniqueID(newSong.group)

        Songs.save(
            newSong.group,
            newSong.groupID,
            removeSearchData(newSong),
            error => {
                if (error) {
                    layout.dialog.showNotification({
                        type: 'error',
                        message:
                            'Unable to duplicate!\n' + error.message ||
                            error.toString()
                    })

                    logger.error('Unable to duplicate song: ' + error)

                    return false
                }

                layout.dialog.showNotification({
                    type: 'success',
                    message:
                        'Duplicated song with ID ' +
                        newSong.group +
                        '-' +
                        newSong.groupID.toString()
                })
            }
        )
    })

    removeButton.onEvent('click', () => {
        layout.dialog.showQuestion(
            {
                title: 'Remove song?',

                message:
                    'Are you sure you want to remove the song "' +
                    editor.data.name +
                    '"?',
                detail: 'This cannot be undone!',

                options: ['Remove', 'Cancel']
            },
            (error, answer) => {
                if (answer === 'Remove') {
                    remove()
                }
            }
        )
    })

    removeAllButton.onEvent('click', () => {
        layout.dialog.showQuestion(
            {
                title: 'Remove all songs?',

                message: 'Are you sure you want to remove all songs?',
                detail: 'This action cannot be undone!',

                options: ['Remove', 'Cancel']
            },
            (error, answer) => {
                if (answer === 'Remove') {
                    layout.showLoader(layout.body, 'Removing songs')

                    Songs.removeAll(() => {
                        layout.hideLoader(layout.body)
                    })
                }
            }
        )
    })
}

//song property (name, author, copyright) editing
{
    nameBox.onEvent('change', event => {
        if (event.fromUser) {
            editor.change('name', event.value)
        }
    })
    authorBox.onEvent('change', event => {
        if (event.fromUser) {
            editor.change('author', event.value)
        }
    })
    copyrightBox.onEvent('change', event => {
        if (event.fromUser) {
            editor.change('copyright', event.value)
        }
    })
}

//playorder editing
{
    let onPlayOrderChange = event => {
        if (event.fromUser) {
            editor.change('playOrder', playOrderEditor.asArray())
        }
    }

    playOrderEditor.onEvent('add', onPlayOrderChange)
    playOrderEditor.onEvent('reorder', onPlayOrderChange)
    playOrderEditor.onEvent('remove', onPlayOrderChange)
}

//section editing
{
    playOrderEditor.onEvent('select', event => {
        if (!event.fromUser) {
            return false
        }

        selectSection(event.text)
        //The selectSection function will change the selection to the first index of the given section
        //If a section appears multiple times, this may cause the incorrect section to be highlighted
        //(this only applies to the playOrder editor, as it can have multiple of the same section. The section editor only has one entry per section)
        playOrderEditor.select(event.index)
    })
    sectionsEditor.onEvent('select', event => {
        if (!event.fromUser) {
            return false
        }

        selectSection(event.text)
    })

    textEditor.onEvent('change', event => {
        if (
            !event.fromUser ||
            typeof event.text !== 'string' ||
            typeof editor.data.sections[currentSection] !== 'object'
        ) {
            return false
        }

        let fullChange = {}

        if (typeof event.text === 'string') {
            fullChange.text = event.text
            fullChange.plainText =
                event.plainText || richText.removeFormat(event.text)
        } else if (typeof event.plainText === 'string') {
            fullChange.text = richText.format(event.plainText)
            fullChange.plainText = event.plainText
        } else {
            return false
        }

        editor.change('sections', currentSection, fullChange)
    })

    playTimeEditor.onEvent('change', event => {
        if (
            !event.fromUser ||
            typeof event.playTime !== 'number' ||
            typeof editor.data.sections[currentSection] !== 'object'
        ) {
            return false
        }

        editor.change('sections', currentSection, 'playTime', event.playTime)
    })

    //Sections renaming, adding & removing...
    sectionsEditor.onEvent('enter', event => {
        if (event.oldText === event.text) {
            return false
        }

        let newName = makeSectionNameUnique(event.text)

        if (
            newName !== event.oldText &&
            editor.isDefined('sections', event.oldText)
        ) {
            let fullChange = { sections: {} }
            fullChange.sections[newName] = editor.data.sections[event.oldText]
            fullChange.sections[event.oldText] = undefined

            fullChange.playOrder = playOrderEditor.asArray().map(section => {
                if (section === event.oldText) {
                    return newName
                }
                return section
            })

            editor.change(fullChange)

            updateSectionsList()
            sectionsEditor.select(newName, false, true)

            playOrderEditor.change(event.oldText, newName)
        }
    })

    sectionsEditor.onEvent('add', event => {
        if (!event.fromUser) {
            return false
        }

        let name = makeSectionNameUnique(event.text)

        editor.change('sections', name, {
            text: event.text,
            plainText: richText.removeFormat(event.text),

            playTime: 0
        })

        updateSectionsList()
        sectionsEditor.select(name)
    })

    sectionsEditor.onEvent('remove', event => {
        if (!event.fromUser) {
            return false
        }

        editor.change('sections', event.text, undefined)

        if (currentSection === event.text) {
            currentSection = ''
            textEditor.text = ''

            playTimeEditor.set({ playTime: 0 })
        }

        sectionsEditor.select(0)
    })
}

//Whenever the song database is updating, the loading indicator should be shown
//(Including on page load)
Songs.onEvent('update-start', () => {
    layout.showLoader(resultsBox)
})
layout.showLoader(resultsBox)
Songs.onEvent('update', changed => {
    layout.hideLoader(resultsBox)

    if (Array.isArray(changed) && editor.data.group) {
        let activeSongChanged = false

        for (let i = 0; i < changed.length; i++) {
            if (
                changed[i].group === editor.data.group &&
                changed[i].ID === editor.data.groupID
            ) {
                activeSongChanged = true

                break
            }
        }

        if (activeSongChanged) {
            layout.dialog.showQuestion(
                {
                    title: 'Reload Song?',

                    message:
                        'The song you currently have selected has been changed!\nIf you do not reload, the song you see might be different to what is saved in the library.',
                    detail: editor.hasChanges
                        ? 'If you do reload, any changes you have made will be lost!'
                        : '',

                    options: ['Reload', 'Cancel']
                },
                (error, answer) => {
                    if (answer === 'Reload') {
                        loadSong(editor.data.group, editor.data.groupID, true)
                    }
                }
            )
        }
    }

    showSearchResults()
})

Songs.onEvent('error', error => {
    layout.dialog.showNotification({
        type: 'error',
        autoHide: false,

        message: 'There is an error with the Song database!\n' + error.message
    })
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

//If undo/redo happens, etc
editor.onEvent('change', (from, changes) => {
    if (from === 'undo' || from === 'redo') {
        onSongChange(changes)
    }

    //The save button should only be enabled if there are changes
    saveButton.disabled = !editor.hasChanges
})

//When editor.apply() is callled
editor.onEvent('output', () => {
    save()
})

resetSong()

layout.window.onEvent('close', event => {
    if (editor.hasChanges) {
        event.wait()

        layout.dialog.showQuestion(
            {
                title: 'Save Song?',
                message:
                    'You have made changes to the song "' +
                    editor.data.name +
                    '" which have not been saved!',
                detail: 'The changes will be lost unless you save them.',

                options: ['Save', 'Discard', 'Cancel']
            },
            (error, answer) => {
                if (answer === 'Save') {
                    save(() => {
                        event.close()
                    })
                } else if (answer === 'Cancel') {
                    event.cancel()

                    return
                } else {
                    event.close()
                }
            }
        )
    }
})

function showSong(songGroup, songID) {
    if (editor.hasChanges) {
        layout.dialog.showQuestion(
            {
                title: 'Save Song?',
                message:
                    'You have made changes to the song "' +
                    editor.data.name +
                    '" which have not been saved!',
                detail: 'The changes will be lost unless you save them.',

                options: ['Save', 'Discard', 'Cancel']
            },
            (error, answer) => {
                if (answer === 'Cancel') {
                    return false
                }

                if (answer === 'Save') {
                    editor.apply()
                }

                loadSong(songGroup, songID)
            }
        )
    } else {
        loadSong(songGroup, songID)
    }
}

ipcRenderer.on('show-song', (event, songGroup, songID) => {
    if (typeof songGroup !== 'string' || typeof songID !== 'number') {
        return false
    }

    if (Songs.updating) {
        Songs.onceEvent('update', () => {
            showSong(songGroup, songID)
        })
    } else {
        showSong(songGroup, songID)
    }
})
