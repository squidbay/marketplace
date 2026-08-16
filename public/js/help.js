/**
 * SquidBay Help Center JS
 * js/help.js
 */

(function() {
    'use strict';

// Nav button clicks — scroll to section (matches FAQ behavior)
        document.querySelectorAll('.help-nav-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.help-nav-btn').forEach(function(b) { b.classList.remove('active'); });
                btn.classList.add('active');
                var target = document.getElementById(btn.dataset.section);
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        });

        // Handle hash links (e.g. /help#contact)
        function checkHash() {
            var hash = window.location.hash.replace('#', '');
            if (hash) {
                var target = document.getElementById(hash);
                if (target) {
                    setTimeout(function() {
                        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 300);
                    // Update nav button
                    document.querySelectorAll('.help-nav-btn').forEach(function(btn) {
                        btn.classList.remove('active');
                        if (btn.dataset.section === hash) btn.classList.add('active');
                    });
                }
            }
        }
        window.addEventListener('load', checkHash);

        // Accordion toggle
        document.querySelectorAll('.help-question').forEach(function(question) {
            question.addEventListener('click', function() {
                var item = question.parentElement;
                var wasOpen = item.classList.contains('open');
                item.parentElement.querySelectorAll('.help-item').forEach(function(i) {
                    i.classList.remove('open');
                });
                if (!wasOpen) {
                    item.classList.add('open');
                }
            });
        });

})();
