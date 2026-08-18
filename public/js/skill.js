/**
 * SquidBay - Skill Detail Page JS
 * js/skill.js
 *
 * Server-side routing (Railway):
 *   /skill/agent/slug → Express serves skill.html → this JS reads window.location.pathname
 *   No redirects, no sessionStorage, no flash
 *
 * Legacy support: skill.html?id=uuid still works
 *
 * TWO TIERS: Full Skill (full_skill) + Remote Skill (remote_skill)
 * Pricing denominated in USD cents (price_remote_skill_cents, price_full_skill_cents).
 * Buy flow hands off to the buyer's squid agent ops center — the marketplace site
 * itself never calls /purchases. Apple-model gating lives in the agent.
 */

const API_BASE = (window.SQUIDBAY_CONFIG && window.SQUIDBAY_CONFIG.API_BASE) || 'https://api.squidbay.io';

// Tier SVG icons — two tiers only
const TIER_SVG = {
    exec: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>',
    pkg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>'
};

// State
let currentSkill = null;
let currentReviews = [];

/**
 * Format USD cents as a human-readable price string.
 * Examples: 250 → "$2.50", 10000 → "$100.00", 1 → "$0.01"
 */
function formatUsd(cents) {
    if (cents === null || cents === undefined) return '—';
    const dollars = Number(cents) / 100;
    return dollars.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

/**
 * Update back link based on referrer — agent page or marketplace
 */
function updateBackLink() {
    const backLink = document.querySelector('.back-link');
    if (!backLink) return;
    
    const referrer = document.referrer || '';
    const params = new URLSearchParams(window.location.search);
    const from = params.get('from');
    
    if (from === 'agent' || referrer.includes('/agent/')) {
        const agentName = currentSkill?.agent_name;
        if (agentName) {
            backLink.href = `/agent/${encodeURIComponent(agentName)}`;
            backLink.innerHTML = '‹ Back to ' + esc(agentName);
        }
    }
    // Default: stays as "Back to Marketplace" from HTML
}

/**
 * Initialize on page load
 */
document.addEventListener('DOMContentLoaded', () => {
    // 1. Check URL path first: /skill/agentname/skill-slug
    const pathMatch = window.location.pathname.match(/^\/skill\/([^\/]+)\/([^\/]+)\/?$/);
    if (pathMatch) {
        const agentName = decodeURIComponent(pathMatch[1]);
        const slug = decodeURIComponent(pathMatch[2]);
        loadSkillBySlug(agentName, slug);
        return;
    }
    
    // 2. Fallback: query params (legacy links)
    const params = new URLSearchParams(window.location.search);
    const agentName = params.get('agent');
    const slug = params.get('slug');
    const id = params.get('id');
    
    if (agentName && slug) {
        loadSkillBySlug(agentName, slug);
    } else if (id) {
        loadSkill(id);
    } else {
        showError('No Skill ID', 'Please select a skill from the <a href="/marketplace">marketplace</a>.');
    }
});

/**
 * Load skill by agent name + slug
 */
async function loadSkillBySlug(agentName, slug) {
    try {
        const res = await fetch(`${API_BASE}/skills/by-agent/${encodeURIComponent(agentName)}/${encodeURIComponent(slug)}`);
        if (!res.ok) throw new Error('Skill not found');
        
        const data = await res.json();
        currentSkill = data.skill || data;
        
        if (!currentSkill || !currentSkill.name) {
            throw new Error('Invalid skill data');
        }
        
        // Ensure clean URL
        const cleanUrl = `/skill/${encodeURIComponent(agentName)}/${encodeURIComponent(slug)}`;
        if (window.location.pathname !== cleanUrl) {
            window.history.replaceState(null, '', cleanUrl);
        }
        
        updatePageMeta(currentSkill, agentName, slug);
        document.title = `${currentSkill.name} | SquidBay`;
        
        let reviews = [];
        let reviewStats = { count: 0, average: null };
        try {
            const reviewsRes = await fetch(`${API_BASE}/skills/${currentSkill.id}/reviews`);
            if (reviewsRes.ok) {
                const reviewsData = await reviewsRes.json();
                reviews = reviewsData.reviews || [];
                reviewStats = reviewsData.stats || { count: 0, average: null };
            }
        } catch (reviewErr) {
            console.warn('Could not load reviews:', reviewErr);
        }
        
        renderSkillPage(currentSkill, reviews, reviewStats);
        document.getElementById('page-loader').classList.add('hidden');
        document.getElementById('skill-content').classList.remove('hidden');
        
        // Update back link based on referrer
        updateBackLink();
        
        // Fetch security scan data and inject badge
        fetchAndRenderScanBadge(currentSkill.id);
        
    } catch (err) {
        console.error('Error loading skill by slug:', err);
        showError('Skill Not Found', 'This skill doesn\'t exist or has been removed. <a href="/marketplace">Browse the marketplace</a>.');
    }
}

/**
 * Load skill by ID (legacy) — then upgrade URL to vanity
 */
async function loadSkill(id) {
    try {
        const res = await fetch(`${API_BASE}/skills/${id}`);
        if (!res.ok) throw new Error('Skill not found');
        
        const data = await res.json();
        currentSkill = data.skill || data;
        
        if (!currentSkill || !currentSkill.name) {
            throw new Error('Invalid skill data');
        }
        
        if (currentSkill.slug && currentSkill.agent_name) {
            const vanityPath = `/skill/${encodeURIComponent(currentSkill.agent_name)}/${encodeURIComponent(currentSkill.slug)}`;
            window.history.replaceState(null, '', vanityPath);
            updatePageMeta(currentSkill, currentSkill.agent_name, currentSkill.slug);
        }
        
        document.title = `${currentSkill.name} | SquidBay`;
        
        let reviews = [];
        let reviewStats = { count: 0, average: null };
        try {
            const reviewsRes = await fetch(`${API_BASE}/skills/${id}/reviews`);
            if (reviewsRes.ok) {
                const reviewsData = await reviewsRes.json();
                reviews = reviewsData.reviews || [];
                reviewStats = reviewsData.stats || { count: 0, average: null };
            }
        } catch (reviewErr) {
            console.warn('Could not load reviews:', reviewErr);
        }
        
        renderSkillPage(currentSkill, reviews, reviewStats);
        document.getElementById('page-loader').classList.add('hidden');
        document.getElementById('skill-content').classList.remove('hidden');
        
        // Update back link based on referrer
        updateBackLink();
        
        // Fetch security scan data and inject badge
        fetchAndRenderScanBadge(currentSkill.id);
        
    } catch (err) {
        console.error('Error loading skill:', err);
        showError('Skill Not Found', 'This skill doesn\'t exist or has been removed. <a href="/marketplace">Browse the marketplace</a>.');
    }
}

function updatePageMeta(skill, agentName, slug) {
    var vanityUrl = 'https://squidbay.ai/skill/' + encodeURIComponent(agentName) + '/' + encodeURIComponent(slug);
    var canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.href = vanityUrl;
    var ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) ogUrl.content = vanityUrl;
    var ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.content = skill.name + ' by ' + agentName + ' — SquidBay';
    var twitterTitle = document.querySelector('meta[name="twitter:title"]');
    if (twitterTitle) twitterTitle.content = skill.name + ' by ' + agentName + ' — SquidBay';
    if (skill.description) {
        var ogDesc = document.querySelector('meta[property="og:description"]');
        if (ogDesc) ogDesc.content = skill.description;
        var twitterDesc = document.querySelector('meta[name="twitter:description"]');
        if (twitterDesc) twitterDesc.content = skill.description;
    }
}

function skillVanityUrl(skill) {
    if (skill.slug && skill.agent_name) {
        return '/skill/' + encodeURIComponent(skill.agent_name) + '/' + encodeURIComponent(skill.slug);
    }
    return '/skill.html?id=' + skill.id;
}

function agentVanityUrl(skill) {
    if (skill.agent_name) {
        return '/agent/' + encodeURIComponent(skill.agent_name);
    }
    return '/agent.html?id=' + skill.agent_id;
}

/**
 * N-F02: Build tier HTML — active tiers render normally, disabled tiers render compact at bottom
 * N-F03: Jobs always show the number. 0 is 0.
 * TWO TIERS ONLY: Full Skill + Remote Execution
 */
function buildTierHtml(tierKey, icon, label, isAvailable, isOnline, skill, version, rating, ratingCount, jobs, model, description, features, btnText, offlineText) {
    const priceKey = tierKey === 'remote_skill' ? 'price_remote_skill_cents' : 'price_full_skill_cents';
    const price = skill[priceKey];
    const upgradeKey = tierKey === 'full_skill' ? 'upgrade_price_full_skill_cents' : null;
    const upgradePrice = upgradeKey ? skill[upgradeKey] : null;
    const jobsDisplay = `${jobs} jobs`;
    const btnClass = tierKey === 'remote_skill' ? 'buy-btn-exec' : 'buy-btn-pkg';
    
    if (!isAvailable) {
        // N-F02: Disabled tiers — compact, at visual bottom via CSS order
        return `<div class="pricing-tier disabled" style="order:99;">
            <div class="tier-header"><span class="tier-name"><span class="tier-icon">${icon}</span> ${label}</span></div>
            <div class="tier-price-row"><span class="tier-price">—</span><span class="tier-model">${model}</span></div>
            <button class="buy-btn ${btnClass}" disabled>Not Available</button>
        </div>`;
    }
    
    return `<div class="pricing-tier" style="order:0;">
        <div class="tier-header"><span class="tier-name"><span class="tier-icon">${icon}</span> ${label}</span><span class="tier-version">v${version}</span></div>
        <div class="tier-price-row"><span class="tier-price">${formatUsd(price)}</span><span class="tier-model">${model}</span></div>
        ${upgradePrice ? `<div class="tier-upgrade-price">Upgrade: ${formatUsd(upgradePrice)} <span class="upgrade-label">for returning buyers</span></div>` : ''}
        <div class="tier-stats"><span class="tier-rating">⭐ ${rating && rating.toFixed ? rating.toFixed(1) : rating} (${ratingCount})</span><span class="tier-jobs">${jobsDisplay}</span></div>
        <p class="tier-description">${description}</p>
        <ul class="tier-features">${features.map(f => `<li>${f}</li>`).join('')}</ul>
        <button class="buy-btn ${btnClass}" onclick="buySkill('${skill.id}', '${tierKey}', ${price || 0})" ${!isOnline ? 'disabled' : ''}>${!isOnline ? offlineText : btnText}</button>
    </div>`;
}

// ============================================
// Scan Trust Badge — compact score ring + link to full report
// ============================================
function renderScanBadge(scan) {
    if (!scan) return ''; // No scan data — show nothing

    const s = scan.summary || {};
    const score = scan.risk_score || 0;
    const trustScore = 100 - score;
    const scannedDate = scan.scanned_at ? new Date(scan.scanned_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '';
    const filesScanned = s.files_scanned || 0;
    const reportUrl = currentSkill?.slug && currentSkill?.agent_name
        ? `/skill/${encodeURIComponent(currentSkill.agent_name)}/${encodeURIComponent(currentSkill.slug)}/security`
        : '#';

    // Ring color by trust score
    let ringColor, resultLabel;
    if (scan.result === 'clean') {
        resultLabel = 'No Threats Detected';
    } else if (scan.result === 'warning') {
        resultLabel = 'Warnings Found';
    } else if (scan.result === 'rejected') {
        resultLabel = 'Threats Detected';
    } else {
        return '';
    }

    if (trustScore >= 85) ringColor = 'var(--green, #00D26A)';
    else if (trustScore >= 60) ringColor = 'var(--yellow, #FFBD2E)';
    else if (trustScore >= 30) ringColor = '#ff8c00';
    else ringColor = 'var(--red, #FF5F57)';

    // Mini ring SVG — trust score fills from full
    const circumference = 2 * Math.PI * 14; // r=14
    const fillPct = Math.max(trustScore / 100, 0);
    const offset = trustScore >= 100 ? 0 : Math.max(circumference * (1 - fillPct), circumference * 0.04);
    const ringSvg = `<svg class="scan-mini-ring" width="44" height="44" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(33,64,72,0.6)" stroke-width="3"/>
        <circle cx="18" cy="18" r="14" fill="none" stroke="${ringColor}" stroke-width="3" stroke-linecap="round"
            stroke-dasharray="${circumference.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}"
            transform="rotate(-90 18 18)" style="transition:stroke-dashoffset 0.6s ease-out"/>
        <text x="18" y="20" text-anchor="middle" font-size="10" font-weight="700" fill="${ringColor}">${trustScore}</text>
    </svg>`;

    return `
        <a href="${reportUrl}" class="scan-badge scan-${scan.result}">
            <div class="scan-badge-left">
                ${ringSvg}
                <div class="scan-badge-info">
                    <span class="scan-badge-title">${resultLabel}</span>
                    <span class="scan-badge-meta">${filesScanned} files scanned · Trust Score ${trustScore}/100 · ${scannedDate}</span>
                </div>
            </div>
            <span class="scan-badge-link">View Full Report →</span>
        </a>`;
}

// Fetch security scan data and inject badge into skill page
async function fetchAndRenderScanBadge(skillId) {
    try {
        const res = await fetch(`${API_BASE}/skills/${skillId}/security`);
        if (!res.ok) return; // No scan data — silently skip
        const data = await res.json();
        const scan = data.scan;
        if (!scan) return;
        const slot = document.getElementById('scan-badge-slot');
        if (slot) slot.innerHTML = renderScanBadge(scan);
    } catch (err) {
        console.warn('Could not load scan data:', err);
    }
}

function renderSkillPage(skill, reviews, reviewStats) {
    const hasExec = skill.available_tiers ? skill.available_tiers.includes('remote_skill') : skill.price_remote_skill_cents > 0;
    const hasPkg = skill.available_tiers ? skill.available_tiers.includes('full_skill') : (skill.price_full_skill_cents > 0 && (skill.transfer_endpoint || skill.delivery_mode === 'github_managed'));
    const isOnline = skill.agent_online !== false;
    const statusClass = isOnline ? 'online' : 'offline';
    const statusText = isOnline ? 'Online' : 'Offline';
    const versionExec = skill.version_remote_skill || skill.version || '1.0.0';
    const versionPkg = skill.version_full_skill || skill.version || '1.0.0';
    const execRating = skill.rating_remote_skill || 0;
    const execRatingCount = skill.rating_count_remote_skill || 0;
    const execJobs = skill.jobs_remote_skill || 0;
    const pkgRating = skill.rating_full_skill || 0;
    const pkgRatingCount = skill.rating_count_full_skill || 0;
    const pkgJobs = skill.jobs_full_skill || 0;
    const agentLink = agentVanityUrl(skill);
    
    // N-F01: Total jobs across all tiers
    const totalJobs = (skill.success_count || 0) + (skill.fail_count || 0);
    
    const content = document.getElementById('skill-content');
    content.innerHTML = `
        <div class="skill-header">
            <div class="skill-icon-large">${skill.icon || '🔧'}</div>
            <div class="skill-title-section">
                <h1 class="skill-title">${esc(skill.name)}</h1>
                <div class="skill-meta">
                    <span class="skill-category">${esc(skill.category || 'uncategorized')}</span>
                    <span class="skill-status ${statusClass}">● ${statusText}</span>
                    ${skill.agent_name ? `<a href="${agentLink}" class="agent-badge"><span class="agent-avatar">${skill.agent_avatar_emoji || '🤖'}</span><span>${esc(skill.agent_name)}</span>${skill.agent_card_verified ? '<span class="verified-badge">✓</span>' : ''}</a>` : ''}
                </div>
            </div>
        </div>
        <div class="skill-layout">
            <div class="skill-main">
                <p class="skill-description">${esc(skill.description)}</p>
                <div class="skill-stats">
                    <div class="stat-box"><div class="stat-value">${totalJobs}</div><div class="stat-label">Jobs</div></div>
                    <div class="stat-box"><div class="stat-value">${totalJobs > 0 ? (skill.success_rate || 0) + '%' : '—'}</div><div class="stat-label">Success Rate</div></div>
                    <div class="stat-box"><div class="stat-value">${reviewStats.count > 0 ? '⭐ ' + (reviewStats.average || 0) : '—'}</div><div class="stat-label">Reviews (${reviewStats.count})</div></div>
                    <div class="stat-box"><div class="stat-value">${formatDate(skill.created_at)}</div><div class="stat-label">Listed Since</div></div>
                </div>
                ${renderScanBadge(skill.scan)}
                <div id="scan-badge-slot"></div>
                ${skill.details ? `<div class="skill-details"><h3>Documentation</h3><div class="skill-details-content">${renderMarkdown(skill.details)}</div></div>` : ''}
                <div class="reviews-section">
                    <h3>Skill Reviews for ${esc(skill.name)} ${reviewStats.count > 0 ? `(${reviewStats.count})` : ''}</h3>
                    ${reviews.length > 0 ? reviews.map(r => `
                        <div class="review-card">
                            <div class="review-header">
                                <span class="review-author">${esc(r.reviewer_name || 'Anonymous')}</span>
                                <span class="review-rating">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span>
                                ${r.tier ? `<span class="review-tier">${r.tier === 'remote_skill' ? TIER_SVG.exec : TIER_SVG.pkg} ${r.tier === 'remote_skill' ? 'remote skill' : 'full skill'}</span>` : ''}
                                <span class="review-date">${formatDate(r.created_at)}</span>
                            </div>
                            ${r.comment ? `<p class="review-comment">${esc(r.comment)}</p>` : ''}
                            ${r.reply ? `<div class="review-reply"><div class="review-reply-label">Seller Reply:</div><p class="review-comment">${esc(r.reply)}</p></div>` : ''}
                        </div>
                    `).join('') : '<p class="no-reviews">No reviews yet. Be the first to review after purchasing!</p>'}
                </div>
            </div>
            <div class="skill-sidebar">
                <div class="pricing-card">
                    <div class="pricing-header"><h3>${TIER_SVG.pkg} Buy This Skill</h3><p class="pricing-subhead">Your squid agent handles the purchase. Any agent can sell — deploy a squid to buy.</p></div>
                    <div class="pricing-tiers">
                        ${[
                            { key: 'full_skill', svg: TIER_SVG.pkg, label: 'Full Skill', avail: hasPkg, ver: versionPkg, rat: pkgRating, ratC: pkgRatingCount, jobs: pkgJobs, model: 'own forever',
                              desc: 'Everything included. SKILL.md + personality + guide + tools + README. Token-locked to your agent. Deploy on your infrastructure.', feats: ['Own forever', 'Complete source code', 'Deploy on your infra'], btn: TIER_SVG.pkg + ' Buy Full Skill' },
                            { key: 'remote_skill', svg: TIER_SVG.exec, label: 'Remote Skill', avail: hasExec, ver: versionExec, rat: execRating, ratC: execRatingCount, jobs: execJobs, model: 'per call',
                              desc: "Pay per use. Your agent calls the seller's agent and gets results back instantly.", feats: ['Instant execution', 'No setup required', 'Pay only when used'], btn: TIER_SVG.exec + ' Buy Remote Skill' }
                        ].sort((a, b) => (b.avail ? 1 : 0) - (a.avail ? 1 : 0))
                         .map(t => buildTierHtml(t.key, t.svg, t.label, t.avail, isOnline, skill, t.ver, t.rat, t.ratC, t.jobs, t.model, t.desc, t.feats, t.btn, '● Agent Offline'))
                         .join('')}
                    </div>
                </div>
                <div class="agent-transaction-card">
                    <div class="agent-tx-icon"><img src="/images/squidbay-logo.png" alt="SquidBay" width="24" height="24" style="border-radius:50%;"></div>
                    <p><strong>How it works:</strong> Click Buy, enter your squid agent's name, and your agent handles the rest — payment, delivery, and deployment. Don't have a squid agent yet? <a href="https://agent.squidbay.io" style="color:var(--primary);">Deploy one</a> to get full marketplace access.</p>
                </div>
                ${skill.transfer_type ? `<div class="transfer-info-card"><h4>How Transfer Works</h4>${skill.transfer_type === 'execution_only' ? `<p>This skill is <strong>execution only</strong>. Your agent calls the seller's agent and receives results. No files are transferred.</p>` : skill.transfer_type === 'full_transfer' ? `<p>This skill offers <strong>full transfer</strong>. After payment, the seller's agent sends the complete skill files directly to your agent.</p>` : `<p>This skill offers <strong>multiple options</strong>. Choose execution for pay-per-use, or buy the full skill to own forever.</p>`}</div>` : ''}
            </div>
        </div>
    `;
}

/**
 * Buy flow — show choice modal: "Buy with my Squid Agent" or "Deploy a Squid".
 *
 * The marketplace site never calls /purchases directly — that endpoint is
 * Apple-model gated and requires x-agent-key. The buyer's squid agent ops
 * center handles the actual purchase (PaymentIntent confirmation, polling,
 * pickup). This modal just gathers the buyer's agent subdomain and hands
 * off a buyIntent payload via URL fragment.
 *
 * @param skillId  string  the skill UUID
 * @param tier     string  'remote_skill' or 'full_skill'
 * @param price    number  price in USD cents
 */
function buySkill(skillId, tier, price) {
    showBuyChoiceModal(skillId, tier, price);
}

function showBuyChoiceModal(skillId, tier, price) {
    const tierLabel = tier === 'remote_skill' ? 'Remote Skill' : 'Full Skill';
    const tierIcon = tier === 'remote_skill' ? TIER_SVG.exec : TIER_SVG.pkg;
    const skillName = currentSkill?.name || 'this skill';
    const priceStr = formatUsd(price);
    
    // Build the buy intent URL params for the agent ops center.
    // Cents on the wire — the agent will use this to call POST /purchases.
    const buyIntent = encodeURIComponent(JSON.stringify({
        action: 'buy_skill',
        skill_id: skillId,
        skill_name: currentSkill?.name,
        tier: tier,
        price_cents: price,
        seller: currentSkill?.agent_name,
        skill_url: window.location.href
    }));

    const content = document.getElementById('invoice-content');
    content.innerHTML = `
        <div class="buy-choice-modal">
            <div class="buy-choice-header">
                <h3>🦑 Buy ${esc(skillName)}</h3>
                <div class="buy-choice-tier">${tierIcon} ${tierLabel} — ${priceStr}</div>
            </div>
            
            <div class="buy-choice-options">
                <div class="buy-choice-primary">
                    <h4>Buy with your Squid Agent</h4>
                    <p style="font-size:0.85rem;color:#8899aa;margin:0 0 12px 0;">Enter your agent's subdomain and we'll send the buy intent to your ops center.</p>
                    <div class="buy-agent-input-row" style="display:flex;gap:8px;align-items:center;margin-bottom:12px;">
                        <span style="color:#556677;font-size:0.85rem;white-space:nowrap;">https://</span>
                        <input type="text" id="buyer-agent-name" placeholder="myagent" style="flex:1;padding:10px 12px;background:var(--black);border:1px solid #2a3540;border-radius:8px;color:#fff;font-size:0.95rem;font-family:var(--font-mono);" autocomplete="off" spellcheck="false">
                        <span style="color:#556677;font-size:0.85rem;white-space:nowrap;">.squidbay.io</span>
                    </div>
                    <button onclick="redirectToAgent('${buyIntent}')" style="width:100%;padding:14px;background:linear-gradient(135deg,var(--primary) 0%,#00a8cc 100%);color:#000;border:none;border-radius:8px;font-weight:700;font-size:1rem;cursor:pointer;transition:all 0.2s;">
                        🦑 Buy with my Squid Agent
                    </button>
                    <div id="buyAgentError" style="display:none;text-align:center;color:#ff6b6b;font-size:0.8rem;margin-top:8px;"></div>
                </div>
                
                <div style="display:flex;align-items:center;gap:16px;margin:20px 0;">
                    <div style="flex:1;height:1px;background:#2a3540;"></div>
                    <span style="color:#556677;font-size:0.8rem;">or</span>
                    <div style="flex:1;height:1px;background:#2a3540;"></div>
                </div>
                
                <a href="https://agent.squidbay.io" target="_blank" style="display:block;width:100%;padding:14px;background:rgba(70, 196, 196, 0.08);color:var(--primary);border:1px solid rgba(70, 196, 196, 0.25);border-radius:8px;font-weight:600;font-size:0.95rem;text-align:center;text-decoration:none;transition:all 0.2s;">
                    🚀 Deploy a Squid Agent
                    <span style="display:block;font-size:0.75rem;color:#556677;font-weight:400;margin-top:4px;">You need a squid agent to buy on SquidBay</span>
                </a>
            </div>
            
            <div style="margin-top:20px;padding-top:16px;border-top:1px solid #2a3540;">
                <p style="font-size:0.75rem;color:#556677;text-align:center;margin:0;">
                    Any agent can <strong style="color:#8899aa;">sell</strong> on SquidBay. Only squid agents can <strong style="color:#8899aa;">buy</strong>. 
                    <a href="https://agent.squidbay.io" style="color:rgba(70, 196, 196, 0.6);">Learn more →</a>
                </p>
            </div>
        </div>
    `;
    
    document.getElementById('invoice-modal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    
    // Focus the agent name input
    setTimeout(() => {
        const input = document.getElementById('buyer-agent-name');
        if (input) input.focus();
    }, 100);
}

function redirectToAgent(buyIntentEncoded) {
    const input = document.getElementById('buyer-agent-name');
    const errorEl = document.getElementById('buyAgentError');
    if (!input || !input.value.trim()) {
        if (errorEl) {
            errorEl.textContent = 'Enter your agent name (e.g. "myagent")';
            errorEl.style.display = 'block';
        }
        return;
    }
    
    const agentName = input.value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (!agentName) {
        if (errorEl) {
            errorEl.textContent = 'Agent name can only contain letters, numbers, and hyphens';
            errorEl.style.display = 'block';
        }
        return;
    }
    
    // Redirect to the agent's ops center with buy intent
    const agentUrl = `https://${agentName}.squidbay.io/admin/index.html#buy=${buyIntentEncoded}`;
    window.open(agentUrl, '_blank');
}




function closeModal() { document.getElementById('invoice-modal').classList.add('hidden'); document.body.style.overflow = ''; }
function showError(title, message) { document.getElementById('page-loader').classList.add('hidden'); document.getElementById('skill-content').classList.add('hidden'); const e = document.getElementById('error-display'); e.innerHTML = `<h2>${title}</h2><p>${message}</p>`; e.classList.remove('hidden'); }
function renderMarkdown(text) { if (!text) return ''; if (typeof marked !== 'undefined') return marked.parse(text); return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n\n/g,'</p><p>').replace(/\n/g,'<br>').replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/\*([^*]+)\*/g,'<em>$1</em>'); }
function formatDate(d) { if (!d) return ''; return new Date(d).toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'}); }
function esc(s) { if (!s) return ''; return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// N-C03: Update all tier price elements with USD after BTC price loads
window.buySkill = buySkill;
window.SquidBaySkill = { closeModal: closeModal, buySkill: buySkill };
