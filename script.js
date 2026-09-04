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

    // 3. ANIMAÇÕES DE ENTRADA (Intersection Observer)
    const animatedElements = document.querySelectorAll('.animate-on-scroll');
    
    // Fallback se IntersectionObserver não for suportado
    if (!('IntersectionObserver' in window)) {
        animatedElements.forEach(el => el.classList.add('is-visible'));
    } else {
        const observerOptions = {
            root: null,
            rootMargin: '0px 0px -10% 0px',
            threshold: 0.1
        };

        const scrollObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target); // Anima apenas uma vez
                }
            });
        }, observerOptions);

        animatedElements.forEach(el => scrollObserver.observe(el));
    }

    // 4. CONTADOR ANIMADO (Números)
    const counters = document.querySelectorAll('.counter');
    
    if (counters.length > 0 && 'IntersectionObserver' in window) {
        const counterObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const counter = entry.target;
                    const target = +counter.getAttribute('data-target');
                    const duration = 2000; // 2 segundos
                    const stepTime = Math.abs(Math.floor(duration / target));
                    
                    let current = 0;
                    const increment = target > 100 ? Math.ceil(target / 50) : 1;

                    const timer = setInterval(() => {
                        current += increment;
                        if (current >= target) {
                            counter.innerText = target;
                            clearInterval(timer);
                        } else {
                            counter.innerText = current;
                        }
                    }, stepTime);
                    
                    observer.unobserve(counter);
                }
            });
        }, { threshold: 0.5 });

        counters.forEach(counter => counterObserver.observe(counter));
    }

    // 5. ACCORDION FAQ LOGIC (Exclusividade)
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

    // 6. BOTÃO VOLTAR AO TOPO
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

    // 7. MODAL DE SOLICITACAO DE ORCAMENTO
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
            if (event.key === 'Escape' && !quoteModal.hidden) closeQuoteModal();
        });
    }

    // 8. ATUALIZAÇÃO AUTOMÁTICA DO ANO
    const yearSpan = document.getElementById('current-year');
    if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
    }

});