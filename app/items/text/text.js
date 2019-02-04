const richText = require('dw-rich-text')
const isColor = require('dw-color').isColor

function applySectionData(target, source = {}) {
    if (typeof source.name === 'string') {
        target.name = source.name
    }

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

    if (
        source.align === 'left' ||
        source.align === 'center' ||
        source.align == 'right'
    ) {
        target.align = source.align
    }

    if (source.y === 'top' || source.y === 'center' || source.y === 'bottom') {
        target.y = source.y
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

module.exports = class Text {
    constructor(data = {}, template = {}) {
        this.data = {
            sections: [],

            maxLines: 4,

            template: {
                font: 'Arial',
                size: 100,
                color: 'white',

                lineHeight: 1.5,

                background: 'black',
                backgroundImage: '',
                backgroundScale: 'fill',

                align: 'center',
                y: 'top',

                top: 10,
                left: 10,
                right: 90,
                bottom: 90,

                playTime: 0,
                autoPlay: false,

                transition: {
                    type: 'fade',
                    origin: 'center',
                    time: 0
                }
            }
        }

        if (typeof template === 'object') {
            delete template.name
            delete template.text
            delete template.plainText

            applySectionData(this.data.template, template)

            if (
                typeof template.maxLines === 'number' &&
                isFinite(template.maxLines) &&
                template.maxLines >= 0
            ) {
                this.data.maxLines = template.maxLines
            }
        }

        if (typeof data === 'object') {
            if (Array.isArray(data.sections)) {
                for (let i = 0; i < data.sections.length; i++) {
                    this.data.sections.push(
                        applySectionData({ name: '' }, this.data.template)
                    )

                    applySectionData(
                        this.data.sections[this.data.sections.length - 1],
                        data.sections[i]
                    )

                    applySectionData(this.data.template, data.sections[i])
                }
            }

            //the template object should have style informaiton, and no name/text/plainText
            delete this.data.template.name
            delete this.data.template.text
            delete this.data.template.plainText

            if (
                typeof data.maxLines === 'number' &&
                isFinite(data.maxLines) &&
                data.maxLines >= 0
            ) {
                this.data.maxLines = data.maxLines
            }
        }
    }

    get title() {
        return this.data.sections.length === 0 || this.data.sections.length > 1
            ? 'Text'
            : ''
    }

    get sections() {
        let sections = []

        for (
            let sectionIndex = 0;
            sectionIndex < this.data.sections.length;
            sectionIndex++
        ) {
            let section = this.data.sections[sectionIndex]

            let sectionParts = richText.distributeLines(
                this.data.sections[sectionIndex].text,
                this.data.maxLines
            )

            if (sectionParts.length === 1) {
                sections.push({
                    title: section.name,
                    content: section.plainText,

                    display: {
                        background: section.background,
                        backgroundImage: section.backgroundImage,
                        backgroundScale: section.backgroundScale,

                        nodes: [
                            {
                                type: 'text',

                                text: section.text,
                                plainText: section.plainText,

                                font: section.font,
                                size: section.size,
                                color: section.color,

                                lineHeight: section.lineHeight,

                                align: section.align,
                                y: section.y,

                                top: section.top,
                                left: section.left,
                                right: section.right,
                                bottom: section.bottom
                            }
                        ],

                        playTime: section.playTime,
                        autoPlay: section.autoPlay,

                        transition: {
                            type: section.transition.type,
                            time: section.transition.time
                        }
                    }
                })
            } else {
                for (
                    let partIndex = 0;
                    partIndex < sectionParts.length;
                    partIndex++
                ) {
                    sections.push({
                        title:
                            section.name +
                            ' - ' +
                            String.fromCharCode(97 + partIndex),
                        content: richText.removeFormat(sectionParts[partIndex]),

                        display: {
                            background: section.background,
                            backgroundImage: section.backgroundImage,
                            backgroundScale: section.backgroundScale,

                            nodes: [
                                {
                                    type: 'text',

                                    text: sectionParts[partIndex],
                                    plainText: richText.removeFormat(
                                        sectionParts[partIndex]
                                    ),

                                    font: section.font,
                                    size: section.size,
                                    color: section.color,

                                    lineHeight: section.lineHeight,

                                    align: section.align,
                                    y: section.y,

                                    top: section.top,
                                    left: section.left,
                                    right: section.right,
                                    bottom: section.bottom
                                }
                            ],

                            playTime: section.playTime,
                            autoPlay: section.autoPlay,

                            transition: {
                                type: section.transition.type,
                                time: section.transition.time
                            }
                        }
                    })
                }
            }
        }

        return sections
    }

    getTextUnifySections() {
        let allSections = []

        for (
            let sectionIndex = 0;
            sectionIndex < this.data.sections.length;
            sectionIndex++
        ) {
            let parts = richText.distributeLines(
                this.data.sections[sectionIndex].text,
                this.data.maxLines
            )

            for (let j = 0; j < parts.length; j++) {
                allSections.push({
                    text: parts[j],

                    font: this.data.sections[sectionIndex].font,
                    size: this.data.sections[sectionIndex].size,

                    lineHeight: this.data.sections[sectionIndex].lineHeight,

                    top: this.data.sections[sectionIndex].top,
                    left: this.data.sections[sectionIndex].left,
                    right: this.data.sections[sectionIndex].right,
                    bottom: this.data.sections[sectionIndex].bottom
                })
            }
        }

        return [allSections]
    }

    unifyTextSections(sizes) {
        if (Array.isArray(sizes) && sizes.length >= 1 && isFinite(sizes[0])) {
            for (
                let sectionIndex = 0;
                sectionIndex < this.data.sections.length;
                sectionIndex++
            ) {
                applySectionData(this.data.sections[sectionIndex], {
                    size: sizes[0]
                })
            }
        }
    }

    edit(data = {}) {
        //if sections have been removed
        if (Array.isArray(data.sections)) {
            if (data.sections.length < this.data.sections.length) {
                this.data.sections.length = data.sections.length
            }

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
            }

            //if more sections have been added
            for (
                let sectionIndex = this.data.sections.length;
                sectionIndex < data.sections.length;
                sectionIndex++
            ) {
                this.data.sections.push(Object.assign({}, this.data.template))

                this.data.sections[this.data.sections.length - 1].text = ''
                this.data.sections[this.data.sections.length - 1].plainText = ''

                applySectionData(
                    this.data.sections[this.data.sections.length - 1],
                    data.sections[sectionIndex]
                )
            }
        }

        if (typeof data.template === 'object') {
            delete data.template.name
            delete data.template.text
            delete data.template.plainText

            applySectionData(this.data.template, data.template)
        }

        if (
            typeof data.maxLines === 'number' &&
            isFinite(data.maxLines) &&
            data.maxLines >= 0
        ) {
            this.data.maxLines = data.maxLines
        }
    }

    getSaveData() {
        return {
            itemType: 'text',

            sections: this.data.sections.map(section => {
                return {
                    name: section.name,

                    text: richText.clean(section.text),
                    plainText: section.plainText
                }
            })
        }
    }

    getAllSaveData() {
        return {
            itemType: 'text',

            maxLines: this.data.maxLines,

            sections: this.data.sections.map(section => {
                section.text = richText.clean(section.text)

                return section
            }),
            template: this.data.template
        }
    }

    getEditData() {
        return this.getAllSaveData()
    }
}
