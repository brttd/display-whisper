//match 'rgb(' and 'rgba(' with rgba?
//Then require opening bracket
//Then require 2-3 repeats of 'Whitespace(0 or more) Digit(1 or more) Anything(0 or more) Comma' (There will be two for rgb, and three for rgba)
//Then require 1 closing 'Whitespace(0 or more) Digit(1 or more) Anything(0 or more) CloseBracket' (This will be the Blue for rgb, and Alpha for rgba)
//NOTE: 'rgb(' with 4 numbers will test as valid,
//and 'rgba(' with 3 numbers will also test as valid
const RGB = /(^rgba?\((\s*\d+.*,){2,3}\s*\d+.*\)$)/i

//match 'hsl(' and 'hsla(' with hsla?
//Then require opening bracket
//Then require 2-3 repeats of 'Whitespace(0 or more) Digit(1 or more) Anything(0 or more) Comma' (There will be two for hsl, and three for hsla)
//Then require 1 closing 'Whitespace(0 or more) Digit(1 or more) Anything(0 or more) CloseBracket' (This will be the Blue for hsl, and Alpha for hsla)
//NOTE: 'hsl(' with 4 numbers will test as valid,
//and 'hsla(' with 3 numbers will also test as valid
const HSL = /(^hsla?\((\s*\d+.*,){2,3}\s*\d+.*\)$)/i

//match '#'
//Then require 3 or 6 repeats of 'Digit or A or B or C or D or E or F'
const Hex = /(^#[\dabcdef]{6}$)|(^#[\dabcdef]{3}$)/i

const notDigit = /\D/g

const colorNames = {
    black: '#000000',
    silver: '#c0c0c0',
    gray: '#808080',
    white: '#ffffff',
    maroon: '#800000',
    red: '#ff0000',
    purple: '#800080',
    fuschia: '#ff00ff',
    green: '#008000',
    lime: '#00ff00',
    olive: '#808000',
    yellow: '#ffff00',
    navy: '#000080',
    blue: '#0000ff',
    teal: '#008080',
    aqua: '#00ffff',
    orange: '#ffa500',

    transparent: '#000000',
    rebeccapurple: '#663399'
}

function hue2rgb(p, q, t) {
    if (t < 0) {
        t += 1
    } else if (t > 1) {
        t -= 1
    }

    if (t < 1 / 6) {
        return p + (q - p) * 6 * t
    }

    if (t < 1 / 2) {
        return q
    }

    if (t < 2 / 3) {
        return p + (q - p) * (2 / 3 - t) * 6
    }

    return p
}

function toRGB(color) {
    color = color.trim().toLowerCase()

    if (RGB.test(color)) {
        return color
    } else if (HSL.test(color)) {
        let numbers = color.split(',')

        if (numbers[0][3] === 'a') {
            numbers[0] = numbers[0].slice(5, numbers[0].length)
        } else {
            numbers[0] = numbers[0].slice(4, numbers[0].length)
        }

        numbers = [
            parseFloat(numbers[0]) / 360,
            parseFloat(numbers[1]) / 100,
            parseFloat(numbers[2]) / 100
        ]

        //saturation
        if (numbers[1] === 0) {
            return (
                'rgb(' +
                Math.floor(numbers[2] * 256).toString() +
                ',' +
                Math.floor(numbers[2] * 256).toString() +
                ',' +
                Math.floor(numbers[2] * 256).toString() +
                ')'
            )
        } else {
            let q =
                numbers[2] < 0.5
                    ? numbers[2] * (1 + numbers[1])
                    : numbers[2] + numbers[1] - numbers[2] * numbers[1]

            let p = 2 * numbers[2] - q

            let r = hue2rgb(p, q, numbers[0] + 1 / 3)
            let g = hue2rgb(p, q, numbers[0])
            let b = hue2rgb(p, q, numbers[0] - 1 / 3)

            return (
                'rgb(' +
                Math.floor(r * 256).toString() +
                ',' +
                Math.floor(g * 256).toString() +
                ',' +
                Math.floor(b * 256).toString() +
                ')'
            )
        }
    } else if (Hex.test(color)) {
        color = color.substring(1, color.length)

        if (color.length === 3) {
            return (
                'rgb(' +
                parseInt(color[0], 16).toString() +
                ',' +
                parseInt(color[1], 16).toString() +
                ',' +
                parseInt(color[2], 16).toString() +
                ')'
            )
        } else if (color.length === 6) {
            return (
                'rgb(' +
                parseInt(color.substring(0, 2), 16).toString() +
                ',' +
                parseInt(color.substring(2, 4), 16).toString() +
                ',' +
                parseInt(color.substring(4, 6), 16).toString() +
                ')'
            )
        } else {
            return 'rgb(0, 0, 0)'
        }
    } else {
        //if the input color is a CSS color name, return that
        //otherwise, return black
        return toRGB(colorNames[color.toLowerCase()] || '#000000')
    }
}

function toHSL(color) {
    color = color.trim().toLowerCase()

    if (RGB.test(color)) {
        //From:
        //http://axonflux.com/handy-rgb-to-hsl-and-rgb-to-hsv-color-model-c

        let numbers = color.split(',')

        if (numbers[0][3] === 'a') {
            numbers[0] = numbers[0].slice(5, numbers[0].length)
        } else {
            numbers[0] = numbers[0].slice(4, numbers.length)
        }

        numbers = [
            parseFloat(numbers[0]) / 255,
            parseFloat(numbers[1]) / 255,
            parseFloat(numbers[2]) / 255
        ]

        let max = Math.max(numbers[0], numbers[1], numbers[2])
        let min = Math.min(numbers[0], numbers[1], numbers[2])

        let h = 0
        let s = 0
        let l = (max + min) / 2

        if (max !== min) {
            let d = max - min

            s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

            switch (max) {
                case r:
                    h = (g - b) / d + (g < b ? 6 : 0)
                    break
                case g:
                    h = (b - r) / d + 2
                    break
                case b:
                    h = (r - g) / d + 4
                    break
            }

            h /= 6
        }

        return (
            'hsl(' +
            (h * 360).toString() +
            ',' +
            (s * 100).toString() +
            '%,' +
            (l * 100).toString() +
            '%)'
        )
    } else if (HSL.test(color)) {
        return color
    } else if (Hex.test(color)) {
        return toHSL(toRGB(color))
    } else {
        //if the input color is a CSS color name, return that
        //otherwise, return black
        return toHSL(toRGB(colorNames[color] || '#000000'))
    }
}

function toHex(color) {
    color = color.trim().toLowerCase()

    if (RGB.test(color)) {
        let numbers = color.split(',')

        //all numbers can't be below 0, or above 255

        //the first number will have 'rgb(' or 'hsl(' in front of it,
        //so that needs to be replaced before parsing it
        let r = Math.min(
            Math.max(parseFloat(numbers[0].replace(notDigit, '')), 0),
            255
        ).toString(16)
        //All hex representations must be two digits,
        //so if it's got only one digit, pad the front with a '0'
        if (r.length === 1) {
            r = '0' + r
        }

        let g = Math.min(Math.max(parseFloat(numbers[1]), 0), 255).toString(16)
        if (g.length === 1) {
            g = '0' + g
        }

        let b = Math.min(Math.max(parseFloat(numbers[2]), 0), 255).toString(16)
        if (b.length === 1) {
            b = '0' + b
        }

        return '#' + r + g + b
    } else if (HSL.test(color)) {
        return toHex(toRGB(color))
    } else if (Hex.test(color)) {
        return color
    } else {
        //if the input color is a CSS color name, return that
        //otherwise, return black
        return colorNames[color] || '#000000'
    }
}

function extractRGB(color) {
    color = toRGB(color)
    color = color.split(',')

    if (color[0][3] === 'a') {
        color[0] = color[0].slice(5, color[0].length)
    } else {
        color[0] = color[0].slice(4, color[0].length)
    }

    return {
        r: parseFloat(color[0]),
        g: parseFloat(color[1]),
        b: parseFloat(color[2])
    }
}

function brightness(color) {
    color = color.trim().toLowerCase()

    if (RGB.test(color)) {
        //From:
        //http://axonflux.com/handy-rgb-to-hsl-and-rgb-to-hsv-color-model-c

        let numbers = color.split(',')

        if (numbers[0][3] === 'a') {
            numbers[0] = numbers[0].slice(5, numbers[0].length)
        } else {
            numbers[0] = numbers[0].slice(4, numbers[0].length)
        }

        numbers = [
            parseFloat(numbers[0]) / 255,
            parseFloat(numbers[1]) / 255,
            parseFloat(numbers[2]) / 255
        ]

        let max = Math.max(numbers[0], numbers[1], numbers[2])
        let min = Math.min(numbers[0], numbers[1], numbers[2])

        //(max + min) = lightness in 0 - 2 range, so multiply by 50 to get 0 - 100 range
        return (max + min) * 50
    } else if (HSL.test(color)) {
        let numbers = color.split(',')
        return parseFloat(numbers[2])
    } else if (Hex.test(color)) {
        return brightness(toRGB(color))
    } else {
        return brightness(toRGB(colorNames[color] || 'hsl(0, 0, 0)'))
    }
}

function isColor(color) {
    if (typeof color !== 'string') {
        return false
    }

    //Check if the color passes RGB, HSL, or Hex regex,
    //or if it's in the list of CSS color names
    return (
        RGB.test(color) ||
        HSL.test(color) ||
        Hex.test(color) ||
        colorNames.hasOwnProperty(color)
    )
}

exports.toRGB = toRGB
exports.toHSL = toHSL
exports.toHex = toHex
exports.isColor = isColor
exports.extractRGB = extractRGB
exports.brightness = brightness
