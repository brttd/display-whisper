const { ipcRenderer } = require('electron')
const path = require('path')

const fs = require('fs')
const logger = require('dw-log')

const dir = path.join(
    (require('electron').app || require('electron').remote.app).getPath(
        'userData'
    ),
    'database'
)

const maxSimultaneousFileLoads = 10

const imageExts = ['.bmp', '.gif', '.jpeg', '.jpg', '.png', '.webp', '.svg']

const invalidChars = new RegExp(/[<>:"\/\\|?*\x00-\x1F]/, 'g')

const lastDash = new RegExp(/(-)(?!.*-)/, 'g')

const endDigits = new RegExp(/ \(\d+\)$/, 'g')

const minimumID = 0

const isObject = obj => {
    return typeof obj === 'object' && obj !== null && !Array.isArray(obj)
}

let minUpdateSendTime = 500
let errorRetryTime = 1500

try {
    process.chdir(dir)
} catch (error) {
    if (error.code === 'ENOENT') {
        try {
            fs.mkdirSync(dir)
            process.chdir(dir)
        } catch (error) {
            if (error.code === 'EEXIST') {
                try {
                    fs.unlinkSync(dir)
                    fs.mkdirSync(dir)
                    process.chdir(dir)
                } catch (error) {
                    logger.error(
                        'Could not remove file and create and set database directory!',
                        error
                    )
                }
            } else {
                logger.error(
                    'Could not create and set database directory!',
                    error
                )
            }
        }
    } else {
        logger.error('Could not set process directory to database!', error)
    }
}

class EmptyDatabase {
    /*
    name (string): directory name for library
    options:
        extensions (array: string, string):
            List of file types to use in library (with or without starting '.').
            Only file types given will be used when loading/saving.
            If the string 'images' is given, then all common image extensions will be used.
            ['.json'] by default.
        autoUpdate (boolean):
            Whether or not to automatically reload library contents when a change is made by another Database instance.
            If false, the 'update-needed' event will be emitted when another Database instance has changed files. Not calling the .update method after this has happened may cause errors, or incorrect information being used.
            True by default.
    */
    constructor(name, options) {
        if (typeof name !== 'string' || name.length === 0) {
            throw new Error('Database was not given valid string name!')
        }

        this._name = name

        this._dirname = this._name.replace(invalidChars, '')

        this._listeners = {}
        this._singleListeners = {}

        this._files = []

        this._updating = false

        this._changesToSend = []
        this._lastSendAttempt = 0

        this.options = {
            extensions: ['.json'],

            autoUpdate: true
        }

        if (isObject(options)) {
            if (Array.isArray(options.extensions)) {
                this.options.extensions = options.extensions
                    .filter(ext => typeof ext === 'string')
                    .map(ext => {
                        if (!ext.startsWith('.')) {
                            ext = '.' + ext
                        }

                        return ext.toLowerCase()
                    })

                if (this.options.extensions.length === 0) {
                    this.options.extensions = '.json'
                }
            } else if (typeof options.extensions === 'string') {
                if (options.extensions.toLowerCase() === 'image') {
                    this.options.extensions = imageExts
                }
            }

            if (typeof options.autoUpdate === 'boolean') {
                this.options.autoUpdate = options.autoUpdate
            }
        }

        this._ensureDirExists()

        ipcRenderer.on(
            'database-updated',
            (event, databaseName, from, changes) => {
                if (databaseName !== this._name || from === process.pid) {
                    return false
                }

                if (this.options.autoUpdate) {
                    if (Array.isArray(changes) && changes.length > 0) {
                        if (typeof this.updateList === 'function') {
                            this.updateList(changes)

                            return true
                        }
                    }

                    if (typeof this.update === 'function') {
                        this.update()
                    }
                } else {
                    this._callListeners('update-needed')
                }
            }
        )
    }
    //Events
    /*
    'update-start':
        When an update has begun, and files are being loaded.
        Whilst this is happening, the ._files & ._list properties may be missing or incorrect.
    'update':
        When the library has finished updating.
    'update-needed':
        When the library has been changed by another Database instance, and this instance needs to be updated.
        Only emitted when .autoUpdate is false.
    */

    get name() {
        return this._name
    }

    get extensions() {
        return this.options.extensions
    }
    get autoUpdate() {
        return this.options.autoUpdate
    }
    set autoUpdate(value) {
        if (typeof value === 'boolean') {
            this.options.autoUpdate = value
        }
    }

    get updating() {
        return this._updating
    }

    //Array of file names (including extensions)
    get files() {
        return this._files
    }

    //Full path to library directory
    get directory() {
        return path.join(dir, this._dirname)
    }

    _callListeners(name) {
        let args = [...arguments].slice(1)
        if (Array.isArray(this._listeners[name])) {
            for (let i = 0; i < this._listeners[name].length; i++) {
                this._listeners[name][i](...args)
            }
        }

        if (Array.isArray(this._singleListeners[name])) {
            while (this._singleListeners[name].length > 0) {
                this._singleListeners[name].pop()(...args)
            }
        }
    }

    //Sends out a 'database-updated' message over ipc, with a list of all changed files
    //To make it more efficient on recieving Database instances, when called it adds the given changes to an existing list, waits minUpdateSendTime and then (unless ._sendUpdate has been called whilst waiting) sends the message.
    _sendUpdate(changes = []) {
        this._lastSendAttempt = Date.now()

        if (!Array.isArray(changes)) {
            if (typeof changes === 'string') {
                changes = [changes]
            } else {
                changes = []
            }
        }

        this._changesToSend = this._changesToSend.concat(changes)

        //If sendUpdate is called before minUpdateSendTime is elapsed, don't send out an update
        setTimeout(() => {
            if (Date.now() - this._lastSendAttempt >= minUpdateSendTime) {
                ipcRenderer.send(
                    'database-updated',
                    this._name,
                    process.pid,
                    this._changesToSend
                )

                this._changesToSend = []
            }
        }, minUpdateSendTime + 2)
    }

    //(Synchronously) Checks that the library directory exists, and if not creates it.
    _ensureDirExists() {
        try {
            if (!fs.existsSync(this._dirname)) {
                fs.mkdirSync(this._dirname)
            }
        } catch (error) {
            if (error.code === 'EACCES' || error.code === 'EPERM') {
                this._callListeners('error', error)
            }
        }
    }

    //Returns the first index of a file with the same name, ignoring extensions
    indexOf(name) {
        return this._files.findIndex(filename => {
            return (
                filename === name ||
                path.basename(filename, path.extname(filename)) === name
            )
        })
    }

    //Whenever the given event happens, the given listener will be called
    onEvent(name, listener) {
        if (typeof name === 'string' && typeof listener === 'function') {
            if (!Array.isArray(this._listeners[name])) {
                this._listeners[name] = []
            }

            this._listeners[name].push(listener)
        }
    }
    //The first time the given event happens (after this method was called), the given listener will be called.
    onceEvent(name, listener) {
        if (typeof name === 'string' && typeof listener === 'function') {
            if (!Array.isArray(this._singleListeners[name])) {
                this._singleListeners[name] = []
            }

            this._singleListeners[name].push(listener)
        }
    }

    //Returns the name (if neccesary) modified so that it's not the same as any existing file in the library
    getUniqueName(name) {
        if (typeof name !== 'string' || name.length === 0) {
            throw new Error('getUniqueName was not given valid string name!')
        }

        let base = path.basename(name, path.extname(name))

        if (!this.has(base)) {
            return name
        }

        if (endDigits.test(base)) {
            base = base.replace(endDigits, '')
        }

        let num = 1

        while (
            this._files.some(
                filename =>
                    path.basename(filename, path.extname(filename)) ===
                    base + ' (' + num.toString() + ')'
            )
        ) {
            num += 1
        }

        return base + ' (' + num.toString() + ')' + path.extname(name)
    }
}
class EmptyGroupDatabase extends EmptyDatabase {
    /*
    options:
        minGroupLength (number):
            Minimum amount of characters for a group. Cannot be less than 1.
            Any save operations giving a group with less characters will not work.
            1 by default.
        maxGroupLength (number):
            Maxmimum amount of characters for a group. Cannot be less than 1, or less than the minimum (If so, the minimum will be used instead).
            Any save operations giving a group with more characters will not work.
            If not specified, or 0, will be unbounded.
    */
    constructor(name, options) {
        super(name, options)

        //List of all groups in use
        this._groups = []

        //List of all IDs in use, per group
        this._IDs = {}

        //List of IDs not in use, per group
        this._availableIDs = {}

        //Highest ID in use, per group
        this._highestID = {}

        this.options.minGroupLength = 1
        this.options.maxGroupLength = Infinity

        if (isObject(options)) {
            if (
                typeof options.minGroupLength === 'number' &&
                options.minGroupLength >= 0 &&
                isFinite(options.minGroupLength)
            ) {
                this.options.minGroupLength = options.minGroupLength
            }

            if (
                typeof options.maxGroupLength === 'number' &&
                options.maxGroupLength > 0 &&
                isFinite(options.maxGroupLength)
            ) {
                //If the min is higher, use that instead
                this.options.maxGroupLength = Math.max(
                    options.maxGroupLength,
                    this.options.minGroupLength
                )
            }
        }
    }

    _toGroup(name) {
        name = path.basename(name, path.extname(name)).split(lastDash)

        if (name.length === 3 && isFinite(parseInt(name[2]))) {
            return {
                group: name[0],
                ID: parseInt(name[2])
            }
        }

        return {
            group: name[0]
        }
    }

    _toName(group, ID, ext = this.options.extensions[0]) {
        return group + '-' + ID.toString() + ext
    }

    validGroup(group) {
        return (
            typeof group === 'string' &&
            group.length >= this.options.minGroupLength &&
            group.length <= this.options.maxGroupLength
        )
    }
    validID(group, ID) {
        return (
            typeof group === 'string' &&
            typeof ID === 'number' &&
            group.length >= this.options.minGroupLength &&
            group.length <= this.options.maxGroupLength &&
            ID >= minimumID &&
            isFinite(ID)
        )
    }

    //Removes the given ID from the given group, if present
    //If no ID's in use in group, also removes group
    _removeID(group, ID) {
        if (!this.validID(group, ID) || !this._groups.includes(group)) {
            return false
        }

        let index = this._IDs[group].indexOf(ID)

        if (index === -1) {
            return false
        }

        this._IDs[group].splice(index, 1)

        //If it was the last ID, remove the whole group
        if (this._IDs[group].length === 0) {
            delete this._IDs[group]
            delete this._availableIDs[group]
            delete this._highestID[group]

            this._groups.splice(this._groups.indexOf(group), 1)

            return true
        }

        if (ID === this._highestID[group]) {
            //If it was the highest, find the highest in the remaining ones
            this._highestID[group] = Math.max(...this._IDs[group])

            //Since it was the highest, ID+1 will be the highest available, which needs to be removed
            this._availableIDs[group].splice(
                this._availableIDs[group].indexOf(ID + 1),
                1
            )

            //The ID above the new highest one needs to be made available
            //(If not already there)
            if (
                !this._availableIDs[group].includes(this._highestID[group] + 1)
            ) {
                this._availableIDs[group].push(this._highestID[group] + 1)
            }
        } else {
            //If it wasn't the highest, it needs to be made available
            this._availableIDs[group].push(ID)
        }
    }
    //Adds the ID to the list of useds IDs, adding group if needed, and updating available & highest IDs as neccesary
    _addID(group, ID) {
        if (!this.validID(group, ID)) {
            return false
        }

        if (this._groups.includes(group)) {
            let availableIndex = this._availableIDs[group].indexOf(ID)

            if (availableIndex !== -1) {
                //If it was available, then remove it
                this._availableIDs[group].splice(availableIndex, 1)
            }

            if (!this._IDs[group].includes(ID)) {
                this._IDs[group].push(ID)
            }

            if (ID > this._highestID[group]) {
                //If it's the new highest, the one above needs to be made available
                this._availableIDs[group].push(ID + 1)
                //And every ID between the previous highest and the new ID needs to be available
                for (let i = this._highestID[group] + 2; i < ID; i++) {
                    this._availableIDs[group].push(i)
                }

                this._highestID[group] = ID
            }
        } else {
            this._groups.push(group)

            this._IDs[group] = [ID]
            this._availableIDs[group] = [ID + 1]
            this._highestID[group] = ID

            for (let i = minimumID; i < ID; i++) {
                this._availableIDs[group].push(i)
            }
        }
    }

    //If there is a file in the database using the given ID, in the given Group
    has(group, ID) {
        if (!this.validID(group, ID)) {
            return false
        }

        return !(
            this._groups.includes(group) &&
            this._availableIDs[group].includes(ID)
        )
    }

    //Get a unused ID from the given group
    getUniqueID(group, ID) {
        if (!this.validGroup(group)) {
            return false
        }

        //If the ID is invalid, use the minimum ID
        if (!this.validID(group, ID)) {
            return this.getUniqueID(group, minimumID)
        }

        if (this._groups.includes(group)) {
            if (
                this._availableIDs[group].includes(ID) ||
                ID > this._highestID[group]
            ) {
                return ID
            }

            return this._availableIDs[group][0]
        } else {
            return ID
        }
    }

    //Returns full group-id.extension name, which is has an ID which is unused
    getUniqueName(name) {
        if (typeof name !== 'string') {
            return false
        }
        let ext = path.extname(name)

        name = this._toGroup(name)

        if (!this.validGroup(name.group)) {
            return false
        }

        if (!this.validID(name.group, name.ID)) {
            name.ID = minimumID
        }

        return this._toName(
            name.group,
            this.getUniqueID(name.group, name.ID),
            ext
        )
    }
}

class AgnosticDatabase extends EmptyDatabase {
    /*
    options:
        load (boolean):
            Whether or not to load, and keep a copy of the contents of all files in the library.
            If false, the .list property will not be available.
            True by default.
        parse (boolean):
            If load is true, and parse is true, then all files in library will be parsed as JSON.
            If false, library contents will be strings.
            If there are extensions given, which are not .json, parse will be false.
            True by default.
        transform (function):
            All loaded file contents will be passed through the given function. It does not affect the saved file, unless the resulting modified content is then saved to the library.
            If parse is true, then the transform function will be given a Object, otherwise it will be given a string.
            The return value of the function is used as the file content.
        
    */
    constructor(name, options) {
        super(name, options)

        //File content
        this._list = []

        this.options.load = true
        this.options.parse = true
        this.options.transform = false

        if (isObject(options)) {
            if (typeof options.load === 'boolean') {
                this.options.load = options.load
            }

            if (typeof options.parse === 'boolean') {
                this.options.parse = options.parse
            }

            if (this.options.extensions.some(ext => ext !== '.json')) {
                this.options.parse = false
            }

            if (typeof options.transform === 'function') {
                this.options.transform = options.transform
            }
        }

        this.update()
    }

    //Array of file contents
    get list() {
        //Only return if load is true
        return this.options.load ? this._list : undefined
    }

    //If the given name (ignoring extensions) is in the library, returns it, otherwise returns it with a valid extension
    _getFullFilename(name) {
        if (typeof name !== 'string') {
            return ''
        }

        let index = this.indexOf(name)

        if (index === -1) {
            //If there isn't a file using the name, check whether the extension is valid
            if (
                !this.options.extensions.includes(
                    path.extname(name).toLowerCase()
                )
            ) {
                //If not, use the default extension
                return (
                    path.basename(name, path.extname(name)) +
                    this.options.extensions[0]
                )
            }

            return name
        }

        //If there is a file using the name, return that file with it's extension
        return this._files[index]
    }

    //removes given filename from ._files, and removes it's content from ._list
    //Does not change actual files on disk
    _removeFile(name) {
        let index = this.indexOf(name)

        if (index !== -1) {
            this._files.splice(index, 1)

            if (this.options.load) {
                this._list.splice(index, 1)
            }
        }
    }

    //Reads the contents of the given file, adding or updating it's filename & content in ._files & ._list
    _updateFile(filename, callback) {
        filename = this._getFullFilename(filename)

        if (this.options.load) {
            fs.readFile(
                path.join(this._dirname, filename),
                'utf8',
                (error, data) => {
                    if (error) {
                        //If the file exists, or is a directory, emit a file-error event
                        if (error.code !== 'ENOENT') {
                            this._ensureDirExists()

                            this._callListeners('file-error', error, filename)
                        }

                        this._removeFile(filename)

                        if (typeof callback === 'function') {
                            callback(error, false)
                        }

                        return false
                    }

                    if (this.options.parse) {
                        try {
                            data = JSON.parse(data)

                            data._filename = filename
                        } catch (error) {
                            //If the file-error is being listened to, then emit it
                            //Else, log the error
                            if (this._listeners.hasOwnProperty('file-error')) {
                                this._callListeners(
                                    'file-error',
                                    error,
                                    filename
                                )
                            } else {
                                logger.error(
                                    'Database',
                                    this._name,
                                    'unable to update file',
                                    filename,
                                    ':',
                                    error
                                )
                            }

                            this._removeFile(filename)

                            if (typeof callback === 'function') {
                                callback(error, false)
                            }

                            return false
                        }
                    }

                    if (this.options.transform) {
                        try {
                            data = this.options.transform(data)
                        } catch (error) {
                            logger.error(
                                'Database could not transform file! Error occured in function:',
                                error
                            )

                            this._callListeners(
                                'transform-error',
                                error,
                                filename
                            )
                        }
                    }

                    let index = this._files.indexOf(filename)

                    if (index === -1) {
                        this._files.push(filename)

                        this._list.push(data)
                    } else {
                        this._list[index] = data
                    }

                    if (typeof callback === 'function') {
                        callback(null, true)
                    }
                }
            )
        } else {
            fs.access(
                path.join(this._dirname, file),
                //Check if file exists, can be read, and can be written
                fs.constants.F_OK | fs.constants.W_OK | fs.constants.R_OK,
                error => {
                    if (error) {
                        this._removeFile(filename)

                        if (error.code === 'EACCES') {
                            this._callListeners('file-error', error, filename)

                            if (typeof callback === 'function') {
                                callback(null, true)
                            }

                            return false
                        }

                        if (typeof callback === 'function') {
                            callback(error, true)
                        }

                        return false
                    }

                    let index = this._files.indexOf(filename)

                    if (index === -1) {
                        this._files.push(filename)
                    }

                    if (typeof callback === 'function') {
                        callback(null, true)
                    }
                }
            )
        }
    }

    //Finds, and updates all files in library directory, updating ._files & ._list
    update(callback = () => {}) {
        if (typeof callback !== 'function') {
            callback = () => {}
        }

        if (this._updating) {
            this.onceEvent('update', callback)

            return false
        }

        this._updating = true
        this._callListeners('update-start')

        fs.readdir(this._dirname, 'utf8', (error, list) => {
            if (error) {
                this._updating = false

                if (error.code === 'EACCES' || error.code === 'EPERM') {
                    this._callListeners('error', error)

                    return callback(error)
                } else if (error.code === 'ENOENT') {
                    this._ensureDirExists()

                    setTimeout(() => {
                        this.update(callback)
                    }, errorRetryTime)

                    return false
                } else if (error.code === 'ENOTDIR') {
                    fs.unlink(this._dirname, error => {
                        if (error) {
                            return callback(error)
                        }

                        this.update(callback)
                    })
                } else {
                    return callback(error)
                }
            }

            list = list.filter(filename => {
                return this.options.extensions.includes(
                    path.extname(filename).toLowerCase()
                )
            })

            let oldFiles = this._files

            this._files = []
            this._list = []

            if (list.length === 0) {
                this._updating = false

                this._callListeners('update', oldFiles)

                return callback(null)
            } else if (this.options.load === false) {
                this._files = list

                this._updating = false

                this._callListeners('update', [
                    //Quick and easy way to make array unique
                    //Converts the array of this._files + oldFiles into a Set
                    //And then back into an array again
                    ...new Set(this._files.concat(oldFiles))
                ])

                return callback(null)
            }

            let toLoad = list.length

            let onFileLoad = () => {
                toLoad -= 1

                if (toLoad === 0) {
                    this._updating = false

                    this._callListeners('update', [
                        //Quick and easy way to make array unique
                        //Converts the array of this._files + oldFiles into a Set
                        //And then back into an array again
                        ...new Set(this._files.concat(oldFiles))
                    ])

                    return callback(null)
                } else if (list.length > 0) {
                    this._updateFile(list.pop(), onFileLoad)
                }
            }

            for (
                let i = 0;
                i < maxSimultaneousFileLoads && i < list.length;
                i++
            ) {
                this._updateFile(list.pop(), onFileLoad)
            }
        })
    }

    //Updates only the files in the given list
    updateList(list, callback = () => {}) {
        if (!Array.isArray(list)) {
            if (typeof callback === 'function') {
                callback(new Error('updateList was not given array!'))
            } else {
                throw new Error('updateList was not given array!')
            }
        }

        if (typeof callback !== 'function') {
            callback = () => {}
        }

        if (list.length === 0) {
            return callback(null)
        }

        if (this._updating) {
            this.onceEvent('update', callback)

            return false
        }

        if (this.options.load === false) {
            //Since the file content isn't read, it's easier to just to update everything
            return this.update(callback)
        }

        this._updating = true
        this._callListeners('update-start')

        let listCopy = [...list]

        let toLoad = list.length

        let onFileLoad = () => {
            toLoad -= 1
            if (toLoad === 0) {
                this._updating = false
                this._callListeners('update', listCopy)
                return callback(null)
            } else if (list.length > 0) {
                this._updateFile(list.pop(), onFileLoad)
            }
        }

        for (let i = 0; i < maxSimultaneousFileLoads && i < list.length; i++) {
            this._updateFile(list.pop(), onFileLoad)
        }
    }

    //Returns true if there is a file with the given name (ignoring extensions)
    has(name) {
        return this.indexOf(name) !== -1
    }

    //Returns the contents of the file in the library with the given name
    //If options.load is false, it still reads the file content, and parses it if options.parse is true
    get(name, callback) {
        if (typeof name !== 'string' || name.length === 0) {
            if (typeof callback === 'function') {
                callback(
                    new Error(
                        'Database get was not given a proper string name!'
                    )
                )
            }

            return
        }

        //If the library is being updated, and there was a callback given, wait until the updating has finished
        if (this._updating && typeof callback === 'function') {
            this.onceEvent('update', () => {
                this.get(name, callback)
            })

            return false
        }

        let index = this.indexOf(name)

        //This method doesn't update the file list, it only returns contents for files it knows are in the library
        if (index === -1) {
            if (typeof callback === 'function') {
                callback(null)
            }

            return
        }

        //If load is true, the file content will already have been loaded, and so just return that without reading it again
        if (this.options.load) {
            if (typeof callback === 'function') {
                return callback(null, this._list[index])
            }

            return this._list[index]
        }

        if (typeof callback === 'function') {
            fs.readFile(
                path.join(this._dirname, this._files[index]),
                'utf8',
                (error, data) => {
                    if (error) {
                        return callback(error)
                    }

                    if (this.options.parse) {
                        try {
                            data = JSON.parse(data)

                            data._filename = this._files[index]
                        } catch (error) {
                            return callback(error)
                        }
                    }

                    if (this.options.transform) {
                        try {
                            data = this.options.transform(data)
                        } catch (error) {
                            logger.error(
                                'Database could not transform file, error occurred in function!',
                                error
                            )

                            this._callListeners('transform-error', error, name)
                        }
                    }

                    callback(null, data)
                }
            )
        } else {
            try {
                let data = fs.readFileSync(
                    path.join(this._dirname, this._files[index]),
                    'utf8'
                )

                if (!data) {
                    return undefined
                }

                if (this.options.parse) {
                    try {
                        data = JSON.parse(data)

                        data._filename = this._files[index]
                    } catch (error) {
                        return undefined
                    }
                }

                if (this.options.transform) {
                    try {
                        data = this.options.transform(data)
                    } catch (error) {
                        logger.error(
                            'Database could not transform file, error occurred in function!',
                            error
                        )

                        this._callListeners('transform-error', error, name)
                    }
                }

                return data
            } catch (error) {
                logger.error('Database get error', error)
            }
        }
    }

    //Saves the given data to the given name
    save(name, data, callback) {
        if (typeof name !== 'string' || name.length === 0) {
            if (typeof callback === 'function') {
                callback(
                    new Error('Database save was not given valid string name!'),
                    false
                )
            }

            return false
        }

        //If the library is being updated, and there was a callback given, wait until the updating has finished
        if (this._updating && typeof callback === 'function') {
            this.onceEvent('update', () => {
                this.save(name, callback)
            })

            return false
        }

        name = this._getFullFilename(name)
        let index = this.indexOf(name)

        let writeData = ''
        try {
            writeData = typeof data === 'string' ? data : JSON.stringify(data)
        } catch (error) {
            if (typeof callback === 'function') {
                callback(error)
            }
            return false
        }

        if (typeof callback === 'function') {
            fs.writeFile(
                path.join(this._dirname, name),
                writeData,
                'utf8',
                error => {
                    if (error) {
                        if (error.code === 'ENOENT') {
                            this._ensureDirExists()

                            return setTimeout(
                                this.save.bind(this, name, data, callback),
                                errorRetryTime
                            )
                        }
                        return callback(error)
                    }

                    if (this.options.parse && isObject(data)) {
                        data._filename = name
                    }

                    if (this.options.transform) {
                        try {
                            data = this.options.transform(data)
                        } catch (error) {
                            logger.error(
                                'Database could not transform file, error occurred in function!',
                                error
                            )

                            this._callListeners('transform-error', error, name)
                        }
                    }

                    if (index === -1) {
                        this._files.push(name)

                        if (this.options.load) {
                            this._list.push(data)
                        }
                    } else if (this.options.load) {
                        this._list[index] = data
                    }

                    callback(null, true)

                    this._callListeners('update', [name])
                    this._sendUpdate(name)
                }
            )

            return
        } else {
            try {
                fs.writeFileSync(
                    path.join(this._dirname, name),
                    writeData,
                    'utf8'
                )

                if (this.options.parse && isObject(data)) {
                    data._filename = name
                }

                if (this.options.transform) {
                    try {
                        data = this.options.transform(data)
                    } catch (error) {
                        logger.error(
                            'Database could not transform file, error occurred in function!',
                            error
                        )

                        this._callListeners('transform-error', error, name)
                    }
                }

                if (index === -1) {
                    this._files.push(name)

                    if (this.options.load) {
                        this._list.push(data)
                    }
                } else if (this.options.load) {
                    this._list[index] = data
                }

                this._callListeners('update', [name])
                this._sendUpdate(name)
            } catch (error) {
                if (error.code === 'ENOENT') {
                    this._ensureDirExists()

                    this.save(name, data)
                }
                logger.error(
                    "Database save couldn't write file",
                    name,
                    ':',
                    error
                )
            }
        }
    }

    //Saves the contents of the given file (full filepath) to the given name
    saveFromExternal(name, filename, callback) {
        if (typeof name !== 'string' || name.length === 0) {
            if (typeof callback === 'function') {
                callback(
                    new Error(
                        'Database saveFromExternal was not given valid string name!'
                    ),
                    false
                )
            }

            return false
        }

        if (typeof filename !== 'string' || !path.isAbsolute(filename)) {
            if (typeof callback === 'function') {
                callback(
                    new Error(
                        'Database saveFromExternal was not given valid filename!'
                    )
                )
            }

            return false
        }

        //If the library is being updated, and there was a callback given, wait until the updating has finished
        if (this._updating && typeof callback === 'function') {
            this.onceEvent('update', () => {
                this.saveFromExternal(name, filename, callback)
            })

            return false
        }

        name = this._getFullFilename(name)

        let index = this.indexOf(name)

        if (typeof callback === 'function') {
            fs.readFile(filename, (error, data) => {
                if (error) {
                    return callback(error)
                }

                fs.writeFile(path.join(this._dirname, name), data, error => {
                    if (error) {
                        if (error.code === 'ENOENT') {
                            this._ensureDirExists()

                            return setTimeout(
                                this.saveFromExternal.bind(
                                    this,
                                    name,
                                    filename,
                                    callback
                                ),
                                errorRetryTime
                            )
                        }

                        return callback(error)
                    }

                    if (index === -1) {
                        this._files.push(name)

                        if (this.options.load) {
                            this.updateList([name])
                        } else {
                            this._callListeners('update', [name])
                        }
                    } else if (this.options.load) {
                        this.updateList([name])
                    } else {
                        this._callListeners('update', [name])
                    }

                    callback(null, true)

                    this._sendUpdate(name)
                })
            })
        } else {
            try {
                let data = fs.readFileSync(filename)
                fs.writeFileSync(path.join(this._dirname, name), data)

                if (index === -1) {
                    this._files.push(name)

                    if (this.options.load) {
                        this.updateList([name])
                    } else {
                        this._callListeners('update', [name])
                    }
                } else if (this.options.load) {
                    this.updateList([name])
                } else {
                    this._callListeners('update', [name])
                }

                this._sendUpdate(name)

                return true
            } catch (error) {
                logger.error(
                    'Database saveFromExternal could not copy file',
                    filename,
                    ':',
                    error
                )

                return false
            }
        }
    }

    //Removes the file from the library
    remove(name, callback) {
        if (typeof name !== 'string' || name.length === 0) {
            if (typeof callback === 'function') {
                callback(
                    new Error(
                        'Database remove was not given a proper string name!'
                    )
                )
            }

            return false
        }

        //If the library is being updated, and there was a callback given, wait until the updating has finished
        if (this._updating && typeof callback === 'function') {
            this.onceEvent('update', () => {
                this.remove(name, callback)
            })

            return false
        }

        let index = this.indexOf(name)

        if (index === -1) {
            if (typeof callback === 'function') {
                callback(null, false)
            }

            return false
        }

        name = this._getFullFilename(name)

        if (typeof callback === 'function') {
            fs.unlink(path.join(this._dirname, name), error => {
                if (error) {
                    if (error.code === 'ENOENT') {
                        this._ensureDirExists()

                        return callback(null)
                    }

                    logger.error(
                        "Database remove couldn't delete file",
                        name,
                        ':',
                        error
                    )

                    return callback(error)
                }

                this._removeFile(name)

                this._callListeners('update', [name])
                this._sendUpdate(name)

                callback(null, true)
            })
        } else {
            try {
                fs.unlinkSync(path.join(this._dirname, name))

                this._removeFile(name)

                this._callListeners('update', [name])
                this._sendUpdate(name)

                return true
            } catch (error) {
                if (error.code === 'ENOENT') {
                    this._ensureDirExists()

                    return true
                }

                logger.error(
                    "Database remove couldn't delete file",
                    name,
                    ':',
                    error
                )

                return false
            }
        }
    }
}

class GroupDatabase extends EmptyGroupDatabase {
    /*
    options:
        load (boolean): Same as AgnosticDatabase load.
        parse (boolean): Same as AgnosticDatabase parse.
        transform (function): Same as AgnosticDatabase function.
    */
    constructor(name, options) {
        super(name, options)

        //File content
        this._list = []

        this.options.load = true
        this.options.parse = true
        this.options.transform = false

        if (isObject(options)) {
            if (typeof options.load === 'boolean') {
                this.options.load = options.load
            }

            if (typeof options.parse === 'boolean') {
                this.options.parse = options.parse
            }

            if (this.options.extensions.some(ext => ext !== '.json')) {
                this.options.parse = false
            }

            if (typeof options.transform === 'function') {
                this.options.transform = options.transform
            }
        }

        this.update()
    }

    get list() {
        return this._list
    }

    //Removes the file from ._files, and the content from ._list, and uses the parent method ._removeID for removing the files group & ID
    _removeFile(filename) {
        let index = this._files.indexOf(filename)

        if (index !== -1) {
            this._files.splice(index, 1)

            if (this.options.load) {
                this._list.splice(index, 1)
            }

            filename = this._toGroup(filename)
            this._removeID(filename.group, filename.ID)
        }
    }

    //Applies the transform function to the data, adding other properties (filename, group, id) aswell
    _transform(data, filename) {
        let fileGroup = this._toGroup(filename)
        fileGroup.filename = filename

        if (this.options.parse && isObject(data)) {
            data._filename = filename

            data._group = fileGroup.group
            data._ID = fileGroup.ID
        }

        if (this.options.transform) {
            try {
                return this.options.transform(data)
            } catch (error) {
                logger.error(
                    'Database could not transform file, error occurred in function!',
                    error
                )

                this._callListeners('transform-error', error, fileGroup)
            }
        }

        return data
    }

    //Reloads the file, updating all files, content, groups, etc
    //(Does not check options.load)
    _updateFile(filename, callback) {
        fs.readFile(
            path.join(this._dirname, filename),
            'utf8',
            (error, data) => {
                let file = this._toGroup(filename)

                if (error) {
                    this._removeFile(filename)

                    if (error.code !== 'ENOENT') {
                        this._ensureDirExists()

                        let file = this._toGroup(filename)

                        this._callListeners('file-error', error, {
                            filename: filename,

                            group: file.group,
                            ID: file.ID
                        })
                    }

                    if (typeof callback === 'function') {
                        callback(null, true)
                    }

                    return false
                }

                if (this.options.parse) {
                    try {
                        data = JSON.parse(data)
                    } catch (error) {
                        if (this._listeners.hasOwnProperty('file-error')) {
                            let file = this._toGroup(filename)

                            this._callListeners('file-error', error, {
                                filename: filename,

                                group: file.group,
                                ID: file.ID
                            })
                        } else {
                            logger.error(
                                'Database',
                                this._name,
                                'unable to update file',
                                filename,
                                ':',
                                error
                            )
                        }

                        this._removeFile(filename)

                        if (typeof callback === 'function') {
                            callback(error, false)
                        }

                        return false
                    }
                }

                if (!this.validID(file.group, file.ID)) {
                    return false
                }

                let index = this._files.indexOf(filename)
                data = this._transform(data, filename)

                if (index === -1) {
                    this._files.push(filename)

                    this._list.push(data)
                } else {
                    this._list[index] = data
                }

                this._addID(file.group, file.ID)

                if (typeof callback === 'function') {
                    callback(null, true)
                }
            },
            {
                parse: this.options.parse
            }
        )
    }

    update(callback) {
        if (this._updating) {
            this.onceEvent('update', callback)

            return false
        }

        if (typeof callback !== 'function') {
            callback = () => {}
        }

        this._updating = true
        this._callListeners('update-start')

        fs.readdir(this._dirname, 'utf8', (error, list) => {
            if (error) {
                this._updating = false

                if (error.code === 'EACCES' || error.code === 'EPERM') {
                    this._callListeners('error', error)

                    return callback(error)
                } else if (error.code === 'ENOENT') {
                    this._ensureDirExists()
                    this.update(callback)

                    return false
                } else if (error.code === 'ENOTDIR') {
                    fs.unlink(this._dirname, error => {
                        if (error) {
                            return callback(error)
                        }

                        this.update(callback)
                    })
                } else {
                    return callback(error)
                }
            }

            list = list.filter(filename => {
                return this.options.extensions.includes(
                    path.extname(filename).toLowerCase()
                )
            })

            let oldFiles = this._files

            this._files = []
            this._list = []

            this._groups = []

            this._IDs = {}
            this._availableIDs = {}
            this._highestID = {}

            if (list.length === 0) {
                this._updating = false

                this._callListeners('update', oldFiles.map(this._toGroup))

                return callback(null)
            } else if (this.options.load === false) {
                list.forEach(filename => {
                    let file = this._toGroup(filename)

                    if (!this.validID(file.group, file.ID)) {
                        return false
                    }

                    this._files.push(filename)
                    this._addID(file.group, file.ID)
                })

                this._updating = false

                this._callListeners(
                    'update',
                    //Convert old + new files into a unique only array
                    //And then map each filename into a {group: '', id: ''} object
                    [...new Set(this._files.concat(oldFiles))].map(
                        this._toGroup
                    )
                )

                return callback()
            }

            let toLoad = list.length

            let onFileLoad = () => {
                toLoad -= 1

                if (toLoad === 0) {
                    this._updating = false

                    this._callListeners(
                        'update',
                        //Convert old + new files into a unique only array
                        //And then map each filename into a {group: '', id: ''} object
                        [...new Set(this._files.concat(oldFiles))].map(
                            this._toGroup
                        )
                    )
                } else if (list.length > 0) {
                    this._updateFile(list.pop(), onFileLoad)
                }
            }

            for (
                let i = 0;
                i < maxSimultaneousFileLoads && i < list.length;
                i++
            ) {
                this._updateFile(list.pop(), onFileLoad)
            }
        })
    }

    updateList(list, callback) {
        if (!Array.isArray(list)) {
            if (typeof callback === 'function') {
                callback(new Error('UpdateList was not given array!'))
            }

            return false
        }

        if (this._updating && typeof callback === 'function') {
            this.onceEvent('update', () => {
                this.updateList(list, callback)
            })

            return false
        }

        if (typeof callback !== 'function') {
            callback = () => {}
        }

        if (list.length === 0) {
            return callback(null)
        }

        if (this.options.load === false) {
            return this.update(callback)
        }

        this._updating = true
        this._callListeners('update-start')

        let toLoad = list.length

        let onFileLoad = () => {
            toLoad -= 1
            if (toLoad === 0) {
                this._updating = false

                this._callListeners('update', list.map(this._toGroup))

                return callback(null)
            } else if (list.length > 0) {
                this._updateFile(list.pop(), onFileLoad)
            }
        }

        for (let i = 0; i < maxSimultaneousFileLoads && i < list.length; i++) {
            this._updateFile(list.pop(), onFileLoad)
        }
    }

    get(group, ID, callback) {
        if (!this.validID(group, ID)) {
            if (typeof callback === 'function') {
                callback(
                    new Error(
                        'Invalid group or ID passed to database get!',
                        group,
                        ID
                    )
                )
            }

            return
        }

        if (this._updating && typeof callback === 'function') {
            this.onceEvent('update', () => {
                this.get(group, ID, callback)
            })

            return false
        }

        let name = this._toName(group, ID)
        let index = this._files.indexOf(name)

        if (index === -1) {
            if (typeof callback === 'function') {
                callback(null)
            }

            return
        }

        if (this.options.load) {
            if (typeof callback === 'function') {
                return callback(null, this._list[index])
            }

            return this._list[index]
        }

        if (typeof callback === 'function') {
            fs.readFile(
                path.join(this._dirname, name),
                'utf8',
                (error, data) => {
                    if (error) {
                        return callback(error)
                    }

                    callback(null, this._transform(data, name))
                }
            )
        } else {
            try {
                let data = fs.readFileSync(
                    path.join(this._dirname, name),
                    'utf8'
                )
                if (this.options.parse) {
                    data = JSON.parse(data)
                }

                if (!data) {
                    return undefined
                }

                return this._transform(data)
            } catch (error) {
                logger.error('Database.get error', error)
            }
        }
    }

    save(group, ID, data, callback) {
        if (!this.validGroup(group)) {
            if (typeof callback === 'function') {
                callback(
                    new Error('Invalid group passed to Database save!'),
                    false
                )
            }

            return false
        }

        if (typeof data === 'function') {
            return this.save(group, ID, {}, data)
        }

        if (!this.validID(group, ID)) {
            ID = this.getUniqueID(group)
        }

        if (this._updating && typeof callback === 'function') {
            this.onceEvent('update', () => {
                this.save(group, ID, data, callback)
            })

            return false
        }

        let name = this._toName(group, ID)
        let index = this._files.indexOf(name)

        let writeData = ''

        try {
            writeData = typeof data === 'string' ? data : JSON.stringify(data)
        } catch (error) {
            if (typeof callback === 'function') {
                callback(error)
            }
            return false
        }

        if (typeof callback === 'function') {
            fs.writeFile(
                path.join(this._dirname, name),
                writeData,
                'utf8',
                error => {
                    if (error) {
                        if (error.code === 'ENOENT') {
                            this._ensureDirExists()

                            return setTimeout(
                                this.save.bind(this, group, ID, data, callback),
                                errorRetryTime
                            )
                        }

                        return callback(error, false)
                    }

                    data = this._transform(data, name)

                    if (index === -1) {
                        this._files.push(name)

                        if (this.options.load) {
                            this._list.push(data)
                        }
                    } else if (this.options.load) {
                        this._list[index] = data
                    }

                    this._addID(group, ID)

                    this._callListeners('update', [{ group: group, ID: ID }])
                    this._sendUpdate(name)

                    callback(null, true)
                }
            )
        } else {
            try {
                fs.writeFileSync(
                    path.join(this._dirname, name),
                    writeData,
                    'utf8'
                )

                data = this._transform(data, name)

                if (index === -1) {
                    this._files.push(name)

                    if (this.options.load) {
                        this._list.push(data)
                    }
                } else if (this.options.load) {
                    this._list[index] = data
                }

                this._addID(group, ID)

                this._callListeners('update', [{ group: group, ID: ID }])
                this._sendUpdate(name)

                return true
            } catch (error) {
                if (error.code === 'ENOENT') {
                    this._ensureDirExists()

                    this.save(group, ID, data)
                }

                logger.error('Database couldnt save file', name, error)
            }
        }

        return false
    }

    remove(group, ID, callback) {
        if (!this.validID(group, ID)) {
            if (typeof callback === 'function') {
                callback(
                    new Error(
                        'Invalid group or ID passed to Database save!',
                        group,
                        ID
                    ),
                    false
                )
            }

            return false
        }

        if (this._updating && typeof callback === 'function') {
            this.onceEvent('update', () => {
                this.remove(group, ID, callback)
            })

            return false
        }

        let filename = this._toName(group, ID)
        let index = this._files.indexOf(filename)

        if (index === -1) {
            if (typeof callback === 'function') {
                callback(null, false)
            }

            return false
        }

        if (typeof callback === 'function') {
            fs.unlink(path.join(this._dirname, filename), error => {
                if (error) {
                    if (error.code === 'ENOENT') {
                        this._ensureDirExists()

                        return callback(null)
                    }

                    logger.error(
                        "Database couldn't delete file",
                        filename,
                        ':',
                        error
                    )

                    return callback(error)
                }

                this._removeFile(filename)

                this._callListeners('update', [{ group: group, ID: ID }])
                this._sendUpdate(filename)

                callback(null, true)
            })
        } else {
            try {
                fs.unlinkSync(path.join(this._dirname, filename))

                this._removeFile(filename)

                this._callListeners('update', [{ group: group, ID: ID }])
                this._sendUpdate(filename)

                return true
            } catch (error) {
                if (error.code === 'ENOENT') {
                    this._ensureDirExists()

                    return true
                }

                logger.error("Database couldn't delete file", name, ':', error)
            }
        }

        return false
    }

    removeAll(callback) {
        if (this._files.length === 0) {
            if (typeof callback === 'function') {
                callback(null, false)
            }

            return false
        }

        if (typeof callback === 'function') {
            let removed = []

            let onFileRemove = error => {
                if (error) {
                    if (error.code === 'ENOENT') {
                        this._ensureDirExists()
                    } else {
                        logger.error(
                            "Database couldn't delete file",
                            filename,
                            ':',
                            error
                        )
                    }

                    return removeNext()
                }

                if (this._files.length === 0) {
                    this._list = []

                    this._groups = []
                    this._IDs = {}
                    this._availableIDs = {}
                    this._highestID = {}

                    this._sendUpdate(removed)
                    this._callListeners('update', removed.map(this._toGroup))

                    callback(null, true)

                    return false
                } else {
                    let removing = this._files.pop()
                    removed.push(removing)

                    fs.unlink(path.join(this._dirname, removing), onFileRemove)
                }
            }

            for (
                let i = 0;
                i < maxSimultaneousFileLoads && i < this._files.length;
                i++
            ) {
                let removing = this._files.pop()
                removed.push(removing)

                fs.unlink(path.join(this._dirname, removing), onFileRemove)
            }
        } else {
            for (let i = 0; i < this._files.length; i++) {
                try {
                    fs.unlinkSync(path.join(this._dirname, this._files[i]))
                } catch (error) {
                    if (error.code !== 'ENOENT') {
                        logger.error(
                            "Database couldn't delete file",
                            name,
                            ':',
                            error
                        )
                    }
                }
            }

            this._sendUpdate(this._files)
            this._callListeners('update', this._files.map(this._toGroup))

            this._list = []
            this._files

            this._groups = []
            this._IDs = {}
            this._availableIDs = {}
            this._highestID = {}

            return true
        }

        return false
    }
}

module.exports = AgnosticDatabase
module.exports.Group = GroupDatabase
