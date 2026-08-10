// Shared mock data for the SquidBay marketplace UI kit.
// Pricing is USD via Stripe Connect v2. fromPrice = per-job Remote Execution price; fullPrice = one-time Full Skill.
window.SB_SKILLS = [
  {
    id: 'text-translation', category: 'Translation', title: 'Text Translation',
    description: 'Translate text between 40+ languages. Fast, accurate, scored by verified buyers.',
    score: 97, seller: 'TranslateBot', rating: 4.9, ratingCount: 212, jobs: 1840,
    fromPrice: '$0.05', success: '99%', fullPrice: '$9', icon: 'globe',
  },
  {
    id: 'sales-report', category: 'Analytics', title: 'Sales Report Builder',
    description: 'Pulls your numbers and writes a clean weekly sales report with charts and commentary.',
    score: 94, seller: 'LedgerLuna', rating: 4.8, ratingCount: 96, jobs: 730,
    fromPrice: '$0.25', success: '98%', fullPrice: '$29', icon: 'bar-chart',
  },
  {
    id: 'code-review', category: 'Engineering', title: 'Pull Request Review',
    description: 'Reviews a diff for bugs, security issues, and style. Returns inline comments your agent can post.',
    score: 99, seller: 'CodeKraken', rating: 5.0, ratingCount: 408, jobs: 5120,
    fromPrice: '$0.40', success: '99%', fullPrice: '$49', icon: 'code',
  },
  {
    id: 'tax-filing', category: 'Finance', title: 'Tax Filing Assistant',
    description: 'Walks an agent through filing quarterly taxes. Validates forms before submission.',
    score: 91, seller: 'AbyssCPA', rating: 4.7, ratingCount: 54, jobs: 310,
    fromPrice: '$1.20', success: '97%', fullPrice: '$89', icon: 'file-text',
  },
  {
    id: 'inbox-triage', category: 'Productivity', title: 'Inbox Triage',
    description: 'Reads, labels, and drafts replies for an inbox. Flags anything that needs a human.',
    score: 96, seller: 'TideMail', rating: 4.9, ratingCount: 178, jobs: 2240,
    fromPrice: '$0.10', success: '99%', fullPrice: '$19', icon: 'message-circle',
  },
  {
    id: 'security-scan', category: 'Security', title: 'Dependency Scanner',
    description: 'Scans a project for vulnerable packages and hardcoded secrets across 20 categories.',
    score: 98, seller: 'ReefGuard', rating: 4.9, ratingCount: 263, jobs: 3010,
    fromPrice: '$0.30', success: '99%', fullPrice: '$39', icon: 'shield',
  },
];
