var d3 = require("d3");
module.exports.save = save;
module.exports.load = load;
module.exports.loadRaw = loadRaw;

var config = require("../config.js")(location.hostname);
var githubBase = config.GithubAPI
  ? config.GithubAPI + "/api/v3"
  : "https://api.github.com";

function save(context, callback) {
  var source = context.data.get("source"),
    meta = context.data.get("meta"),
    newpath = context.data.get("newpath"),
    name = (meta && meta.name) || "map.geojson",
    map = context.data.get("map");

  if (navigator.appVersion.indexOf("MSIE 9") !== -1 || !window.XMLHttpRequest) {
    return alert(
      "Sorry, saving and sharing is not supported in IE9 and lower. " +
        "Please use a modern browser to enjoy the full featureset of geojson.net"
    );
  }

  if (!localStorage.github_token) {
    return alert("You need to log in with GitHub to commit changes");
  }

  context.repo.details(onrepo);

  function onrepo(err, repo) {
    var commitMessage,
      endpoint,
      method = "POST",
      files = {};

    if (!err && repo.permissions.push) {
      commitMessage = context.commitMessage || prompt("Commit message:");
      if (!commitMessage) return;

      endpoint = source.url;
      method = "PUT";
      var data = {
        message: commitMessage,
        branch: meta.branch,
        content: btoa(
          encodeURIComponent(JSON.stringify(map, null, 2)).replace(
            /%([0-9A-F]{2})/g,
            function(match, p1) {
              return String.fromCharCode("0x" + p1);
            }
          )
        )
      };

      // creating a file
      if (newpath) {
        data.path = newpath;
        context.data.set({ newpath: null });
      }

      // updating a file
      if (source.sha) {
        data.sha = source.sha;
      }
    } else {
      endpoint = githubBase + "/gists";
      files[name] = { content: JSON.stringify(map, null, 2) };
      data = { files: files };
    }

    context.user
      .signXHR(d3.json(endpoint))
      .on("load", function(data) {
        callback(null, data);
      })
      .on("error", function(err) {
        var message,
          url = /(http:\/\/\S*)/g;

        try {
          message = JSON.parse(err.responseText).message.replace(
            url,
            '<a href="$&">$&</a>'
          );
        } catch (e) {
          message = "Sorry, an error occurred.";
        }

        callback(message);
      })
      .send(method, JSON.stringify(data));
  }
}

function parseGitHubId(id) {
  var parts = id.split("/");
  return {
    user: parts[0],
    repo: parts[1],
    mode: parts[2],
    branch: parts[3],
    file: parts.slice(4).join("/")
  };
}

function load(parts, context, callback) {
  context.user
    .signXHR(d3.json(fileUrl(parts)))
    .on("load", onLoad)
    .on("error", onError)
    .get();

  function onLoad(file) {
    callback(null, file);
  }
  function onError(err) {
    callback(err, null);
  }
}

function loadRaw(parts, sha, context, callback) {
  context.user
    .signXHR(d3.text(shaUrl(parts, sha)))
    .on("load", onLoad)
    .on("error", onError)
    .header("Accept", "application/vnd.github.raw")
    .get();

  function onLoad(file) {
    callback(null, file);
  }
  function onError(err) {
    callback(err, null);
  }
}

function fileUrl(parts) {
  return (
    githubBase +
    "/repos/" +
    parts.user +
    "/" +
    parts.repo +
    "/contents/" +
    parts.path +
    "?ref=" +
    parts.branch
  );
}

function shaUrl(parts, sha) {
  return (
    githubBase + "/repos/" + parts.user + "/" + parts.repo + "/git/blobs/" + sha
  );
}
