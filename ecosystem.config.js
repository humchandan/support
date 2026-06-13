module.exports = {
  apps: [
    {
      name: "aries-frontend",
      script: "node_modules/next/dist/bin/next",
      args: "start",
      cwd: "./frontend",
      instances: "max",
      exec_mode: "cluster",
      env: {
        PORT: 3000,
        NODE_ENV: "production"
      }
    },
    {
      name: "aries-sweeper",
      script: "src/sweeper.js",
      cwd: "./backend",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
