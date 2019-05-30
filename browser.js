var svgRendering = require('./lib/svg-rendering')

// Set default css style for rendering
svgRendering.defaults.style = require('./lib/svg-default-style.css')

exports.parse = require('pd-fileutils.parser').parse
exports.renderSvg = svgRendering.render
exports.renderPd = require('./lib/pd-rendering').render
exports.Patch = require('./lib/Patch')
window.pdfu = exports
