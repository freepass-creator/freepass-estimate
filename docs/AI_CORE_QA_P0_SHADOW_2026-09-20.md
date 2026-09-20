# FreePass Estimate ↔ AI Core QA P0 SHADOW

Status: SHADOW_PARITY / NO CANONICAL PROMOTION

AI Core candidate:
- PR #157
- revision: 584026ecaaac40073aeac5a775a5144bf704d0c8

Estimate baseline:
- work/ui-baseline
- b526fdc73e812dcb0594d10caf2123bbade1d38b

## Purpose

Prove that AI Core QA P0 can represent Estimate's existing contract-to-checker freshness model without replacing it.

The existing verification manifest remains project authority.

## Mapping

Every entry in `verification-manifest.json` projects to a QA checker entry:

- classification: REQUIRED
- proof level: SYNTHETIC
- contract ids: existing semantic quote/navigation contract identifiers
- command/checker: existing checker file
- negative control: NOT_APPLICABLE for this narrow freshness projection

This SHADOW does not claim that all Estimate QA has a negative-control harness. It only proves the contract/checker binding can be represented.

## Parity checks

The SHADOW checker verifies:

1. every manifest contract export still exists;
2. every checker file exists;
3. every checker still references the contract export it claims to verify;
4. the unified `npm run verify` includes verification freshness;
5. GitHub CI explicitly runs verification freshness;
6. release revision proof remains separate from ordinary CI.

## Production boundary

A green branch CI is not production evidence.

No production target is observed by this SHADOW, so production_proven remains false.

## No-touch boundary

No quote engine, provider, UI, snapshot, routing, release target or calculation policy changes.
