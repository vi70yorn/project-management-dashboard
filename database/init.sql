-- ==========================================================
-- Project Management Dashboard - PostgreSQL Schema & Seed
-- Compatible with PostgreSQL 12+ (including PostgreSQL 18)
-- Optimized for DBeaver Community ER Diagrams and Data Management
-- ==========================================================

-- 1. Team Members Table
CREATE TABLE IF NOT EXISTS team_members (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
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
-- Initial Seed Data
-- ==========================================================

-- Insert Team Members
INSERT INTO team_members (id, name, email, role, system_role, avatar, color, status, department, created_at)
VALUES 
    ('mem-1', 'Alex Morgan', 'alex.morgan@team.org', 'Project Manager & Lead', 'admin', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80', '#2563eb', 'active', 'Engineering', '2026-08-01T09:00:00.000Z'),
    ('mem-2', 'Samantha Wu', 'samantha.wu@team.org', 'Senior Full-Stack Engineer', 'staff', 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80', '#7c3aed', 'active', 'Engineering', '2026-08-01T09:00:00.000Z'),
    ('mem-3', 'Carlos Rodriguez', 'carlos.r@team.org', 'Staff UI/UX Designer', 'staff', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80', '#ea580c', 'busy', 'Design', '2026-08-02T10:00:00.000Z'),
    ('mem-4', 'Priya Patel', 'priya.patel@team.org', 'Cloud & DevOps Specialist', 'staff', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80', '#059669', 'active', 'DevOps', '2026-08-03T11:00:00.000Z'),
    ('mem-5', 'David Kim', 'david.kim@team.org', 'QA Automation Lead', 'staff', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80', '#0891b2', 'away', 'Quality Assurance', '2026-08-05T14:00:00.000Z')
ON CONFLICT (id) DO NOTHING;

-- Insert Users (Auth)
INSERT INTO users (id, name, email, role, member_id, avatar, department, job_role)
VALUES
    ('usr-admin-1', 'Alex Morgan', 'alex.morgan@team.org', 'admin', 'mem-1', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80', 'Engineering', 'Project Manager & Lead'),
    ('usr-staff-2', 'Samantha Wu', 'samantha.wu@team.org', 'staff', 'mem-2', 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80', 'Engineering', 'Senior Full-Stack Engineer')
ON CONFLICT (id) DO NOTHING;

-- Insert Projects
INSERT INTO projects (id, name, description, client, status, start_date, target_deadline, manager_id, tags, color, created_at)
VALUES
    ('proj-1', 'Cloud Architecture Modernization', 'Transitioning legacy backend infrastructure to Kubernetes, containerized microservices, and automated CI/CD pipelines.', 'FinTech Systems', 'In Progress', '2026-08-15', '2026-09-28', 'mem-1', ARRAY['Cloud', 'Kubernetes', 'DevOps'], '#2563eb', '2026-08-15T09:00:00.000Z'),
    ('proj-2', 'Customer Support Portal Redesign', 'Modernizing customer help center, live chat widget, interactive knowledge base, and ticketing queue management.', 'OmniRetail Global', 'Pending', '2026-08-20', '2026-09-18', 'mem-1', ARRAY['Frontend', 'Portal', 'UX'], '#7c3aed', '2026-08-20T10:30:00.000Z'),
    ('proj-3', 'Mobile Banking Experience 2.0', 'Refactoring mobile application with biometric login, contactless quick-pay, and real-time expense charts.', 'Apex Horizon Bank', 'Blocked', '2026-08-10', '2026-09-14', 'mem-3', ARRAY['Mobile', 'iOS', 'Android'], '#ea580c', '2026-08-10T14:00:00.000Z'),
    ('proj-4', 'SOC-2 Compliance & Security Audit', 'Enterprise vulnerability remediation, zero-trust endpoint access validation, and audit evidence gathering.', 'Internal Engineering', 'Completed', '2026-07-01', '2026-08-30', 'mem-4', ARRAY['Security', 'Compliance', 'Audit'], '#059669', '2026-07-01T08:00:00.000Z')
ON CONFLICT (id) DO NOTHING;

-- Insert Project Members
INSERT INTO project_members (project_id, member_id)
VALUES
    ('proj-1', 'mem-1'), ('proj-1', 'mem-2'), ('proj-1', 'mem-4'), ('proj-1', 'mem-5'),
    ('proj-2', 'mem-1'), ('proj-2', 'mem-2'), ('proj-2', 'mem-3'),
    ('proj-3', 'mem-2'), ('proj-3', 'mem-3'), ('proj-3', 'mem-5'),
    ('proj-4', 'mem-1'), ('proj-4', 'mem-4')
ON CONFLICT (project_id, member_id) DO NOTHING;

-- Insert Tasks
INSERT INTO tasks (id, project_id, title, description, status, priority, assignee_id, created_by, start_date, due_date, created_at, updated_at)
VALUES
    ('task-101', 'proj-1', 'Migrate Core Payment API to GKE Cluster', 'Deploy container pods with autoscaling metrics and service mesh ingress routing.', 'In Progress', 'Urgent', 'mem-2', 'mem-1', '2026-09-01', CURRENT_DATE::text, '2026-09-01T10:00:00.000Z', '2026-09-03T10:00:00.000Z'),
    ('task-102', 'proj-1', 'Configure Multi-Region Database Read Replicas', 'Setup asynchronous cross-region read replicas with automated health-check failover.', 'In Progress', 'High', 'mem-4', 'mem-1', '2026-09-02', '2026-09-15', '2026-09-02T09:00:00.000Z', '2026-09-02T09:00:00.000Z'),
    ('task-103', 'proj-1', 'Automated Load Testing on Canary Deployment', 'Execute distributed test harness simulating high transaction volume under 99.9th percentile SLA.', 'Pending', 'Medium', 'mem-5', 'mem-1', '2026-09-12', '2026-09-20', '2026-09-02T14:00:00.000Z', '2026-09-02T14:00:00.000Z'),
    ('task-104', 'proj-1', 'Baseline Infrastructure As Code (Terraform)', 'Provision VPC, subnets, NAT gateways, and IAM service accounts with least-privilege roles.', 'Completed', 'High', 'mem-4', 'mem-1', '2026-08-16', '2026-08-28', '2026-08-16T08:00:00.000Z', '2026-08-28T16:00:00.000Z'),
    ('task-201', 'proj-2', 'Customer Ticket Routing & Intent Logic', 'Configure automated triage queue for customer returns, billing disputes, and technical support.', 'In Progress', 'High', 'mem-2', 'mem-1', '2026-08-25', '2026-09-12', '2026-08-25T10:00:00.000Z', '2026-09-03T11:00:00.000Z'),
    ('task-202', 'proj-2', 'Security & PII Data Privacy Review', 'Verify compliance sign-off on customer data scrubbing and token retention policy.', 'Pending', 'Urgent', 'mem-1', 'mem-1', '2026-08-28', '2026-09-08', '2026-08-28T11:00:00.000Z', '2026-08-28T11:00:00.000Z'),
    ('task-203', 'proj-2', 'Support Agent UI & Helpdesk Prototype', 'Interactive agent workspace showing customer ticket details and quick resolution actions.', 'Completed', 'Medium', 'mem-3', 'mem-1', '2026-08-21', '2026-09-02', '2026-08-21T09:00:00.000Z', '2026-09-02T17:00:00.000Z'),
    ('task-301', 'proj-3', 'Biometric SDK Vendor Credentials Renewal', 'FaceID and Android BiometricPrompt adapter. Blocked by vendor license renewal token.', 'Blocked', 'Urgent', 'mem-2', 'mem-1', '2026-08-22', '2026-09-07', '2026-08-22T09:00:00.000Z', '2026-09-03T08:00:00.000Z'),
    ('task-302', 'proj-3', 'Mobile Theme & Design Token Guidelines', 'High contrast accessible color palettes, typography scale, and responsive padding.', 'In Progress', 'Medium', 'mem-3', 'mem-1', '2026-08-29', '2026-09-11', '2026-08-29T10:00:00.000Z', '2026-09-01T10:00:00.000Z'),
    ('task-303', 'proj-3', 'End-to-End Fund Transfer Verification Flow', 'Recipient selection, 2FA confirmation modal, and instant receipt rendering.', 'Blocked', 'High', 'mem-5', 'mem-1', '2026-09-01', '2026-09-14', '2026-09-01T09:00:00.000Z', '2026-09-03T09:00:00.000Z'),
    ('task-401', 'proj-4', 'External Penetration Test Remediation', 'Third-party white-box pen test completed with zero critical findings remaining.', 'Completed', 'Urgent', 'mem-4', 'mem-1', '2026-08-01', '2026-08-20', '2026-08-01T09:00:00.000Z', '2026-08-20T17:00:00.000Z'),
    ('task-402', 'proj-4', 'Auditor Evidence Gathering & Matrix Export', 'Compiled cryptographic evidence, employee access logs, and change approval tickets.', 'Completed', 'High', 'mem-1', 'mem-1', '2026-08-10', '2026-08-28', '2026-08-10T09:00:00.000Z', '2026-08-28T18:00:00.000Z')
ON CONFLICT (id) DO NOTHING;
