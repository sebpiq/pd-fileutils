var path = require('path')
  , fs = require('fs')
  , assert = require('assert')
  , parsing = require('../lib/parsing')

// round a number to a given number of decimal places
var round = function(num, dec) {
  dec = dec || 4
  var f = Math.pow(10, dec)
  return Math.round(num * f) / f
}

// apply round to all elements of an array
var roundArray = function(array, dec) {
  var roundedArray = []
  for (var i=0; i<array.length; i++) roundedArray[i] = round(array[i], dec)
  return roundedArray
}

describe('parsing', function() {

  describe('#parseFloat', function() {

    it('should parse floats rightly', function() {
      assert.strictEqual(parsing.parseFloat('789.9'), 789.9)
      assert.strictEqual(parsing.parseFloat('0'), 0)
      assert.strictEqual(parsing.parseFloat('0.'), 0)
      assert.strictEqual(parsing.parseFloat('-0.9'), -0.9)
      assert.strictEqual(parsing.parseFloat('-4e-2'), -0.04)
      assert.strictEqual(parsing.parseFloat('0.558e2'), 55.8)
    })

    it('return NaN if invalid float', function() {
      assert.ok(isNaN(parsing.parseFloat('bla')))
      assert.ok(isNaN(parsing.parseFloat([1])))
    })

  })

  describe('#parseArg', function() {

    it('should parse numbers rightly', function() {
      assert.equal(parsing.parseArg(1), 1)
      assert.equal(parsing.parseArg(0.7e-2), 0.007)
      assert.equal(parsing.parseArg('1'), 1)
      assert.equal(parsing.parseArg('0.7e-2'), 0.007)
    })

    it('should parse strings rightly', function() {
      assert.equal(parsing.parseArg('bla'), 'bla')
    })

    it('should unescape dollar vars', function() {
      assert.equal(parsing.parseArg('\\$15'), '$15')
      assert.equal(parsing.parseArg('\\$15-bla-\\$0'), '$15-bla-$0')
    })

    it('should raise error with invalid args', function() {
      assert.throws(function() {
        parsing.parseArg([1, 2])
      })
      assert.throws(function() {
        parsing.parseArg(null)
      })
    })

  })

  describe('#parseArgs', function() {

    it('should parse list of args rightly', function() {
      var parts
      parts = parsing.parseArgs('bla -1    2 3e-1')
      assert.deepEqual(parts, ['bla', -1, 2, 0.3])

      parts = parsing.parseArgs('bla')
      assert.deepEqual(parts, ['bla'])

      parts = parsing.parseArgs('1.8e2')
      assert.deepEqual(parts, [180])

      parts = parsing.parseArgs(1)
      assert.deepEqual(parts, [1])

      parts = parsing.parseArgs([1, '2', 3, 'quatre'])
      assert.deepEqual(parts, [1, 2, 3, 'quatre'])
    })

    it('should raise if args are invalid', function() {
      assert.throws(function() {
        parsing.parseArgs([1, 2, [], 'quatre'])
      })

      assert.throws(function() {
        parsing.parseArgs(null)
      })
    })

  })

  describe('#parse', function() {

    it('should parse simple patch', function() {
      var patchStr = fs.readFileSync(path.join(__dirname, 'patches', 'simple.pd')).toString()
        , patch = parsing.parse(patchStr)
        , loadbang = patch.nodes[0]
        , print = patch.nodes[1]

      assert.deepEqual(patch, {
        nodes: [
          {id: 0, proto: 'loadbang', args: [], layout: {x: 14, y: 13}},
          {id: 1, proto: 'print', args: ['bla'], layout: {x: 14, y: 34}},
        ],
        connections: [
          { source: {id: 0, port: 0}, sink: {id: 1, port: 0} }
        ],
        layout: {x: 778, y: 17, width: 450, height: 300}
      })
    })

    it('should parse objects and controls rightly', function() {
      var patchStr = fs.readFileSync(path.join(__dirname, 'patches', 'node-elems.pd')).toString()
        , patch = parsing.parse(patchStr)

      assert.deepEqual(patch.nodes[0],
        {id: 0, proto: 'floatatom', args: [0, 0, '-', '-'], layout: {
          x: 73, y: 84, width: 5, labelPos: 0, label: '-'}})

      assert.deepEqual(patch.nodes[1], 
        {id: 1, proto: 'msg', args: [89], layout: {x: 73, y: 43}})

      assert.deepEqual(patch.nodes[2], 
        {id: 2, proto: 'bng', args: [0, 'empty', 'empty'], layout: {
          size: 15, x: 142, y: 42, label: 'empty', labelX: 17, labelY: 7, labelFont: 0, labelFontSize: 10,
          bgColor: -262144, fgColor: -1, labelColor: -1, hold: 250, interrupt: 50}})

      assert.deepEqual(patch.nodes[3], 
        {id: 3, proto: 'tgl', args: [0, 'empty', 'empty', 0, 10], layout: {x: 144, y: 85, size: 15, label: 'empty',
          labelX: 17, labelY: 7, labelFont: 0, labelFontSize: 10, bgColor: -262144, fgColor: -1, labelColor: -1}})

      assert.deepEqual(patch.nodes[4], 
        {id: 4, proto: 'nbx', args: [-1e+37, 1e+37, 0, 'empty', 'empty'], layout: {x: 180, y: 42, size: 5, height: 14,
          log: 0, label: 'empty', labelX: 0, labelY: -8, labelFont: 0, labelFontSize: 10, bgColor: -262144, fgColor: -1,
          labelColor: -1, logHeight: 0}})

      assert.deepEqual(patch.nodes[5], 
        {id: 5, proto: 'hsl', args: [0, 127, 0, 'empty', 'empty', 0], layout: {x: 242, y: 86, width: 128, height: 15, log: 0,
          label: 'empty', labelX: -2, labelY: -8, labelFont: 0, labelFontSize: 10, bgColor: -262144, fgColor: -1,
          labelColor: -1, steadyOnClick: 1}})

      assert.deepEqual(patch.nodes[6],
        {id: 6, proto: 'vradio', args: [1, 0, 8, 'empty', 'empty', 0], layout: {x: 249, y: 137, size: 15, label: 'empty',
          labelX: 0, labelY: -8, labelFont: 0, labelFontSize: 10, bgColor: -262144, fgColor: -1, labelColor: -1}})

      assert.deepEqual(patch.nodes[7],
        {id: 7, proto: 'vu', args: ['empty', 0], layout: {x: 89, y: 141, width: 15, height: 120, label: 'empty',
          labelX: -1, labelY: -8, labelFont: 0, labelFontSize: 10, bgColor: -66577, labelColor: -1, log: 1}})

      assert.deepEqual(patch.nodes[8],
        {id: 8, proto: 'cnv', args: ['empty', 'empty', 0], layout: {x: 317, y: 154, size: 15, width: 100, height: 60,
          label: 'empty', labelX: 20, labelY: 12, labelFont: 0, labelFontSize: 14, bgColor: -233017, labelColor: -66577}})

      assert.deepEqual(patch.nodes[9], 
        {id: 9, proto: 'symbolatom', args: [0, 0, '-', '-'], layout: {x: 255, y: 38, width: 10, labelPos: 0, label: '-'}})

      assert.deepEqual(patch.nodes[10],
        {id: 10, proto: 'text', args: ['bla bla bla bla'], layout: {x: 158, y: 309}})
      
      assert.deepEqual(patch.nodes[11],
        {id: 11, proto: 'vsl', args: [0, 127, 0, 'empty', 'empty', 0], layout: {x: 458, y: 62, width: 15, height: 128, log: 0, 
          label: 'empty', labelX: 0, labelY: -9, labelFont: 0, labelFontSize: 10, bgColor: -262144, fgColor: -1,
          labelColor: -1, steadyOnClick: 1}})

      assert.deepEqual(patch.nodes[12],
        {id: 12, proto: 'hradio', args: [1, 0, 8, 'empty', 'empty', 0], layout: {x: 421, y: 258, size: 15, label: 'empty',
          labelX: 0, labelY: -8, labelFont: 0, labelFontSize: 10, bgColor: -262144, fgColor: -1, labelColor: -1}})

      assert.deepEqual(patch.connections, [
        { source: {id: 1, port: 0}, sink: {id: 0, port: 0} },
        { source: {id: 2, port: 0}, sink: {id: 0, port: 0} },
        { source: {id: 2, port: 0}, sink: {id: 3, port: 0} },
        { source: {id: 4, port: 0}, sink: {id: 3, port: 0} },
        { source: {id: 6, port: 0}, sink: {id: 4, port: 0} }
      ])

    })

    it('should parse array rightly', function() {
      var patchStr = fs.readFileSync(path.join(__dirname, 'patches', 'arrays.pd')).toString()
        , patch = parsing.parse(patchStr)

      var array = patch.nodes[0].subpatch
      patch.nodes[0].subpatch = null
      array.nodes[0].data = roundArray(array.nodes[0].data, 1)

      assert.deepEqual(patch, {
        nodes: [
          {id: 0, proto: 'graph', args: [], layout: {x: 157, y: 26}, subpatch: null},
          {id: 1, proto: 'osc~', args: [440], layout: {x: 19, y: 370}},
        ],
        connections: [],
        layout: {x: 667, y: 72, width: 551, height: 408}
      })

      assert.deepEqual(array, {
        nodes: [
          {
            id: 0, proto: 'table', args: ['myTable', 35],
            data:
              [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1,
              1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2, 2.1, 2.2, 2.3, 2.4,
              2.5, 2.6, 2.7, 2.8, 2.9, 3.0, 0, 0, 0, 0, 0]
          }
        ],
        connections: [],
        layout: {x: 0, y: 0, width: 450, height: 300}
      })
    })

    it('should parse subpatches rightly', function() {
      var patchStr = fs.readFileSync(path.join(__dirname, 'patches', 'subpatches.pd')).toString()
        , patch = parsing.parse(patchStr)

      var subpatch1 = patch.nodes[1].subpatch
        , subpatch2 = subpatch1.nodes[4].subpatch
      patch.nodes[1].subpatch = null
      subpatch1.nodes[4].subpatch = null

      assert.deepEqual(patch, {
        nodes: [
          {id: 0, proto: 'osc~', args: [], layout: {x: 78, y: 81}},
          {id: 1, proto: 'pd', args: ['subPatch'], layout: {x: 79, y: 117}, subpatch: null},
          {id: 2, proto: 'dac~', args: [], layout: {x: 80, y: 175}}
        ],
        connections: [
          {source: {id: 0, port: 0}, sink: {id: 1, port: 0}},
          {source: {id: 1, port: 0}, sink: {id: 2, port: 0}},
          {source: {id: 1, port: 0}, sink: {id: 2, port: 1}}
        ],
        layout: {x: 340, y: 223, width: 450, height: 300}
      })

      assert.deepEqual(subpatch1, {
        nodes: [
          {id: 0, proto: 'inlet~', args: [], layout: {x: 46, y: 39}},
          {id: 1, proto: 'delwrite~', args: ['myDel'], layout: {x: 47, y: 83}},
          {id: 2, proto: 'delread~', args: ['myDel'], layout: {x: 47, y: 126}},
          {id: 3, proto: 'outlet~', args: [], layout: {x: 48, y: 165}},
          {id: 4, proto: 'pd', args: ['subSubPatch'], layout: {x: 183, y: 83}, subpatch: null},
        ],
        connections: [
          {source: {id: 0, port: 0}, sink: {id: 1, port: 0}},
          {source: {id: 2, port: 0}, sink: {id: 3, port: 0}}
        ],
        layout: {x: 447, y: 260, width: 450, height: 300}
      })

      assert.deepEqual(subpatch2, {
        nodes: [
          {id: 0, proto: 'outlet~', args: [], layout: {x: 67, y: 67}},
          {id: 1, proto: 'phasor~', args: [-440], layout: {x: 66, y: 32}}
        ],
        connections: [
          {source: {id: 1, port: 0}, sink: {id: 0, port: 0}}
        ],
        layout: {x: 842, y: 260, width: 450, height: 300}
      })

    })

    it('should fail with an unknown element', function() {
        var patchStr = '#N canvas 778 17 450 300 10;\n'
          + '#X obj 14 13 loadbang;\n'
          + '#X weirdElement 14 34 dac~;\n'
          + '#X connect 0 0 1 0;'
        assert.throws(function() {
          var patch = parsing.parse(patchStr)
        })
    })

    it('should fail with an unknown chunk', function() {
        var patchStr = '#N canvas 778 17 450 300 10;\n'
          + '#X obj 14 13 loadbang;\n'
          + '#WEIRD dac~ 14 34 dac~;\n'
          + '#X connect 0 0 1 0;'
        assert.throws(function() {
          var patch = parsing.parse(patchStr)
        })
    })

  })

})
