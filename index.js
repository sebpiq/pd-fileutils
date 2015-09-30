exports.parse = require('pd-fileutils.parser').parse
exports.renderSvg = require('./lib/svg-rendering').render
exports.renderPd = require('./lib/pd-rendering').render
exports.Patch = require('./lib/Patch')

if (typeof window !== 'undefined') window.pdfu = exports
