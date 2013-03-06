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
    var proto = node.proto
    if (proto === 'msg') return new MsgRenderer(node)
    else if (proto === 'text') return new TextRenderer(node)
    else if (proto === 'floatatom') return new FloatAtomRenderer(node)
    else if (proto === 'symbolatom') return new SymbolAtomRenderer(node)
    else if (proto === 'bng') return new BngRenderer(node)
    else if (proto === 'tgl') return new TglRenderer(node)
    else if (proto === 'nbx') return new NbxRenderer(node)
    else if (proto === 'hsl') return new HslRenderer(node)
    else if (proto === 'vsl') return new VslRenderer(node)
    else if (proto === 'hradio') return new HRadioRenderer(node)
    else if (proto === 'vradio') return new VRadioRenderer(node)
    else if (proto === 'vu') return new VuRenderer(node)
    else return new ObjectRenderer(node)
  })

  // Create the nodes
  nodes = svg.selectAll('g.node')
    .data(patch.nodes)
    .enter()
    .append('g')
    .attr('transform', function(renderer) {
      return 'translate(' + renderer.getX() + ' ' + renderer.getY() + ')'
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
  d3.select('svg').remove()
  return rendered

}

//==================== Node renderers ====================//

var NodeRenderer = function(node) {

  this.node = node
  this.id = node.id

}

_.extend(NodeRenderer.prototype, {

  // Returns node X in the canvas
  getX: function() { return this.node.layout.x * opts.ratio },

  // Returns node Y in the canvas
  getY: function() { return this.node.layout.y * opts.ratio },

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
      , textLength = this.getText().length * 6 + 10 // 6 = char width, 10 = padding
    return Math.max((maxPortlet-1) * opts.objMinWidth, opts.objMinWidth, textLength)
  },

  // Returns text to display on the object 
  getText: function() { return this.node.proto + ' ' + this.node.args.join(' ') },

  // Returns text Y relatively to the object 
  getTextY: function() { return this.getH()/2 + 11/2.5 }, // 11 is font height

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
    else if (portlet === n-1) return width - opts.portletWidth
    else {
      // Space between portlets
      var a = (width - n*opts.portletWidth) / (n-1)
      return portlet * (opts.portletWidth + a)
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
      .attr('transform', 'translate(' + (this.getW() + r * Math.cos(teta)) + ' ' + this.getH()/2 + ')')
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
      .attr('transform', 'translate(' + (this.getW() - r) + ' ' + r + ')')
      .attr('style', 'stroke:black;fill:white;')
  }

})

var FloatAtomRenderer = function() {
  AtomBoxRenderer.prototype.constructor.apply(this, arguments)
}

_.extend(FloatAtomRenderer.prototype, AtomBoxRenderer.prototype, {

  getText: function() { return '0' }

})


var SymbolAtomRenderer = function() {
  AtomBoxRenderer.prototype.constructor.apply(this, arguments)
}

_.extend(SymbolAtomRenderer.prototype, AtomBoxRenderer.prototype, {

  getText: function() { return 'symbol' }

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
      .attr('r', this.getW()/3)
      .attr('style', 'stroke:black;fill:white;')

    this.renderOutlets(g)
    this.renderInlets(g)
  },

  getW: function() { return 20 },
  getH: function() { return 20 }

})


var TglRenderer = function() {
  ObjectRenderer.prototype.constructor.apply(this, arguments)
}

_.extend(TglRenderer.prototype, ObjectRenderer.prototype, {

  render: function(g) {
    var crossPath = d3.svg.symbol()
      .size(this.getW() * this.getH() / 3.5)
      .type('cross')([1])

    g.append('rect')
      .attr('class', 'box')
      .attr('width', this.getW())
      .attr('height', this.getH())
      .attr('style', 'stroke:black;fill:white;')

    g.append('svg:path')
      .attr('d', crossPath)
      .attr('transform', 'rotate(' + 45 + ' ' + this.getW()/2 + ' ' + this.getH()/2
                        + ') translate(' + this.getW()/2 + ' ' + this.getH()/2 + ')')
      .attr('style', 'stroke:black;fill:white;')

    this.renderOutlets(g)
    this.renderInlets(g)
  },

  getW: function() { return 20 },
  getH: function() { return 20 }

})


var NbxRenderer = function() {
  AtomBoxRenderer.prototype.constructor.apply(this, arguments)
}

_.extend(NbxRenderer.prototype, AtomBoxRenderer.prototype, {

  renderBox: function(g) {
    AtomBoxRenderer.prototype.renderBox.apply(this, arguments)
    var trianglePath = d3.svg.line()([ [0, 0], [this.getW()/6, this.getH()/2], [0, this.getH()] ])
    g.append('svg:path')
      .attr('d', trianglePath)
      .attr('style', 'stroke:black;fill:white;')
  },

  getText: function() { return '0' }

})


var HslRenderer = function() {
  ObjectRenderer.prototype.constructor.apply(this, arguments)
}

_.extend(HslRenderer.prototype, ObjectRenderer.prototype, {

  renderBox: function(g) {
    ObjectRenderer.prototype.renderBox.apply(this, arguments)
    var cursorPath = d3.svg.line()([ [5, 0], [10, 0],
      [10, this.getH()], [5, this.getH()], [5, 0] ])
    g.append('svg:path')
      .attr('d', cursorPath)
      .attr('style', 'stroke:black;fill:black;')
  },

  getText: function() { return '' },
  getW: function() { return 200 },
  getH: function() { return 20 }

})


var VslRenderer = function() {
  ObjectRenderer.prototype.constructor.apply(this, arguments)
}

_.extend(VslRenderer.prototype, ObjectRenderer.prototype, {

  renderBox: function(g) {
    ObjectRenderer.prototype.renderBox.apply(this, arguments)
    var cursorPath = d3.svg.line()([ [0, 5], [0, 10],
      [this.getW(), 10], [this.getW(), 5], [0, 5] ])
    g.append('svg:path')
      .attr('d', cursorPath)
      .attr('style', 'stroke:black;fill:black;')
  },

  getText: function() { return '' },
  getW: function() { return 20 },
  getH: function() { return 200 }

})


var HRadioRenderer = function() {
  ObjectRenderer.prototype.constructor.apply(this, arguments)
}

_.extend(HRadioRenderer.prototype, ObjectRenderer.prototype, {

  renderBox: function(g) {
    var nBoxes = this.getNBoxes(), i
      , enabledSize = this.getBoxSize() / 1.5
    for (i = 0; i < nBoxes; i++) {
      g.append('rect')
        .attr('width', this.getBoxSize())
        .attr('height', this.getBoxSize())
        .attr('transform', 'translate(' + i * this.getBoxSize() + ' ' + 0 + ')')
        .attr('style', 'stroke:black;fill:white;')
    }
    g.append('rect')
      .attr('width', enabledSize)
      .attr('height', enabledSize)
      .attr('transform', 'translate(' + (this.getBoxSize() - enabledSize) / 2
                              + ' ' + (this.getBoxSize() - enabledSize) / 2 + ')')
      .attr('style', 'stroke:black;fill:black;')
  },

  getW: function() { return this.getBoxSize() * this.getNBoxes() },
  getH: function() { return this.getBoxSize() },
  getBoxSize: function() { return 20 },
  getNBoxes: function() { return this.node.args[3] },
  getText: function() { return '' }

})


var VRadioRenderer = function() {
  ObjectRenderer.prototype.constructor.apply(this, arguments)
}

_.extend(VRadioRenderer.prototype, ObjectRenderer.prototype, {

  renderBox: function(g) {
    var nBoxes = this.getNBoxes(), i
      , enabledSize = this.getBoxSize() / 1.5
    for (i = 0; i < nBoxes; i++) {
      g.append('rect')
        .attr('width', this.getBoxSize())
        .attr('height', this.getBoxSize())
        .attr('transform', 'translate(' + 0 + ' ' + i * this.getBoxSize() + ')')
        .attr('style', 'stroke:black;fill:white;')
    }
    g.append('rect')
      .attr('width', enabledSize)
      .attr('height', enabledSize)
      .attr('transform', 'translate(' + (this.getBoxSize() - enabledSize) / 2
                              + ' ' + (this.getBoxSize() - enabledSize) / 2 + ')')
      .attr('style', 'stroke:black;fill:black;')
  },

  getW: function() { return this.getBoxSize() },
  getH: function() { return this.getBoxSize() * this.getNBoxes() },
  getBoxSize: function() { return 20 },
  getNBoxes: function() { return this.node.args[3] },
  getText: function() { return '' }

})


var VuRenderer = function() {
  ObjectRenderer.prototype.constructor.apply(this, arguments)
}

_.extend(VuRenderer.prototype, ObjectRenderer.prototype, {

  renderBox: function(g) {
    g.append('rect')
      .attr('class', 'box')
      .attr('width', this.getW())
      .attr('height', this.getH())
      .attr('style', 'stroke:black;fill:grey;')
  },

  getText: function() { return '' },
  getW: function() { return 20 },
  getH: function() { return 200 }

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
