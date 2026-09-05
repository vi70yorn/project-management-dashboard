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
-- Schema Initialization Complete (Clean slate, zero sample data)
-- ==========================================================
