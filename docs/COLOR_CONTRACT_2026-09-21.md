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

This release aligns color rules. Earlier Welrix-only haptic/selection-summary changes are not claimed to have been fully propagated by this color release. Standard vs external rental pricing and source catalogs retain their owners.
