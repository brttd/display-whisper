const fs = require('fs')
const path = require('path')

const dataPath = (
    require('electron').app || require('electron').remote.app
).getPath('userData')

let directory = dataPath

process.chdir(directory)

function normalizePath(input_path) {
    //If the function is given a absolute filepath (IE: C:/text), then use it
    //If it's given a relative filepath (IE: dir/file.json), then make it relative to the current directory

    if (path.isAbsolute(input_path)) {
        return path.normalize(input_path)
    } else {
        return path.join(directory, input_path)
    }
}

exports.changeDir = function(newDirectory, callback = () => {}) {
    if (typeof newDirectory !== 'string') {
        callback(new Error('changeDir was not passed a string path!'))
        return false
    }

    fs.mkdir(newDirectory, { recursive: true }, error => {
        if (error) {
            callback(error)
            return false
        }

        try {
            newDirectory = normalizePath(newDirectory)

            process.chdir(newDirectory)

            directory = newDirectory
        } catch (error) {
            callback(error)
            return false
        }

        callback(null)
    })
}

exports.createDir = function(directory, callback = () => {}) {
    if (typeof directory !== 'string') {
        callback(new Error('createDir was not passed a string path!'))
        return false
    }

    directory = normalizePath(directory)

    fs.mkdir(directory, { recursive: true }, error => {
        if (error) {
            callback(error)
            return false
        }

        callback(null, true)
    })
}

exports.save = function(filename, data = '', callback = () => {}) {
    if (typeof filename !== 'string') {
        callback(new Error('save was not passed a string path!'))
        return false
    }

    if (path.extname(filename) === '') {
        filename += '.json'
    }

    try {
        let dirname = path.dirname(filename)
        if (dirname) {
            fs.mkdirSync(path.dirname(filename), { recursive: true })
        }
    } catch (error) {
        if (error.code !== 'EEXIST') {
            callback(error)
            return false
        }
    }

    filename = normalizePath(filename)

    if (typeof data !== 'string') {
        try {
            data = JSON.stringify(data)
        } catch (error) {
            callback(error)
            return false
        }
    }

    fs.writeFile(filename, data, error => {
        if (error) {
            callback(error)
            return false
        }

        callback(null)
    })
}

exports.delete = function(filename, callback = () => {}) {
    if (typeof filename !== 'string') {
        callback(new Error('delete was not passed a string path!'))
        return false
    }

    if (path.extname(filename) === '') {
        filename += '.json'
    }

    filename = normalizePath(filename)

    fs.unlink(filename, error => {
        if (error) {
            callback(error)
            return false
        }

        callback(null)
    })
}

exports.copy = function(sourceFilename, destFilename, callback = () => {}) {
    if (typeof sourceFilename !== 'string') {
        return callback(new Error('copy was not passed a string source path!'))
        return false
    }
    if (typeof destFilename !== 'string') {
        return callback(
            new Error('copy was not passed a string destination path!')
        )
    }

    sourceFilename = normalizePath(sourceFilename)
    destFilename = normalizePath(destFilename)

    let writeStream = fs.createWriteStream(destFilename)
    let readStream = fs.createReadStream(sourceFilename)

    writeStream.on('error', callback)
    readStream.on('error', callback)
    readStream.on('close', () => {
        callback(null)
    })

    readStream.pipe(writeStream)
}

exports.load = function(filename, callback = () => {}, options) {
    if (typeof filename !== 'string') {
        callback(new Error('load was not passed a string path!'))
        return false
    }

    if (path.extname(filename) === '') {
        filename += '.json'
    }

    filename = normalizePath(filename)

    fs.readFile(filename, 'utf8', (error, data) => {
        if (error) {
            callback(error)
            return false
        }

        try {
            data = JSON.parse(data)
        } catch (error) {
            return callback(error)
        }

        callback(null, data)
    })
}

exports.list = function(directoryPath, callback = () => {}) {
    if (typeof directoryPath !== 'string') {
        callback(new Error('list was not passed a string path!'))
        return false
    }

    directoryPath = normalizePath(directoryPath)

    if (!fs.existsSync(directoryPath)) {
        callback(new Error('Directory does not exist!'))
        return false
    }

    //check that the given path is a directory, not a file
    fs.readdir(directoryPath, (error, files) => {
        if (error) {
            callback(error)
            return false
        }

        callback(null, files)
    })
}

exports.exists = function(filename, callback = () => {}) {
    if (typeof filename !== 'string') {
        return callback(new Error('exists was not passed a string path!'))
    }

    filename = normalizePath(filename)

    fs.access(filename, fs.constants.R_OK, error => {
        if (error) {
            if (error.code === 'ENOENT') {
                return callback(null, false)
            }

            callback(error, false)
        } else {
            callback(null, true)
        }
    })
}

Object.defineProperty(exports, 'dataDir', {
    enumerable: true,
    get: () => {
        return dataPath
    }
})
