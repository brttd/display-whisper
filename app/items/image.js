const { isColor } = require('dw-color')

function basename(name) {
    return name.split(/[\/\\]/).pop()
}

function applyData(target, source = {}) {
    if (typeof source.url === 'string') {
        target.url = source.url
    }

    if (typeof source.database === 'boolean') {
        target.database = source.database
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
        source.scale === 'fill' ||
        source.scale === 'fit' ||
        source.scale === 'stretch'
    ) {
        target.scale = source.scale
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

module.exports = class Image {
    constructor(data = {}, template = {}) {
        this.data = {
            url: '',

            database: false,

            background: 'black',
            backgroundImage: '',
            backgroundScale: 'fill',

            top: 0,
            left: 0,
            right: 100,
            bottom: 100,

            scale: 'fit',

            playTime: 0,
            autoPlay: false,

            transition: {
                type: 'fade',
                origin: 'center',
                time: 0
            }
        }

        if (typeof template === 'object') {
            delete template.url
            delete template.database

            applyData(this.data, template)
        }

        if (typeof data === 'object') {
            applyData(this.data, data)
        }
    }

    get sections() {
        return [
            {
                title: basename(this.data.url),
                content: this.data.database
                    ? basename(this.data.url)
                    : this.data.url,

                display: {
                    background: this.data.background,
                    backgroundImage: this.data.backgroundImage,
                    backgroundScale: this.data.backgroundScale,

                    nodes: [
                        {
                            type: 'image',

                            url: this.data.url,

                            database: this.data.database,

                            scale: this.data.scale,

                            top: this.data.top,
                            left: this.data.left,
                            right: this.data.right,
                            bottom: this.data.bottom
                        }
                    ],

                    playTime: this.data.playTime,
                    autoPlay: this.data.autoPlay,

                    transition: {
                        type: this.data.transition.type,
                        time: this.data.transition.time
                    }
                }
            }
        ]
    }

    getTextUnifySections() {
        return []
    }
    unifyTextSections() {}

    edit(data = {}) {
        applyData(this.data, data)
    }

    getSaveData() {
        return {
            itemType: 'image',

            url: this.data.url,
            database: this.data.database
        }
    }

    getAllSaveData() {
        return {
            itemType: 'image',

            url: this.data.url,
            database: this.data.database,

            background: this.data.background,
            backgroundImage: this.data.backgroundImage,
            backgroundScale: this.data.backgroundScale,

            scale: this.data.scale,

            top: this.data.top,
            left: this.data.left,
            right: this.data.right,
            bottom: this.data.bottom,

            playTime: this.data.playTime,
            autoPlay: this.data.autoPlay,

            transition: {
                type: this.data.transition.type,
                time: this.data.transition.time
            }
        }
    }

    getEditData() {
        return this.getAllSaveData()
    }
}

module.exports.template = {
    nodes: [
        {
            type: 'image',
            map: '',
            name: 'Main',
            properties: {
                scale: true,
                top: true,
                left: true,
                right: true,
                bottom: true
            }
        }
    ],
    options: []
}
