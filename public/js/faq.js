/**
 * SquidBay FAQ Page JS
 * js/faq.js
 */

(function() {
    'use strict';

// FAQ nav badge clicks — scroll to category
        document.querySelectorAll('.faq-nav-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.faq-nav-btn').forEach(function(b) { b.classList.remove('active'); });
                btn.classList.add('active');
                var target = document.getElementById(btn.dataset.section);
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        });

        // Accordion toggle
        document.querySelectorAll('.faq-question').forEach(function(question) {
            question.addEventListener('click', function() {
                var item = question.parentElement;
                var wasOpen = item.classList.contains('open');
                item.parentElement.querySelectorAll('.faq-item').forEach(function(i) { i.classList.remove('open'); });
                if (!wasOpen) { item.classList.add('open'); }
            });
        });

})();
