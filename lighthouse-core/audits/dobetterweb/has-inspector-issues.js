/**
 * @license Copyright 2020 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

const Audit = require('../audit.js');
const i18n = require('../../lib/i18n/i18n.js');

const UIStrings = {
  /** Title of a Lighthouse audit that provides detail on inspector issues. This descriptive title is shown to users when no issues were logged into the devtools Issues panel. */
  title: 'No issues in the Issues panel',
  /** Title of a Lighthouse audit that provides detail on inspector issues. This descriptive title is shown to users when issues are detected and logged into the devtools Issues panel. */
  failureTitle: 'Isssues were logged in the Issues panel',
  /** Description of a Lighthouse audit that tells the user why issues being logged to the devtools Issues panel are a cause for concern and so should be fixed. This is displayed after a user expands the section to see more. No character length limits. */
  description: 'Description TBD',
  /** Table column header for the type of issue. */
  columnIssueType: 'Issue Type',
  /** Message shown in a data table when the item is a SameSiteCookie issue. */
  sameSiteMsg: 'This is a SameSite Cookies issue',
  /** Message shown in a data table when the item is a MixedContent issue. */
  mixedContentMsg: 'This is a Mixed Content issue',
  /** Message shown in a data table when the item is a BlockedByResponse issue. */
  blockedByResponseMsg: 'This is a Blocked By Response issue',
  /** Message shown in a data table when the item is a HeavyAds issue. */
  heavyAdsMsg: 'This is a Heavy Ads issue',
  /** Message shown in a data table when the item is a ContentSecurityPolicy issue. */
  contentSecurityPolicyMsg: 'This is a Content Security Policy issue',
};

const str_ = i18n.createMessageInstanceIdFn(__filename, UIStrings);
/** @type {Object<string, string>} */
const issueMap = {
  'sameSiteCookies': str_(UIStrings.sameSiteMsg),
  'mixedContent': str_(UIStrings.mixedContentMsg),
  'blockedByResponse': str_(UIStrings.blockedByResponseMsg),
  'heavyAds': str_(UIStrings.heavyAdsMsg),
  'contentSecurityPolicy': str_(UIStrings.contentSecurityPolicyMsg),
};

/** @typedef {{issueType: string, description: string, requestUrl?: string}} IssueItem */ 

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
   * @param {Array<LH.Crdp.Audits.MixedContentIssueDetails>} mixedContentIssues
   * @return {Array<any>}
   */
  static getMixedContentItems(mixedContentIssues) {
    if (!mixedContentIssues) {
      return [];
    }

    return mixedContentIssues.map(issue => {

    });
  }

  /**
   * @param {Array<LH.Crdp.Audits.SameSiteCookieIssueDetails>} sameSiteCookieIssues
   * @return {Array<any>}
   */
  static getSameSiteCookieItems(sameSiteCookieIssues) {
    if (!sameSiteCookieIssues) {
      return [];
    }

    return sameSiteCookieIssues.map(issue => {
      const requestUrl = issue.request && issue.request.url;
      return {
        issueType: 'SameSite Cookie',
        description: str_(UIStrings.sameSiteMsg),
        requestUrl: requestUrl || issue.cookieUrl,
      };
    });
  }

  /**
   * @param {Array<LH.Crdp.Audits.BlockedByResponseIssueDetails>} blockedByResponseIssues
   * @return {Array<any>}
   */
  static getBlockedByResponseItems(blockedByResponseIssues) {
    if (!blockedByResponseIssues) {
      return [];
    }

    return blockedByResponseIssues.map(issue => {
      const blockedReason = issue.reason;
      return {
        issueType: 'Blocked By Response'
      }
    });
  }

  /**
   * @param {Array<LH.Crdp.Audits.HeavyAdIssueDetails>} heavyAdsIssues
   * @return {Array<any>}
   */
  static getHeavyAdsItems(heavyAdsIssues) {
    if (!heavyAdsIssues) {
      return [];
    }

    return heavyAdsIssues.map(issue => {
      
    });
  }

  /**
   * @param {Array<LH.Crdp.Audits.ContentSecurityPolicyIssueDetails>} cspIssues
   * @return {Array<any>}
   */
  static getContentSecurityPolicyItems(cspIssues) {
    if (!cspIssues) {
      return [];
    }

    return cspIssues.map(issue => {
      
    });
  }

  /**
   * @param {LH.Artifacts} artifacts
   * @return {LH.Audit.Product}
   */
  static audit(artifacts) {
    /** @type {LH.Audit.Details.Table['headings']} */
    const headings = [
      {key: 'issueType', itemType: 'text', text: str_(UIStrings.columnIssueType)},
      {key: 'description', itemType: 'text', text: str_(i18n.UIStrings.columnDescription)},
      {key: 'requestUrl', itemType: 'url', text: 'Request URL'},
    ];

    const issues = artifacts.InspectorIssues;
    /** @type {Array<IssueItem>} */
    const items = [];

    for (const [issueType, issuesOfType] of Object.entries(issues)) {
      switch(issueType) {
        case 'sameSiteCookies':
          items.push(...this.getSameSiteCookieItems(issuesOfType));
          break;
        case 'mixedContent':
          items.push(...this.getMixedContentItems(issuesOfType));
          break;
        case 'blockedByResponse':
          items.push(...this.getBlockedByResponseItems(issuesOfType));
          break;
        case 'heavyAds':
          items.push(...this.getHeavyAdsItems(issuesOfType));
          break;
        case 'contentSecurityPolicy':
          items.push(...this.getContentSecurityPolicyItems(issuesOfType));
          break;
      }
    }

    return {
      score: items.length > 0 ? 0 : 1,
      details: Audit.makeTableDetails(headings, items),
    };
  }
}

module.exports = IssuesPanelEntries;
module.exports.UIStrings = UIStrings;
