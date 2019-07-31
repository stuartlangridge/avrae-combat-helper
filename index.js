const Discord = require("discord.js");
const client = new Discord.Client();

const {handleReaction, handleIncoming, emojiFromLetter} = require("./lib");

const setReactions = async interaction => {
    await interaction.response_message.clearReactions();
    let letters = Object.keys(interaction.reactions);
    letters.sort();
    for (let i=0; i<letters.length; i++) {
        let letter = letters[i];
        if (letter == "back") continue;
        await interaction.response_message.react(emojiFromLetter[letter]);
    }
    if (interaction.reactions.back) {
        await interaction.response_message.react(emojiFromLetter["back"]);
    }
}

client.on("ready", () => { console.log("startup!"); });
client.on("message", async (message) => {
    if (message.content.startsWith("ping") && !message.author.bot) {
        // ok
    } else {
        return;
    }
    let interaction = handleIncoming(message);
    console.log("OK, send", interaction.full_message);
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
let token = require("./token");
client.login(token);
