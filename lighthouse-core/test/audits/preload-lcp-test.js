/**
 * @license Copyright 2020 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

'use strict';

/* eslint-env jest */

const PreloadLCP = require('../../audits/preload-lcp');
const assert = require('assert').strict;

const pwaTrace = require('../fixtures/traces/progressive-app-m60.json');
const pwaDevtoolsLog = require('../fixtures/traces/progressive-app-m60.devtools.log.json');
const networkRecordsToDevtoolsLog = require('../network-records-to-devtools-log.js');
const createTestTrace = require('../create-test-trace.js');

const defaultMainResourceUrl = 'https://www.example.com/';
const defaultMainResource = {
  requestId: '1',
  url: defaultMainResourceUrl,
  startTime: 0,
  priority: 'VeryHigh',
  timing: {
    connectStart: 147.848,
    connectEnd: 180.71,
    sslStart: 151.87,
    sslEnd: 180.704,
    sendStart: 181.443,
    sendEnd: 181.553,
    receiveHeadersEnd: 500,
  }
};

describe('Performance: preload-lcp audit', () => {
  const mockArtifacts = (networkRecords, finalUrl) => {
    return {
      traces: {[PreloadLCP.DEFAULT_PASS]: createTestTrace({traceEnd: 5000})},
      devtoolsLogs: {[PreloadLCP.DEFAULT_PASS]: networkRecordsToDevtoolsLog(networkRecords)},
      URL: {finalUrl},
    };
  };

  it('should suggest preloading a lcp image', () => {
    
  });
});