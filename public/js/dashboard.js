async function ensureLogin() {
  const { user } = await api('/auth/me');
  if (!user) {
    location.href = '/login.html';
    return false;
  }
  return true;
}

function projectInitials(name = '') {
  return initials(name);
}

function projectCard(p, index) {
  const progress = p.taskCount ? Math.round((p.doneCount / p.taskCount) * 100) : 0;
  const themes = ['indigo', 'sky', 'violet', 'emerald', 'rose', 'amber'];
  const theme = themes[index % themes.length];

  return `
    <article class="project-card project-theme-${theme}">
      <div class="project-cover">
        <div class="project-symbol">${projectInitials(p.name)}</div>
        <span class="role-pill">${escapeHtml(p.role)}</span>
        <div class="cover-decoration cover-decoration-one"></div>
        <div class="cover-decoration cover-decoration-two"></div>
      </div>

      <div class="project-content">
        <div>
          <h3>${escapeHtml(p.name)}</h3>
          <p>${escapeHtml(p.description || 'No description yet.')}</p>
        </div>

        <div class="project-details">
          <span><span class="detail-icon">◉</span>${p.memberCount} member${p.memberCount === 1 ? '' : 's'}</span>
          <span><span class="detail-icon">✓</span>${p.doneCount}/${p.taskCount} tasks done</span>
        </div>

        <div class="project-progress-row">
          <div class="progress"><span style="width:${progress}%"></span></div>
          <strong>${progress}%</strong>
        </div>

        <a class="project-open-link" href="/board.html?project=${p.id}">
          Open Board <span>→</span>
        </a>
      </div>
    </article>
  `;
}

function renderWorkspaceStats(data) {
  const totalTasks = data.reduce((sum, p) => sum + Number(p.taskCount || 0), 0);
  const totalDone = data.reduce((sum, p) => sum + Number(p.doneCount || 0), 0);
  const progress = totalTasks ? Math.round((totalDone / totalTasks) * 100) : 0;

  statProjects.textContent = data.length;
  statTasks.textContent = totalTasks;
  statDone.textContent = totalDone;
  statProgress.textContent = `${progress}%`;
}

async function loadProjects() {
  const data = await api('/projects');
  renderWorkspaceStats(data);

  projects.innerHTML = data.length
    ? data.map(projectCard).join('')
    : `
      <div class="empty-state empty-project-state">
        <div class="empty-illustration">
          <div class="empty-folder"><span></span><span></span><span></span></div>
        </div>
        <h3>No projects yet</h3>
        <p>Create your first shared workspace and start organizing tasks with your team.</p>
        <button class="btn" onclick="showCreateBtn.click()">Create your first project</button>
      </div>
    `;
}

document.addEventListener('DOMContentLoaded', async () => {
  if (!(await ensureLogin())) return;

  await loadProjects();

  showCreateBtn.addEventListener('click', () => {
    createBox.style.display = createBox.style.display === 'none' ? 'block' : 'none';
    if (createBox.style.display === 'block') projectName.focus();
  });

  closeCreateBtn.addEventListener('click', () => {
    createBox.style.display = 'none';
  });

  projectForm.addEventListener('submit', async e => {
    e.preventDefault();
    try {
      await api('/projects', {
        method: 'POST',
        body: JSON.stringify({
          name: projectName.value,
          description: projectDescription.value
        })
      });

      projectForm.reset();
      createBox.style.display = 'none';
      msg.className = 'notice success show';
      msg.textContent = 'Project created successfully.';
      await loadProjects();
    } catch (error) {
      msg.className = 'notice error show';
      msg.textContent = error.message;
    }
  });
});
