const { ipcRenderer } = require('electron')

const layout = require('dw-layout')

const logger = require('dw-log')

const settingsFile = require('path').join(__dirname, '..', 'settings.json')

let entryInputs = {}

let activeContextMenuKey = null

layout.contextMenu.add('reset-single', [
    {
        label: 'Reset this',
        value: 'reset'
    }
])
layout.contextMenu.add(
    'reset-all',
    [
        {
            label: 'Reset All',
            value: 'reset'
        }
    ],
    true
)

function checkKeyWarning() {
    for (let aKey in entryInputs) {
        if (entryInputs[aKey].type === 'key') {
            let overlaps = []

            for (let bKey in entryInputs) {
                if (
                    entryInputs[bKey].type === 'key' &&
                    aKey !== bKey &&
                    entryInputs[aKey].input.value ===
                        entryInputs[bKey].input.value
                ) {
                    overlaps.push(bKey)
                }
            }

            if (overlaps.length === 0) {
                entryInputs[aKey].warning.visible = false
            } else {
                let text = 'Warning: '
                if (overlaps.length === 1) {
                    text += "'" + entryInputs[overlaps[0]].description + "' has"
                } else if (overlaps.length === 2) {
                    text +=
                        "'" +
                        entryInputs[overlaps[0]].description +
                        "' and '" +
                        entryInputs[overlaps[1]].description +
                        "' have"
                } else {
                    text +=
                        "'" +
                        entryInputs[overlaps[0]].description +
                        "' and " +
                        (overlaps.length - 1).toString() +
                        ' other actions have'
                }

                text += ' the same shortcut!'
                entryInputs[aKey].warning.text = text

                entryInputs[aKey].warning.visible = true
            }
        }
    }
}

function onSettingChange(event) {
    if (!event.fromUser) {
        return false
    }

    if (
        entryInputs[entryInputs[event.from.key]] &&
        entryInputs[entryInputs[event.from.key]].type === 'key'
    ) {
        checkKeyWarning()
    }

    ipcRenderer.send('set-setting', event.from.key, event.value)
}
ipcRenderer.on('setting', (event, key, value) => {
    if (entryInputs.hasOwnProperty(key)) {
        entryInputs[key].input.value = value

        if (entryInputs[key].type === 'key') {
            checkKeyWarning()
        }
    }
})

function getEntryBlock(key, data) {
    let input = false

    data.tooltip = data.description

    switch (data.type) {
        case 'boolean':
            data.label = 'Enabled'
            input = new layout.CheckboxInput(data)
            break
        case 'number':
            input = new layout.NumberInput(data)
            break
        case 'color':
            input = new layout.ColorInput(data)
            break
        case 'select':
            input = new layout.SelectInput(data)

            let maxChars = 5

            for (let i = 0; i < data.options.length; i++) {
                maxChars = Math.max(maxChars, data.options[i].length)
            }

            maxChars /= 1.8

            layout.change(input, {
                width: maxChars + 'em'
            })
            break
        case 'font':
            input = new layout.FontInput(data)
            break
        case 'key':
            data.text = data.description
            input = new layout.KeyInput(data)
    }

    let warningElement = null
    if (data.type === 'key') {
        warningElement = new layout.Text(
            {
                text: 'Warning: key'
            },
            {
                maxWidth: '70ch',

                margin: 4,
                padding: 2,
                paddingLeft: 6,
                paddingRight: 6,

                background: 'hsl(0, 60%, 75%)'
            }
        )
    }

    let block = new layout.Block(
        {
            items: [
                new layout.Text({ text: data.description }),
                new layout.Filler(),
                warningElement,
                input
            ],
            childSpacing: 6
        },
        {
            direction: 'horizontal',
            grow: false,
            shrink: false,

            borderTop: true
        }
    )

    if (!input) {
        let text = 'Invalid type!'
        if (typeof data.type === 'string') {
            text += ' (' + data.type + ')'
        }

        input = new layout.Button({
            text: text
        })

        logger.error('Error: invalid type for entry:', data.type)
    }

    input.key = key

    entryInputs[key] = {
        input: input,
        type: data.type,
        description: data.description,
        warning: warningElement
    }

    input.onEvent('change', onSettingChange)

    if (typeof data.default !== 'undefined') {
        ipcRenderer.send('get-setting', key, data.default)

        block.onEvent('contextmenu', () => {
            activeContextMenuKey = key

            layout.contextMenu.enable('reset-single')
        })

        function reset() {
            input.value = data.default

            onSettingChange({
                fromUser: true,
                from: { key: key },
                value: data.default
            })
        }

        layout.contextMenu.onEvent('reset-single', event => {
            if (activeContextMenuKey === key) {
                if (event.value === 'reset') {
                    reset()
                }
            }
        })
        layout.contextMenu.onEvent('reset-all', event => {
            if (event.value === 'reset') {
                reset()
            }
        })
    } else {
        ipcRenderer.send('get-setting', key)
    }

    return block
}

function getSectionBlock(key, data) {
    if (typeof data !== 'object') {
        return false
    }

    let block = new layout.Block(
        {},
        {
            direction: 'vertical',
            align: 'stretch',
            grow: false,
            shrink: false,

            maxWidth: '100ch',

            marginTop: 8,
            marginLeft: 16
        }
    )

    for (let entry in data.entries) {
        block.add(getEntryBlock(key + '.' + entry, data.entries[entry]))
    }

    return new layout.Block(
        {
            items: [
                data.description
                    ? new layout.Text({ text: data.description })
                    : false,
                block
            ],
            childSpacing: 16
        },
        {
            direction: 'vertical',
            grow: false,
            shrink: false,

            borderBottom: true
        }
    )
}

function displaySettings(data) {
    let tabs = []

    for (let section in data) {
        if (Object.keys(data[section]).length > 0) {
            let name = data[section].name ? data[section].name : section

            let currentTab = {
                name: name,
                content: new layout.Block(
                    {},
                    {
                        direction: 'vertical',
                        overflowY: 'auto'
                    }
                )
            }

            for (let subSection in data[section]) {
                currentTab.content.add(
                    getSectionBlock(
                        typeof data[section][subSection].map === 'string'
                            ? data[section][subSection].map
                            : section + '.' + subSection,
                        data[section][subSection]
                    )
                )
            }

            layout.change(
                currentTab.content.items[currentTab.content.items.length - 1],
                {
                    borderBottom: false
                }
            )

            tabs.push(currentTab)
        }
    }

    layout.body.add(
        new layout.TabBlock({
            tabs: tabs
        })
    )
}

require('fs').readFile(settingsFile, (error, data) => {
    if (error) {
        logger.error('Unable to read settings display file:', error)

        layout.dialog.showError({
            title: 'Error loading preferences!',
            message: 'Unable to load preferences!',
            detail: error.message || error.toString()
        })
        return false
    }

    try {
        data = JSON.parse(data)

        displaySettings(data)
    } catch (error) {
        logger.error('Unable to load settings display file:', error)

        layout.dialog.showError({
            title: 'Error loading preferences!',
            message: 'Unable to load preferences!',
            detail: error.message || error.toString()
        })
    }
})
