var path = require('path')
  , fs = require('fs')
  , assert = require('assert')
  , parsing = require('../lib/parsing')
  , svg = require('../lib/svg-rendering')

describe('svg-rendering', function() {

  describe('#render', function() {

    it('should succeed rendering a patch', function() {
      var rendered = svg.render({
        nodes: [
          {id: 0, proto: 'loadbang', args: [], guiData: {x: 14, y: 13}},
          {id: 1, proto: 'print', args: ['bla'], guiData: {x: 14, y: 34}},
        ],
        connections: [
          { source: {id: 0, port: 0}, sink: {id: 1, port: 0} }
        ]
      })
    })

    it('should succeed rendering all test patches', function() {
      var simplePatch = fs.readFileSync(path.join(__dirname, 'patches', 'simple.pd')).toString()
        , arraysPatch = fs.readFileSync(path.join(__dirname, 'patches', 'arrays.pd')).toString()
        , subpatchesPatch = fs.readFileSync(path.join(__dirname, 'patches', 'subpatches.pd')).toString()
        , nodeElemsPatch = fs.readFileSync(path.join(__dirname, 'patches', 'node-elems.pd')).toString()
      simplePatch = parsing.parse(simplePatch)
      arraysPatch = parsing.parse(arraysPatch)
      subpatchesPatch = parsing.parse(subpatchesPatch)
      nodeElemsPatch = parsing.parse(nodeElemsPatch)
      fs.writeFileSync(path.join(__dirname, 'rendered', 'simple.svg'), svg.render(simplePatch))
      fs.writeFileSync(path.join(__dirname, 'rendered', 'arrays.svg'), svg.render(arraysPatch))
      fs.writeFileSync(path.join(__dirname, 'rendered', 'subpatches.svg'), svg.render(subpatchesPatch))
      fs.writeFileSync(path.join(__dirname, 'rendered', 'node-elems.svg'), svg.render(nodeElemsPatch))
    })

  })
})
