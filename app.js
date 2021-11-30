const fs = require("fs");
const datasetFile = __dirname + "/AI Dataset.json";
const Datastore = require("nedb");

let database = new Datastore({});

const readFile = (filePath) => {
  return new Promise(function (resolve, reject) {
    fs.readFile(filePath, "utf8", function (err, data) {
      if (err) return reject(err);
      return resolve(data);
    });
  });
};

async function storeData() {
  let data = await readFile(datasetFile);
  let datasets = JSON.parse(data);
  datasets.map((project) => {
    project["Project Phase Actual Start Date"] = new Date(
      project["Project Phase Actual Start Date"]
    );
    project["Project Phase Planned End Date"] = new Date(
      project["Project Phase Planned End Date"]
    );
    project["Project Phase Actual End Date"] = new Date(
      project["Project Phase Actual End Date"]
    );
    return project;
  });
  database.insert(datasets);
}

storeData().catch((err) => console.error(err));

const express = require("express");
const app = express();

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.use((req, res, next) => {
  console.log("HTTP request", req.method, req.url, req.body);
  next();
});

app.get("/api/projects/", (req, res, next) => {
  let page = req.query.page;
  let limit = req.query.limit || 10;
  if (!page) {
    page = 0;
    limit = 0;
  }

  let queryObject = {
    "Project School Name": req.query.psn || "",
    "Project Description": req.query.pd || "",
    "Project Phase Actual Start Date": req.query.ppasd
      ? { $gt: new Date(req.query.ppasd) }
      : "",
    "Project Phase Planned End Date": req.query.ppped
      ? { $gt: new Date(req.query.ppped) }
      : "",
    "Project Phase Actual End Date": req.query.ppaed
      ? { $gt: new Date(req.query.ppaed) }
      : "",
  };

  Object.entries(queryObject).forEach(([k, v]) => {
    if (!v) delete queryObject[k];
  });

  database
    .find(queryObject)
    .skip(page * limit)
    .limit(limit)
    .exec(function (err, result) {
      if (err) return res.status(500).end(err);
      return res.json(result);
    });
});

app.put("/api/projects/", function (req, res, next) {
  if (!("_id" in req.body)) return res.status(400).end("_id is missing");
  const id = req.body._id;
  let updateObject = req.body;
  Object.entries(updateObject).forEach(([k, v]) => {
    if (
      k != "Project Phase Actual Start Date" &&
      k != "Total Phase Actual Spending Amount"
    )
      delete updateObject[k];
  });
  if (updateObject != {}) {
    database.findOne({ _id: id }, function (err, item) {
      if (err) return res.status(500).end(err);
      if (!item) {
        return res.status(404).end("Project id #" + id + " does not exist");
      }

      database.update(
        { _id: id },
        { $set: updateObject },
        { returnUpdatedDocs: true },
        function (err, num, affectedDocument) {
          res.json(affectedDocument);
        }
      );
    });
  }
});

app.patch("/api/projects/", function (req, res, next) {
  if (!("ids" in req.body)) return res.status(400).end("ids are missing");
  const ids = req.body.ids;
  let updateObject = req.body;
  Object.entries(updateObject).forEach(([k, v]) => {
    if (k == "ids") {
      delete updateObject[k];
    }
  });
  if (updateObject != {}) {
    for (let id of ids) {
      database.findOne({ _id: id }, function (err, item) {
        if (err) return res.status(500).end(err);
        if (!item) {
          return res.status(404).end("Project id #" + id + " does not exist");
        }
        database.update({ _id: id }, { $set: updateObject }, function () {});
      });
    }
  }
  res.end();
});

const http = require("http");
const PORT = 3000;

http.createServer(app).listen(PORT, (err) => {
  if (err) console.log(err);
  else console.log("HTTP server on http://localhost:%s", PORT);
});

module.exports = app;
