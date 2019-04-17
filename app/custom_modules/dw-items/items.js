const path = require('path')

exports['image'] = require(path.join(__dirname, '../../items/image'))
exports['song'] = require(path.join(__dirname, '../../items/song'))
exports['text'] = require(path.join(__dirname, '../../items/text'))

exports.list = ['image', 'song', 'text']
