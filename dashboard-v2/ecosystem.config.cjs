module.exports = {
  apps: [
    {
      name: "marvin-dashboard-v2",
      script: "node_modules/next/dist/bin/next",
      args: "start --hostname 127.0.0.1 --port 3032",
      cwd: __dirname,
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
