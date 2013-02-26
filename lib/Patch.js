var _ = require('underscore')

var Patch = module.exports = function(obj) { _.extend(this, obj) }

Patch.prototype.getObject = function(id) {
  return _.find(this.nodes, function(node) { return node.id === id }) || null
}

Patch.prototype.guessPortlets = function() {
  var self = this
  _.each(this.nodes, function(node) {
    node.outlets = _.reduce(self.connections, function(memo, conn) {
      if (conn.source.id === node.id) {
        return Math.max(memo, conn.source.port)
      } else return memo
    }, -1) + 1
    node.inlets = _.reduce(self.connections, function(memo, conn) {
      if (conn.sink.id === node.id) {
        return Math.max(memo, conn.sink.port)
      } else return memo
    }, -1) + 1
  })
}
