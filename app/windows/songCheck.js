const { shell } = require('electron')
const path = require('path')
const fs = require('fs')

const layout = require('dw-layout')
const logger = require('dw-log')
const Database = require('dw-database')

const Songs = new Database.Group('songs', {
    load: true,
    parse: true,

    transform: data => {
        data._missing = []
        data._problems = []

        if (typeof data.name !== 'string') {
            data._missing.push('name')
        } else if (data.name.trim() === '') {
            data._problems.push('Name empty')
        }
        if (typeof data.author !== 'string') {
            data._missing.push('author')
        } else if (data.author.trim() === '') {
            data._problems.push('Author empty')
        }
        if (typeof data.copyright !== 'string') {
            data._missing.push('copyright')
        } else if (data.copyright.trim() === '') {
            data._problems.push('Copyright empty')
        }

        if (!Array.isArray(data.playOrder)) {
            data._missing.push('play order')
        } else if (data.playOrder.length === 0) {
            data._problems.push('Play order empty')
        } else if (
            typeof data.sections === 'object' &&
            !Array.isArray(data.sections) &&
            data.sections !== null
        ) {
            let missing = []

            for (let i = 0; i < data.playOrder.length; i++) {
                if (!data.sections.hasOwnProperty(data.playOrder[i])) {
                    missing.push(data.playOrder[i])
                }
            }

            if (missing.length > 0) {
                data._problems.push(
                    'Play order includes ' +
                        missing.length.toString() +
                        ' missing sections'
                )
            }
        }

        if (
            typeof data.sections !== 'object' ||
            Array.isArray(data.sections) ||
            data.sections === null
        ) {
            data._missing.push('sections')
        } else if (Object.keys(data.sections).length === 0) {
            data._problems.push('No sections')
        }

        if (typeof data.group !== 'string') {
            data._missing.push('group')
        }
        if (typeof data.groupID !== 'number') {
            data._missing.push('group ID')
        }

        return data
    }
})

const showImportantButton = new layout.Button({
    text: 'Important'
})
const showAllButton = new layout.Button({
    text: 'All'
})
const showFileButton = new layout.Button({
    text: 'Invalid Files'
})

const infoText = new layout.Text({}, { align: 'center' })

const songList = new layout.TableList(
    {
        columns: 4,
        columnWidths: ['13ch', '100%', '3ch', '5ch']
    },
    {
        margin: 4,

        border: true
    }
)

const fixMissingButton = new layout.Button({
    text: 'Fix Missing'
})

layout.change(layout.body, {
    direction: 'vertical',

    padding: 4
})

layout.body.add(
    new layout.Block(
        {
            childSpacing: 8,
            items: [
                showImportantButton,
                showAllButton,
                new layout.Text({ text: '│' }, { align: 'center' }),
                showFileButton,
                new layout.Text({ text: '│' }, { align: 'center' }),
                infoText
            ]
        },
        {
            direction: 'horizontal',
            padding: 0,

            shrink: false,
            grow: false
        }
    )
)
layout.body.add(songList)
layout.body.add(
    new layout.Block(
        {
            childSpacing: 8,
            items: [fixMissingButton]
        },
        {
            direction: 'horizontal',
            shrink: false,
            grow: false,

            padding: 0
        }
    )
)

const filters = {
    important: song => song._missing.length > 0,
    all: song => song._missing.length > 0 || song._problems.length > 0
}

const errorFiles = []

let searchFilter = filters.important

function updateList() {
    let errorSongs = Songs.list
        .filter(searchFilter)
        .sort((a, b) => a._ID - b._ID)

    songList.clear()

    for (let i = 0; i < errorSongs.length; i++) {
        if (errorSongs[i]._missing.length > 0) {
            songList.add([
                errorSongs[i]._filename,
                'Missing ' +
                    errorSongs[i]._missing.join(', ') +
                    (errorSongs[i]._problems.length > 0
                        ? '. Problems: ' +
                          errorSongs[i]._problems.join(', ') +
                          '.'
                        : '.'),
                errorSongs[i]._group,
                errorSongs[i]._ID
            ])
        } else {
            songList.add([
                errorSongs[i]._filename,
                'Problems: ' + errorSongs[i]._problems.join(', ') + '.',
                errorSongs[i]._group,
                errorSongs[i]._ID
            ])
        }
    }

    infoText.text =
        errorSongs.length.toString() +
        ' song' +
        (errorSongs.length === 1 ? '.' : 's.') +
        (errorSongs.length > 0 ? ' Click to edit' : '')
}

function showErrorList() {
    songList.clear()

    for (let i = 0; i < errorFiles.length; i++) {
        songList.add([
            errorFiles[i].filename,
            '(' + errorFiles[i].type + ') ' + errorFiles[i].error.message,
            errorFiles[i].group,
            errorFiles[i].ID
        ])
    }

    infoText.text =
        errorFiles.length.toString() +
        ' file' +
        (errorFiles.length === 1 ? '.' : 's.') +
        (errorFiles.length > 0 ? ' Click to resolve.' : '')
}

songList.onEvent('select', event => {
    if (showFileButton.active) {
        layout.dialog.showQuestion(
            {
                title: 'Resolve',
                message: 'Do you want to',
                options: ['Open', 'Delete', 'Cancel']
            },
            (error, choice) => {
                if (error) {
                    return false
                }

                if (choice === 'Open') {
                    let opened = shell.openItem(
                        path.join(Songs.directory, event.text[0])
                    )

                    if (!opened) {
                        layout.dialog.showNotification({
                            type: 'error',
                            message: "Couldn't open file!"
                        })
                    }
                } else if (choice === 'Delete') {
                    fs.unlink(
                        path.join(Songs.directory, event.text[0]),
                        error => {
                            let index = errorFiles.indexOf(
                                file => file.filename === event.text[0]
                            )

                            if (index !== -1) {
                                errorFiles.splice(index, 1)

                                showErrorList()
                            }

                            if (error) {
                                layout.dialog.showNotification({
                                    type: 'error',
                                    message:
                                        "Couldn't delete file!\n" +
                                        error.toString()
                                })

                                logger.error(
                                    "Couldn't delete invalid song library file (" +
                                        event.text[0] +
                                        '):',
                                    error
                                )
                            }
                        }
                    )
                }
            }
        )

        return
    }

    layout.window.openWindow('songDatabase', [
        'show-song',
        event.text[2],
        parseInt(event.text[3])
    ])
})

showImportantButton.onEvent('click', () => {
    showImportantButton.active = true
    showAllButton.active = false
    showFileButton.active = false

    searchFilter = filters.important

    updateList()
})
showAllButton.onEvent('click', () => {
    showImportantButton.active = false
    showAllButton.active = true
    showFileButton.active = false

    searchFilter = filters.all

    updateList()
})
showFileButton.onEvent('click', () => {
    showImportantButton.active = false
    showAllButton.active = false
    showFileButton.active = true

    showErrorList()
})

fixMissingButton.onEvent('click', () => {
    let missingList = Songs.list.filter(song => song._missing.length > 0)

    if (missingList.length === 0) {
        return
    }

    layout.showLoader(layout.body, 'Fixing')

    let fixNext = () => {
        if (missingList.length === 0) {
            layout.hideLoader(layout.body)

            return
        }

        let song = missingList.pop()

        delete song._missing
        delete song._problems

        if (typeof song.name !== 'string') {
            song.name = ''
        }
        if (typeof song.author !== 'string') {
            song.author = ''
        }
        if (typeof song.copyright !== 'string') {
            song.copyright = ''
        }

        if (!Array.isArray(song.playOrder)) {
            song.playOrder = []
        }

        if (
            typeof song.sections !== 'object' ||
            Array.isArray(song.sections) ||
            song.sections === null
        ) {
            song.sections = {}
        }

        if (typeof song.group !== 'string') {
            song.group = song._group
        }
        if (typeof song.groupID !== 'number') {
            song.groupID = song._ID
        }

        Songs.save(song._group, song._ID, song, fixNext)
    }

    fixNext()
})

Songs.onEvent('update', () => {
    updateList()

    fixMissingButton.disabled = !Songs.list.find(
        song => song._missing.length > 0
    )
})

Songs.onEvent('file-error', (error, file) => {
    let index = errorFiles.findIndex(errorFile => {
        return errorFile.filename === file.filename
    })

    if (index === -1) {
        file.error = error
        errorFiles[index].type = 'file'
        errorFiles.push(file)
    } else {
        errorFiles[index].type = 'file'
        errorFiles[index].error = error
    }
})
Songs.onEvent('transform-error', (error, file) => {
    let index = errorFiles.findIndex(errorFile => {
        return errorFile.filename === file.filename
    })

    if (index === -1) {
        file.error = error
        errorFiles[index].type = 'transform'
        errorFiles.push(file)
    } else {
        errorFiles[index].type = 'transform'
        errorFiles[index].error = error
    }
})

Songs.onEvent('error', error => {
    layout.dialog.showNotification({
        type: 'error',
        autoHide: false,

        message: 'There is an error with the Song database!\n' + error.message
    })
})

showImportantButton.active = true
