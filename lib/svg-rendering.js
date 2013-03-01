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
  , d3 = require('d3')
  , Patch = require('./Patch')

var opts = {
  portletWidth: 5,
  portletHeight: 3.5,
  objMinWidth: 25,
  objMinHeight: 15,
  ratio: 1.2
}

exports.render = function(patch) {
  d3.select('svg').remove()
  var svg = d3.select('body').append('svg')
      .attr('style', 'font-family:monospace')
    , connections, nodes
  svg.attr('xmlns', 'http://www.w3.org/2000/svg')
  svg.attr('version', '1.1')

  patch = new Patch(patch)
  patch.guessPortlets()
  patch.nodes = _.map(patch.nodes, function(node) {
    if (node.proto === 'msg') return new MsgRenderer(node)
    else if (node.proto === 'text') return new TextRenderer(node)
    else if (node.proto === 'floatatom' || node.proto === 'symbolatom') return new AtomBoxRenderer(node)
    else if (node.proto === 'bng') return new BngRenderer(node)
    else return new ObjectRenderer(node)
  })

  // Create the nodes
  nodes = svg.selectAll('g.node')
    .data(patch.nodes)
    .enter()
    .append('g')
    .attr('transform', function(renderer) {
      return 'translate(' + renderer.getX() + ',' + renderer.getY() + ')'
    })
    .attr('class', 'node')
    .each(function(renderer, i) { renderer.render(d3.select(this)) })

  // Create the connections
  connections = svg.selectAll('line.connection')
    .data(patch.connections)
    .enter()
    .append('line')
    .attr('class', 'connection')
    .attr('style', 'stroke:black;stroke-width:2px;')
    .each(function(conn) {
      var sourceRenderer = patch.getNode(conn.source.id)
        , sinkRenderer = patch.getNode(conn.sink.id)

      d3.select(this)
        .attr('x1', function(conn) {
          return sourceRenderer.getOutletX(conn.source.port) + opts.portletWidth/2
        })
        .attr('y1', function(conn) {
          return sourceRenderer.getOutletY(conn.source.port) + opts.portletHeight
        })
        .attr('x2', function(conn) {
          return sinkRenderer.getInletX(conn.sink.port) + opts.portletWidth/2 
        })
        .attr('y2', function(conn) {
          return sinkRenderer.getInletY(conn.sink.port)
        })
    })

  var rendered = d3.select('body')[0][0].innerHTML
  rendered = '<?xml version="1.0" standalone="no"?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" '
    +'"http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">' + rendered
  return rendered

}

//==================== Node renderers ====================//

var NodeRenderer = function(node) {

  this.node = node
  this.id = node.id

}

_.extend(NodeRenderer.prototype, {

  // Returns node X in the canvas
  getX: function() { return this.node.guiData.x * opts.ratio },

  // Returns node Y in the canvas
  getY: function() { return this.node.guiData.y * opts.ratio },

  // Returns outlet's absolute X in the canvas
  getOutletX: function(outlet) {
    return this.getOutletRelX(outlet) + this.getX()
  },

  // Returns intlet's absolute X in the canvas
  getInletX: function(inlet) {
    return this.getInletRelX(inlet) + this.getX()
  },

  // Returns outlet's Y in the canvas
  getOutletY: function(outlet) {
    return this.getOutletRelY(outlet) + this.getY()
  },

  // Returns inlet's Y in the canvas
  getInletY: function(inlet) {
    return this.getInletRelY(inlet) + this.getY()
  },

  // ---- Methods to implement ---- //
  // Do the actual rendering in svg group `g`.
  render: function(g) { throw new Error('Implement me') },

  // Returns outlet X relatively to the node
  getOutletRelX: function(outlet) { throw new Error('Implement me') },

  // Returns inlet X relatively to the node
  getInletRelX: function(inlet) { throw new Error('Implement me') },

  // Returns outlet Y relatively to the node
  getOutletRelY: function(outlet) { throw new Error('Implement me') },

  // Returns inlet Y relatively to the node
  getInletRelY: function(inlet) { throw new Error('Implement me') },

})


var ObjectRenderer = function() {
  NodeRenderer.prototype.constructor.apply(this, arguments)
}

_.extend(ObjectRenderer.prototype, NodeRenderer.prototype, {

  render: function(g) {
    this.renderBox(g)
    this.renderText(g)
    this.renderOutlets(g)
    this.renderInlets(g)
  },

  renderBox: function(g) {
    g.append('rect')
      .attr('class', 'box')
      .attr('width', this.getW())
      .attr('height', this.getH())
      .attr('style', 'stroke:black;fill:white;')
  },

  renderText: function(g) {
    g.append('text')
      .attr('class', 'proto')
      .text(this.getText())
      .attr('dy', this.getTextY())
      .attr('dx', opts.portletWidth)
      .attr('style', 'font-size:10px;')
  },

  renderInlets: function(g) { this._genericRenderPortlets('inlet', g) },
  renderOutlets: function(g) { this._genericRenderPortlets('outlet', g) },
  _genericRenderPortlets: function(portletType, g) {
    var portletTypeCap = portletType.substr(0, 1).toUpperCase() + portletType.substr(1)
      , self = this
    g.selectAll('rect.' + portletType)
      .data(_.range(this.node[portletType+'s']))
      .enter()
      .append('rect')
      .classed(portletType, true)
      .classed('portlet', true)
      .attr('width', opts.portletWidth)
      .attr('height', opts.portletHeight)
      .attr('x', function(i) { return self['get' + portletTypeCap + 'RelX'](i) })
      .attr('y', function(i) { return self['get' + portletTypeCap + 'RelY'](i) })
  },

  // Returns object height
  getH: function() { return opts.objMinHeight },

  // Returns object width
  getW: function() {
    var maxPortlet = Math.max(this.node.inlets, this.node.outlets)
      , textLength = this.getText().length * 6.5
    return Math.max((maxPortlet-1) * opts.objMinWidth, opts.objMinWidth, textLength)
  },

  // Returns text to display on the object 
  getText: function() { return this.node.proto + ' ' + this.node.args.join(' ') },

  // Returns text Y relatively to the object 
  getTextY: function() { return this.getH()/2 + opts.portletHeight/2 },

  // ---- Implement virtual methods ---- //
  getOutletRelX: function(outlet) {
    return this._genericPortletRelX('outlets', outlet)
  },

  getInletRelX: function(inlet) {
    return this._genericPortletRelX('inlets', inlet)
  },

  getOutletRelY: function(outlet) {
    return this.getH() - opts.portletHeight
  },

  getInletRelY: function(inlet) { return 0 },

  _genericPortletRelX: function(inOrOutlets, portlet) {
    var width = this.getW()
      , n = this.node[inOrOutlets]
    if (portlet === 0) return 0;
    else if (portlet === n-1) return width - opts.portletWidth;
    else {
      // Space between portlets
      var a = (width - n*opts.portletWidth) / (n-1);
      return portlet * (opts.portletWidth + a);
    }
  }

})


var MsgRenderer = function() {
  ObjectRenderer.prototype.constructor.apply(this, arguments)
}

_.extend(MsgRenderer.prototype, ObjectRenderer.prototype, {

  renderBox: function(g) {

    var r = this.getH() * 0.75
      , teta = Math.asin(this.getH() / (2 * r)) 
      , arcPath = d3.svg.arc()({  
          innerRadius: r,
          outerRadius: r,
          startAngle: -Math.PI / 2 - teta,
          endAngle: -Math.PI / 2 + teta
        })
      , linePath = d3.svg.line()([
          [this.getW(), 0], [0, 0],
          [0, this.getH()], [this.getW(), this.getH()]
        ])

    g.append('svg:path')
      .attr('d', linePath)
      .attr('style', 'stroke:black;fill:white;')

    g.append('svg:path')
      .attr('d', arcPath)
      .attr('transform', 'translate(' + (this.getW() + r * Math.cos(teta)) + ',' + this.getH()/2 + ')')
      .attr('style', 'stroke:black;fill:white;')
  },

  getText: function() { return this.node.args.join(' ') }

})


var AtomBoxRenderer = function() {
  ObjectRenderer.prototype.constructor.apply(this, arguments)
}

_.extend(AtomBoxRenderer.prototype, ObjectRenderer.prototype, {

  renderBox: function(g) {

    var r = this.getH() * 0.4
      , arcPath = d3.svg.arc()({  
          innerRadius: r,
          outerRadius: r,
          startAngle: 0,
          endAngle: Math.PI / 2
        })
      , linePath = d3.svg.line()([
          [this.getW() - r, 0], [0, 0], [0, this.getH()],
          [this.getW(), this.getH()], [this.getW(), r]
        ])

    g.append('svg:path')
      .attr('d', linePath)
      .attr('style', 'stroke:black;fill:white;')

    g.append('svg:path')
      .attr('d', arcPath)
      .attr('transform', 'translate(' + (this.getW() - r) + ',' + r + ')')
      .attr('style', 'stroke:black;fill:white;')
  },

  getText: function() { return this.node.args.slice(0, 1).join(' ') }

})


var BngRenderer = function() {
  ObjectRenderer.prototype.constructor.apply(this, arguments)
}

_.extend(BngRenderer.prototype, ObjectRenderer.prototype, {

  render: function(g) {
    g.append('rect')
      .attr('class', 'box')
      .attr('width', this.getW())
      .attr('height', this.getH())
      .attr('style', 'stroke:black;fill:white;')

    g.append('circle')
      .attr('cx', this.getW()/2)
      .attr('cy', this.getH()/2)
      .attr('r', this.getW()/2)
      .attr('style', 'stroke:black;fill:white;')

    this.renderOutlets(g)
    this.renderInlets(g)
  },

  getW: function() { return 20 },
  getH: function() { return 20 }

})


var TextRenderer = function() {
  NodeRenderer.prototype.constructor.apply(this, arguments)
}

_.extend(TextRenderer.prototype, NodeRenderer.prototype, {

  render: function(g) {
    g.append('text')
      .attr('class', 'comment')
      .attr('style', 'font-size:10px;')
      .text(this.node.args[0])
  }

})
