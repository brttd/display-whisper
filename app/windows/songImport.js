const layout = require('dw-layout')
const Database = require('dw-database')
const richText = require('dw-rich-text')

const fs = require('fs')
const path = require('path')

const Songs = new Database.Group('songs', {
    load: false
})

const overwite = new layout.CheckboxInput(
    {
        label: 'Replace existing'
    },
    {}
)
const addUnique = new layout.CheckboxInput(
    {
        label: 'Add as new',

        value: true
    },
    {}
)
const defaultGroupInput = new layout.TextInput(
    { value: 'S', maxLength: 3 },
    { align: 'center' }
)
const fileSelect = new layout.FileInput(
    {
        open: true,

        text: 'Select File',
        button: 'Select File'
    },
    {
        margin: '4px'
    }
)
const fileOutput = new layout.Text(
    { text: '' },
    {
        margin: '4px'
    }
)
fileOutput.visible = false

const importOutput = new layout.Text(
    {
        text: ''
    },
    {
        margin: '4px'
    }
)
importOutput.visible = false

const importButton = new layout.Button(
    {
        text: 'Import',
        disabled: true
    },
    {
        margin: '4px'
    }
)
const closeButton = new layout.Button(
    {
        text: 'Cancel',
        onClick: () => layout.window.close()
    },
    {
        margin: '4px'
    }
)

layout.change(layout.body, {
    direction: 'vertical'
})
layout.body.add(
    new layout.Block(
        {
            items: [
                fileSelect,
                fileOutput,
                new layout.Text(
                    {
                        text: 'New songs which are already in library:'
                    },
                    {
                        margin: '4px'
                    }
                ),
                new layout.Block(
                    {
                        items: [overwite, addUnique]
                    },
                    {
                        direction: 'vertical',

                        grow: 0,
                        shrink: 0,

                        margin: '4px'
                    }
                ),
                new layout.Block(
                    {
                        items: [
                            new layout.Text(
                                {
                                    text: 'Default Group: '
                                },
                                {
                                    align: 'center'
                                }
                            ),
                            defaultGroupInput
                        ]
                    },
                    {
                        direction: 'horizontal',

                        grow: 0,
                        shrink: 0,

                        margin: '4px'
                    }
                )
            ]
        },
        {
            direction: 'vertical',

            overflow: 'auto',

            padding: '8px'
        }
    )
)
layout.body.add(
    new layout.Block(
        {
            items: [
                importOutput,
                new layout.Block(
                    {
                        items: [closeButton, importButton]
                    },
                    {
                        direction: 'horizontal',

                        grow: 0,
                        shrink: 0,

                        align: 'end'
                    }
                )
            ]
        },
        {
            direction: 'vertical',
            grow: 0,
            shrink: 0,

            borderTop: true,

            padding: '8px'
        }
    )
)

let defaultGroup = 'S'
let fileSongList = []

function getSongFromData(data) {
    let song = {
        name: '',
        author: '',
        copyright: '',

        sections: {},
        playOrder: []
    }

    let validDataCount = 0

    if (typeof data.name === 'string') {
        song.name = data.name

        validDataCount += 1
    }
    if (typeof data.author === 'string') {
        song.author = data.author

        validDataCount += 1
    }
    if (typeof data.copyright === 'string') {
        song.copyright = data.copyright

        validDataCount += 1
    }

    if (Array.isArray(data.sections)) {
        for (let i = 0; i < data.sections.length; i++) {
            let sectionData = data.sections[i]

            if (
                typeof sectionData === 'object' &&
                sectionData !== null &&
                !Array.isArray(sectionData)
            ) {
                song.sections[section] = {
                    name: section,

                    text: '',
                    plainText: '',

                    playTime: 0
                }

                if (typeof sectionData.text === 'string') {
                    song.sections[section].text = sectionData.text.trim()
                } else if (typeof sectionData.plainText === 'string') {
                    song.sections[section].text = richText.format(
                        sectionData.plainText.trim()
                    )
                }

                if (typeof sectionData.plainText === 'string') {
                    song.sections[
                        section
                    ].plainText = sectionData.plainText.trim()
                } else if (typeof sectionData.text === 'string') {
                    song.sections[section].plainText = richText.removeFormat(
                        sectionData.text.trim()
                    )
                }

                if (
                    typeof sectionData.playTime === 'number' &&
                    sectionData.playTime > 0 &&
                    isFinite(sectionData.playTime)
                ) {
                    song.sections[section].playTime = sectionData.playTime
                }

                validDataCount += 1
            } else if (typeof sectionData === 'string') {
                song.sections[section] = {
                    name: section,

                    text: richText.format(sectionData.trim()),
                    plainText: sectionData.trim(),

                    playTime: 0
                }

                validDataCount += 1
            }
        }
    } else if (typeof data.sections === 'object' && data.sections !== null) {
        for (let section in data.sections) {
            let sectionData = data.sections[section]

            if (
                typeof sectionData === 'object' &&
                sectionData !== null &&
                !Array.isArray(sectionData)
            ) {
                song.sections[section] = {
                    name: section,

                    text: '',
                    plainText: '',

                    playTime: 0
                }

                if (typeof sectionData.text === 'string') {
                    song.sections[section].text = sectionData.text.trim()
                } else if (typeof sectionData.plainText === 'string') {
                    song.sections[section].text = richText.format(
                        sectionData.plainText.trim()
                    )
                }

                if (typeof sectionData.plainText === 'string') {
                    song.sections[
                        section
                    ].plainText = sectionData.plainText.trim()
                } else if (typeof sectionData.text === 'string') {
                    song.sections[section].plainText = richText.removeFormat(
                        sectionData.text.trim()
                    )
                }

                if (
                    typeof sectionData.playTime === 'number' &&
                    sectionData.playTime > 0 &&
                    isFinite(sectionData.playTime)
                ) {
                    song.sections[section].playTime = sectionData.playTime
                }

                validDataCount += 1
            } else if (typeof sectionData === 'string') {
                song.sections[section] = {
                    name: section,

                    text: richText.format(sectionData.trim()),
                    plainText: sectionData.trim(),

                    playTime: 0
                }

                validDataCount += 1
            }
        }
    }

    //If playOrder is spelt with lower-case, use it
    if (Array.isArray(data.playorder)) {
        data.playOrder = data.playorder
    }

    if (Array.isArray(data.playOrder)) {
        let validSections = Object.keys(song.sections)

        for (let i = 0; i < data.playOrder.length; i++) {
            if (validSections.includes(data.playOrder[i])) {
                song.playOrder.push(data.playOrder[i])
            }
        }

        if (song.playOrder.length > 0) {
            validDataCount += 1
        }
    }

    if (validDataCount >= 2) {
        return song
    } else {
        return false
    }
}

function addID(song, data) {
    if (typeof data.group === 'string') {
        let parts = data.group.split('-')

        if (parts[0].length > 0) {
            song.group = parts[0]
        }

        if (parts.length === 2) {
            if (addUnique.value !== true) {
                song.groupID = parseInt(parts[1])

                if (Songs.validID(song.group, song.groupID)) {
                    return
                }
            }
        } else if (typeof data.groupID === 'number') {
            if (Songs.validID(song.group, data.groupID)) {
                song.groupID = data.groupID

                if (addUnique.value !== true) {
                    return
                }
            }
        }
    } else if (typeof data.ID === 'string') {
        let parts = data.ID.split('-')

        if (parts[0].length > 0) {
            song.group = parts[0]
        }

        if (parts.length === 2) {
            if (addUnique.value !== true) {
                song.groupID = parseInt(parts[1])

                if (Songs.validID(song.group, song.groupID)) {
                    return
                }
            }
        }
    } else {
        song.group = defaultGroup
    }

    song.groupID = Songs.getUniqueID(song.group)
}

function loadFile(content, callback) {
    fileOutput.visible = true

    fileSongList = []

    importButton.disabled = true

    let data

    try {
        data = JSON.parse(content)
    } catch (error) {
        fileOutput.text += '\nFile not in correct format.'
        return false
    }

    if (Array.isArray(data)) {
        if (data.length === 0) {
            callback(null, [], 0)

            fileOutput.text += '\nNo songs in file.'

            return false
        }

        let invalidCount = 0

        for (let i = 0; i < data.length; i++) {
            let song = getSongFromData(data[i])

            if (song) {
                fileSongList.push({
                    song: song,
                    data: data[i]
                })
            } else {
                invalidCount += 1
            }
        }

        if (fileSongList.length === 0) {
            fileOutput.text += '\nNo valid data in file.'
        } else {
            fileOutput.text +=
                '\n' +
                fileSongList.length.toString() +
                ' song' +
                (fileSongList.length > 1 ? 's' : '') +
                ' in file.'

            importButton.disabled = false

            if (invalidCount > 0) {
                fileOutput.text +=
                    '\n' +
                    invalidCount.toString() +
                    ' invalid data entr'(invalidCount > 1 ? 'ies' : 'y') +
                    ' in file.'
            }
        }

        return
    } else if (typeof data === 'object' && data !== null) {
        let song = getSongFromData(data)

        if (song) {
            fileSongList = [
                {
                    song: song,
                    data: data
                }
            ]

            fileOutput.text += '\n1 song in file.'

            importButton.disabled = false

            return
        }
    }

    fileOutput.text += '\nNo valid data in file.'
}

function importSongs() {
    if (fileSongList.length === 0) {
        return false
    }

    importButton.disabled = true
    closeButton.disabled = true
    fileSelect.disabled = true

    layout.showLoader(layout.body, 'Importing')

    let errors = []
    let addedSongs = []

    let addNext = () => {
        if (fileSongList.length === 0) {
            if (addedSongs.length === 0) {
                importOutput.text = 'Imported no songs.'
            } else if (addedSongs.length === 1) {
                importOutput.text = 'Imported "' + addedSongs[0] + '".'
            } else if (addedSongs.length < 5) {
                let lastSong = addedSongs.pop()

                importOutput.text =
                    'Imported ' +
                    addedSongs.map(song => '"' + song + '"').join(', ') +
                    ', and "' +
                    lastSong +
                    '".'
            } else {
                importOutput.text =
                    'Imported ' + addedSongs.length.toString() + ' songs.'
            }

            if (errors) {
                if (errors.length === 1) {
                    fileOutput.text +=
                        'There was an error while importing:\n' + errors[0]
                } else if (errors.length > 1) {
                    fileOutput.text +=
                        '\nThere were ' +
                        errors.length.toString() +
                        ' errors while importing:'

                    for (let i = 0; i < errors.length; i++) {
                        fileOutput.text += '\n' + errors[i]
                    }
                }
            }

            importOutput.visible = true

            fileOutput.visible = false

            layout.hideLoader(layout.body)

            closeButton.disabled = false
            fileSelect.disabled = false

            return
        }

        let song = fileSongList.pop()

        addID(song.song, song.data)

        song = song.song

        Songs.save(song.group, song.groupID, song, error => {
            if (error) {
                errors.push(error)
            } else {
                addedSongs.push(song.name)
            }

            addNext()
        })
    }

    addNext()
}

fileSelect.onEvent('open', event => {
    fileOutput.text = path.basename(event.filename)

    loadFile(event.content)
})

layout.body.onEvent('file-drop', event => {
    if (event.files.length === 0) {
        return false
    }

    layout.showLoader(layout.body, 'Loading')

    if (event.files.length > 1) {
        layout.dialog.showNotification({
            type: 'warning',
            message: 'Please select one file to load!'
        })
    }

    if (event.files.length >= 1) {
        fileOutput.text = path.basename(event.files[0].path)

        fs.readFile(event.files[0].path, 'utf8', (error, content) => {
            layout.hideLoader(layout.body)
            if (error) {
                fileOutput.text += '\nUnable to load file.'
            } else {
                loadFile(content)
            }
        })

        return
    }
})

importButton.onEvent('click', importSongs)

overwite.onEvent('change', event => {
    if (event.fromUser) {
        addUnique.value = !overwite.value
    }
})
addUnique.onEvent('change', event => {
    if (event.fromUser) {
        overwite.value = !addUnique.value
    }
})

defaultGroupInput.onEvent('change', event => {
    if (event.value.trim() !== '') {
        defaultGroup = event.value.trim()
    } else {
        defaultGroup = 'S'
    }
})

Songs.onEvent('error', error => {
    layout.dialog.showNotification({
        type: 'error',
        autoHide: false,

        message: 'There is an error with the Song database!\n' + error.message
    })
})
