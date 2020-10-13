/**
 * @license Copyright 2020 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

'use strict';

/* eslint-env jest */

const PreloadLCPImage = require('../../audits/preload-lcp-image');

const pwaTrace = require('../fixtures/traces/progressive-app-m60.json');
const pwaDevtoolsLog = require('../fixtures/traces/progressive-app-m60.devtools.log.json');
const networkRecordsToDevtoolsLog = require('../network-records-to-devtools-log.js');
const createTestTrace = require('../create-test-trace.js');

const defaultMainResourceUrl = 'https://www.example.com/';

describe('Performance: preload-lcp audit', () => {
  const mockArtifacts = (networkRecords, finalUrl, imageUrl) => {
    return {
      traces: {[PreloadLCPImage.DEFAULT_PASS]: createTestTrace({traceEnd: 5000, largestContentfulPaint: 2000})},
      devtoolsLogs: {[PreloadLCPImage.DEFAULT_PASS]: networkRecordsToDevtoolsLog(networkRecords)},
      URL: {finalUrl},
      TraceElements: [
        {
          traceEventType: 'largest-contentful-paint',
          devtoolsNodePath: '1,HTML,1,BODY,3,DIV,2,IMG',
        },
      ],
      ImageElements: [
        {
          src: imageUrl,
          devtoolsNodePath: '1,HTML,1,BODY,3,DIV,2,IMG',
        },
      ],
    };
  };

  it('should suggest preloading a lcp image', () => {
    const rootNodeUrl = 'http://example.com:3000';
    const mainDocumentNodeUrl = 'http://www.example.com:3000';
    const scriptNodeUrl = 'http://www.example.com/script.js';
    const imageUrl = 'http://www.example.com/image.png';
    const networkRecords = [
      {
        requestId: '2',
        priority: 'High',
        isLinkPreload: false,
        startTime: 0,
        endTime: 0.5,
        timing: {receiveHeadersEnd: 500},
        url: rootNodeUrl,
      },
      {
        requestId: '2:redirect',
        resourceType: 'Document',
        priority: 'High',
        isLinkPreload: false,
        startTime: 0.5,
        endTime: 1,
        timing: {receiveHeadersEnd: 500},
        url: mainDocumentNodeUrl,
      },
      {
        requestId: '3',
        resourceType: 'Script',
        priority: 'High',
        isLinkPreload: false,
        startTime: 1,
        endTime: 3,
        timing: {receiveHeadersEnd: 2000},
        url: scriptNodeUrl,
        initiator: {type: 'parser', url: mainDocumentNodeUrl},
      },
      {
        requestId: '4',
        resourceType: 'Image',
        priority: 'High',
        isLinkPreload: false,
        startTime: 2,
        endTime: 3,
        timing: {receiveHeadersEnd: 1000},
        url: imageUrl,
        initiator: {type: 'script', url: scriptNodeUrl},
      },
    ];

    const artifacts = mockArtifacts(networkRecords, mainDocumentNodeUrl, imageUrl);
    console.log(JSON.stringify(artifacts.traces[PreloadLCPImage.DEFAULT_PASS], null, 4));
    const context = {settings: {}, computedCache: new Map()};
    const results = PreloadLCPImage.audit(artifacts, context);
    expect(results.details).toBeDefined();
  });
});