/**
 * @license Copyright 2020 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

/**
 * @fileoverview Capture IssueAdded events
 */

'use strict';

const Gatherer = require('./gatherer.js');

class InspectorIssues extends Gatherer {
  constructor() {
    super();
    /** @type {Array<LH.Crdp.Audits.InspectorIssue>} */
    this._issues = [];
    this._onIssueAdded = this.onIssueAdded.bind(this);
  }

  /**
   * @param {LH.Crdp.Audits.IssueAddedEvent} entry
   */
  onIssueAdded(entry) {
    this._issues.push(entry.issue);
  }

  /**
   * @param {LH.Gatherer.PassContext} passContext
   */
  async beforePass(passContext) {
    const driver = passContext.driver;
    driver.on('Audits.issueAdded', this._onIssueAdded);
    await driver.sendCommand('Audits.enable');
  }

  /**
   * @param {LH.Gatherer.PassContext} passContext
   * @return {Promise<LH.Artifacts['InspectorIssues']>}
   */
  async afterPass(passContext) {
    const driver = passContext.driver;

    driver.off('Audits.issueAdded', this._onIssueAdded);
    await driver.sendCommand('Audits.disable');
    const artifact = {
      /** @type {Array<LH.Crdp.Audits.MixedContentIssueDetails>} */
      mixedContent: [],
      /** @type {Array<LH.Crdp.Audits.SameSiteCookieIssueDetails>} */
      sameSiteCookies: [],
      /** @type {Array<LH.Crdp.Audits.BlockedByResponseIssueDetails>} */
      blockedByResponse: [],
      /** @type {Array<LH.Crdp.Audits.HeavyAdIssueDetails>} */
      heavyAds: [],
      /** @type {Array<LH.Crdp.Audits.ContentSecurityPolicyIssueDetails>} */
      contentSecurityPolicy: [],
    };

    for (const issue of this._issues) {
        if (issue.details.mixedContentIssueDetails) {
          artifact.mixedContent.push(issue.details.mixedContentIssueDetails);
        }
        if (issue.details.sameSiteCookieIssueDetails) {
          artifact.sameSiteCookies.push(issue.details.sameSiteCookieIssueDetails);
        }
        if (issue.details.blockedByResponseIssueDetails) {
          artifact.blockedByResponse.push(issue.details.blockedByResponseIssueDetails);
        }
        if (issue.details.heavyAdIssueDetails) {
          artifact.heavyAds.push(issue.details.heavyAdIssueDetails);
        }
        if (issue.details.contentSecurityPolicyIssueDetails) {
          artifact.contentSecurityPolicy.push(issue.details.contentSecurityPolicyIssueDetails);
        }
    }

    return artifact;
  }
}

module.exports = InspectorIssues;
