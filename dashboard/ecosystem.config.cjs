/* eslint-disable @typescript-eslint/no-require-imports */
const path = require("path");

module.exports = {
  apps: [
    {
      name: "marvin-dashboard",
      script: "node_modules/next/dist/bin/next",
      args: "start --hostname 127.0.0.1 --port 3030",
      cwd: __dirname,
      env: {
        NODE_ENV: "production"
      }
    },
    {
      name: "marvin-api",
      script: path.join(__dirname, "../.venv/bin/python3"),
      args: path.join(__dirname, "../marvin_core/marvin_api.py"),
      cwd: path.join(__dirname, ".."),
      interpreter: "none",
      env: {
        PYTHONPATH: path.join(__dirname, "..")
      }
    }
  ]
};
