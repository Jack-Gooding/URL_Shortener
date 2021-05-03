const db = require("better-sqlite3")("urls.db");

const createUrlsTable = db
  .prepare(
    `ALTER TABLE urls
ADD COLUMN description TEXT
`
  )
  .run();
