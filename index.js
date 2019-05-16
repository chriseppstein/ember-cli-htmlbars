'use strict';

const fs = require('fs');
const path = require('path');
const utils = require('./utils');
const Filter = require('broccoli-persistent-filter');
const crypto = require('crypto');
const stringify = require('json-stable-stringify');
const stripBom = require('strip-bom');

function rethrowBuildError(error) {
  if (!error) { throw new Error('Unknown Error'); }

  if (typeof error === 'string') {
    throw new Error('[string exception]: ' + error);
  } else {
    // augment with location and type information and re-throw.
    error.type = 'Template Compiler Error';
    error.location = error.location && error.location.start;

    throw error;
  }
}

class TemplateCompiler extends Filter {
  constructor(inputTree, _options) {
    let options = _options || {};

    if (!Object.hasOwnProperty(options, 'persist')) {
      options.persist = true;
    }

    super(inputTree, options);

    this.options = options;
    this.inputTree = inputTree;

    this.precompile = this.options.templateCompiler.precompile;
    this.registerPlugin = this.options.templateCompiler.registerPlugin;
    this.unregisterPlugin = this.options.templateCompiler.unregisterPlugin

    this.registerPlugins();
    this.initializeFeatures();
  }

  baseDir() {
    return __dirname;
  }

  registerPlugins() {
    let plugins = this.options.plugins;

    if (plugins) {
      for (let type in plugins) {
        for (let i = 0, l = plugins[type].length; i < l; i++) {
          this.registerPlugin(type, plugins[type][i]);
        }
      }
    }
  }
  unregisterPlugins() {
    let plugins = this.options.plugins;

    if (plugins) {
      for (let type in plugins) {
        for (let i = 0, l = plugins[type].length; i < l; i++) {
          this.unregisterPlugin(type, plugins[type][i]);
        }
      }
    }
  }

  initializeFeatures() {
    let EmberENV = this.options.EmberENV;
    let FEATURES = this.options.FEATURES;
    let templateCompiler = this.options.templateCompiler;

    if (FEATURES) {
      // eslint-disable-next-line no-console
      console.warn('Using `options.FEATURES` with ember-cli-htmlbars is deprecated.  Please provide the full EmberENV as options.EmberENV instead.');
      EmberENV = EmberENV || {};
      EmberENV.FEATURES = FEATURES;
    }

    utils.initializeEmberENV(templateCompiler, EmberENV);
  }

  processString(string, relativePath) {
    let srcDir = this.inputPaths[0];
    try {
      return 'export default ' + utils.template(this.options.templateCompiler, stripBom(string), {
        contents: string,
        moduleName: relativePath,
        parseOptions: {
          srcName: path.join(srcDir, relativePath)
        }
      }) + ';';
    } catch(error) {
      rethrowBuildError(error);
    }
  }

  _buildOptionsForHash() {
    let strippedOptions = {};

    for (let key in this.options) {
      if (key !== 'templateCompiler' || key !== 'templateCacheKey') {
        strippedOptions[key] = this.options[key];
      }
    }

    return strippedOptions;
  }

  _templateCompilerContents() {
    if (this.options.templateCompilerPath) {
      return fs.readFileSync(this.options.templateCompilerPath, { encoding: 'utf8' });
    } else {
      return '';
    }
  }

  optionsHash() {
    if (!this._optionsHash) {
      this._optionsHash = crypto.createHash('md5')
        .update(stringify(this._buildOptionsForHash()), 'utf8')
        .update(stringify(this._templateCompilerContents()), 'utf8')
        .digest('hex');
    }

    return this._optionsHash;
  }

  cacheKeyProcessString(string, relativePath) {
    let baseKey =
      Filter.prototype.cacheKeyProcessString.call(this, string, relativePath);
    let hash = crypto.createHash('md5');
    hash.update(this.optionsHash(), 'utf8');
    hash.update("\0");
    hash.update(baseKey, 'utf8');
    if (this.options.templateCacheKey) {
      hash.update("\0");
      hash.update(this.options.templateCacheKey(relativePath), 'utf8');
    }
    return hash.digest("hex");
  }
}

TemplateCompiler.prototype.extensions = ['hbs', 'handlebars'];
TemplateCompiler.prototype.targetExtension = 'js';

module.exports = TemplateCompiler;
