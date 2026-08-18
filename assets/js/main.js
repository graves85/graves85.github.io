document.addEventListener('DOMContentLoaded', function () {
  // Mobile Nav Toggle
  const navToggle = document.getElementById('navToggle');
  const navMenu = document.getElementById('navMenu');

  if (navToggle && navMenu) {
    navToggle.addEventListener('click', function () {
      const isOpen = navMenu.classList.toggle('active');
      navToggle.classList.toggle('is-open', isOpen);
      navToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      navToggle.setAttribute('aria-label', isOpen ? '메뉴 닫기' : '메뉴 열기');
    });

    document.addEventListener('click', function (event) {
      if (!navMenu.contains(event.target) && !navToggle.contains(event.target)) {
        navMenu.classList.remove('active');
        navToggle.classList.remove('is-open');
        navToggle.setAttribute('aria-expanded', 'false');
        navToggle.setAttribute('aria-label', '메뉴 열기');
      }
    });
  }

  // Submenu Accordion on Mobile
  const menuItems = document.querySelectorAll('.nav-item--has-sub');
  menuItems.forEach(function (item) {
    const trigger = item.querySelector('.nav-item__trigger');
    if (!trigger) return;

    trigger.addEventListener('click', function (event) {
      if (window.innerWidth > 768) return;

      event.preventDefault();
      const willOpen = !item.classList.contains('is-open');
      menuItems.forEach(function (other) {
        other.classList.remove('is-open');
      });
      if (willOpen) {
        item.classList.add('is-open');
      }
    });
  });

  // Dark Mode Toggle
  const themeToggle = document.getElementById('themeToggle');
  function updateUtterancesTheme(theme) {
    const utterancesIframe = document.querySelector('.utterances-frame');
    if (utterancesIframe) {
      const utterancesTheme = theme === 'dark' ? 'github-dark' : 'github-light';
      utterancesIframe.contentWindow.postMessage(
        { type: 'set-theme', theme: utterancesTheme },
        'https://utteranc.es'
      );
    }
  }

  // Handle initial utterances theme when iframe loads
  window.addEventListener('message', function (event) {
    if (event.origin === 'https://utteranc.es') {
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
      if (currentTheme === 'dark') {
        updateUtterancesTheme('dark');
      }
    }
  });

  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', newTheme);
      try {
        localStorage.setItem('theme', newTheme);
      } catch (e) {}
      updateUtterancesTheme(newTheme);
    });
  }

  // Code Block Copy Button
  document.querySelectorAll('.content-body pre').forEach(function (pre) {
    if (pre.parentElement.classList.contains('code-block')) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'code-block';
    pre.parentNode.insertBefore(wrapper, pre);
    wrapper.appendChild(pre);

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'copy-btn';
    button.textContent = '복사';
    button.addEventListener('click', async function () {
      const code = pre.querySelector('code') || pre;
      try {
        await navigator.clipboard.writeText(code.innerText);
        button.textContent = '완료';
        setTimeout(function () {
          button.textContent = '복사';
        }, 1500);
      } catch (error) {
        button.textContent = '실패';
      }
    });
    wrapper.appendChild(button);
  });

  // Automatic Table of Contents (TOC)
  const contentBody = document.getElementById('contentBody');
  const tocContainer = document.getElementById('tableOfContents');
  const tocBody = document.getElementById('tocBody');
  const tocToggle = document.getElementById('tocToggle');

  if (contentBody && tocContainer && tocBody) {
    const headings = contentBody.querySelectorAll('h2, h3, h4');
    if (headings.length >= 2) {
      const tocList = document.createElement('ul');
      tocList.className = 'toc__list';

      headings.forEach(function (heading, index) {
        if (!heading.id) {
          const slug = heading.textContent
            .trim()
            .toLowerCase()
            .replace(/[^\w가-힣\s-]/g, '')
            .replace(/\s+/g, '-');
          heading.id = (slug ? slug : 'heading') + '-' + (index + 1);
        }

        const li = document.createElement('li');
        li.className = 'toc__item toc__item--' + heading.tagName.toLowerCase();

        const a = document.createElement('a');
        a.href = '#' + heading.id;
        a.textContent = heading.textContent.replace(/^[#\s]+/, '').trim();
        a.className = 'toc__link';

        li.appendChild(a);
        tocList.appendChild(li);
      });

      tocBody.appendChild(tocList);
      tocContainer.style.display = 'block';

      if (tocToggle) {
        tocToggle.addEventListener('click', function () {
          const isHidden = tocBody.classList.toggle('is-collapsed');
          tocToggle.textContent = isHidden ? '펼치기' : '접기';
        });
      }
    }
  }
});
