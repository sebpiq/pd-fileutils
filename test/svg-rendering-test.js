var path = require('path')
  , fs = require('fs')
  , assert = require('assert')
  , mustache = require('mustache')
  , parsing = require('../lib/parsing')
  , svg = require('../lib/svg-rendering')

describe('svg-rendering', function() {

  describe('#render', function() {

    it('should succeed rendering a patch', function() {
      var rendered = svg.render({
        nodes: [
          {id: 0, proto: 'loadbang', args: [], layout: {x: 14, y: 13}},
          {id: 1, proto: 'print', args: ['bla'], layout: {x: 14, y: 34}},
        ],
        connections: [
          { source: {id: 0, port: 0}, sink: {id: 1, port: 0} }
        ]
      })
    })

    it('should succeed rendering all test patches', function() {
      // Render svgs
      var svgFilenames = []
      fs.readdirSync(path.join(__dirname, 'patches')).forEach(function(filename) {
        var patchStr = fs.readFileSync(path.join(__dirname, 'patches', filename)).toString()
          , patch = parsing.parse(patchStr)
          , svgFilename = filename.slice(0, -3) + '.svg'
        svgFilenames.push(svgFilename)
        fs.writeFileSync(path.join(__dirname, 'rendered', svgFilename), svg.render(patch))
      })

      // Put them all in a single HTML page
      var template = fs.readFileSync(path.join(__dirname, 'rendered', 'embedded-in-a-page.hbs')).toString()
        , images = ''
        , htmlFilename = path.join(__dirname, 'rendered', 'embedded-in-a-page.html')
      svgFilenames.forEach(function(filename) { images += '<img src="' + filename + '"/>' })
      fs.writeFileSync(htmlFilename, mustache.render(template, { images: images }))
    })

  })
})
