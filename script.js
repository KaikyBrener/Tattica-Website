document.addEventListener('DOMContentLoaded', () => {
    
    // 1. MENU MOBILE (Hamburger)
    const menuToggle = document.getElementById('menu-toggle');
    const mainNav = document.getElementById('main-nav');
    const navLinks = document.querySelectorAll('.nav-link');
    
    if (menuToggle && mainNav) {
        // Toggle menu on button click
        menuToggle.addEventListener('click', () => {
            const isExpanded = menuToggle.getAttribute('aria-expanded') === 'true';
            const nextState = !isExpanded;
            menuToggle.setAttribute('aria-expanded', String(nextState));
            menuToggle.setAttribute('aria-label', nextState ? 'Fechar menu de navegação' : 'Abrir menu de navegação');
            menuToggle.classList.toggle('active', nextState);
            mainNav.classList.toggle('active', nextState);
            document.body.style.overflow = nextState ? 'hidden' : '';
        });

        // Close menu on link click
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                closeMenu();
            });
        });

        // Close menu on ESC key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && mainNav.classList.contains('active')) {
                closeMenu();
            }
        });

        // Close menu on click outside
        document.addEventListener('click', (e) => {
            if (mainNav.classList.contains('active') && !mainNav.contains(e.target) && !menuToggle.contains(e.target)) {
                closeMenu();
            }
        });
    }

    function closeMenu() {
        if(menuToggle && mainNav) {
            menuToggle.setAttribute('aria-expanded', 'false');
            menuToggle.setAttribute('aria-label', 'Abrir menu de navegação');
            menuToggle.classList.remove('active');
            mainNav.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    // 2. HEADER SCROLL EFEITO
    const header = document.getElementById('header');
    
    if (header) {
        const handleScroll = () => {
            if (window.scrollY > 50) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
        };
        
        window.addEventListener('scroll', handleScroll, { passive: true });
        handleScroll(); // Check on load
    }

    // 3. LINK ATIVO NA NAVEGAÇÃO (seção visível)
    const sectionLinks = new Map();
    navLinks.forEach(link => {
        const target = document.querySelector(link.getAttribute('href'));
        if (target) sectionLinks.set(target, link);
    });

    if (sectionLinks.size > 0 && 'IntersectionObserver' in window) {
        const navObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                navLinks.forEach(link => link.removeAttribute('aria-current'));
                sectionLinks.get(entry.target)?.setAttribute('aria-current', 'true');
            });
        }, { rootMargin: '-45% 0px -50% 0px' });

        sectionLinks.forEach((link, section) => navObserver.observe(section));
    }

    // 4. ACCORDION FAQ LOGIC (Exclusividade)
    const faqs = document.querySelectorAll('.faq__item');
    
    if (faqs.length > 0) {
        faqs.forEach(faq => {
            faq.addEventListener('click', (e) => {
                // Se estiver abrindo este, fecha os outros
                if (!faq.hasAttribute('open')) {
                    faqs.forEach(otherFaq => {
                        if (otherFaq !== faq && otherFaq.hasAttribute('open')) {
                            otherFaq.removeAttribute('open');
                        }
                    });
                }
            });
        });
    }

    // 5. BOTÃO VOLTAR AO TOPO
    const backToTopBtn = document.getElementById('back-to-top');
    
    if (backToTopBtn) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 500) {
                backToTopBtn.classList.add('show');
            } else {
                backToTopBtn.classList.remove('show');
            }
        }, { passive: true });

        backToTopBtn.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }

    // 6. MODAL DE SOLICITAÇÃO DE ORÇAMENTO
    const quoteModal = document.getElementById('orcamento-modal');
    const quoteForm = document.getElementById('quote-form');
    const quoteTriggers = document.querySelectorAll('.quote-trigger');
    const quoteCloseButtons = quoteModal ? quoteModal.querySelectorAll('[data-quote-close]') : [];
    const quotePhone = document.getElementById('quote-phone');
    let lastQuoteTrigger;

    const formatPhone = (value) => {
        const digits = value.replace(/\D/g, '').slice(0, 11);
        if (digits.length <= 2) return digits.length ? `(${digits}` : '';
        if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    };

    const closeQuoteModal = () => {
        if (!quoteModal) return;
        quoteModal.hidden = true;
        document.body.classList.remove('quote-modal-open');
        lastQuoteTrigger?.focus();
    };

    if (quoteModal && quoteForm) {
        quoteTriggers.forEach(trigger => {
            trigger.addEventListener('click', (event) => {
                event.preventDefault();
                closeMenu();
                lastQuoteTrigger = trigger;
                quoteModal.hidden = false;
                document.body.classList.add('quote-modal-open');
                document.getElementById('quote-name').focus();
            });
        });

        quoteCloseButtons.forEach(button => button.addEventListener('click', closeQuoteModal));
        quotePhone?.addEventListener('input', () => {
            quotePhone.value = formatPhone(quotePhone.value);
        });

        quoteForm.addEventListener('submit', (event) => {
            event.preventDefault();
            if (!quoteForm.reportValidity()) return;

            const formData = new FormData(quoteForm);
            const message = [
                'Olá! Desejo solicitar um orçamento.',
                '',
                `Nome: ${formData.get('nome')}`,
                `E-mail: ${formData.get('email')}`,
                `Telefone: ${formData.get('telefone')}`
            ].join('\n');
            const whatsappUrl = `https://wa.me/552730262196?text=${encodeURIComponent(message)}`;
            window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
            closeQuoteModal();
            quoteForm.reset();
        });

        document.addEventListener('keydown', (event) => {
            if (quoteModal.hidden) return;
            if (event.key === 'Escape') {
                closeQuoteModal();
                return;
            }
            if (event.key !== 'Tab') return;

            // Mantém o foco dentro do modal enquanto ele está aberto
            const focusable = quoteModal.querySelectorAll('button, input, a[href]');
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        });
    }

    // 7. ATUALIZAÇÃO AUTOMÁTICA DO ANO
    const yearSpan = document.getElementById('current-year');
    if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
    }

});