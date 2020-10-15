/**
 * @license Copyright 2020 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

'use strict';

/* eslint-env jest */

const PreloadLCPImage = require('../../audits/preload-lcp-image.js');

const lcpTrace = require('../fixtures/traces/lcp-m78.json');
const lcpDevtoolsLog = require('../fixtures/traces/lcp-m78.devtools.log.json');
const networkRecordsToDevtoolsLog = require('../network-records-to-devtools-log.js');
const createTestTrace = require('../create-test-trace.js');

const rootNodeUrl = 'http://example.com:3000';
const mainDocumentNodeUrl = 'http://www.example.com:3000';
const scriptNodeUrl = 'http://www.example.com/script.js';
const imageUrl = 'http://www.example.com/image.png';

describe('Performance: preload-lcp audit', () => {
  const mockArtifacts = (networkRecords, finalUrl, imageUrl) => {
    return {
      traces: {
        [PreloadLCPImage.DEFAULT_PASS]: createTestTrace({
          traceEnd: 6e3,
          largestContentfulPaint: 45e2,
        }),
      },
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

  const mockNetworkRecords = () => {
    return [
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
        endTime: 5,
        timing: {receiveHeadersEnd: 4000},
        url: scriptNodeUrl,
        initiator: {type: 'parser', url: mainDocumentNodeUrl},
      },
      {
        requestId: '4',
        resourceType: 'Image',
        priority: 'High',
        isLinkPreload: false,
        startTime: 2,
        endTime: 4.5,
        timing: {receiveHeadersEnd: 2500},
        url: imageUrl,
        initiator: {type: 'script', url: scriptNodeUrl},
      },
    ];
  };

  it('should suggest preloading a lcp image', async () => {
    const networkRecords = mockNetworkRecords();
    const artifacts = mockArtifacts(networkRecords, mainDocumentNodeUrl, imageUrl);
    const context = {settings: {}, computedCache: new Map()};
    const results = await PreloadLCPImage.audit(artifacts, context);
    expect(results.numericValue).toEqual(180);
    expect(results.details.overallSavingsMs).toEqual(180);
    expect(results.details.items[0].url).toEqual(imageUrl);
    expect(results.details.items[0].wastedMs).toEqual(180);
  });

  it('shouldn\'t be applicable if lcp image is not found', async () => {
    const networkRecords = mockNetworkRecords();
    const artifacts = mockArtifacts(networkRecords, mainDocumentNodeUrl, imageUrl);
    artifacts.ImageElements = [];
    const context = {settings: {}, computedCache: new Map()};
    const results = await PreloadLCPImage.audit(artifacts, context);
    expect(results.score).toEqual(1);
    expect(results.notApplicable).toBeTruthy();
    expect(results.details).toBeUndefined();
  });

  it('shouldn\'t be applicable if the lcp is not an image', async () => {
    const artifacts = {
      traces: {[PreloadLCPImage.DEFAULT_PASS]: lcpTrace},
      devtoolsLogs: {[PreloadLCPImage.DEFAULT_PASS]: lcpDevtoolsLog},
      URL: {finalUrl: 'https://www.paulirish.com/'},
      TraceElements: [
        {
          traceEventType: 'largest-contentful-paint',
          devtoolsNodePath: '1,HTML,1,BODY,3,DIV,2,P',
        },
      ],
      ImageElements: [],
    };
    const context = {settings: {}, computedCache: new Map()};
    const results = await PreloadLCPImage.audit(artifacts, context);
    expect(results.score).toEqual(1);
    expect(results.notApplicable).toBeTruthy();
    expect(results.details).toBeUndefined();
  });
});
