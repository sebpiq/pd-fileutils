/*
 * Copyright (c) 2012-2013 Sébastien Piquemal <sebpiq@gmail.com>
 *
 * BSD Simplified License.
 * For information on usage and redistribution, and for a DISCLAIMER OF ALL
 * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
 *
 * See https://github.com/sebpiq/pd-fileutils for documentation
 *
 */

var _ = require('underscore')

var Patch = module.exports = function(obj) { _.extend(this, obj) }


_.extend(Patch.prototype, {

  getNode: function(id) {
    return _.find(this.nodes, function(node) { return node.id === id }) || null
  },

  guessPortlets: function() {
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
  },

  getSinks: function(node) {
    var conns = _.filter(this.connections, function(conn) { return conn.source.id === node.id })
      , sinkIds = _.uniq(_.map(conns, function(conn) { return conn.sink.id }))
      , self = this
    return _.map(sinkIds, function(sinkId) { return self.getNode(sinkId) })
  },

  getSources: function(node) {
    var conns = _.filter(this.connections, function(conn) { return conn.sink.id === node.id })
      , sourceIds = _.uniq(_.map(conns, function(conn) { return conn.source.id }))
      , self = this
    return _.map(sourceIds, function(sourceId) { return self.getNode(sourceId) })
  },

  addNode: function(node) {
    if (node.id === undefined) node.id = this.nextId()
    else if (this.getNode(node.id) !== null) return
    this.nodes.push(node)
  },

  nextId: function() {
    if (this.nodes.length) {
      return Math.max.apply(Math, _.pluck(this.nodes, 'id')) + 1
    } else return 0
  }

})
