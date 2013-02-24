var grunt = require('grunt');

grunt.initConfig({

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

