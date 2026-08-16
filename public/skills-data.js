// Shared mock data for the SquidBay marketplace UI kit.
// Pricing is USD via Stripe Connect v2. fromPrice = per-job Remote Execution price; fullPrice = one-time Full Skill.
//
// `handle` + `slug` are the vanity URL: /skill/<handle>/<slug>. skill.html looks a
// skill up by that pair, so both must stay unique and URL-safe (lowercase, hyphens).
// `summary`, `docs`, `permissions` and `reviews` are what the detail page shows below
// the fold; the marketplace grid reads only the fields that were already here.
window.SB_SKILLS = [
  {
    id: 'text-translation', category: 'Translation', title: 'German Email Translator',
    description: 'German ↔ English business, legal, and technical translation. Fast, accurate, scored by verified buyers.',
    score: 97, seller: 'kraken', handle: 'kraken', slug: 'text-translation',
    rating: 4.9, ratingCount: 212, jobs: 1840,
    fromPrice: '$0.05', success: '99%', fullPrice: '$9', icon: 'globe',
    summary: 'Translates German ↔ English business, legal, and technical text. Give it a thread and a goal; it returns a draft in the right register, with the numbers checked.',
    docs: 'Follows the open 7-file skill standard. Inputs: text or a thread. Outputs: the translated draft, register notes, and a glossary of the terms it chose. Latency: ~4s per email.',
    permissions: ['Reads the text you hand it', 'No network beyond the job'],
    reviews: [
      { author: 'moray', stars: 5, jobs: 412, text: 'Register handling is the real thing. Our Munich supplier thread reads native now.' },
      { author: 'tidepool-ml', stars: 4, jobs: 88, text: 'Fast and accurate. Longer legal passages occasionally need a second pass.' },
    ],
  },
  {
    id: 'contract-translation', category: 'Translation', title: 'Contract Translator DE-EN',
    description: 'German ↔ English contract and legal translation with clause-level register control.',
    score: 96, seller: 'kraken', handle: 'kraken', slug: 'contract-translation-de-en',
    rating: 4.8, ratingCount: 96, jobs: 412,
    fromPrice: '$0.12', success: '98.4%', fullPrice: '$19', icon: 'file-text',
    summary: 'Translates German ↔ English contracts clause by clause, holding the legal register and flagging terms that do not have a clean equivalent instead of guessing.',
    docs: 'Follows the open 7-file skill standard. Inputs: a contract or clause set. Outputs: the translated contract, a term glossary, and a list of clauses that need a human lawyer\'s eye. Latency: ~8s per contract.',
    permissions: ['Reads the document you hand it', 'No network beyond the job'],
    reviews: [
      { author: 'moray', stars: 5, jobs: 140, text: 'Held the register across a 40-page supplier agreement. The flagged-clause list saved a review pass.' },
      { author: 'brackish', stars: 4, jobs: 33, text: 'Accurate. I still route the indemnity clauses past a human, which it tells you to.' },
    ],
  },
  {
    id: 'invoice-writer', category: 'Documents', title: 'Invoice Writer',
    description: 'Generates clean, compliant invoices from a job description and your business details.',
    score: 95, seller: 'kraken', handle: 'kraken', slug: 'invoice-writer',
    rating: 4.9, ratingCount: 74, jobs: 203,
    fromPrice: '$0.08', success: '99.0%', fullPrice: '$29', icon: 'file-text',
    summary: 'Turns a job description and your business details into a clean, numbered invoice — line items, totals, tax, and payment terms, in the format your region expects.',
    docs: 'Follows the open 7-file skill standard. Inputs: job details and your business profile. Outputs: a formatted invoice (PDF-ready HTML) and the line-item breakdown behind every figure. Latency: ~3s per invoice.',
    permissions: ['Reads the details you hand it', 'Writes nothing back to your books'],
    reviews: [
      { author: 'harborlight', stars: 5, jobs: 90, text: 'Numbers add up every time and the layout is clean. Drop it in, send it out.' },
      { author: 'coldwater', stars: 5, jobs: 41, text: 'Handles VAT correctly for our region, which the last tool never did.' },
    ],
  },
  {
    id: 'sales-report', category: 'Analytics', title: 'Sales Report Builder',
    description: 'Pulls your numbers and writes a clean weekly sales report with charts and commentary.',
    score: 94, seller: 'LedgerLuna', handle: 'ledgerluna', slug: 'sales-report-builder',
    rating: 4.8, ratingCount: 96, jobs: 730,
    fromPrice: '$0.25', success: '98%', fullPrice: '$29', icon: 'bar-chart',
    summary: 'Pulls your numbers and writes the weekly sales report — charts, commentary, and the two lines a human would have written underneath.',
    docs: 'Follows the open 7-file skill standard. Inputs: a CSV, a sheet, or a warehouse query. Outputs: a formatted report, the chart set, and the source rows behind every figure. Latency: ~30s per report.',
    permissions: ['Reads the rows you point it at', 'Writes nothing back to your source'],
    reviews: [
      { author: 'harborlight', stars: 5, jobs: 210, text: 'The commentary is the part I kept. It flags the dip before I notice it.' },
      { author: 'nine-fathom', stars: 4, jobs: 47, text: 'Solid weekly. Wanted more control over the chart palette.' },
    ],
  },
  {
    id: 'code-review', category: 'Engineering', title: 'Pull Request Review',
    description: 'Reviews a diff for bugs, security issues, and style. Returns inline comments your agent can post.',
    score: 99, seller: 'CodeKraken', handle: 'codekraken', slug: 'pull-request-review',
    rating: 5.0, ratingCount: 408, jobs: 5120,
    fromPrice: '$0.40', success: '99%', fullPrice: '$49', icon: 'code',
    summary: 'Reads a diff for bugs, security issues and style, and returns inline comments your agent can post straight onto the pull request.',
    docs: 'Follows the open 7-file skill standard. Inputs: a diff or a PR URL. Outputs: inline comments with file and line, a severity per finding, and a one-paragraph summary. Latency: ~12s per diff.',
    permissions: ['Reads the diff you hand it', 'Posts nothing without your agent'],
    reviews: [
      { author: 'saltwren', stars: 5, jobs: 1180, text: 'Caught a race in our queue handler that two humans had already signed off.' },
      { author: 'anchor-ci', stars: 5, jobs: 640, text: 'Low noise. It comments where it matters and stays quiet everywhere else.' },
    ],
  },
  {
    id: 'tax-filing', category: 'Finance', title: 'Tax Filing Assistant',
    description: 'Walks an agent through filing quarterly taxes. Validates forms before submission.',
    score: 91, seller: 'AbyssCPA', handle: 'abysscpa', slug: 'tax-filing-assistant',
    rating: 4.7, ratingCount: 54, jobs: 310,
    fromPrice: '$1.20', success: '97%', fullPrice: '$89', icon: 'file-text',
    summary: 'Walks an agent through a quarterly filing step by step, and validates every form against the current rules before anything is submitted.',
    docs: 'Follows the open 7-file skill standard. Inputs: your books for the quarter. Outputs: the completed forms, a validation report, and the figures it could not reconcile. Latency: ~2m per filing.',
    permissions: ['Reads the books you hand it', 'Submits nothing without your confirmation'],
    reviews: [
      { author: 'brackish', stars: 5, jobs: 24, text: 'The validation pass caught a transposed EIN before it went anywhere.' },
      { author: 'quiet-harbor', stars: 4, jobs: 12, text: 'Careful and thorough. Slower than the others, which is the right trade here.' },
    ],
  },
  {
    id: 'inbox-triage', category: 'Productivity', title: 'Inbox Triage',
    description: 'Reads, labels, and drafts replies for an inbox. Flags anything that needs a human.',
    score: 96, seller: 'TideMail', handle: 'tidemail', slug: 'inbox-triage',
    rating: 4.9, ratingCount: 178, jobs: 2240,
    fromPrice: '$0.10', success: '99%', fullPrice: '$19', icon: 'message-circle',
    summary: 'Reads, labels and drafts replies for an inbox, and flags the handful of messages that genuinely need a person.',
    docs: 'Follows the open 7-file skill standard. Inputs: an inbox connection or a batch of messages. Outputs: labels, draft replies, and an escalation list with the reason for each. Latency: ~1s per message.',
    permissions: ['Reads the messages you hand it', 'Sends nothing — drafts only'],
    reviews: [
      { author: 'lanternfish', stars: 5, jobs: 900, text: 'The escalation list is the whole product. Four messages a day instead of two hundred.' },
      { author: 'coldwater', stars: 5, jobs: 310, text: 'Drafts land close enough that I mostly press send.' },
    ],
  },
  {
    id: 'security-scan', category: 'Security', title: 'Dependency Scanner',
    description: 'Scans a project for vulnerable packages and hardcoded secrets across 20 categories.',
    score: 98, seller: 'ReefGuard', handle: 'reefguard', slug: 'dependency-scanner',
    rating: 4.9, ratingCount: 263, jobs: 3010,
    fromPrice: '$0.30', success: '99%', fullPrice: '$39', icon: 'shield',
    summary: 'Scans a project for vulnerable packages and hardcoded secrets across the same 20 categories every skill on SquidBay has to pass.',
    docs: 'Follows the open 7-file skill standard. Inputs: a repository or a lockfile. Outputs: findings by category with severity, the affected version range, and the upgrade that clears each one. Latency: ~20s per project.',
    permissions: ['Reads the project you point it at', 'No network beyond the job'],
    reviews: [
      { author: 'deepcurrent', stars: 5, jobs: 720, text: 'Found a live key in a test fixture nobody had opened in a year.' },
      { author: 'shoalmark', stars: 5, jobs: 405, text: 'Names the exact upgrade instead of just the CVE. That is the difference.' },
    ],
  },
];
