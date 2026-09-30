const projectId = Number(new URLSearchParams(location.search).get('project'));
let projectInfo = null;
let members = [];
let tasks = [];
let activeTaskId = null;

const statusLabels = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  REVIEW: 'Review',
  DONE: 'Done'
};

function formatDate(date) {
  if (!date) return 'No due date';
  return new Date(date).toLocaleDateString();
}

function memberOptions(selectedId = '') {
  return '<option value="">Unassigned</option>' + members
    .map(member => `
      <option value="${member.id}" ${String(member.id) === String(selectedId) ? 'selected' : ''}>
        ${escapeHtml(member.fullName)}
      </option>
    `)
    .join('');
}

function taskCard(task) {
  const assigneeName = task.assigneeName || 'Unassigned';
  const avatar = task.assigneeName
    ? `<span class="avatar avatar-xs" style="${avatarStyle(task.assigneeName)}">${initials(task.assigneeName)}</span>`
    : '<span class="avatar avatar-xs avatar-unassigned">?</span>';

  return `
    <article
      class="task-card"
      draggable="true"
      data-task-id="${task.id}"
      onclick="openTask(${task.id})"
    >
      <div class="task-card-top">
        <span class="priority-pill priority-${task.priority.toLowerCase()}">${task.priority}</span>
        <span class="drag-handle" title="Drag task">⋮⋮</span>
      </div>

      <h4>${escapeHtml(task.title)}</h4>

      <div class="task-assignee-row">
        ${avatar}
        <span>${escapeHtml(assigneeName)}</span>
      </div>

      <div class="task-card-footer">
        <span class="task-footer-item">
          <span class="meta-symbol">◷</span>
          ${formatDate(task.dueDate)}
        </span>
        <span class="task-footer-item">
          <span class="meta-symbol">◌</span>
          ${task.commentCount}
        </span>
      </div>
    </article>
  `;
}

function emptyColumn(status) {
  const text = status === 'DONE' ? 'Completed tasks will appear here' : 'Drop tasks here';
  return `
    <div class="empty-column-state">
      <div class="empty-column-icon">${status === 'DONE' ? '✓' : '+'}</div>
      <span>${text}</span>
    </div>
  `;
}

function renderTasks() {
  const counts = {};

  for (const status of Object.keys(statusLabels)) {
    const list = tasks.filter(task => task.status === status);
    counts[status] = list.length;
    document.getElementById(status).innerHTML = list.length
      ? list.map(taskCard).join('')
      : emptyColumn(status);
    document.getElementById('count' + status).textContent = list.length;
  }

  summaryTodo.textContent = counts.TODO || 0;
  summaryProgress.textContent = counts.IN_PROGRESS || 0;
  summaryReview.textContent = counts.REVIEW || 0;
  summaryDone.textContent = counts.DONE || 0;

  document.querySelectorAll('.task-card').forEach(card => {
    card.addEventListener('dragstart', e => {
      card.classList.add('dragging');
      e.dataTransfer.setData('text/plain', card.dataset.taskId);
      e.stopPropagation();
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
    });
  });
}

function renderHeaderMembers() {
  const shown = members.slice(0, 4);
  headerMemberAvatars.innerHTML = shown
    .map(member => `
      <span
        class="avatar avatar-sm"
        style="${avatarStyle(member.fullName)}"
        title="${escapeHtml(member.fullName)}"
      >${initials(member.fullName)}</span>
    `)
    .join('') + (members.length > 4 ? `<span class="avatar avatar-sm avatar-more">+${members.length - 4}</span>` : '');
}

function renderMembers() {
  memberList.innerHTML = members
    .map(member => `
      <div class="member-row">
        <div class="member-identity">
          <span class="avatar" style="${avatarStyle(member.fullName)}">${initials(member.fullName)}</span>
          <div>
            <strong>${escapeHtml(member.fullName)}</strong>
            <span>${escapeHtml(member.email)}</span>
          </div>
        </div>
        <div class="member-row-actions">
          <span class="role-pill light-role">${escapeHtml(member.role)}</span>
          ${projectInfo.currentRole === 'OWNER' && member.role !== 'OWNER'
            ? `<button class="icon-button danger-icon" onclick="removeMember(${member.id})" title="Remove member">×</button>`
            : ''}
        </div>
      </div>
    `)
    .join('');

  taskAssignee.innerHTML = memberOptions();
  modalAssignee.innerHTML = memberOptions();
  memberFormWrap.style.display = projectInfo.currentRole === 'OWNER' ? 'block' : 'none';
  renderHeaderMembers();
}

async function loadAvailableUsers() {
  if (!projectInfo || projectInfo.currentRole !== 'OWNER') {
    availableUsersWrap.style.display = 'none';
    return;
  }

  availableUsersWrap.style.display = 'block';

  try {
    const users = await api(`/projects/${projectId}/available-users`);

    availableUsers.innerHTML = users.length
      ? users
          .map(user => `
            <div class="member-row available-user-row">
              <div class="member-identity">
                <span class="avatar" style="${avatarStyle(user.fullName)}">${initials(user.fullName)}</span>
                <div>
                  <strong>${escapeHtml(user.fullName)}</strong>
                  <span>${escapeHtml(user.email)}</span>
                </div>
              </div>
              <button class="btn btn-sm" onclick="addMemberByEmail('${String(user.email).replaceAll("'", "\\'")}')">Add</button>
            </div>
          `)
          .join('')
      : `
        <div class="empty-inline-state">
          <span>✓</span>
          <div><strong>Everyone is already here</strong><p>No other registered users are available to add.</p></div>
        </div>
      `;
  } catch (error) {
    availableUsers.innerHTML = `<div class="empty-inline-state"><div><strong>Could not load users</strong><p>${escapeHtml(error.message)}</p></div></div>`;
  }
}

async function addMemberByEmail(email) {
  try {
    await api(`/projects/${projectId}/members`, {
      method: 'POST',
      body: JSON.stringify({ email })
    });

    await loadProject();
    await loadTasks();
    msg.className = 'notice success show';
    msg.textContent = 'Member added successfully.';
  } catch (error) {
    msg.className = 'notice error show';
    msg.textContent = error.message;
  }
}

async function loadProject() {
  const data = await api('/projects/' + projectId);
  projectInfo = data;
  members = data.members;

  projectTitle.textContent = data.project.name;
  projectDescription.textContent = data.project.description || 'No project description.';
  projectAvatar.textContent = initials(data.project.name);
  renderMembers();
  await loadAvailableUsers();
}

async function loadTasks() {
  tasks = await api('/tasks/project/' + projectId);
  renderTasks();
}

async function openTask(id) {
  activeTaskId = id;
  const task = await api('/tasks/' + id);

  modalTitle.textContent = task.title;
  modalDescription.textContent = task.description || 'No description.';
  modalPriority.textContent = task.priority;
  modalPriority.className = `priority-pill priority-${task.priority.toLowerCase()}`;
  modalStatus.value = task.status;
  modalAssignee.innerHTML = memberOptions(task.assigneeId || '');
  taskModal.classList.add('show');

  await loadComments();
}

async function loadComments() {
  const data = await api('/comments/task/' + activeTaskId);
  comments.innerHTML = data.length
    ? data.map(comment => `
        <div class="comment">
          <span class="avatar avatar-sm" style="${avatarStyle(comment.userName)}">${initials(comment.userName)}</span>
          <div class="comment-body">
            <div class="comment-head">
              <strong>${escapeHtml(comment.userName)}</strong>
              <span class="muted">${new Date(comment.createdAt).toLocaleString()}</span>
            </div>
            <div>${escapeHtml(comment.content)}</div>
          </div>
        </div>
      `).join('')
    : `
      <div class="empty-inline-state">
        <span>◌</span>
        <div><strong>No comments yet</strong><p>Start the conversation for this task.</p></div>
      </div>
    `;
}

async function removeMember(userId) {
  if (!confirm('Remove this member from the project?')) return;

  try {
    await api(`/projects/${projectId}/members/${userId}`, { method: 'DELETE' });
    await loadProject();
    await loadTasks();
  } catch (error) {
    alert(error.message);
  }
}

async function updateTaskStatus(taskId, status) {
  await api('/tasks/' + taskId + '/status', {
    method: 'PATCH',
    body: JSON.stringify({ status })
  });
  await loadTasks();
}

document.addEventListener('DOMContentLoaded', async () => {
  const { user } = await api('/auth/me');
  if (!user) return location.href = '/login.html';
  if (!projectId) return location.href = '/dashboard.html';

  try {
    await loadProject();
    await loadTasks();
  } catch (error) {
    msg.className = 'notice error show';
    msg.textContent = error.message;
    return;
  }

  membersBtn.addEventListener('click', () => {
    membersPanel.style.display = membersPanel.style.display === 'none' ? 'block' : 'none';
  });

  taskBtn.addEventListener('click', () => {
    taskFormBox.style.display = taskFormBox.style.display === 'none' ? 'block' : 'none';
    if (taskFormBox.style.display === 'block') taskTitle.focus();
  });

  memberForm.addEventListener('submit', async e => {
    e.preventDefault();
    try {
      await api(`/projects/${projectId}/members`, {
        method: 'POST',
        body: JSON.stringify({ email: memberEmail.value })
      });
      memberForm.reset();
      await loadProject();
      msg.className = 'notice success show';
      msg.textContent = 'Member added successfully.';
    } catch (error) {
      msg.className = 'notice error show';
      msg.textContent = error.message;
    }
  });

  taskForm.addEventListener('submit', async e => {
    e.preventDefault();
    try {
      await api('/tasks', {
        method: 'POST',
        body: JSON.stringify({
          projectId,
          title: taskTitle.value,
          description: taskDescription.value,
          priority: taskPriority.value,
          assigneeId: taskAssignee.value || null,
          dueDate: taskDueDate.value || null
        })
      });

      taskForm.reset();
      taskFormBox.style.display = 'none';
      await loadTasks();
    } catch (error) {
      alert(error.message);
    }
  });

  document.querySelectorAll('.column').forEach(column => {
    column.addEventListener('dragover', e => {
      e.preventDefault();
      column.classList.add('drag-over');
    });

    column.addEventListener('dragleave', () => {
      column.classList.remove('drag-over');
    });

    column.addEventListener('drop', async e => {
      e.preventDefault();
      column.classList.remove('drag-over');
      const taskId = Number(e.dataTransfer.getData('text/plain'));
      const status = column.dataset.status;
      try {
        await updateTaskStatus(taskId, status);
      } catch (error) {
        alert(error.message);
      }
    });
  });

  closeModal.addEventListener('click', () => taskModal.classList.remove('show'));
  taskModal.addEventListener('click', e => {
    if (e.target === taskModal) taskModal.classList.remove('show');
  });

  saveTaskBtn.addEventListener('click', async () => {
    try {
      await api('/tasks/' + activeTaskId, {
        method: 'PATCH',
        body: JSON.stringify({
          status: modalStatus.value,
          assigneeId: modalAssignee.value || null
        })
      });
      await loadTasks();
      taskModal.classList.remove('show');
    } catch (error) {
      alert(error.message);
    }
  });

  deleteTaskBtn.addEventListener('click', async () => {
    if (!confirm('Delete this task?')) return;
    try {
      await api('/tasks/' + activeTaskId, { method: 'DELETE' });
      taskModal.classList.remove('show');
      await loadTasks();
    } catch (error) {
      alert(error.message);
    }
  });

  commentForm.addEventListener('submit', async e => {
    e.preventDefault();
    try {
      await api('/comments/task/' + activeTaskId, {
        method: 'POST',
        body: JSON.stringify({ content: commentText.value })
      });
      commentForm.reset();
      await loadComments();
      await loadTasks();
    } catch (error) {
      alert(error.message);
    }
  });
});
