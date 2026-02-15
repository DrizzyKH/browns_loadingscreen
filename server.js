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
                    fs.writeFileSync(tokenPath, JSON.stringify({ TOKEN: "MOVED_TO_DATABASE" }, null, 4));
                    console.log("^2[Browns Loading Screen]^7 Token successfully migrated to Database.");
                    startBot();
                }
            } else {
                console.log("^1[Browns Loading Screen]^7 No valid token found in config/token.json or Database.");
            }
        } else if (response && response[0]) {
            TOKEN = response[0].token;
            startBot();
        }
    } catch (err) {
        console.error("^1[Browns Loading Screen]^7 Database error:", err.message);
    }
}

// New Discord.js v14 Client initialization
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent // REQUIRED: Enable this in Discord Dev Portal!
    ],
    partials: [Partials.Message, Partials.Channel]
});

/**
 * Logs the bot in
 */
function startBot() {
    if (TOKEN && TOKEN !== "empty_token" && TOKEN !== "MOVED_TO_DATABASE") { 
        client.login(TOKEN).catch(err => {
            console.error("^1[Browns Loading Screen]^7 Login failed: Check your Discord Token and Intents.", err.message);
        });
    }
}

/**
 * Fetches the latest messages from the configured channel and saves to data.json
 */
async function fetchAnnouncements() {
    try {
        console.log("^3[Browns Loading Screen]^7 Fetching announcements from channel: " + ANNOUNCEMENTS_CHANNEL_ID);
        
        const channel = await client.channels.fetch(ANNOUNCEMENTS_CHANNEL_ID).catch(e => {
            throw new Error("Could not find channel. Ensure the Bot is in the server and has 'View Channel' permissions.");
        });

        if (!channel || !channel.isTextBased()) {
            console.error("^1[Browns Loading Screen]^7 Channel not found or is not a text channel.");
            return;
        }

        // Check for View Channel and Read Message History permissions
        const messages = await channel.messages.fetch({ limit: 10 }).catch(e => {
            throw new Error("Missing Access to messages. Ensure the Bot has 'Read Message History' permission.");
        });

        let data = [];

        messages.forEach(message => {
            if (message.content || message.embeds.length > 0) {
                data.push({
                    channel: channel.name,
                    name: message.author.username,
                    url: message.author.displayAvatarURL({ extension: "png" }),
                    msg: message.content || (message.embeds[0] ? (message.embeds[0].description || message.embeds[0].title) : "Embed Message")
                });
            }
        });

        fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
        console.log("^2[Browns Loading Screen]^7 Successfully fetched Discord announcements.");

    } catch (error) {
        console.error("^1[Browns Loading Screen]^7 Error:", error.message);
    } finally {
        // We do NOT destroy the client if you want it to stay active, 
        // but since this script runs once on start, we can leave it or destroy it.
        // client.destroy(); 
    }
}

client.once("ready", () => {
    console.log(`^2[Browns Loading Screen]^7 Bot logged in as ${client.user.tag}`);
    fetchAnnouncements();
});

// Start initialization
fetch_mysql();