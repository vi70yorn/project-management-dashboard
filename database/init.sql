-- ==========================================================
-- Project Management Dashboard - PostgreSQL Schema & Seed
-- Compatible with PostgreSQL 12+ (including PostgreSQL 18)
-- Optimized for DBeaver Community ER Diagrams and Data Management
-- ==========================================================

-- 1. Team Members Table
CREATE TABLE IF NOT EXISTS team_members (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    username VARCHAR(64) UNIQUE,
    password VARCHAR(255) NOT NULL DEFAULT '123456',
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(255) NOT NULL,
    system_role VARCHAR(32) NOT NULL DEFAULT 'staff', -- 'admin' or 'staff'
    avatar TEXT,
    color VARCHAR(32) DEFAULT '#2563eb',
    status VARCHAR(32) NOT NULL DEFAULT 'active',    -- 'active', 'busy', 'away'
    department VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Projects Table
CREATE TABLE IF NOT EXISTS projects (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    client VARCHAR(255),
    status VARCHAR(32) NOT NULL DEFAULT 'Pending',   -- 'In Progress', 'Pending', 'Blocked', 'Completed'
    start_date VARCHAR(32),
    target_deadline VARCHAR(32),
    manager_id VARCHAR(64) REFERENCES team_members(id) ON DELETE SET NULL,
    tags TEXT[] DEFAULT '{}',
    color VARCHAR(32) DEFAULT '#2563eb',
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    deleted_by VARCHAR(64) REFERENCES team_members(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. Project Members (Junction Table for Many-to-Many Relationship)
CREATE TABLE IF NOT EXISTS project_members (
    project_id VARCHAR(64) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    member_id VARCHAR(64) NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (project_id, member_id)
);

-- 4. Tasks Table
CREATE TABLE IF NOT EXISTS tasks (
    id VARCHAR(64) PRIMARY KEY,
    project_id VARCHAR(64) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'In Progress', -- 'In Progress', 'Pending', 'Blocked', 'Completed'
    priority VARCHAR(32) NOT NULL DEFAULT 'Medium',    -- 'Urgent', 'High', 'Medium', 'Low'
    assignee_id VARCHAR(64) REFERENCES team_members(id) ON DELETE SET NULL,
    created_by VARCHAR(64) REFERENCES team_members(id) ON DELETE SET NULL,
    start_date VARCHAR(32),
    due_date VARCHAR(32),
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    deleted_by VARCHAR(64) REFERENCES team_members(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 5. System Users Table (Authentication)
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'staff',
    member_id VARCHAR(64) REFERENCES team_members(id) ON DELETE SET NULL,
    avatar TEXT,
    department VARCHAR(255),
    job_role VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_projects_manager_id ON projects(manager_id);
CREATE INDEX IF NOT EXISTS idx_project_members_member_id ON project_members(member_id);

-- ==========================================================
-- Initial Production Seed Data (Preserving existing team & projects)
-- ==========================================================

INSERT INTO team_members (id, name, username, password, email, role, system_role, color, status)
VALUES
    ('mem-1788624319284', 'Y.VICHET', 'vichet', '123456', 'y.vichet@team.org', 'UX/UI Lead', 'admin', '#2563eb', 'active'),
    ('mem-1788624380119', 'David', 'david', '123456', 'david@team.org', 'UX/UI Designer', 'staff', '#2563eb', 'active'),
    ('mem-1788624800573', 'Likka', 'likka', '1234', 'likka@team.org', 'UX/UI Designer', 'staff', '#2563eb', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO projects (id, name, description, client, status, start_date, target_deadline, manager_id, tags, color, created_at, updated_at)
VALUES
    ('proj-1788624651745', 'Merchant 5.0', '- Home
- View QR
- Transaction
- Report
- Staff Management
- Business Management', 'UX/UI', 'In Progress', '2026-09-05', '2026-10-05', 'mem-1788624319284', ARRAY['Mobile', 'Merchant'], '#7c3aed', '2026-09-05T16:10:52.120Z', '2026-09-05T16:54:45.761Z')
ON CONFLICT (id) DO NOTHING;

INSERT INTO project_members (project_id, member_id, assigned_at)
VALUES
    ('proj-1788624651745', 'mem-1788624319284', '2026-09-05T16:54:45.761Z'),
    ('proj-1788624651745', 'mem-1788624380119', '2026-09-05T16:54:45.761Z'),
    ('proj-1788624651745', 'mem-1788624800573', '2026-09-05T16:54:45.761Z')
ON CONFLICT (project_id, member_id) DO NOTHING;

INSERT INTO tasks (id, project_id, title, description, status, priority, assignee_id, created_by, start_date, due_date, created_at, updated_at)
VALUES
    ('task-1788624838718', 'proj-1788624651745', 'Report Screen', 'Create a complete UI screen of the function', 'Completed', 'Medium', 'mem-1788624800573', 'mem-1788624319284', '2026-09-05', '2026-09-12', '2026-09-05T16:13:59.069Z', '2026-09-05T16:55:13.264Z'),
    ('task-1788624689153', 'proj-1788624651745', 'Home', 'Create a complete home screen', 'In Progress', 'Medium', 'mem-1788624380119', 'mem-1788624319284', '2026-09-05', '2026-09-06', '2026-09-05T16:11:29.188Z', '2026-09-06T05:42:02.918Z')
ON CONFLICT (id) DO NOTHING;

-- 6. Telegram Automated Weekly Report Settings Table
CREATE TABLE IF NOT EXISTS telegram_settings (
    id VARCHAR(32) PRIMARY KEY DEFAULT 'default',
    bot_token TEXT,
    chat_id TEXT,
    enabled BOOLEAN DEFAULT false,
    send_day VARCHAR(16) DEFAULT 'Monday',
    send_time VARCHAR(8) DEFAULT '08:00',
    last_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO telegram_settings (id, enabled, send_day, send_time)
VALUES ('default', false, 'Monday', '08:00')
ON CONFLICT (id) DO NOTHING;

-- 7. Team Activity Logs Table
CREATE TABLE IF NOT EXISTS activity_logs (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) REFERENCES team_members(id) ON DELETE SET NULL,
    user_name VARCHAR(255) NOT NULL,
    user_avatar TEXT,
    action_type VARCHAR(64) NOT NULL, -- 'create_task', 'update_task_status', 'update_task', 'delete_task', 'create_project', 'update_project_status', 'update_project', 'delete_project', 'auto_complete_project'
    entity_type VARCHAR(32) NOT NULL, -- 'task' or 'project'
    entity_id VARCHAR(64) NOT NULL,
    entity_name VARCHAR(255) NOT NULL,
    project_id VARCHAR(64),
    project_name VARCHAR(255),
    details JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_project_id ON activity_logs(project_id);

INSERT INTO activity_logs (id, user_id, user_name, action_type, entity_type, entity_id, entity_name, project_id, project_name, details, created_at)
VALUES
    ('act-1', 'mem-1788624800573', 'Likka', 'update_task_status', 'task', 'task-1788624838718', 'Report Screen', 'proj-1788624651745', 'Merchant 5.0', '{"fromStatus": "In Progress", "toStatus": "Completed"}', '2026-09-05T16:55:13.264Z'),
    ('act-2', 'mem-1788624380119', 'David', 'update_task_status', 'task', 'task-1788624689153', 'Home', 'proj-1788624651745', 'Merchant 5.0', '{"fromStatus": "Pending", "toStatus": "In Progress"}', '2026-09-06T05:42:02.918Z'),
    ('act-3', 'mem-1788624319284', 'Y.VICHET', 'create_project', 'project', 'proj-1788624651745', 'Merchant 5.0', 'proj-1788624651745', 'Merchant 5.0', '{"status": "In Progress"}', '2026-09-05T16:10:52.120Z')
ON CONFLICT (id) DO NOTHING;

-- Recycle Bin migrations & indexes
ALTER TABLE projects ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_projects_deleted_at ON projects(deleted_at);
CREATE INDEX IF NOT EXISTS idx_tasks_deleted_at ON tasks(deleted_at);
