/**
 * SquidBay - Security Report Page JS
 * js/security.js
 * 
 * Server-side routing:
 *   /skill/agent/slug/security → Express serves security.html → this JS reads window.location.pathname
 * 
 * Fetches: GET /skills/by-agent/:agent/:slug → GET /skills/:id/security
 */

const API_BASE = window.API_BASE;

/* ============================================
   INIT — Parse URL and load data
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
    // URL: /skill/{agent}/{slug}/security
    const pathMatch = window.location.pathname.match(/^\/skill\/([^\/]+)\/([^\/]+)\/security\/?$/);
    if (pathMatch) {
        const agentName = decodeURIComponent(pathMatch[1]);
        const slug = decodeURIComponent(pathMatch[2]);
        loadSecurityReport(agentName, slug);
        return;
    }

    // Fallback: ?id=uuid
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (id) {
        loadSecurityReportById(id);
        return;
    }

    showError('Missing Skill', 'No skill specified. <a href="/marketplace">Browse the marketplace</a>.');
});

/* ============================================
   DATA LOADING
   ============================================ */

async function loadSecurityReport(agentName, slug) {
    try {
        // First get the skill ID from the slug
        const skillRes = await fetch(`${API_BASE}/skills/by-agent/${encodeURIComponent(agentName)}/${encodeURIComponent(slug)}`);
        if (!skillRes.ok) throw new Error('Skill not found');
        const skillData = await skillRes.json();
        const skill = skillData.skill || skillData;
        if (!skill || !skill.id) throw new Error('Invalid skill data');

        // Now fetch the full security report
        const secRes = await fetch(`${API_BASE}/skills/${skill.id}/security`);
        if (!secRes.ok) throw new Error('Security report not available');
        const report = await secRes.json();

        renderSecurityReport(report, agentName, slug);
        document.getElementById('page-loader').classList.add('hidden');
        document.getElementById('security-content').classList.remove('hidden');
    } catch (err) {
        console.error('Error loading security report:', err);
        showError('Report Not Available', 'Security report could not be loaded. <a href="/marketplace">Browse the marketplace</a>.');
    }
}

async function loadSecurityReportById(id) {
    try {
        const secRes = await fetch(`${API_BASE}/skills/${id}/security`);
        if (!secRes.ok) throw new Error('Security report not available');
        const report = await secRes.json();

        const agentName = report.skill?.agent_name || '';
        const slug = report.skill?.slug || '';
        renderSecurityReport(report, agentName, slug);
        document.getElementById('page-loader').classList.add('hidden');
        document.getElementById('security-content').classList.remove('hidden');
    } catch (err) {
        console.error('Error loading security report by ID:', err);
        showError('Report Not Available', 'Security report could not be loaded. <a href="/marketplace">Browse the marketplace</a>.');
    }
}

/* ============================================
   RENDER — Main report page
   ============================================ */

function renderSecurityReport(report, agentName, slug) {
    const skill = report.skill;
    const scan = report.scan;
    const history = report.history || [];
    const content = document.getElementById('security-content');

    // Page title & meta
    document.title = `Security Report — ${esc(skill.name)} | SquidBay`;
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical && agentName && slug) {
        canonical.href = `https://squidbay.ai/skill/${encodeURIComponent(agentName)}/${encodeURIComponent(slug)}/security`;
    }
    const ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl && agentName && slug) {
        ogUrl.content = `https://squidbay.ai/skill/${encodeURIComponent(agentName)}/${encodeURIComponent(slug)}/security`;
    }
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.content = `Security Report — ${skill.name} | SquidBay`;

    // No scan available
    if (!scan) {
        content.innerHTML = `
            <div class="security-page">
                ${renderBackLink(agentName, slug)}
                ${renderHeader(skill, null)}
                <div class="verdict-banner verdict-clean" style="justify-content:center;text-align:center;">
                    <p style="color:var(--text-muted);margin:0;">No security scan data available for this skill yet.</p>
                </div>
                ${renderFooter(agentName, slug, skill.name)}
            </div>`;
        return;
    }

    content.innerHTML = `
        <div class="security-page">
            ${renderBackLink(agentName, slug)}
            ${renderHeader(skill, scan)}
            ${renderVerdictBanner(scan)}
            ${renderCategoryContext(skill)}
            ${renderSummaryCards(scan)}
            ${renderDetectionCategories(scan)}
            ${renderPermissionsInventory(scan.permissions || [])}
            ${renderExternalLinks(scan.external_links || {})}
            ${renderScanHistory(history)}
            ${renderFooter(agentName, slug, skill.name)}
        </div>`;

    // Wire up expand/collapse
    document.querySelectorAll('.section-header').forEach(header => {
        header.addEventListener('click', () => {
            header.classList.toggle('expanded');
            const body = header.nextElementSibling;
            if (body) body.classList.toggle('open');
        });
    });
}

/* ============================================
   RENDER — Back Link
   ============================================ */

function renderBackLink(agentName, slug) {
    const params = new URLSearchParams(window.location.search);
    const from = params.get('from');
    const fromAgentName = params.get('agent_name');
    
    let href, label;
    
    if (from === 'marketplace') {
        href = '/marketplace';
        label = 'Back to marketplace';
    } else if (from === 'agent' && fromAgentName) {
        href = `/agent/${encodeURIComponent(fromAgentName)}`;
        label = 'Back to agent';
    } else if (agentName && slug) {
        href = `/skill/${encodeURIComponent(agentName)}/${encodeURIComponent(slug)}`;
        label = 'Back to skill';
    } else {
        href = '/marketplace';
        label = 'Back to marketplace';
    }
    
    return `<a href="${href}" class="security-back">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        ${label}
    </a>`;
}

/* ============================================
   RENDER — Header
   ============================================ */

function renderHeader(skill, scan) {
    const shieldColor = !scan ? 'var(--gray-light)' : scan.result === 'clean' ? 'var(--green)' : scan.result === 'warning' ? 'var(--yellow)' : 'var(--red)';
    const s = scan?.summary || {};
    const filesScanned = s.files_scanned || 0;
    const totalKB = s.total_bytes ? (s.total_bytes / 1024).toFixed(0) : '0';
    const scanDate = scan?.scanned_at ? formatDate(scan.scanned_at) : '';
    const patternsChecked = scan?.patterns_checked || 0;
    const categoriesChecked = scan?.categories_checked || 0;

    // Scan scope label based on delivery_mode and files scanned
    const deliveryMode = skill.delivery_mode || 'local';
    const isGitHub = deliveryMode === 'github_managed' || deliveryMode === 'github_live';
    const isMultiFile = filesScanned > 1;
    
    let scopeLabel, scopeIcon;
    if (isGitHub) {
        scopeLabel = 'Full Repository Scan';
        scopeIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>';
    } else if (isMultiFile) {
        scopeLabel = 'Full Code Scan';
        scopeIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>';
    } else {
        scopeLabel = 'Skill File Scan';
        scopeIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>';
    }

    return `
        <div class="security-header">
            <div class="security-shield">
                <svg viewBox="0 0 24 24" fill="none" stroke="${shieldColor}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    ${scan?.result === 'clean' ? `<polyline points="9 12 11.5 14.5 16 10" stroke="${shieldColor}"/>` : ''}
                </svg>
            </div>
            <div class="security-header-info">
                <h1>Security Report — <a href="${skillUrl(skill)}" class="skill-name-link">${esc(skill.name)}</a></h1>
                <div class="security-header-meta">
                    ${skill.version ? `<span class="version-badge">v${esc(skill.version)}</span>` : ''}
                    <span class="scope-badge">${scopeIcon} ${scopeLabel}</span>
                    ${scanDate ? `<span>Scanned ${scanDate}</span>` : ''}
                    ${filesScanned ? `<span>${filesScanned} files (${totalKB}KB) · ${categoriesChecked} categories · ${patternsChecked} patterns</span>` : ''}
                </div>
            </div>
        </div>`;
}

/* ============================================
   RENDER — Verdict Banner + Risk Ring
   ============================================ */

function renderVerdictBanner(scan) {
    const score = scan.risk_score || 0;
    const trustScore = 100 - score;
    const result = scan.result || 'clean';
    const verdictClass = `verdict-${result}`;

    // Ring math — SVG circle circumference
    const radius = 42;
    const circumference = 2 * Math.PI * radius;
    const fillPct = Math.max(trustScore / 100, 0);
    const dashOffset = trustScore >= 100 ? 0 : Math.max(circumference * (1 - fillPct), circumference * 0.02);

    // Ring color by trust score
    let ringColor;
    if (trustScore >= 85) ringColor = 'var(--green)';
    else if (trustScore >= 60) ringColor = 'var(--yellow)';
    else if (trustScore >= 30) ringColor = '#ff8c00';
    else ringColor = 'var(--red)';

    // Trust label text
    let trustLabel;
    if (trustScore === 100) trustLabel = 'Perfect Trust';
    else if (trustScore >= 85) trustLabel = 'High Trust';
    else if (trustScore >= 60) trustLabel = 'Moderate Trust';
    else if (trustScore >= 30) trustLabel = 'Low Trust';
    else trustLabel = 'Critical Risk';

    // Verdict text
    const verdictLabels = {
        clean:    { title: 'No Threats Detected', sub: 'All security checks passed. This skill is clean.' },
        warning:  { title: 'Warnings Found',      sub: 'Minor flags detected. Review findings below.' },
        rejected: { title: 'Threats Detected',     sub: 'Critical security issues found. This skill has been deactivated.' }
    };
    const v = verdictLabels[result] || verdictLabels.clean;

    return `
        <div class="verdict-banner ${verdictClass}">
            <div class="risk-ring-container">
                <svg class="risk-ring-svg" viewBox="0 0 100 100">
                    <circle class="risk-ring-bg" cx="50" cy="50" r="${radius}"/>
                    <circle class="risk-ring-fill" cx="50" cy="50" r="${radius}"
                        stroke="${ringColor}"
                        stroke-dasharray="${circumference}"
                        stroke-dashoffset="${dashOffset}"/>
                </svg>
                <div class="risk-ring-label">
                    <div class="risk-ring-score">${trustScore}</div>
                    <div class="risk-ring-max">/ 100</div>
                </div>
            </div>
            <div class="verdict-info">
                <p class="verdict-label">${v.title}</p>
                <p class="verdict-sublabel">Trust Score: ${trustScore}/100 — ${trustLabel}</p>
                <p class="verdict-sublabel">${v.sub}</p>
            </div>
        </div>`;
}

/* ============================================
   RENDER — Category Context Note
   Categories where elevated findings are expected
   ============================================ */

const CATEGORY_CONTEXT = {
    'cybersecurity':    { icon: '🛡️', note: 'This skill is categorized as <strong>cybersecurity</strong>. Elevated permissions, shell access, network requests, and detection patterns are expected for security tools. Review findings for anything outside the tool\'s stated purpose.' },
    'security':         { icon: '🛡️', note: 'This skill is categorized as <strong>security</strong>. Elevated permissions, shell access, network requests, and detection patterns are expected for security tools. Review findings for anything outside the tool\'s stated purpose.' },
    'infrastructure':   { icon: '🧱', note: 'This skill is categorized as <strong>infrastructure</strong>. Shell commands, environment variable access, and file system operations are standard for deployment and DevOps tools.' },
    'developer tools':  { icon: '🔧', note: 'This skill is categorized as <strong>developer tools</strong>. Code execution, file system access, and environment variables are typical for dev tooling. Verify the tool only accesses what it needs.' },
    'automation':       { icon: '🤖', note: 'This skill is categorized as <strong>automation</strong>. Network requests, shell commands, and background workers are common in automation workflows.' },
    'data':             { icon: '📊', note: 'This skill is categorized as <strong>data processing</strong>. File system access and network requests are standard for data ingestion and ETL tools.' },
    'iot':              { icon: '📡', note: 'This skill is categorized as <strong>IoT</strong>. Network requests, environment variables, and background workers are expected for device communication.' },
    'crypto':           { icon: '₿', note: 'This skill is categorized as <strong>crypto</strong>. Cryptography usage, network requests, and environment variables are standard for blockchain tools.' },
    'blockchain':       { icon: '⛓️', note: 'This skill is categorized as <strong>blockchain</strong>. Cryptography usage, network requests, and environment variables are standard for blockchain tools.' }
};

function renderCategoryContext(skill) {
    const cat = (skill.category || '').toLowerCase();
    const ctx = CATEGORY_CONTEXT[cat];
    if (!ctx) return '';
    
    return `
        <div class="category-context-note">
            <span class="category-context-icon">${ctx.icon}</span>
            <p class="category-context-text">${ctx.note}</p>
        </div>`;
}

/* ============================================
   RENDER — Summary Cards
   ============================================ */

function renderSummaryCards(scan) {
    const s = scan.summary || {};
    const files = s.files_scanned || 0;
    const totalKB = s.total_bytes ? (s.total_bytes / 1024).toFixed(0) : '0';
    const patterns = scan.patterns_checked || 0;
    const threats = (scan.findings || []).filter(f => f.severity !== 'info').length;

    return `
        <div class="summary-cards">
            <div class="summary-card">
                <div class="summary-card-value">${files}</div>
                <div class="summary-card-label">Files Scanned</div>
            </div>
            <div class="summary-card">
                <div class="summary-card-value">${totalKB}KB</div>
                <div class="summary-card-label">Source Analyzed</div>
            </div>
            <div class="summary-card">
                <div class="summary-card-value">${patterns}</div>
                <div class="summary-card-label">Detection Patterns</div>
            </div>
            <div class="summary-card">
                <div class="summary-card-value">${threats}</div>
                <div class="summary-card-label">Threats Found</div>
            </div>
        </div>`;
}

/* ============================================
   RENDER — Detection Categories (13 rows)
   ============================================ */

const CATEGORY_META = [
    { key: 'trackers',              label: 'Trackers & Ad Networks',      severity: 'reject',  summaryKey: 'trackers',              desc: 'Detects ad networks, analytics trackers, and fingerprinting scripts that collect user data without consent.' },
    { key: 'injection',             label: 'Prompt Injection',            severity: 'reject',  summaryKey: 'injection_patterns',    desc: 'Looks for hidden instructions that could hijack an AI agent\'s behavior when processing this skill.' },
    { key: 'suspicious_import',     label: 'Suspicious Imports',          severity: 'warning', summaryKey: 'suspicious_imports',     desc: 'Flags imports from unusual or potentially malicious packages not expected in this type of skill.' },
    { key: 'obfuscation',          label: 'Code Obfuscation',            severity: 'reject',  summaryKey: 'obfuscation',           desc: 'Detects base64 encoding, eval(), and other techniques used to hide malicious code.' },
    { key: 'data_exfiltration',    label: 'Data Exfiltration',           severity: 'reject',  summaryKey: 'data_exfiltration',     desc: 'Checks for code that sends data to external servers — cookies, localStorage, form data, or clipboard contents.' },
    { key: 'credential_harvesting', label: 'Credential Harvesting',      severity: 'reject',  summaryKey: 'credential_harvesting', desc: 'Detects fake login forms, password field scraping, and keylogging patterns.' },
    { key: 'hidden_element',       label: 'Hidden Elements',             severity: 'warning', summaryKey: 'hidden_elements',        desc: 'Finds invisible iframes, hidden forms, or zero-size elements that could operate without the user knowing.' },
    { key: 'env_sniffing',         label: 'Environment Variable Access', severity: 'reject',  summaryKey: 'env_sniffing',          desc: 'Flags code that reads environment variables — often used to steal API keys, tokens, or secrets.' },
    { key: 'supply_chain',         label: 'Supply Chain Attacks',        severity: 'reject',  summaryKey: 'supply_chain',          desc: 'Detects dependency confusion, typosquatting package names, and CDN tampering patterns.' },
    { key: 'file_system_attack',   label: 'File System Attacks',         severity: 'reject',  summaryKey: 'file_system',           desc: 'Looks for path traversal, unauthorized file reads/writes, and attempts to access system files.' },
    { key: 'service_worker',       label: 'Service Worker Abuse',        severity: 'warning', summaryKey: 'service_worker',         desc: 'Checks for service workers that could intercept requests, cache malicious content, or persist after removal.' },
    { key: 'crypto_mining',        label: 'Crypto Mining',               severity: 'reject',  summaryKey: 'crypto_mining',         desc: 'Detects cryptocurrency mining scripts that would use the buyer\'s CPU without permission.' },
    { key: 'secret_leak',          label: 'Hardcoded Secrets',           severity: 'reject',  summaryKey: 'secrets',               desc: 'Looks for leaked API keys, tokens, and private keys in the source code. These should never be committed.' },
    { key: 'external_url',         label: 'External URLs',               severity: 'info',    summaryKey: 'external_urls',         desc: 'Lists all outbound URLs found in the source code. Not inherently dangerous — review to verify they\'re expected.' }
];

function renderDetectionCategories(scan) {
    const summary = scan.summary || {};
    const findings = scan.findings || [];

    // Group findings by type
    const findingsByType = {};
    for (const f of findings) {
        const t = f.type || 'unknown';
        if (!findingsByType[t]) findingsByType[t] = [];
        findingsByType[t].push(f);
    }

    let rows = '';
    for (const cat of CATEGORY_META) {
        const count = summary[cat.summaryKey] || 0;
        const catFindings = findingsByType[cat.key] || [];
        const hasFindings = count > 0 || catFindings.length > 0;
        const displayCount = count || catFindings.length;

        // Status icon and class
        let statusClass, statusIcon;
        if (!hasFindings) {
            statusClass = 'status-pass';
            statusIcon = '✓';
        } else if (cat.severity === 'info') {
            statusClass = 'status-info';
            statusIcon = 'ℹ';
        } else if (cat.severity === 'warning') {
            statusClass = 'status-warn';
            statusIcon = '!';
        } else {
            statusClass = 'status-fail';
            statusIcon = '✗';
        }

        const sevClass = hasFindings ? `sev-${cat.severity}` : 'sev-clean';

        // Individual findings (shown inline under the category row)
        let findingsHtml = '';
        if (catFindings.length > 0) {
            const maxShow = 20;
            findingsHtml = `<div class="category-findings">` +
                catFindings.slice(0, maxShow).map(f =>
                    `<div class="finding-item">` +
                    (f.file ? `<span class="finding-file">${esc(f.file)}</span>` : '') +
                    `<span class="finding-match" title="${esc(f.match || '')}">${esc((f.match || '').substring(0, 80))}</span>` +
                    `</div>`
                ).join('') +
                (catFindings.length > maxShow ? `<div class="finding-item" style="color:var(--gray-light);">+ ${catFindings.length - maxShow} more</div>` : '') +
                `</div>`;
        }

        rows += `
            <div class="category-row">
                <div class="category-status ${statusClass}">${statusIcon}</div>
                <span class="category-name">${cat.label}</span>
                <span class="category-finding-count ${sevClass}">${hasFindings ? displayCount + ' found' : 'Clear'}</span>
            </div>
            <div class="category-desc">${cat.desc}</div>
            ${findingsHtml}`;
    }

    return `
        <div class="report-section">
            <div class="section-header expanded">
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                <span class="section-title">Detection Categories</span>
                <span class="section-count">${CATEGORY_META.length} checked</span>
                <svg class="section-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
            <div class="section-body open">
                ${rows}
            </div>
        </div>`;
}

/* ============================================
   RENDER — Permissions Inventory
   ============================================ */

function renderPermissionsInventory(permissions) {
    if (!permissions || permissions.length === 0) return '';

    const PERM_DESC = {
        'Makes Network Requests':       'Can send or receive data over the internet. Normal for web skills, but worth reviewing what it connects to.',
        'Modifies DOM':                 'Can change what you see on screen. Standard for any visual skill — nothing alarming on its own.',
        'Accesses File System':         'Can read or write files on the host machine. Fine for file-processing skills, risky if unexpected.',
        'Executes Shell Commands':      'Can run system commands on the host. Powerful and dangerous if not expected — review carefully.',
        'Accesses Environment Variables':'Can read secrets like API keys and tokens from the host environment. Should only be present if the skill needs external service access.',
        'Uses Cryptography':            'Uses encryption or hashing functions. Normal for security-related skills, unusual for simple utilities.',
        'Stores Data Locally':          'Can save data to localStorage, cookies, or IndexedDB in the browser. Check what it stores.',
        'Registers Workers':            'Can install service workers or web workers that run in the background, even after the page closes.',
        'Uses WebAssembly':             'Runs compiled binary code in the browser. Legitimate for performance-heavy tasks, but impossible to read — you have to trust the source.'
    };

    const detected = permissions.filter(p => p.detected);
    const notDetected = permissions.filter(p => !p.detected);
    const sorted = [...detected, ...notDetected];

    let rows = '';
    for (const p of sorted) {
        const isDetected = p.detected;
        const riskClass = p.risk === 'elevated' ? 'risk-elevated' : 'risk-neutral';
        const desc = PERM_DESC[p.label] || '';

        rows += `
            <div class="perm-row">
                <span class="perm-check ${isDetected ? 'detected' : 'not-detected'}">${isDetected ? '✓' : '—'}</span>
                <span class="perm-label ${isDetected ? 'detected' : 'not-detected'}">${esc(p.label)}</span>
                ${isDetected ? `<span class="perm-risk ${riskClass}">${esc(p.risk)}</span>` : `<span class="perm-risk perm-not-found">Not detected</span>`}
            </div>
            ${desc ? `<div class="perm-desc ${isDetected ? '' : 'perm-desc-muted'}">${desc}</div>` : ''}
            ${isDetected && p.files && p.files.length > 0 ? `<div class="perm-files">Found in: ${p.files.map(f => esc(f)).join(', ')}</div>` : ''}`;
    }

    return `
        <div class="report-section">
            <div class="section-header">
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--yellow)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                <span class="section-title">Permissions Inventory</span>
                <span class="section-count">${detected.length} of ${permissions.length} detected</span>
                <svg class="section-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
            <div class="section-body">
                ${rows}
            </div>
        </div>`;
}

/* ============================================
   RENDER — External Links
   ============================================ */

function renderExternalLinks(externalLinks) {
    const domains = Object.keys(externalLinks);
    if (domains.length === 0) return '';

    const totalLinks = domains.reduce((sum, d) => sum + externalLinks[d].length, 0);

    let groups = '';
    for (const domain of domains) {
        const links = externalLinks[domain];
        const maxShow = 10;
        groups += `
            <div class="ext-domain-group">
                <div class="ext-domain-header">
                    ${esc(domain)} <span class="ext-domain-count">(${links.length})</span>
                </div>
                ${links.slice(0, maxShow).map(link =>
                    `<div class="ext-link-item">` +
                    (link.file ? `<span class="finding-file">${esc(link.file)}</span>` : '') +
                    `<span class="ext-link-url" title="${esc(link.url)}">${esc(link.url)}</span>` +
                    `</div>`
                ).join('')}
                ${links.length > maxShow ? `<div class="ext-link-item" style="color:var(--gray-light);">+ ${links.length - maxShow} more</div>` : ''}
            </div>`;
    }

    return `
        <div class="report-section">
            <div class="section-header">
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
                <span class="section-title">External Connections</span>
                <span class="section-count">${totalLinks} URLs across ${domains.length} domains</span>
                <svg class="section-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
            <div class="section-body">
                ${groups}
            </div>
        </div>`;
}

/* ============================================
   RENDER — Scan History
   ============================================ */

function renderScanHistory(history) {
    if (!history || history.length === 0) return '';

    const maxShow = 20;
    const rows = history.slice(0, maxShow).map(h => {
        const resultClass = `result-${h.result}`;
        const label = h.result === 'clean' ? 'Clean' : h.result === 'warning' ? 'Warning' : 'Rejected';
        return `
            <div class="history-row">
                <div class="history-dot ${resultClass}"></div>
                <span class="history-date">${formatDate(h.scanned_at)}</span>
                <span class="history-result ${resultClass}">${label}</span>
                <span class="history-meta">Score: ${h.risk_score || 0}/100 · Scanner v${esc(h.scanner_version || '?')}</span>
            </div>`;
    }).join('');

    return `
        <div class="report-section">
            <div class="section-header">
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <span class="section-title">Scan History</span>
                <span class="section-count">${history.length} scans</span>
                <svg class="section-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
            <div class="section-body">
                ${rows}
            </div>
        </div>`;
}

/* ============================================
   RENDER — Footer
   ============================================ */

function renderFooter(agentName, slug, skillName) {
    const issueTitle = encodeURIComponent('Security Concern: ' + (skillName || 'Unknown Skill'));
    const reportUrl = agentName && slug
        ? `https://squidbay.ai/skill/${encodeURIComponent(agentName)}/${encodeURIComponent(slug)}/security`
        : window.location.href;
    const issueBody = encodeURIComponent('**Report URL:** ' + reportUrl + '\n\n**Skill:** ' + (skillName || 'Unknown') + '\n\n**Describe your concern:**\n');
    const issueUrl = `https://github.com/squidbay/squidbay/issues/new?labels=security-concern&title=${issueTitle}&body=${issueBody}`;

    return `
        <div class="report-concerns-module">
            <div class="concerns-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
            <h3 class="concerns-title">Something Look Wrong?</h3>
            <p class="concerns-text">If you believe this report contains errors or have security concerns about this skill, open an issue. We review every report and take action publicly.</p>
            <a href="${issueUrl}" target="_blank" rel="noopener noreferrer" class="concerns-btn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>
                Open an Issue
            </a>
        </div>
        <div class="security-footer">
            SquidBay scans every source file submitted with this skill.<br>
            This report was generated by automated static analysis — not AI summary, not antivirus.
        </div>`;
}

/* ============================================
   UTILITIES
   ============================================ */

function skillUrl(skill) {
    if (skill.slug && skill.agent_name) {
        return `/skill/${encodeURIComponent(skill.agent_name)}/${encodeURIComponent(skill.slug)}`;
    }
    return `/skill.html?id=${skill.id}`;
}

function formatDate(d) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function esc(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function showError(title, message) {
    document.getElementById('page-loader').classList.add('hidden');
    document.getElementById('security-content').classList.add('hidden');
    const e = document.getElementById('error-display');
    e.innerHTML = `<h2>${title}</h2><p>${message}</p>`;
    e.classList.remove('hidden');
}
