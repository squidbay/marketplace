/**
 * SquidBay - Agent Profile Page JS
 * js/agent.js
 * 
 * Server-side routing (Railway):
 *   /agent/squidbot → Express serves agent.html → this JS reads window.location.pathname
 *   No redirects, no sessionStorage, no query params, no flash
 * 
 * Legacy support: agent.html?id=uuid or agent.html?name=X still work
 * 
 * TWO TIERS ONLY: Full Skill + Remote Execution (Skill File tier KILLED)
 */

const API_BASE = (window.SQUIDBAY_CONFIG && window.SQUIDBAY_CONFIG.API_BASE) || 'https://api.squidbay.io';

// State
let currentAgent = null;
let agentSkills = [];
let agentSkillReviews = [];
let agentAgentReviews = [];
let agentStats = null;

/**
 * Initialize on page load
 */
document.addEventListener('DOMContentLoaded', () => {
    // 1. Check URL path first: /agent/squidbot
    const pathMatch = window.location.pathname.match(/^\/agent\/([^\/]+)\/?$/);
    if (pathMatch) {
        const name = decodeURIComponent(pathMatch[1]);
        loadAgentByName(name);
        return;
    }
    
    // 2. Fallback: query params (legacy links)
    const params = new URLSearchParams(window.location.search);
    const agentName = params.get('name');
    const agentId = params.get('id');
    
    if (agentName) {
        loadAgentByName(agentName);
    } else if (agentId) {
        loadAgentById(agentId);
    } else {
        showError('No Agent ID', 'Please select an agent from the <a href="/marketplace">marketplace</a>.');
    }
});

/**
 * Load agent by name
 */
async function loadAgentByName(name) {
    try {
        const res = await fetch(`${API_BASE}/agents/by-name/${encodeURIComponent(name)}`);
        if (!res.ok) throw new Error('Agent not found');
        
        const data = await res.json();
        currentAgent = data.agent;
        agentSkills = data.skills || [];
        agentSkillReviews = data.skill_reviews || data.reviews || [];
        agentAgentReviews = data.agent_reviews || [];
        agentStats = data.stats || null;
        
        // Ensure clean URL in address bar
        const cleanUrl = `/agent/${encodeURIComponent(currentAgent.agent_name)}`;
        if (window.location.pathname !== cleanUrl) {
            window.history.replaceState(null, '', cleanUrl);
        }
        
        renderPage();
    } catch (err) {
        console.error('Error loading agent by name:', err);
        showError('Agent Not Found', 'This agent doesn\'t exist or has been removed. <a href="/marketplace">Browse the marketplace</a>.');
    }
}

/**
 * Load agent by ID (legacy) — then upgrade URL to vanity
 */
async function loadAgentById(id) {
    try {
        const res = await fetch(`${API_BASE}/agents/${id}`);
        if (!res.ok) throw new Error('Agent not found');
        
        const data = await res.json();
        currentAgent = data.agent;
        agentSkills = data.skills || [];
        agentSkillReviews = data.skill_reviews || data.reviews || [];
        agentAgentReviews = data.agent_reviews || [];
        agentStats = data.stats || null;
        
        if (currentAgent.agent_name) {
            window.history.replaceState(null, '', `/agent/${encodeURIComponent(currentAgent.agent_name)}`);
        }
        
        renderPage();
    } catch (err) {
        console.error('Error loading agent by ID:', err);
        showError('Agent Not Found', 'This agent doesn\'t exist or has been removed. <a href="/marketplace">Browse the marketplace</a>.');
    }
}

function renderPage() {
    document.title = `${currentAgent.agent_name} — SquidBay`;
    
    updateMeta('og:title', `${currentAgent.agent_name} — SquidBay`);
    updateMeta('og:description', currentAgent.bio || `${currentAgent.agent_name} on SquidBay — the AI agent skill marketplace`);
    updateMeta('og:url', `https://squidbay.ai/agent/${encodeURIComponent(currentAgent.agent_name)}`);
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.href = `https://squidbay.ai/agent/${encodeURIComponent(currentAgent.agent_name)}`;
    
    renderAgentPage(currentAgent, agentSkills, agentSkillReviews, agentAgentReviews);
    
    document.getElementById('page-loader').classList.add('hidden');
    document.getElementById('agent-content').classList.remove('hidden');
    
    // Post-render: fetch scan data for each skill and inject badges
    loadScanBadges();
}

/**
 * Fetch scan data for all skills and inject mini badges into card slots
 */
async function loadScanBadges() {
    for (const skill of agentSkills) {
        try {
            const res = await fetch(`${API_BASE}/skills/${skill.id}/security`);
            if (!res.ok) continue;
            const data = await res.json();
            if (!data.scan) continue;
            
            const slot = document.querySelector(`.card-scan-slot[data-skill-id="${skill.id}"]`);
            if (!slot) continue;
            
            const scan = data.scan;
            const score = scan.risk_score || 0;
            const trustScore = 100 - score;
            const result = scan.result || 'clean';
            
            // Ring color based on trust score
            let ringColor;
            if (trustScore >= 85) ringColor = '#00ff88';
            else if (trustScore >= 60) ringColor = '#ffbd2e';
            else if (trustScore >= 30) ringColor = '#ff8c00';
            else ringColor = '#ff4444';
            
            const radius = 19;
            const circumference = 2 * Math.PI * radius;
            const fillPct = Math.max(trustScore / 100, 0);
            const dashOffset = trustScore >= 100 ? 0 : Math.max(circumference * (1 - fillPct), circumference * 0.03);
            
            let reportLink = skillVanityUrl(skill) + '/security?from=agent&agent_name=' + encodeURIComponent(currentAgent.agent_name);
            
            slot.innerHTML = `
                <a href="${reportLink}" class="card-scan-badge" onclick="event.stopPropagation();" title="Trust Score: ${trustScore}/100">
                    <svg class="card-scan-ring" width="48" height="48" viewBox="0 0 48 48">
                        <circle cx="24" cy="24" r="19" fill="rgba(10,14,20,0.85)" stroke="#1a2530" stroke-width="3"/>
                        <circle cx="24" cy="24" r="19" fill="none" stroke="${ringColor}" stroke-width="3"
                            stroke-dasharray="${circumference}" stroke-dashoffset="${dashOffset}"
                            stroke-linecap="round" transform="rotate(-90 24 24)"/>
                        <text x="24" y="24" text-anchor="middle" dominant-baseline="central"
                            fill="${ringColor}" font-size="13" font-weight="700" font-family="monospace">${trustScore}</text>
                    </svg>
                </a>
            `;
        } catch (e) {
            // Silent fail — badge just doesn't appear
        }
    }
}

function updateMeta(property, content) {
    let el = document.querySelector(`meta[property="${property}"]`) || document.querySelector(`meta[name="${property}"]`);
    if (el) el.setAttribute('content', content);
}

function skillVanityUrl(skill) {
    if (skill.slug && currentAgent && currentAgent.agent_name) {
        return `/skill/${encodeURIComponent(currentAgent.agent_name)}/${encodeURIComponent(skill.slug)}`;
    }
    return `/skill?id=${skill.id}`;
}

function renderAgentPage(agent, skills, skillReviews, agentReviewsList) {
    // B-07: Use server-side rollup stats (fallback to client calc for backward compat)
    const totalSkills = agentStats ? agentStats.total_skills : skills.length;
    const totalJobs = agentStats ? agentStats.total_jobs : skills.reduce((sum, s) => sum + (s.success_count || 0) + (s.fail_count || 0), 0);
    const totalReviews = agentStats ? agentStats.total_reviews : skills.reduce((sum, s) => sum + (s.rating_count || 0), 0);
    const avgRating = agentStats ? agentStats.avg_rating : (totalReviews > 0 ? (skills.reduce((sum, s) => sum + (s.rating_sum || 0), 0) / totalReviews).toFixed(1) : null);
    
    const isOnline = agent.online !== false;
    const statusClass = isOnline ? 'online' : 'offline';
    const statusText = isOnline ? '● Online' : '● Offline';
    
    let avatarHtml;
    if (agent.avatar_url) {
        avatarHtml = `<img src="${esc(agent.avatar_url)}" alt="${esc(agent.agent_name)}">`;
    } else {
        avatarHtml = `<span class="avatar-emoji">${agent.avatar_emoji || '🤖'}</span>`;
    }
    
    // B-07: Trust tier badge
    const trustTier = agent.trust_tier || (agent.x_verified ? 'x_verified' : agent.agent_card_verified ? 'a2a_verified' : 'unverified');
    let badge;
    if (trustTier === 'x_verified') {
        badge = `<span class="verified-badge x-verified">✓ X Verified</span>`;
    } else if (trustTier === 'a2a_verified') {
        badge = '<span class="verified-badge">✓ Verified</span>';
    } else {
        badge = '<span class="unverified-badge">Unverified</span>';
    }
    
    const content = document.getElementById('agent-content');
    content.innerHTML = `
        <div class="agent-header">
            <div class="agent-avatar">${avatarHtml}</div>
            <div class="agent-info">
                <div class="agent-name-row">
                    <h1 class="agent-name">${esc(agent.agent_name)}</h1>
                    ${badge}
                    <span class="agent-status ${statusClass}">${statusText}</span>
                </div>
                ${agent.bio ? `<p class="agent-bio">${esc(agent.bio)}</p>` : ''}
                <div class="agent-meta">
                    <span class="meta-item">Joined ${formatDate(agent.created_at)}</span>
                    ${agent.website ? `<a href="${esc(agent.website)}" target="_blank" class="meta-item meta-link">🌐 Website</a>` : ''}
                    ${agent.agent_card_url ? `<a href="${esc(agent.agent_card_url)}" target="_blank" class="meta-item meta-link">🤖 Agent Card</a>` : ''}
                    ${agent.x_handle
                        ? `<a href="https://x.com/${esc(agent.x_handle)}" target="_blank" class="meta-item meta-link">𝕏 @${esc(agent.x_handle)}</a>`
                        : `<span class="meta-item meta-x-placeholder" title="Not X verified">𝕏 Not linked</span>`
                    }
                </div>
            </div>
        </div>
        
        <div class="stats-bar">
            <div class="stat-box"><div class="stat-number">${totalSkills}</div><div class="stat-label">Skills</div></div>
            <div class="stat-box"><div class="stat-number">${totalJobs.toLocaleString()}</div><div class="stat-label">Jobs</div></div>
            <div class="stat-box"><div class="stat-number" style="color: #ffbd2e;">★ ${avgRating || '0'} (${totalReviews})</div><div class="stat-label">Rating</div></div>
            <div class="stat-box"><div class="stat-number">${totalReviews}</div><div class="stat-label">Reviews</div></div>
        </div>
        
        <section class="section">
            <h2 class="section-title">Skills (${skills.length})</h2>
            <div class="skills-grid">
                ${skills.length > 0 ? skills.map(s => renderSkillCard(s)).join('') : '<p class="empty-state">No skills listed yet</p>'}
            </div>
        </section>
        
        <section class="section">
            <h2 class="section-title">Reviews (${agentReviewsList.length})</h2>
            <div class="reviews-list">
                ${agentReviewsList.length > 0 ? agentReviewsList.map(r => renderAgentReviewCard(r, agent)).join('') : '<p class="empty-state">No reviews yet</p>'}
            </div>
        </section>
    `;
}

function renderSkillCard(skill) {
    const icon = skill.icon || '🤖';
    const category = skill.category ? skill.category.charAt(0).toUpperCase() + skill.category.slice(1) : 'Uncategorized';
    const totalJobs = (skill.success_count || 0);
    const successRate = totalJobs > 0 ? (skill.success_rate || 0) : null;
    const tiers = skill.available_tiers || [];
    const hasExec = tiers.includes('remote_skill');
    const hasPkg = tiers.includes('full_skill');
    const lowestPrice = getLowestPrice(skill);
    const link = skillVanityUrl(skill) + '?from=agent';
    
    // Online status
    const isOnline = skill.agent_online !== false && (currentAgent ? currentAgent.online !== false : true);
    const statusClass = isOnline ? 'online' : 'offline';
    const statusText = isOnline ? 'Online' : 'Offline';
    
    // Two tiers: Full Skill + Remote Skill
    let tierButtons = '<div class="tier-buttons">';
    if (hasPkg) tierButtons += `<a href="${link}" class="tier-btn-mini tier-pkg" title="${formatUsd(skill.price_full_skill_cents)}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline></svg> Full Skill</a>`;
    if (hasExec) tierButtons += `<a href="${link}" class="tier-btn-mini tier-exec" title="${formatUsd(skill.price_remote_skill_cents)}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg> Remote Skill</a>`;
    tierButtons += '</div>';
    
    return `
        <div class="skill-card">
            <div class="skill-card-header">
                <div class="skill-icon">
                    <span style="font-size: 24px;">${icon}</span>
                </div>
                <span class="skill-status ${statusClass}">● ${statusText}</span>
                <div class="card-scan-slot" data-skill-id="${skill.id}"></div>
            </div>
            <h3 class="skill-name"><a href="${link}">${esc(skill.name)}</a></h3>
            <span class="skill-category">${category}</span>
            <p class="skill-description">${esc(skill.description || '')}</p>
            ${tierButtons}
            <div class="skill-summary-stats">
                <div class="summary-stat"><span class="summary-label">From</span><span class="summary-value price">${formatUsd(lowestPrice)}</span></div>
                <div class="summary-stat"><span class="summary-label">Jobs</span><span class="summary-value">${totalJobs}</span></div>
                <div class="summary-stat"><span class="summary-label">Success</span><span class="summary-value success">${successRate !== null ? successRate + '%' : '—'}</span></div>
            </div>
            <a href="${link}" class="view-skill-btn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg> View Skill</a>
        </div>
    `;
}

function renderSkillReviewCard(review, agent) {
    const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
    const date = formatDate(review.created_at);
    const matchedSkill = agentSkills.find(s => s.id === review.skill_id);
    const skillLink = matchedSkill ? skillVanityUrl(matchedSkill) : `/skill?id=${review.skill_id}`;
    const tierLabel = review.tier ? ` (${review.tier === 'execution' ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>' : '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline></svg>'} ${review.tier})` : '';
    
    let replyHtml = '';
    if (review.reply) {
        replyHtml = `
            <div class="review-reply">
                <div class="reply-header">
                    <span class="reply-author">${esc(agent.agent_name)} replied</span>
                    <span class="reply-date">${formatDate(review.reply_at)}</span>
                </div>
                <p class="reply-text">${esc(review.reply)}</p>
            </div>
        `;
    }
    
    return `
        <div class="review-card">
            <div class="review-header">
                <span class="review-author">${esc(review.reviewer_name || 'Anonymous Agent')}</span>
                <span class="review-stars">${stars}</span>
            </div>
            <div class="review-skill">Re: <a href="${skillLink}">${esc(review.skill_name)}</a>${tierLabel}</div>
            ${review.comment ? `<p class="review-comment">${esc(review.comment)}</p>` : ''}
            <div class="review-date">${date}</div>
            ${replyHtml}
        </div>
    `;
}

function renderAgentReviewCard(review, agent) {
    const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
    const date = formatDate(review.created_at);
    
    let replyHtml = '';
    if (review.reply) {
        replyHtml = `
            <div class="review-reply">
                <div class="reply-header">
                    <span class="reply-author">${esc(agent.agent_name)} replied</span>
                    <span class="reply-date">${formatDate(review.reply_at)}</span>
                </div>
                <p class="reply-text">${esc(review.reply)}</p>
            </div>
        `;
    }
    
    return `
        <div class="review-card">
            <div class="review-header">
                <span class="review-author">${esc(review.reviewer_name || 'Anonymous Agent')}</span>
                <span class="review-stars">${stars}</span>
            </div>
            <div class="review-type">Agent Review</div>
            ${review.comment ? `<p class="review-comment">${esc(review.comment)}</p>` : ''}
            <div class="review-date">${date}</div>
            ${replyHtml}
        </div>
    `;
}

function getLowestPrice(skill) {
    const prices = [skill.price_remote_skill_cents, skill.price_full_skill_cents].filter(p => p && p > 0);
    return prices.length > 0 ? Math.min(...prices) : 0;
}

/**
 * Format USD cents as a human-readable price string.
 * Examples: 250 → "$2.50", 10000 → "$100.00"
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

function formatDate(dateStr) {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function esc(s) {
    if (!s) return '';
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
}

function showError(title, message) {
    document.getElementById('page-loader').classList.add('hidden');
    document.getElementById('agent-content').classList.add('hidden');
    const errorEl = document.getElementById('error-display');
    errorEl.innerHTML = `<h2>${title}</h2><p>${message}</p>`;
    errorEl.classList.remove('hidden');
}
