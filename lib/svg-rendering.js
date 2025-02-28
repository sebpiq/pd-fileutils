/*
 * Copyright (c) 2012-2015 Sébastien Piquemal <sebpiq@gmail.com>
 *
 * BSD Simplified License.
 * For information on usage and redistribution, and for a DISCLAIMER OF ALL
 * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
 *
 * See https://github.com/sebpiq/pd-fileutils for documentation
 *
 */

var _ = require('underscore')
  , d3 = Object.assign({}, require('d3-selection'), require('d3-shape'))
  , Patch = require('./Patch')

exports.defaults = {
  portletWidth: 5,
  portletHeight: 3.5,
  objMinWidth: 25,
  objMinHeight: 20,
  ratio: 1.2,
  padding: 10,
  glyphWidth: 8,
  glyphHeight: 9,
  textPadding: 6,
  svgFile: true,
  style: null,
}

exports.render = function(patch, opts) {
  opts = opts || {}
  _.defaults(opts, exports.defaults)

  d3.select('svg').remove()
  var svgContainer = d3.select('body').append('div')
    , svg = svgContainer.append('svg')
      .attr('xmlns', 'http://www.w3.org/2000/svg')
      .attr('version', '1.1')
    , root = svg.append('g')
    , connections, nodes

  if (opts.style) {
    svg.append('style').text(opts.style)
  }

  // Creating all renderers
  patch = new Patch(patch)
  patch.guessPortlets()
  patch.nodes = _.map(patch.nodes, function(node) {
    var proto = node.proto
    if (proto === 'msg') return new MsgRenderer(node, opts)
    else if (proto === 'text') return new TextRenderer(node, opts)
    else if (proto === 'floatatom') return new FloatAtomRenderer(node, opts)
    else if (proto === 'symbolatom') return new SymbolAtomRenderer(node, opts)
    else if (proto === 'bng') return new BngRenderer(node, opts)
    else if (proto === 'tgl') return new TglRenderer(node, opts)
    else if (proto === 'nbx') return new NbxRenderer(node, opts)
    else if (proto === 'hsl') return new HslRenderer(node, opts)
    else if (proto === 'vsl') return new VslRenderer(node, opts)
    else if (proto === 'hradio') return new HRadioRenderer(node, opts)
    else if (proto === 'vradio') return new VRadioRenderer(node, opts)
    else if (proto === 'vu') return new VuRenderer(node, opts)
    else return new ObjectRenderer(node, opts)
  })

  // Render the nodes
  nodes = root.selectAll('g.node')
    .data(patch.nodes)
    .enter()
    .append('g')
    .attr('transform', function(renderer) {
      return 'translate(' + renderer.getX() + ' ' + renderer.getY() + ')'
    })
    .attr('class', 'node')
    .attr('id', function(node) { return node.id })
    .each(function(renderer, i) { renderer.render(d3.select(this)) })

  // Render the connections
  connections = root.selectAll('line.connection')
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

  // Calculate width / height of the SVG
  var allX1 = [], allY1 = [], allX2 = [], allY2 = []
    , topLeft = {}, bottomRight = {}
  _.forEach(patch.nodes, function(n) {
    allX1.push(n.getX())
    allY1.push(n.getY())
    allX2.push(n.getX() + n.getW())
    allY2.push(n.getY() + n.getH())
  })
  topLeft.x = _.min(allX1)
  topLeft.y = _.min(allY1)
  bottomRight.x = _.max(allX2)
  bottomRight.y = _.max(allY2)
  svg.attr('width', bottomRight.x - topLeft.x + opts.padding * 2)
  svg.attr('height', bottomRight.y - topLeft.y + opts.padding * 2)
  root.attr('transform', 'translate('
    + (-topLeft.x + opts.padding) + ' '
    + (-topLeft.y + opts.padding) + ')'
  )

  // Finally rendering to a string
  var rendered = svgContainer.node().innerHTML
  if (opts.svgFile) {
    rendered = '<?xml version="1.0" standalone="no"?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" '
      + '"http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">' + rendered
  } else {
    svgContainer.remove()
  }
  return rendered

}

//==================== Node renderers ====================//

// Simple helper to memoize some method calls
var memoized = function(obj, methodName) {
  var originalMethod = obj[methodName]
    , cache = undefined

  if (originalMethod.length > 0)
    throw new Error('This memoization is valid only for methods with 0 arguments')

  obj[methodName] = function() {
    cache = originalMethod.apply(obj, arguments)
    obj[methodName] = function() { return cache }
    return cache
  }
}

var NodeRenderer = function(node, opts) {
  this.opts = opts
  this.node = node
  this.id = node.id
  memoized(this, 'getX')
  memoized(this, 'getY')
}

_.extend(NodeRenderer.prototype, {

  // Returns node X in the canvas
  getX: function() { return this.node.layout.x * this.opts.ratio },

  // Returns node Y in the canvas
  getY: function() { return this.node.layout.y * this.opts.ratio },

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

  // Returns the width of the bounding box of the node
  getW: function() { throw new Error('Implement me') },

  // Returns the height of the bounding box of the node
  getH: function() { throw new Error('Implement me') },

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
  memoized(this, 'getW')
  memoized(this, 'getH')
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
      .attr('dx', this.opts.textPadding)
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
      .attr('width', this.opts.portletWidth)
      .attr('height', this.opts.portletHeight)
      .attr('x', function(i) { return self['get' + portletTypeCap + 'RelX'](i) })
      .attr('y', function(i) { return self['get' + portletTypeCap + 'RelY'](i) })
  },

  // Returns object height
  getH: function() { return this.opts.objMinHeight },

  // Returns object width
  getW: function() {
    var maxPortlet = Math.max(this.node.inlets, this.node.outlets)
      , textLength = this.getText().length * this.opts.glyphWidth + this.opts.textPadding * 2
    return Math.max((maxPortlet-1) * this.opts.objMinWidth, this.opts.objMinWidth, textLength)
  },

  // Returns text to display on the object
  getText: function() { return this.node.proto + ' ' + this.node.args.join(' ') },

  // Returns text Y relatively to the object
  getTextY: function() { return this.getH()/2 + this.opts.glyphHeight/2 },

  // ---- Implement virtual methods ---- //
  getOutletRelX: function(outlet) {
    return this._genericPortletRelX('outlets', outlet)
  },

  getInletRelX: function(inlet) {
    return this._genericPortletRelX('inlets', inlet)
  },

  getOutletRelY: function(outlet) {
    return this.getH() - this.opts.portletHeight
  },

  getInletRelY: function(inlet) { return 0 },

  _genericPortletRelX: function(inOrOutlets, portlet) {
    var width = this.getW()
      , n = this.node[inOrOutlets]
    if (portlet === 0) return 0;
    else if (portlet === n-1) return width - this.opts.portletWidth
    else {
      // Space between portlets
      var a = (width - n*this.opts.portletWidth) / (n-1)
      return portlet * (this.opts.portletWidth + a)
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
      , arcPath = d3.arc()({
          innerRadius: r,
          outerRadius: r,
          startAngle: -Math.PI / 2 - teta,
          endAngle: -Math.PI / 2 + teta
        })
      , linePath = d3.line()([
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
      , arcPath = d3.arc()({
          innerRadius: r,
          outerRadius: r,
          startAngle: 0,
          endAngle: Math.PI / 2
        })
      , linePath = d3.line()([
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
    var crossPath = d3.symbol()
      .size(this.getW() * this.getH() / 3.5)
      .type(d3.symbolCross)([1])

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
    var trianglePath = d3.line()([ [0, 0], [this.getW()/6, this.getH()/2], [0, this.getH()] ])
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
    var cursorPath = d3.line()([ [5, 0], [10, 0],
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
    var cursorPath = d3.line()([ [0, 5], [0, 10],
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
  getNBoxes: function() { return this.node.args[2] },
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
  getNBoxes: function() { return this.node.args[2] },
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
      .text(this.node.args[0])
      .attr('dy', this.getH()/2 + this.opts.glyphHeight/2)
  },
  getW: function() {
    if(this.node.args.length === 0 && this.node.proto === "text"){
      this.node.args[0] = "";
    }
    return this.node.args[0].length * this.opts.glyphWidth + this.opts.textPadding * 2
  },
  getH: function() { return this.opts.objMinHeight }

})
