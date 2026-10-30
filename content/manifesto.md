---
version: Draft 0.17
date: 2026-10-30
status: Proposed, for review. A preview, not launched.
---

<!--
The one source for the manifesto and charter. `node tools/build.mjs` turns it into the
reader (template#book in site/index.html and site/artifact-version.html), the text page
(site/manifesto.html), the Markdown twin (site/manifesto.md), site/llms.txt,
site/llms-full.txt and the SHA-256 fingerprint. Edit here, never in the generated files.

Format: `# ` starts a part, `## ` a reader section, `### ` a heading inside it.
A trailing `{.class}` styles a paragraph or list in the reader (lead, key, turn, sign, flow, asks).
A table becomes the charter's roles list.

Manifesto text: brief 2026-10-23 §4, verbatim. It is one continuous text; the six section
titles below are phrases taken from the text itself so the reader has a contents list.
Charter: carried over from Draft 0.3, plus one line marked Proposal (open decision 1).
-->

# The manifesto

## Everything we know arrived through someone

Intelligence never began with one of us. {.lead}

We inherit words we did not invent, discoveries we did not make, and lessons someone else paid dearly to learn. A teacher makes room for a question. A researcher publishes a finding. A maintainer fixes a problem for people they will never meet.

Everything we know arrived through someone. {.key}

## A hand in what comes next

Today, that inheritance is helping us build systems that can change how we learn, work, discover, and create. Their possibilities are extraordinary. So are the decisions taking shape around them. {.lead}

Who can build with them? Who can examine them? Who gets to decide what they become? And who shares in what they make possible?

Contributing to intelligence does not yet give everyone a meaningful say in its future. Too much of that future depends on decisions most people cannot inspect, influence, or leave behind.

We want more people to have a hand in what comes next. {.key}

That takes tools people can understand. Research they can question. Infrastructure they can access. The freedom to adapt what they rely on, and the ability to choose something else.

## It also takes resources

It also takes resources. {.lead}

Servers need electricity. Research takes time. Software needs maintenance. People doing essential work need a way to keep doing it.

We welcome the people and organizations willing to help: independent builders, researchers, communities, businesses, and investors. Capital can make important work possible. Enterprise can carry an idea into the world. We want the terms of that participation to be clear, and its benefits to reach further.

## Who benefits?

When intelligence becomes more efficient, who benefits? {.lead}

We believe the answer should include the people who use it, the people who improve it, and the shared foundations that keep it available. Better systems should create opportunities for broader access. Useful contributions should have paths to recognition and support. The costs of progress should be visible enough to question.

This is the work of an open economy: making it possible to sustain what we build while sharing more of what it enables. {.key}

We are beginning with practical initiatives. Bringing demand and capital together. Testing shared infrastructure. Publishing assumptions, costs, and results. Learning which arrangements work, and changing those that do not.

## The price of participation

Private lives should not become the price of participation. People should be able to help others without surrendering their personal history. Where improvements can be shared, we should make that possible with consent and care for what those improvements may reveal. {.lead}

The work we inherit deserves more than a footnote. Scientific ideas, open software, models, tools, and the people maintaining them are part of the foundation. We want to credit that work and help sustain it.

## Honest uncertainty

We also owe each other honest uncertainty. {.lead}

Open systems can fail. Ambitious ideas can be wrong. A promising demonstration can fall apart outside the conditions that made it work. We need people who can test, challenge, repair, and improve what we create — and findings that are allowed to change our minds.

No single project speaks for humanity. This movement begins as an invitation to contribute, disagree, and help make its commitments real.

Bring a question from your work. A problem from your community. A skill someone else can build on. Bring resources, scrutiny, or the patience to maintain something useful.

We inherited a world of ideas we could never have created alone.

Let’s give others something they can understand, question, and carry forward. {.key}

**Open Intelligence.** {.sign}

**A future we can help shape.** {.sign}

# The charter

## How we work

The manifesto says what we want. The charter says how we hold ourselves to it. {.lead}

Everyone who takes the pledge votes from day one. Responsibility for proposals and stewardship is earned by contributing. {.key .small}

| You are | How you join | Your voice |
| --- | --- | --- |
| Supporter | Take the pledge and confirm you are one real person. Nothing to pay. | Vote in general elections, join every discussion, follow every decision, propose ideas. |
| Contributor | Have a contribution accepted. | Bring formal proposals and stand for election as a steward. |
| Member project | Publish your maintainers, license, governance and evidence for the pledge. | Keep your independence and take part in project representation. |
| Steward | Be elected for a term. | Care for one defined function, report publicly, be replaceable. |

Confirming you are one person prevents fake accounts. It never requires publishing your legal identity.

### How contributions are accepted

Propose → review → evidence → acceptance → publication → maintenance. {.flow}

Every contribution gets a public record: authors, license, origin, purpose, results, limits and reviewers. A rejection comes with a reason and a right to appeal. Acceptance, funding and installation are separate decisions: being accepted doesn't mean being paid, and being approved never means being installed on anyone's machine automatically.

### How decisions are made

- **Technical decisions** stay with each project, through its own public process.
- **Shared resources** go through open proposals, published criteria and approval by elected stewards.
- **Changes to this manifesto** need a qualified majority of both contributors and member projects.
- **Conflicts of interest** are declared, and whoever benefits directly from a decision doesn't approve it.
- **Money never buys votes.** Several projects under the same control don't get extra voices.
- **Initiatives don't govern the movement.** *Proposal, not settled.* An initiative's operating entity, such as a shared compute initiative, may give its own participants usage, governance or economic rights in that initiative. Those rights never carry a vote in the movement or a say over this charter.
- **People stay accountable.** Agents can help review and evaluate, but responsibility for decisions stays human.

## Open finance

The institution is transparent. People have the right to privacy. {.key .small}

Budgets, income, spending, grants and their criteria are public. Every payment points to what was approved, by whom, for what, and what was delivered. Personal bank details and protected information never are.

We use a public ledger to record what must be verifiable: approvals, treasury movements, versions of this manifesto, and the publication of contributions. **There is no tradable token.** Contributing earns credit and voice, not a financial asset. No one needs to buy crypto or manage a wallet to take part.

## What protects the commons

Open projects have been captured before. We write the protections down now, while it's easy. {.lead}

- **No owner.** No company, product, model, funder or founder controls this movement, including the people who started it.
- **Terms, not thrones.** Stewards serve for limited terms and can be replaced. The founders serve provisionally until the first election, on a published date.
- **The right to fork.** Every project can continue without our permission. If we fail the pledge, anyone can carry it forward.
- **No closing what was opened.** What enters the commons stays open, even when contributors, funders or stewards change.
- **Copies everywhere.** Code, records and this manifesto are mirrored, so no single server or person can make them disappear.
- **Written once, owned by no one.** Each final version of this manifesto is anchored in a public blockchain, so anyone can check it word for word and no one, the people who started it included, can rewrite or erase it.
- **No hype as evidence.** We won't claim progress we can't show, or promise AGI on a timeline.
- **Safety is part of openness.** Opening something isn't the same as ignoring its risks. We publish dangers and limits with the same honesty as results.

*Open intelligence. Built together. For everyone.* {.sign}
