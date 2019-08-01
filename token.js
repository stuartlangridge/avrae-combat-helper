if (process.env.DATABASE_URL) {
    module.exports = {
        discord_bot: process.env.ACH_DISCORD_BOT,
        discord_client_id: process.env.ACH_DISCORD_CLIENT_ID,
        discord_client_secret: process.env.ACH_DISCORD_CLIENT_SECRET,
        DATABASE_URL: process.env.DATABASE_URL
    }
} else {
    module.exports = require("./localtoken.js");
}
