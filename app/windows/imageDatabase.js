const path = require('path')

const layout = require('dw-layout')
const logger = require('dw-log')
const Database = require('dw-database')

const Images = new Database('images', {
    extensions: 'image',
    load: false,
    parse: false
})

const imageAddButton = new layout.FileInput({
    open: true,

    text: 'Add Images',
    button: 'Add',

    multi: true,

    filters: [
        {
            name: 'Images',
            extensions: Images.extensions.map(ext => ext.replace('.', ''))
        }
    ]
})
const imageList = new layout.List({
    reoderable: false,
    editButton: false,
    removeButton: true,

    addInput: false
})

const imageTitle = new layout.Text(
    {},
    {
        overflow: 'ellipsis'
    }
)
const imagePreview = new layout.Image(
    {
        color: 'rgb(128, 128, 128)'
    },
    {
        shrink: 1,
        grow: 1,
        size: 'fill',

        align: 'stretch',
        height: 'auto',

        border: true
    }
)

layout.body.add(
    new layout.LayoutBlock({
        items: [
            new layout.LayoutBlock({
                items: [
                    new layout.Block(
                        {
                            items: [imageAddButton, imageList],
                            childSpacing: '8px'
                        },
                        {
                            direction: 'vertical'
                        }
                    )
                ],

                minWidth: 200,
                maxWidth: 500,
                minHeight: 200,
                size: 30
            }),
            new layout.LayoutBlock({
                items: [
                    new layout.Block(
                        {
                            items: [imageTitle, imagePreview],
                            childSpacing: '8px'
                        },
                        {
                            direction: 'vertical'
                        }
                    )
                ],

                minWidth: 100,
                minHeight: 100,
                size: 70
            })
        ],

        direction: 'horizontal',
        small: true
    })
)

function updateImageList(toSelect) {
    if (typeof toSelect !== 'string') {
        toSelect = imageList.selected
    }

    imageList.clear()

    Images.files.forEach(image => {
        imageList.add(image)
    })

    if (imageList.indexOf(toSelect) !== -1) {
        imageList.select(toSelect, false, true)
    } else {
        imageList.select(0, false, true)
    }
}

imageList.onEvent('select', event => {
    let image = Images.files.find(image => image === event.text)

    if (!image) {
        return false
    }

    imageTitle.text = image
    imagePreview.url = path.join(Images.directory, image)
})

imageList.onEvent('remove', event => {
    if (!event.fromUser) {
        return false
    }

    if (!Images.files.includes(event.text)) {
        return false
    }

    Images.remove(event.text, error => {
        if (error) {
            layout.dialog.showError({
                message: 'Unable to delete image',
                detail: error.message || error.toString()
            })

            logger.error("Couldn't remove image from database", error)
        }

        if (Images.files.length === 0) {
            imagePreview.url = ''
            imageTitle.text = ''
        }
    })
})

imageAddButton.onEvent('open', event => {
    let toAdd = event.files

    let addNext = () => {
        if (toAdd.length === 0) {
            return false
        }

        file = toAdd.pop()

        let uniqueFileName = Images.getUniqueName(path.win32.basename(file))

        Images.saveFromExternal(uniqueFileName, file, error => {
            if (error) {
                layout.dialog.showError({
                    message: 'Unable to add image "' + uniqueFileName,
                    detail: error.message || error.toString()
                })

                logger.error("Couldn't save image to database!", error)
            }

            imageList.select(uniqueFileName)

            addNext()
        })
    }

    addNext()
})

Images.onEvent('update-start', () => {
    layout.showLoader(imageList)
})

Images.onEvent('update', () => {
    layout.hideLoader(imageList)

    updateImageList()
})

Images.onEvent('error', error => {
    layout.dialog.showNotification({
        type: 'error',
        autoHide: false,

        message: 'There is an error with the Image database!\n' + error.message
    })
})
