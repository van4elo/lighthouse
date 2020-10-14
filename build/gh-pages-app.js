/**
 * @license Copyright 2020 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const cpy = require('cpy');
const ghPages = require('gh-pages');
const glob = require('glob');
const lighthousePackage = require('../package.json');
const rimraf = require('rimraf');
const terser = require('terser');

const ghPagesDistDir = `${__dirname}/../dist/gh-pages`;

const license = `/*
* @license Copyright 2020 The Lighthouse Authors. All Rights Reserved.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
* http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
* or implied. See the License for the specific language governing
* permissions and limitations under the License.
*/`;

/**
 * @typedef BuildOptions
 * @property {string} name
 * @property {string} appDir
 * @property {string[]} javascripts
 * @property {string[]} stylesheets
 * @property {string[]} assetPaths
 * @property {Record<string, string>=} htmlReplacements
 */

/**
 * Evaluates path glob and loads all identified files as an array of strings.
 * @param {string} pattern
 * @return {string[]}
 */
function loadFiles(pattern) {
  const filePaths = glob.sync(pattern);
  return filePaths.map(path => fs.readFileSync(path, {encoding: 'utf8'}));
}

/**
 * Write a file to filePath, creating parent directories if needed.
 * @param {string} filePath
 * @param {string} data
 */
async function safeWriteFile(filePath, data) {
  const fileDir = path.dirname(filePath);
  fs.mkdirSync(fileDir, {recursive: true});
  fs.writeFileSync(filePath, data);
}

class GhPagesApp {
  /**
   * @param {BuildOptions} opts
   */
  constructor(opts) {
    this.opts = opts;
    this.distDir = `${ghPagesDistDir}/${opts.name}`;
  }

  async build() {
    rimraf.sync(this.distDir);

    const contents = [
      `"use strict";`,
      ...this.opts.javascripts,
    ];
    const options = {
      output: {preamble: license}, // Insert license at top.
    };
    const minified = terser.minify(contents, options);
    if (minified.error || !minified.code) {
      throw minified.error;
    }

    const html = await this._compileHtml();
    safeWriteFile(`${this.distDir}/index.html`, html);

    const css = await this._compileCss();
    safeWriteFile(`${this.distDir}/styles/bundled.css`, css);

    const bundledJs = await this._compileJs();
    safeWriteFile(`${this.distDir}/src/bundled.js`, bundledJs);

    await cpy(this.opts.assetPaths, this.distDir, {
      cwd: this.opts.appDir,
      parents: true,
    });
  }

  deploy() {
    return new Promise((resolve, reject) => {
      ghPages.publish(this.distDir, {
        add: true, // keep existing files
        dest: this.opts.name,
        message: `Update ${this.opts.name} to lighthouse@${lighthousePackage.version}`,
      }, err => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  async _compileHtml() {
    let htmlSrc = fs.readFileSync(`${this.opts.appDir}/index.html`, {encoding: 'utf8'});

    if (this.opts.htmlReplacements) {
      for (const [key, value] of Object.entries(this.opts.htmlReplacements)) {
        htmlSrc = htmlSrc.replace(key, value);
      }
    }

    return htmlSrc;
  }

  async _compileCss() {
    return [
      ...this.opts.stylesheets,
      ...loadFiles(`${this.opts.appDir}/styles/**/*.css`),
    ].join('\n');
  }

  async _compileJs() {
    // Current Lighthouse version as a global variable.
    const versionJs = `window.LH_CURRENT_VERSION = '${lighthousePackage.version}';`;

    // App-specific JS files.
    const appJsFiles = await loadFiles(`${this.opts.appDir}/src/*.js`);

    const contents = [
      `"use strict";`,
      versionJs,
      ...this.opts.javascripts,
      ...appJsFiles,
    ];
    const options = {
      output: {preamble: license}, // Insert license at top.
    };
    const uglified = terser.minify(contents, options);
    if (uglified.error || !uglified.code) {
      throw uglified.error;
    }

    return uglified.code;
  }
}

module.exports = GhPagesApp;
