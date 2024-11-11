module.exports = {
  apps: [
    {
      name: "jobProcessor",
      script: "./src/jobProcessor.js",
      watch: true,
    },
  ],
  env: { NODE_ENV: "development" },
  env_production: { NODE_ENV: "production" },
  env_development: { NODE_ENV: "development" },
};
