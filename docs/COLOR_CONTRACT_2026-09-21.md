# Shared color surcharge contract

Canonical owner: FreePass Estimate; downstream: Welrix customer estimator.

- Color choices show explicit +KRW or no surcharge; missing/nonfinite prices are not labeled free.
- Existing canonical catalog is unchanged: 736 paid trim/color entries, no duplicated exact paint options. Desktop and mobile share the fee formatter.
- Legacy downstream catalogs migrate named paint options into trim-specific exterior choices. Option availability remains trim-specific; unsupported trim choices are disabled. Money is retained in both manwon and won fields.
- Matching is exact whitespace-normalized name with optional explicit exterior-color suffix. Generic matte finish packages, roof/interior/protection packages are not inferred to individual paint names. Their source package semantics remain unchanged; complete cross-catalog identity is not claimed.
- Draft legacy links retain explicit exterior selection, or map one paint by name into the trim list. Ambiguous/missing/unavailable colors require re-selection with a visible notice. Confirmed historical snapshots remain unchanged.
- Source option price 8 and legacy placeholder color price 0 are intentionally classified as a missing color fee, not a source-price conflict. Conflicting nonzero prices stop normalization.

## Verification and distribution

`npm run check:colors` validates the real canonical catalog and migration edge cases. Included in `npm run verify`.

`node scripts/sync-color-contract.mjs --apply <consumer-root>` distributes only the canonical module; `--check` verifies byte equality. No provider price tables or secrets are copied.

Local browser: FreePass desktop/mobile and Welrix mobile K8 2.5 Noblesse Light show +80,000 / +400,000 / no surcharge. Matte selection totals 37,710,000 KRW (base 37,310,000). Welrix request/adaptor regression confirms 80k/400k/free charge once.

Cursor independent review identified trim availability, restored index and won-field consistency; fixed and regression-tested. Source-price zero migration is intentional; Set hydration is an existing state contract. Claude unavailable (weekly quota); Gemini unavailable (403); not counted as passes.

Initial color release: FreePass 071561d / dpl_DpEG5aSBijejvvmEpSdd2GwFK2Hk, Welrix d2d7fac / dpl_CHEUkmm8LbjEqt88uSYH6ciMBFSE. Standard vs external rental pricing and source catalogs retain their owners.

## Selection feedback follow-up

Back-ported and validated the earlier downstream fixes in canonical FreePass: cumulative footer summary, explicit unselected colors/options, summary rows between vehicle and credit, readable option support descriptions, and completed-touch haptic/pressed feedback. Branding, canonical navigation (including spec branch), and PC layout are preserved.

Canonical haptics, selection summary resolver/component and color module are distributed byte-identically by sync-color-contract. Product layout integration stays in each consumer. This does not assert identical supplier equipment catalogs or rental prices.

Eleven haptic/summary regressions plus canonical verify pass. Browser verifies K8 color selection, sunroof, expanded price-table metadata and footer. Measured quote bottom equals footer top both collapsed and expanded. Expanded quote height is capped by remaining viewport space. Browser viewport override did not apply to this hidden tab (observed width 1265, forced mobile surface width 540); physical 390px/device vibration not claimed verified. Cursor flagged footer lifecycle/height, addressed with measured offsets and scrolling cap.

Final production: FreePass source bc2ef7e, dpl_51QH8i3Uc5z27m8mQqzXV7QxGQbs at https://freepass-estimator.vercel.app; Welrix source ec9c559, dpl_8zfKFJ5chz8BXiU5wNsxXAyoiFwC at https://welrixtable.vercel.app. Rollback targets are the initial color-release deployment IDs above. GitHub main readback equals bc2ef7e; current revision CI not observed (workflow list only has prior revisions).

Live browser confirmed both canonical domains: K8 colors +80k/+400k/no surcharge and selection summary. FreePass matte+sunroof total 38,800,000 KRW with live term prices; Welrix matte-only 37,710,000 KRW with no equipment paint choice. This proves these display/selection paths, not full rental-price parity across providers.

## Compact top selection refinement (2026-09-21)
- User supersedes footer summary: remove bottom selection details; keep compact exterior/interior/options directly below vehicle breadcrumbs, sticky while scrolling. Conditions/results retain the same top summary.
- Preserve unselected labels, all selected options, quote metadata, footer sizing and calculations.
- Canonical npm run verify PASS; both production builds PASS; common contract sync check PASS. Local browser verified K8 paid paint + sunroof, unselected interior, top placement and footer removal; Welrix scrolling keeps summary at 80px below header. Cursor read-only layout review supplied checks; Claude/Gemini unavailable as recorded above, not PASS. Physical-device rotation not verified.
- Production receipt: source cfc34a6; deployment dpl_GqVno2nmaQtPHXx2AxYhSyCPzYNY READY. Canonical alias browser verified K8 + paid snow white, top summary with unselected interior/options, footer actions only; live monthly rates present.
- Latest instruction: selection summary must scroll normally. Removed sticky position/top/z-index only; compact placement and contents unchanged. Both builds passed.
