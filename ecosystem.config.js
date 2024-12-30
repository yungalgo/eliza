module.exports = {
  apps: [{
    name: "eliza-yapdollar",
    script: "pnpm",
    args: "start --characters=\"characters/yapdollar.character.json\"",
    env: {
      NODE_ENV: "development",
    },
    env_production: {
      NODE_ENV: "production"
    },
    watch: false,
    ignore_watch: ["node_modules"]
  }]
};
