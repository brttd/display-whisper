const richText = require('dw-rich-text')
const { isColor } = require('dw-color')

const defaultTemplate = {
    background: 'white',
    backgroundImage: '',
    backgroundScale: 'fill',

    font: 'Arial',
    size: 65,
    color: 'black',

    lineHeight: 1.5,

    align: 'center',

    y: 'center',
    x: 'fill',

    top: 12,
    left: 10,
    right: 90,
    bottom: 88,

    playTime: 0,
    autoPlay: false,

    maxLines: 6,

    transition: {
        type: 'fade',
        origin: 'center',
        time: 0
    },

    sectionOverlay: {
        show: true,

        text: '{section}',
        plainText: '{section}',

        font: 'Arial',
        size: 50,
        color: 'black',

        lineHeight: 1.5,

        align: 'right',

        y: 'top',
        x: 'fill',

        top: 1,
        left: 65,
        right: 96,
        bottom: 11
    },

    endOverlay: {
        show: true,

        text: '{copyright:Final Verse}',
        plainText: '{copyright:Final Verse}',

        font: 'Arial',
        size: 50,
        color: 'black',

        lineHeight: 1.5,

        align: 'left',

        y: 'center',
        x: 'fill',

        top: 89,
        left: 4,
        right: 50,
        bottom: 99
    },

    intro: {
        text: '{name}\n{author}',

        align: 'center',
        y: 'bottom',

        top: 30,
        left: 30,
        right: 70,
        bottom: 50
    },
    outro: {
        text: '{name}\n{copyright} - {author}',

        align: 'center',
        y: 'bottom',

        top: 30,
        left: 30,
        right: 70,
        bottom: 50
    },

    blank: {}
}

//These strings should never be used for a section name
const introName = 'Song - Intro'
const outroName = 'Song - Outro'
const blankName = 'Song - Blank'

const textUnifyOrder = [
    'sections',
    'intro',
    'outro',
    'sectionOverlay',
    'endOverlay'
]

function applyBackgroundStyle(target, source = {}) {
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

    return target
}

function applyPlayData(target, source = {}) {
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

function applyStyleData(target, source = {}) {
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

    applyBackgroundStyle(target, source)

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

    return target
}

function applyDisplayData(target, source = {}) {
    applyBackgroundStyle(target, source)
    applyPlayData(target, source)

    return target
}

function applySectionData(target, source = {}) {
    //main content:
    if (typeof source.text === 'string') {
        target.text = source.text

        //If there isn't plainText provided, extract it from the text
        if (
            typeof source.plainText !== 'string' ||
            (source.plainText === '' && source.text !== '')
        ) {
            source.plainText = richText.removeFormat(source.text)
        }
    } else if (typeof source.plainText === 'string') {
        //if text isn't provided, but plainText is, then use the plainText
        target.text = richText.format(source.plainText)
    }

    if (typeof source.plainText === 'string') {
        target.plainText = source.plainText
    }

    applyStyleData(target, source)

    applyPlayData(target, source)

    return target
}

function applySongData(target, source = {}) {
    if (typeof source.group === 'string') {
        target.group = source.group
    }

    if (
        typeof source.groupID === 'number' &&
        isFinite(source.groupID) &&
        source.groupID >= 0
    ) {
        target.groupID = source.groupID
    }
    if (typeof source.name === 'string') {
        target.name = source.name
    }
    if (typeof source.author === 'string') {
        target.author = source.author
    }
    if (typeof source.copyright === 'string') {
        target.copyright = source.copyright
    }

    if (
        typeof source.maxLines === 'number' &&
        isFinite(source.maxLines) &&
        source.maxLines >= 0
    ) {
        target.maxLines = source.maxLines
    }

    if (typeof source.sectionOverlay === 'object') {
        delete source.sectionOverlay.transition

        if (typeof source.sectionOverlay.show === 'boolean') {
            target.sectionOverlay.show = source.sectionOverlay.show
        }

        applySectionData(target.sectionOverlay, source.sectionOverlay)
    }

    if (typeof source.endOverlay === 'object') {
        delete source.endOverlay.transition

        if (typeof source.endOverlay.show === 'boolean') {
            target.endOverlay.show = source.endOverlay.show
        }

        applySectionData(target.endOverlay, source.endOverlay)
    }

    return target
}

function updateTemplate(target, source = {}) {
    delete source.group
    delete source.groupID
    delete source.name
    delete source.author
    delete source.copyright
    delete source.text
    delete source.plainText

    applySectionData(target, source)

    let special = {
        font: source.font,
        size: source.size,
        color: source.color,

        lineHeight: source.lineHeight,

        background: source.background,
        backgroundImage: source.backgroundImage,
        backgroundScale: source.backgroundScale
    }

    applySectionData(target.intro, special)
    applySectionData(target.outro, special)
    applySectionData(target.blank, special)

    if (typeof source.sectionOverlay === 'object') {
        delete source.sectionOverlay.transition

        if (typeof source.sectionOverlay.show === 'boolean') {
            target.sectionOverlay.show = source.sectionOverlay.show
        }

        applySectionData(target.sectionOverlay, source.sectionOverlay)
    }
    if (typeof source.endOverlay === 'object') {
        delete source.endOverlay.transition

        if (typeof source.endOverlay.show === 'boolean') {
            target.endOverlay.show = source.endOverlay.show
        }

        applySectionData(target.endOverlay, source.endOverlay)
    }

    if (typeof source.intro === 'object') {
        applySectionData(target.intro, source.intro)
    }

    if (typeof source.outro === 'object') {
        applySectionData(target.outro, source.outro)
    }

    if (typeof source.blank === 'object') {
        delete source.blank.text
        delete source.blank.plainText

        applySectionData(target.blank, source.blank)
    }
}

function applyTemplate(target, source = {}) {
    updateTemplate(target.template, source)

    applySongData(target, source)

    if (typeof target.sectionOverlay === 'object') {
        if (typeof target.template.sectionOverlay.show === 'boolean') {
            target.sectionOverlay.show = target.template.sectionOverlay.show
        }

        applySectionData(target.sectionOverlay, target.template.sectionOverlay)
    }
    if (typeof target.endOverlay === 'object') {
        if (typeof target.template.endOverlay.show === 'boolean') {
            target.endOverlay.show = target.template.endOverlay.show
        }

        applySectionData(target.endOverlay, target.template.endOverlay)
    }

    if (typeof target.intro === 'object') {
        applySectionData(target.intro, target.template.intro)
    }
    if (typeof target.outro === 'object') {
        applySectionData(target.outro, target.template.outro)
    }
    if (typeof target.blank === 'object') {
        applySectionData(target.blank, target.template.blank)
    }

    for (let section in target.sections) {
        applySectionData(target.sections[section], target.template)
    }

    return target
}

module.exports = class Song {
    constructor(data = {}, template = false) {
        this.data = {
            group: '',
            groupID: 0,
            name: '',
            author: '',
            copyright: '',

            template: {
                sectionOverlay: {},
                endOverlay: {},

                transition: {},

                intro: {
                    transition: {}
                },
                outro: {
                    transition: {}
                },
                blank: {
                    transition: {}
                }
            },

            maxLines: 6,

            sections: {},

            sectionOverlay: {},
            endOverlay: {},

            intro: { transition: {} },
            outro: { transition: {} },
            blank: { transition: {} },

            playOrder: []
        }

        applyTemplate(this.data, defaultTemplate)

        if (typeof template === 'object') {
            applyTemplate(this.data, template)
        }

        if (typeof data === 'object') {
            if (typeof data.template === 'object') {
                applyTemplate(this.data, data.template)
            }

            applySongData(this.data, data)

            if (Array.isArray(data.sections)) {
                for (let i = 0; i < data.sections.length; i++) {
                    if (data.sections[i].name) {
                        this.addSection(data.sections[i].name, data.sections[i])
                    }
                }
            } else if (typeof data.sections === 'object') {
                for (let section in data.sections) {
                    this.addSection(section, data.sections[section])
                }
            }

            this.data.playOrder = []

            let sections = Object.keys(this.data.sections)

            if (Array.isArray(data.playOrder)) {
                for (let i = 0; i < data.playOrder.length; i++) {
                    if (
                        sections.includes(data.playOrder[i]) ||
                        data.playOrder[i] === introName ||
                        data.playOrder[i] === outroName ||
                        data.playOrder[i] === blankName
                    ) {
                        this.data.playOrder.push(data.playOrder[i])
                    }
                }
            } else {
                this.data.playOrder = sections
            }

            if (typeof template === 'object') {
                if (template.showIntro === true) {
                    this.data.playOrder.unshift(introName)
                }
                if (template.startBlank === true) {
                    this.data.playOrder.unshift(blankName)
                }

                if (template.showOutro === true) {
                    this.data.playOrder.push(outroName)
                }
                if (template.endBlank === true) {
                    this.data.playOrder.push(blankName)
                }
            }
        }

        this.addSection(introName, this.data.intro)
        this.addSection(outroName, this.data.outro)
        this.addSection(blankName, this.data.blank)
    }

    get title() {
        return this.data.name + ', by ' + this.data.author
    }

    get sections() {
        let sections = []

        for (let i = 0; i < this.data.playOrder.length; i++) {
            if (this.data.playOrder[i] === introName) {
                let text = this._replaceText(this.data.intro.text)

                sections.push({
                    title: 'Intro',
                    content: richText.removeFormat(text),

                    display: applyDisplayData(
                        {
                            nodes: [
                                applyStyleData(
                                    {
                                        type: 'text',

                                        text: text,
                                        plainText: richText.removeFormat(text)
                                    },
                                    this.data.intro
                                )
                            ]
                        },
                        this.data.intro
                    )
                })
            } else if (this.data.playOrder[i] === outroName) {
                let text = this._replaceText(this.data.outro.text)

                sections.push({
                    title: 'Outro',
                    content: richText.removeFormat(text),

                    display: applyDisplayData(
                        {
                            nodes: [
                                applyStyleData(
                                    {
                                        type: 'text',

                                        text: text,
                                        plainText: richText.removeFormat(text)
                                    },
                                    this.data.outro
                                )
                            ]
                        },
                        this.data.outro
                    )
                })
            } else if (this.data.playOrder[i] === blankName) {
                sections.push({
                    title: 'Blank',
                    content: '',

                    display: applyDisplayData({ nodes: [] }, this.data.blank)
                })
            } else if (
                this.data.sections.hasOwnProperty(this.data.playOrder[i])
            ) {
                sections = sections.concat(
                    this._getSectionDisplay(
                        this.data.sections[this.data.playOrder[i]],
                        this.data.playOrder[i],
                        i
                    )
                )
            }
        }

        if (this.data.endOverlay.show) {
            //Find the last section which isn't intro/outro/blank

            let index = -1
            for (let i = 0; i < sections.length; i++) {
                if (
                    sections[i].title !== 'Intro' &&
                    sections[i].title !== 'Outro' &&
                    sections[i].title !== 'Blank'
                ) {
                    index = i
                }
            }

            if (index !== -1) {
                let text = this._replaceText(this.data.endOverlay.text)

                sections[index].display.nodes.push(
                    applyStyleData(
                        {
                            type: 'text',

                            text: text,
                            plainText: richText.removeFormat(text)
                        },
                        this.data.endOverlay
                    )
                )
            }
        }

        return sections
    }

    _getSectionDisplay(section, name, index) {
        let totalSections = this.data.playOrder.reduce((count, section) => {
            if (
                section !== introName &&
                section !== outroName &&
                section !== blankName
            ) {
                count += 1
            }

            return count
        }, 0)
        let sectionIndex = this.data.playOrder.reduce(
            (count, section, orderIndex) => {
                if (orderIndex <= index) {
                    if (
                        section !== introName &&
                        section !== outroName &&
                        section !== blankName
                    ) {
                        count += 1
                    }
                }

                return count
            },
            0
        )

        let sectionTexts = richText.distributeLines(
            section.text,
            this.data.maxLines
        )

        let sections = []

        //return sections

        for (let i = 0; i < sectionTexts.length; i++) {
            sections.push({
                title:
                    (name || '') +
                    (sectionTexts.length === 1
                        ? ''
                        : ' - ' + String.fromCharCode(97 + i)),
                content: richText.removeFormat(sectionTexts[i]),

                display: applyDisplayData(
                    {
                        nodes: [
                            applyStyleData(
                                {
                                    type: 'text',

                                    text: sectionTexts[i],
                                    plainText: richText.removeFormat(
                                        sectionTexts[i]
                                    )
                                },
                                section
                            )
                        ]
                    },
                    section
                )
            })

            if (this.data.sectionOverlay.show) {
                let text = this._replaceText(this.data.sectionOverlay.text)

                text = richText.dataReplace(text, {
                    section: richText.format(name),

                    sectionParts: richText.format(
                        sectionTexts.length.toString()
                    ),
                    sectionPart: richText.format((i + 1).toString()),
                    sectionSplit:
                        sectionTexts.length > 1
                            ? richText.format(
                                  (i + 1).toString() +
                                      '/' +
                                      sectionTexts.length.toString()
                              )
                            : '',

                    index: richText.format(sectionIndex.toString()),
                    total: richText.format(totalSections.toString())
                })

                sections[sections.length - 1].display.nodes.push(
                    applyStyleData(
                        {
                            type: 'text',
                            text: text,
                            plainText: richText.removeFormat(text)
                        },
                        this.data.sectionOverlay
                    )
                )
            }
        }

        return sections
    }

    _replaceText(text = '') {
        return richText.dataReplace(text, {
            name: richText.format(this.data.name),
            author: richText.format(this.data.author),
            copyright: richText.format(this.data.copyright)
        })
    }

    getTextUnifySections() {
        let arrays = {
            sections: [],
            intro: [],
            outro: [],
            sectionOverlay: [],
            endOverlay: []
        }

        let totalSectionCount = this.data.playOrder.reduce((count, section) => {
            if (
                section !== introName &&
                section !== outroName &&
                section !== blankName
            ) {
                count += 1
            }

            return count
        }, 0)

        for (let section in this.data.sections) {
            let parts = richText.distributeLines(
                this.data.sections[section].text,
                this.data.maxLines
            )

            for (let partIndex = 0; partIndex < parts.length; partIndex++) {
                arrays.sections.push({
                    text: parts[partIndex],

                    font: this.data.sections[section].font,
                    size: this.data.sections[section].size,

                    lineHeight: this.data.sections[section].lineHeight,

                    top: this.data.sections[section].top,
                    left: this.data.sections[section].left,
                    right: this.data.sections[section].right,
                    bottom: this.data.sections[section].bottom
                })

                let sectionOverlayText = this._replaceText(
                    this.data.sectionOverlay.text
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
                            : '',

                    //Note: The section overlay is tested once per section, NOT once per play order section
                    //Since the only value which changes inbetween repeats of the same section is {index}, the total count of sections is being used instead.
                    //This generally shouldn't be a problem, but if there are than 9 sections in the play order, all of them will be tested with a two digit {index} value (And if more than 99, with three digits).
                    index: richText.format(totalSectionCount.toString()),
                    total: richText.format(totalSectionCount.toString())
                })

                arrays.sectionOverlay.push({
                    text: sectionOverlayText,

                    font: this.data.sectionOverlay.font,
                    size: this.data.sectionOverlay.size,

                    lineHeight: this.data.sectionOverlay.lineHeight,

                    top: this.data.sectionOverlay.top,
                    left: this.data.sectionOverlay.left,
                    right: this.data.sectionOverlay.right,
                    bottom: this.data.sectionOverlay.bottom
                })
            }
        }

        arrays.endOverlay.push({
            text: this._replaceText(this.data.endOverlay.text),

            font: this.data.endOverlay.font,
            size: this.data.endOverlay.size,

            lineHeight: this.data.endOverlay.lineHeight,

            top: this.data.endOverlay.top,
            left: this.data.endOverlay.left,
            right: this.data.endOverlay.right,
            bottom: this.data.endOverlay.bottom
        })

        arrays.intro.push({
            text: this._replaceText(this.data.intro.text),

            font: this.data.intro.font,
            size: this.data.intro.size,

            lineHeight: this.data.intro.lineHeight,

            top: this.data.intro.top,
            left: this.data.intro.left,
            right: this.data.intro.right,
            bottom: this.data.intro.bottom
        })
        arrays.outro.push({
            text: this._replaceText(this.data.outro.text),

            font: this.data.outro.font,
            size: this.data.outro.size,

            lineHeight: this.data.outro.lineHeight,

            top: this.data.outro.top,
            left: this.data.outro.left,
            right: this.data.outro.right,
            bottom: this.data.outro.bottom
        })

        let joined = []

        for (let i = 0; i < textUnifyOrder.length; i++) {
            if (arrays.hasOwnProperty(textUnifyOrder[i])) {
                joined.push(arrays[textUnifyOrder[i]])
            } else {
                joined.push([])
            }
        }

        return joined
    }
    unifyTextSections(sizes) {
        if (!Array.isArray(sizes)) {
            return false
        }

        for (let i = 0; i < sizes.length && i < textUnifyOrder.length; i++) {
            if (isFinite(sizes[i]) && sizes[i] >= 0) {
                if (textUnifyOrder[i] === 'sections') {
                    for (let section in this.data.sections) {
                        applySectionData(this.data.sections[section], {
                            size: sizes[i]
                        })
                    }
                } else if (this.data.hasOwnProperty(textUnifyOrder[i])) {
                    applySectionData(this.data[textUnifyOrder[i]], {
                        size: sizes[i]
                    })
                }
            }
        }
    }

    addSection(name, data = {}) {
        if (name === introName) {
            applySectionData(this.data.intro, this.data.template)
            applySectionData(this.data.intro, this.data.template.intro)

            applySectionData(this.data.intro, data)
        } else if (name === outroName) {
            applySectionData(this.data.outro, this.data.template)
            applySectionData(this.data.outro, this.data.template.outro)

            applySectionData(this.data.outro, data)
        } else if (name === blankName) {
            delete data.text
            delete data.plainText

            applySectionData(this.data.blank, this.data.template)
            applySectionData(this.data.blank, this.data.template.blank)

            applySectionData(this.data.blank, data)
        } else {
            this.data.sections[name] = {
                text: '',
                plainText: '',

                transition: {}
            }

            applySectionData(this.data.sections[name], this.data.template)

            applySectionData(this.data.sections[name], data)
        }
    }

    edit(data = {}) {
        applySongData(this.data, data)

        if (typeof data.template === 'object') {
            updateTemplate(this.data.template, data.template)
        }

        if (typeof data.intro === 'object') {
            applySectionData(this.data.intro, data.intro)
        }

        if (typeof data.outro === 'object') {
            applySectionData(this.data.outro, data.outro)
        }

        if (typeof data.blank === 'object') {
            delete data.text
            delete data.plainText

            applySectionData(this.data.blank, data.blank)
        }

        if (typeof data.sections === 'object') {
            for (let section in data.sections) {
                if (this.data.sections.hasOwnProperty(section)) {
                    applySectionData(
                        this.data.sections[section],
                        data.sections[section]
                    )
                } else {
                    this.addSection(section, data.sections[section])
                }
            }
        }

        if (Array.isArray(data.playOrder)) {
            this.data.playOrder = []

            for (let i = 0; i < data.playOrder.length; i++) {
                if (
                    this.data.sections.hasOwnProperty(data.playOrder[i]) ||
                    data.playOrder[i] === introName ||
                    data.playOrder[i] === outroName ||
                    data.playOrder[i] === blankName
                ) {
                    this.data.playOrder.push(data.playOrder[i])
                }
            }
        }
    }

    getSaveData() {
        let sections = {}
        for (let section in this.data.sections) {
            sections[section] = {
                text: richText.clean(this.data.sections[section].text),
                plainText: this.data.sections[section].plainText
            }
        }

        return {
            itemType: 'song',

            group: this.data.group,
            groupID: this.data.groupID,

            name: this.data.name,
            author: this.data.author,
            copyright: this.data.copyright,

            sections: sections,

            playOrder: this.data.playOrder
        }
    }

    getAllSaveData() {
        return {
            itemType: 'song',

            group: this.data.group,
            groupID: this.data.groupID,

            name: this.data.name,
            author: this.data.author,
            copyright: this.data.copyright,

            template: this.data.template,

            maxLines: this.data.maxLines,

            sections: this.data.sections,

            intro: this.data.intro,
            outro: this.data.outro,
            blank: this.data.blank,

            sectionOverlay: this.data.sectionOverlay,
            endOverlay: this.data.endOverlay,

            playOrder: this.data.playOrder
        }
    }

    getEditData() {
        return this.getAllSaveData()
    }
}
