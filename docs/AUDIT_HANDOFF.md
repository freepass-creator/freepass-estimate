# FreePass Estimate Audit Handoff

Status: READY FOR INDEPENDENT AUDIT
Date: 2026-09-26

## Audit target

Audit exactly this active line:

- Repository: `freepass-creator/freepass-estimate`
- Branch: `integration/canonical-20260926`
- Pull request: #17
- Base: `main`

Do not treat older branches as competing canonical implementations.

## Canonical ownership

- FreePass Data: vehicle/master identity, model year, trim/powertrain, option/color identity, authoritative price facts and release evidence.
- FreePass Estimate: estimator UI/UX, interaction rules, calculation engines, provider adapters, Quote contracts/snapshots and estimator delivery behavior.
- External providers: formula/calculation integration only; never vehicle-price authority.

## Audit assertions

An independent reviewer should try to falsify these claims:

1. There is only one active cross-cutting development line.
2. Web/mobile presentation may differ, but shared business/domain/Quote/provider contracts do not fork.
3. UI tokens have one intended authority and no new competing token system is being introduced.
4. Quote Core v2 does not create a second vehicle master or a second persistence authority.
5. External providers cannot silently replace FreePass Data price authority.
6. Provider failure does not silently fall back to a different calculator.
7. No new RTDB/direct-Firestore dependency enters Quote v2.
8. Legacy Welrix-direct and prototype artifacts are migration/history only and receive no new product work.
9. Old PRs #14, #15 and #16 are superseded; #17 is the only active PR.
10. CI must pass before #17 is considered merge-ready.

## Known historical/migration artifacts

The following may still physically exist for compatibility, regression or history and should be reported only if they are still reachable as active authority:

- old branches listed in `docs/BRANCH_POLICY.md`
- `prototype/new/*`
- legacy Welrix direct engine/proxy paths
- legacy RTDB share/chat/contract paths

The audit question is not "does an old file exist?" but "can current product behavior or future development accidentally treat it as canonical again?"

## Required output from auditor

Classify findings as:
- P0: creates a second authority/data/engine path or can corrupt quote truth
- P1: can re-split UI/UX or provider behavior
- P2: stale/dead/history cleanup or documentation ambiguity

Every finding should include file/branch evidence and a concrete reproduction or reference path.


## 2026-09-30 — Short self-quote share candidate (HOLD)
- 목적: replace long inline snapshot links with /s/<8-character-id> links.
- 대상 revision: main 002888556428f8e3f40e116a975c9e0715145fcb, work/feature/short-self-quote.
- 변경: existing Sales welrix_quote_shares Firestore adapter extracted from historical welrixtable 1b4604d without RTDB imports; async sharing, snapshot restoration, route rewrite, visible failure states. New adapter justified because historical quotes.js imports retired RTDB. No operational writes or rules/deployment changes.
- 검증: snapshot/privacy/re-share/failure regression PASS; build PASS; real browser + local Firestore emulator persisted/restored 500000 monthly amount PASS; Sales rules emulator suite PASS. Operational downstream candidate also built and shared a 41-character URL in the browser at 390px; 1280px restored result PASS.
- 남음: HOLD. Existing I-01 contract prohibits browser collection paths; authority guard intentionally remains unchanged and rejects this candidate adapter. Need explicit approval of the existing Sales share-store exception or a FreePass Data transport solution. Full verify also encounters existing engine digest drift reproduced in original checkout. Claude produced architectural objections, but process exit 1 / UNAVAILABLE_RESET_UNKNOWN, so mandatory independent review is not PASS. No merge or production deployment.
- next_start_here: resolve share-store ownership exception, then rerun authority guard/review and authorize deployment to welrixtable.vercel.app. Operational candidate C:/dev/worktrees/welrixtable/short-self-quote is a selected propagation, not a whole old-branch restoration.


## 2026-09-30 — User approved short-share release
- 최신 직접 승인: 반영해줘 배포해주고. Existing Sales self-quote share-store exception and welrixtable.vercel.app production deployment approved; I-01 canonical persistence cutover remains disabled.
- 변경: operational viewer accepts canonical v2 plus historical v1 snapshots; frozen shares retain original trim/options without live axis remapping; only included periods are shared. Each owning app issues its own stable production origin (Estimate freepass-estimator.vercel.app; operational welrixtable.vercel.app), including shares made in preview. Link expiry uses server HTTP Date and authoritative rules time, not the device clock.
- 검증: Estimate full verify PASS after matching original LF checkout bytes; no engine/source content or manifest changes. Operational check:quote-contract, check and build PASS. Cross-runtime v2 restore/re-share and selected-period regression PASS. Initial Claude review found these defects; fixes require final read-only review before production.
- 남음: final independent review, main publication, production deploy and live short-link write/readback.
- next_start_here: release work/feature/short-self-quote; previous HOLD entry is historical and superseded by the direct approval.

## 2026-09-30 — Bare short-link desktop entry
- 목적: prevent /s/8id self-redirect at >1024px.
- 대상 revision: main 00d8bac7845e08ef8d13eaa227e77a69c5f06594.
- 변경: validated short paths use existing force-mobile entry guard; ordinary desktop entry remains unchanged.
- 검증: share snapshot contract PASS including executing actual inline guard at 1280px for short path and ordinary mobile.html; build PASS. Operational full browser test includes bare-link 1280px coverage.
- 남음: CI and independent review; operational deployment/live verification tracked in welrixtable WORK_RESULT.
- next_start_here: apps/new/mobile.html and check-share-snapshot-contract.mjs.
