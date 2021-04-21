const db = require("better-sqlite3")("urls.db");

const createUrlsTable = db.prepare(`CREATE TABLE IF NOT EXISTS urls (

  rowid INTEGER PRIMARY KEY,
  created TEXT NOT NULL,
  url TEXT NOT NULL,
  targetSlug TEXT UNIQUE

)`);

const createUsagesTable = db.prepare(`CREATE TABLE IF NOT EXISTS usages (

  rowid INTEGER PRIMARY KEY,
  accessedAt TEXT NOT NULL,
  slug TEXT,
  FOREIGN KEY (slug)
  REFERENCES urls (targetSlug)
)`);

createUrlsTable.run();
createUsagesTable.run();

const dropUrlsTable = db.prepare(`DROP TABLE IF EXISTS urls`);
const dropUsagesTable = db.prepare(`DROP TABLE IF EXISTS usages`);

const selectUrl = db.prepare(`SELECT *, COUNT(usages.rowid) as count FROM urls
                  LEFT JOIN usages ON urls.targetSlug = usages.slug
                  WHERE urls.targetSlug = ?
                  GROUP BY  urls.rowid, urls.targetSlug
                  `);

const selectUrls = db.prepare(`SELECT *, COUNT(usages.rowid) as count FROM urls
                  LEFT JOIN usages ON urls.targetSlug = usages.slug
                  GROUP BY  urls.rowid, urls.targetSlug
                  `);

const selectUsages = db.prepare(`SELECT * FROM usages`);

const selectUrlUsages = db.prepare(`SELECT * FROM usages WHERE slug = ?`);

const insertUrl = db.prepare(`INSERT INTO urls (
                    created,
                    url,
                    targetSlug
                  ) VALUES (
                    strftime('%Y-%m-%dT%H:%M:%SZ'),
                    ?,
                    ?
                  )`);

const insertUsage = db.prepare(`INSERT INTO usages (
            accessedAt,
            slug
          ) VALUES (
            strftime('%Y-%m-%dT%H:%M:%SZ'),
            ?
          )`);

module.exports = {
  dropUrlsTable,
  dropUsagesTable,
  selectUrl,
  selectUrls,
  selectUsages,
  selectUrlUsages,
  insertUrl,
  insertUsage,
};
