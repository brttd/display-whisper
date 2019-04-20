const arrowRE = new RegExp(/[<>]/gm)

const specialRE = {
    lt: new RegExp(/</g),
    gt: new RegExp(/>/g),
    amp: new RegExp(/&/g)
}
const entityRE = {
    '<': new RegExp(/&lt;/g),
    '>': new RegExp(/&gt;/g),
    '&': new RegExp(/&amp;/g)
}
const cleanRE = new RegExp(
    '(<b><\\/b>|<\\/b><b>|<i><\\/i>|<\\/i><i>|<u><\\/u>|<\\/u><u>|<s><\\/s>|<\\/s><s>|<sub><\\/sub>|<\\/sub><sub>|<sup><\\/sup>|<\\/sup><sup>)',
    'gim'
)
const newLineCleanRE = new RegExp(
    '(<b>\\n<\\/b>|<\\/b>\\n<b>|<i>\\n<\\/i>|<\\/i>\\n<i>|<u>\\n<\\/u>|<\\/u>\\n<u>|<s>\\n<\\/s>|<\\/s>\\n<s>|<sub>\\n<\\/sub>|<\\/sub>\\n<sub>|<sup>\\n<\\/sup>|<\\/sup>\\n<sup>)',
    'gim'
)

const dataRE = new RegExp('({[^{}\n]+})', 'gi')

const tagRE = new RegExp('(\\<[^\\s\\>]*\\>)', 'gi')

const validTags = ['b', 'i', 'u', 's', 'sub', 'sup']

function tagType(str) {
    if (str[0] === '<') {
        str = str.substring(1, str.length)
    }

    if (str[str.length - 1] === '>') {
        str = str.substring(0, str.length - 1)
    }

    if (str[0] === '/') {
        str = str.substring(1, str.length)
    }

    return str.toLowerCase()
}

function tagOpen(tag) {
    return '<' + tagType(tag) + '>'
}
function tagClose(tag) {
    return '</' + tagType(tag) + '>'
}

function hasTag(list, tag) {
    return list.includes(tagType(tag))
}

function tagIndex(list, tag) {
    return list.indexOf(tagType(tag))
}

function removeTag(list, tag) {
    let index = list.indexOf(tagType(tag))

    if (index >= 0) {
        list.splice(index, 1)
    }

    return list
}

function encodeSpecial(str) {
    return str
        .replace(specialRE.amp, '&amp;')
        .replace(specialRE.lt, '&lt;')
        .replace(specialRE.gt, '&gt;')
}
function decodeSpecial(str) {
    return str
        .replace(entityRE['<'], '<')
        .replace(entityRE['>'], '>')
        .replace(entityRE['&'], '&')
}

function length(text) {
    if (typeof text !== 'string') {
        return 0
    }

    let length = 0

    let inTag = false
    let inSpecial = false

    for (let i = 0; i < text.length; i++) {
        if (inTag) {
            if (text[i] === '>') {
                inTag = false
            }
        } else if (inSpecial) {
            if (text[i] === ';') {
                inSpecial = false
            }
        } else if (text[i] === '<') {
            inTag = true
        } else if (text[i] === '&') {
            inSpecial = true
        } else {
            length += 1
        }
    }

    return length
}

function slice(text, from, to) {
    if (typeof text !== 'string') {
        return ''
    }
    if (typeof from !== 'number') {
        return text
    }
    if (typeof to !== 'number') {
        to = length(text)
    }

    let length = 0

    let activeTags = []
    let parts = text.split(arrowRE)

    let output = ''

    for (let i = 0; i < parts.length && length < to; i += 2) {
        //current text is parts[i]
        //Next tag is parts[i + 1]

        if (length < from && length + parts[i].length > from) {
            for (let j = 0; j < activeTags.length; j++) {
                output += tagOpen(activeTags[j])
            }
        }

        output += parts[i].slice(
            Math.max(0, from - length - 1),
            Math.max(0, to - length - 1)
        )
        length += parts[i].length

        if (i + 1 < parts.length) {
            let tag = parts[i + 1]

            if (length < to) {
                if (tag[0] === '/') {
                    let index = activeTags.indexOf(tagType(tag))

                    //Only close tags if before the end
                    if (index >= 0) {
                        //close all tags which are before the current tag
                        for (let j = activeTags.length - 1; j > index; j--) {
                            output += tagClose(activeTags[j])
                        }

                        output += tagClose(tag)

                        removeTag(activeTags, tag)

                        for (let j = index; j < activeTags.length; j++) {
                            output += tagOpen(activeTags[j])
                        }
                    }
                } else {
                    //opening tag
                    if (activeTags.includes(tag)) {
                        output += tagClose(tag)

                        removeTag(activeTags, tag)
                    }

                    output += tagOpen(tag)

                    activeTags.push(tag)
                }
            }
        }
    }

    for (let i = activeTags.length - 1; i >= 0; i--) {
        output += tagClose(activeTags[i])
    }

    return basicClean(output)
}

function split(text, splitter) {
    if (
        typeof text !== 'string' ||
        (typeof splitter !== 'string' && splitter instanceof RegExp !== true)
    ) {
        return []
    }

    if (splitter === '') {
        return [text]
    }

    let output = ['']

    let activeTags = []
    let richParts = text.split(arrowRE)

    for (let i = 0; i < richParts.length; i += 2) {
        let sections = richParts[i].split(splitter)

        //Add the text content of the first (and possible only) section to the current output
        output[output.length - 1] += sections[0]

        //If there is more than one section, close all tags in the first section
        if (sections.length > 1) {
            for (let j = activeTags.length - 1; j >= 0; j--) {
                output[output.length - 1] += tagClose(activeTags[j])
            }
        }

        //Add each subsequent section
        for (let j = 1; j < sections.length; j++) {
            //Since the last section is finished, clean it
            output[output.length - 1] = basicClean(output[output.length - 1])

            //Add a new section, and open all tags in it
            output.push('')
            for (let k = 0; k < activeTags.length; k++) {
                output[output.length - 1] += tagOpen(activeTags[k])
            }

            //Add the text content to the new section
            output[output.length - 1] += sections[j]

            //If this isn't the last section, close all tags in it
            if (j < sections.length - 1) {
                for (let k = activeTags.length - 1; k >= 0; k--) {
                    output[output.length - 1] += tagClose(activeTags[k])
                }
            }
        }

        //If there is a tag
        if (i + 1 < richParts.length) {
            let tag = richParts[i + 1]

            if (tag[0] === '/') {
                let index = tagIndex(activeTags, tag)

                //Valid closing tag
                if (index >= 0) {
                    //Close each tag, up to (and including) the one being removed
                    for (let j = activeTags.length - 1; j >= index; j--) {
                        output[output.length - 1] += tagClose(activeTags[j])
                    }

                    removeTag(activeTags, tag)

                    //And then reopen any tags which were closed
                    for (let j = index; j < activeTags.length; j++) {
                        output[output.length - 1] + tagOpen(activeTags[j])
                    }
                }
            } else if (!hasTag(activeTags, tag)) {
                output[output.length - 1] += tagOpen(tag)

                activeTags.push(tagType(tag))
            }
        }
    }

    //Sections are only cleaned when a new one is added,
    //so the last one needs to be cleaned when the loop finishes
    output[output.length - 1] = basicClean(output[output.length - 1])

    return output
}

function removeFormat(text) {
    if (typeof text !== 'string') {
        return ''
    }

    let output = ''
    let parts = text.split(arrowRE)

    for (let i = 0; i < parts.length; i += 2) {
        output += parts[i]
    }

    return decodeSpecial(output)
}

function format(text) {
    if (typeof text !== 'string') {
        return ''
    }

    return encodeSpecial(text)
}

function getStartTags(text) {
    if (typeof text !== 'string') {
        return []
    }

    let richParts = text.trim().split(arrowRE)

    let startTags = []

    for (let i = 0; i < richParts.length; i += 2) {
        if (richParts[i] !== '') {
            break
        } else if (i + 1 < richParts.length) {
            let tag = richParts[i + 1]

            if (tag[0] === '/') {
                if (startTags.includes(tagType(tag))) {
                    startTags.splice(startTags.indexOf(tagType(tag)), 1)
                }
            } else {
                startTags.push(tagType(tag))
            }
        }
    }

    return startTags
}

function basicClean(text) {
    if (typeof text !== 'string') {
        return ''
    }

    return text.replace(cleanRE, '').replace(newLineCleanRE, '\n')
}

function clean(text) {
    if (typeof text !== 'string') {
        return ''
    }

    let activeTags = []
    let parts = basicClean(text).split(arrowRE)

    let output = ''

    //Every second item in the parts array will be a tag
    for (let i = 0; i < parts.length; i += 2) {
        output += parts[i]

        if (i + 1 < parts.length) {
            let tag = parts[i + 1]

            if (validTags.includes(tagType(tag))) {
                if (tag[0] === '/') {
                    let index = tagIndex(activeTags, tag)

                    if (index >= 0 && index < activeTags.length) {
                        for (let j = activeTags.length - 1; j >= index; j--) {
                            output += tagClose(activeTags[j])
                        }

                        removeTag(activeTags, tag)

                        //reopen all closed tags
                        for (let j = index; j < activeTags.length; j++) {
                            output += tagOpen(activeTags[j])
                        }
                    }
                } else if (!hasTag(activeTags, tag)) {
                    output += tagOpen(tag)

                    activeTags.push(tag)
                }
            }
        }
    }

    //close any remaining tags
    for (let i = activeTags.length - 1; i >= 0; i--) {
        output += tagClose(activeTags[i])
    }

    return basicClean(output)
}

function fromNode(node) {
    if (node.nodeType === 3) {
        return encodeSpecial(node.textContent)
    }

    if (node.nodeType !== 1 || node.textContent.length === 0) {
        return ''
    }

    let output = ''

    let outerTags = []

    if (validTags.includes(tagType(node.tagName))) {
        outerTags.push(tagType(node.tagName))
    } else if (node.tagName.toLowerCase() === 'strike') {
        outerTags.push('s')
    } else if (node.tagName.toLowerCase() === 'em') {
        outerTags.push('i')
    } else if (node.tagName.toLowerCase() === 'strong') {
        outerTags.push('b')
    }

    if (node.style.fontStyle === 'bold' && !outerTags.includes('b')) {
        outerTags.push('b')
    }
    if (node.style.fontStyle === 'italic' && !outerTags.includes('i')) {
        outerTags.push('i')
    }

    if (node.style.textDecoration === 'underline' && !outerTags.includes('u')) {
        outerTags.push('u')
    }

    if (
        node.style.textDecoration === 'line-through' &&
        !outerTags.includes('s')
    ) {
        outerTags.push('s')
    }

    for (let i = 0; i < outerTags.length; i++) {
        output += tagOpen(outerTags[i])
    }

    for (let i = 0; i < node.childNodes.length; i++) {
        output += fromNode(node.childNodes[i])
    }

    for (let i = outerTags.length - 1; i >= 0; i--) {
        output += tagClose(outerTags[i])
    }

    return output
}

function distributeLines(text, maxLines, trimEnd = false) {
    if (
        typeof text !== 'string' ||
        typeof maxLines !== 'number' ||
        !isFinite(maxLines)
    ) {
        return ['']
    }

    let lines = split(text, '\n')

    if (trimEnd) {
        while (lines.length > 1 && lines[lines.length - 1].trim() === '') {
            lines.splice(lines.length - 1, 1)
        }
    }

    if (maxLines === 0 || lines.length <= maxLines) {
        return [basicClean(lines.join('\n'))]
    }

    //Maximum lines per part
    let linesPerPart = Math.ceil(
        lines.length / Math.ceil(lines.length / maxLines)
    )

    let parts = []

    for (
        let lineIndex = 0;
        lineIndex < lines.length;
        lineIndex += linesPerPart
    ) {
        parts.push(lines.slice(lineIndex, lineIndex + linesPerPart).join('\n'))
    }

    return parts
}

function splitLines(text, lineIndex) {
    let lines = split(text, '\n')

    if (lineIndex < 0 || lineIndex >= lines.length) {
        return [text]
    }

    return [
        lines.slice(0, lineIndex).join('\n'),
        lines.slice(lineIndex).join('\n')
    ]
}

function dataReplace(text, data) {
    if (
        typeof text !== 'string' ||
        typeof data !== 'object' ||
        Array.isArray(data) ||
        data === null
    ) {
        return false
    }

    let output = ''

    let parts = text.split(dataRE)

    for (let i = 0; i < parts.length; i += 2) {
        output += parts[i]

        if (i + 1 < parts.length) {
            //The two parts of the expression, name : fallback
            let expression = parts[i + 1].slice(1, -1).split(':')

            //Get the name, and split it up into text, tag parts
            //The results array will have the form:
            //[text, tag, text, tag, text ...etc]
            //So every even index is part of the name
            //And every odd index is a tag
            let dataName = expression[0].split(tagRE)

            //Extract all tags from the name, by removing every item which doesn't have an odd index
            let dataTags = dataName
                .filter((v, index) => index % 2 === 1)
                .join('')

            let defaultValue = false
            let defaultTags = ''

            if (expression.length === 2) {
                defaultValue = expression[1]

                //Extract all tags from the fallback value,
                //By splitting it up into a text, tag array
                //And removing every item which doesn't have an odd index
                defaultTags = defaultValue
                    .split(tagRE)
                    .filter((v, index) => index % 2 === 1)
                    .join('')
            }

            //Extract everything except for tags
            dataName = dataName.filter((v, index) => index % 2 === 0).join('')

            if (
                typeof data[dataName] === 'string' &&
                data[dataName].trim() !== ''
            ) {
                //if the referenced value exists, and isn't empty, the output it
                output += data[dataName]

                //Since the replaced value doesn't include any of the rich text tags present in the original expression (from the name and fallback),
                //They need to be added back in to preserve any sections of rich text formatting
                //(So that any closing tags are not left unclosed)
                output += dataTags
                output += defaultTags
            } else if (defaultValue) {
                //Since the fallback value doesn't include any of the rich text tags present in the data name,
                //They need to be inserted before the fallback text, to preserve any sections of rich text format which opened/closed in the data expression name
                output += dataTags

                output += defaultValue
            } else {
                //If neither the referenced value, nor the fallback value are valid,
                //Then output the expression without any modification
                output += parts[i + 1]
            }
        }
    }

    return output
}

exports.length = length
exports.slice = slice
exports.format = format
exports.removeFormat = removeFormat
exports.clean = clean

exports.getTags = getStartTags

exports.split = split
exports.lines = text => split(text, '\n')

exports.fromNode = fromNode

exports.distributeLines = distributeLines
exports.splitLines = splitLines

exports.dataReplace = dataReplace
