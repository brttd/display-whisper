const pdfjs = require('../pdfjs/pdf')
pdfjs.GlobalWorkerOptions.workerSrc = '../pdfjs/pdf.worker.js'

const { isColor } = require('dw-color')

function applyData(target, source = {}) {
    if (typeof source.file === 'string') {
        target.file = source.file
    }

    if (isColor(source.background)) {
        target.background = source.background
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

module.exports = class PDF {
    constructor(data = {}, template = {}) {
        this.data = {
            file: '',

            background: 'black',

            playTime: 0,
            autoPlay: false,

            transition: {
                type: 'fade',
                origin: 'center',
                time: 0
            }
        }

        this.document = null

        this.listeners = []

        if (typeof template === 'object') {
            delete template.file

            applyData(this.data, template)
        }

        if (typeof data === 'object') {
            applyData(this.data, data)
        }

        this.loadDocument()
    }

    get title() {
        if (this.metadata && this.metadata.info && this.metadata.info.Title) {
            return (
                this.metadata.info.Title +
                (this.metadata.info.Author
                    ? ' (' + this.metadata.info.Author + ')'
                    : '')
            )
        } else {
            return this.loading ? '[LOADING] ' : '' + 'PDF'
        }
    }

    get sections() {
        if (!this.document) {
            return []
        }

        let sections = []

        for (let i = 0; i < this.document.numPages; i++) {
            sections.push({
                title: 'Page ' + (i + 1),

                display: {
                    background: this.data.background,

                    pdfDocument: this.data.file,
                    pdfDocumentPage: i + 1,

                    nodes: [
                        {
                            type: 'pdf',
                            file: this.data.file,
                            page: i + 1,

                            top: 0,
                            left: 0,
                            right: 100,
                            bottom: 100
                        }
                    ],

                    playTime: this.data.playTime,
                    autoPlay: this.data.autoPlay,

                    transition: {
                        type: this.data.transition.type,
                        time: this.data.transition.time
                    }
                }
            })
        }

        return sections
    }

    loadDocument() {
        if (!this.data.file) {
            this.document = null
            this.metadata = null
            this.loadedFile = null

            this._emitChange()

            return false
        }

        if (this.loadedFile === this.data.file) {
            return false
        }

        this.loading = true

        let file = this.data.file

        pdfjs
            .getDocument({
                url: 'file://' + this.data.file,

                disableFontFace: false
            })
            .promise.then(
                pdf => {
                    this.loading = false

                    this.loadedFile = file
                    this.document = pdf
                    this.metadata = null

                    this.document.getMetadata().then(
                        result => {
                            this.metadata = result

                            this._emitChange()
                        },
                        () => {
                            this.metadata = null
                            this._emitChange()
                        }
                    )
                },
                error => {
                    this.loading = false

                    this.loadedFile = null
                    this.document = null
                    this.metadata = null

                    console.error(error)

                    this._emitChange()
                }
            )
    }

    onChange(listener) {
        if (typeof listener === 'function') {
            this.listeners.push(listener)
        }
    }
    _emitChange() {
        for (let i = 0; i < this.listeners.length; i++) {
            this.listeners[i]()
        }
    }

    getTextUnifySections() {
        return []
    }
    unifyTextSections() {}

    edit(data = {}) {
        applyData(this.data, data)

        this.loadDocument()
    }

    getData() {
        return {
            itemType: 'pdf',

            file: this.data.file,

            background: this.data.background,

            playTime: this.data.playTime,
            autoPlay: this.data.autoPlay,

            transition: {
                type: this.data.transition.type,
                time: this.data.transition.time
            }
        }
    }
}

module.exports.template = {
    nodes: [],
    options: []
}
