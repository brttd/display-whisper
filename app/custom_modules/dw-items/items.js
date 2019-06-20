const path = require('path')

exports['image'] = require(path.join(__dirname, '../../items/image'))
exports['song'] = require(path.join(__dirname, '../../items/song'))
exports['text'] = require(path.join(__dirname, '../../items/text'))
exports['pdf'] = require(path.join(__dirname, '../../items/pdf'))

exports.list = ['image', 'song', 'text', 'pdf']
