/**
 * @license Copyright 2020 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an AS IS' BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

const ThirdPartyFacades = require('../../audits/third-party-facades.js');
const networkRecordsToDevtoolsLog = require('../network-records-to-devtools-log.js');
const createTestTrace = require('../create-test-trace.js');

const pwaTrace = require('../fixtures/traces/progressive-app-m60.json');
const pwaDevtoolsLog = require('../fixtures/traces/progressive-app-m60.devtools.log.json');
const noThirdPartyTrace = require('../fixtures/traces/no-tracingstarted-m74.json');

function resourceEntry(startTime, headerEndTime, endTime, transferSize, url) {
  return {
    url,
    startTime,
    endTime,
    transferSize,
    timing: {
      receiveHeadersEnd: (headerEndTime - startTime) * 1000,
    },
  };
}

function intercomProductEntry(startTime, headerEndTime, endTime, transferSize, id) {
  const url = `https://widget.intercom.io/widget/${id}`;
  return resourceEntry(startTime, headerEndTime, endTime, transferSize, url);
}

function intercomResourceEntry(startTime, headerEndTime, endTime, transferSize, id) {
  const url = `https://js.intercomcdn.com/frame-modern.${id}.js`;
  return resourceEntry(startTime, headerEndTime, endTime, transferSize, url);
}

function youtubeProductEntry(startTime, headerEndTime, endTime, transferSize, id) {
  const url = `https://www.youtube.com/embed/${id}`;
  return resourceEntry(startTime, headerEndTime, endTime, transferSize, url);
}

function youtubeResourceEntry(startTime, headerEndTime, endTime, transferSize, id) {
  const url = `https://i.ytimg.com/${id}/maxresdefault.jpg`;
  return resourceEntry(startTime, headerEndTime, endTime, transferSize, url);
}

/* eslint-env jest */
describe('Third party facades audit', () => {
  it('correctly identifies a third party product with facade alternative', async () => {
    const artifacts = {
      devtoolsLogs: {defaultPass: networkRecordsToDevtoolsLog([
        resourceEntry(100, 101, 102, 2000, 'https://example.com'),
        intercomProductEntry(200, 201, 202, 4000, '1'),
        intercomResourceEntry(300, 301, 302, 8000, 'a'),
      ])},
      traces: {defaultPass: createTestTrace({timeOrigin: 0, traceEnd: 2000})},
      URL: {finalUrl: 'https://example.com'},
    };

    const settings = {throttlingMethod: 'simulate', throttling: {cpuSlowdownMultiplier: 4}};
    const results = await ThirdPartyFacades.audit(artifacts, {computedCache: new Map(), settings});

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
            url: 'https://js.intercomcdn.com/frame-modern.a.js',
            mainThreadTime: 0,
            blockingTime: 0,
            transferSize: 8000,
            firstStartTime: 300,
            firstEndTime: 301,
          },
          {
            url: 'https://widget.intercom.io/widget/1',
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

  it('handles multiple products with facades', async () => {
    const artifacts = {
      devtoolsLogs: {defaultPass: networkRecordsToDevtoolsLog([
        resourceEntry(100, 101, 102, 2000, 'https://example.com'),
        intercomProductEntry(200, 201, 202, 4000, '1'),
        youtubeProductEntry(210, 211, 212, 3000, '2'),
        intercomResourceEntry(300, 301, 302, 8000, 'a'),
        youtubeResourceEntry(310, 311, 312, 7000, 'b'),
      ])},
      traces: {defaultPass: createTestTrace({timeOrigin: 0, traceEnd: 2000})},
      URL: {finalUrl: 'https://example.com'},
    };

    const settings = {throttlingMethod: 'simulate', throttling: {cpuSlowdownMultiplier: 4}};
    const results = await ThirdPartyFacades.audit(artifacts, {computedCache: new Map(), settings});

    expect(results.score).toBe(0);
    expect(results.displayValue).toBeDisplayString('2 facade alternatives available');
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
            url: 'https://js.intercomcdn.com/frame-modern.a.js',
            mainThreadTime: 0,
            blockingTime: 0,
            transferSize: 8000,
            firstStartTime: 300,
            firstEndTime: 301,
          },
          {
            url: 'https://widget.intercom.io/widget/1',
            mainThreadTime: 0,
            blockingTime: 0,
            transferSize: 4000,
            firstStartTime: 200,
            firstEndTime: 201,
          },
        ]},
      },
      {
        productName: 'YouTube Embedded Player',
        facade: {
          type: 'link',
          text: 'Lite YouTube',
          url: 'https://github.com/paulirish/lite-youtube-embed',
        },
        transferSize: 10000,
        blockingTime: 0,
        subItems: {type: 'subitems', items: [
          {
            url: 'https://i.ytimg.com/b/maxresdefault.jpg',
            mainThreadTime: 0,
            blockingTime: 0,
            transferSize: 7000,
            firstStartTime: 310,
            firstEndTime: 311,
          },
          {
            url: 'https://www.youtube.com/embed/2',
            mainThreadTime: 0,
            blockingTime: 0,
            transferSize: 3000,
            firstStartTime: 210,
            firstEndTime: 211,
          },
        ]},
      },
    ]);
  });

  it('handle multiple requests to same product resource', async () => {
    const artifacts = {
      devtoolsLogs: {defaultPass: networkRecordsToDevtoolsLog([
        resourceEntry(100, 101, 102, 2000, 'https://example.com'),
        // The first product entry is used for the cutoff time
        intercomProductEntry(200, 201, 202, 2000, '1'),
        intercomResourceEntry(300, 301, 302, 8000, 'a'),
        intercomProductEntry(400, 401, 402, 2000, '1'),
      ])},
      traces: {defaultPass: createTestTrace({timeOrigin: 0, traceEnd: 2000})},
      URL: {finalUrl: 'https://example.com'},
    };

    const settings = {throttlingMethod: 'simulate', throttling: {cpuSlowdownMultiplier: 4}};
    const results = await ThirdPartyFacades.audit(artifacts, {computedCache: new Map(), settings});

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
            url: 'https://js.intercomcdn.com/frame-modern.a.js',
            mainThreadTime: 0,
            blockingTime: 0,
            transferSize: 8000,
            firstStartTime: 300,
            firstEndTime: 301,
          },
          {
            url: 'https://widget.intercom.io/widget/1',
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

  it('uses receiveHeadersEnd as cutoff', async () => {
    const artifacts = {
      devtoolsLogs: {defaultPass: networkRecordsToDevtoolsLog([
        resourceEntry(100, 101, 102, 2000, 'https://example.com'),
        intercomProductEntry(200, 205, 210, 4000, '1'),
        // Starts between product's startTime and startTime + receiveHeadersEnd, so it is ignored
        intercomResourceEntry(201, 206, 208, 8000, 'a'),
        // Starts between product's startTime + receiveHeadersEnd and endTime, so it is included
        intercomResourceEntry(206, 208, 215, 8000, 'b'),
        // Starts past the cutoff but previous call to same url was before cutoff, so it is ignored
        intercomResourceEntry(300, 301, 303, 8000, 'a'),
      ])},
      traces: {defaultPass: createTestTrace({timeOrigin: 0, traceEnd: 2000})},
      URL: {finalUrl: 'https://example.com'},
    };

    const settings = {throttlingMethod: 'simulate', throttling: {cpuSlowdownMultiplier: 4}};
    const results = await ThirdPartyFacades.audit(artifacts, {computedCache: new Map(), settings});

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
            url: 'https://js.intercomcdn.com/frame-modern.b.js',
            mainThreadTime: 0,
            blockingTime: 0,
            transferSize: 8000,
            firstStartTime: 206,
            firstEndTime: 208,
          },
          {
            url: 'https://widget.intercom.io/widget/1',
            mainThreadTime: 0,
            blockingTime: 0,
            transferSize: 4000,
            firstStartTime: 200,
            firstEndTime: 205,
          },
        ]},
      },
    ]);
  });

  it('does not report first party resources', async () => {
    const artifacts = {
      devtoolsLogs: {defaultPass: networkRecordsToDevtoolsLog([
        resourceEntry(100, 101, 102, 2000, 'https://intercomcdn.com'),
        intercomProductEntry(200, 201, 202, 4000, '1'),
      ])},
      traces: {defaultPass: createTestTrace({timeOrigin: 0, traceEnd: 2000})},
      URL: {finalUrl: 'https://intercomcdn.com'},
    };

    const settings = {throttlingMethod: 'simulate', throttling: {cpuSlowdownMultiplier: 4}};
    const results = await ThirdPartyFacades.audit(artifacts, {computedCache: new Map(), settings});

    expect(results).toEqual({
      score: 1,
      notApplicable: true,
    });
  });

  it('only reports resources which have facade alternatives', async () => {
    const artifacts = {
      // This devtools log has third party requests but none have facades
      devtoolsLogs: {defaultPass: pwaDevtoolsLog},
      traces: {defaultPass: pwaTrace},
      URL: {finalUrl: 'https://pwa-rocks.com'},
    };

    const settings = {throttlingMethod: 'simulate', throttling: {cpuSlowdownMultiplier: 4}};
    const results = await ThirdPartyFacades.audit(artifacts, {computedCache: new Map(), settings});

    expect(results).toEqual({
      score: 1,
      notApplicable: true,
    });
  });

  it('not applicable when no third party resources are present', async () => {
    const artifacts = {
      devtoolsLogs: {defaultPass: networkRecordsToDevtoolsLog([
        resourceEntry(100, 101, 102, 2000, 'https://example.com'),
      ])},
      traces: {defaultPass: noThirdPartyTrace},
      URL: {finalUrl: 'https://example.com'},
    };

    const settings = {throttlingMethod: 'simulate', throttling: {cpuSlowdownMultiplier: 4}};
    const results = await ThirdPartyFacades.audit(artifacts, {computedCache: new Map(), settings});

    expect(results).toEqual({
      score: 1,
      notApplicable: true,
    });
  });
});
