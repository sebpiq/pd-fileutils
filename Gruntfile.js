var grunt = require('grunt');

grunt.initConfig({

  pkg: '<json:package.json>',
  meta: {
    banner: '/*\n'
      + ' * <%= pkg.name %> - v<%= pkg.version %>\n'
      + ' * Copyright (c) <%= grunt.template.today("yyyy") %> <%= pkg.author %>\n'
      + ' *\n'
      + ' * BSD Simplified License.\n'
      + ' * For information on usage and redistribution, and for a DISCLAIMER OF ALL\n'
      + ' * WARRANTIES, see the file, "LICENSE.txt," in this distribution.\n'
      + ' *\n'
      + ' * See <%= pkg.repository.url %> for documentation\n'
      + ' *\n'
      + ' */\n'
  },

  simplemocha: {
    options: {
      globals: ['should'],
      timeout: 3000,
      ignoreLeaks: false,
      ui: 'bdd',
      reporter: 'tap'
    },

    all: { src: 'test/*.js' }
  }
});

grunt.loadNpmTasks('grunt-simple-mocha');
grunt.registerTask('test', 'simplemocha');

