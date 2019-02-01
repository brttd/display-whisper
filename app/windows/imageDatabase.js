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
const imageList = new layout.TableList({
    columns: 2,
    columnWidths: ['', '5ch']
})

const removeAllButton = new layout.Button({
    text: 'Remove All'
})

const imageTitle = new layout.Text(
    {},
    {
        overflow: 'ellipsis',
        grow: 1,
        align: 'center',
        textAlign: 'left'
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

const removeButton = new layout.Button({
    text: 'Remove'
})

layout.body.add(
    new layout.LayoutBlock({
        items: [
            new layout.LayoutBlock({
                items: [
                    new layout.Block(
                        {
                            items: [imageAddButton, imageList, removeAllButton],
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
                            items: [
                                new layout.Block(
                                    {
                                        items: [imageTitle, removeButton],
                                        childSpacing: '8px'
                                    },
                                    {
                                        padding: '',
                                        direction: 'horizontal',

                                        grow: 0,
                                        shrink: 0
                                    }
                                ),
                                imagePreview
                            ],
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

let updatingImages = false

function toggleInterface(enabled) {
    imageAddButton.disabled = !enabled
    removeAllButton.disabled = !enabled
    removeButton.disabled = !enabled
}

function updateImageList() {
    let toSelect = imageList.selected

    imageList.clear()

    if (Images.files.length === 0) {
        removeAllButton.disabled = true

        showImage()

        return false
    }
    removeAllButton.disabled = false

    Images.files.forEach(image => {
        imageList.add([
            path.basename(image, path.extname(image)),
            path.extname(image)
        ])
    })

    imageList.select(toSelect, true)

    if (imageList.selectedIndex === -1) {
        imageList.select(0, true)
    }
}

function showImage(image) {
    if (!image) {
        imageTitle.text = ''
        imagePreview.url = ''

        removeButton.disabled = true

        return false
    }

    imageTitle.text = image
    imagePreview.url = path.join(Images.directory, image)

    removeButton.disabled = false
}

imageList.onEvent('select', event => {
    showImage(
        Images.files.find(image => {
            return (
                path.basename(image, path.extname(image)) === event.text[0] &&
                path.extname(image) === event.text[1]
            )
        })
    )
})

imageAddButton.onEvent('open', event => {
    let toAdd = event.files

    updatingImages = true
    layout.showLoader(imageList, 'Adding')
    toggleInterface(false)

    let addNext = () => {
        if (toAdd.length === 0) {
            toggleInterface(true)

            updateImageList()
            updatingImages = false

            layout.hideLoader(imageList)

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

            imageList.select([
                path.basename(uniqueFileName, path.extname(uniqueFileName)),
                path.extname(uniqueFileName)
            ])

            addNext()
        })
    }

    addNext()
})

removeButton.onEvent('click', () => {
    let selectedImage = imageList.selected
    if (!selectedImage) {
        return false
    }

    let image = Images.files.find(image => {
        return (
            path.basename(image, path.extname(image)) === selectedImage[0] &&
            path.extname(image) === selectedImage[1]
        )
    })

    if (!image) {
        return false
    }

    Images.remove(image, error => {
        if (error) {
            if (error) {
                layout.dialog.showError({
                    message: 'Unable to delete image',
                    detail: error.message || error.toString()
                })

                logger.error("Couldn't remove image from database", error)
            }
        }

        updateImageList()
    })
})

removeAllButton.onEvent('click', event => {
    layout.dialog.showQuestion(
        {
            title: 'Remove all images?',

            message: 'Are you sure you want to remove all images?',
            detail: 'This action cannot be undone!',

            options: ['Remove', 'Cancel']
        },
        (error, answer) => {
            if (answer === 'Remove') {
                updatingImages = true
                layout.showLoader(imageList, 'Removing')
                toggleInterface(false)

                let removeNext = error => {
                    if (error) {
                        if (error) {
                            layout.dialog.showError({
                                message: 'Unable to delete image',
                                detail: error.message || error.toString()
                            })

                            logger.error(
                                "Couldn't remove image from database",
                                error
                            )
                        }
                    }

                    if (Images.files.length === 0) {
                        toggleInterface(true)

                        updateImageList()
                        updatingImages = false

                        layout.hideLoader(imageList)
                    } else {
                        Images.remove(Images.files[0], removeNext)
                    }
                }

                removeNext()
            }
        }
    )
})

Images.onEvent('update-start', () => {
    layout.showLoader(imageList)
})

Images.onEvent('update', () => {
    if (updatingImages) {
        return false
    }

    updateImageList()
    layout.hideLoader(imageList)
})

Images.onEvent('error', error => {
    layout.dialog.showNotification({
        type: 'error',
        autoHide: false,

        message: 'There is an error with the Image database!\n' + error.message
    })
})
