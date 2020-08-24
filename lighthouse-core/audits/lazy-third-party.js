/**
 * @license Copyright 2020 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

const Audit = require('./audit.js');
const i18n = require('../lib/i18n/i18n.js');
const thirdPartyWeb = require('../lib/third-party-web.js');
const NetworkRecords = require('../computed/network-records.js');
const MainResource = require('../computed/main-resource.js');
const MainThreadTasks = require('../computed/main-thread-tasks.js');
const ThirdPartySummary = require('./third-party-summary.js');

const UIStrings = {
  /** Title of a diagnostic audit that provides details about the third-party code on a web page that can be lazy loaded. This descriptive title is shown to users when no resources have lazy loading alternatives available. Lazy loading means loading resources is deferred until they are needed. */
  title: 'Lazy load third-party resources',
  /** Title of a diagnostic audit that provides details about the third-party code on a web page that can be lazy loaded. This descriptive title is shown to users when one or more third-party resources have available lazy loading alternatives. Lazy loading means loading resources is deferred until they are needed. */
  failureTitle: 'Some third-party resources can be lazy loaded',
  /** Description of a Lighthouse audit that identifies the third party code on the page that can be lazy loaded. This is displayed after a user expands the section to see more. No character length limits. 'Learn More' becomes link text to additional documentation. Lazy loading means loading resources is deferred until they are needed. */
  description: 'Some third-party resources can be fetched after the page loads. ' +
    'These third-party resources are used by embedded elements which can be replaced by a facade ' +
    'until the user needs to use them. [Learn more](https://web.dev/efficiently-load-third-party-javascript/).',
  /** Summary text for the result of a Lighthouse audit that identifies the third party code on a web page that can be lazy loaded. This text summarizes the number of lazy loading facades that can be used on the page. Lazy loading means loading resources is deferred until they are needed. */
  displayValue: `{itemCount, plural,
  =1 {# facade alternative available}
  other {# facade alternatives available}
  }`,
  /** Label for a table column that displays the name of a lazy loading facade alternative for a third party resource. Lazy loading means loading resources is deferred until they are needed. */
  columnFacade: 'Facade Alternative',
  /** Label for a table column that displays the name of the third party product that a URL is used for. Lazy loading means loading resources is deferred until they are needed. */
  columnProduct: 'Product',
};

const str_ = i18n.createMessageInstanceIdFn(__filename, UIStrings);

/** @typedef {import("third-party-web").IEntity} ThirdPartyEntity */
/** @typedef {import("third-party-web").IFacade} ThirdPartyFacade */

/** @typedef {{facade: ThirdPartyFacade, cutoffTime: number, urlSummaries: Map<string, ThirdPartySummary.Summary>}} FacadeSummary */

class LazyThirdParty extends Audit {
  /**
   * @return {LH.Audit.Meta}
   */
  static get meta() {
    return {
      id: 'lazy-third-party',
      title: str_(UIStrings.title),
      failureTitle: str_(UIStrings.failureTitle),
      description: str_(UIStrings.description),
      requiredArtifacts: ['traces', 'devtoolsLogs', 'URL'],
    };
  }

  /**
   * @param {Map<string, ThirdPartySummary.Summary>} byURL
   * @param {ThirdPartyEntity | undefined} mainEntity
   * @return {FacadeSummary[]}
   */
  static getFacadeSummaries(byURL, mainEntity) {
    /** @type {Map<string, Map<string, FacadeSummary>>} */
    const entitySummaries = new Map();

    for (const [url, urlSummary] of byURL) {
      const entity = thirdPartyWeb.getEntity(url);
      const facade = thirdPartyWeb.getFirstFacade(url);
      if (!entity || mainEntity && entity.name === mainEntity.name) continue;

      /** @type {Map<string, FacadeSummary>} */
      const facadeSummaries = entitySummaries.get(entity.name) || new Map();
      if (facade) {
        // Record new facades if the url has one
        const facadeSummary = facadeSummaries.get(facade.name) || {
          facade,
          cutoffTime: Infinity,
          urlSummaries: new Map(),
        };

        facadeSummary.urlSummaries.set(url, urlSummary);
        facadeSummary.cutoffTime = Math.min(facadeSummary.cutoffTime, urlSummary.endTime);

        facadeSummaries.set(facade.name, facadeSummary);
      } else {
        // If the url does not have a facade but its entity does, add this url to any facade summaries
        // for resources fetched before this one.
        for (const facadeSummary of facadeSummaries.values()) {
          if (urlSummary.startTime < facadeSummary.cutoffTime) continue;
          facadeSummary.urlSummaries.set(url, urlSummary);
        }
      }
      entitySummaries.set(entity.name, facadeSummaries);
    }

    const allFacadeSummaries = [];
    for (const facadeSummaries of entitySummaries.values()) {
      for (const facadeSummary of facadeSummaries.values()) {
        allFacadeSummaries.push(facadeSummary);
      }
    }
    return allFacadeSummaries;
  }

  /**
   * @param {LH.Artifacts} artifacts
   * @param {LH.Audit.Context} context
   * @return {Promise<LH.Audit.Product>}
   */
  static async audit(artifacts, context) {
    const settings = context.settings || {};
    const trace = artifacts.traces[Audit.DEFAULT_PASS];
    const devtoolsLog = artifacts.devtoolsLogs[Audit.DEFAULT_PASS];
    const networkRecords = await NetworkRecords.request(devtoolsLog, context);
    const mainResource = await MainResource.request({devtoolsLog, URL: artifacts.URL}, context);
    const mainEntity = thirdPartyWeb.getEntity(mainResource.url);
    const tasks = await MainThreadTasks.request(trace, context);
    const multiplier = settings.throttlingMethod === 'simulate' ?
      settings.throttling.cpuSlowdownMultiplier : 1;
    const {byURL} = ThirdPartySummary.getSummaries(networkRecords, tasks, multiplier);
    const facadeSummaries = LazyThirdParty.getFacadeSummaries(byURL, mainEntity);

    const summary = {wastedBytes: 0, wastedMs: 0};

    /** @type LH.Audit.Details.TableItem[] */
    const results = Array.from(facadeSummaries)
      .map((facadeSummary) => {
        /** @type LH.Audit.Details.TableItem[] */
        const items = [];
        for (const [url, urlStats] of Array.from(facadeSummary.urlSummaries)) {
          const product = thirdPartyWeb.getProduct(url) || {name: ''};
          items.push({url, productName: product.name, ...urlStats});
          summary.wastedBytes += urlStats.transferSize;
          summary.wastedMs += urlStats.blockingTime;
        }
        return {
          facade: /** @type {LH.Audit.Details.LinkValue} */ {
            type: 'link',
            text: facadeSummary.facade.name,
            url: facadeSummary.facade.repo,
          },
          subItems: {type: 'subitems', items},
        };
      });

    if (!results.length) {
      return {
        score: 1,
        notApplicable: true,
      };
    }

    /** @type {LH.Audit.Details.Table['headings']} */
    const headings = [
      {key: 'facade', itemType: 'link', text: str_(UIStrings.columnFacade),
        subItemsHeading: {key: 'url', itemType: 'url'}},
      {key: null, itemType: 'text', text: str_(UIStrings.columnProduct),
        subItemsHeading: {key: 'productName'}},
      {key: null, granularity: 1, itemType: 'bytes',
        text: str_(i18n.UIStrings.columnTransferSize), subItemsHeading: {key: 'transferSize'}},
      {key: null, granularity: 1, itemType: 'ms',
        text: str_(i18n.UIStrings.columnBlockingTime), subItemsHeading: {key: 'blockingTime'}},
    ];

    return {
      score: 0,
      displayValue: str_(UIStrings.displayValue, {
        itemCount: results.length,
      }),
      details: Audit.makeTableDetails(headings, results, summary),
    };
  }
}

module.exports = LazyThirdParty;
module.exports.UIStrings = UIStrings;
