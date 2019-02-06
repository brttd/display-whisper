const path = require('path')
const fs = require('fs')

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

const exportButton = new layout.Button({
    text: 'Export'
})
const removeAllButton = new layout.Button({
    text: 'Remove All'
})

const imageTitle = new layout.Text(
    {},
    {
        overflow: 'ellipsis',
        grow: true,
        align: 'center',
        textAlign: 'left'
    }
)
const imagePreview = new layout.Image(
    {
        color: 'rgb(128, 128, 128)'
    },
    {
        shrink: true,
        grow: true,
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
                            items: [
                                imageAddButton,
                                imageList,
                                new layout.Block(
                                    {
                                        items: [
                                            exportButton,
                                            new layout.Filler(),
                                            removeAllButton
                                        ],
                                        childSpacing: 8
                                    },
                                    {
                                        direction: 'horizontal',
                                        grow: false,
                                        shrink: false,

                                        padding: 0
                                    }
                                )
                            ],
                            childSpacing: 8
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
                                        childSpacing: 8
                                    },
                                    {
                                        padding: 0,
                                        direction: 'horizontal',

                                        grow: false,
                                        shrink: false
                                    }
                                ),
                                imagePreview
                            ],
                            childSpacing: 8
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
    exportButton.disabled = !enabled
    removeAllButton.disabled = !enabled
    removeButton.disabled = !enabled
}

function updateImageList() {
    let toSelect = imageList.selected

    imageList.clear()

    if (Images.files.length === 0) {
        exportButton.disabled = true
        removeAllButton.disabled = true

        showImage()

        return false
    }
    exportButton.disabled = false
    removeAllButton.disabled = false

    for (let i = 0; i < Images.files.length; i++) {
        imageList.add([
            path.basename(Images.files[i], path.extname(Images.files[i])),
            path.extname(Images.files[i])
        ])
    }

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
    layout.dialog.showQuestion(
        {
            title: 'Remove image?',

            message:
                'Are you sure you want to remove the image "' + image + '"?',
            detail: 'This action cannot be undone!',

            options: ['Remove', 'Cancel']
        },
        (error, answer) => {
            if (answer === 'Remove') {
                Images.remove(image, error => {
                    if (error) {
                        if (error) {
                            layout.dialog.showError({
                                message: 'Unable to remove image',
                                detail: error.message || error.toString()
                            })

                            logger.error(
                                "Couldn't remove image from database",
                                error
                            )
                        }
                    }

                    updateImageList()
                })
            }
        }
    )
})

exportButton.onEvent('click', () => {
    layout.dialog.showOpen(
        {
            title: 'Select Folder',
            message: 'Export To Folder',

            button: 'Export',

            openFolder: true
        },
        (error, folder) => {
            if (folder) {
                let toExport = [...Images.files]

                //-1 = ask user
                //0 = skip
                //1 = overwrite
                let overwriteAction = -1

                if (toExport.length === 0) {
                    return false
                }

                layout.showLoader(layout.body, 'Exporting')

                let exportNext = error => {
                    if (error) {
                        layout.dialog.showNotification({
                            type: 'error',
                            message: 'Unable to export image!\n' + error
                        })
                    }

                    if (toExport.length === 0) {
                        layout.hideLoader(layout.body)

                        return false
                    }

                    let file = toExport.pop()

                    if (
                        fs.existsSync(path.join(folder, file)) &&
                        overwriteAction !== 1
                    ) {
                        if (overwriteAction === 0) {
                            exportNext()
                        } else {
                            layout.dialog.showQuestion(
                                {
                                    title: 'Overwite Files?',

                                    message:
                                        'The selected folder contains files with the same name!',
                                    detail:
                                        'Do you want to overwrite the existing files, or skip the images?',

                                    options: ['Overwrite', 'Skip']
                                },
                                (error, answer) => {
                                    if (answer === 'Overwrite') {
                                        overwriteAction = 1
                                        fs.copyFile(
                                            path.join(Images.directory, file),
                                            path.join(folder, file),
                                            exportNext
                                        )
                                    } else {
                                        overwriteAction = 0
                                        exportNext()
                                    }
                                }
                            )
                        }
                    } else {
                        fs.copyFile(
                            path.join(Images.directory, file),
                            path.join(folder, file),
                            exportNext
                        )
                    }
                }

                exportNext()
            }
        }
    )
})

removeAllButton.onEvent('click', () => {
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
                                message: 'Unable to remove image',
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
