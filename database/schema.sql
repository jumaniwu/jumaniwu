-- ============================================================
-- propfs.id — Database Schema
-- Platform Manajemen Properti Terpadu
-- MySQL 8.0+ / PostgreSQL 14+
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================
-- CORE TABLES
-- ============================================================

CREATE TABLE companies (
  id                   BIGINT UNSIGNED   NOT NULL AUTO_INCREMENT,
  name                 VARCHAR(150)      NOT NULL,
  logo_url             VARCHAR(255)          NULL,
  address              TEXT                  NULL,
  phone                VARCHAR(20)           NULL,
  email                VARCHAR(150)          NULL,
  subscription_plan    ENUM('free','starter','pro','enterprise') NOT NULL DEFAULT 'free',
  subscription_ends_at TIMESTAMP             NULL,
  created_at           TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE users (
  id                   BIGINT UNSIGNED   NOT NULL AUTO_INCREMENT,
  company_id           BIGINT UNSIGNED       NULL,
  name                 VARCHAR(100)      NOT NULL,
  email                VARCHAR(150)      NOT NULL,
  phone                VARCHAR(20)           NULL,
  avatar_url           VARCHAR(255)          NULL,
  password_hash        VARCHAR(255)      NOT NULL,
  status               ENUM('active','inactive','suspended') NOT NULL DEFAULT 'active',
  email_verified_at    TIMESTAMP             NULL,
  created_at           TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  CONSTRAINT fk_users_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE notifications (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     BIGINT UNSIGNED NOT NULL,
  type        VARCHAR(50)     NOT NULL,
  title       VARCHAR(200)    NOT NULL,
  content     TEXT                NULL,
  entity_type VARCHAR(50)         NULL,
  entity_id   BIGINT UNSIGNED     NULL,
  read_at     TIMESTAMP           NULL,
  created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- FITUR 12: KEAMANAN & AKSES
-- (Didefinisikan duluan karena direferensikan oleh modul lain)
-- ============================================================

CREATE TABLE roles (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id  BIGINT UNSIGNED     NULL,
  name        VARCHAR(100)    NOT NULL,
  description TEXT                NULL,
  is_system   TINYINT(1)      NOT NULL DEFAULT 0,
  created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_roles_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE permissions (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name        VARCHAR(100)    NOT NULL,
  resource    VARCHAR(50)     NOT NULL,
  action      ENUM('create','read','update','delete','manage') NOT NULL,
  description TEXT                NULL,
  created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_permissions_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE role_permissions (
  role_id       BIGINT UNSIGNED NOT NULL,
  permission_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  CONSTRAINT fk_rp_role       FOREIGN KEY (role_id)       REFERENCES roles(id)       ON DELETE CASCADE,
  CONSTRAINT fk_rp_permission FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_roles (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     BIGINT UNSIGNED NOT NULL,
  role_id     BIGINT UNSIGNED NOT NULL,
  entity_type VARCHAR(50)         NULL,
  entity_id   BIGINT UNSIGNED     NULL,
  granted_by  BIGINT UNSIGNED     NULL,
  created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_user_role_scope (user_id, role_id, entity_type, entity_id),
  CONSTRAINT fk_ur_user      FOREIGN KEY (user_id)    REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_ur_role      FOREIGN KEY (role_id)    REFERENCES roles(id) ON DELETE CASCADE,
  CONSTRAINT fk_ur_granted   FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE audit_logs (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id    BIGINT UNSIGNED     NULL,
  user_id       BIGINT UNSIGNED     NULL,
  action        VARCHAR(100)    NOT NULL,
  resource_type VARCHAR(50)     NOT NULL,
  resource_id   BIGINT UNSIGNED     NULL,
  old_values    JSON                NULL,
  new_values    JSON                NULL,
  ip_address    VARCHAR(45)         NULL,
  user_agent    VARCHAR(500)        NULL,
  created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_al_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL,
  CONSTRAINT fk_al_user    FOREIGN KEY (user_id)    REFERENCES users(id)     ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- FITUR 2: MANAJEMEN PROYEK
-- ============================================================

CREATE TABLE projects (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id    BIGINT UNSIGNED NOT NULL,
  parent_id     BIGINT UNSIGNED     NULL,
  title         VARCHAR(200)    NOT NULL,
  description   TEXT                NULL,
  type          ENUM('konstruksi','renovasi','pengembangan','lainnya') NOT NULL DEFAULT 'konstruksi',
  status        ENUM('estimate','before_work','in_progress','completed','cancelled')  NOT NULL DEFAULT 'estimate',
  start_date    DATE                NULL,
  end_date      DATE                NULL,
  actual_start  DATE                NULL,
  actual_end    DATE                NULL,
  budget        DECIMAL(15,2)       NULL,
  actual_cost   DECIMAL(15,2)   NOT NULL DEFAULT 0.00,
  progress      DECIMAL(5,2)    NOT NULL DEFAULT 0.00 COMMENT '0.00-100.00 persen',
  owner_id      BIGINT UNSIGNED NOT NULL,
  created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_proj_company  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT fk_proj_parent   FOREIGN KEY (parent_id)  REFERENCES projects(id)  ON DELETE SET NULL,
  CONSTRAINT fk_proj_owner    FOREIGN KEY (owner_id)   REFERENCES users(id)     ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE project_members (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  project_id  BIGINT UNSIGNED NOT NULL,
  user_id     BIGINT UNSIGNED NOT NULL,
  role        ENUM('owner','manager','member','viewer','contractor') NOT NULL DEFAULT 'member',
  invited_by  BIGINT UNSIGNED     NULL,
  joined_at   TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pm (project_id, user_id),
  CONSTRAINT fk_pm_project    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_pm_user       FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
  CONSTRAINT fk_pm_invited    FOREIGN KEY (invited_by) REFERENCES users(id)    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE project_stages (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  project_id    BIGINT UNSIGNED NOT NULL,
  name          VARCHAR(100)    NOT NULL,
  description   TEXT                NULL,
  sort_order    SMALLINT        NOT NULL DEFAULT 0,
  status        ENUM('pending','in_progress','completed') NOT NULL DEFAULT 'pending',
  planned_start DATE                NULL,
  planned_end   DATE                NULL,
  actual_start  DATE                NULL,
  actual_end    DATE                NULL,
  created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_ps_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- FITUR 3: MANAJEMEN AGEN
-- ============================================================

CREATE TABLE agents (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id         BIGINT UNSIGNED NOT NULL,
  company_id      BIGINT UNSIGNED NOT NULL,
  license_number  VARCHAR(100)        NULL,
  commission_rate DECIMAL(5,2)    NOT NULL DEFAULT 0.00,
  specialization  SET('residensial','komersial','industri','tanah') NULL,
  bio             TEXT                NULL,
  status          ENUM('active','inactive') NOT NULL DEFAULT 'active',
  joined_at       DATE                NULL,
  created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_agent_user (user_id),
  CONSTRAINT fk_ag_user    FOREIGN KEY (user_id)    REFERENCES users(id)     ON DELETE CASCADE,
  CONSTRAINT fk_ag_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE agent_targets (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  agent_id        BIGINT UNSIGNED NOT NULL,
  period          CHAR(7)         NOT NULL COMMENT 'YYYY-MM',
  target_listings INT             NOT NULL DEFAULT 0,
  target_revenue  DECIMAL(15,2)   NOT NULL DEFAULT 0.00,
  created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_at (agent_id, period),
  CONSTRAINT fk_at_agent FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE agent_performance (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  agent_id        BIGINT UNSIGNED NOT NULL,
  period          CHAR(7)         NOT NULL COMMENT 'YYYY-MM',
  listings_added  INT             NOT NULL DEFAULT 0,
  listings_sold   INT             NOT NULL DEFAULT 0,
  revenue         DECIMAL(15,2)   NOT NULL DEFAULT 0.00,
  commission      DECIMAL(15,2)   NOT NULL DEFAULT 0.00,
  created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ap (agent_id, period),
  CONSTRAINT fk_aperf_agent FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- FITUR 1: MANAJEMEN LISTING
-- ============================================================

CREATE TABLE listings (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id    BIGINT UNSIGNED NOT NULL,
  project_id    BIGINT UNSIGNED     NULL,
  agent_id      BIGINT UNSIGNED     NULL,
  title         VARCHAR(200)    NOT NULL,
  description   TEXT                NULL,
  type          ENUM('rumah','apartemen','kavling','ruko','gudang','kantor') NOT NULL,
  status        ENUM('available','reserved','sold','off_market') NOT NULL DEFAULT 'available',
  price         DECIMAL(15,2)       NULL,
  price_type    ENUM('jual','sewa')     NULL,
  address       TEXT                NULL,
  city          VARCHAR(100)        NULL,
  province      VARCHAR(100)        NULL,
  lat           DECIMAL(10,8)       NULL,
  lng           DECIMAL(11,8)       NULL,
  land_area     DECIMAL(10,2)       NULL COMMENT 'm2',
  building_area DECIMAL(10,2)       NULL COMMENT 'm2',
  floors        TINYINT UNSIGNED    NULL,
  bedrooms      TINYINT UNSIGNED    NULL,
  bathrooms     TINYINT UNSIGNED    NULL,
  carports      TINYINT UNSIGNED    NULL,
  certificate   ENUM('SHM','HGB','SHSRS','Girik','Lainnya') NULL,
  created_by    BIGINT UNSIGNED NOT NULL,
  created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_lst_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT fk_lst_project FOREIGN KEY (project_id) REFERENCES projects(id)  ON DELETE SET NULL,
  CONSTRAINT fk_lst_agent   FOREIGN KEY (agent_id)   REFERENCES agents(id)    ON DELETE SET NULL,
  CONSTRAINT fk_lst_creator FOREIGN KEY (created_by) REFERENCES users(id)     ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE listing_photos (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  listing_id  BIGINT UNSIGNED NOT NULL,
  url         VARCHAR(255)    NOT NULL,
  caption     VARCHAR(200)        NULL,
  is_primary  TINYINT(1)      NOT NULL DEFAULT 0,
  sort_order  SMALLINT        NOT NULL DEFAULT 0,
  created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_lp_listing FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE listing_attributes (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  listing_id      BIGINT UNSIGNED NOT NULL,
  attribute_name  VARCHAR(100)    NOT NULL,
  attribute_value VARCHAR(200)        NULL,
  created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_la_listing FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- FITUR 4: DASHBOARD PERUSAHAAN
-- ============================================================

CREATE TABLE company_dashboard_cache (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id          BIGINT UNSIGNED NOT NULL,
  period              CHAR(7)         NOT NULL COMMENT 'YYYY-MM',
  total_projects      INT             NOT NULL DEFAULT 0,
  active_projects     INT             NOT NULL DEFAULT 0,
  completed_projects  INT             NOT NULL DEFAULT 0,
  on_schedule         INT             NOT NULL DEFAULT 0,
  behind_schedule     INT             NOT NULL DEFAULT 0,
  total_listings      INT             NOT NULL DEFAULT 0,
  available           INT             NOT NULL DEFAULT 0,
  sold                INT             NOT NULL DEFAULT 0,
  total_agents        INT             NOT NULL DEFAULT 0,
  total_revenue       DECIMAL(15,2)   NOT NULL DEFAULT 0.00,
  planned_revenue     DECIMAL(15,2)   NOT NULL DEFAULT 0.00,
  refreshed_at        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cdc (company_id, period),
  CONSTRAINT fk_cdc_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE company_cost_entries (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  project_id      BIGINT UNSIGNED NOT NULL,
  category        VARCHAR(100)    NOT NULL,
  description     TEXT                NULL,
  planned_amount  DECIMAL(15,2)       NULL,
  actual_amount   DECIMAL(15,2)       NULL,
  entry_date      DATE            NOT NULL,
  created_by      BIGINT UNSIGNED NOT NULL,
  created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_cce_project   FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_cce_creator   FOREIGN KEY (created_by) REFERENCES users(id)    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- FITUR 5: ANALITIK & LAPORAN
-- ============================================================

CREATE TABLE report_templates (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id    BIGINT UNSIGNED NOT NULL,
  name          VARCHAR(150)    NOT NULL,
  type          VARCHAR(50)     NOT NULL,
  fields_config JSON                NULL,
  created_by    BIGINT UNSIGNED NOT NULL,
  created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_rt_company   FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT fk_rt_creator   FOREIGN KEY (created_by) REFERENCES users(id)     ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE reports (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id    BIGINT UNSIGNED NOT NULL,
  template_id   BIGINT UNSIGNED     NULL,
  title         VARCHAR(200)    NOT NULL,
  type          VARCHAR(50)     NOT NULL,
  parameters    JSON                NULL,
  result_url    VARCHAR(500)        NULL,
  status        ENUM('pending','processing','done','failed') NOT NULL DEFAULT 'pending',
  generated_by  BIGINT UNSIGNED NOT NULL,
  created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_rep_company   FOREIGN KEY (company_id)  REFERENCES companies(id)         ON DELETE CASCADE,
  CONSTRAINT fk_rep_template  FOREIGN KEY (template_id) REFERENCES report_templates(id)  ON DELETE SET NULL,
  CONSTRAINT fk_rep_generator FOREIGN KEY (generated_by) REFERENCES users(id)            ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- FITUR 6: FOTO & DOKUMEN
-- ============================================================

CREATE TABLE folders (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  parent_id   BIGINT UNSIGNED     NULL,
  company_id  BIGINT UNSIGNED NOT NULL,
  entity_type VARCHAR(50)         NULL,
  entity_id   BIGINT UNSIGNED     NULL,
  name        VARCHAR(150)    NOT NULL,
  created_by  BIGINT UNSIGNED NOT NULL,
  created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_fol_parent  FOREIGN KEY (parent_id)  REFERENCES folders(id)   ON DELETE SET NULL,
  CONSTRAINT fk_fol_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT fk_fol_creator FOREIGN KEY (created_by) REFERENCES users(id)     ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE files (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  folder_id     BIGINT UNSIGNED     NULL,
  company_id    BIGINT UNSIGNED NOT NULL,
  entity_type   VARCHAR(50)         NULL,
  entity_id     BIGINT UNSIGNED     NULL,
  name          VARCHAR(255)    NOT NULL,
  mime_type     VARCHAR(100)        NULL,
  size_bytes    BIGINT UNSIGNED     NULL,
  storage_url   VARCHAR(500)    NOT NULL,
  thumbnail_url VARCHAR(500)        NULL,
  version       SMALLINT        NOT NULL DEFAULT 1,
  uploaded_by   BIGINT UNSIGNED NOT NULL,
  created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_fil_folder  FOREIGN KEY (folder_id)  REFERENCES folders(id)   ON DELETE SET NULL,
  CONSTRAINT fk_fil_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT fk_fil_uploader FOREIGN KEY (uploaded_by) REFERENCES users(id)   ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE file_versions (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  file_id     BIGINT UNSIGNED NOT NULL,
  version     SMALLINT        NOT NULL,
  storage_url VARCHAR(500)    NOT NULL,
  uploaded_by BIGINT UNSIGNED NOT NULL,
  created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_fv_file     FOREIGN KEY (file_id)    REFERENCES files(id) ON DELETE CASCADE,
  CONSTRAINT fk_fv_uploader FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- FITUR 7: LAPORAN FOTO
-- ============================================================

CREATE TABLE photo_report_templates (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id    BIGINT UNSIGNED NOT NULL,
  name          VARCHAR(150)    NOT NULL,
  layout_config JSON                NULL,
  created_by    BIGINT UNSIGNED NOT NULL,
  created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_prt_company  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT fk_prt_creator  FOREIGN KEY (created_by) REFERENCES users(id)     ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE photo_reports (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  project_id  BIGINT UNSIGNED NOT NULL,
  template_id BIGINT UNSIGNED     NULL,
  title       VARCHAR(200)    NOT NULL,
  status      ENUM('draft','review','approved','published') NOT NULL DEFAULT 'draft',
  pdf_url     VARCHAR(500)        NULL,
  created_by  BIGINT UNSIGNED NOT NULL,
  created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_pr_project   FOREIGN KEY (project_id)  REFERENCES projects(id)               ON DELETE CASCADE,
  CONSTRAINT fk_pr_template  FOREIGN KEY (template_id) REFERENCES photo_report_templates(id) ON DELETE SET NULL,
  CONSTRAINT fk_pr_creator   FOREIGN KEY (created_by)  REFERENCES users(id)                  ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE photo_report_items (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  report_id     BIGINT UNSIGNED NOT NULL,
  file_id       BIGINT UNSIGNED NOT NULL,
  caption       TEXT                NULL,
  location_name VARCHAR(200)        NULL,
  taken_at      TIMESTAMP           NULL,
  page_number   SMALLINT        NOT NULL DEFAULT 1,
  sort_order    SMALLINT        NOT NULL DEFAULT 0,
  created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_pri_report FOREIGN KEY (report_id) REFERENCES photo_reports(id) ON DELETE CASCADE,
  CONSTRAINT fk_pri_file   FOREIGN KEY (file_id)   REFERENCES files(id)         ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- FITUR 8: CHAT & KOMUNIKASI
-- ============================================================

CREATE TABLE chat_rooms (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id  BIGINT UNSIGNED NOT NULL,
  type        ENUM('project','task','group','direct') NOT NULL DEFAULT 'group',
  name        VARCHAR(150)        NULL,
  entity_type VARCHAR(50)         NULL,
  entity_id   BIGINT UNSIGNED     NULL,
  created_by  BIGINT UNSIGNED NOT NULL,
  created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_cr_company  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT fk_cr_creator  FOREIGN KEY (created_by) REFERENCES users(id)     ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE chat_members (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  room_id     BIGINT UNSIGNED NOT NULL,
  user_id     BIGINT UNSIGNED NOT NULL,
  role        ENUM('admin','member') NOT NULL DEFAULT 'member',
  last_read_at TIMESTAMP              NULL,
  joined_at   TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cm (room_id, user_id),
  CONSTRAINT fk_cm_room FOREIGN KEY (room_id)  REFERENCES chat_rooms(id) ON DELETE CASCADE,
  CONSTRAINT fk_cm_user FOREIGN KEY (user_id)  REFERENCES users(id)      ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE chat_messages (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  room_id     BIGINT UNSIGNED NOT NULL,
  sender_id   BIGINT UNSIGNED NOT NULL,
  content     TEXT                NULL,
  type        ENUM('text','image','file','system') NOT NULL DEFAULT 'text',
  file_id     BIGINT UNSIGNED     NULL,
  reply_to_id BIGINT UNSIGNED     NULL,
  created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at  TIMESTAMP           NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_msg_room     FOREIGN KEY (room_id)     REFERENCES chat_rooms(id)    ON DELETE CASCADE,
  CONSTRAINT fk_msg_sender   FOREIGN KEY (sender_id)   REFERENCES users(id)         ON DELETE RESTRICT,
  CONSTRAINT fk_msg_file     FOREIGN KEY (file_id)     REFERENCES files(id)         ON DELETE SET NULL,
  CONSTRAINT fk_msg_reply    FOREIGN KEY (reply_to_id) REFERENCES chat_messages(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- FITUR 9: KALENDER JADWAL
-- ============================================================

CREATE TABLE calendar_events (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id      BIGINT UNSIGNED NOT NULL,
  title           VARCHAR(200)    NOT NULL,
  description     TEXT                NULL,
  type            ENUM('meeting','deadline','site_visit','inspection','personal') NOT NULL DEFAULT 'meeting',
  entity_type     VARCHAR(50)         NULL,
  entity_id       BIGINT UNSIGNED     NULL,
  start_datetime  DATETIME        NOT NULL,
  end_datetime    DATETIME        NOT NULL,
  all_day         TINYINT(1)      NOT NULL DEFAULT 0,
  location        VARCHAR(200)        NULL,
  color           CHAR(7)         NOT NULL DEFAULT '#1B2A4A',
  recurrence_rule VARCHAR(200)        NULL COMMENT 'RFC 5545 RRULE',
  created_by      BIGINT UNSIGNED NOT NULL,
  created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_ce_company  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT fk_ce_creator  FOREIGN KEY (created_by) REFERENCES users(id)     ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE event_attendees (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_id    BIGINT UNSIGNED NOT NULL,
  user_id     BIGINT UNSIGNED NOT NULL,
  status      ENUM('pending','accepted','declined') NOT NULL DEFAULT 'pending',
  responded_at TIMESTAMP          NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ea (event_id, user_id),
  CONSTRAINT fk_ea_event FOREIGN KEY (event_id) REFERENCES calendar_events(id) ON DELETE CASCADE,
  CONSTRAINT fk_ea_user  FOREIGN KEY (user_id)  REFERENCES users(id)           ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- FITUR 10: ALUR PERSETUJUAN
-- ============================================================

CREATE TABLE approval_templates (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id    BIGINT UNSIGNED NOT NULL,
  name          VARCHAR(150)    NOT NULL,
  type          VARCHAR(50)     NOT NULL,
  steps_config  JSON                NULL,
  created_by    BIGINT UNSIGNED NOT NULL,
  created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_apt_company  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT fk_apt_creator  FOREIGN KEY (created_by) REFERENCES users(id)     ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE approval_requests (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id  BIGINT UNSIGNED NOT NULL,
  template_id BIGINT UNSIGNED     NULL,
  type        VARCHAR(50)     NOT NULL,
  title       VARCHAR(200)    NOT NULL,
  description TEXT                NULL,
  entity_type VARCHAR(50)         NULL,
  entity_id   BIGINT UNSIGNED     NULL,
  attachments JSON                NULL,
  status      ENUM('pending','in_review','approved','rejected','cancelled') NOT NULL DEFAULT 'pending',
  requester_id BIGINT UNSIGNED NOT NULL,
  created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_ar_company   FOREIGN KEY (company_id)  REFERENCES companies(id)          ON DELETE CASCADE,
  CONSTRAINT fk_ar_template  FOREIGN KEY (template_id) REFERENCES approval_templates(id) ON DELETE SET NULL,
  CONSTRAINT fk_ar_requester FOREIGN KEY (requester_id) REFERENCES users(id)             ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE approval_steps (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  request_id  BIGINT UNSIGNED NOT NULL,
  step_order  TINYINT         NOT NULL,
  approver_id BIGINT UNSIGNED NOT NULL,
  status      ENUM('waiting','approved','rejected') NOT NULL DEFAULT 'waiting',
  comment     TEXT                NULL,
  decided_at  TIMESTAMP           NULL,
  created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_as_request  FOREIGN KEY (request_id)  REFERENCES approval_requests(id) ON DELETE CASCADE,
  CONSTRAINT fk_as_approver FOREIGN KEY (approver_id) REFERENCES users(id)             ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- FITUR 11: PAPAN PENGUMUMAN
-- ============================================================

CREATE TABLE announcements (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id   BIGINT UNSIGNED NOT NULL,
  entity_type  VARCHAR(50)         NULL,
  entity_id    BIGINT UNSIGNED     NULL,
  title        VARCHAR(200)    NOT NULL,
  content      TEXT            NOT NULL,
  priority     ENUM('low','normal','high','urgent') NOT NULL DEFAULT 'normal',
  pinned       TINYINT(1)      NOT NULL DEFAULT 0,
  published_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at   TIMESTAMP           NULL,
  author_id    BIGINT UNSIGNED NOT NULL,
  created_at   TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_ann_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT fk_ann_author  FOREIGN KEY (author_id)  REFERENCES users(id)     ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE announcement_reads (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  announcement_id BIGINT UNSIGNED NOT NULL,
  user_id         BIGINT UNSIGNED NOT NULL,
  read_at         TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ar (announcement_id, user_id),
  CONSTRAINT fk_anr_announcement FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE,
  CONSTRAINT fk_anr_user         FOREIGN KEY (user_id)         REFERENCES users(id)         ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE announcement_attachments (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  announcement_id BIGINT UNSIGNED NOT NULL,
  file_id         BIGINT UNSIGNED NOT NULL,
  created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_ana_announcement FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE,
  CONSTRAINT fk_ana_file         FOREIGN KEY (file_id)         REFERENCES files(id)         ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- INDEXES PERFORMA KRITIS
-- ============================================================

CREATE INDEX idx_users_company          ON users(company_id);
CREATE INDEX idx_notifications_user     ON notifications(user_id, read_at);
CREATE INDEX idx_listings_company_status ON listings(company_id, status);
CREATE INDEX idx_listings_agent         ON listings(agent_id);
CREATE INDEX idx_listings_project       ON listings(project_id);
CREATE INDEX idx_projects_company_status ON projects(company_id, status);
CREATE INDEX idx_projects_parent        ON projects(parent_id);
CREATE INDEX idx_project_members_user   ON project_members(user_id);
CREATE INDEX idx_files_entity           ON files(entity_type, entity_id);
CREATE INDEX idx_files_folder           ON files(folder_id);
CREATE INDEX idx_chat_messages_room     ON chat_messages(room_id, created_at);
CREATE INDEX idx_calendar_events_dates  ON calendar_events(start_datetime, end_datetime);
CREATE INDEX idx_calendar_events_entity ON calendar_events(entity_type, entity_id);
CREATE INDEX idx_approval_requests_co   ON approval_requests(company_id, status);
CREATE INDEX idx_approval_steps_req     ON approval_steps(request_id, step_order);
CREATE INDEX idx_announcements_company  ON announcements(company_id, pinned, published_at);
CREATE INDEX idx_audit_logs_resource    ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_user        ON audit_logs(user_id, created_at);
CREATE INDEX idx_agent_perf_period      ON agent_performance(agent_id, period);

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- SEED: System Permissions (contoh)
-- ============================================================

INSERT INTO permissions (name, resource, action, description) VALUES
  ('listing.create',  'listing',  'create', 'Tambah listing baru'),
  ('listing.read',    'listing',  'read',   'Lihat listing'),
  ('listing.update',  'listing',  'update', 'Edit listing'),
  ('listing.delete',  'listing',  'delete', 'Hapus listing'),
  ('project.create',  'project',  'create', 'Buat proyek baru'),
  ('project.read',    'project',  'read',   'Lihat proyek'),
  ('project.update',  'project',  'update', 'Edit proyek'),
  ('project.delete',  'project',  'delete', 'Hapus proyek'),
  ('agent.manage',    'agent',    'manage', 'Kelola seluruh agen'),
  ('report.create',   'report',   'create', 'Buat laporan'),
  ('report.read',     'report',   'read',   'Lihat laporan'),
  ('approval.manage', 'approval', 'manage', 'Kelola alur persetujuan'),
  ('user.manage',     'user',     'manage', 'Kelola pengguna'),
  ('role.manage',     'role',     'manage', 'Kelola peran & izin');

-- System Roles
INSERT INTO roles (company_id, name, description, is_system) VALUES
  (NULL, 'Super Admin',  'Akses penuh ke seluruh sistem',          1),
  (NULL, 'Admin',        'Akses penuh dalam perusahaan',           1),
  (NULL, 'Manajer',      'Kelola proyek dan tim',                  1),
  (NULL, 'Agen',         'Kelola listing dan klien',               1),
  (NULL, 'Staf Lapangan','Input data dan laporan lapangan',        1),
  (NULL, 'Viewer',       'Hanya baca data',                        1);
