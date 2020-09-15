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
const videoEmbedsTrace = require('../fixtures/traces/video-embeds-m84.json');
const videoEmbedsDevtolsLog = require('../fixtures/traces/video-embeds-m84.devtools.log.json');
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
      devtoolsLogs: {
        defaultPass: networkRecordsToDevtoolsLog([
          resourceEntry(100, 101, 102, 2000, 'https://example.com'),
          intercomProductEntry(200, 201, 202, 4000, '1'),
          intercomResourceEntry(300, 301, 302, 8000, 'a'),
        ]),
      },
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
        subItems: {
          type: 'subitems',
          items: [
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
          ],
        },
      },
    ]);
  });

  it('handles multiple products with facades', async () => {
    const artifacts = {
      devtoolsLogs: {
        defaultPass: networkRecordsToDevtoolsLog([
          resourceEntry(100, 101, 102, 2000, 'https://example.com'),
          intercomProductEntry(200, 201, 202, 4000, '1'),
          youtubeProductEntry(210, 211, 212, 3000, '2'),
          intercomResourceEntry(300, 301, 302, 8000, 'a'),
          youtubeResourceEntry(310, 311, 312, 7000, 'b'),
        ]),
      },
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
        subItems: {
          type: 'subitems',
          items: [
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
          ],
        },
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
        subItems: {
          type: 'subitems',
          items: [
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
          ],
        },
      },
    ]);
  });

  it('handle multiple requests to same product resource', async () => {
    const artifacts = {
      devtoolsLogs: {
        defaultPass: networkRecordsToDevtoolsLog([
          resourceEntry(100, 101, 102, 2000, 'https://example.com'),
          // The first product entry is used for the cutoff time
          intercomProductEntry(200, 201, 202, 2000, '1'),
          intercomResourceEntry(300, 301, 302, 8000, 'a'),
          intercomProductEntry(400, 401, 402, 2000, '1'),
        ]),
      },
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
        subItems: {
          type: 'subitems',
          items: [
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
          ],
        },
      },
    ]);
  });

  it('uses receiveHeadersEnd as cutoff', async () => {
    const artifacts = {
      devtoolsLogs: {
        defaultPass: networkRecordsToDevtoolsLog([
          resourceEntry(100, 101, 102, 2000, 'https://example.com'),
          intercomProductEntry(200, 205, 210, 4000, '1'),
          // Starts between product's startTime and startTime + receiveHeadersEnd, so it is ignored
          intercomResourceEntry(201, 206, 208, 8000, 'a'),
          // Starts between product's startTime + receiveHeadersEnd and endTime, so it is included
          intercomResourceEntry(206, 208, 215, 8000, 'b'),
          // Starts past the cutoff but previous call to same url was before cutoff, so it is ignored
          intercomResourceEntry(300, 301, 303, 8000, 'a'),
        ]),
      },
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
        subItems: {
          type: 'subitems',
          items: [
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
          ],
        },
      },
    ]);
  });

  it('does not report first party resources', async () => {
    const artifacts = {
      devtoolsLogs: {
        defaultPass: networkRecordsToDevtoolsLog([
          resourceEntry(100, 101, 102, 2000, 'https://intercomcdn.com'),
          intercomProductEntry(200, 201, 202, 4000, '1'),
        ]),
      },
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
      devtoolsLogs: {
        defaultPass: networkRecordsToDevtoolsLog([
          resourceEntry(100, 101, 102, 2000, 'https://example.com'),
        ]),
      },
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

  it('handles real trace', async () => {
    const artifacts = {
      devtoolsLogs: {defaultPass: videoEmbedsDevtolsLog},
      traces: {defaultPass: videoEmbedsTrace},
      URL: {finalUrl: 'https://example.com'},
    };

    const settings = {throttlingMethod: 'simulate', throttling: {cpuSlowdownMultiplier: 4}};
    const results = await ThirdPartyFacades.audit(artifacts, {computedCache: new Map(), settings});

    expect(results.score).toBe(0);
    expect(results.displayValue).toBeDisplayString('2 facade alternatives available');
    expect(results.details.items).toEqual(
      [
        {
          blockingTime: 0,
          facade: {
            text: 'Lite YouTube',
            type: 'link',
            url: 'https://github.com/paulirish/lite-youtube-embed',
          },
          productName: 'YouTube Embedded Player',
          subItems: {
            items: [
              {
                blockingTime: 0,
                firstEndTime: 47786.347774999995,
                firstStartTime: 47786.326268,
                mainThreadTime: 0,
                transferSize: 459603,
                url: 'https://www.youtube.com/s/player/e0d83c30/player_ias.vflset/en_US/base.js',
              },
              {
                blockingTime: 0,
                firstEndTime: 47786.692717,
                firstStartTime: 47786.569798,
                mainThreadTime: 0,
                transferSize: 66273,
                url: 'https://i.ytimg.com/vi/tgbNymZ7vqY/maxresdefault.jpg',
              },
              {
                blockingTime: 0,
                firstEndTime: 47786.436251,
                firstStartTime: 47786.325979,
                mainThreadTime: 0,
                transferSize: 50213,
                url: 'https://www.youtube.com/s/player/e0d83c30/www-embed-player.vflset/www-embed-player.js',
              },
              {
                blockingTime: 0,
                firstEndTime: 47786.441221,
                firstStartTime: 47786.324095,
                mainThreadTime: 0,
                transferSize: 46813,
                url: 'https://www.youtube.com/s/player/e0d83c30/www-player.css',
              },
              {
                blockingTime: 0,
                firstEndTime: 47786.580910000004,
                firstStartTime: 47786.561199,
                mainThreadTime: 0,
                transferSize: 11477,
                url: 'https://www.youtube.com/s/player/e0d83c30/player_ias.vflset/en_US/embed.js',
              },
              {
                blockingTime: 0,
                firstEndTime: 47786.303873000004,
                firstStartTime: 47786.066226,
                mainThreadTime: 0,
                transferSize: 10703,
                url: 'https://www.youtube.com/embed/tgbNymZ7vqY',
              },
              {
                blockingTime: 0,
                firstEndTime: 47786.414732000005,
                firstStartTime: 47786.326585,
                mainThreadTime: 0,
                transferSize: 3191,
                url: 'https://www.youtube.com/yts/jsbin/fetch-polyfill-vfl6MZH8P/fetch-polyfill.js',
              },
              {
                blockingTime: 0,
                firstEndTime: 47786.679700999994,
                firstStartTime: 47786.568895,
                mainThreadTime: 0,
                transferSize: 3077,
                url: 'https://yt3.ggpht.com/a/AATXAJxtCYVD65XPtigYUOad-Nd2v3EvnXnz__MkJrg=s68-c-k-c0x00ffffff-no-rj',
              },
            ],
            type: 'subitems',
          },
          transferSize: 651350,
        },
        {
          blockingTime: 0,
          facade: {
            text: 'Lite Vimeo',
            type: 'link',
            url: 'https://github.com/slightlyoff/lite-vimeo',
          },
          productName: 'Vimeo Embedded Player',
          subItems: {
            items: [
              {
                blockingTime: 0,
                firstEndTime: 47786.422034999996,
                firstStartTime: 47786.323843,
                mainThreadTime: 0,
                transferSize: 145772,
                url: 'https://f.vimeocdn.com/p/3.22.3/js/player.js',
              },
              {
                blockingTime: 0,
                firstEndTime: 47786.422311999995,
                firstStartTime: 47786.324528,
                mainThreadTime: 0,
                transferSize: 17633,
                url: 'https://f.vimeocdn.com/p/3.22.3/css/player.css',
              },
              {
                blockingTime: 0,
                firstEndTime: 47786.634061000004,
                firstStartTime: 47786.606134,
                mainThreadTime: 0,
                transferSize: 9313,
                url: 'https://i.vimeocdn.com/video/784397921.webp?mw=1200&mh=675&q=70',
              },
              {
                blockingTime: 0,
                firstEndTime: 47786.291588,
                firstStartTime: 47786.074447,
                mainThreadTime: 0,
                transferSize: 8300,
                url: 'https://player.vimeo.com/video/336812660',
              },
              {
                blockingTime: 0,
                firstEndTime: 47786.47053,
                firstStartTime: 47786.325692,
                mainThreadTime: 0,
                transferSize: 1474,
                url: 'https://f.vimeocdn.com/js_opt/modules/utils/vuid.min.js',
              },
              {
                blockingTime: 0,
                firstEndTime: 47786.417184000005,
                firstStartTime: 47786.32147,
                mainThreadTime: 0,
                transferSize: 1075,
                url: 'https://i.vimeocdn.com/video/784397921.jpg?mw=80&q=85',
              },
              {
                blockingTime: 0,
                firstEndTime: 47787.641538,
                firstStartTime: 47786.499527,
                mainThreadTime: 0,
                transferSize: 818,
                url: 'https://vimeo.com/ablincoln/vuid?pid=a88cdaf56540a693f597632ffeeaf6a38f56542a1600197631',
              },
              {
                blockingTime: 0,
                firstEndTime: 47786.70353599999,
                firstStartTime: 47786.608785,
                mainThreadTime: 0,
                transferSize: 110,
                url: 'https://fresnel.vimeocdn.com/add/player-stats?beacon=1&session-id=a88cdaf56540a693f597632ffeeaf6a38f56542a1600197631',
              },
              {
                blockingTime: 0,
                firstEndTime: 47786.06986,
                firstStartTime: 47786.069794,
                mainThreadTime: 0,
                transferSize: 0,
                url: 'http://player.vimeo.com/video/336812660',
              },
            ],
            type: 'subitems',
          },
          transferSize: 184495,
        },
      ]
    );
  });
});
