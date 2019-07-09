const path = require('path')

exports['multi'] = require(path.join(__dirname, '../../items/multi'))
exports['song'] = require(path.join(__dirname, '../../items/song'))
exports['pdf'] = require(path.join(__dirname, '../../items/pdf'))

exports.list = ['multi', 'song', 'pdf']
