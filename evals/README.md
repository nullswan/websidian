# Evals

This directory will hold fidelity checks for the product.

Each eval should score a concrete behavior, not a vague impression.

## Initial Score Areas

- vault open and tree accuracy
- link resolution accuracy
- property parsing and editing
- markdown render fidelity
- markdown edit fidelity
- search result quality
- backlink correctness
- workspace persistence
- graph correctness
- canvas load fidelity
- plugin compatibility detection
- auth and tenant isolation

## Evaluation Rule

Every major implementation task should either:

- add a new eval
- improve an existing eval
- clearly explain why the work was prerequisite scaffolding

## Suggested First Evals

1. fixture vault loads without path or metadata errors
2. wikilinks resolve correctly across aliases and headings
3. renaming a note updates link references according to policy
4. search returns file name, alias, heading, and body matches
