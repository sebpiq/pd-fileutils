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
    },

    browserify: {
      'dist/pd-fileutils-latest.js': ['index.js']
    }

  })

  grunt.loadNpmTasks('grunt-contrib-uglify')
  grunt.loadNpmTasks('grunt-contrib-concat')
  grunt.loadNpmTasks('grunt-browserify')
  grunt.registerTask('build', ['browserify', 'uglify'])
  grunt.loadNpmTasks('grunt-simple-mocha')
  grunt.registerTask('test', 'simplemocha')
}

