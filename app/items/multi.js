const { isColor } = require('dw-color')

function basename(name) {
    return name.split(/[\/\\]/).pop()
}

function applyNodeData(target, source = {}) {
    if (typeof source.opacity === 'number' && isFinite(source.opacity)) {
        target.opacity = source.opacity
    }

    if (typeof source.top === 'number' && isFinite(source.top)) {
        target.top = source.top
    }
    if (typeof source.left === 'number' && isFinite(source.left)) {
        target.left = source.left
    }
    if (typeof source.right === 'number' && isFinite(source.right)) {
        target.right = source.right
    }
    if (typeof source.bottom === 'number' && isFinite(source.bottom)) {
        target.bottom = source.bottom
    }

    if (typeof source.type === 'string') {
        target.type = source.type
    }

    if (target.type === 'text') {
        if (typeof source.text === 'string') {
            target.text = source.text

            //If there isn't plaintext provided, extract it from the text
            if (typeof source.plainText !== 'string') {
                source.plainText = richText.removeFormat(source.text)
            }
        } else if (typeof source.plainText === 'string') {
            //if text isn't provided, but plaintext is, then use the plaintext
            target.text = source.plainText
        }

        if (typeof source.plainText === 'string') {
            target.plainText = source.plainText
        }

        if (typeof source.font === 'string') {
            target.font = source.font
        }

        if (
            typeof source.size === 'number' &&
            isFinite(source.size) &&
            source.size > 0
        ) {
            target.size = source.size
        }

        if (isColor(source.color)) {
            target.color = source.color
        }

        if (
            typeof source.lineHeight === 'number' &&
            isFinite(source.lineHeight) &&
            source.lineHeight > 0
        ) {
            target.lineHeight = source.lineHeight
        }

        if (
            source.align === 'left' ||
            source.align === 'center' ||
            source.align == 'right'
        ) {
            target.align = source.align
        }

        if (
            source.y === 'top' ||
            source.y === 'center' ||
            source.y === 'bottom'
        ) {
            target.y = source.y
        }
    } else if (target.type === 'image') {
        if (typeof source.url === 'string') {
            target.url = source.url
        }

        if (typeof source.database === 'boolean') {
            target.database = source.database
        }

        if (
            source.scale === 'fill' ||
            source.scale === 'fit' ||
            source.scale === 'stretch'
        ) {
            target.scale = source.scale
        }
    }

    return target
}

function applySectionData(target, source = {}) {
    if (typeof source.name === 'string') {
        target.name = source.name
    }

    if (isColor(source.background)) {
        target.background = source.background
    }

    if (typeof source.backgroundImage === 'string') {
        target.backgroundImage = source.backgroundImage
    }

    if (
        source.backgroundScale === 'fill' ||
        source.backgroundScale === 'fit' ||
        source.backgroundScale === 'stretch'
    ) {
        target.backgroundScale = source.backgroundScale
    }

    if (Array.isArray(source.nodes)) {
        if (!Array.isArray(target.nodes)) {
            target.nodes = []
        }

        if (target.nodes.length > source.nodes.length) {
            target.nodes.splice(source.nodes.length, target.nodes.length)
        } else if (source.nodes.length > target.nodes.length) {
            for (let i = target.nodes.length; i < source.nodes.length; i++) {
                target.nodes.push({})
            }
        }

        for (let i = 0; i < source.nodes.length; i++) {
            if (typeof source.nodes[i] === 'object') {
                applyNodeData(target.nodes[i], source.nodes[i])
            }
        }
    }

    if (
        typeof source.playTime === 'number' &&
        isFinite(source.playTime) &&
        source.playTime >= 0
    ) {
        target.playTime = source.playTime
    }

    if (typeof source.autoPlay === 'boolean') {
        target.autoPlay = source.autoPlay
    }

    if (typeof source.transition === 'object') {
        if (typeof target.transition !== 'object') {
            target.transition = {}
        }

        if (typeof source.transition.type === 'string') {
            target.transition.type = source.transition.type
        }
        if (
            typeof source.transition.origin === 'top left' ||
            typeof source.transition.origin === 'top' ||
            typeof source.transition.origin === 'top right' ||
            typeof source.transition.origin === 'right' ||
            typeof source.transition.origin === 'bottom right' ||
            typeof source.transition.origin === 'bottom' ||
            typeof source.transition.origin === 'bottom left' ||
            typeof source.transition.origin === 'left' ||
            typeof source.transition.origin === 'center'
        ) {
            target.transition.origin = source.transition.origin
        }

        if (
            typeof source.transition.time === 'number' &&
            isFinite(source.transition.time) &&
            source.transition.time >= 0
        ) {
            target.transition.time = source.transition.time
        }
    }

    return target
}

module.exports = class Multi {
    constructor(data = {}, template = {}) {
        this.data = {
            sections: [],

            template: {
                background: 'black',
                backgroundImage: '',
                backgroundScale: 'fill',

                playTime: 0,
                autoPlay: false,

                transition: {
                    type: 'fade',
                    origin: 'center',
                    time: 0
                },

                text: {
                    top: 10,
                    left: 10,
                    right: 90,
                    bottom: 90,

                    opacity: 100,

                    font: 'Arial',
                    size: 100,
                    color: 'white',
                    lineHeight: 1.5,
                    align: 'center',
                    y: 'top'
                },
                image: {
                    top: 10,
                    left: 10,
                    right: 90,
                    bottom: 90,

                    opacity: 100,
                    scale: 'fit'
                }
            }
        }

        this.types = []

        if (typeof template === 'object') {
            this.edit({
                template: template
            })
        }

        if (typeof data === 'object') {
            this.edit(data)
        }
    }

    get title() {
        if (this.data.sections.length === 0) {
            return 'Empty'
        } else {
            let types = 'Blank'
            let sections = this.data.sections.length.toString() + ' section'

            if (this.types.length > 0) {
                types = this.types
                    .map(type => type.charAt(0).toUpperCase() + type.slice(1))
                    .join(',  ')
            }

            if (this.data.sections.length > 1) {
                sections += 's'
            }

            return types + ', ' + sections
        }
    }

    get sections() {
        return this.data.sections.map(section => {
            let contentText = ''
            let nodes = []

            for (let i = 0; i < section.nodes.length; i++) {
                if (section.nodes[i].type === 'text') {
                    contentText += section.nodes[i].plainText + '\n'
                } else if (section.nodes[i].type === 'image') {
                    contentText += basename(section.nodes[i].url) + '\n'
                }

                nodes.push(applyNodeData({}, section.nodes[i]))
            }

            return {
                title: section.name,
                content: contentText,

                display: {
                    background: section.background,
                    backgroundImage: section.backgroundImage,
                    backgroundScale: section.backgroundScale,

                    playTime: section.playTime,
                    autoPlay: section.autoPlay,

                    transition: {
                        type: section.transition.type,
                        time: section.transition.time
                    },

                    nodes: nodes
                }
            }
        })
    }

    getTextUnifySections() {
        return []
    }
    unifyTextSections() {}

    edit(data = {}) {
        if (Array.isArray(data.sections)) {
            while (data.sections.length < this.data.sections.length) {
                this.data.sections.pop()
            }

            this.types.splice(0, this.types.length)

            for (
                let sectionIndex = 0;
                sectionIndex < this.data.sections.length;
                sectionIndex++
            ) {
                if (
                    typeof data.sections[sectionIndex] === 'object' &&
                    data.sections[sectionIndex] !== null
                ) {
                    applySectionData(
                        this.data.sections[sectionIndex],
                        data.sections[sectionIndex]
                    )
                }

                for (
                    let i = 0;
                    i < this.data.sections[sectionIndex].nodes.length;
                    i++
                ) {
                    if (
                        !this.types.includes(
                            this.data.sections[sectionIndex].nodes[i].type
                        )
                    ) {
                        this.types.push(
                            this.data.sections[sectionIndex].nodes[i].type
                        )
                    }
                }
            }

            //if more sections have been added
            for (
                let sectionIndex = this.data.sections.length;
                sectionIndex < data.sections.length;
                sectionIndex++
            ) {
                this.data.sections.push(
                    applySectionData(
                        {
                            nodes: []
                        },
                        this.data.template
                    )
                )

                if (Array.isArray(data.sections[sectionIndex].nodes)) {
                    for (
                        let i = 0;
                        i < data.sections[sectionIndex].nodes.length;
                        i++
                    ) {
                        this.data.sections[sectionIndex].nodes.push({})

                        if (
                            typeof data.sections[sectionIndex].nodes[i] ===
                                'object' &&
                            typeof this.data.template[
                                data.sections[sectionIndex].nodes[i].type
                            ] === 'object'
                        ) {
                            applyNodeData(
                                this.data.sections[sectionIndex].nodes[i],
                                this.data.template[
                                    data.sections[sectionIndex].nodes[i].type
                                ]
                            )
                        }
                    }
                }

                applySectionData(
                    this.data.sections[sectionIndex],
                    data.sections[sectionIndex]
                )

                for (
                    let i = 0;
                    i < this.data.sections[sectionIndex].nodes.length;
                    i++
                ) {
                    if (
                        !this.types.includes(
                            this.data.sections[sectionIndex].nodes[i].type
                        )
                    ) {
                        this.types.push(
                            this.data.sections[sectionIndex].nodes[i].type
                        )
                    }
                }
            }
        }

        if (typeof data.template === 'object') {
            delete data.template.name
            delete data.template.plainText
            delete data.template.url
            delete data.template.database
            delete data.template.nodes

            if (typeof data.template.text === 'object') {
                applyNodeData(this.data.template.text, data.template.text)
            }
            delete data.template.text

            if (typeof data.template.image === 'object') {
                applyNodeData(this.data.template.image, data.template.image)
            }
            delete data.template.image

            applySectionData(this.data.template, data.template)
        }
    }

    getData() {
        return {
            itemType: 'multi',

            sections: this.data.sections,

            template: this.data.template
        }
    }
}

module.exports.template = {
    nodes: [
        {
            type: 'text',
            map: 'text',
            name: 'Text',

            properties: {
                font: true,
                size: true,
                color: true,

                lineHeight: true,

                align: true,

                y: true,

                opacity: true,

                top: true,
                left: true,
                right: true,
                bottom: true
            }
        },
        {
            type: 'image',
            map: 'image',
            name: 'Image',

            properties: {
                scale: true,

                opacity: true,

                top: true,
                left: true,
                right: true,
                bottom: true
            }
        }
    ],
    options: []
}

module.exports.name = 'Multi'
