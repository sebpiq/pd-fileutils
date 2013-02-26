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
