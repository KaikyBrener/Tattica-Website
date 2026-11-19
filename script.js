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

    // 6. BOTÕES DE ORÇAMENTO: abrem o assistente direto no fluxo de orçamento (chatbot.js)
    // Sem o assistente (JavaScript bloqueado ou falha ao carregar), o link segue para o WhatsApp.
    document.querySelectorAll('.quote-trigger').forEach((botao) => {
        botao.addEventListener('click', (event) => {
            if (!window.TatticaChat) return;
            event.preventDefault();
            closeMenu();
            const origem = botao.dataset.origem || botao.closest('section[id]')?.id || 'cabecalho';
            window.TatticaChat.abrirOrcamento(origem);
        });
    });

    // 7. ATUALIZAÇÃO AUTOMÁTICA DO ANO
    const yearSpan = document.getElementById('current-year');
    if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
    }

});