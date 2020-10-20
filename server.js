const express = require('express');
const morgan = require('morgan');
const helmet = require('helmet');
const bodyParser = require('body-parser');
const cors = require('cors');
const slowDown = require('express-slow-down');
const rateLimit = require('express-rate-limit');
const { customAlphabet } = require('nanoid');
const nanoid = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 8)

require('dotenv').config();

const db = require('./helpers/database.js');

const server = express();

const speedLimiter = slowDown({
  windowMs: 30 * 1000, // 15 minutes
  delayAfter: 1, // allow 100 requests per 15 minutes, then...
  maxDelayMs: 5000,
  delayMs: 500 // begin adding 500ms of delay per request above 100:
  // request # 101 is delayed by  500ms
  // request # 102 is delayed by 1000ms
  // request # 103 is delayed by 1500ms
  // etc.
});

const rateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 2,
});

//  apply to all requests
server.use(speedLimiter);
//server.use(rateLimiter);

server.use(helmet());
server.use(morgan('dev'));
server.use(cors());
server.use(express.json());

server.get('/', async (req, res) => {
  res.json({message: "This is a URL shortener, UI to come!"});
});

server.get('/urls', async (req, res) => {
  let urls = db.selectUrls.all();
  res.json({urls: urls});
});

server.get('/usages', async (req, res) => {
  let usages = db.selectUsages.all();
  res.json({usages: usages});
});

server.get('/url/:slug', async (req, res) => {
  let slug = req.params.slug;
  try {
    console.log("slug");
    console.log(slug);
    let record = await db.insertUsage.run(slug);
    console.log("record");
    console.log(record);
    let entry = await db.selectUrl.get(slug);
    console.log("entry");
    console.log(entry);
    if (entry) {
      let url = entry.url;
      res.redirect(url);
      //res.send(entry);
    } else {
      res.status(404).send("Oops, nothing found!");
    }

  }
  catch(e) {
    console.log(e);
    res.status(500).send(`An error occurred during redirect, sorry! ${e}`);
  }

});

server.post('/url', rateLimiter, async (req, res) => {
  console.log(req.body.url);

  let url = req.body.url;
  let slug = req.body.slug;
  let slugExists = false;

  if (slug != null && slug.length > 0) {

    slugExists = await db.selectUrl.get(slug);

  } else {
    slug = nanoid();
  }


  try {
    if (!slugExists) {
      await db.insertUrl.run(url, slug);

    };
    res.send(slugExists ? `Slug ${slug} Exists, try again!` : `Created: http://localhost:3021/url/${slug}`);
  } catch(e) {
    res.status(500).send(`An error occurred: ${e}`)
  };
});

server.delete('/tables', async (req, res) => {
  db.dropUsagesTable.run();
  db.dropUrlsTable.run();
  res.status(204).send();
});

let port = 3021;
server.listen(port, async () => {
  console.log("Express server listening on port: " + port);
});
