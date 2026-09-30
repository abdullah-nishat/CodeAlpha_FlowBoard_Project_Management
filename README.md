# FlowBoard

FlowBoard is a collaborative project management platform with project workspaces, team members, visual task boards, task assignment, priorities, due dates, and task-level comments.

## Stack

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js, Express.js
- Database: PostgreSQL
- Authentication: express-session, bcrypt

## Features

- User registration, login and logout
- Session-based authentication
- Create group projects
- Project owner/member roles
- Add registered users to projects by email
- Remove project members
- Visual board with To Do, In Progress, Review and Done columns
- Create and assign task cards
- Priority and due date support
- Drag tasks between board columns
- Update task status and assignee
- Delete tasks
- Task-level comments
- Project/member access control
- PostgreSQL-backed sessions

## Run locally

### 1. Install dependencies

```bash
npm install
```

### 2. Create PostgreSQL database

Create a database named:

```text
flowboard
```


### 3. Start the application

Development:

```bash
npm run dev
```

Or:

```bash
npm start
```

Open:

```text
http://localhost:5000
```

## Collaboration test

To test group collaboration locally:

1. Register User A.
2. Create a project.
3. Logout.
4. Register User B with another email.
5. Logout and login as User A.
6. Open the project board and add User B using User B's registered email.
7. Assign tasks to User B.
8. Login as User B to open the shared project, move task cards, and add comments.

## Main database relationships

- `users` → accounts
- `projects` → project workspaces
- `project_members` → many-to-many project membership
- `tasks` → task cards belonging to projects
- `comments` → discussions belonging to tasks
- `user_sessions` → generated automatically by `connect-pg-simple`
