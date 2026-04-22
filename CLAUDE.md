<!-- ruflo:start -->
# Ruflo — Agent Orchestration

This project uses **Ruflo** (via MCP) for multi-agent orchestration, task coordination, and automation. Ruflo is always available as an MCP server.

## Always Do

- **MUST use Ruflo tools** for spawning sub-agents, running parallel workstreams, and coordinating complex multi-step tasks.
- When a task requires more than 3 independent steps or parallel execution, use `ruflo_agent_spawn` or `ruflo_hive_mind` instead of doing everything sequentially.
- For long-running or background tasks, delegate to a Ruflo agent rather than blocking the main thread.
- Use Ruflo's memory and RAG tools when persistent context across steps is needed.
- **MUST pass GitNexus context to every spawned agent** — before spawning, run `gitnexus_context` or `gitnexus_query` on the relevant symbols and include the result in the agent's task prompt so it understands the codebase structure.
- **MUST run `gitnexus_impact` before delegating any edit task to a Ruflo agent** — include the blast radius in the agent instructions so it knows what is safe to touch.

## Never Do

- NEVER attempt complex multi-agent workflows manually when Ruflo tools are available.
- NEVER spawn more agents than needed — always check `ruflo_agent_list` before spawning new ones.
- NEVER spawn a Ruflo agent to edit code without first supplying it with the relevant GitNexus impact and context data.

## Quick Reference

| Task | Ruflo command |
|------|---------------|
| Spawn a coding agent | `ruflo_agent_spawn({type: "coder", name: "..."})` |
| Launch a multi-agent swarm | `ruflo_hive_mind_spawn({task: "..."})` |
| List active agents | `ruflo_agent_list()` |
| Start MCP server manually | `npx ruflo@latest mcp start` |

<!-- ruflo:end -->

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **zadachnik** (4309 symbols, 9160 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/zadachnik/context` | Codebase overview, check index freshness |
| `gitnexus://repo/zadachnik/clusters` | All functional areas |
| `gitnexus://repo/zadachnik/processes` | All execution flows |
| `gitnexus://repo/zadachnik/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
