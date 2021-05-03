const express = require("express");
const morgan = require("morgan");
const helmet = require("helmet");
const bodyParser = require("body-parser");
const cors = require("cors");
const slowDown = require("express-slow-down");
const rateLimit = require("express-rate-limit");
const { body, check, validationResult } = require("express-validator");

const { customAlphabet } = require("nanoid");
const nanoid = customAlphabet(
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
  8
);

const host = "url.jack-gooding.com";
require("dotenv").config();

const db = require("./helpers/database.js");

const server = express();

const speedLimiter = slowDown({
  windowMs: 5 * 60 * 1000, // 5 minutes
  delayAfter: 1, // allow 1 requests per 5 minutes, then...
  maxDelayMs: 5000,
  delayMs: 500, // begin adding 500ms of delay per request above 1:
  // request # 2 is delayed by  500ms
  // request # 3 is delayed by 1000ms
  // request # 4 is delayed by 1500ms
  // etc.
});

const rateLimiter = rateLimit({
  windowMs: 140 * 1000,
  max: 2,
  // message: "You have created too many URLs recently.",
  skipFailedRequests: true,
  handler: async (req, res) => {
    res.status(429).send({
      message: "You have created too many URLs recently.",
      limit: req.rateLimit.limit,
      current: req.rateLimit.current,
      remaining: req.rateLimit.remaining,
      resetTime: req.rateLimit.resetTime,
    });
  },
});

//  apply to all requests
server.use(speedLimiter);
//server.use(rateLimiter);

server.use(helmet());
server.use(morgan("dev"));
server.use(cors());
server.use(express.json());

server.get("/", async (req, res) => {
  res.json({
    message: "This is a URL shortener microservice, UI is available elsewhere!",
  });
});

server.get("/urls", async (req, res) => {
  let urls = db.selectUrls.all();

  urls.forEach((url) => {
    url.url = unescape(url.url);
  });

  res.status(200).json({ urls: urls });
});

server.get("/urls/count", async (req, res) => {
  let count = db.getUrlsCount.get();
  console.log(count);
  res.status(200).send(count);
});

server.get("/usages", async (req, res) => {
  let usages = db.selectUsages.all();
  res.status(200).json({ usages: usages });
});

server.get(
  "/usage/:slug",
  [
    check("slug")
      .trim()
      .isLength({ max: 40 })
      .withMessage("Slug too long. Please use a smaller slug.")
      .escape(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    let slug = req.params.slug;
    let isValid = await checkValidSlug(slug);

    console.log(slug);
    console.log(isValid);

    if (isValid) {
      try {
        let url = db.selectUrl.get(slug);
        let usages = db.selectUrlUsages.all(slug);
        if (url != null) {
          url.url = unescape(url.url);
          console.log(200);
          res.status(200).json({ url, usages });
        } else {
          console.log(404);
          res.status(404).send(`Could not find URL. Please try again.`);
        }
      } catch (e) {
        console.log(500);
        console.log(e);
        res.status(500).send(`An error occurred during lookup, sorry! ${e}`);
      }
    } else {
      console.log(400);
      res
        .status(400)
        .send(`Invalid Slug. Cannot contain spaces or special characters.`);
    }
  }
);

server.get(
  "/:slug",
  [
    check("slug")
      .trim()
      .isLength({ max: 40 })
      .withMessage("Slug too long. Please use a smaller slug.")
      .escape(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    let slug = req.params.slug;
    let isValid = await checkValidSlug(slug);
    if (isValid) {
      try {
        // console.log("slug");
        // console.log(slug);
        let entry = await db.selectUrl.get(slug);
        // console.log("entry");
        // console.log(entry);
        if (entry) {
          let record = await db.insertUsage.run(slug);
          // console.log("record");
          // console.log(record);
          let url = unescape(entry.url);
          res.redirect(url);
          //res.send(entry);
        } else {
          res.status(404).send("Sorry, url not found!");
        }
      } catch (e) {
        // console.log(e);
        res.status(500).send(`An error occurred during redirect, sorry! ${e}`);
      }
    } else {
      res
        .status(400)
        .send(`Invalid URL. Slug cannot contain spaces or special characters.`);
    }
  }
);

let checkValidURL = async (url) => {
  //URL pattern
  let regex = new RegExp(
    /[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)?/gi
  );
  let test = regex.test(url);

  return test;
};

let checkValidSlug = async (url) => {
  //Only allow a-z, A-Z, 0-9,
  let regex = new RegExp(/^([a-z]|[A-Z]|[0-9]){1,40}$/);
  let test = regex.test(url);

  return test;
};

let ensureHTTP = async (url) => {
  //URL pattern
  let regex = new RegExp("^(http|https)://");
  let test = regex.test(url);

  if (test === false) {
    url = "https://" + url;
  }

  return url;
};

server.post(
  "/url",
  rateLimiter,
  [
    check("slug")
      .trim()
      .isLength({ max: 60 })
      .withMessage("Slug too long. Please use a smaller slug.")
      .escape(),
    check("url").trim().escape(),
    check("description").trim().escape(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    console.log(req.body.url);

    let url = req.body.url;
    let slug = req.body.slug;
    let description = req.body.description;

    let slugExists = false;

    let validURL = await checkValidURL(url);
    let validSlug = await checkValidSlug(slug);
    // console.log(`URL Valid? : ${validURL}`);

    if (!validURL) {
      res.status(400).send("URL provided is not valid.");
      return;
    } else if (!validSlug && slug.length > 0) {
      res
        .status(400)
        .send(
          "Slug provided is not valid. Only characters a-Z, 0-9 are permitted."
        );
      return;
    } else {
      //I don't think this should be enforced.
      //url = await ensureHTTP(url);

      console.log(url);

      if (slug != null && slug.length > 0) {
        slugExists = await db.selectUrl.get(slug);
      } else {
        slug = nanoid();
      }

      try {
        if (!slugExists) {
          await db.insertUrl.run(url, slug, description);
        }
        res
          .status(slugExists ? 409 : 201)
          .send(
            slugExists
              ? `Slug '${slug}' exists, please use a different slug!`
              : { url: `${host}/${slug}` }
          );
      } catch (e) {
        res.status(500).send(`An error occurred: ${e}`);
      }
    }
  }
);

server.delete("/tables", async (req, res) => {
  db.dropUsagesTable.run();
  db.dropUrlsTable.run();
  res.status(204).send();
});

let port = 3021;
server.listen(port, async () => {
  console.log("Express server listening on port: " + port);
});
