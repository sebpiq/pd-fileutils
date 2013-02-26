Pure Data file utilities
==========================

[![Build Status](https://travis-ci.org/sebpiq/pd-fileutils.png)](https://travis-ci.org/sebpiq/pd-fileutils)

This library is a set of tools for handling pure data files.

At the moment it can only parse `.pd` files and render `svg` images from them. Pd files are parsed to a normal JavaScript object, which also means that you can manipulate them very simply (but cannot re-render to `.pd` at the moment).


Installation
=============

This is a node package, so to use it, you will need [node.js](http://nodejs.org/).

Installation is easier with the node package manager [npm](https://npmjs.org/) :

```
npm install pd-fileutils
```

Command-line tool
==================

At the moment, the only thing you can do is render `.pd` files to `.svg`, for example : 

```
pd-fileutils myPatch.pd > myPatch.svg
```


History
========

0.2
----

- SVG rendering + command-line tool
- parsing supports most of the format 

0.1
----

- basic parsing
