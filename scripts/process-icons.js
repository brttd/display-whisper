const fs = require('fs')

function modifyIconFile(fileName) {
    fs.readFile(fileName, 'utf8', (error, content) => {
        if (error) {
            console.error(filename, error)
            return false
        }

        content = content.replace(
            /<[\W\w]*<svg.*>/gim,
            '<svg xmlns="http://www.w3.org/2000/svg">'
        )
        content = content.replace(/<g/gim, '<symbol viewBox="0 0 18 18"')
        content = content.replace(/<\/g/gim, '</symbol')

        content = content.replace(/fill:white;/gim, '')
        content = content.replace(/[\s]*style=""/gim, '')

        fs.writeFile(fileName, content, error => {
            if (error) {
                console.error(filename, error)
            }
        })
    })
}

fs.readdir('app/icons', (error, list) => {
    if (error) {
        console.error(error)
        return false
    }

    for (let i = 0; i < list.length; i++) {
        if (list[i].includes('.svg')) {
            modifyIconFile('app/icons/' + list[i])
        }
    }
})
