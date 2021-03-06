const layout = require('dw-layout')

const logger = require('dw-log')
const Database = require('dw-database')
const editor = require('dw-editor')
const richText = require('dw-rich-text')

const Templates = new Database.Group('templates', {
    load: true,
    parse: true
})
const templateGroup = 't'

const list = new layout.List(
    {
        reorderable: false,
        removeButton: true,
        editButton: true,

        addInput: true
    },
    {
        border: false
    }
)

const itemsBar = new layout.TabBlock(
    {},
    {
        grow: false,
        shrink: false,
        align: 'stretch'
    }
)

const displayEditor = new layout.DisplayEdit(
    {},
    {
        background: true,
        border: true
    }
)

const partsList = new layout.List(
    {
        reorderable: false,
        editButton: false,
        removeButton: false
    },
    {
        border: false
    }
)

const textControl = new layout.TextStyleEdit({})
const imageControl = new layout.ImageStyleEdit({
    image: false
})
imageControl.visible = false
const boxControl = new layout.BoxStyleEdit({})
const colorControl = new layout.BackgroundStyleEdit({})
const playControl = new layout.PlayStyleEdit({}, {})

const propertiesBar = new layout.Block({
    childSpacing: 8
})

const saveButton = new layout.Button({
    text: 'Save'
})
const removeButton = new layout.Button({
    text: 'Remove'
})

colorControl.connect(displayEditor)

{
    layout.change(propertiesBar, {
        direction: 'horizontal',
        grow: false,
        shrink: false,
        wrap: true,
        padding: 0
    })

    layout.change(displayEditor, {
        grow: true
    })

    layout.body.add(
        new layout.LayoutBlock({
            items: [
                /* Templates List */
                new layout.LayoutBlock({
                    items: [list],

                    size: 30,
                    minWidth: 150,
                    maxWidth: 300,
                    minHeight: 200
                }),

                /* Display Editor + Editor + Format */
                new layout.LayoutBlock({
                    items: [
                        /* Display Editor */
                        new layout.LayoutBlock({
                            items: [
                                new layout.Block(
                                    {
                                        items: [playControl, colorControl],
                                        childSpacing: 8
                                    },
                                    {
                                        direction: 'horizontal'
                                    }
                                )
                            ],

                            size: 20,

                            //615x62 fits play controls + background controls with no wrapping
                            minWidth: 615,
                            minHeight: 62,
                            maxHeight: 62
                        }),

                        /* Editor + Format */
                        new layout.LayoutBlock({
                            items: [
                                /* Editor */
                                new layout.LayoutBlock({
                                    items: [
                                        new layout.Block(
                                            {
                                                childSpacing: 8,

                                                items: [
                                                    propertiesBar,
                                                    boxControl,
                                                    textControl,
                                                    imageControl,
                                                    displayEditor
                                                ]
                                            },
                                            {
                                                direction: 'vertical'
                                            }
                                        )
                                    ],

                                    size: 80,

                                    //460x425 fits text controls + 16:9 display with no wasted space
                                    minWidth: 460,
                                    minHeight: 425
                                }),

                                /* Format */
                                new layout.LayoutBlock({
                                    items: [
                                        new layout.Block(
                                            {
                                                items: [itemsBar, partsList]
                                            },
                                            {
                                                padding: 4,
                                                direction: 'vertical'
                                            }
                                        )
                                    ],

                                    size: 20,

                                    minWidth: 160,
                                    maxWidth: 160,
                                    minHeight: 100
                                })
                            ],

                            small: true,

                            direction: 'horizontal',
                            size: 40
                        }),

                        /* Save, Remove */
                        new layout.LayoutBlock({
                            items: [
                                new layout.Block(
                                    {
                                        items: [saveButton, removeButton],
                                        childSpacing: 8
                                    },
                                    {
                                        direction: 'horizontal',
                                        align: 'end'
                                    }
                                )
                            ],

                            size: 10,

                            minWidth: 80,
                            minHeight: 40,
                            maxHeight: 40
                        })
                    ],

                    small: true,

                    size: 70
                })
            ],

            direction: 'horizontal',
            small: true
        })
    )
}

let editNodes = []

const nodes = {
    text: [],
    textIndex: -1,
    image: [],
    imageIndex: -1
}

const nameDigitEnd = new RegExp(/\(\d+\)$/, 'g')

let itemFormat = { name: '', nodes: [], inputs: [] }
let itemFormats = {}

let defaultTemplate = {}

let selectedIndex = -1

function save(callback) {
    editor.apply()

    if (editor.data.name.trim === '') {
        editor.changeBase({
            name: 'Template'
        })
    }

    if (!Templates.validID(templateGroup, editor.data.ID)) {
        editor.changeBase({
            ID: Templates.getUniqueID(templateGroup)
        })
    }

    Templates.save(
        templateGroup,
        editor.data.ID,
        editor.util.copyObj(editor.data),
        error => {
            if (error) {
                layout.dialog.showNotification({
                    type: 'error',

                    message:
                        'Unable to save!\n' + error.message || error.toString()
                })

                logger.error(
                    'Unable to save template ' + currentName + ':',
                    error
                )

                if (typeof callback === 'function') {
                    callback(error)
                }

                return false
            } else {
                layout.window.setDocumentEdited(false)

                if (typeof callback === 'function') {
                    callback()
                }
            }
        }
    )
}

function remove(ID, name = '') {
    let message = 'Remove template "' + name + '"?'

    if (Templates.files.length <= 1) {
        message = 'Reset template "' + name + '" to default?'
    }

    layout.dialog.showQuestion(
        {
            title:
                (Templates.files.length === 1 ? 'Reset ' : 'Remove ') +
                ' Template?',
            message: message,
            detail: 'This action cannot be undone.',

            options: ['Remove', 'Cancel']
        },
        (error, answer) => {
            if (error) {
                logger.error('Could not confirm deletion of template', error)

                updateTemplateListAndSelect()

                return false
            }

            if (answer === 'Remove') {
                editor.reset()

                Templates.remove(templateGroup, ID, error => {
                    if (error) {
                        layout.dialog.showError({
                            message:
                                'Unable to remove "' +
                                    name +
                                    '"\n' +
                                    error.message || error.toString()
                        })

                        logger.error(
                            'Unable to remove template ' + name + ':',
                            error
                        )

                        return false
                    }
                })
            } else {
                updateTemplateListAndSelect()
            }
        }
    )
}

function nodeChange(event) {
    if (!event.fromUser) {
        return false
    }

    let index = editNodes.indexOf(event.from)
    if (index < 0 || index >= itemFormat.nodes.length) {
        return false
    }

    if (itemFormat.nodes[index].map) {
        editor.change(
            itemFormat.nodes[index].map,
            editor.util.filterObj(event, itemFormat.nodes[index].properties)
        )
    } else {
        editor.change(
            editor.util.filterObj(event, itemFormat.nodes[index].properties)
        )
    }
}
function slideChange(event) {
    if (!event.fromUser) {
        return false
    }

    editor.change(
        editor.util.filterObj(
            event,
            {
                from: true,
                fromUser: true
            },
            true
        )
    )
}
function optionChange(map, property, value) {
    let change = {}

    if (map) {
        change[map] = {}
        change[map][property] = value
    } else {
        change[property] = value
    }

    editor.change(change)
}

function onEditNodeFocus(event) {
    //if (event.fromUser) {
    for (let i = 0; i < itemFormat.nodes.length; i++) {
        if (editNodes[i] === event.from) {
            partsList.select(itemFormat.nodes[i].name)

            if (itemFormat.nodes[i].type === 'text') {
                textControl.visible = true
                imageControl.visible = false
            } else if (itemFormat.nodes[i].type === 'image') {
                textControl.visible = false
                imageControl.visible = true
            }

            return
        }
    }
    //}
}

function addEditNode(type) {
    let node
    if (type === 'text') {
        nodes.textIndex += 1

        if (nodes.textIndex < nodes.text.length - 1) {
            return nodes.text[nodes.textIndex - 1]
        } else {
            node = displayEditor.add({ type: 'text' })

            textControl.connect(node)

            nodes.text.push(node)
        }
    } else if (type === 'image') {
        nodes.imageIndex += 1

        if (nodes.imageIndex < nodes.image.length - 1) {
            return nodes.image[nodes.imageIndex - 1]
        } else {
            node = displayEditor.add({ type: 'image' })

            imageControl.connect(node)

            nodes.image.push(node)
        }
    } else {
        return false
    }

    boxControl.connect(node)

    node.onEvent('change', nodeChange)
    node.onEvent('focus', onEditNodeFocus)

    return node
}

function updateNodes() {
    for (let i = 0; i < nodes.text.length; i++) {
        nodes.text[i].hide()
    }
    for (let i = 0; i < nodes.image.length; i++) {
        nodes.image[i].hide()
    }

    partsList.clear()

    editNodes = []
    nodes.textIndex = 0
    nodes.imageIndex = 0

    for (let i = 0; i < itemFormat.nodes.length; i++) {
        editNodes.push(addEditNode(itemFormat.nodes[i].type))

        partsList.add(itemFormat.nodes[i].name || i.toString())

        //If text/url isn't a used property for the node, then set it to a default value
        if (!itemFormat.nodes[i].properties.hasOwnProperty('text')) {
            editNodes[i].edit({
                text:
                    '<b>' +
                    richText.format(itemFormat.nodes[i].name) +
                    '\n<i>Note</b>: Text for this section is not saved.'
            })
        }
        if (!itemFormat.nodes[i].properties.hasOwnProperty('url')) {
            editNodes[i].edit({
                url:
                    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAAAAABX3VL4AAAACXBIWXMAAAsTAAALEwEAmpwYAAAADklEQVQImWP+L8Uw8z8AB6wCtQYJB2cAAAAASUVORK5CYII='
            })
        }

        if (itemFormat.nodes[i].map) {
            if (editor.data[itemFormat.nodes[i].map]) {
                editNodes[i].edit(editor.data[itemFormat.nodes[i].map])
            }
        } else {
            editNodes[i].edit(editor.data)
        }

        editNodes[i].show()
    }
}
function updateOptions() {
    propertiesBar.clear()

    if (itemFormat.inputs.length === 0) {
        propertiesBar.visible = false

        return
    } else {
        propertiesBar.visible = true
    }

    for (let i = 0; i < itemFormat.inputs.length; i++) {
        propertiesBar.add(itemFormat.inputs[i])

        if (itemFormat.options[i].map) {
            if (
                !editor.has(
                    itemFormat.options[i].map,
                    itemFormat.options[i].property
                )
            ) {
                editor.addToBase(
                    itemFormat.options[i].map,
                    itemFormat.options[i].property,
                    itemFormat.options[i].value
                )
            }

            itemFormat.inputs[i].value =
                editor.data[itemFormat.options[i].map][
                    itemFormat.options[i].property
                ]
        } else {
            if (!editor.has(itemFormat.options[i].property)) {
                editor.addToBase(
                    itemFormat.options[i].property,
                    itemFormat.options[i].value
                )
            }

            itemFormat.inputs[i].value =
                editor.data[itemFormat.options[i].property]
        }
    }
}
function updateAll() {
    updateNodes()

    displayEditor.edit(editor.data)

    playControl.edit(editor.data)

    updateOptions()
}

function getUniqueName(name, exclude = '') {
    name = name.trim()
    if (name === '') {
        name = 'Template'
    }

    let allNames = Templates.list.map(template => template.name)

    let excludeIndex = allNames.indexOf(exclude)
    if (excludeIndex !== -1) {
        allNames.splice(excludeIndex, 1)
    }

    if (!allNames.includes(name)) {
        return name
    }

    if (nameDigitEnd.test(name)) {
        name = name.replace(nameDigitEnd, '')
    } else {
        name += ' '
    }

    let digit = 1

    while (allNames.includes(name + '(' + digit.toString() + ')')) {
        digit += 1
    }

    return name + '(' + digit.toString() + ')'
}

function showTemplate(index) {
    if (index < 0 || index >= Templates.list.length) {
        return false
    }

    selectedIndex = index

    editor.set(editor.util.copyObj(Templates.list[selectedIndex]))

    layout.window.setDocument(editor.data.name)
    layout.window.setDocumentEdited(false)

    if (itemFormat.name) {
        switchFormat(itemFormat.name)
    }

    updateAll()

    if (editNodes.length > 0) {
        editNodes[0].focus()
    }
}

function switchFormat(name) {
    if (typeof itemFormats[name] !== 'object' || itemFormats[name] === null) {
        logger.error('Tried to switch template format to invalid name:', name)
        return false
    }

    itemFormat = itemFormats[name]

    updateNodes()

    updateOptions()

    if (editNodes.length > 0) {
        editNodes[0].focus()
    }
}

function updateTemplateList() {
    list.clear()

    Templates.list.forEach(template => list.add(template.name))
}

function updateTemplateListAndSelect() {
    updateTemplateList()

    if (selectedIndex >= 0 && selectedIndex < list.items.length) {
        list.select(selectedIndex)
    } else {
        list.select(0, false, true)
    }
}

//items
{
    let tabs = []

    itemsBar.onEvent('switch', event => {
        switchFormat(tabs.find(tab => tab.name === event.tab.name).item)
    })

    function addItemFormat(name, data) {
        if (
            typeof name !== 'string' ||
            name.trim() === '' ||
            typeof data !== 'object' ||
            data === null
        ) {
            return false
        }

        itemFormats[name] = {
            nodes: [],
            options: [],
            inputs: []
        }

        if (Array.isArray(data.nodes)) {
            for (let i = 0; i < data.nodes.length; i++) {
                if (
                    typeof data.nodes[i] === 'object' &&
                    data.nodes[i] !== null
                ) {
                    itemFormats[name].nodes.push({
                        type:
                            typeof data.nodes[i].type === 'string'
                                ? data.nodes[i].type
                                : 'text',
                        map:
                            typeof data.nodes[i].map === 'string'
                                ? data.nodes[i].map
                                : '',
                        name:
                            typeof data.nodes[i].name === 'string'
                                ? data.nodes[i].name
                                : name + ' node ' + i.toString(),
                        properties:
                            typeof data.nodes[i].properties === 'object'
                                ? data.nodes[i].properties
                                : {}
                    })
                }
            }
        }

        if (Array.isArray(data.options)) {
            for (let i = 0; i < data.options.length; i++) {
                let input = false

                switch (data.options[i].type) {
                    case 'boolean':
                        input = new layout.CheckboxInput({
                            label: data.options[i].label,
                            placeholder: data.options[i].label,
                            tooltip: data.options[i].label
                        })

                        break
                    case 'number':
                        input = new layout.NumberInput({
                            label: data.options[i].label,
                            placeholder: data.options[i].label,
                            tooltip: data.options[i].label,

                            unit: data.options[i].unit || null,
                            min: data.options[i].min || null,
                            max: data.options[i].max || null,

                            step: data.options[i].step || null,
                            precision: data.options[i].precision,

                            popupMin: data.options[i].popupMin,
                            popupMax: data.options[i].popupMax
                        })
                        break
                    case 'text':
                        input = new layout.TextInput({
                            label: data.options[i].label,
                            placeholder: data.options[i].placeholder,
                            tooltip: data.options[i].tooltip
                        })
                    case 'color':
                        input = new layout.ColorInput({
                            label: data.options[i].label,
                            placeholder: data.options[i].label,
                            tooltip: data.options[i].label
                        })
                        break
                    case 'list':
                        input = new layout.SelectInput({
                            label: data.options[i].label,
                            placeholder: data.options[i].placeholder,
                            tooltip: data.options[i].tooltip,

                            options: data.options[i].options
                        })
                        break
                    case 'font':
                        input = new layout.FontInput({
                            label: data.options[i].label,
                            placeholder: data.options[i].placeholder,
                            tooltip: data.options[i].tooltip
                        })
                        break
                }

                if (input) {
                    input.value = data.options[i].value

                    input.onEvent('change', event => {
                        if (!event.fromUser) {
                            return false
                        }

                        optionChange(
                            data.options[i].map,
                            data.options[i].property,
                            event.value
                        )
                    })

                    layout.change(input, {
                        align: 'center'
                    })

                    itemFormats[name].inputs.push(input)

                    itemFormats[name].options.push(data.options[i])
                }
            }
        }
    }

    let dwItems = require('dw-items')

    for (let i = 0; i < dwItems.list.length; i++) {
        addItemFormat(dwItems.list[i], dwItems[dwItems.list[i]].template)

        tabs.push({
            name: dwItems[dwItems.list[i]].name,
            item: dwItems.list[i]
        })
    }

    itemsBar.set(tabs)

    itemsBar.tab = dwItems.list[0]
}

//selecting, deleting, & adding templates
{
    list.onEvent('select', event => {
        if (
            !event.fromUser ||
            event.index < 0 ||
            event.index >= Templates.list.length
        ) {
            return false
        }

        if (
            editor.hasChanges &&
            Templates.list[event.index].ID !== editor.data.ID
        ) {
            layout.dialog.showQuestion(
                {
                    title: 'Save Template?',
                    message:
                        'You have made changes to the template "' +
                        editor.data.name +
                        '" which have not been saved!',
                    detail: 'The changes will be lost unless you save them.',

                    options: ['Save', 'Discard', 'Cancel']
                },
                (error, answer) => {
                    if (error) {
                        logger.error(
                            'Could not confirm saving changes before selecting another template',
                            error
                        )

                        list.select(selectedIndex)
                        return false
                    }

                    if (answer === 'Save') {
                        save()

                        showTemplate(event.index)
                    } else if (answer === 'Discard') {
                        showTemplate(event.index)
                    } else {
                        list.select(selectedIndex)
                    }
                }
            )
        } else {
            showTemplate(event.index)
        }
    })

    list.onEvent('remove', event => {
        if (
            event.fromUser &&
            event.index >= 0 &&
            event.index < Templates.list.length
        ) {
            remove(
                Templates.list[event.index].ID,
                Templates.list[event.index].name
            )
        }
    })

    list.onEvent('add', event => {
        if (event.fromUser) {
            let newTemplate = editor.util.copyObj(defaultTemplate)

            newTemplate.name = getUniqueName(event.text)

            newTemplate.ID = Templates.getUniqueID(templateGroup)

            Templates.save(templateGroup, newTemplate.ID, newTemplate)

            updateTemplateList()
            list.select(newTemplate.name, false, true)
        }
    })

    list.onEvent('enter', event => {
        if (event.index < 0 || event.index >= Templates.list.length) {
            return false
        }

        let template = Templates.list[event.index]
        template.name = getUniqueName(event.text, template.name)

        Templates.save(templateGroup, template.ID, template)

        if (Templates.list[event.index].ID === editor.data.ID) {
            editor.changeBase({
                name: event.text
            })
        }
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
    if (item.value === 'undo') {
        editor.undo()
    } else if (item.value === 'redo') {
        editor.redo()
    }
})

editor.onEvent('change', from => {
    if (from === 'undo' || from === 'redo') {
        updateAll()
    }

    layout.window.setDocumentEdited(editor.hasChanges)
})

displayEditor.onEvent('change', slideChange)

playControl.onEvent('change', change => {
    editor.change(
        editor.util.filterObj(
            change,
            {
                from: true,
                fromUser: true
            },
            true
        )
    )
})

partsList.onEvent('select', event => {
    if (event.fromUser) {
        for (let i = 0; i < itemFormat.nodes.length; i++) {
            if (itemFormat.nodes[i].name === event.text) {
                return editNodes[i].focus()
            }
        }
    }
})

saveButton.onEvent('click', save)

removeButton.onEvent('click', () => {
    remove(editor.data.ID, editor.data.name)
})

//Until the default template is loaded, don't allow user to add/remove any templates
list.disabled = true

require('fs').readFile(
    require('path').join(__dirname, '..', 'default-template.json'),
    'utf8',
    (error, data) => {
        if (error) {
            layout.dialog.showError({
                message:
                    'Unable to load default template! Please restart Display Whisper'
            })

            logger.error('Unable to load default template file:', error)

            return false
        }

        try {
            data = JSON.parse(data)
        } catch (error) {
            layout.dialog.showError({
                message:
                    'Unable to parse default template! Please reinstall Display Whisper'
            })

            logger.error('Unable to parse default template file:', error)

            return false
        }

        defaultTemplate = data

        list.disabled = false
    }
)

Templates.onEvent('update-start', () => {
    layout.showLoader(list)
})

Templates.onEvent('update', () => {
    if (Templates.files.length === 0) {
        if (!defaultTemplate) {
            //The default template is still loading, wait 500ms and try again
            setTimeout(Templates.update, 500)
        } else {
            layout.dialog.showNotification({
                message: 'Created default template'
            })

            defaultTemplate.ID = Templates.getUniqueID(templateGroup)

            return Templates.save(
                templateGroup,
                defaultTemplate.ID,
                defaultTemplate
            )
        }
    }

    removeButton.disabled = Templates.files.length === 1

    layout.hideLoader(list)

    updateTemplateListAndSelect()
})

layout.window.onEvent('close', event => {
    if (editor.hasChanges) {
        event.wait()

        layout.dialog.showQuestion(
            {
                title: 'Save Template?',
                message:
                    'You have made changes to the template "' +
                    editor.data.name +
                    '" which have not been saved!',
                detail: 'The changes will be lost unless you save them.',

                options: ['Save', 'Discard', 'Cancel']
            },
            (error, answer) => {
                if (answer === 'Save') {
                    save(() => {
                        Templates.sendUpdates()

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

Templates.onEvent('error', error => {
    layout.dialog.showNotification({
        type: 'error',
        autoHide: false,

        message:
            'There is an error with the Template database!\n' + error.message
    })
})
