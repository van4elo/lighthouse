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
        {url: 'https://example.com'},
        {url: 'https://widget.intercom.io/widget/tx2p130c'},
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
        facade: {
          type: 'link',
          text: 'React Live Chat Loader',
          url: 'https://github.com/calibreapp/react-live-chat-loader',
        },
        subItems: {type: 'subitems', items: [
          {
            url: 'https://widget.intercom.io/widget/tx2p130c',
            productName: 'Intercom Widget',
            mainThreadTime: 0,
            blockingTime: 0,
            transferSize: 0,
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
