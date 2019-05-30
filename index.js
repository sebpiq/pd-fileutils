var JSDOM = require('jsdom').JSDOM
  , fs = require('fs')
  , path = require('path')
  , svgRendering = require('./lib/svg-rendering')

// Set default css style for rendering
svgRendering.defaults.style = fs.readFileSync(
  path.join(__dirname, 'lib', 'svg-default-style.css')
).toString()

// Set global document for d3
global.document = (new JSDOM('...')).window.document

exports.parse = require('pd-fileutils.parser').parse
exports.renderSvg = svgRendering.render
exports.renderPd = require('./lib/pd-rendering').render
exports.Patch = require('./lib/Patch')