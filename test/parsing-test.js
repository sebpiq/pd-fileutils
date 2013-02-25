var assert = require('assert')
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
      var patchStr = '#N canvas 778 17 450 300 10;\n'
          + '#X obj 14 13 loadbang;\n'
          + '#X obj 14 34 print bla;\n'
          + '#X connect 0 0 1 0;'
        , patch = parsing.parse(patchStr)
        , loadbang = patch.nodes[0]
        , print = patch.nodes[1]

      assert.deepEqual(patch, {
        nodes: [
          {id: 0, proto: 'loadbang', args: [], guiData: {x: 14, y: 13}},
          {id: 1, proto: 'print', args: ['bla'], guiData: {x: 14, y: 34}},
        ],
        connections: [
          { source: [0, 0], sink: [1, 0] }
        ]
      })
    })

    it('should parse tables rightly', function() {
      var patchStr = '#N canvas 667 72 551 408 10;\n'
          + '#N canvas 0 0 450 300 (subpatch) 0;\n'
          + '#X array myTable 35 float 3;\n'
          + '#A 0 0.1 0.2 0.3 0.4 0.5\n'
          + '0.6 0.7 0.8 0.9 1\n'
          + ';\n'
          + '#A 10 1.1 1.2 1.3 1.4 1.5\n'
          + '1.6 1.7\n'
          + '1.8 1.9 2.0;\n'
          + '#A 20 2.1 2.2 2.3 2.4 2.5\n'
          + '2.6 2.7;\n'
          + '#A 27 2.8 2.9 3.0;\n'
          + '#X coords 0 1 14818 -1 200 140 1;\n'
          + '#X restore 157 26 graph;\n'
          + '#X obj 19 370 osc~ 440;'
        , patch = parsing.parse(patchStr)

      var array = patch.nodes[0].subpatch
      patch.nodes[0].subpatch = null
      array.nodes[0].data = roundArray(array.nodes[0].data, 1)

      assert.deepEqual(patch, {
        nodes: [
          {id: 0, subpatch: null},
          {id: 1, proto: 'osc~', args: [440], guiData: {x: 19, y: 370}},
        ],
        connections: []
      })

      assert.deepEqual(array, {
        nodes: [{id: 0, proto: 'table', args: ['myTable', 35], data:
          [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1,
          1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2, 2.1, 2.2, 2.3, 2.4,
          2.5, 2.6, 2.7, 2.8, 2.9, 3.0, 0, 0, 0, 0, 0]
        }],
        connections: []
      })
    })


    it('should parse tables rightly', function() {
      var patchStr = '#N canvas 340 223 450 300 10;\n'
          + '#X obj 78 81 osc~;\n'
          + '#N canvas 447 260 450 300 mySubpatch 1;\n'
          + '#X obj 46 39 inlet~;\n'
          + '#X obj 47 83 delwrite~ myDel;\n'
          + '#X obj 47 126 delread~ myDel;\n'
          + '#X obj 48 165 outlet~;\n'
          + '#N canvas 842 260 450 300 subSubPatch 1;\n'
          + '#X obj 67 67 outlet~;\n'
          + '#X obj 66 32 phasor~ -440;\n'
          + '#X connect 1 0 0 0;\n'
          + '#X restore 183 83 pd subSubPatch;\n'
          + '#X connect 0 0 1 0;\n'
          + '#X connect 2 0 3 0;\n'
          + '#X restore 79 117 pd mySubpatch;\n'
          + '#X obj 80 175 dac~;\n'
          + '#X connect 0 0 1 0;\n'
          + '#X connect 1 0 2 0;\n'
          + '#X connect 1 0 2 1;\n'
        , patch = parsing.parse(patchStr)

      var subpatch1 = patch.nodes[1].subpatch
        , subpatch2 = subpatch1.nodes[4].subpatch
      patch.nodes[1].subpatch = null
      subpatch1.nodes[4].subpatch = null

      assert.deepEqual(patch, {
        nodes: [
          {id: 0, proto: 'osc~', args: [], guiData: {x: 78, y: 81}},
          {id: 1, subpatch: null},
          {id: 2, proto: 'dac~', args: [], guiData: {x: 80, y: 175}}
        ],
        connections: [
          {source: [0, 0], sink: [1, 0]},
          {source: [1, 0], sink: [2, 0]},
          {source: [1, 0], sink: [2, 1]}
        ]
      })

      assert.deepEqual(subpatch1, {
        nodes: [
          {id: 0, proto: 'inlet~', args: [], guiData: {x: 46, y: 39}},
          {id: 1, proto: 'delwrite~', args: ['myDel'], guiData: {x: 47, y: 83}},
          {id: 2, proto: 'delread~', args: ['myDel'], guiData: {x: 47, y: 126}},
          {id: 3, proto: 'outlet~', args: [], guiData: {x: 48, y: 165}},
          {id: 4, subpatch: null},
        ],
        connections: [
          {source: [0, 0], sink: [1, 0]},
          {source: [2, 0], sink: [3, 0]}
        ]
      })

      assert.deepEqual(subpatch2, {
        nodes: [
          {id: 0, proto: 'outlet~', args: [], guiData: {x: 67, y: 67}},
          {id: 1, proto: 'phasor~', args: [-440], guiData: {x: 66, y: 32}}
        ],
        connections: [
          {source: [1, 0], sink: [0, 0]}
        ]
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
