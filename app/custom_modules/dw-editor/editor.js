/*
Properties:
    data (object):
        The data being edited, including any changes.
    maxHistory (get/set) (number):
        The maximum number of items to store in the undo history.
    canUndo (boolean):
        True when there are one or more items in the undo history.
    canRedo (boolean):
        True when there are one or more items in the redo history.
    hasChanges (boolean):
        True if there have been changes made which haven't been applied (Regardless of undo history length).
    changes (object):
        An object containing each property which has been changed without being applied.
    util (object):
        Multiple utility methods, listed below.

Methods:
    has(...properties: string):
        Returns true if the data object contains a property with the given name. If multiple properties are specified, will succesively go deeper into the object to check for properties.
    change(...properties: string, data):
        Adds a new change, updating whatever values are given. If multiple arguments are given, every argument (which is a string) except the last will be used to select a property (going deeper into the base data), and then apply the change to only that property.
        If maxHistory > 0, then a new item will be added to the undo history, and the redo history cleared.
    changeHidden(...properties: string, data):
        Does the same as change, except without adding an undoable change.
    changeBase(...properties: string, data):
        Does the same as changeHidden, except it also applies the changes.
        Warning: Can make undo/redo behave unexpectedly!
    addToBase(...properties: string, data):
        Does the same as changeBase, except it only creates new properties, it will not overwrite existing data.
    undo():
        If the undo history has one or more items, will undo whatever the latest change did.
    redo():
        If the redo history has one or more items, will redo whatever the latest undone change did.
    apply():
        Applies all changes to the object, and clears undo/redo history.
    set(data):
        Removed all existing data, and replaces it with given data. All undo/redo history is cleared.
    reset():
        Removes all existing data, and undo/redo history.

Utility methods (editor.util):
    filterObj(object: object, filters: object, blacklist?: boolean):
        Returns a copy of the object with only properties which are true in the filters object.
        If blacklist is false, then returns only properties which aren't true in the filters object (properties not set in filters will be included).
    copyObj(object: object):
        Returns a deep copy of the object.
    applyObj(object: object, changes: object):
        Updates given object to have all properties the given changes object has.
*/

//All data which has been applied (From the base 'set' data)
let base = {}

//All data, and changes to it
let liveData = {}

//List of changes, in order of adding
let changes = []
//List of changes which have been removed
let removedChanges = []

//Every change which hasn't been applied
let allChanges = {}

//A change which includes a key set to 'undefined' will delete that key from the data
//This is to allow removal of named values in a fairly straight forward way
//But has the drawback of not allowing the used of 'undefined' as actual data

//Internally, this means certain variables need to keep their 'undefined' values
//changes, removedChanges, & allChanges keep 'undefined' values
//But whenever those are used to modify other data, they need to use the 'removedUndefined' option of the apply function

let maxChanges = 50

let listeners = {}

function callListeners(name) {
    let passArgs = Array.prototype.slice.call(arguments, 1)

    if (Array.isArray(listeners[name])) {
        for (let i = 0; i < listeners[name].length; i++) {
            listeners[name][i](...passArgs)
        }
    }
}

//Adds all keys (and sub keys) from source object to the target object
//If removeUndefined is true, keys which are set to 'undefined' (in the source object) will be deleted from the target
//Otherwise, the target will also have the key set to 'undefined'
function apply(target, source, removeUndefined = false, ignoreCache = []) {
    if (ignoreCache.includes(source)) {
        return target
    }

    if (Array.isArray(target) && Array.isArray(source)) {
        if (target.length !== source.length) {
            target.length = source.length
        }

        ignoreCache.push(source)

        for (let i = 0; i < source.length; i++) {
            if (typeof source[i] !== 'undefined') {
                if (Array.isArray(source[i])) {
                    if (!Array.isArray(target[i])) {
                        target[i] = []
                    }

                    apply(
                        target[i],
                        source[i],
                        removeUndefined,
                        ignoreCache.slice(0)
                    )
                } else if (
                    typeof source[i] === 'object' &&
                    source[i] !== null
                ) {
                    if (typeof target[i] !== 'object' || target[i] === null) {
                        target[i] = {}
                    }

                    apply(
                        target[i],
                        source[i],
                        removeUndefined,
                        ignoreCache.slice(0)
                    )
                } else {
                    target[i] = source[i]
                }
            }
        }

        return target
    } else if (
        typeof target === 'object' &&
        target !== null &&
        typeof source === 'object' &&
        source !== null
    ) {
        ignoreCache.push(source)

        for (let prop in source) {
            if (source.hasOwnProperty(prop)) {
                if (Array.isArray(source[prop])) {
                    if (!Array.isArray(target[prop])) {
                        target[prop] = []
                    }

                    apply(
                        target[prop],
                        source[prop],
                        removeUndefined,
                        ignoreCache.slice(0)
                    )
                } else if (
                    typeof source[prop] === 'object' &&
                    source[prop] !== null
                ) {
                    if (
                        typeof target[prop] !== 'object' ||
                        target[prop] === null
                    ) {
                        target[prop] = {}
                    }

                    apply(
                        target[prop],
                        source[prop],
                        removeUndefined,
                        ignoreCache.slice(0)
                    )
                } else if (
                    typeof source[prop] === 'undefined' &&
                    removeUndefined
                ) {
                    delete target[prop]
                } else {
                    target[prop] = source[prop]
                }
            }
        }
        return target
    }

    return source
}

//Creates a new object with the same values
function copy(source) {
    //Arrays & objects need to be deep-copied
    //(Using the apply function on an empty array/object)
    //All other types can be returned as is
    return Array.isArray(source)
        ? apply([], source, false)
        : typeof source === 'object'
        ? apply({}, source, false)
        : source
}

//Adds all keys (and sub keys) (if their value is not undefined) from source object which aren't in the target to the target object
function applyNew(target, source, ignoreCache = []) {
    if (ignoreCache.includes(source)) {
        return target
    }

    if (Array.isArray(target) && Array.isArray(source)) {
        ignoreCache.push(source)

        for (let i = target.length; i < source.length; i++) {
            target.push()

            if (typeof source[i] !== 'undefined') {
                if (Array.isArray(source[i])) {
                    if (!Array.isArray(target[i])) {
                        target[i] = []
                    }

                    applyNew(target[i], source[i], ignoreCache.slice(0))
                } else if (typeof source[i] === 'object') {
                    if (typeof target[i] !== 'object' || target[i] === null) {
                        target[i] = {}
                    }

                    applyNew(target[i], source[i], ignoreCache.slice(0))
                } else {
                    target[i] = source[i]
                }
            }
        }

        return target
    } else if (
        typeof target === 'object' &&
        target !== null &&
        typeof source === 'object' &&
        source !== null
    ) {
        ignoreCache.push(source)

        for (let prop in source) {
            if (source.hasOwnProperty(prop) && !target.hasOwnProperty(prop)) {
                if (Array.isArray(source[prop])) {
                    if (!Array.isArray(target[prop])) {
                        target[prop] = []
                    }

                    applyNew(target[prop], source[prop], ignoreCache.slice(0))
                } else if (typeof source[prop] === 'object') {
                    if (
                        typeof target[prop] !== 'object' ||
                        target[prop] === null
                    ) {
                        target[prop] = {}
                    }

                    applyNew(target[prop], source[prop], ignoreCache.slice(0))
                } else if (typeof source[prop] !== 'undefined') {
                    target[prop] = source[prop]
                }
            }
        }

        return target
    }

    return source
}

//Creates a new object with the same values, with only the keys specified in the filters object.
function filter(source, filters, blackList = false, ignoreCache = []) {
    if (ignoreCache.includes(source)) {
        return false
    }

    let target = {}

    if (
        typeof source === 'object' &&
        source !== null &&
        !Array.isArray(source) &&
        typeof filters === 'object' &&
        filters !== null &&
        !Array.isArray(filters)
    ) {
        ignoreCache.push(source)

        if (blackList) {
            for (let prop in source) {
                if (source.hasOwnProperty(prop)) {
                    if (Array.isArray(source[prop])) {
                        if (filters[prop] !== true) {
                            target[prop] = apply([], source[prop], false)
                        }
                    } else if (
                        typeof source[prop] === 'object' &&
                        typeof filters[prop] === 'object' &&
                        filters[prop] !== null
                    ) {
                        target[prop] = filter(
                            source[prop],
                            filters[prop],
                            blackList,
                            ignoreCache.slice(0)
                        )
                    } else if (filters[prop] !== true) {
                        target[prop] = source[prop]
                    }
                }
            }
        } else {
            for (let prop in source) {
                if (source.hasOwnProperty(prop)) {
                    if (Array.isArray(source[prop])) {
                        if (filters[prop] === true) {
                            target[prop] = apply([], source[prop], false)
                        }
                    } else if (
                        typeof source[prop] === 'object' &&
                        typeof filters[prop] === 'object' &&
                        filters[prop] !== null
                    ) {
                        target[prop] = filter(
                            source[prop],
                            filters[prop],
                            blackList,
                            ignoreCache.slice(0)
                        )
                    } else if (filters[prop] === true) {
                        target[prop] = source[prop]
                    }
                }
            }
        }
    }

    return target
}

//Returns true if the two objects have the same values
function sameObj(a, b, ignoreCache = []) {
    if (a === b || (isNaN(a) && isNaN(b))) {
        return true
    }

    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) {
            return false
        }

        ignoreCache.push(a, b)

        for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i] && !same(a[i], b[i], ignoreCache.slice(0))) {
                return false
            }
        }

        return true
    } else if (
        typeof a === 'object' &&
        typeof b === 'object' &&
        a !== null &&
        b !== null &&
        !Array.isArray(a) &&
        !Array.isArray(b)
    ) {
        let keys = Object.keys(a)

        if (
            keys.length !==
            Object.keys(b).filter(key => keys.includes(key)).length
        ) {
            return false
        }

        ignoreCache.push(a, b)

        for (let i = 0; i < keys.length; i++) {
            if (
                a[keys[i]] !== b[keys[i]] &&
                !same(a[keys[i]], b[keys[i]], ignoreCache.slice(0))
            ) {
                return false
            }
        }

        return true
    }

    return false
}

function extractChangesTo(target, source, extract) {
    if (
        Array.isArray(extract) &&
        Array.isArray(source) &&
        Array.isArray(target)
    ) {
        for (let i = Math.min(extract.length, source.length) - 1; i >= 0; i--) {
            if (
                typeof extract[i] === 'object' &&
                extract[i] !== null &&
                typeof source[i] === 'object' &&
                source[i] !== null
            ) {
                if (Array.isArray(source[i]) && !Array.isArray(target[i])) {
                    target[i] = []
                } else if (
                    Array.isArray(target[i]) ||
                    target[i] === null ||
                    typeof target[i] !== 'object'
                ) {
                    target[i] = {}
                }

                extractChangesTo(target[i], source[i], extract[i])

                if (Array.isArray(extract[i])) {
                    if (extract[i].every(value => value === undefined)) {
                        extract[i] = undefined
                    }
                } else if (Object.keys(extract[i]).length === 0) {
                    extract[i] = undefined
                }
            } else if (typeof extract[i] !== 'undefined') {
                target[i] = source[i]

                extract[i] = undefined
            }
        }
    } else if (
        typeof extract === 'object' &&
        extract !== null &&
        typeof source === 'object' &&
        source !== null &&
        typeof target === 'object' &&
        target !== null
    ) {
        for (let property in extract) {
            if (
                extract.hasOwnProperty(property) &&
                source.hasOwnProperty(property)
            ) {
                if (
                    typeof extract[property] === 'object' &&
                    extract[property] !== null &&
                    typeof source[property] === 'object' &&
                    source[property] !== null
                ) {
                    if (
                        Array.isArray(source[property]) &&
                        !Array.isArray(target[property])
                    ) {
                        target[property] = []
                    } else if (
                        Array.isArray(target[property]) ||
                        target[property] === null ||
                        typeof target[property] !== 'object'
                    ) {
                        target[property] = {}
                    }

                    extractChangesTo(
                        target[property],
                        source[property],
                        extract[property]
                    )

                    if (Array.isArray(extract[property])) {
                        if (
                            extract[property].every(
                                value => value === undefined
                            )
                        ) {
                            extract[property] = undefined
                        }
                    } else if (Object.keys(extract[property]).length === 0) {
                        delete extract[property]
                    }
                } else {
                    target[property] = source[property]

                    delete extract[property]
                }
            }
        }
    }

    return target
}

function makeSingleObject() {
    let obj = {}

    if (
        typeof arguments[0] === 'object' &&
        arguments[0] !== null &&
        !Array.isArray(arguments[0])
    ) {
        if (Object.keys(arguments[0]).length === 0) {
            return false
        }

        obj = apply({}, arguments[0], false)
    } else {
        let currentLevel = obj

        for (let i = 0; i < arguments.length - 1; i++) {
            if (typeof arguments[i] !== 'string') {
                return false
            }

            if (i === arguments.length - 2) {
                currentLevel[arguments[i]] = copy(
                    arguments[arguments.length - 1]
                )
            } else {
                currentLevel[arguments[i]] = {}
                currentLevel = currentLevel[arguments[i]]
            }
        }
    }

    return obj
}

function updateExportedData() {
    exports.data = Object.freeze(copy(liveData))
}

function addToAllChanges(change) {
    apply(allChanges, change, false)

    apply(liveData, change, true)

    updateExportedData()
}

exports.data = {}

Object.defineProperty(exports, 'maxHistory', {
    get: () => {
        return maxChanges
    },
    set: max => {
        if (typeof max === 'number' && isFinite(max) && max >= 1) {
            maxChanges = max
        }
    }
})

Object.defineProperty(exports, 'canUndo', {
    get: () => {
        return changes.length > 0
    }
})
Object.defineProperty(exports, 'canRedo', {
    get: () => {
        return removedChanges.length > 0
    }
})

Object.defineProperty(exports, 'hasChanges', {
    get: () => {
        return Object.keys(allChanges).length !== 0
    }
})

Object.defineProperty(exports, 'changes', {
    get: () => {
        //The 'removeUndefined' option of the apply function false, meaning the code asking for the changes will recieve any 'undefined' values
        return apply({}, allChanges, false)
    }
})

exports.onEvent = function(eventName, callbackFunction) {
    if (
        typeof eventName === 'string' &&
        typeof callbackFunction === 'function'
    ) {
        if (!Array.isArray(listeners[eventName])) {
            listeners[eventName] = []
        }

        listeners[eventName].push(callbackFunction)
    }
}

exports.undo = function() {
    if (changes.length === 0) {
        return null
    }

    let change = changes.pop()
    removedChanges.push(apply({}, change, false))

    //what the values were, before the change was applied
    let originalData = {}

    let index = changes.length - 1
    //go backwards through each change, and try to extract the values from it
    while (Object.keys(change).length > 0 && index >= 0) {
        extractChangesTo(originalData, changes[index], change)

        index -= 1
    }

    //if all original values still haven't been found, take them from the base data
    if (Object.keys(change).length > 0) {
        extractChangesTo(originalData, base, change)
    }

    //Update the change info
    addToAllChanges(originalData)

    //If there are no more changes to go back, the allChanges object needs to be cleared
    //(Otherwise it's a copy of the original data, without any actual changes)
    if (changes.length === 0) {
        allChanges = {}
    }

    callListeners('history')
    callListeners('change', 'undo', originalData)

    return originalData
}
exports.redo = function() {
    if (removedChanges.length === 0) {
        return null
    }

    let change = removedChanges.pop()

    changes.push(change)

    addToAllChanges(change)

    callListeners('history')
    callListeners('change', 'redo', change)

    return change
}

exports.change = function() {
    if (arguments.length === 0) {
        return false
    }

    let changeData = makeSingleObject(...arguments)

    //When a change is added, all redo history is invalidated
    removedChanges = []

    if (changes.length >= maxChanges) {
        //Remove the oldest change, and update the base data
        let change = changes.shift()

        apply(base, change, true)
    }

    changes.push(changeData)
    addToAllChanges(changeData)

    callListeners('history')
    callListeners('change', 'change', changeData)

    return true
}

//changeHidden does everything that change does, except for increase history
//So it's a change which you can't undo, but counts as a historical change (.hasChanges = true)
//changeBase isn't consistent, because it's changing the lowest level without changing history. So undoing can mess it up
exports.changeHidden = function() {
    if (arguments.length === 0) {
        return false
    }

    let changeData = makeSingleObject(...arguments)

    addToAllChanges(changeData)

    callListeners('change', 'change-hidden', changeData)
}

exports.changeBase = function() {
    if (arguments.length === 0) {
        return false
    }

    let changeData = makeSingleObject(...arguments)

    apply(base, changeData, true)
    apply(liveData, changeData, true)

    updateExportedData()

    callListeners('change', 'change-base', changeData)
}

exports.addToBase = function() {
    if (arguments.length === 0) {
        return false
    }

    let changeData = makeSingleObject(...arguments)

    applyNew(base, changeData)
    applyNew(liveData, changeData)

    updateExportedData()

    callListeners('change', 'add-to-base', changeData)
}

exports.has = function() {
    let currentLevel = liveData

    for (let i = 0; i < arguments.length; i++) {
        if (
            typeof arguments[i] !== 'string' ||
            !currentLevel.hasOwnProperty(arguments[i])
        ) {
            return false
        }

        currentLevel = currentLevel[arguments[i]]
    }

    return true
}

exports.isDefined = function() {
    let currentLevel = liveData

    for (let i = 0; i < arguments.length; i++) {
        if (
            typeof arguments[i] !== 'string' ||
            !currentLevel.hasOwnProperty(arguments[i]) ||
            typeof currentLevel[arguments[i]] === 'undefined'
        ) {
            return false
        }

        currentLevel = currentLevel[arguments[i]]
    }

    return true
}

exports.apply = function() {
    apply(base, allChanges, true)

    //The listeners get allChanges WITH 'undefined' values intact
    //Removing them would incorrectly signal that those keys hadn't changed
    //So they are sent as-is, which all listeners need to be aware of
    callListeners('output', apply({}, allChanges, false))

    allChanges = {}
    changes = []
    removedChanges = []

    callListeners('history')
    callListeners('change', 'apply', {})
}

exports.set = function(data) {
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
        return false
    }

    base = apply({}, data, true)

    liveData = apply({}, data, true)

    allChanges = {}
    changes = []
    removedChanges = []

    updateExportedData()

    callListeners('history')
    callListeners('change', 'set', data)
}

exports.reset = function() {
    base = {}
    liveData = {}

    allChanges = {}
    changes = []
    removedChanges = []

    updateExportedData()

    callListeners('history')
    callListeners('change', 'reset', {})
}

exports.util = {
    filterObj: filter,
    copyObj: copy,
    applyObj: apply,
    isObj: obj => {
        return typeof obj === 'object' && obj !== null && !Array.isArray(obj)
    },
    same: sameObj
}
