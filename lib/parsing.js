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

// Parses a Pd file, creates and returns a graph from it
exports.parse = function(txt) {
  return pdParse(txt)[0]
}

var pdParse = function(txt) {

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
          var result = pdParse(txt)
          patch.nodes.push({
            id: nextId(),
            subpatch: result[0]
          })
          txt = result[1]
        }
      }
    } else if (chunkType === '#X') {
      // if we've found a create token
      var elementType = tokens[1]

      // is this an obj instantiation
      if (elementType === 'obj' || elementType === 'msg' || elementType === 'text') {
        var proto  // the object name
          , args   // the construction args for the object
          , guiX = parseInt(tokens[2], 10), guiY = parseInt(tokens[3], 10)

        if (elementType === 'msg') {
          proto = 'message'
          args = tokens.slice(4)
        } else if (elementType === 'text') {
          proto = 'text'
          args = [tokens.slice(4).join(' ')]
        } else {
          // TODO: quick fix for list split
          if (tokens[4] === 'list') {
            proto = tokens[4] + ' ' + tokens[5]
            args = tokens.slice(6)
          } else {
            proto = tokens[4]
            args = tokens.slice(5)
          }
        }

        // Add the object to the graph
        patch.nodes.push({
          id: nextId(),
          proto: proto,
          guiData: {x: guiX, y: guiY},
          args: parseArgs(args)
        })

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

      } else if (elementType === 'restore') {
        if (currentTable) {
          // end the current table, pad the data with zeros
          var tableSize = currentTable.args[1]
          while (currentTable.data.length < tableSize) {
            currentTable.data.push(0)
          }
          currentTable = null
        }
        return [patch, txt]
      } else if (elementType === 'connect') {
        var sourceId = parseInt(tokens[2], 10)
          , sinkId = parseInt(tokens[4], 10)
          , sourceOutlet = parseInt(tokens[3], 10)
          , sinkInlet = parseInt(tokens[5], 10)

        patch.connections.push({
          source: [sourceId, sourceOutlet],
          sink: [sinkId, sinkInlet]
        })
      } else if (elementType === 'coords') {
      } else {
        throw new Error('unknown element "' + elementType + '"')
      }

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
    } else {
      throw new Error('unknown chunk "' + chunkType + '"')
    }
    firstLine = false
  }
  
  return [patch, '']
}
