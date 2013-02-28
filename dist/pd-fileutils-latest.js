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

  // Regular expression to split tokens in a message.
var tokensRe = / |\r\n?|\n/
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

  
/******************** Patch parsing ************************/

var NODE_ELEMS = ['obj', 'floatatom', 'symbolatom', 'msg', 'text']

// Parses a Pd file, creates and returns a graph from it
exports.parse = function(txt) {
  return recursParse(txt)[0]
}

var recursParse = function(txt) {

  var currentTable = null       // last table name to add samples to
    , idCounter = -1, nextId = function() { idCounter++; return idCounter } 
    , patch = {nodes: [], connections: []}
    , line, firstLine = true

  // use our regular expression to match instances of valid Pd lines
  linesRe.lastIndex = 0 // reset lastIndex, in case the previous call threw an error

  while (line = txt.match(linesRe)) {
    // Remove the line from the text
    txt = txt.slice(line.index + line[0].length)

    var tokens = line[1].split(tokensRe)
      , chunkType = tokens[0]

    //================ #N : frameset ================//
    if (chunkType === '#N') {
      var elementType = tokens[1]
      if (elementType === 'canvas') {
        var guiX = tokens[2]
          , guiY = tokens[3]
          , guiWidth = tokens[4]
          , guiHeight = tokens[5]
          , name = tokens[6]

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
        }
      } else throw new Error('invalid element type for chunk #N : ' + elementType)

    //================ #X : patch elements ================// 
    } else if (chunkType === '#X') {
      var elementType = tokens[1]

      // ---- restore : ends a canvas definition ---- //
      if (elementType === 'restore') {
        var guiX = parseInt(tokens[2], 10)
          , guiY = parseInt(tokens[3], 10)
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
        return [patch, txt, {
          proto: canvasType,
          args: args,
          guiData: {x: guiX, y: guiY},
        }]

      // ---- NODE_ELEMS : object/control/text instantiation ---- //
      } else if (_.contains(NODE_ELEMS, elementType)) {
        var proto  // the object name
          , args   // the construction args for the object
          , guiX = parseInt(tokens[2], 10)
          , guiY = parseInt(tokens[3], 10)

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

        // Add the object to the graph
        patch.nodes.push({
          id: nextId(),
          proto: proto,
          guiData: {x: guiX, y: guiY},
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
    } else throw new Error('invalid chunk : ' + chunkType)
    firstLine = false
  }
  
  return [patch, '']
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
    , connections, objects
  svg.attr('xmlns', 'http://www.w3.org/2000/svg')
  svg.attr('version', '1.1')

  patch = new Patch(patch)
  patch.guessPortlets()

  // Create the connections
  connections = svg.selectAll('line.connection')
    .data(patch.connections)
    .enter()
    .append('line')
    .attr('class', 'connection')
    .attr('style', 'stroke:black;stroke-width:2px;')
    .each(function(conn) {
      d3.select(this)
        .attr('x1', function(conn) {
          var obj = patch.getObject(conn.source.id)
            , outlet = conn.source.port
          var res = getOutletX(obj, outlet, opts) + opts.portletWidth/2
          if (isNaN(res)) debugger;
          return res
        })
        .attr('y1', function(conn) {
          var obj = patch.getObject(conn.source.id)
            , outlet = conn.source.port
          return getOutletY(obj, outlet, opts) + opts.portletHeight
        })
        .attr('x2', function(conn) {
          var obj = patch.getObject(conn.sink.id)
            , inlet = conn.sink.port
          return getInletX(obj, inlet, opts) + opts.portletWidth/2 
        })
        .attr('y2', function(conn) {
          var obj = patch.getObject(conn.sink.id)
            , inlet = conn.sink.port
          return getInletY(obj, inlet, opts)
        })
    })

  // Create the base object groups
  objects = svg.selectAll('g.objectGroup')
    .data(patch.nodes)
    .enter()
    .append('g')
    .attr('transform', function(obj) {
      return 'translate(' + getObjX(obj, opts) + ',' + getObjY(obj, opts) + ')'
    })
    .attr('class', 'objectGroup')

  // Object box
  objects
    .append('rect')
    .attr('class', 'object')
    .attr('width', function(obj) { return getObjW(obj, opts) })
    .attr('height', function(obj) { return getObjH(obj, opts) })
    .attr('style', 'stroke:black;fill:white;')

  // Object text
  objects
    .append('text')
    .attr('class', 'objectType')
    .text(function(obj) { return getObjText(obj, opts) })
    .attr('dy', function(obj) { return getObjTextY(obj, opts) })
    .attr('dx', opts.portletWidth)
    .attr('style', 'font-size:10px;')

  // Inlets
  objects
    .selectAll('rect.inlet')
    .data(function(obj) {return _.times(obj.inlets, function() { return obj })})
    .enter()
    .append('rect')
    .classed('inlet', true)
    .classed('portlet', true)
    .attr('width', opts.portletWidth)
    .attr('height', opts.portletHeight)
    .attr('x', function(obj, i) { return getInletRelX(obj, i, opts) })
    .attr('y', function(obj, i) { return getInletRelY(obj, i, opts) })

  // Outlets
  objects
    .selectAll('rect.outlet')
    .data(function(obj) {return _.times(obj.outlets, function() { return obj })})
    .enter()
    .append('rect')
    .classed('outlet', true)
    .classed('portlet', true)
    .attr('width', opts.portletWidth)
    .attr('height', opts.portletHeight)
    .attr('x', function(obj, i) { return getOutletRelX(obj, i, opts) })
    .attr('y', function(obj, i) { return getOutletRelY(obj, i, opts) })

  var rendered = d3.select('body')[0][0].innerHTML
  rendered = '<?xml version="1.0" standalone="no"?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" '
    +'"http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">' + rendered
  return rendered

}


// Returns object's X in the canvas
var getObjX = function(obj, opts) { return obj.guiData.x * opts.ratio }

// Returns object's Y in the canvas
var getObjY = function(obj, opts) { return obj.guiData.y * opts.ratio }

// Returns text to display on the object 
var getObjText = function(obj, opts) { return obj.proto + ' ' + obj.args.join(' ') }

// Returns Y of the text in the object's root element 
var getObjTextY = function(obj, opts) { return getObjH(obj, opts)/2 + opts.portletHeight/2 }

// Returns object's height
var getObjH = function(obj, opts) { return opts.objMinHeight }

// Returns object's width
var getObjW = function(obj, opts) {
  var maxPortlet = Math.max(obj.inlets, obj.outlets)
    , textLength = getObjText(obj, opts).length * 5
  return Math.max((maxPortlet-1) * opts.objMinWidth, opts.objMinWidth, textLength)
}

// Returns outlet's absolute X in the canvas
getOutletX = function(obj, outlet, opts) {
  return getOutletRelX(obj, outlet, opts) + getObjX(obj, opts)
}

// Returns intlet's absolute X in the canvas
getInletX = function(obj, inlet, opts) {
  return getInletRelX(obj, inlet, opts) + getObjX(obj, opts)
}

// Returns outlet's Y in the canvas
getOutletY = function(obj, outlet, opts) {
  return getOutletRelY(obj, outlet, opts) + getObjY(obj, opts)
}

// Returns inlet's Y in the canvas
getInletY = function(obj, inlet, opts) {
  return getInletRelY(obj, inlet, opts) + getObjY(obj, opts)
}

// Get portlet X relatively to the object
var _getPortletRelX = function(inOrOutlets) {
  return function(obj, portlet, opts) {
    var width = getObjW(obj, opts)
      , n = obj[inOrOutlets]
    if (portlet === 0) return 0;
    else if (portlet === n-1) return width - opts.portletWidth;
    else {
      // Space between portlets
      var a = (width - n*opts.portletWidth) / (n-1);
      return portlet * (opts.portletWidth + a);
    }
  }
}
var getOutletRelX = _getPortletRelX('outlets')
var getInletRelX = _getPortletRelX('inlets')

var getOutletRelY = function(obj, outlet, opts) {
  return getObjH(obj, opts) - opts.portletHeight
}

// Returns inlet's Y in the object's root element
var getInletRelY = function() { return 0 }

})(modules['svg-rendering'] = {}, exports['svg-rendering'] = {}, require)

;(function(exports){
  exports.parse = require('./lib/parsing').parse
exports.renderSvg = require('./lib/svg-rendering').render

})(pdfu)


})(window)
