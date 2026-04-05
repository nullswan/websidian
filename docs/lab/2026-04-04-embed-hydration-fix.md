# Embed Hydration Fix

**Date**: 2026-04-04
**Status**: Complete

## Problem
Note embeds (`![[Concepts#Tags]]`) rendered as placeholders but never hydrated on workspace-restored tabs. The hydration useEffect ran and fetched data successfully, but React's `dangerouslySetInnerHTML` re-set innerHTML on subsequent re-renders, wiping out the DOM mutations made by the hydration fetch callbacks.

## Root cause
`dangerouslySetInnerHTML` tells React to own the DOM subtree's HTML. Any parent re-render causes React to re-set innerHTML to the original `html` value, destroying the hydrated embed content that was injected by the async fetch.

## Fix
- Replaced `dangerouslySetInnerHTML` with a ref-based `useEffect` that sets `containerRef.current.innerHTML = html`
- This way React doesn't manage the innerHTML, so async DOM mutations (embed hydration) persist across re-renders
- Added `key={paneTab.path}` on Reader to force remount on file switch

## Files changed
- `packages/web/src/components/Reader.tsx` — ref-based innerHTML, removed dangerouslySetInnerHTML
- `packages/web/src/App.tsx` — added key prop on Reader
