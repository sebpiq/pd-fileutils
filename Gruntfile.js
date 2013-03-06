var fs = require('fs')

module.exports = function(grunt) {

  grunt.initConfig({

    pkg: grunt.file.readJSON('package.json'),

    simplemocha: {
      options: {
        globals: ['should'],
        timeout: 3000,
        ignoreLeaks: false,
        ui: 'bdd',
        reporter: 'tap'
      },

      all: { src: 'test/*.js' }
    },

    uglify: {
      options: {
        banner: '/*\n'
          + ' * <%= pkg.name %> - v<%= pkg.version %>\n'
          + ' * Copyright (c) <%= grunt.template.today("yyyy") %> <%= pkg.author.name %> <<%= pkg.author.email %>> <%= pkg.author.url %>\n'
          + ' *\n'
          + ' * BSD Simplified License.\n'
          + ' * For information on usage and redistribution, and for a DISCLAIMER OF ALL\n'
          + ' * WARRANTIES, see the file, "LICENSE.txt," in this distribution.\n'
          + ' *\n'
          + ' * See <%= pkg.repository.url %> for documentation\n'
          + ' *\n'
          + ' */\n'
      },
      build: {
        src: 'dist/<%= pkg.name %>-latest.js',
        dest: 'dist/<%= pkg.name %>-latest.min.js'
      }
    }


  })

  grunt.loadNpmTasks('grunt-contrib-uglify')
  grunt.loadNpmTasks('grunt-contrib-concat')
  grunt.registerTask('build', ['clientify', 'uglify'])
  grunt.loadNpmTasks('grunt-simple-mocha')
  grunt.registerTask('test', 'simplemocha')

  grunt.registerTask('clientify', 'Build the library to be usable in the browser', function() {
    var mustache = require('mustache')
      , template = fs.readFileSync('browser-build.mustache').toString()
      , context = {
        'Patch': fs.readFileSync('lib/Patch.js').toString(),
        'parsing': fs.readFileSync('lib/parsing.js'),
        'svgRendering': fs.readFileSync('lib/svg-rendering.js'),
        'pdRendering': fs.readFileSync('lib/pd-rendering.js'),
        'index': fs.readFileSync('index.js')
      }
      fs.writeFileSync('dist/' + grunt.config.data.pkg.name + '-latest.js', mustache.to_html(template, context))
      /*
          grunt.fatal(err);
      }
      ;
      grunt.log.writeln('"' + fileMap[filename] + '" written');*/
  })

}

