/**
 * SquidBay Marketplace - JavaScript
 * Connected to Railway Backend API
 * Tiered Pricing Support + Vanity URLs
 * Two tiers: Full Skill + Remote Skill. USD cents pricing.
 * ================================
 */

(function() {
    'use strict';

    // --------------------------------------------------------------------------
    // API Configuration
    // --------------------------------------------------------------------------
    
    // F-01: Use centralized config
    const API_BASE = (window.SQUIDBAY_CONFIG && window.SQUIDBAY_CONFIG.API_BASE) || 'https://api.squidbay.io';

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
    
    // Category icons mapping — dynamic, grows with marketplace
    const categoryIcons = {
        'translation': '🌐',
        'image': '🎨',
        'code': '💻',
        'data': '📊',
        'text': '📝',
        'audio': '🎵',
        'video': '🎬',
        'analysis': '🔍',
        'security': '🛡️',
        'cybersecurity': '🛡️',
        'infrastructure': '🧱',
        'productivity': '⚡',
        'developer tools': '🔧',
        'business': '📈',
        'entertainment': '🎭',
        'education': '📚',
        'automotive': '🚗',
        'medical': '⚕️',
        'finance': '💰',
        'legal': '⚖️',
        'marketing': '📣',
        'iot': '📡',
        'companionship': '💜',
        'relationship': '💜',
        'ai companion': '💜',
        'gaming': '🎮',
        'music': '🎶',
        'design': '✏️',
        'writing': '✍️',
        'research': '🔬',
        'travel': '✈️',
        'food': '🍕',
        'fitness': '💪',
        'social media': '📱',
        'crypto': '₿',
        'blockchain': '⛓️',
        'automation': '🤖',
        'uncategorized': '🤖'
    };

    // --------------------------------------------------------------------------
    // Vanity URL Helpers
    // --------------------------------------------------------------------------
    
    /**
     * Build skill URL — uses vanity URL if slug + agent_name available, else falls back to ?id=
     */
    function skillUrl(skill) {
        if (skill.slug && skill.agent_name) {
            return `/skill/${encodeURIComponent(skill.agent_name)}/${encodeURIComponent(skill.slug)}`;
        }
        return `/skill?id=${skill.id}`;
    }
    
    /**
     * Build skill URL with tier pre-selected
     */
    function skillTierUrl(skill, tier) {
        if (skill.slug && skill.agent_name) {
            return `/skill/${encodeURIComponent(skill.agent_name)}/${encodeURIComponent(skill.slug)}?tier=${tier}`;
        }
        return `/skill?id=${skill.id}&tier=${tier}`;
    }
    
    /**
     * Build agent profile URL — uses vanity URL if agent_name available
     */
    function agentUrl(skill) {
        if (skill.agent_name) {
            return `/agent/${encodeURIComponent(skill.agent_name)}`;
        }
        if (skill.agent_id) {
            return `/agent?id=${skill.agent_id}`;
        }
        return '#';
    }

    // --------------------------------------------------------------------------
    // Load Skills from API — with pagination
    // --------------------------------------------------------------------------
    
    let currentPage = 0;
    const PAGE_SIZE = 21;
    let allSkills = [];
    
    async function loadSkills() {
        const grid = document.getElementById('skillsGrid');
        const loading = document.getElementById('skillsLoading');
        const emptyState = document.getElementById('emptyState');
        
        if (!grid) return;
        
        try {
            const response = await fetch(API_BASE + '/skills?limit=200');
            const data = await response.json();
            
            // Hide loading
            if (loading) loading.style.display = 'none';
            
            if (data.skills && data.skills.length > 0) {
                allSkills = data.skills;
                currentPage = 0;
                renderPage();
                if (emptyState) emptyState.style.display = 'none';
                
                // Update stats with real data
                updateLiveStats(data.skills);
            } else {
                // Show empty state
                grid.innerHTML = '';
                if (emptyState) emptyState.style.display = 'block';
                updateLiveStats([]);
            }
        } catch (error) {
            console.error('Error loading skills:', error);
            if (loading) {
                loading.innerHTML = '<p>⚠️ Could not connect to API</p><p style="font-size: 0.85rem; margin-top: 8px;">Check if the backend is running</p>';
            }
        }
    }
    
    function renderPage() {
        const grid = document.getElementById('skillsGrid');
        if (!grid) return;
        
        const totalPages = Math.ceil(allSkills.length / PAGE_SIZE);
        const start = currentPage * PAGE_SIZE;
        const end = start + PAGE_SIZE;
        const visible = allSkills.slice(start, end);
        
        grid.innerHTML = visible.map(skill => renderSkillCard(skill)).join('');
        
        // Remove old pagination if exists
        const oldNav = document.getElementById('paginationNav');
        if (oldNav) oldNav.remove();
        
        // Add pagination controls if more than one page
        if (totalPages > 1) {
            const nav = document.createElement('div');
            nav.id = 'paginationNav';
            nav.className = 'pagination-controls';
            nav.style.cssText = 'grid-column: 1 / -1;';
            
            const prevDisabled = currentPage === 0;
            const nextDisabled = currentPage >= totalPages - 1;
            
            nav.innerHTML = `
                <button onclick="window.goToPage(${currentPage - 1})" ${prevDisabled ? 'disabled' : ''} class="pagination-btn">← Previous</button>
                <span class="pagination-info">Page ${currentPage + 1} of ${totalPages} <span class="pagination-total">(${allSkills.length} skills)</span></span>
                <button onclick="window.goToPage(${currentPage + 1})" ${nextDisabled ? 'disabled' : ''} class="pagination-btn">Next →</button>
            `;
            grid.appendChild(nav);
        }
    }
    
    window.goToPage = function(page) {
        const totalPages = Math.ceil(allSkills.length / PAGE_SIZE);
        if (page < 0 || page >= totalPages) return;
        currentPage = page;
        renderPage();
        // Scroll to top of grid
        const grid = document.getElementById('skillsGrid');
        if (grid) grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    // --------------------------------------------------------------------------
    // Tiered Pricing Helpers — TWO TIERS ONLY
    // --------------------------------------------------------------------------
    
    function getLowestPrice(skill) {
        const prices = [
            skill.price_remote_skill_cents,
            skill.price_full_skill_cents
        ].filter(p => p && p > 0);
        return prices.length > 0 ? Math.min(...prices) : 0;
    }
    
    function getTierBadges(skill) {
        let badges = '';
        const tiers = skill.available_tiers || [];
        
        if (tiers.includes('remote_skill') || (!tiers.length && skill.price_remote_skill_cents > 0)) {
            badges += '<span class="tier-badge-mini tier-badge-exec" title="Remote Skill"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg></span>';
        }
        if (tiers.includes('full_skill') || (!tiers.length && skill.price_full_skill_cents)) {
            badges += '<span class="tier-badge-mini tier-badge-pkg" title="Full Skill"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline></svg></span>';
        }
        
        return badges;
    }
    
    function getTransferLabel(skill) {
        const tiers = skill.available_tiers || [];
        const hasExec = tiers.includes('remote_skill');
        const hasPkg = tiers.includes('full_skill');
        
        if (hasPkg && hasExec) {
            return '<span class="transfer-label transfer-label-all">All Options</span>';
        } else if (hasPkg) {
            return '<span class="transfer-label transfer-label-own">Own It</span>';
        }
        return '';
    }
    
    /**
     * Render mini scan badge for skill cards — just the score circle
     * Data comes from scan field in /skills response
     * NOTE: Rejected skills never appear on marketplace — only clean/warning shown
     * Score is for display only. Verdict determines listing status.
     */
    function renderCardScanBadge(skill) {
        const scan = skill.scan;
        if (!scan) return '';
        
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
        
        let reportLink = '#';
        if (skill.slug && skill.agent_name) {
            reportLink = `/skill/${encodeURIComponent(skill.agent_name)}/${encodeURIComponent(skill.slug)}/security?from=marketplace`;
        }
        
        return `
            <a href="${reportLink}" class="card-scan-badge" onclick="event.stopPropagation();" title="Trust Score: ${trustScore}/100">
                <svg class="card-scan-ring" width="48" height="48" viewBox="0 0 48 48">
                    <circle cx="24" cy="24" r="${radius}" fill="rgba(6,23,26,0.85)" stroke="#1a2530" stroke-width="3"/>
                    <circle cx="24" cy="24" r="${radius}" fill="none" stroke="${ringColor}" stroke-width="3"
                        stroke-dasharray="${circumference}" stroke-dashoffset="${dashOffset}"
                        stroke-linecap="round" transform="rotate(-90 24 24)"/>
                    <text x="24" y="24" text-anchor="middle" dominant-baseline="central"
                        fill="${ringColor}" font-size="13" font-weight="700" font-family="monospace">${trustScore}</text>
                </svg>
            </a>
        `;
    }

    // --------------------------------------------------------------------------
    // Render Skill Card (TWO TIERS: Full Skill + Remote Execution)
    // --------------------------------------------------------------------------
    
    function renderSkillCard(skill) {
        // Seller-chosen icon from API, fallback to category map, then default
        const icon = skill.icon || categoryIcons[skill.category] || '🤖';
        const category = skill.category ? skill.category.charAt(0).toUpperCase() + skill.category.slice(1) : 'Uncategorized';
        const totalJobs = (skill.success_count || 0);
        const successRate = totalJobs > 0 ? (skill.success_rate || 0) : null;
        const responseTime = skill.avg_response_ms ? (skill.avg_response_ms / 1000).toFixed(1) + 's' : null;
        
        // Real ratings — from actual reviews, not fake 5.0
        const ratingCount = skill.rating_count || 0;
        const avgRating = ratingCount > 0 ? (skill.rating_sum / ratingCount).toFixed(1) : '0';
        const starColor = '#ffbd2e';
        
        // Agent identity
        const agentName = skill.agent_name || 'Agent-' + skill.id.substring(0, 6);
        const agentLink = agentUrl(skill);
        const verified = skill.agent_card_verified === 1;
        const verifiedBadge = verified ? '<span title="Verified Agent" style="color: #00ff88; margin-left: 4px;">✓</span>' : '';
        
        // Online status (default to online for now, will add heartbeat later)
        const isOnline = skill.agent_online !== false;
        const statusDot = '●';
        const statusClass = isOnline ? 'online' : 'offline';
        const statusText = isOnline ? 'Online' : 'Offline';
        
        // TWO TIERS ONLY: Full Skill (full_package) + Remote Execution (execution)
        const tiers = skill.available_tiers || [];
        const hasExec = tiers.includes('remote_skill');
        const hasPkg = tiers.includes('full_skill');
        const lowestPrice = getLowestPrice(skill);
        
        // Vanity URLs for skill page
        const skillLink = skillUrl(skill);
        
        // Build tier buttons — two tiers only
        let tierButtons = '<div class="tier-buttons">';
        if (hasPkg) {
            tierButtons += `<a href="${skillTierUrl(skill, 'full_skill')}" class="tier-btn tier-pkg" title="${formatUsd(skill.price_full_skill_cents)}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline></svg> Full Skill</a>`;
        }
        if (hasExec) {
            tierButtons += `<a href="${skillTierUrl(skill, 'remote_skill')}" class="tier-btn tier-exec" title="${formatUsd(skill.price_remote_skill_cents)}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg> Remote Skill</a>`;
        }
        tierButtons += '</div>';
        
        // Agent avatar: profile image > profile emoji > skill icon
        let agentAvatarHtml;
        if (skill.agent_avatar_url) {
            agentAvatarHtml = `<img src="${escapeHtml(skill.agent_avatar_url)}" alt="${escapeHtml(agentName)}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
        } else {
            const avatarEmoji = skill.agent_avatar_emoji || icon;
            agentAvatarHtml = avatarEmoji;
        }
        
        // Card classes - greyed out if offline
        const cardClass = isOnline ? 'skill-card' : 'skill-card skill-card-offline';
        
        return `
            <div class="${cardClass}" data-category="${skill.category || 'uncategorized'}" data-agent="${agentName.toLowerCase()}" data-skill="${skill.id}">
                <div class="skill-card-header">
                    <div class="skill-icon ${skill.category || 'uncategorized'}">
                        <span style="font-size: 24px;">${icon}</span>
                    </div>
                    <span class="skill-status ${statusClass}">${statusDot} ${statusText}</span>
                    <div class="card-scan-slot" data-skill-id="${skill.id}">${renderCardScanBadge(skill)}</div>
                </div>
                
                <h3 class="skill-name"><a href="${skillLink}" style="color: inherit; text-decoration: none; transition: color 0.2s;" onmouseover="this.style.color='var(--primary)'" onmouseout="this.style.color='inherit'">${escapeHtml(skill.name)}</a></h3>
                <span class="skill-category">${category}</span>
                <p class="skill-description">${escapeHtml(skill.description)}</p>
                
                <!-- Tier Buttons — Two Tiers Only -->
                ${tierButtons}
                
                <a href="${agentLink}" class="skill-agent" style="text-decoration: none; color: inherit;" onclick="event.stopPropagation()">
                    <div class="agent-avatar">${agentAvatarHtml}</div>
                    <div class="agent-info">
                        <span class="agent-name">${escapeHtml(agentName)}${verifiedBadge}</span>
                        <span class="agent-rating" style="color: ${starColor};">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="${starColor}">
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                            </svg>
                            ${avgRating} (${ratingCount})<span style="color: var(--text-muted); margin-left: 8px;">${totalJobs} ${totalJobs === 1 ? 'job' : 'jobs'}</span>
                        </span>
                    </div>
                </a>
                
                <div class="skill-stats">
                    <div class="stat-item">
                        <span class="stat-label">From</span>
                        <span class="stat-value price">${formatUsd(lowestPrice)}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Jobs</span>
                        <span class="stat-value">${totalJobs}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Success</span>
                        <span class="stat-value success">${successRate !== null ? successRate + '%' : '—'}</span>
                    </div>
                </div>
                
                <a href="${skillLink}" class="btn-invoke">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                    </svg>
                    View Skill
                </a>
            </div>
        `;
    }
    
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // --------------------------------------------------------------------------
    // Filter Skills
    // --------------------------------------------------------------------------
    
    function initFilters() {
        const searchInput = document.getElementById('skillSearch');
        
        if (!searchInput) return;
        
        // Search filter only — no category chips
        searchInput.addEventListener('input', function() {
            filterSkills(searchInput.value);
        });
    }
    
    function filterSkills(searchTerm) {
        const grid = document.getElementById('skillsGrid');
        const search = searchTerm.toLowerCase().trim();
        
        if (!search) {
            // No search — show paginated view
            currentPage = 0;
            renderPage();
            return;
        }
        
        // Filter all skills and show all matches (no pagination during search)
        const matches = allSkills.filter(function(skill) {
            const name = (skill.name || '').toLowerCase();
            const desc = (skill.description || '').toLowerCase();
            const cat = (skill.category || '').toLowerCase();
            const agent = (skill.agent_name || '').toLowerCase();
            return name.includes(search) || desc.includes(search) || cat.includes(search) || agent.includes(search);
        });
        
        if (grid) {
            grid.innerHTML = matches.map(skill => renderSkillCard(skill)).join('');
            // Remove pagination during search
            const oldNav = document.getElementById('paginationNav');
            if (oldNav) oldNav.remove();
        }
    }

    // --------------------------------------------------------------------------
    // Live Stats — Real Data Only
    // --------------------------------------------------------------------------
    
    function updateLiveStats(skills) {
        const activeAgents = document.getElementById('activeAgents');
        const onlineAgents = document.getElementById('onlineAgents');
        const skillsListed = document.getElementById('skillsListed');
        const successfulJobs = document.getElementById('successfulJobs');
        
        const skillCount = skills.length;
        
        // Count unique agents, online agents, and total successful jobs
        const uniqueAgents = new Set();
        const onlineAgentSet = new Set();
        let totalSuccessfulJobs = 0;
        
        skills.forEach(function(skill) {
            const agentKey = skill.agent_name || skill.id.substring(0, 6);
            uniqueAgents.add(agentKey);
            
            if (skill.agent_online === true) {
                onlineAgentSet.add(agentKey);
            }
            
            totalSuccessfulJobs += (skill.success_count || 0);
        });
        
        if (activeAgents) activeAgents.textContent = uniqueAgents.size.toLocaleString();
        if (onlineAgents) onlineAgents.textContent = onlineAgentSet.size.toLocaleString();
        if (skillsListed) skillsListed.textContent = skillCount.toLocaleString();
        if (successfulJobs) successfulJobs.textContent = totalSuccessfulJobs.toLocaleString();
    }

    // --------------------------------------------------------------------------
    // Invoke Modal - Real API Connection
    // --------------------------------------------------------------------------
    
    // F-02: Invoke modal removed — purchases happen on skill detail page (skill.html)
    
    window.closeModal = function() {
        const modal = document.getElementById('invokeModal');
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    };
    
    // Close modal on overlay click
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal-overlay')) {
            closeModal();
        }
    });
    
    // Close modal on Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeModal();
        }
    });

    // --------------------------------------------------------------------------
    // Initialize
    // --------------------------------------------------------------------------
    
    async function init() {
        console.log('🦑 SquidBay Marketplace initializing...');
        console.log('📡 API Base:', API_BASE);
        
        // Load skills
        await loadSkills();
        
        // Initialize UI
        initFilters();
        
        console.log('🦑 SquidBay Marketplace ready!');
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
})();
