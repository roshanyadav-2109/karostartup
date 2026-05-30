/* ============================================================
   ADMIN SHELL — shared layout renderer for all admin pages
   ============================================================ */

async function renderAdminShell(activeKey, breadcrumb) {
  const root = document.getElementById('admin-root');
  const profile = await getCurrentProfile();
  const admin = profile?.role === 'admin';
  const user = await getCurrentUser();

  // Role ranks. `min` on a nav item = lowest role that can see it.
  // author (1) sees the core items; editor (2) also sees the editorial tools;
  // admin (3) sees everything.
  const RANK = { reader: 0, author: 1, editor: 2, admin: 3 };
  const myRank = RANK[profile?.role] ?? 0;

  const navItems = [
    { key: 'dashboard', label: 'Dashboard', href: '/admin/', min: 1 },
    { key: 'articles', label: 'Articles', href: '/admin/articles.html', min: 1 },
    { key: 'imported', label: 'Imported', href: '/admin/imported.html', min: 2 },
    { key: 'categories', label: 'Categories', href: '/admin/categories.html', min: 1 },
    { key: 'companies', label: 'Companies', href: '/admin/companies.html', min: 2 },
    { key: 'funding', label: 'Funding', href: '/admin/funding.html', min: 2 },
    { key: 'tickers', label: 'Tickers', href: '/admin/tickers.html', min: 2 },
    { key: 'shorts', label: 'Shorts', href: '/admin/shorts.html', min: 2 },
    { key: 'podcasts', label: 'Podcasts', href: '/admin/podcasts.html', min: 2 },
    { key: 'comments', label: 'Comments', href: '/admin/comments.html', min: 1 },
    { key: 'submissions', label: 'Submissions', href: '/admin/submissions.html', min: 2 },
    { key: 'newsletters', label: 'Newsletters', href: '/admin/newsletters.html', min: 3 },
    { key: 'autofetch', label: 'Auto-Fetch', href: '/admin/auto-fetch.html', min: 3 },
    { key: 'users', label: 'Employees', href: '/admin/users.html', min: 3 }
  ];

  root.innerHTML = `
  <div class="admin-shell">
    <aside class="admin-sidebar">
      <a href="/" class="logo" aria-label="Karostartup home"><img src="/assets/logo-wordmark.png" alt="Karostartup"></a>
      <div class="role-chip">${escapeHtml((profile?.role || 'staff').toUpperCase())}</div>
      <nav>
        ${navItems.filter(n => myRank >= n.min).map(n => `
          <a href="${n.href}" class="${n.key === activeKey ? 'is-active' : ''}">${escapeHtml(n.label)}</a>
        `).join('')}
      </nav>
    </aside>
    <div class="admin-main">
      <div class="admin-bar">
        <div class="breadcrumb"><a href="/admin/">Admin</a> <span style="color:#e6e6e6;">›</span> <span class="cur">${escapeHtml(breadcrumb || activeKey)}</span></div>
        <div class="user-menu">
          <a href="/" target="_blank" rel="noopener">View site ↗</a>
          <span style="color:#0a0a0a;font-weight:600;">${escapeHtml(profile?.full_name || user?.email || 'You')}</span>
          <a href="#" id="admin-signout">Sign out</a>
        </div>
      </div>
      <div class="admin-content" id="admin-content"></div>
    </div>
  </div>`;

  document.getElementById('admin-signout').addEventListener('click', (e) => { e.preventDefault(); signOut(); });
}

window.renderAdminShell = renderAdminShell;
