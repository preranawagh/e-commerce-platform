'use strict';

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { Sequelize, QueryTypes } = require('sequelize');

dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

const command = process.argv[2] || 'setup';
const migrationsDir = path.join(__dirname, 'migrations');
const seedersDir = path.join(__dirname, 'seeders');

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    dialect: 'postgres',
    logging: false,
    ...sslOptions()
  }
);

function sslOptions() {
  if (process.env.DB_SSL !== 'true') {
    return {};
  }
  return {
    dialectOptions: {
      ssl: { require: true, rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
    }
  };
}

function listJsFiles(dir) {
  return fs.readdirSync(dir).filter((file) => file.endsWith('.js')).sort();
}

async function ensureMetaTable(tableName) {
  await sequelize.query(
    `CREATE TABLE IF NOT EXISTS "${tableName}" (name VARCHAR(255) NOT NULL PRIMARY KEY)`
  );
}

async function alreadyRan(tableName, name) {
  const rows = await sequelize.query(
    `SELECT name FROM "${tableName}" WHERE name = :name`,
    { replacements: { name }, type: QueryTypes.SELECT }
  );
  return rows.length > 0;
}

async function markRan(tableName, name) {
  await sequelize.query(
    `INSERT INTO "${tableName}" (name) VALUES (:name)`,
    { replacements: { name } }
  );
}

async function runMigrations() {
  await ensureMetaTable('SequelizeMeta');
  const files = listJsFiles(migrationsDir);
  console.log(`Found ${files.length} migration file(s) in ${migrationsDir}`);

  for (const file of files) {
    if (await alreadyRan('SequelizeMeta', file)) {
      console.log(`skip  ${file}`);
      continue;
    }
    console.log(`apply ${file}`);
    const migration = require(path.join(migrationsDir, file));
    await migration.up(sequelize.getQueryInterface(), Sequelize);
    await markRan('SequelizeMeta', file);
  }
}

async function runSeeders() {
  await ensureMetaTable('SequelizeData');
  const files = listJsFiles(seedersDir);
  console.log(`Found ${files.length} seeder file(s) in ${seedersDir}`);

  for (const file of files) {
    if (await alreadyRan('SequelizeData', file)) {
      console.log(`skip  ${file}`);
      continue;
    }
    console.log(`seed  ${file}`);
    const seeder = require(path.join(seedersDir, file));
    await seeder.up(sequelize.getQueryInterface(), Sequelize);
    await markRan('SequelizeData', file);
  }
}

// Reverts the most recently applied migration (same bookkeeping table as runMigrations).
async function undoLastMigration() {
  await ensureMetaTable('SequelizeMeta');
  const rows = await sequelize.query(
    'SELECT name FROM "SequelizeMeta" ORDER BY name DESC LIMIT 1',
    { type: QueryTypes.SELECT }
  );
  if (rows.length === 0) {
    console.log('No migrations to undo.');
    return;
  }
  const file = rows[0].name;
  console.log(`undo  ${file}`);
  const migration = require(path.join(migrationsDir, file));
  await migration.down(sequelize.getQueryInterface(), Sequelize);
  await sequelize.query('DELETE FROM "SequelizeMeta" WHERE name = :name', { replacements: { name: file } });
}

async function main() {
  const target = `${process.env.DB_HOST || 'localhost'}:${Number(process.env.DB_PORT || 5432)}/${process.env.DB_NAME}`;
  console.log(`Connecting to PostgreSQL at ${target}`);
  await sequelize.authenticate();

  if (command === 'migrate' || command === 'setup') {
    await runMigrations();
  }
  if (command === 'seed' || command === 'setup') {
    await runSeeders();
  }
  if (command === 'undo') {
    await undoLastMigration();
  }

  await sequelize.close();
  console.log('Done.');
}

main().catch(async (err) => {
  console.error(err);
  try {
    await sequelize.close();
  } catch {
    // ignore
  }
  process.exit(1);
});
