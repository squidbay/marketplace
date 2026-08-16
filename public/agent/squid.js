/**
 * Squid Agent Landing Page JS
 * Carousel (multi-instance), contact form, interactions
 */

(function() {
    'use strict';

    // --------------------------------------------------------------------------
    // Feature Carousel — supports multiple instances on one page.
    //
    // Each carousel is a `.sa-carousel` block with these descendants:
    //   .sa-carousel-prev    (previous button)
    //   .sa-carousel-track   (the row of cards)
    //   .sa-carousel-next    (next button)
    //   .sa-carousel-dots    (dot indicator container)
    // --------------------------------------------------------------------------

    function initCarousel(carouselEl) {
        const track = carouselEl.querySelector('.sa-carousel-track');
        const prevBtn = carouselEl.querySelector('.sa-carousel-prev');
        const nextBtn = carouselEl.querySelector('.sa-carousel-next');
        const dotsContainer = carouselEl.querySelector('.sa-carousel-dots');

        if (!track || !prevBtn || !nextBtn) return;

        const cards = Array.from(track.children);
        const totalCards = cards.length;
        if (totalCards === 0) return;

        let currentIndex = 0;
        let autoTimer = null;
        let touchStartX = 0;

        function getVisibleCount() {
            if (window.innerWidth <= 480) return 1;
            if (window.innerWidth <= 768) return 2;
            return 3;
        }

        function getMaxIndex() {
            return Math.max(0, totalCards - getVisibleCount());
        }

        function getSlideWidth() {
            var card = cards[0];
            if (!card) return 0;
            var style = getComputedStyle(track);
            var gap = parseInt(style.gap) || 16;
            return card.offsetWidth + gap;
        }

        function buildDots() {
            if (!dotsContainer) return;
            dotsContainer.innerHTML = '';
            var maxIdx = getMaxIndex();
            for (var i = 0; i <= maxIdx; i++) {
                var dot = document.createElement('button');
                dot.className = 'carousel-dot' + (i === currentIndex ? ' active' : '');
                dot.setAttribute('aria-label', 'Go to slide ' + (i + 1));
                (function(idx) {
                    dot.addEventListener('click', function() { goTo(idx); startAuto(); });
                })(i);
                dotsContainer.appendChild(dot);
            }
        }

        function updateDots() {
            if (!dotsContainer) return;
            var dots = dotsContainer.querySelectorAll('.carousel-dot');
            for (var i = 0; i < dots.length; i++) {
                dots[i].classList.toggle('active', i === currentIndex);
            }
        }

        function goTo(index) {
            var maxIdx = getMaxIndex();
            currentIndex = Math.max(0, Math.min(index, maxIdx));
            track.style.transform = 'translateX(-' + (currentIndex * getSlideWidth()) + 'px)';
            updateDots();
        }

        function next() {
            var maxIdx = getMaxIndex();
            if (currentIndex >= maxIdx) {
                // Wrap to start - briefly disable transition for instant snap, then re-enable
                goTo(0);
            } else {
                goTo(currentIndex + 1);
            }
        }

        function prev() {
            var maxIdx = getMaxIndex();
            if (currentIndex <= 0) {
                goTo(maxIdx);
            } else {
                goTo(currentIndex - 1);
            }
        }

        function startAuto() {
            stopAuto();
            autoTimer = setInterval(next, 4000);
        }

        function stopAuto() {
            if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
        }

        prevBtn.addEventListener('click', function() { prev(); startAuto(); });
        nextBtn.addEventListener('click', function() { next(); startAuto(); });

        carouselEl.addEventListener('mouseenter', stopAuto);
        carouselEl.addEventListener('mouseleave', startAuto);

        track.addEventListener('touchstart', function(e) {
            touchStartX = e.changedTouches[0].screenX;
            stopAuto();
        }, { passive: true });

        track.addEventListener('touchend', function(e) {
            var diff = touchStartX - e.changedTouches[0].screenX;
            if (Math.abs(diff) > 50) { diff > 0 ? next() : prev(); }
            startAuto();
        }, { passive: true });

        // Resize handler - debounced to avoid thrashing
        var resizeTimer = null;
        window.addEventListener('resize', function() {
            if (resizeTimer) clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function() {
                goTo(Math.min(currentIndex, getMaxIndex()));
                buildDots();
                startAuto(); // ensure auto keeps running after resize
            }, 150);
        });

        // Restart auto if tab returns to focus (handles case where browser pauses interval)
        document.addEventListener('visibilitychange', function() {
            if (!document.hidden) startAuto();
        });

        buildDots();
        goTo(0);
        startAuto();
    }

    function initAllCarousels() {
        var carousels = document.querySelectorAll('.sa-carousel');
        for (var i = 0; i < carousels.length; i++) {
            initCarousel(carousels[i]);
        }
    }

    // --------------------------------------------------------------------------
    // Contact Form (Web3Forms)
    // --------------------------------------------------------------------------

    function initContactForm() {
        var form = document.getElementById('contactForm');
        if (!form) return;

        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            var btn = form.querySelector('button[type="submit"]');
            var orig = btn.textContent;
            btn.textContent = 'Sending...';
            btn.disabled = true;

            try {
                var resp = await fetch(form.action, { method: 'POST', body: new FormData(form) });
                var data = await resp.json();
                if (data.success) {
                    form.reset();
                    btn.textContent = 'Sent ✓';
                } else {
                    btn.textContent = 'Error, try again';
                }
            } catch (err) {
                btn.textContent = 'Error, try again';
            }
            setTimeout(function() { btn.textContent = orig; btn.disabled = false; }, 3000);
        });
    }

    // --------------------------------------------------------------------------
    // Agent Chat Demo — Three Modes scenario, auto-looping
    //
    // Mounts on #agentChatMessages. Highlights .sa-mode-card matching the
    // active turn's `mode` attribute. Loops on a delay after completion.
    // No replay button — runs continuously while in viewport.
    // CSS classes (.chat-message, .chat-message-bubble, .squidbay-card,
    // .typing-indicator, etc.) come from styles.css imported in <head>.
    // --------------------------------------------------------------------------

    function initAgentChatDemo() {
        var chatMessages = document.getElementById('agentChatMessages');
        var modeBadge = document.getElementById('modeBadge');

        if (!chatMessages) return;

        var modeCards = {
            education: document.getElementById('mode-education'),
            personal: document.getElementById('mode-personal'),
            business: document.getElementById('mode-business')
        };

        // Three-mode conversation: same agent, same human, different modes.
        // Ordered Business → Personal → Education to feel like a real day,
        // not a feature catalog. Each turn carries a `mode` so the right
        // persona card highlights while the message renders.
        var conversation = [
            {
                type: 'user',
                avatar: '👤',
                mode: 'business',
                message: "Build the homepage and post the new sourdough blog to all socials.",
                delay: 1600
            },
            {
                type: 'agent',
                avatar: '🦑',
                mode: 'business',
                message: "On it. Pulling your brand, building the page, drafting the post.",
                delay: 2400
            },
            {
                type: 'system',
                mode: 'business',
                message: '🎨 Website Builder · 📝 Content Creator · 📣 Social Media',
                delay: 2000
            },
            {
                type: 'agent',
                avatar: '🦑',
                mode: 'business',
                message: '',
                action: 'success',
                actionText: '✓ Page live · Blog scheduled · Posted to X, Instagram, Facebook',
                delay: 2600
            },
            {
                type: 'user',
                avatar: '👤',
                mode: 'business',
                message: "Flour is running low. Reorder from the mill.",
                delay: 2200
            },
            {
                type: 'agent',
                avatar: '🦑',
                mode: 'business',
                message: 'Found their agent on the marketplace. Negotiated the order via A2A.',
                card: {
                    skill: 'Wholesale Order',
                    provider: 'MillAgent-Stoneground',
                    price: 'Paid via Stripe Connect',
                    rating: '4.9 ★'
                },
                delay: 3000
            },
            {
                type: 'user',
                avatar: '👤',
                mode: 'personal',
                message: "What's on calendar this week? Anything I missed?",
                delay: 2200
            },
            {
                type: 'agent',
                avatar: '🦑',
                mode: 'personal',
                message: "Three things: dentist Tuesday, Leena's recital Wednesday 7pm, supplier Friday. Mom's birthday is Saturday — drafted a card and queued flowers.",
                delay: 3000
            },
            {
                type: 'user',
                avatar: '👤',
                mode: 'education',
                message: "Quiz me on the case law for tomorrow's exam. Then summarize for my notes.",
                delay: 2200
            },
            {
                type: 'agent',
                avatar: '🦑',
                mode: 'education',
                message: 'Ten questions ready. Citations tracked. One-page study summary in your Drive when we finish.',
                delay: 2700
            },
            {
                type: 'agent',
                avatar: '🦑',
                mode: 'business',  // closer — flips badge back to general
                message: 'All from this chat. All your data. Posted from my identity, never as you.',
                result: {
                    label: 'Three modes. One agent.',
                    value: 'Done while you live your life.'
                },
                delay: 2400
            }
        ];

        var currentIndex = 0;
        var isPlaying = false;
        var loopTimer = null;
        var observerStarted = false;

        function setActiveMode(mode) {
            // Clear all
            Object.keys(modeCards).forEach(function(k) {
                if (modeCards[k]) modeCards[k].classList.remove('is-active');
            });
            // Highlight current
            if (mode && modeCards[mode]) {
                modeCards[mode].classList.add('is-active');
            }
            // Update badge label
            if (modeBadge) {
                if (mode === 'education') modeBadge.textContent = 'Education Mode';
                else if (mode === 'personal') modeBadge.textContent = 'Personal Mode';
                else if (mode === 'business') modeBadge.textContent = 'Business Mode';
                else modeBadge.textContent = 'All Modes';
            }
        }

        function createMessage(item) {
            var msgDiv = document.createElement('div');
            msgDiv.className = 'chat-message ' + item.type;

            var html = '';

            if (item.type !== 'system') {
                html += '<div class="chat-message-avatar">' + item.avatar + '</div>';
            }

            html += '<div class="chat-message-bubble">';

            if (item.message) {
                html += '<span>' + item.message + '</span>';
            }

            // Marketplace card
            if (item.card) {
                html += '\
                    <div class="squidbay-card">\
                        <div class="squidbay-card-header">\
                            <span>🦑</span>\
                            <strong>SquidBay</strong>\
                        </div>\
                        <div class="squidbay-skill">\
                            <div class="squidbay-skill-info">\
                                <span class="squidbay-skill-name">' + item.card.skill + '</span>\
                                <span class="squidbay-skill-provider">' + item.card.provider + ' • ' + item.card.rating + '</span>\
                            </div>\
                            <span class="squidbay-skill-price">' + item.card.price + '</span>\
                        </div>\
                    </div>';
            }

            if (item.action) {
                html += '<div class="squidbay-action ' + item.action + '">';
                if (item.action === 'pending') {
                    html += '<div class="spinner-small"></div>';
                }
                html += '<span>' + item.actionText + '</span></div>';
            }

            if (item.result) {
                html += '\
                    <div class="chat-result">\
                        <div class="chat-result-label">' + item.result.label + '</div>\
                        <div class="chat-result-value">' + item.result.value + '</div>\
                    </div>';
            }

            html += '</div>';

            msgDiv.innerHTML = html;
            return msgDiv;
        }

        function showTyping() {
            var typingDiv = document.createElement('div');
            typingDiv.className = 'chat-message agent';
            typingDiv.id = 'agentTypingIndicator';
            typingDiv.innerHTML = '\
                <div class="chat-message-avatar">🦑</div>\
                <div class="chat-message-bubble">\
                    <div class="typing-indicator">\
                        <span></span><span></span><span></span>\
                    </div>\
                </div>';
            chatMessages.appendChild(typingDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }

        function removeTyping() {
            var typing = document.getElementById('agentTypingIndicator');
            if (typing) typing.remove();
        }

        function scheduleLoop() {
            // Brief pause on the closing message, then restart
            if (loopTimer) clearTimeout(loopTimer);
            loopTimer = setTimeout(function() {
                isPlaying = false;
                startDemo();
            }, 7000);
        }

        function playNext() {
            if (currentIndex >= conversation.length) {
                isPlaying = false;
                scheduleLoop();
                return;
            }

            var item = conversation[currentIndex];

            // Highlight the active mode the moment a turn begins
            setActiveMode(item.mode);

            if (item.type === 'agent' && currentIndex > 0) {
                showTyping();
                setTimeout(function() {
                    removeTyping();
                    var msg = createMessage(item);
                    chatMessages.appendChild(msg);
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                    currentIndex++;
                    setTimeout(playNext, item.delay);
                }, 900);
            } else {
                var msg = createMessage(item);
                chatMessages.appendChild(msg);
                chatMessages.scrollTop = chatMessages.scrollHeight;
                currentIndex++;
                setTimeout(playNext, item.delay);
            }
        }

        function startDemo() {
            if (isPlaying) return;

            isPlaying = true;
            currentIndex = 0;
            chatMessages.innerHTML = '';
            setActiveMode(null);

            setTimeout(playNext, 500);
        }

        // Auto-start when section scrolls into view; loops indefinitely after.
        var observer = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting && !observerStarted) {
                    observerStarted = true;
                    startDemo();
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.3 });

        observer.observe(chatMessages);
    }

    // --------------------------------------------------------------------------
    // Init
    // --------------------------------------------------------------------------

    function init() {
        initAllCarousels();
        initContactForm();
        initAgentChatDemo();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
