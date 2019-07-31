/* eslint no-console: "off" */

const Discord = require("discord.js");
const client = new Discord.Client();

const {handleReaction, handleIncoming, emojiFromLetter} = require("./lib");
const {getUserDetails, startServer} = require("./server");
const tokens = require("./token");

/* We get the list of targets by looking in the pinned messages for an Avrae battle one */
const fetchTargets = async (channel) => {
    let pins = await channel.fetchPinnedMessages();
    let targets = [];
    pins.forEach((msg) => {
        if (msg.content.indexOf("Current initiative: ") > -1) {
            msg.content.split("\n").forEach((l) => {
                let m = l.match(/^#?\s*[0-9]+: (.*?)(<.*?>)?( \(.*?\))?\s*$/);
                if (m) { targets.push(m[1].trim()); }
            })
        }
    })
    return targets;
}

const setReactions = async (interaction) => {
    await interaction.response_message.clearReactions();
    let reactor = [];
    for (let letter in interaction.reactions) {
        if (letter != "back") {
            reactor.push(interaction.response_message.react(emojiFromLetter[letter]));
        }
    }
    await Promise.all(reactor);
    if (interaction.reactions.back) {
        await interaction.response_message.react(emojiFromLetter["back"]);
    }
}

const userRegisteredCallback = async (userid) => {
    console.log("user id", userid, "registered");
    let user = await client.fetchUser(userid);
    let dmchannel = await user.createDM();
    dmchannel.send("Thank you for registering! You can now use Avrae Combat Help.")
}
const notifyUserCallback = async (userid, link) => {
    console.log("tell user id", userid, "the message", link);
    let user = await client.fetchUser(userid);
    let dmchannel = await user.createDM();
    dmchannel.send(`Hi! Since this is your first time using Avrae Combat Help, you need to register. Please click on ${link} to do so.`)
}

client.on("ready", () => { console.log("startup!"); });
client.on("message", async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith("avrae combat help")) return;
    let characterDetails = await getUserDetails(message.author.id, notifyUserCallback);
    if (!characterDetails) {
        console.log("Hit the timeout waiting for user details");
        return;
    }
    characterDetails.targets = await fetchTargets(message.channel);
    let interaction = handleIncoming(message, characterDetails);
    interaction.response_message = await message.channel.send(interaction.full_message);
    await setReactions(interaction);
});
client.on("messageReactionAdd", async (reaction, user) => {
    if (user.bot) { return; }
    let interaction;
    try {
        interaction = handleReaction(reaction, user);
    } catch(e) {
        console.log("Reaction problem:", e.message);
        return;
    }
    if (interaction.chain.length == 0) {
        // top-level BACK
        await interaction.response_message.delete();
        return;
    }
    await interaction.response_message.edit(interaction.full_message);
    await setReactions(interaction);
});

console.log("logging in...");
client.login(tokens.discord_bot);
console.log("starting listener...");
startServer(userRegisteredCallback)