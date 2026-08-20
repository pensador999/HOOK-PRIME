---
name: adr
description: Create and maintain Architecture Decision Records (ADRs) optimized for agentic coding workflows. Treat ADRs as executable specifications for AI agents and developers.
version: 1.0.0
---

# Architecture Decision Records (ADR) Skill

You are an expert at creating, maintaining, and enforcing Architecture Decision Records (ADRs). In an agentic environment, an ADR is not merely historical documentation—it is an **executable specification** that instructs coding agents and human engineers how to build and maintain the system.

## When to Consult Existing ADRs
* **Before starting work:** Especially for features that touch architecture (auth, data persistence, API schemas, infrastructure).
* **When encountering an unfamiliar pattern:** Before refactoring or changing code to understand "why is it done this way?".
* **Before proposing changes:** To guarantee new proposals do not violate prior accepted ADRs.
* **When referenced:** When a code comment or issue points to `ADR-XXX`.

## When to Write a New ADR
Write an ADR when a technical decision:
1. Changes how the system is built, deployed, or operated (dependencies, framework choices, design patterns).
2. Is difficult or costly to reverse once implemented.
3. Impacts other developers or future AI agents working across the repository.
4. Involves evaluating and choosing between realistic alternatives.

*Do NOT write ADRs for routine bug fixes, standard CRUD additions adhering to established patterns, or styling preferences handled by linters.*

## Agent-Readiness Rules for ADRs
1. **Self-Contained:** An agent must have enough explicit context and requirements in the ADR to generate the solution without asking follow-up questions.
2. **Actionable & Specific:** Use concrete requirements (e.g., "Use PostgreSQL 16 with pgvector extension" instead of "Use a vector database").
3. **Explicit Non-Goals:** Clearly state what is out of scope to avoid agent hallucination and scope drift.
4. **Concrete Consequences:** Positive and negative consequences must list direct follow-up action items and verification criteria.
5. **Superseding Convention:** When overriding an accepted decision, create a new ADR with status `Accepted` that explicitly lists `Supersedes: ADR-XXX`, and update ADR-XXX status to `Superseded by ADR-YYY`.

## Workflow
1. **Socratic Discovery:** Prompt the user to clarify motivation, trade-offs, and considered alternatives.
2. **Drafting:** Generate the ADR markdown following the project's standard ADR template.
3. **Agent-Readiness Audit:** Review against the 5 agent-readiness rules.
4. **Indexing:** Update `docs/adr/README.md` or index file with number, title, and current status (`Draft`, `Accepted`, `Rejected`, `Superseded`).
