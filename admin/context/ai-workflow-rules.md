# AI Workflow Rules

## Approach

[Describe the overall development approach — e.g. Build
this project incrementally using a spec-driven workflow.
Context files define what to build, how to build it, and
the current state of progress. Always implement against
these specs — do not infer or invent behavior from scratch.]

## Scoping Rules

- Work on one feature unit at a time
- Prefer small, verifiable increments over large
  speculative changes
- Do not combine unrelated system boundaries in a
  single implementation step

## When to Split Work

Split an implementation step if it combines:

- [Concern one — e.g. UI changes and background task changes]
- [Concern two — e.g. Multiple unrelated API routes]
- [Concern three — e.g. Behavior not clearly defined in
  the context files]

If a change cannot be verified end to end quickly,
the scope is too broad — split it.

## Handling Missing Requirements

- Do not invent product behavior not defined in the
  context files
- If a requirement is ambiguous, resolve it in the
  relevant context file before implementing
- If a requirement is missing, add it as an open question
  in `progress-tracker.md` before continuing

## Protected Files

Do not modify the following unless explicitly instructed:

- [e.g. components/ui/* — generated UI library components]
- [e.g. Any third-party library internals]

## Keeping Docs in Sync

Update the relevant context file whenever implementation
changes:

- System architecture or boundaries
- Storage model decisions
- Code conventions or standards
- Feature scope

## Explain Every Implementation

For every implemented feature, fix or refactor, document the resulting behavior
and explain it to the user before marking the work complete. Scale the detail to
the change and cover every component and hook created or meaningfully changed.

1. **What changed:** describe the user-visible result and why the change was
   needed. Distinguish completed behavior from remaining work.
2. **Flow:** trace the relevant entry point or user action through access checks,
   components, hooks, providers/backend, cache updates and the resulting UI.
   Use an ordered flow or Mermaid diagram when several layers are involved.
3. **Architecture:** explain each layer's responsibility, where state and logic
   live, which layer owns queries/mutations/cache, and where authorization is
   enforced. Explain meaningful design choices and dependencies.
4. **Components:** provide a file/name-to-responsibility map for every new or
   meaningfully changed component. Explain its inputs, rendered states and
   composition with existing components when relevant to the flow.
5. **Hooks and logic:** provide the same map for hooks and changed logic modules.
   Describe their inputs/outputs, state, queries, mutations, side effects,
   submission guards and invalidation behavior where applicable. Identify the
   provider/service that performs the actual request.
6. **States and verification:** explain affected loading, success, empty, error,
   denied and retry behavior. Report checks actually performed and any remaining
   verification limits.

Persist these explanations in `doc/application-architecture.md` for shared
application flows, or a focused Markdown file under `doc/` for a feature that
needs its own explanation. Link feature documents from the central architecture
document. Update existing explanations to reflect the final implementation and
record completion and validation in `context/progress-tracker.md`.

In the delivery response, include a concise explanation of what changed, the
flow, and the component/hook responsibilities, with clickable links to the
relevant files and saved documentation. For a large change, summarize the main
pieces and link to the complete component/hook map. Inventory only the affected
feature; identify unchanged shared components when they are needed to understand
its flow. Documentation-only changes require a short account of the rule changed
and its location.

## Before Moving to the Next Unit

1. The current unit works end to end within its defined scope
2. No invariant defined in `architecture.md` was violated
3. `progress-tracker.md` reflects the completed work
4. `npm run build` passes
5. The implementation explanation, flow and component/hook map are saved and
   linked in the delivery response as specified above.
