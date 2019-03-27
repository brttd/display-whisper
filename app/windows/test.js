const layout = require('dw-layout')

const objUtil = require('dw-editor').util

//DISPLAY FIT TESTING
{
    const textBox = {
        type: 'text',

        text: `Normal
<b>Bold</b>
<sub>SubScript</sub>
Normal - <sup>SuperScript</sup>
Normal - <sup>SuperScript</sup><sub>SubScript</sub>
Normal - <b><sub>Bold Sub</sub>Bold Super<sup>sup</sup></b>`,

        font: 'Arial',
        color: 'white',
        size: 50,

        align: 'left',
        y: 'center',

        top: 52.4,
        left: 10,
        right: 90,
        bottom: 90
    }
    const inputStyle = new layout.TextStyleEdit({})
    const inputDisplay = new layout.DisplayEdit(
        {},
        {
            grow: true,
            shrink: true,

            align: 'stretch',

            background: 'grey',
            border: true
        }
    )

    const outputDisplay = new layout.Display(
        {
            nodes: [textBox]
        },
        {
            grow: true,
            shrink: true,

            align: 'stretch',

            background: 'grey',
            border: true
        }
    )

    const logOutput = new layout.Text({})

    const textInput = inputDisplay.add(textBox)

    textInput.connect(inputStyle)

    let log = []

    function onTextFit(size) {
        log.push(size)
        log.splice(0, log.length - 5)

        logOutput.text = log.map(item => item.toString()).join(' | ')
        outputDisplay.update({ nodes: [{ size: size }] })
    }

    textInput.onEvent('change', event => {
        if (event.fromUser) {
            outputDisplay.update({
                nodes: [
                    objUtil.filterObj(
                        event,
                        { from: true, fromUser: true },
                        true
                    )
                ]
            })

            textInput.fit()
            layout.Display.getMaxTextSize(textInput.values, onTextFit)
        }
    })

    //textInput.fit()
    layout.Display.getMaxTextSize(textInput.values, onTextFit)

    layout.body.add(
        new layout.Block(
            {
                items: [
                    new layout.Block(
                        {
                            items: [inputStyle, inputDisplay]
                        },
                        {
                            size: '50%',

                            align: 'stretch',

                            overflow: 'hidden',

                            grow: false,
                            shrink: false,
                            direction: 'vertical'
                        }
                    ),
                    new layout.Block(
                        {
                            items: [logOutput, outputDisplay]
                        },
                        {
                            size: '50%',

                            align: 'stretch',

                            overflow: 'hidden',

                            grow: false,
                            shrink: false,
                            direction: 'vertical'
                        }
                    )
                ]
            },
            {
                grow: false,
                shrink: false,

                overflow: false,
                direction: 'horizontal'
            }
        )
    )
}

layout.change(layout.body, {
    direction: 'vertical',
    overflow: 'auto'
})

layout.body.add(
    new layout.Block(
        {
            items: [
                new layout.Button({ icon: 'add' }),
                new layout.Button({ icon: 'remove' }),
                new layout.Button({ icon: 'move-y' }),
                new layout.Button({ icon: 'move-x' }),
                new layout.Button({ icon: 'edit' }),
                new layout.Button({ icon: 'expand-x' }),
                new layout.Button({ icon: 'expand-y' }),
                new layout.Button({ icon: 'display' }),
                new layout.Button({ icon: 'settings' }),
                new layout.Button({ icon: 'play' }),
                new layout.Button({ icon: 'play-first' }),
                new layout.Button({ icon: 'play-last' }),
                new layout.Button({ icon: 'play-next' }),
                new layout.Button({ icon: 'play-previous' }),

                new layout.Button({ icon: 'text-bold' }),
                new layout.Button({ icon: 'text-italic' }),
                new layout.Button({ icon: 'text-underline' }),
                new layout.Button({ icon: 'text-strikethrough' }),
                new layout.Button({ icon: 'text-subscript' }),
                new layout.Button({ icon: 'text-superscript' }),
                new layout.Button({ icon: 'text-align-center' }),
                new layout.Button({ icon: 'text-align-left' }),
                new layout.Button({ icon: 'text-align-right' })
            ]
        },
        {
            grow: false,
            shrink: false,
            direction: 'horizontal',
            wrap: true
        }
    )
)

layout.body.add(
    new layout.Block(
        {
            items: [
                new layout.Text({
                    text: 'Hello World!'
                })
            ]
        },
        {
            grow: false,
            shrink: false
        }
    )
)

layout.body.add(
    new layout.TabBlock(
        {
            tabs: [
                {
                    name: 'Reorderable',
                    content: new layout.ReorderableBlock({
                        items: [
                            new layout.Text({
                                text: 'Hello World!'
                            }),
                            new layout.Text({
                                text: 'Lorem ipsum'
                            }),
                            new layout.Text({
                                text: 'dolor sit'
                            }),
                            new layout.Text({
                                text: 'amet consectetur'
                            }),
                            new layout.Text({
                                text: 'adipiscing elit'
                            })
                        ]
                    })
                },
                {
                    name: 'List',
                    content: new layout.List({
                        items: [
                            'Lorem',
                            'ipsum',
                            'dolor',
                            'sit',
                            'amet',
                            'consectetur',
                            'adipiscing',
                            'elit'
                        ],
                        editButton: true
                    })
                },
                {
                    name: 'TableList',
                    content: new layout.TableList({
                        columns: 3,
                        columWidths: ['1ch', '', '2ch'],
                        items: [
                            { text: ['a', 'Lorem', '01'] },
                            { text: ['a', 'ipsum', '01'] },
                            { text: ['a', 'dolor', '01'] },
                            { text: ['a', 'sit', '01'] },
                            { text: ['a', 'amet', '01'] },
                            { text: ['a', 'consectetur', '01'] },
                            { text: ['a', 'adipiscing', '01'] },
                            { text: ['a', 'elit', '01'] }
                        ]
                    })
                }
            ]
        },
        {
            shrink: false,
            grow: false
        }
    )
)

layout.body.add(
    new layout.Block(
        {
            items: [
                new layout.FontInput({
                    text: 'Font',
                    tooltip: 'Font tooltip'
                }),
                new layout.FontInput({
                    text: 'Disabled',
                    disabled: true,
                    tooltip: 'Font Disabled tooltip'
                }),

                new layout.Button({
                    text: 'Button',
                    tooltip: 'Button tooltip'
                }),
                new layout.Button({
                    text: 'Disabled',
                    tooltip: 'Button Disabled tooltip',
                    disabled: true
                }),
                new layout.Button({
                    text: 'Large',
                    icon: 'play',
                    size: 'large',
                    tooltip: 'Button Large tooltip'
                }),

                new layout.CheckboxInput({
                    label: 'Checkbox',
                    tooltip: 'Checkbox tooltip'
                }),
                new layout.CheckboxInput({
                    label: 'Disabled',
                    disabled: true,
                    tooltip: 'Checkbox Disabled tooltip'
                }),

                new layout.TextInput({
                    label: 'Text',
                    placeholder: 'Default',
                    tooltip: 'Text tooltip',

                    maxLength: 3
                }),
                new layout.TextInput({
                    label: 'Disabled',
                    disabled: true,
                    placeholder: 'Default',
                    tooltip: 'Text Disabled tooltip'
                }),

                new layout.NumberInput({
                    label: 'Number',
                    unit: '%',
                    placeholder: 'Default',
                    tooltip: 'Number tooltip'
                }),
                new layout.NumberInput({
                    label: 'Disabled',
                    unit: '%',
                    disabled: true,
                    placeholder: 'Default',
                    tooltip: 'Number Disabled tooltip'
                }),

                new layout.ColorInput({
                    label: 'Color',
                    tooltip: 'Color tooltip'
                }),
                new layout.ColorInput({
                    label: 'Disabled',
                    disabled: true,
                    tooltip: 'Color Disabled tooltip'
                }),

                new layout.SelectInput({
                    label: 'Select',
                    options: ['1', '2', '3', '4'],
                    tooltip: 'Select tooltip'
                }),
                new layout.SelectInput({
                    label: 'Select',
                    disabled: true,
                    options: ['1', '2', '3', '4'],
                    tooltip: 'Select Disabled tooltip'
                }),

                new layout.KeyInput({
                    text: 'Key',
                    tooltip: 'Key tooltip'
                }),
                new layout.KeyInput({
                    text: 'Disabled',
                    disabled: true,
                    tooltip: 'Key Disabled tooltip'
                }),

                new layout.FileInput({
                    label: 'File',
                    tooltip: 'File tooltip'
                }),

                new layout.ImageInput({
                    label: 'Image',
                    tooltip: 'Image tooltip'
                })
            ],
            childSpacing: 8
        },
        {
            grow: false,
            shrink: false,
            wrap: true,
            direction: 'vertical'
        }
    )
)

layout.body.add(
    new layout.Block(
        {
            items: [
                new layout.TextStyleEdit({}),
                new layout.ImageStyleEdit({}),
                new layout.BoxStyleEdit({}),
                new layout.BackgroundStyleEdit({})
            ],
            childSpacing: 8
        },
        {
            grow: false,
            shrink: false,
            direction: 'vertical'
        }
    )
)
