let STAGES = {
    start: {
        description: "Make an attack ([melee] or [opportunity]) or cast a spell (at a [target] or as a [reaction])"
    },
    melee: {
        description: "Choose weapon [sword] [dagger] [dirk]",
        summary: "Melee attack",
        next_stage: "melee_weapon",
        store_as: "weapon"
    },
    melee_weapon: {
        description: "Choose target [Minotaur] [ifrit]",
        summary: "Melee attack with {weapon}",
        next_stage: "melee_weapon_target",
        store_as: "target"
    },
    melee_weapon_target: {
        description: "Copy and paste the command below",
        summary: "Melee attack with {weapon} on {target}",
        avrae: '!init attack "{target}" "{weapon}"'
    }
}
const BACK_EMOJI = "\u{1f519}";

const LISTS = {
    attacklist: function() {
        return "[sword], [dagger], [dirk]";
    },
    targetlist: function() {
        return "[Minotaur], [ifrit]"
    }
}

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
    constructor(stage, store={}) {
        this.stage = stage;
        this.stored = store;
    }
    get summary() {
        return this._replace_vars_from_stage("summary");
    }
    _replace_vars_from_stage(prop) {
        let text = STAGES[this.stage][prop];
        if (!text) return "";
        for (let k in this.stored) {
            text = text.replace("{" + k + "}", this.stored[k])
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
            reactions[letter] = new Step(next_stage, nextras);
        }
        reactions["back"] = "ignored";
        return reactions;
    }

    _parse(text) {
        let reactions = {};

        // replace lists
        for (let listname in LISTS) {
            if (text.indexOf("{" + listname + "}") != -1) {
                text = text.replace("{" + listname + "}", LISTS[listname]());
            }
        }

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
    constructor(message) {
        this.chain = [new Step("start")];
        this._invoking_message = message;
        this._response_message = null;
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

function handleIncoming(message) {
    return new Interaction(message);
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

module.exports = {handleIncoming, handleReaction, INTERACTIONS, emojiFromLetter, STAGES, LISTS};