const fs = require('fs')
const path = require('path')

const directory = path.join(__dirname, '../../items')

let list = []
let templateList = []

let folders = fs.readdirSync(directory)

exports.templates = {}

exports.has = function(name) {
    return list.includes(name)
}
exports.hasTemplate = function(name) {
    return templateList.includes(name)
}

Object.defineProperty(exports, 'list', {
    get: () => {
        return list.slice(0)
    }
})
Object.defineProperty(exports, 'templateList', {
    get: () => {
        return templateList.slice(0)
    }
})

Object.defineProperty(exports, 'directory', {
    get: () => {
        return directory
    }
})

function loadItem(name) {
    let stats = fs.statSync(path.join(directory, name, name + '.js'))

    if (stats.isFile()) {
        exports[name] = require(directory + '/' + name + '/' + name)

        list.push(name)

        //template
        stats = fs.statSync(path.join(directory, name, 'template.json'))

        if (stats.isFile()) {
            try {
                exports.templates[name] = JSON.parse(
                    fs.readFileSync(
                        path.join(directory, name, 'template.json'),
                        'utf8'
                    )
                )

                templateList.push(name)
            } catch (error) {}
        }
    }
}

//find all directories in folder
for (let i = 0; i < folders.length; i++) {
    let stats = fs.statSync(path.join(directory, folders[i]))

    if (stats.isDirectory()) {
        loadItem(folders[i])
    }
}
