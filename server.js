const { Client, GatewayIntentBits, Partials } = require("discord.js");
const path = require("path");
const fs = require("fs");
const { oxmysql } = require("@overextended/oxmysql");
const config = require("./config/server_config.json");

let TOKEN = null;
let tokenReady = null;

const ANNOUNCEMENTS_CHANNEL_ID = config.CHANNEL_ID;
const tokenPath = path.resolve(`${GetResourcePath(GetCurrentResourceName())}/config/token.json`);
const dataPath = path.resolve(`${GetResourcePath(GetCurrentResourceName())}/data/data.json`);

/**
 * Initializes the bot token from Database or local JSON fallback
 */
async function fetch_mysql() {
    try {
        const response = await oxmysql.query("SELECT `token` FROM `loadingscreen_bot` LIMIT 1");
        
        if (response && response[0] && response[0].token === "empty_token") {
            const TOKEN_CONFIG = require("./config/token.json");
            if (TOKEN_CONFIG.TOKEN && TOKEN_CONFIG.TOKEN !== "PLACE_YOUR_TOKEN_HERE") {
                const success = await oxmysql.update("UPDATE `loadingscreen_bot` SET `token` = ? WHERE `token` = ?", [
                    TOKEN_CONFIG.TOKEN, "empty_token"
                ]);
                
                if (success) {
                    TOKEN = TOKEN_CONFIG.TOKEN;
                    // Clear the token file for security after moving to DB
                    fs.writeFileSync(tokenPath, JSON.stringify({ TOKEN: "MOVED_TO_DATABASE" }, null, 4));
                    console.log("^2[Browns Loading Screen]^7 Token successfully migrated to Database.");
                }
            } else {
                console.log("^1[Browns Loading Screen]^7 No valid token found in config/token.json. Please provide a Discord Bot Token.");
            }
        } else if (response && response[0]) {
            TOKEN = response[0].token;
        }
    } catch (err) {
        console.error("^1[Browns Loading Screen]^7 Database error:", err.message);
    }
}

fetch_mysql();

// New Discord.js v14 Client initialization
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Message, Partials.Channel]
});

/**
 * Checks if token is available and logs the bot in
 */
function checkToken() {
    if (TOKEN && TOKEN !== "empty_token" && TOKEN !== "MOVED_TO_DATABASE") { 
        client.login(TOKEN).catch(err => {
            console.error("^1[Browns Loading Screen]^7 Login failed: Check your Discord Token.", err.message);
        });
        clearInterval(tokenReady);
    }
}

/**
 * Fetches the latest messages from the configured channel and saves to data.json
 */
async function fetchAnnouncements() {
    try {
        const channel = await client.channels.fetch(ANNOUNCEMENTS_CHANNEL_ID);
        if (!channel || !channel.isTextBased()) {
            console.error("^1[Browns Loading Screen]^7 Channel not found or is not a text channel.");
            return;
        }

        const messages = await channel.messages.fetch({ limit: 10 });
        let data = [];

        messages.forEach(message => {
            // Filter out empty messages or bot embeds if necessary
            if (message.content || message.embeds.length > 0) {
                data.push({
                    channel: channel.name,
                    name: message.author.username,
                    url: message.author.displayAvatarURL({ extension: "png" }),
                    msg: message.content || (message.embeds[0] ? message.embeds[0].description : "Embed Message")
                });
            }
        });

        // Write the data to the JSON file for the NUI to read
        fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
        console.log("^2[Browns Loading Screen]^7 Successfully fetched Discord announcements.");

    } catch (error) {
        console.error("^1[Browns Loading Screen]^7 Error fetching announcements:", error.message);
    } finally {
        client.destroy(); // Shut down bot after task to save resources
    }
}

client.once("ready", () => {
    console.log(`^2[Browns Loading Screen]^7 Bot logged in as ${client.user.tag}`);
    fetchAnnouncements();
});

// Polling interval to wait for the DB token to be fetched
tokenReady = setInterval(() => {
    checkToken();
}, 1000);