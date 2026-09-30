const pool = require('../config/db');

async function getMembership(projectId, userId) {
  const result = await pool.query(
    `SELECT role
     FROM project_members
     WHERE project_id = $1 AND user_id = $2`,
    [projectId, userId]
  );

  return result.rows[0] || null;
}

async function requireProjectMember(projectId, userId) {
  const membership = await getMembership(projectId, userId);
  if (!membership) {
    const error = new Error('You do not have access to this project');
    error.status = 403;
    throw error;
  }
  return membership;
}

async function requireProjectOwner(projectId, userId) {
  const membership = await requireProjectMember(projectId, userId);
  if (membership.role !== 'OWNER') {
    const error = new Error('Only the project owner can perform this action');
    error.status = 403;
    throw error;
  }
  return membership;
}

module.exports = {
  getMembership,
  requireProjectMember,
  requireProjectOwner
};
