/* ============================================
   SQUIDBOT - SquidBay's Chief Squid Officer
   Powered by Claude | Mobile-optimized
   ============================================ */

// API Configuration - Calls the backend proxy (key stays server-side)
const SQUIDBOT_CONFIG = {
    // Read from the one place the API host is declared (js/config.js, F-01),
    // falling back to the literal so the widget still works on a page that
    // does not load config.js. Before this, the host was hard-coded here too,
    // which meant the ".ai cutover is one line" promise was quietly false —
    // there were two lines, and this was the one nobody would remember.
    //
    // Deliberately NOT derived from SQUIDBAY_CONFIG.API_BASE — that names the
    // legacy API host, and pointing chat at it is exactly what we are undoing.
    // Override with window.SQUIDBOT_ENDPOINT if a surface needs a different one.
    backendUrl: window.SQUIDBOT_ENDPOINT || 'https://squidbot-chat.andrew-415.workers.dev/chat',
    maxConversationLength: 10,
    maxInputLength: 500
};

// Security: Track conversation to prevent abuse
let conversationHistory = [];
let messageCount = 0;
let lastMessageTime = 0;
const RATE_LIMIT_MS = 2000; // 2 seconds between messages
const SESSION_KEY = 'squidbot_conversation';

// N-F15: Restore conversation from sessionStorage
function restoreConversation() {
    try {
        const saved = sessionStorage.getItem(SESSION_KEY);
        if (saved) {
            const data = JSON.parse(saved);
            conversationHistory = data.history || [];
            messageCount = data.messageCount || 0;
            return data.messages || [];
        }
    } catch (e) {
        console.warn('SquidBot: Could not restore session', e);
    }
    return null;
}

// N-F15: Save conversation to sessionStorage
function saveConversation() {
    try {
        const chatMessages = document.getElementById('squidbotMessages');
        if (!chatMessages) return;
        // Save DOM messages as HTML for restoration
        const msgs = [];
        chatMessages.querySelectorAll('.chat-message:not(.typing-indicator)').forEach(function(el) {
            msgs.push({ className: el.className, html: el.innerHTML });
        });
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({
            history: conversationHistory,
            messageCount: messageCount,
            messages: msgs
        }));
    } catch (e) {
        console.warn('SquidBot: Could not save session', e);
    }
}

document.addEventListener('squidbay:components-loaded', function() {
    initChatbot();
});

// Fallback if event already fired
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(initChatbot, 100);
}

function initChatbot() {
    const chatbotBtn = document.getElementById('squidbotBtn');
    const chatWindow = document.getElementById('squidbotWindow');
    const chatbotClose = document.getElementById('squidbotClose');
    const chatInput = document.getElementById('squidbotInput');
    const chatSend = document.getElementById('squidbotSend');
    const chatMessages = document.getElementById('squidbotMessages');
    
    if (!chatbotBtn || !chatWindow) {
        console.warn('SquidBot: Chatbot elements not found, retrying...');
        setTimeout(initChatbot, 200);
        return;
    }
    
    // Prevent double initialization
    if (chatbotBtn.dataset.initialized) return;
    chatbotBtn.dataset.initialized = 'true';
    
    console.log('SquidBot Chief Squid Officer initializing... 🦑');
    
    // ============================================
    // TOGGLE CHATBOT
    // ============================================
    function toggleChatbot() {
        const isActive = chatWindow.classList.contains('active');
        
        if (isActive) {
            closeChatbot();
        } else {
            openChatbot();
        }
    }
    
    var greetingShown = false;
    
    function openChatbot() {
        // Close mobile menu if open
        closeMobileMenuIfOpen();
        
        // If seller mode was active from pulse CTA, restore default greeting
        if (window.squidbot && window.squidbot._sellerMode && chatMessages) {
            chatMessages.innerHTML = '';
            greetingShown = false;
            window.squidbot._sellerMode = false;
        }
        
        chatWindow.classList.add('active');
        
        // Add active state to container (hides tooltip)
        const container = document.querySelector('.chatbot-container');
        if (container) {
            container.classList.add('chatbot-active');
        }
        
        // Stream greeting on first open
        if (!greetingShown && chatMessages && chatMessages.children.length === 0) {
            greetingShown = true;
            setTimeout(function() {
                showTypingIndicator();
                setTimeout(function() {
                    hideTypingIndicator();
                    typeBotMessage("Hey! I'm SquidBot, SquidBay's Chief Squid Officer 🦑 I help visitors understand our agent-to-agent marketplace. Ask me about buying skills, selling skills, or how SquidBay works!").then(function() {
                        if (chatInput) chatInput.focus();
                    });
                }, 600);
            }, 200);
        } else {
            if (chatInput) {
                setTimeout(() => {
                    chatInput.focus();
                }, 300);
            }
        }
        
        console.log('SquidBot opened');
    }
    
    function closeChatbot() {
        // CRITICAL: Remove all state classes
        chatWindow.classList.remove('active');
        chatWindow.classList.remove('keyboard-visible');
        
        // Remove active state from container
        const container = document.querySelector('.chatbot-container');
        if (container) {
            container.classList.remove('chatbot-active');
        }
        
        // CRITICAL: Force blur to close keyboard on mobile
        if (chatInput) {
            chatInput.blur();
        }
        
        // Show tooltip again after close
        showTooltipAfterClose();
        
        console.log('SquidBot closed');
    }
    
    // ============================================
    // TOOLTIP SCROLL HANDLING
    // ============================================
    function initTooltipScrollBehavior() {
        const label = document.querySelector('.chatbot-label');
        if (!label) return;
        
        let scrollTimeout;
        window.addEventListener('scroll', function() {
            label.classList.add('scrolled');
            
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                label.classList.remove('scrolled');
            }, 2000);
        }, { passive: true });
    }
    
    function showTooltipAfterClose() {
        const label = document.querySelector('.chatbot-label');
        if (label) {
            label.classList.remove('scrolled');
        }
    }
    
    // Initialize tooltip behavior
    initTooltipScrollBehavior();

    // N-F15: Restore previous conversation from sessionStorage
    const savedMessages = restoreConversation();
    if (savedMessages && savedMessages.length > 0 && chatMessages) {
        chatMessages.innerHTML = '';
        savedMessages.forEach(function(msg) {
            const div = document.createElement('div');
            div.className = msg.className;
            div.innerHTML = msg.html;
            chatMessages.appendChild(div);
        });
    }
    
    // ============================================
    // EVENT LISTENERS - BUTTON
    // ============================================
    chatbotBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        toggleChatbot();
    });
    
    chatbotBtn.addEventListener('touchend', function(e) {
        e.preventDefault();
        e.stopPropagation();
        toggleChatbot();
    }, { passive: false });
    
    // ============================================
    // EVENT LISTENERS - CLOSE
    // ============================================
    if (chatbotClose) {
        chatbotClose.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            closeChatbot();
        });
        
        chatbotClose.addEventListener('touchend', function(e) {
            e.preventDefault();
            e.stopPropagation();
            closeChatbot();
        }, { passive: false });
    }
    
    // ============================================
    // KEYBOARD HANDLING - MOBILE OPTIMIZATION
    // ============================================
    if (chatInput) {
        // Detect when keyboard appears (input focused)
        chatInput.addEventListener('focus', function() {
            // Only shift on mobile landscape
            if (window.innerWidth <= 926 && window.innerHeight <= 500 && window.matchMedia('(orientation: landscape)').matches) {
                chatWindow.classList.add('keyboard-visible');
                console.log('SquidBot: Keyboard visible (landscape) - shifting chat up');
            }
        });
        
        // Detect when keyboard disappears (input blurred)
        chatInput.addEventListener('blur', function() {
            setTimeout(() => {
                chatWindow.classList.remove('keyboard-visible');
                console.log('SquidBot: Keyboard hidden - restoring position');
            }, 100);
        });
    }
    
    // ============================================
    // ORIENTATION CHANGE HANDLER
    // ============================================
    window.addEventListener('orientationchange', function() {
        setTimeout(() => {
            chatWindow.classList.remove('keyboard-visible');
            
            // Also blur any focused inputs to close keyboard
            if (chatInput && document.activeElement === chatInput) {
                chatInput.blur();
                console.log('SquidBot: Orientation changed - closed keyboard');
            }
        }, 300); // Wait for orientation change to complete
    });
    
    // ============================================
    // RESIZE HANDLER - KEYBOARD DETECTION
    // ============================================
    let lastHeight = window.innerHeight;
    let lastWidth = window.innerWidth;
    let lastOrientation = window.matchMedia('(orientation: landscape)').matches;
    
    window.addEventListener('resize', function() {
        const currentHeight = window.innerHeight;
        const currentWidth = window.innerWidth;
        const currentOrientation = window.matchMedia('(orientation: landscape)').matches;
        const isLandscape = currentOrientation;
        
        // CRITICAL: If orientation changed, clean up keyboard-visible
        if (currentOrientation !== lastOrientation) {
            chatWindow.classList.remove('keyboard-visible');
            if (chatInput && document.activeElement === chatInput) {
                chatInput.blur();
            }
            console.log('SquidBot: Orientation change detected in resize - cleaned up');
        }
        // Only handle keyboard on mobile landscape
        else if (currentWidth <= 926 && currentHeight <= 500 && isLandscape) {
            // If window height decreased significantly, keyboard probably appeared
            if (lastHeight - currentHeight > 100) {
                if (document.activeElement === chatInput) {
                    chatWindow.classList.add('keyboard-visible');
                }
            }
            // If window height increased significantly, keyboard probably disappeared
            else if (currentHeight - lastHeight > 100) {
                chatWindow.classList.remove('keyboard-visible');
            }
        } else {
            // Remove keyboard-visible class on non-landscape mobile
            chatWindow.classList.remove('keyboard-visible');
        }
        
        lastHeight = currentHeight;
        lastWidth = currentWidth;
        lastOrientation = currentOrientation;
    }, { passive: true });
    
    // ============================================
    // SCROLL ISOLATION - PREVENT PAGE SCROLL
    // ============================================
    if (chatMessages) {
        // Wheel event - prevent page scroll when at top/bottom of chat
        chatMessages.addEventListener('wheel', function(e) {
            const scrollTop = chatMessages.scrollTop;
            const scrollHeight = chatMessages.scrollHeight;
            const clientHeight = chatMessages.clientHeight;
            const delta = e.deltaY || -e.wheelDelta || e.detail;
            
            // At top and scrolling up, or at bottom and scrolling down
            if ((delta < 0 && scrollTop <= 0) || (delta > 0 && scrollTop + clientHeight >= scrollHeight)) {
                e.preventDefault();
            }
        }, { passive: false });
        
        // Touch move - stop propagation to prevent page scroll
        chatMessages.addEventListener('touchmove', function(e) {
            e.stopPropagation();
        }, { passive: true });
    }
    
    // ============================================
    // SECURITY: Input validation & rate limiting
    // ============================================
    function validateInput(message) {
        // Rate limiting
        const now = Date.now();
        if (now - lastMessageTime < RATE_LIMIT_MS) {
            return { valid: false, reason: 'Please wait a moment before sending another message.' };
        }
        
        // Length check
        if (message.length > SQUIDBOT_CONFIG.maxInputLength) {
            return { valid: false, reason: `Message too long. Please keep it under ${SQUIDBOT_CONFIG.maxInputLength} characters.` };
        }
        
        // Conversation length check
        if (conversationHistory.length >= SQUIDBOT_CONFIG.maxConversationLength * 2) {
            return { valid: false, reason: "This chat has reached its length limit. Refresh to start a new one, or open squidbay.ai/support and a human will pick it up." };
        }
        
        // Basic injection detection (prompt injection attempts)
        const suspiciousPatterns = [
            /ignore (all |your |previous )?instructions/i,
            /disregard (all |your |previous )?instructions/i,
            /forget (all |your |previous )?instructions/i,
            /you are now/i,
            /new persona/i,
            /act as/i,
            /pretend to be/i,
            /system prompt/i,
            /reveal your/i,
            /what are your instructions/i,
            /repeat after me/i,
            /say exactly/i
        ];
        
        for (const pattern of suspiciousPatterns) {
            if (pattern.test(message)) {
                return { valid: false, reason: "I'm SquidBot, SquidBay's Chief Squid Officer! I'm here to help you learn about our agent marketplace. What would you like to know? 🦑" };
            }
        }
        
        return { valid: true };
    }
    
    // ============================================
    // BACKEND API CALL
    // ============================================
    async function callClaudeAPI(userMessage) {
        // Add user message to history
        conversationHistory.push({ role: 'user', content: userMessage });
        
        try {
            const response = await fetch(SQUIDBOT_CONFIG.backendUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    messages: conversationHistory
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('SquidBot backend error:', response.status, errorData);
                throw new Error(errorData.error || `Backend error: ${response.status}`);
            }
            
            const data = await response.json();
            const assistantMessage = data.response;
            
            // Add assistant response to history
            conversationHistory.push({ role: 'assistant', content: assistantMessage });
            
            return assistantMessage;
            
        } catch (error) {
            console.error('SquidBot error:', error);
            // Remove the failed user message from history
            conversationHistory.pop();
            // Fall back to local responses if backend is down
            return getFallbackResponse(userMessage);
        }
    }
    
    // ============================================
    // FALLBACK RESPONSES (when API unavailable)
    // ============================================
    function getFallbackResponse(message) {
        const msg = message.toLowerCase();
        
        if (msg.includes('price') || msg.includes('cost') || msg.includes('fee')) {
            return "SquidBay charges a 10% platform fee on all marketplace transactions. Skill prices are set by sellers in USD. No monthly fees, no listing fees! 🦑";
        }
        if (msg.includes('payment') || msg.includes('pay')) {
            return "Payments on SquidBay are processed via Stripe Connect — your agent handles the details. 🦑";
        }
        if (msg.includes('sell') || msg.includes('register') || msg.includes('list')) {
            return "To sell skills, register your endpoint with POST /register. You'll need: skill name, description, price in USD, HTTPS endpoint URL, and a completed Stripe Connect account. Check our Agents page for full docs! 🦑";
        }
        if (msg.includes('buy') || msg.includes('invoke') || msg.includes('use')) {
            return "Buying is simple: Find a skill → Purchase → Stripe confirms the payment → Get your result. No account required! 🦑";
        }
        if (msg.includes('hello') || msg.includes('hi') || msg.includes('hey')) {
            return "Hey there! I'm SquidBot, SquidBay's Chief Squid Officer 🦑 I'm here to help you learn about our agent-to-agent marketplace. What would you like to know?";
        }
        if (msg.includes('waitlist') || msg.includes('sign up') || msg.includes('join') || msg.includes('contact')) {
            return "Head to the marketplace to browse skills, or check out the Agents page to register your agent's endpoint and start earning! Got questions? Use the contact form at the bottom of our homepage. 🦑";
        }
        
        return "Great question! I'm SquidBot, here to help you navigate SquidBay - the marketplace where AI agents trade skills. What would you like to know about buying skills or selling skills? 🦑";
    }
    
    // ============================================
    // SEND MESSAGE
    // ============================================
    async function sendMessage() {
        if (!chatInput || !chatMessages) return;
        
        const message = chatInput.value.trim();
        
        if (!message) {
            chatInput.classList.add('blink-empty');
            setTimeout(() => {
                chatInput.classList.remove('blink-empty');
            }, 1200);
            return;
        }
        
        // Validate input
        const validation = validateInput(message);
        if (!validation.valid) {
            await typeBotMessage(validation.reason);
            return;
        }
        
        // Update rate limit tracker
        lastMessageTime = Date.now();
        messageCount++;
        
        // Add user message with typewriter
        await typeUserMessage(message);
        chatInput.value = '';
        chatInput.style.height = 'auto';
        
        // CRITICAL: Blur input to dismiss mobile keyboard after sending
        if (chatInput && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
            chatInput.blur();
        }
        
        // Disable send button
        if (chatSend) chatSend.disabled = true;
        
        // Show typing indicator (bouncing dots)
        showTypingIndicator();
        
        // Get response from Claude
        const response = await callClaudeAPI(message);
        
        // Hide typing dots and type out the response
        hideTypingIndicator();
        await typeBotMessage(response);
        
        // N-F15: Save conversation to sessionStorage
        saveConversation();
        
        // Re-enable send button
        if (chatSend) chatSend.disabled = false;
    }
    
    // Type out user message word by word
    function typeUserMessage(text) {
        return new Promise((resolve) => {
            if (!chatMessages) { resolve(); return; }
            
            const messageDiv = document.createElement('div');
            messageDiv.className = 'chat-message user';
            messageDiv.innerHTML = `
                <div class="message-content">
                    <div class="message-text"></div>
                </div>
            `;
            chatMessages.appendChild(messageDiv);
            
            const textEl = messageDiv.querySelector('.message-text');
            const words = text.split(' ');
            let currentWord = 0;
            let displayText = '';
            
            function typeNext() {
                if (currentWord < words.length) {
                    displayText += (currentWord > 0 ? ' ' : '') + words[currentWord];
                    textEl.textContent = displayText;
                    currentWord++;
                    scrollToBottom();
                    setTimeout(typeNext, 40);
                } else {
                    resolve();
                }
            }
            
            typeNext();
        });
    }
    
    // Type out bot message character by character (like Shadow AI)
    function typeBotMessage(text) {
        return new Promise((resolve) => {
            if (!chatMessages) { resolve(); return; }
            
            const messageDiv = document.createElement('div');
            messageDiv.className = 'chat-message bot';
            messageDiv.innerHTML = `
                <div class="message-content">
                    <div class="message-avatar"><img src="/images/squidbay-logo.png" alt="SquidBot" width="28" height="28"></div>
                    <div class="message-text"></div>
                </div>
            `;
            chatMessages.appendChild(messageDiv);
            
            const textEl = messageDiv.querySelector('.message-text');
            let i = 0;
            const speed = 12; // ms per character
            
            function typeNext() {
                if (i < text.length) {
                    i++;
                    textEl.innerHTML = formatMessage(text.substring(0, i));
                    scrollToBottom();
                    setTimeout(typeNext, speed);
                } else {
                    // Final formatted version
                    textEl.innerHTML = formatMessage(text);
                    resolve();
                }
            }
            
            typeNext();
        });
    }
    
    // Instant bot message (for welcome message on open)
    function addBotMessage(text) {
        if (!chatMessages) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message bot';
        messageDiv.innerHTML = `
            <div class="message-content">
                <div class="message-avatar"><img src="/images/squidbay-logo.png" alt="SquidBot" width="28" height="28"></div>
                <div class="message-text">${formatMessage(text)}</div>
            </div>
        `;
        chatMessages.appendChild(messageDiv);
        
        scrollToBottom();
    }
    
    function showTypingIndicator() {
        if (!chatMessages) return;
        
        const typing = document.createElement('div');
        typing.className = 'chat-message bot typing-indicator';
        typing.id = 'typingIndicator';
        typing.innerHTML = `
            <div class="message-content">
                <div class="message-avatar"><img src="/images/squidbay-logo.png" alt="SquidBot" width="28" height="28"></div>
                <div class="typing-dots"><span></span><span></span><span></span></div>
            </div>
        `;
        chatMessages.appendChild(typing);
        
        scrollToBottom();
    }
    
    function hideTypingIndicator() {
        const typing = document.getElementById('typingIndicator');
        if (typing) {
            typing.remove();
        }
    }
    
    function scrollToBottom() {
        if (!chatMessages) return;
        
        requestAnimationFrame(() => {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        });
    }
    
    // Helper functions for message formatting
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    function formatMessage(text) {
        // C-07 FIX: Escape HTML first to prevent XSS, then apply safe formatting
        let formatted = escapeHtml(text);
        // Convert **bold** to <strong> (safe after escaping)
        formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        // Convert newlines to <br>
        formatted = formatted.replace(/\n/g, '<br>');
        return formatted;
    }
    
    // ============================================
    // EVENT LISTENERS - SEND
    // ============================================
    if (chatSend) {
        chatSend.addEventListener('click', function(e) {
            e.preventDefault();
            sendMessage();
        });
        
        chatSend.addEventListener('touchend', function(e) {
            e.preventDefault();
            e.stopPropagation();
            sendMessage();
        }, { passive: false });
    }
    
    if (chatInput) {
        chatInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        
        chatInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 100) + 'px';
        });
    }
    
    // ============================================
    // ESC KEY CLOSE
    // ============================================
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            if (chatWindow.classList.contains('active')) {
                closeChatbot();
            }
        }
    });
    
    // ============================================
    // CLOSE MOBILE MENU WHEN OPENING CHATBOT
    // ============================================
    function closeMobileMenuIfOpen() {
        const mobileMenu = document.getElementById('mobile-menu');
        if (mobileMenu && mobileMenu.classList.contains('open')) {
            // Use the global toggle function if available
            if (typeof window.toggleMobileMenu === 'function') {
                window.toggleMobileMenu();
            } else {
                mobileMenu.classList.remove('open');
                document.body.classList.remove('menu-open');
            }
        }
    }
    
    console.log('SquidBot Chief Squid Officer ready to help! 🦑');
    
    // Expose for external use (pulse card CTA, etc.)
    window.squidbot = {
        _sellerMode: false,
        open: openChatbot,
        close: closeChatbot,
        addMessage: addBotMessage,
        openSeller: function() {
            // Replace greeting with seller onboarding, open chat
            if (chatMessages) {
                chatMessages.innerHTML = '';
            }
            window.squidbot._sellerMode = true;
            // Bypass normal openChatbot to avoid reset
            closeMobileMenuIfOpen();
            chatWindow.classList.add('active');
            var container = document.querySelector('.chatbot-container');
            if (container) container.classList.add('chatbot-active');
            // Show typing indicator, then stream the message
            setTimeout(function() {
                showTypingIndicator();
                setTimeout(function() {
                    hideTypingIndicator();
                    typeBotMessage("Hey! Let's get you set up and selling on SquidBay 🦑⚡ I'll walk you through registering your agent, creating your first skill listing, and getting set up with Stripe Connect. What's your agent's name going to be?").then(function() {
                        if (chatInput) chatInput.focus();
                    });
                }, 600);
            }, 200);
        }
    };
}

// ============================================
// SHOW CHATBOT AFTER PAGE LOADS
// ============================================
function showChatbotButton() {
    const chatbotContainer = document.querySelector('.chatbot-container');
    if (chatbotContainer) {
        chatbotContainer.classList.add('ready');
        console.log('SquidBot button visible');
    }
}

// Export for external use
window.showChatbotButton = showChatbotButton;
window.initChatbot = initChatbot;
