const path = require('path');

module.exports = {
  entry: './browser.js',
  devtool: "source-map",
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'pd-fileutils-latest.js'
  },
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: ['to-string-loader', 'css-loader'],
      },
    ]
  }
}