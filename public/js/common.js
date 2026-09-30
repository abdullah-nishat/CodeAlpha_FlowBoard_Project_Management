const API = '/api';

async function api(url, options = {}) {
  const res = await fetch(API + url, {
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(options.headers || {})
    },
    ...options
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function initials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function avatarStyle(name = '') {
  let hash = 0;
  for (const char of String(name)) hash = (hash * 31 + char.charCodeAt(0)) % 360;
  return `background:hsl(${hash} 68% 90%);color:hsl(${hash} 52% 30%)`;
}

function icon(name) {
  const icons = {
    projects: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H10l2 2h5.5A2.5 2.5 0 0 1 20 7.5v9A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-11Z"/><path d="M4.5 8h15"/></svg>',
    tasks: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h11M8 12h11M8 18h11"/><path d="m3 6 1.2 1.2L6.5 4.8M3 12l1.2 1.2L6.5 10.8M3 18l1.2 1.2L6.5 16.8"/></svg>',
    comments: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-5 4v-4H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"/><path d="M7 9h10M7 13h7"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2Z"/><path d="M7 2v4M17 2v4M3 9h18"/></svg>',
    people: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3 19a6 6 0 0 1 12 0"/><circle cx="17" cy="9" r="2.5"/><path d="M15 14.5A5 5 0 0 1 21 19"/></svg>',
    comment: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-7l-5 4v-4H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M14 7l5 5-5 5"/></svg>'
  };
  return icons[name] || '';
}

async function mountNav() {
  const box = document.querySelector('[data-nav]');
  if (!box) return;

  const { user } = await api('/auth/me');

  box.innerHTML = `
    <div class="nav">
      <div class="container nav-inner">
        <a class="brand" href="/">
          <span class="brand-mark"><span></span><span></span><span></span></span>
          <span>FlowBoard</span>
        </a>

        <div class="nav-links">
          ${user
            ? `
              <a href="/dashboard.html">Projects</a>
              <div class="nav-user">
                <span class="avatar avatar-sm" style="${avatarStyle(user.fullName)}">${initials(user.fullName)}</span>
                <span>${escapeHtml(user.fullName)}</span>
              </div>
              <button class="link-btn" id="logoutBtn">Logout</button>
            `
            : `
              <a href="/login.html">Login</a>
              <a class="btn btn-sm" href="/register.html">Get Started</a>
            `}
        </div>
      </div>
    </div>
  `;

  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    await api('/auth/logout', { method: 'POST' });
    location.href = '/';
  });
}

function mountFooter() {
  const el = document.querySelector('[data-footer]');
  if (el) {
    el.innerHTML = `
      <footer class="footer">
        <div class="container footer-inner">
          <a class="brand brand-footer" href="/">
            <span class="brand-mark"><span></span><span></span><span></span></span>
            <span>FlowBoard</span>
          </a>
          <span>© 2026 FlowBoard. All rights reserved.</span>
        </div>
      </footer>
    `;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  mountNav();
  mountFooter();
});
