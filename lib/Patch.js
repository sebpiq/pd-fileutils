var _ = require('underscore')

var Patch = module.exports = function(obj) { _.extend(this, obj) }

Patch.prototype.getObject = function(id) {
  return _.find(this.nodes, function(node) { return node.id === id })
}
