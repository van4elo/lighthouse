/**
 * @license Copyright 2020 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an AS IS' BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

const LazyThirdParty = require('../../audits/lazy-third-party.js');
const networkRecordsToDevtoolsLog = require('../network-records-to-devtools-log.js');
const createTestTrace = require('../create-test-trace.js');

const pwaTrace = require('../fixtures/traces/progressive-app-m60.json');
const pwaDevtoolsLog = require('../fixtures/traces/progressive-app-m60.devtools.log.json');
const noThirdPartyTrace = require('../fixtures/traces/no-tracingstarted-m74.json');

/* eslint-env jest */
describe('Lazy load third party resources', () => {
  it('correctly identifies a lazy loadable third party resource', async () => {
    const artifacts = {
      devtoolsLogs: {defaultPass: networkRecordsToDevtoolsLog([
        {
          url: 'https://example.com',
          startTime: 100,
          endTime: 101,
          transferSize: 2000,
          timing: {
            receiveHeadersEnd: 500,
          },
        },
        {
          url: 'https://widget.intercom.io/widget/tx2p130c',
          startTime: 200,
          endTime: 201,
          transferSize: 4000,
          timing: {
            receiveHeadersEnd: 500,
          },
        },
        {
          url: 'https://js.intercomcdn.com/frame-modern.bb95039c.js',
          startTime: 300,
          endTime: 301,
          transferSize: 8000,
          timing: {
            receiveHeadersEnd: 500,
          },
        },
      ])},
      traces: {defaultPass: createTestTrace({timeOrigin: 0, traceEnd: 2000})},
      URL: {finalUrl: 'https://example.com'},
    };

    const settings = {throttlingMethod: 'simulate', throttling: {cpuSlowdownMultiplier: 4}};
    const results = await LazyThirdParty.audit(artifacts, {computedCache: new Map(), settings});

    expect(results.score).toBe(0);
    expect(results.displayValue).toBeDisplayString('1 facade alternative available');
    expect(results.details.items).toEqual([
      {
        productName: 'Intercom Widget',
        facade: {
          type: 'link',
          text: 'React Live Chat Loader',
          url: 'https://github.com/calibreapp/react-live-chat-loader',
        },
        transferSize: 12000,
        blockingTime: 0,
        subItems: {type: 'subitems', items: [
          {
            url: 'https://js.intercomcdn.com/frame-modern.bb95039c.js',
            mainThreadTime: 0,
            blockingTime: 0,
            transferSize: 8000,
            firstStartTime: 300,
            firstEndTime: 300.5,
          },
          {
            url: 'https://widget.intercom.io/widget/tx2p130c',
            mainThreadTime: 0,
            blockingTime: 0,
            transferSize: 4000,
            firstStartTime: 200,
            firstEndTime: 200.5,
          },
        ]},
      },
    ]);
  });

  it('use first of multiple requests to product resource', async () => {
    const artifacts = {
      devtoolsLogs: {defaultPass: networkRecordsToDevtoolsLog([
        {
          url: 'https://example.com',
          startTime: 100,
          endTime: 101,
          transferSize: 2000,
          timing: {
            receiveHeadersEnd: 500,
          },
        },
        {
          url: 'https://widget.intercom.io/widget/tx2p130c',
          startTime: 200,
          endTime: 201,
          transferSize: 2000,
          timing: {
            receiveHeadersEnd: 500,
          },
        },
        {
          url: 'https://js.intercomcdn.com/frame-modern.bb95039c.js',
          startTime: 300,
          endTime: 301,
          transferSize: 8000,
          timing: {
            receiveHeadersEnd: 500,
          },
        },
        {
          url: 'https://widget.intercom.io/widget/tx2p130c',
          startTime: 400,
          endTime: 401,
          transferSize: 2000,
          timing: {
            receiveHeadersEnd: 500,
          },
        },
      ])},
      traces: {defaultPass: createTestTrace({timeOrigin: 0, traceEnd: 2000})},
      URL: {finalUrl: 'https://example.com'},
    };

    const settings = {throttlingMethod: 'simulate', throttling: {cpuSlowdownMultiplier: 4}};
    const results = await LazyThirdParty.audit(artifacts, {computedCache: new Map(), settings});

    expect(results.score).toBe(0);
    expect(results.displayValue).toBeDisplayString('1 facade alternative available');
    expect(results.details.items).toEqual([
      {
        productName: 'Intercom Widget',
        facade: {
          type: 'link',
          text: 'React Live Chat Loader',
          url: 'https://github.com/calibreapp/react-live-chat-loader',
        },
        transferSize: 12000,
        blockingTime: 0,
        subItems: {type: 'subitems', items: [
          {
            url: 'https://js.intercomcdn.com/frame-modern.bb95039c.js',
            mainThreadTime: 0,
            blockingTime: 0,
            transferSize: 8000,
            firstStartTime: 300,
            firstEndTime: 300.5,
          },
          {
            url: 'https://widget.intercom.io/widget/tx2p130c',
            mainThreadTime: 0,
            blockingTime: 0,
            transferSize: 4000,
            firstStartTime: 200,
            firstEndTime: 200.5,
          },
        ]},
      },
    ]);
  });

  it('uses receiveHeadersEnd as cutoff', async () => {
    const artifacts = {
      devtoolsLogs: {defaultPass: networkRecordsToDevtoolsLog([
        {
          url: 'https://example.com',
          startTime: 100,
          endTime: 101,
          transferSize: 2000,
          timing: {
            receiveHeadersEnd: 500,
          },
        },
        {
          url: 'https://widget.intercom.io/widget/tx2p130c',
          startTime: 200,
          endTime: 202,
          transferSize: 4000,
          timing: {
            receiveHeadersEnd: 1000,
          },
        },
        {
          url: 'https://js.intercomcdn.com/frame-modern.aaaaaaaaa.js',
          startTime: 200.5, // Between startTime and startTime + receiveHeadersEnd, so it is ignored
          endTime: 205,
          transferSize: 8000,
          timing: {
            receiveHeadersEnd: 500,
          },
        },
        {
          url: 'https://js.intercomcdn.com/frame-modern.bb95039c.js',
          startTime: 201.5, // Between startTime + receiveHeadersEnd and endTime, so it is included
          endTime: 205,
          transferSize: 8000,
          timing: {
            receiveHeadersEnd: 500,
          },
        },
      ])},
      traces: {defaultPass: createTestTrace({timeOrigin: 0, traceEnd: 2000})},
      URL: {finalUrl: 'https://example.com'},
    };

    const settings = {throttlingMethod: 'simulate', throttling: {cpuSlowdownMultiplier: 4}};
    const results = await LazyThirdParty.audit(artifacts, {computedCache: new Map(), settings});

    expect(results.score).toBe(0);
    expect(results.displayValue).toBeDisplayString('1 facade alternative available');
    expect(results.details.items).toEqual([
      {
        productName: 'Intercom Widget',
        facade: {
          type: 'link',
          text: 'React Live Chat Loader',
          url: 'https://github.com/calibreapp/react-live-chat-loader',
        },
        transferSize: 12000,
        blockingTime: 0,
        subItems: {type: 'subitems', items: [
          {
            url: 'https://js.intercomcdn.com/frame-modern.bb95039c.js',
            mainThreadTime: 0,
            blockingTime: 0,
            transferSize: 8000,
            firstStartTime: 201.5,
            firstEndTime: 202,
          },
          {
            url: 'https://widget.intercom.io/widget/tx2p130c',
            mainThreadTime: 0,
            blockingTime: 0,
            transferSize: 4000,
            firstStartTime: 200,
            firstEndTime: 201,
          },
        ]},
      },
    ]);
  });

  it('does not report first party resources', async () => {
    const artifacts = {
      devtoolsLogs: {defaultPass: networkRecordsToDevtoolsLog([
        {url: 'https://youtube.com'},
        {url: 'https://www.youtube.com/embed/tgbNymZ7vqY'},
      ])},
      traces: {defaultPass: createTestTrace({timeOrigin: 0, traceEnd: 2000})},
      URL: {finalUrl: 'https://youtube.com'},
    };

    const settings = {throttlingMethod: 'simulate', throttling: {cpuSlowdownMultiplier: 4}};
    const results = await LazyThirdParty.audit(artifacts, {computedCache: new Map(), settings});

    expect(results).toEqual({
      score: 1,
      notApplicable: true,
    });
  });

  it('only reports resources which can be lazy loaded', async () => {
    const artifacts = {
      devtoolsLogs: {defaultPass: pwaDevtoolsLog},
      traces: {defaultPass: pwaTrace},
      URL: {finalUrl: 'https://pwa-rocks.com'},
    };

    const settings = {throttlingMethod: 'simulate', throttling: {cpuSlowdownMultiplier: 4}};
    const results = await LazyThirdParty.audit(artifacts, {computedCache: new Map(), settings});

    expect(results).toEqual({
      score: 1,
      notApplicable: true,
    });
  });

  it('not applicable when no third party resources are present', async () => {
    const artifacts = {
      devtoolsLogs: {defaultPass: networkRecordsToDevtoolsLog([{url: 'chrome://version'}])},
      traces: {defaultPass: noThirdPartyTrace},
      URL: {finalUrl: 'chrome://version'},
    };

    const settings = {throttlingMethod: 'simulate', throttling: {cpuSlowdownMultiplier: 4}};
    const results = await LazyThirdParty.audit(artifacts, {computedCache: new Map(), settings});

    expect(results).toEqual({
      score: 1,
      notApplicable: true,
    });
  });
});
