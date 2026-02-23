/**
 * Carbon Credit Depository — Projects registry (verified projects)
 * Phase 2 — Role: Link projectId to validator and optional oracle proof; credits reference projectId.
 */

const path = require('path');
const fs = require('fs');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const DEFAULT_DATA = { projects: [] };

/**
 * @param {string} filePath - Path to projects.json
 */
function createProjectsStore(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const adapter = new FileSync(filePath);
  const db = low(adapter);
  db.defaults(DEFAULT_DATA).write();

  return {
    getById(projectId) {
      return db.get('projects').find({ projectId: String(projectId) }).value();
    },

    list(activeOnly = false) {
      const chain = db.get('projects');
      const list = activeOnly ? chain.filter((p) => p.isActive !== false).value() : chain.value();
      return list;
    },

    getByValidatorId(validatorId) {
      return db.get('projects').filter((p) => p.validatorId === String(validatorId)).value();
    },

    add(record) {
      if (db.get('projects').find({ projectId: record.projectId }).value()) {
        throw new Error(`Depository: projectId already exists: ${record.projectId}`);
      }
      const now = Date.now();
      db.get('projects').push({ ...record, createdAt: now }).write();
    },

    update(projectId, updater) {
      const r = db.get('projects').find({ projectId: String(projectId) });
      const current = r.value();
      if (!current) throw new Error(`Depository: project not found: ${projectId}`);
      r.assign(updater(current)).write();
    },
  };
}

module.exports = { createProjectsStore };
