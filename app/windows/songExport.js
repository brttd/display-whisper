const layout = require('dw-layout')

const logger = require('dw-log')
const Database = require('dw-database')

const Songs = new Database.Group('songs', {
    load: true,
    parse: true
})

const closeButton = new layout.Button(
    {
        text: 'Close',

        onClick: () => layout.window.close()
    },
    {
        margin: 4
    }
)
const fileSelect = new layout.FileInput(
    {
        save: true,

        text: 'Export',
        button: 'Export',

        disabled: true,

        filters: [
            {
                name: 'JSON',
                extensions: ['json']
            }
        ]
    },
    {
        margin: 4
    }
)
const output = new layout.Text(
    {
        text: 'Loading Songs...'
    },
    {
        margin: 4,
        align: 'center'
    }
)

layout.change(layout.body, {
    direction: 'vertical',
    padding: 8,

    justify: 'space-between'
})

layout.body.add(output)
layout.body.add(
    new layout.Block(
        {
            items: [closeButton, fileSelect]
        },
        {
            direction: 'horizontal',
            grow: false,
            shrink: false,

            align: 'end'
        }
    )
)

function save(filename) {
    let data = ''

    try {
        data = JSON.stringify(Songs.list)
    } catch (error) {
        output.text =
            'Could not export songs: ' + (error.message || error.toString())

        logger.error('Unable to stringify songs', error)

        closeButton.disabled = false
        fileSelect.disabled = false

        return false
    }

    require('fs').writeFile(filename, data, 'utf8', error => {
        closeButton.disabled = false
        fileSelect.disabled = false

        if (error) {
            output.text =
                'Error exporting songs: ' + (error.message || error.toString())

            logger.error('Unable to export songs', error)

            return false
        }

        if (process.platform === 'darwin') {
            layout.window.close()
        } else {
            output.text = 'Exported'
        }
    })
}

fileSelect.onEvent('save', event => {
    if (event.filename) {
        closeButton.disabled = true
        fileSelect.disabled = true

        output.text = 'Exporting...'

        if (Songs.updating) {
            Songs.onceEvent('update', () => {
                save(event.filename)
            })
        } else {
            save(event.filename)
        }
    } else {
        layout.showNotification({
            type: 'error',

            message: 'No file selected!'
        })
    }
})

Songs.onEvent('update', () => {
    if (Songs.files.length > 0) {
        fileSelect.disabled = false

        output.text =
            Songs.files.length.toString() +
            ' song' +
            (Songs.files.length > 1 ? 's' : '') +
            ' in library'
    } else {
        fileSelect.disabled = true
        output.text = 'No songs in library'
    }
})

Songs.onEvent('error', error => {
    layout.dialog.showNotification({
        type: 'error',
        autoHide: false,

        message: 'There is an error with the Song database!\n' + error.message
    })
})
