/**
 * @license Copyright 2020 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

const InspectorIssuesAudit =
  require('../../../audits/dobetterweb/has-inspector-issues.js');

/* eslint-env jest */

describe('Has inspector issues audit', () => {
  it('passes when no issues are found', () => {
    /** @type {LH.Artifacts.InspectorIssues} */
    const issues = {
      mixedContent: [],
      sameSiteCookies: [],
      blockedByResponse: [],
      heavyAds: [],
      contentSecurityPolicy: [],
    };
    const auditResult = InspectorIssuesAudit.audit({
      InspectorIssues: issues,
    });
    expect(auditResult.score).toBe(1);
    expect(auditResult.details.items).toHaveLength(0);
  });

  it('lists the correct description with the associated issue type', () => {
    const issues = {
      mixedContent: [
        {
          resolutionStatus: 'MixedContentBlocked',
          insecureURL: 'www.mixedcontent.com',
          mainResourceURL: 'www.mixedcontent.com',
        },
      ],
      sameSiteCookies: [
        {
          cookieUrl: 'www.samesitecookies.com',
        },
      ],
      blockedByResponse: [
        {
          reason: 'CoepFrameResourceNeedsCoepHeader',
          request: {
            url: 'www.blockedbyresponse.com',
          },
        },
        {
          reason: 'CoopSandboxedIFrameCannotNavigateToCoopPage',
          request: {
            url: 'www.blockedbyresponse.com',
          },
        },
        {
          reason: 'CorpNotSameOriginAfterDefaultedToSameOriginByCoep',
          request: {
            url: 'www.blockedbyresponse.com',
          },
        },
        {
          reason: 'CorpNotSameOrigin',
          request: {
            url: 'www.blockedbyresponse.com',
          },
        },
        {
          reason: 'CorpNotSameSite',
          request: {
            url: 'www.blockedbyresponse.com',
          },
        },
      ],
      heavyAds: [
        {
          reason: 'NetworkTotalLimit',
        },
        {
          reason: 'CpuTotalLimit',
        },
        {
          reason: 'CpuPeakLimit',
        },
      ],
      contentSecurityPolicy: [
        {
          contentSecurityPolicyViolationType: 'kInlineViolation',
          blockedUrl: 'www.contentsecuritypolicy.com',
        },
        {
          contentSecurityPolicyViolationType: 'kEvalViolation',
          blockedUrl: 'www.contentsecuritypolicy.com',
        },
        {
          contentSecurityPolicyViolationType: 'kURLViolation',
          blockedUrl: 'www.contentsecuritypolicy.com',
        },
        // These last two should be filtered out as they aren't supported yet
        {
          contentSecurityPolicyViolationType: 'kTrustedTypesSinkViolation',
          blockedUrl: 'www.contentsecuritypolicy.com',
        },
        {
          contentSecurityPolicyViolationType: 'kTrustedTypesPolicyViolation',
          blockedUrl: 'www.contentsecuritypolicy.com',
        },
      ],
    };

    const auditResult = InspectorIssuesAudit.audit({
      InspectorIssues: issues,
    });
    expect(auditResult.score).toBe(0);
    expect(auditResult.details.items).toHaveLength(13);
    expect(auditResult.details.items).toMatchSnapshot();
  });
});
