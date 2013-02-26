var path = require('path')
  , fs = require('fs')
  , assert = require('assert')
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

  })
})
