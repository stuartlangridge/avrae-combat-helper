let STAGES = {
    start: {
        description: "Make an attack ([melee] or [opportunity]) or cast a spell (at an [area], a [target], or as a [reaction])"
    },
    melee: {
        description: "Choose weapon {attacklist}",
        summary: "Melee attack",
        next_stage: "melee_weapon",
        store_as: "weapon"
    },
    melee_weapon: {
        description: "Choose target {targetlist}",
        summary: "Melee attack with {weapon}",
        next_stage: "melee_weapon_target",
        store_as: "target"
    },
    melee_weapon_target: {
        description: "Copy and paste the command below",
        summary: "Melee attack with {weapon} on {target}",
        avrae: '!init attack {target} {weapon}'
    },
    opportunity: {
        description: "Choose weapon {attacklist}",
        summary: "Opportunity attack",
        next_stage: "opportunity_weapon",
        store_as: "weapon"
    },
    opportunity_weapon: {
        description: "Choose target {targetlist}",
        summary: "Opportunity attack with {weapon}",
        next_stage: "opportunity_weapon_target",
        store_as: "target"
    },
    opportunity_weapon_target: {
        description: "Choose combatant (who is doing the attack) {targetlist}",
        summary: "Opportunity attack with {weapon} on {target}",
        next_stage: "opportunity_weapon_target_combatant",
        store_as: "combatant"
    },
    opportunity_weapon_target_combatant: {
        description: "Copy and paste the command below",
        summary: "Opportunity attack with {weapon} on {target} by {combatant}",
        avrae: '!init aoo {combatant} {target} {weapon}'
    }
}
const BACK_EMOJI = "\u{1f519}";

const INTERACTIONS = {};
const emojiFromLetter = {}, letterFromEmoji = {};
const firstLetterA = "🇦".codePointAt(0);
for (var i=0; i<26; i++) {
    emojiFromLetter[String.fromCodePoint(65+i)] = String.fromCodePoint(firstLetterA+i);
}
emojiFromLetter["back"] = BACK_EMOJI;
for (i=0; i<26; i++) {
    letterFromEmoji[String.fromCodePoint(firstLetterA+i)] = String.fromCodePoint(65+i);
}
letterFromEmoji[BACK_EMOJI] = "back";

const firstUnused = (possibles, reactions) => {
    let l, i;
    for (i=0; i<possibles.length; i++) {
        l = possibles.charAt(i);
        if (!reactions[l]) return l;
    }
    for (i=0; i<26; i++) {
        l = String.fromCharCode(i+65);
        if (!reactions[l]) return l;
    }
    throw new Error("All 26 emoji used.");
}

class Step {
    constructor(stage, interaction, store={}) {
        this.stage = stage;
        this.stored = store;
        this.interaction = interaction;
    }
    get summary() {
        return this._replace_vars_from_stage("summary");
    }
    _replace_vars_from_stage(prop) {
        let text = STAGES[this.stage][prop];
        if (!text) return "";
        for (let k in this.stored) {
            let value = this.stored[k];
            if (value.indexOf(" ") > -1) {
                value = '"' + value + '"';
            }
            text = text.replace("{" + k + "}", value)
        }
        return text;
    }
    get avrae() {
        return this._replace_vars_from_stage("avrae");
    }
    get question() {
        let text = STAGES[this.stage].description;
        let parsed = this._parse(text);
        return parsed.text;
    }
    get reactions() {
        let text = STAGES[this.stage].description;
        let parsed = this._parse(text);
        let reactions = {};
        for (let letter in parsed.reactions) {
            let next_stage = STAGES[this.stage].next_stage || parsed.reactions[letter];
            let extras = {};
            if (STAGES[this.stage].store_as) {
                extras[STAGES[this.stage].store_as] = parsed.reactions[letter];
            }
            let nextras = Object.assign({}, this.stored);
            nextras = Object.assign(nextras, extras);
            reactions[letter] = new Step(next_stage, this.interaction, nextras);
        }
        reactions["back"] = "ignored";
        return reactions;
    }

    _parse(text) {
        let reactions = {};

        // replace lists
        this.interaction.listnames.forEach((listname) => {
            let bracketed = "{" + listname + "}";
            if (text.indexOf(bracketed) != -1) {
                text = text.replace(bracketed, this.interaction[listname]);
            }
        })

        text = text.replace(/\[(.*?)\]/g, (match, content) => {
            let out = ["**", content, "**"];
            let upper = content.replace(/[^a-z]/ig, "").toUpperCase();
            let letter;
            if (upper.length == 0) {
                // no valid characters to use as a reaction. Choose an unused one
                letter = firstUnused("", reactions);
            } else {
                let first = upper.charAt(0);
                if (reactions[first]) {
                    // first letter already used, so just pick an unused one
                    letter = firstUnused(upper.slice(1), reactions);
                } else {
                    letter = first;
                }
            }
            reactions[letter] = content;
            out.push(" ");
            out.push(emojiFromLetter[letter]);
            return out.join("");
        })
        return {
            reactions: reactions,
            text: text
        }
    }
}

class Interaction {
    constructor(message, characterDetails) {
        this.chain = [new Step("start", this)];
        this._invoking_message = message;
        this._response_message = null;
        this.characterDetails = characterDetails;
    }
    get spelllist() {
        return this.characterDetails.spells.map((s) => `[${s}]`).join(", ");
    }
    get attacklist() {
        return this.characterDetails.attacks.map((s) => `[${s}]`).join(", ");
    }
    get targetlist() {
        return this.characterDetails.targets.map((s) => `[${s}]`).join(", ");
    }
    get listnames() {
        return ["spelllist", "attacklist", "targetlist"];
    }
    get full_message() {
        let s = this.summary;
        let q = this.question;
        let a = this.avrae;
        let out = [];
        if (s && s.length > 0) { out.push("__" + s + "__"); }
        if (q && q.length > 0) { out.push(q); }
        if (a && a.length > 0) { out.push("`" + a + "`"); }
        return out.join("\n");
    }
    get summary() {
        return this.chain[this.chain.length - 1].summary;
    }
    get question() {
        return this.chain[this.chain.length - 1].question;
    }
    get avrae() {
        return this.chain[this.chain.length - 1].avrae;
    }
    get reactions() {
        return this.chain[this.chain.length - 1].reactions;
    }
    get user() { return this._invoking_message.author; }
    set response_message(m) {
        this._response_message = m;
        INTERACTIONS[m.id] = this;
    }
    get response_message() { return this._response_message; }
}

function handleIncoming(message, characterDetails) {
    return new Interaction(message, characterDetails);
}
function handleReaction(reaction, user) {
    const interaction = INTERACTIONS[reaction.message.id];
    if (!interaction) {
        throw new Error("a reaction on a message not ours" +
        ` (our list is ${Object.keys(INTERACTIONS)}, this was ${reaction.message.id})`);
    }

    // confirm author is correct
    if (user.id != interaction.user.id) {
        throw new Error(`reaction from non-author (${reaction.message.author.id}) on message by (${user.id}); ignore`);
    }

    // get code for reaction
    const letter = letterFromEmoji[reaction.emoji.toString()];
    if (!letter) {
        throw new Error(`a reaction that wasn't a letter (${reaction.emoji.toString()})`);
    }

    // confirm code is in the expected list
    const chosen_reaction = interaction.reactions[letter];
    if (!chosen_reaction) {
        throw new Error(`a letter reaction that wasn't on the list (${reaction.emoji.toString()})`);
    }

    if (letter == "back") {
        // pop the last chain item
        interaction.chain.pop();
        return interaction;
    }

    // All is good. Get the next chain step.
    let chain_step = interaction.reactions[letter];
    interaction.chain.push(chain_step);
    return interaction;
}

module.exports = {handleIncoming, handleReaction, INTERACTIONS, emojiFromLetter, STAGES};