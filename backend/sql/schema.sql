CREATE DATABASE IF NOT EXISTS task_scheduler;
USE task_scheduler;

CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  contact_number VARCHAR(20),
  profile_picture VARCHAR(500),
  role ENUM('admin', 'team_lead', 'member') DEFAULT 'member',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  INDEX idx_users_email (email),
  INDEX idx_users_role (role)
);

CREATE TABLE IF NOT EXISTS projects (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL UNIQUE,
  client_name VARCHAR(100),
  project_source VARCHAR(100),
  lead_reviewed_by INT NOT NULL,
  internal_notes TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (lead_reviewed_by) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_projects_lead (lead_reviewed_by),
  INDEX idx_projects_active (is_active)
);

CREATE TABLE IF NOT EXISTS project_members (
  id INT PRIMARY KEY AUTO_INCREMENT,
  project_id INT NOT NULL,
  member_id INT NOT NULL,
  added_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_project_member (project_id, member_id),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (member_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_project_members_project (project_id),
  INDEX idx_project_members_member (member_id)
);

CREATE TABLE IF NOT EXISTS sprints (
  id INT PRIMARY KEY AUTO_INCREMENT,
  project_id INT NOT NULL,
  name VARCHAR(120) NOT NULL,
  goal TEXT,
  start_date DATE NULL,
  end_date DATE NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_sprints_project_name (project_id, name),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_sprints_project (project_id)
);

CREATE TABLE IF NOT EXISTS tasks (
  id INT PRIMARY KEY AUTO_INCREMENT,
  project_id INT NOT NULL,
  task_name VARCHAR(150) NOT NULL,
  description TEXT,
  assigned_to INT NOT NULL,
  estimated_time INT NOT NULL COMMENT 'in hours',
  due_date DATE,
  priority ENUM('low', 'medium', 'high') DEFAULT 'medium',
  status ENUM('open', 'in_progress', 'review', 'complete', 'dependence') DEFAULT 'open',
  created_by INT NOT NULL,
  sprint_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (sprint_id) REFERENCES sprints(id) ON DELETE SET NULL,
  INDEX idx_tasks_project (project_id),
  INDEX idx_tasks_assigned_to (assigned_to),
  INDEX idx_tasks_status (status),
  INDEX idx_tasks_priority (priority)
);

CREATE TABLE IF NOT EXISTS task_status_history (
  id INT PRIMARY KEY AUTO_INCREMENT,
  task_id INT NOT NULL,
  previous_status ENUM('open', 'in_progress', 'review', 'complete', 'dependence'),
  new_status ENUM('open', 'in_progress', 'review', 'complete', 'dependence') NOT NULL,
  changed_by INT NOT NULL,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_status_history_task (task_id)
);

CREATE TABLE IF NOT EXISTS time_entries (
  id INT PRIMARY KEY AUTO_INCREMENT,
  task_id INT NOT NULL,
  logged_by INT NOT NULL,
  time_logged DECIMAL(10, 4) NOT NULL COMMENT 'in hours',
  date_logged DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (logged_by) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_time_entries_task (task_id),
  INDEX idx_time_entries_logged_by (logged_by)
);

CREATE TABLE IF NOT EXISTS task_comments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  task_id INT NOT NULL,
  commented_by INT NOT NULL,
  comment_text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (commented_by) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_comments_task (task_id)
);

CREATE TABLE IF NOT EXISTS task_messages (
  id INT PRIMARY KEY AUTO_INCREMENT,
  task_id INT NOT NULL,
  sender_id INT NOT NULL,
  message_text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_messages_task (task_id),
  INDEX idx_messages_sender (sender_id)
);

CREATE TABLE IF NOT EXISTS task_assignees (
  id INT PRIMARY KEY AUTO_INCREMENT,
  task_id INT NOT NULL,
  member_id INT NOT NULL,
  assignee_status ENUM('active', 'dependence', 'released') DEFAULT 'active',
  added_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_task_member (task_id, member_id),
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (member_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_task_assignees_task (task_id),
  INDEX idx_task_assignees_member (member_id)
);

CREATE TABLE IF NOT EXISTS project_notes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  project_id INT NOT NULL,
  note_text TEXT NOT NULL,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_project_notes_project (project_id),
  INDEX idx_project_notes_created_by (created_by)
);

CREATE TABLE IF NOT EXISTS project_note_assignees (
  id INT PRIMARY KEY AUTO_INCREMENT,
  project_note_id INT NOT NULL,
  user_id INT NOT NULL,
  UNIQUE KEY uq_project_note_user (project_note_id, user_id),
  FOREIGN KEY (project_note_id) REFERENCES project_notes(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_project_note_assignees_note (project_note_id),
  INDEX idx_project_note_assignees_user (user_id)
);

CREATE TABLE IF NOT EXISTS task_notes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  task_id INT NOT NULL,
  note_text TEXT NOT NULL,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_task_notes_task (task_id),
  INDEX idx_task_notes_created_by (created_by)
);

CREATE TABLE IF NOT EXISTS task_note_assignees (
  id INT PRIMARY KEY AUTO_INCREMENT,
  task_note_id INT NOT NULL,
  user_id INT NOT NULL,
  UNIQUE KEY uq_task_note_user (task_note_id, user_id),
  FOREIGN KEY (task_note_id) REFERENCES task_notes(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_task_note_assignees_note (task_note_id),
  INDEX idx_task_note_assignees_user (user_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  type ENUM('task_assigned', 'comment_added', 'task_status_changed', 'overdue_alert', 'new_chat_message') NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  reference_id INT NOT NULL,
  reference_type ENUM('task', 'project') NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_notifications_user (user_id),
  INDEX idx_notifications_unread (user_id, is_read),
  INDEX idx_notifications_type_created (type, created_at)
);

CREATE TABLE IF NOT EXISTS user_push_subscriptions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  onesignal_player_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_push_subscription (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_push_player (onesignal_player_id)
);

CREATE TABLE IF NOT EXISTS comment_edit_history (
  id INT PRIMARY KEY AUTO_INCREMENT,
  comment_id INT NOT NULL,
  edited_by INT NOT NULL,
  previous_text TEXT,
  new_text TEXT NOT NULL,
  edited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (comment_id) REFERENCES task_comments(id) ON DELETE CASCADE,
  FOREIGN KEY (edited_by) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_comment_history_comment (comment_id)
);

CREATE TABLE IF NOT EXISTS task_reassignments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  task_id INT NOT NULL,
  assigned_from INT NOT NULL,
  assigned_to INT NOT NULL,
  reassigned_by INT NOT NULL,
  reassignment_reason TEXT,
  reassigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_from) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (reassigned_by) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_reassignments_task (task_id)
);
