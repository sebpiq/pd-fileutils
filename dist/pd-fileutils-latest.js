(function() {


var pdfu = this.pdfu = {}
  , exports = {
    'underscore': this._
  }
  , modules = {}
  , require = function(name) {
    name = name.split('/').slice(-1)[0]
    return ((modules[name] && modules[name].exports)
      || exports[name] || window[name])
  }


;(function(module, exports, require){
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
  }

})

})(modules.Patch = {}, exports.Patch = {}, require)

;(function(module, exports, require){
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

// See http://puredata.info/docs/developer/PdFileFormat for the Pd file format reference

var _ = require('underscore')
  , NODES = ['obj', 'floatatom', 'symbolatom', 'msg', 'text']
  // Regular expression to split tokens in a message.
  , tokensRe = / |\r\n?|\n/
  // Regular expression to detect escaped dollar vars.
  , escapedDollarVarReGlob = /\\(\$\d+)/g
  // Regular expression for finding valid lines of Pd in a file
  , linesRe = /(#((.|\r|\n)*?)[^\\\\])\r{0,1}\n{0,1};\r{0,1}(\n|$)/i

// Parses argument to a string or a number.
var parseArg = exports.parseArg = function(arg) {
  var parsed = pdParseFloat(arg)
  if (_.isNumber(parsed) && !isNaN(parsed)) return parsed
  else if (_.isString(arg)) {
    var matched, arg = arg.substr(0)
    while (matched = escapedDollarVarReGlob.exec(arg)) {
      arg = arg.replace(matched[0], matched[1])
    }
    return arg
  } else throw new Error('couldn\'t parse arg ' + arg)
}

// Parses a float from a .pd file. Returns the parsed float or NaN.
var pdParseFloat = exports.parseFloat = function(data) {
  if (_.isNumber(data) && !isNaN(data)) return data
  else if (_.isString(data)) return parseFloat(data)
  else return NaN
}

// Convert a Pd message to a javascript array
var parseArgs = exports.parseArgs = function(args) {
  // if it's an int, make a single valued array
  if (_.isNumber(args) && !isNaN(args)) return [args]
  // if it's a string, split the atom
  else {
    var parts = _.isString(args) ? args.split(tokensRe) : args
      , parsed = []
      , arg, i, length

    for (i = 0, length = parts.length; i < length; i++) {
      if ((arg = parts[i]) === '') continue
      else parsed.push(parseArg(arg))
    }
    return parsed
  }
}

// Parses a Pd file, creates and returns a graph from it
exports.parse = function(txt) {
  return recursParse(txt)[0]
}

var recursParse = function(txt) {

  var currentTable = null       // last table name to add samples to
    , idCounter = -1, nextId = function() { idCounter++; return idCounter } 
    , patch = {nodes: [], connections: [], layout: undefined, args: []}
    , line, firstLine = true
    , nextLine = function() { txt = txt.slice(line.index + line[0].length) }

  // use our regular expression to match instances of valid Pd lines
  linesRe.lastIndex = 0 // reset lastIndex, in case the previous call threw an error

  while (line = txt.match(linesRe)) {
    var tokens = line[1].split(tokensRe)
      , chunkType = tokens[0]

    //================ #N : frameset ================//
    if (chunkType === '#N') {
      var elementType = tokens[1]
      if (elementType === 'canvas') {

        // This is a subpatch
        if (!firstLine) {
          var result = recursParse(txt)
            , subpatch = result[0]
            , attrs = result[2]
          patch.nodes.push(_.extend({
            id: nextId(),
            subpatch: subpatch
          }, attrs))
          // The remaining text is what was returned 
          txt = result[1]
        // Else this is the first line of the patch file
        } else {
          patch.layout = {
            x: parseInt(tokens[2], 10), y: parseInt(tokens[3], 10),
            width: parseInt(tokens[4], 10), height: parseInt(tokens[5], 10),
            openOnLoad: tokens[7]
          }
          patch.args = [tokens[6]]
          nextLine()
        }

      } else throw new Error('invalid element type for chunk #N : ' + elementType)
    //================ #X : patch elements ================// 
    } else if (chunkType === '#X') {
      var elementType = tokens[1]

      // ---- restore : ends a canvas definition ---- //
      if (elementType === 'restore') {
        var layout = {x: parseInt(tokens[2], 10), y: parseInt(tokens[3], 10)}
          , canvasType = tokens[4]
          , args = []
        // add subpatch name
        if (canvasType === 'pd') args.push(tokens[5])

        // end the current table, pad the data with zeros
        if (currentTable) {
          var tableSize = currentTable.args[1]
          while (currentTable.data.length < tableSize)
            currentTable.data.push(0)
          currentTable = null
        }
        
        // Return `subpatch`, `remaining text`, `attrs`
        nextLine()
        return [patch, txt, {
          proto: canvasType,
          args: args,
          layout: layout
        }]

      // ---- NODES : object/control instantiation ---- //
      // TODO: text is not a node
      } else if (_.contains(NODES, elementType)) {
        var proto  // the object name
          , args   // the construction args for the object
          , layout = {x: parseInt(tokens[2], 10), y: parseInt(tokens[3], 10)}
          , result

        // 2 categories here :
        //  - elems whose name is `elementType`
        //  - elems whose name is `token[4]`
        if (elementType === 'obj') {
          proto = tokens[4]
          args = tokens.slice(5)
        } else {
          proto = elementType
          args = tokens.slice(4)
        }
        if (elementType === 'text') args = [tokens.slice(4).join(' ')]

        // Handling controls' creation arguments
        result = parseControls(proto, args, layout)
        args = result[0]
        layout = result[1]

        // Add the object to the graph
        patch.nodes.push({
          id: nextId(),
          proto: proto,
          layout: layout,
          args: parseArgs(args)
        })

      // ---- array : start of an array definition ---- //
      } else if (elementType === 'array') {
        var arrayName = tokens[2]
          , arraySize = parseFloat(tokens[3])
          , table = {
            id: nextId(),
            proto: 'table',
            args: [arrayName, arraySize],
            data: []
          }
        patch.nodes.push(table)

        // remind the last table for handling correctly 
        // the table related instructions which might follow.
        currentTable = table

      // ---- connect : connection between 2 nodes ---- //
      } else if (elementType === 'connect') {
        var sourceId = parseInt(tokens[2], 10)
          , sinkId = parseInt(tokens[4], 10)
          , sourceOutlet = parseInt(tokens[3], 10)
          , sinkInlet = parseInt(tokens[5], 10)

        patch.connections.push({
          source: {id: sourceId, port: sourceOutlet},
          sink: {id: sinkId, port: sinkInlet}
        })

      // ---- coords : visual range of framsets ---- //
      } else if (elementType === 'coords') { // TODO ?
      } else throw new Error('invalid element type for chunk #X : ' + elementType)
      
      nextLine()
    //================ #A : array data ================// 
    } else if (chunkType === '#A') {
      // reads in part of an array/table of data, starting at the index specified in this line
      // name of the array/table comes from the the '#X array' and '#X restore' matches above
      var idx = parseFloat(tokens[1]), t, length, val
      if (currentTable) {
        for (t = 2, length = tokens.length; t < length; t++, idx++) {
          val = parseFloat(tokens[t])
          if (_.isNumber(val) && !isNaN(val)) currentTable.data[idx] = val
        }
      } else {
        console.error('got table data outside of a table.')
      }

      nextLine()
    } else throw new Error('invalid chunk : ' + chunkType)

    firstLine = false
  }
  
  return [patch, '']
}

// This is put here just for readability of the main `parse` function
var parseControls = function(proto, args, layout) {

  if (proto === 'floatatom') {
    // <width> <lower_limit> <upper_limit> <label_pos> <label> <receive> <send>
    layout.width = args[0] ; layout.labelPos = args[3] ; layout.label = args[4]
    // <lower_limit> <upper_limit> <receive> <send>
    args = [args[1], args[2], args[5], args[6]]
  } else if (proto === 'symbolatom') {
    // <width> <lower_limit> <upper_limit> <label_pos> <label> <receive> <send>
    layout.width = args[0] ; layout.labelPos = args[3] ; layout.label = args[4]
    // <lower_limit> <upper_limit> <receive> <send>
    args = [args[1], args[2], args[5], args[6]]
  } else if (proto === 'bng') {
    // <size> <hold> <interrupt> <init> <send> <receive> <label> <x_off> <y_off> <font> <fontsize> <bg_color> <fg_color> <label_color>
    layout.size = args[0] ; layout.hold = args[1] ; layout.interrupt = args[2]
    layout.label = args[6] ; layout.labelX = args[7] ; layout.labelY = args[8]
    layout.labelFont = args[9] ; layout.labelFontSize = args[10] ; layout.bgColor = args[11]
    layout.fgColor = args[12] ; layout.labelColor = args[13]
    // <init> <send> <receive>
    args = [args[3], args[4], args[5]]
  } else if (proto === 'tgl') {
    // <size> <init> <send> <receive> <label> <x_off> <y_off> <font> <fontsize> <bg_color> <fg_color> <label_color> <init_value> <default_value>
    layout.size = args[0] ; layout.label = args[4] ; layout.labelX = args[5]
    layout.labelY = args[6] ; layout.labelFont = args[7] ; layout.labelFontSize = args[8]
    layout.bgColor = args[9] ; layout.fgColor = args[10] ; layout.labelColor = args[11]
    // <init> <send> <receive> <init_value> <default_value>
    args = [args[1], args[2], args[3], args[12], args[13]]
  } else if (proto === 'nbx') {
    // <size> <height> <min> <max> <log> <init> <send> <receive> <label> <x_off> <y_off> <font> <fontsize> <bg_color> <fg_color> <label_color> <log_height>
    layout.size = args[0] ; layout.height = args[1] ; layout.log = args[4]
    layout.label = args[8] ; layout.labelX = args[9] ; layout.labelY = args[10]
    layout.labelFont = args[11] ; layout.labelFontSize = args[12] ; layout.bgColor = args[13]
    layout.fgColor = args[14] ; layout.labelColor = args[15] ; layout.logHeight = args[16]
    // <min> <max> <init> <send> <receive>
    args = [args[2], args[3], args[5], args[6], args[7]]
  } else if (proto === 'vsl') {
    // <width> <height> <bottom> <top> <log> <init> <send> <receive> <label> <x_off> <y_off> <font> <fontsize> <bg_color> <fg_color> <label_color> <default_value> <steady_on_click>
    layout.width = args[0] ; layout.height = args[1] ; layout.log = args[4]
    layout.label = args[8] ; layout.labelX = args[9] ; layout.labelY = args[10]
    layout.labelFont = args[11] ; layout.labelFontSize = args[12] ; layout.bgColor = args[13]
    layout.fgColor = args[14] ; layout.labelColor = args[15] ; layout.steadyOnClick = args[17]
    // <bottom> <top> <init> <send> <receive> <default_value>
    args = [args[2], args[3], args[5], args[6], args[7], args[16]]
  } else if (proto === 'hsl') {
    // <width> <height> <bottom> <top> <log> <init> <send> <receive> <label> <x_off> <y_off> <font> <fontsize> <bg_color> <fg_color> <label_color> <default_value> <steady_on_click>
    layout.width = args[0] ; layout.height = args[1] ; layout.log = args[4]
    layout.label = args[8] ; layout.labelX = args[9] ; layout.labelY = args[10]
    layout.labelFont = args[11] ; layout.labelFontSize = args[12] ; layout.bgColor = args[13]
    layout.fgColor = args[14] ; layout.labelColor = args[15] ; layout.steadyOnClick = args[17]
    // <bottom> <top> <init> <send> <receive> <default_value>
    args = [args[2], args[3], args[5], args[6], args[7], args[16]]
  } else if (proto === 'vradio') {
    // <size> <new_old> <init> <number> <send> <receive> <label> <x_off> <y_off> <font> <fontsize> <bg_color> <fg_color> <label_color> <default_value>
    layout.size = args[0] ; layout.label = args[6] ; layout.labelX = args[7]
    layout.labelY = args[8] ; layout.labelFont = args[9] ; layout.labelFontSize = args[10]
    layout.bgColor = args[11] ; layout.fgColor = args[12] ; layout.labelColor = args[13]
    // <new_old> <init> <number> <send> <receive> <default_value>
    args = [args[1], args[2], args[3], args[4], args[5], args[14]]
  } else if (proto === 'hradio') {
    // <size> <new_old> <init> <number> <send> <receive> <label> <x_off> <y_off> <font> <fontsize> <bg_color> <fg_color> <label_color> <default_value>
    layout.size = args[0] ; layout.label = args[6] ; layout.labelX = args[7]
    layout.labelY = args[8] ; layout.labelFont = args[9] ; layout.labelFontSize = args[10]
    layout.bgColor = args[11] ; layout.fgColor = args[12] ; layout.labelColor = args[13]
    // <new_old> <init> <number> <send> <receive> <default_value>
    args = [args[1], args[2], args[3], args[4], args[5], args[14]]
  } else if (proto === 'vu') {
    // <width> <height> <receive> <label> <x_off> <y_off> <font> <fontsize> <bg_color> <label_color> <scale> <?>
    layout.width = args[0] ; layout.height = args[1] ; layout.label = args[3]
    layout.labelX = args[4] ; layout.labelY = args[5] ; layout.labelFont = args[6]
    layout.labelFontSize = args[7] ; layout.bgColor = args[8] ; layout.labelColor = args[9]
    layout.log = args[10]
    // <receive> <?>
    args = [args[2], args[11]]
  } else if (proto === 'cnv') {
    // <size> <width> <height> <send> <receive> <label> <x_off> <y_off> <font> <font_size> <bg_color> <label_color> <?>
    layout.size = args[0] ; layout.width = args[1] ; layout.height = args[2]
    layout.label = args[5] ; layout.labelX = args[6] ; layout.labelY = args[7]
    layout.labelFont = args[8] ; layout.labelFontSize = args[9] ; layout.bgColor = args[10]
    layout.labelColor = args[11]
    // <send> <receive> <?>
    args = [args[3], args[4], args[12]]
  }
  // Other objects (including msg) all args belong to the graph model

  return [args, layout]

}

})(modules.parsing = {}, exports.parsing = {}, require)

;(function(module, exports, require){
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

})(modules['svg-rendering'] = {}, exports['svg-rendering'] = {}, require)

;(function(module, exports, require){
  var mustache = require('mustache')
  , _ = require('underscore')

exports.render = function(patch) {

  // Render the graph canvas
  var rendered = ''
    , layout = _.clone(patch.layout || {})
  _.defaults(layout, {x: 0, y: 0, width: 500, height: 500})
  rendered += mustache.render(canvasTpl, {args: patch.args, layout: layout}) + ';\n'

  // Render all nodes
  _.forEach(patch.nodes, function(node) {
    var layout = _.clone(node.layout || {})
    _.defaults(layout, {x: 0, y: 0})
    rendered += mustache.render(objTpl, {args: node.args, layout: layout, proto: node.proto}) + ';\n'
  })

  // Render all connections
  _.forEach(patch.connections, function(conn) {
    rendered += mustache.render(connectTpl, conn) + ';\n'
  })

  return rendered
}

var canvasTpl = '#N canvas {{{layout.x}}} {{{layout.y}}} {{{layout.width}}} {{{layout.height}}} {{{args.0}}}{{#layout.openOnLoad}} {{{.}}}{{/layout.openOnLoad}}'
  , connectTpl = '#X connect {{{source.id}}} {{{source.port}}} {{{sink.id}}} {{{sink.port}}}'

var floatAtomTpl = '#X floatatom {{{layout.x}}} {{{layout.y}}} {{{layout.width}}} {{{args.0}}} {{{args.1}}} {{{layout.labelPos}}} {{{layout.label}}} {{{args.2}}} {{{args.3}}}'
  , symbolAtomTpl = '#X symbolatom {{{layout.x}}} {{{layout.y}}} {{{layout.width}}} {{{args.0}}} {{{args.1}}} {{{layout.labelPos}}} {{{layout.label}}} {{{args.2}}} {{{args.3}}}'
  , bngTpl = '#X obj {{{layout.x}}} {{{layout.y}}} bng {{{layout.size}}} {{{layout.hold}}} {{{layout.interrupt}}} {{{args.0}}} {{{args.1}}} {{{args.2}}} {{{layout.label}}} {{{layout.labelX}}} {{{layout.labelY}}} {{{layout.labelFont}}} {{{layout.labelFontSize}}} {{{layout.bgColor}}} {{{layout.fgColor}}} {{{layout.labelColor}}}'
  , nbxTpl = '#X obj {{{layout.x}}} {{{layout.y}}} nbx {{{layout.size}}} {{{layout.height}}} {{{args.0}}} {{{args.1}}} {{{layout.log}}} {{{args.2}}} {{{args.3}}} {{{args.4}}} {{{layout.label}}} {{{layout.labelX}}} {{{layout.labelY}}} {{{layout.labelFont}}} {{{layout.labelFontSize}}} {{{layout.bgColor}}} {{{layout.fgColor}}} {{{layout.labelColor}}} {{{layout.logHeight}}}'
  , vslTpl = '#X obj {{{layout.x}}} {{{layout.y}}} vsl {{{layout.width}}} {{{layout.height}}} {{{args.0}}} {{{args.1}}} {{{layout.log}}} {{{args.2}}} {{{args.3}}} {{{args.4}}} {{{layout.label}}} {{{layout.labelX}}} {{{layout.labelY}}} {{{layout.labelFont}}} {{{layout.labelFontSize}}} {{{layout.bgColor}}} {{{layout.fgColor}}} {{{layout.labelColor}}} {{{args.5}}} {{{layout.steadyOnClick}}}'
  , hslTpl = '#X obj {{{layout.x}}} {{{layout.y}}} hsl {{{layout.width}}} {{{layout.height}}} {{{args.0}}} {{{args.1}}} {{{layout.log}}} {{{args.2}}} {{{args.3}}} {{{args.4}}} {{{layout.label}}} {{{layout.labelX}}} {{{layout.labelY}}} {{{layout.labelFont}}} {{{layout.labelFontSize}}} {{{layout.bgColor}}} {{{layout.fgColor}}} {{{layout.labelColor}}} {{{args.5}}} {{{layout.steadyOnClick}}}'
  , vradioTpl = '#X obj {{{layout.x}}} {{{layout.y}}} vradio {{{layout.size}}} {{{args.0}}} {{{args.1}}} {{{args.2}}} {{{args.3}}} {{{args.4}}} {{{layout.label}}} {{{layout.labelX}}} {{{layout.labelY}}} {{{layout.labelFont}}} {{{layout.labelFontSize}}} {{{layout.bgColor}}} {{{layout.fgColor}}} {{{layout.labelColor}}} {{{args.5}}}'
  , hradioTpl = '#X obj {{{layout.x}}} {{{layout.y}}} hradio {{{layout.size}}} {{{args.0}}} {{{args.1}}} {{{args.2}}} {{{args.3}}} {{{args.4}}} {{{layout.label}}} {{{layout.labelX}}} {{{layout.labelY}}} {{{layout.labelFont}}} {{{layout.labelFontSize}}} {{{layout.bgColor}}} {{{layout.fgColor}}} {{{layout.labelColor}}} {{{args.5}}}'
  , vuTpl = '#X obj {{{layout.x}}} {{{layout.y}}} vu {{{layout.width}}} {{{layout.height}}} {{{args.0}}} {{{layout.label}}} {{{layout.labelX}}} {{{layout.labelY}}} {{{layout.labelFont}}} {{{layout.labelFontSize}}} {{{layout.bgColor}}} {{{layout.labelColor}}} {{{layout.log}}} {{{args.1}}}'
  , cnvTpl = '#X obj {{{layout.x}}} {{{layout.y}}} cnv {{{layout.size}}} {{{layout.width}}} {{{layout.height}}} {{{args.0}}} {{{args.1}}} {{{layout.label}}} {{{layout.labelX}}} {{{layout.labelY}}} {{{layout.labelFont}}} {{{layout.labelFontSize}}} {{{layout.bgColor}}} {{{layout.labelColor}}} {{{args.2}}}'
  , objTpl = '#X obj {{{layout.x}}} {{{layout.y}}} {{{proto}}}{{#args}} {{.}}{{/args}}'

})(modules['pd-rendering'] = {}, exports['pd-rendering'] = {}, require)

;(function(exports){
  exports.parse = require('./lib/parsing').parse
exports.renderSvg = require('./lib/svg-rendering').render

})(pdfu)


})(window)
