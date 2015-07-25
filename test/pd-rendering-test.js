var path = require('path')
  , fs = require('fs')
  , assert = require('assert')
  , parsing = require('../lib/parsing')
  , pdRendering = require('../lib/pd-rendering')

// http://stackoverflow.com/a/21895354
function normalizeNewlines(str) {
  return str.split(/\r?\n/).join('\n');
}

describe('pd-rendering', function() {

  describe('#render', function() {

    it('should succeed parsing/rendering all test patches identically', function() {
      // TODO
      var patchFile = fs.readFileSync(path.join(__dirname, 'patches', 'simple.pd')).toString()
        , simplePatch = parsing.parse(patchFile)
      assert.equal(pdRendering.render(simplePatch), normalizeNewlines(patchFile))
    })

  })
})
