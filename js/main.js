/**
 * SquidBay - Main JavaScript
 * Where AI Agents Trade Skills
 * ================================
 */

(function() {
    'use strict';

    // --------------------------------------------------------------------------
    // Scroll Animations
    // --------------------------------------------------------------------------
    
    function initScrollAnimations() {
        const fadeElements = document.querySelectorAll('.fade-in');
        
        if (!fadeElements.length) return;
        
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };
        
        const observer = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                }
            });
        }, observerOptions);
        
        fadeElements.forEach(function(el) {
            observer.observe(el);
        });
    }

    // --------------------------------------------------------------------------
    // Mobile Menu (Slides from Right)
    // --------------------------------------------------------------------------
    
    function initMobileMenu() {
        const menuBtn = document.querySelector('.mobile-menu-btn');
        const mobileMenu = document.getElementById('mobile-menu');
        const navLinks = document.querySelector('.nav-links');
        
        // New slide-from-right menu
        if (menuBtn && mobileMenu) {
            console.log('Mobile menu (slide-right) initialized');
            
            menuBtn.addEventListener('click', function(e) {
                e.preventDefault();
                window.toggleMobileMenu();
            });
            
            // Close menu when any link inside is tapped
            mobileMenu.querySelectorAll('a').forEach(function(link) {
                link.addEventListener('click', function() {
                    // Always close — don't toggle
                    if (mobileMenu.classList.contains('open')) {
                        window.toggleMobileMenu();
                    }
                });
            });
            return;
        }
        
        // Fallback for old-style menu
        if (!menuBtn || !navLinks) {
            console.log('Mobile menu elements not found');
            return;
        }
        
        console.log('Mobile menu (fallback) initialized');
        
        menuBtn.addEventListener('click', function(e) {
            e.preventDefault();
            navLinks.classList.toggle('mobile-open');
        });
        
        // Close menu on link click
        navLinks.querySelectorAll('a').forEach(function(link) {
            link.addEventListener('click', function() {
                if (window.innerWidth <= 768) {
                    navLinks.classList.remove('mobile-open');
                }
            });
        });
        
        // Close menu on resize to desktop
        window.addEventListener('resize', function() {
            if (window.innerWidth > 768) {
                navLinks.classList.remove('mobile-open');
            }
        });
    }
    
    // Global toggle function for mobile menu
    window.toggleMobileMenu = window.toggleMobileMenu || function() {
        const menu = document.getElementById('mobile-menu');
        const body = document.body;
        
        if (menu) {
            menu.classList.toggle('open');
            body.classList.toggle('menu-open');
        }
    };

    // --------------------------------------------------------------------------
    // Smooth Scroll for Anchor Links
    // --------------------------------------------------------------------------
    
    function initSmoothScroll() {
        document.querySelectorAll('a[href^="#"]').forEach(function(anchor) {
            anchor.addEventListener('click', function(e) {
                const targetId = this.getAttribute('href');
                
                if (targetId === '#') return;
                
                const targetElement = document.querySelector(targetId);
                
                if (targetElement) {
                    e.preventDefault();
                    
                    const nav = document.querySelector('nav');
                    const navHeight = nav ? nav.offsetHeight : 0;
                    const targetPosition = targetElement.getBoundingClientRect().top + window.pageYOffset - navHeight;
                    
                    window.scrollTo({
                        top: targetPosition,
                        behavior: 'smooth'
                    });
                }
            });
        });
    }

    // --------------------------------------------------------------------------
    // Nav Background on Scroll
    // --------------------------------------------------------------------------
    
    function initNavScroll() {
        const nav = document.querySelector('nav');
        
        if (!nav) return;
        
        window.addEventListener('scroll', function() {
            const currentScroll = window.pageYOffset;
            
            if (currentScroll > 50) {
                nav.style.background = 'rgba(10, 14, 20, 0.98)';
                nav.style.backdropFilter = 'blur(10px)';
                nav.style.webkitBackdropFilter = 'blur(10px)';
                nav.style.borderBottom = '1px solid var(--border-subtle)';
            } else {
                nav.style.background = 'var(--black)';
                nav.style.backdropFilter = 'none';
                nav.style.webkitBackdropFilter = 'none';
                nav.style.borderBottom = 'none';
            }
        });
    }

    // Note: Tentacle parallax and Chat Demo moved to js/index.js

    // --------------------------------------------------------------------------
    // Scroll Progress Bar (defers to components.js if already initialized)
    // --------------------------------------------------------------------------
    
    function initScrollProgress() {
        // components.js handles this when nav loads — only init here as fallback
        if (document.getElementById('scroll-progress')) return;
        
        const progressBar = document.createElement('div');
        progressBar.className = 'scroll-progress';
        progressBar.id = 'scroll-progress';
        document.body.prepend(progressBar);
        
        function updateProgress() {
            const scrollTop = window.scrollY;
            const docHeight = document.documentElement.scrollHeight - window.innerHeight;
            const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
            progressBar.style.width = progress + '%';
        }
        
        window.addEventListener('scroll', updateProgress, { passive: true });
        updateProgress();
    }
    
    // --------------------------------------------------------------------------
    // Back to Top Button (defers to components.js if already initialized)
    // --------------------------------------------------------------------------
    
    function initBackToTop() {
        // components.js handles this when footer loads — only init here as fallback
        if (document.getElementById('back-to-top')) return;
        
        const btn = document.createElement('button');
        btn.className = 'back-to-top';
        btn.id = 'back-to-top';
        btn.setAttribute('aria-label', 'Back to top');
        btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>';
        btn.onclick = function() {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        };
        document.body.appendChild(btn);
        
        function toggleVisibility() {
            if (window.scrollY > 300) {
                btn.classList.add('visible');
            } else {
                btn.classList.remove('visible');
            }
        }
        
        window.addEventListener('scroll', toggleVisibility, { passive: true });
        toggleVisibility();
    }
    
    // --------------------------------------------------------------------------
    // Cookie Consent
    // Uses a real cookie on the serving registrable domain so consent carries
    // across its subdomains (see consentCookieDomain below)
    // --------------------------------------------------------------------------

    /**
     * Read a cookie by name
     */
    function getCookie(name) {
        var match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
        return match ? match[2] : null;
    }

    /**
     * Set the consent cookie on the registrable domain we are actually being
     * served from, so consent carries across that domain's subdomains.
     * Falls back to the current hostname for localhost/dev.
     *
     * Derived from the live hostname rather than hard-coded, because during the
     * .io -> .ai cutover the site is reachable on BOTH. A browser silently
     * DISCARDS a cookie whose `domain` is not a suffix of the current host, so
     * hard-coding `.squidbay.ai` here while the page is served from
     * squidbay.io would not "prepare" for the move — it would drop consent on
     * the floor with no error, on every visit, until someone noticed.
     */
    var CONSENT_DOMAINS = ['squidbay.ai', 'squidbay.io'];

    function consentCookieDomain(hostname) {
        for (var i = 0; i < CONSENT_DOMAINS.length; i++) {
            var d = CONSENT_DOMAINS[i];
            if (hostname === d || hostname.endsWith('.' + d)) return '; domain=.' + d;
        }
        return ''; // localhost / dev / anything else: host-only cookie
    }

    function setConsentCookie(value) {
        var maxAge = 365 * 24 * 60 * 60; // 1 year
        var domainPart = consentCookieDomain(window.location.hostname);
        document.cookie = 'squidbay_cookie_consent=' + value + '; path=/' + domainPart + '; max-age=' + maxAge + '; SameSite=Lax; Secure';
    }
    
    function initCookieConsent() {
        // Check if already consented (cookie or legacy localStorage)
        if (getCookie('squidbay_cookie_consent')) {
            // Migrate: if localStorage still has the old value, clean it up
            if (localStorage.getItem('squidbay-cookie-consent')) {
                localStorage.removeItem('squidbay-cookie-consent');
            }
            return;
        }

        // Migrate from localStorage if user already consented on this origin
        var legacyConsent = localStorage.getItem('squidbay-cookie-consent');
        if (legacyConsent) {
            setConsentCookie(legacyConsent);
            localStorage.removeItem('squidbay-cookie-consent');
            return;
        }
        
        // Create cookie consent banner
        const banner = document.createElement('div');
        banner.className = 'cookie-consent';
        banner.id = 'cookie-consent';
        banner.innerHTML = '\
            <div class="cookie-consent-inner">\
                <div class="cookie-consent-text">\
                    <p>We use cookies to improve your experience. By using SquidBay, you agree to our <a href="/privacy">Privacy Policy</a>.</p>\
                </div>\
                <div class="cookie-consent-buttons">\
                    <button class="btn btn-secondary btn-sm" onclick="declineCookies()">Decline</button>\
                    <button class="btn btn-primary btn-sm" onclick="acceptCookies()">Accept</button>\
                </div>\
            </div>\
        ';
        
        document.body.appendChild(banner);
        
        // Show after a short delay
        setTimeout(function() {
            banner.classList.add('visible');
        }, 1000);
    }
    
    // Cookie consent functions
    window.acceptCookies = function() {
        setConsentCookie('accepted');
        hideCookieBanner();
    };
    
    window.declineCookies = function() {
        setConsentCookie('declined');
        hideCookieBanner();
    };
    
    function hideCookieBanner() {
        const banner = document.getElementById('cookie-consent');
        if (banner) {
            banner.classList.remove('visible');
            setTimeout(function() {
                banner.remove();
            }, 300);
        }
    }

    // --------------------------------------------------------------------------
    // Initialize Everything
    // --------------------------------------------------------------------------
    
    function init() {
        initScrollAnimations();
        initMobileMenu();
        initSmoothScroll();
        initNavScroll();
        initScrollProgress();
        initBackToTop();
        initCookieConsent();
        
        // Add class to body so CSS knows JS is working
        document.body.classList.add('js-loaded');
        
        console.log('🦑 SquidBay initialized');
    }
    
    // Run on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
})();
