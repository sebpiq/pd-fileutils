var assert = require('assert')
  , Patch = require('../lib/Patch')

describe('Patch', function() {

  describe('#getObject', function() {

    it('should return the right object if existing', function() {
      var patch = new Patch(
        {nodes: [
          {id: 78, attr1: 90}, {id: 56, attr1: 88}, {id: 2, attr1: 5}
        ]}
      )
      assert.deepEqual(patch.getObject(56), {id: 56, attr1: 88})
      assert.deepEqual(patch.getObject(2), {id: 2, attr1: 5})
    })

  })

})
