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
    }
  ]
};
