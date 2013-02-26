/*
 * Copyright (c) 2012-2013 Chris McCormick, Sébastien Piquemal <sebpiq@gmail.com>
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
