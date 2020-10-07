/**
 * @license Copyright 2020 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

 /**
 * @fileoverview Audits a page to determine whether it generates issues in the Issues panel of Chrome Devtools.
 * The audit is meant to maintain parity with the Chrome Devtools Issues panel front end.
 * https://source.chromium.org/chromium/chromium/src/+/master:third_party/devtools-frontend/src/front_end/sdk/
 */

'use strict';

/** @typedef {{url: string}} IssueSubItem */
/** @typedef {{issueType: string|LH.IcuMessage, subItems: Array<IssueSubItem>}} IssueItem */

const Audit = require('../audit.js');
const i18n = require('../../lib/i18n/i18n.js');

const UIStrings = {
  /* eslint-disable max-len */
  /** Title of a Lighthouse audit that provides detail on various types of issues with the page. This descriptive title is shown to users when no issues were logged into the Chrome DevTools Issues panel. */
  title: 'No issues in the `Issues` panel in Chrome Devtools',
  /** Title of a Lighthouse audit that provides detail on various types of issues with the page. This descriptive title is shown to users when issues are detected and logged into the Chrome DevTools Issues panel. */
  failureTitle: 'Issues were logged in the `Issues` panel in Chrome Devtools',
  /** Description of a Lighthouse audit that tells the user why issues being logged to the Chrome DevTools Issues panel are a cause for concern and so should be fixed. This is displayed after a user expands the section to see more. No character length limits. */
  description: 'Issues logged to the `Issues` panel in Chrome Devtools indicate unresolved problems. They can come from network request failures, insufficient security controls, and other browser concerns.',
  /** Table column header for the type of issue. */
  columnIssueType: 'Issue Type',
  /** Message shown in a data table when the item is a SameSiteCookie issue. */
  sameSiteMessage: 'A cookie\'s [`SameSite`] attribute was not set or is invalid',
  /** Message shown in a data table when the item is a MixedContent issue. This is when some resources are loaded over an insecure HTTP connection. */
  mixedContentMessage: 'Some resources like images, stylesheets or scripts are being accessed over an insecure `HTTP` connection',
  /** Message shown in a data table when the item is a BlockedByResponse issue. This is when a resource is blocked due to not being allowed by a Cross-Origin Embedder Policy. */
  coepResourceBlockedMessage: 'A resource was blocked due to not being allowed by a `Cross-Origin Embedder Policy`',
  /** Message shown in a data table when the item is a BlockedByResponse issue. This is when a frame is blocked due to not being allowed by a Cross-Origin Embedder Policy. */
  coepFrameBlockedMessage: 'A frame was blocked due to not being allowed by a `Cross-Origin Embedder Policy`',
  /** Message shown in a data table when the item is a BlockedByResponse issue. This is when navigation to a document with a Cross-Origin Opener Policy is blocked. */
  coopIframeBlockedMessage: 'An iframe navigation to a document with a `Cross-Origin Opener Policy` was blocked',
  /** Message shown in a data table when the item is a HeavyAds issue where an ad uses more than 4 megabytes of network bandwith. */
  heavyAdsNetworkLimitMessage: 'The page contains ads that use more than 4 megabytes of network bandwidth',
  /** Message shown in a data table when the item is a HeavyAds issue where an ad has used the main thread for more than 60 seconds in total. */
  heavyAdsCPUTotalLimitMessage: 'The page contains ads that use the main thread for more than 60 seconds in total',
  /** Message shown in a data table when the item is a HeavyAds issue where an ad has used the main thread for more than 15 seconds in any 30 second window. */
  heavyAdsCPUPeakLimitMessage: 'The page contains ads that use the main thread for more than 15 seconds in a 30 second window',
  /** Message shown in a data table when the item is a ContentSecurityPolicy issue where resources are blocked due to not being in the Content Security Policy header. */
  cspUrlViolationMessage: 'The `Content Security Policy` of the page blocks some resources because their origin is not included in the content security policy header',
  /** Message shown in a data table when the item is a ContentSecurityPolicy issue where the Content Security Policy blocks inline execution of scripts and stylesheets. */
  cspInlineViolationMessage: 'The `Content Security Policy` of the page blocks inline execution of scripts and stylesheets',
  /** Message shown in a data table when the item is a ContentSecurityPolicy issue where the Content Security Policy blocks the use of the `eval` function in Javascript. */
  cspEvalViolationMessage: 'The `Content Security Policy` of the site blocks the use of `eval` in JavaScript',
  /* eslint-enable max-len */
};

const str_ = i18n.createMessageInstanceIdFn(__filename, UIStrings);

/** @type {Record<string, LH.IcuMessage>} */
const heavyAdsMsgMap = {
  'NetworkTotalLimit': str_(UIStrings.heavyAdsNetworkLimitMessage),
  'CpuTotalLimit': str_(UIStrings.heavyAdsCPUTotalLimitMessage),
  'CpuPeakLimit': str_(UIStrings.heavyAdsCPUPeakLimitMessage),
};
/** @type {Record<string, LH.IcuMessage>} */
const contentSecurityPolicyMsgMap = {
  'kInlineViolation': str_(UIStrings.cspInlineViolationMessage),
  'kEvalViolation': str_(UIStrings.cspEvalViolationMessage),
  'kURLViolation': str_(UIStrings.cspUrlViolationMessage),
};
/** @type {Record<string, LH.IcuMessage>} */
const blockedByResponseMsgMap = {
  'CoepFrameResourceNeedsCoepHeader': str_(UIStrings.coepResourceBlockedMessage),
  'CoopSandboxedIFrameCannotNavigateToCoopPage': str_(UIStrings.coopIframeBlockedMessage),
  'CorpNotSameOrigin': str_(UIStrings.coepResourceBlockedMessage),
  'CorpNotSameOriginAfterDefaultedToSameOriginByCoep': str_(UIStrings.coepFrameBlockedMessage),
  'CorpNotSameSite': str_(UIStrings.coepResourceBlockedMessage),
};

class IssuesPanelEntries extends Audit {
  /**
   * @return {LH.Audit.Meta}
   */
  static get meta() {
    return {
      id: 'has-inspector-issues',
      title: str_(UIStrings.title),
      failureTitle: str_(UIStrings.failureTitle),
      description: str_(UIStrings.description),
      requiredArtifacts: ['InspectorIssues'],
    };
  }

  /**
   * @param {Array<LH.Crdp.Audits.MixedContentIssueDetails} mixedContentIssues
   * @return {LH.Audit.Details.TableItem}
   */
  static getMixedContentRow(mixedContentIssues) {
    const requestUrls = new Set();
    for (const issue of mixedContentIssues) {
      const requestUrl = (issue.request && issue.request.url) || issue.mainResourceURL;
      if (requestUrl) {
        requestUrls.add(requestUrl);
      }
    }
    return {
      issueType: 'Mixed Content',
      subItems: {
        type: 'subitems',
        items: Array.from(requestUrls).map(url => {
          return {
            url,
          };
        }),
      },
    };
  }

  /**
   * @param {Array<LH.Crdp.Audits.SameSiteCookieIssueDetails>} sameSiteCookieIssues
   * @return {LH.Audit.Details.TableItem}
   */
  static getSameSiteCookieRow(sameSiteCookieIssues) {
    const requestUrls = new Set();
    for (const issue of sameSiteCookieIssues) {
      const requestUrl = (issue.request && issue.request.url) || issue.cookieUrl;
      if (requestUrl) {
        requestUrls.add(requestUrl);
      }
    }
    return {
      issueType: 'SameSite Cookie',
      subItems: {
        type: 'subitems',
        items: Array.from(requestUrls).map(url => {
          return {
            url,
          };
        }),
      },
    };
  }

  /**
   * @param {Array<LH.Crdp.Audits.BlockedByResponseIssueDetails>} blockedByResponseIssues
   * @return {LH.Audit.Details.TableItem}
   */
  static getBlockedByResponseRow(blockedByResponseIssues) {
    const requestUrls = new Set();
    for (const issue of blockedByResponseIssues) {
      const requestUrl = issue.request && issue.request.url;
      if (requestUrl) {
        requestUrls.add(requestUrl);
      }
    }
    return {
      issueType: 'Blocked By Response',
      subItems: {
        type: 'subitems',
        items: Array.from(requestUrls).map(url => {
          return {
            url,
          };
        }),
      },
    };
  }

  /**
   * @param {Array<LH.Crdp.Audits.HeavyAdIssueDetails>} heavyAdsIssues
   * @return {LH.Audit.Details.TableItem}
   */
  static getHeavyAdsRow(heavyAdsIssues) {
    return {
      issueType: 'Heavy Ads',
    };
  }

  /**
   * @param {Array<LH.Crdp.Audits.ContentSecurityPolicyIssueDetails>} cspIssues
   * @return {LH.Audit.Details.TableItem}
   */
  static getContentSecurityPolicyRow(cspIssues) {  
    const requestUrls = new Set();
    for (const issue of cspIssues) {
      const requestUrl = issue.blockedURL;
      if (requestUrl) {
        requestUrls.add(requestUrl);
      }
    }
    return {
      issueType: 'Blocked By Response',
      subItems: {
        type: 'subitems',
        items: Array.from(requestUrls).map(url => {
          return {
            url,
          };
        }),
      },
    };  
  }

  /**
   * @param {LH.Artifacts} artifacts
   * @return {LH.Audit.Product}
   */
  static audit(artifacts) {
    /** @type {LH.Audit.Details.Table['headings']} */
    const headings = [
      {key: 'issueType', itemType: 'text', subItemsHeading: {key: 'url', itemType: 'url'}, text: str_(UIStrings.columnIssueType)},
    ];

    const issues = artifacts.InspectorIssues;
    /** @type LH.Audit.Details.TableItem[] */
    const items = [];

    if (issues.mixedContent.length) items.push(this.getMixedContentRow(issues.mixedContent));
    if (issues.sameSiteCookies.length) items.push(this.getSameSiteCookieRow(issues.sameSiteCookies));
    if (issues.blockedByResponse.length) items.push(this.getBlockedByResponseRow(issues.blockedByResponse));
    if (issues.heavyAds.length) items.push(this.getHeavyAdsRow(issues.heavyAds));
    const cspIssues = issues.contentSecurityPolicy.filter(issue => {
      // kTrustedTypesSinkViolation and kTrustedTypesPolicyViolation aren't currently supported by the Issues panel
      return issue.contentSecurityPolicyViolationType !== 'kTrustedTypesSinkViolation' &&
        issue.contentSecurityPolicyViolationType !== 'kTrustedTypesPolicyViolation';
    });
    if (cspIssues.length) items.push(this.getContentSecurityPolicyRow(cspIssues));

    return {
      score: items.length > 0 ? 0 : 1,
      details: Audit.makeTableDetails(headings, items),
    };
  }
}

module.exports = IssuesPanelEntries;
module.exports.UIStrings = UIStrings;
