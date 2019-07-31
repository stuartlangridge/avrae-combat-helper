/* eslint-env node, mocha */
/* eslint prefer-arrow-callback: "off", max-lines-per-function: "off", prefer-reflect: "off", arrow-body-style: 0 */

const {handleReaction, handleIncoming, INTERACTIONS} = require("./lib");
let {STAGES} = require("./lib");
const assert = require('assert');

/* Override STAGES and LISTS for testing */
STAGES.start = {
    description: "Do [melee] or [spell]"
};
STAGES.melee = {
    description: "Choose weapon {attacklist}",
    summary: "Melee attack",
    next_stage: "melee_weapon",
    store_as: "weapon"
};
STAGES.melee_weapon = {
    description: "Choose target {targetlist}",
    summary: "Melee attack with {weapon}",
    next_stage: "melee_weapon_target",
    store_as: "target"
};
STAGES.melee_weapon_target = {
    description: "Copy and paste the command below",
    summary: "Melee attack with {weapon} on {target}",
    avrae: '!init attack "{target}" "{weapon}"'
};


const BACK_EMOJI = "\u{1f519}";

const incomingMessage = {id: 1, author: {id: 1}}
let i;
const makeReaction = (emoji_letter) => {
    return {
        message: INTERACTIONS[Object.keys(INTERACTIONS)[0]].response_message,
        emoji: {toString: () => { return emoji_letter; }}
    }
}

describe("Creating a new Interaction", function() {
    beforeEach(async function() {
        for (const k in INTERACTIONS) {
            delete INTERACTIONS[k];
        }
        i = await handleIncoming(incomingMessage, {
            attacks: ["sword", "dagger", "dirk"],
            spells: [],
            targets: ["Minotaur", "ifrit"]
        });
        i.response_message = {id: 888, author: {id: 2}};
    });

    describe("before any reactions are chosen", function() {
        it("should construct an interaction", function() {
            assert.ok(i);
        });
        it("should construct a single-item description correctly", function() {
            assert.equal(i.question, "Do **melee** 🇲 or **spell** 🇸");
        });
        it("should construct possible reactions correctly", function() {
            assert.equal(Object.keys(i.reactions).length, 3);
            assert.ok(i.reactions.M);
            assert.ok(i.reactions.S);
            assert.ok(i.reactions.back);
            assert.equal(i.reactions.M.stage, "melee");
            assert.equal(i.reactions.S.stage, "spell");
        });
    })

    describe("choosing one reaction", function() {
        it("should ignore reactions from the wrong user", function() {
            assert.throws(function() {
                handleReaction(makeReaction("🇲"), {id: 99});
            }, /non-author/);
        });
        it("should ignore reactions on a messages that aren't ours", function() {
            let r = makeReaction("🇲");
            r.message.id = 99;
            assert.throws(function() {
                handleReaction(r, incomingMessage.author);
            }, /not ours/);
        });
        it("should ignore reactions with unexpected emoji", function() {
            assert.throws(function() {
                handleReaction(makeReaction("🇿"), incomingMessage.author);
            }, /wasn't on the list/);
        });
        it("should ignore reactions with non-letter emoji", function() {
            assert.throws(function() {
                handleReaction(makeReaction("💩"), incomingMessage.author);
            }, /wasn't a letter/);
        });
        it("returns the interaction", function() {
            let returned = handleReaction(makeReaction("🇲"), incomingMessage.author);
            assert.deepEqual(returned, i);
        });
        it("should handle a correct reaction", function() {
            handleReaction(makeReaction("🇲"), incomingMessage.author);
            assert.equal(i.chain.length, 2);
            assert.equal(Object.keys(i.reactions).length, 4);
            assert.ok(i.reactions.S);
            assert.ok(i.reactions.D);
            assert.ok(i.reactions.I);
            assert.ok(i.reactions.back);
            assert.equal(i.reactions.S.stage, "melee_weapon");
            assert.equal(i.reactions.D.stage, "melee_weapon");
            assert.equal(i.reactions.I.stage, "melee_weapon");
            assert.deepEqual(i.reactions.S.stored, {weapon: "sword"});
            assert.equal(i.question, "Choose weapon **sword** 🇸, **dagger** 🇩, **dirk** 🇮");
            assert.equal(i.summary, "Melee attack");
        });
    })

    describe("choosing multiple reactions", function() {
        it("does the melee dagger path", function() {
            handleReaction(makeReaction("🇲"), incomingMessage.author);
            handleReaction(makeReaction("🇩"), incomingMessage.author);
            assert.equal(i.chain.length, 3);
            assert.equal(Object.keys(i.reactions).length, 3);
            assert.ok(i.reactions.M);
            assert.ok(i.reactions.I);
            assert.ok(i.reactions.back);
            assert.equal(i.question, "Choose target **Minotaur** 🇲, **ifrit** 🇮");
            assert.equal(i.summary, "Melee attack with dagger");
        });
        it("does the melee sword path", function() {
            handleReaction(makeReaction("🇲"), incomingMessage.author);
            handleReaction(makeReaction("🇸"), incomingMessage.author);
            assert.equal(i.chain.length, 3);
            assert.equal(Object.keys(i.reactions).length, 3);
            assert.ok(i.reactions.M);
            assert.ok(i.reactions.I);
            assert.ok(i.reactions.back);
            assert.equal(i.question, "Choose target **Minotaur** 🇲, **ifrit** 🇮");
            assert.equal(i.summary, "Melee attack with sword");
        });
        it("does the melee dagger minotaur path", function() {
            handleReaction(makeReaction("🇲"), incomingMessage.author);
            handleReaction(makeReaction("🇩"), incomingMessage.author);
            handleReaction(makeReaction("🇲"), incomingMessage.author);
            assert.equal(i.chain.length, 4);
            assert.equal(Object.keys(i.reactions).length, 1);
            assert.ok(i.reactions.back);
            assert.equal(i.question, "Copy and paste the command below");
            assert.equal(i.summary, "Melee attack with dagger on Minotaur");
            assert.equal(i.avrae, '!init attack "Minotaur" "dagger"');
            assert.equal(
                i.full_message,
                '__Melee attack with dagger on Minotaur__\n' +
                'Copy and paste the command below\n' +
                '`!init attack "Minotaur" "dagger"`'
            )
        });
    });

    describe("going back", function() {
        it("does the melee dagger path and goes back", function() {
            handleReaction(makeReaction("🇲"), incomingMessage.author);
            handleReaction(makeReaction("🇩"), incomingMessage.author);
            handleReaction(makeReaction(BACK_EMOJI), incomingMessage.author);
            assert.equal(i.chain.length, 2);
            assert.ok(i.reactions.S);
            assert.ok(i.reactions.D);
            assert.ok(i.reactions.I);
            assert.equal(i.reactions.S.stage, "melee_weapon");
            assert.equal(i.reactions.D.stage, "melee_weapon");
            assert.equal(i.reactions.I.stage, "melee_weapon");
            assert.deepEqual(i.reactions.S.stored, {weapon: "sword"});
            assert.equal(i.question, "Choose weapon **sword** 🇸, **dagger** 🇩, **dirk** 🇮");
            assert.equal(i.summary, "Melee attack");
        });
        it("does the melee dagger minotaur path and goes back", function() {
            handleReaction(makeReaction("🇲"), incomingMessage.author);
            handleReaction(makeReaction("🇩"), incomingMessage.author);
            handleReaction(makeReaction("🇲"), incomingMessage.author);
            handleReaction(makeReaction(BACK_EMOJI), incomingMessage.author);
            assert.equal(i.chain.length, 3);
            assert.equal(Object.keys(i.reactions).length, 3);
            assert.ok(i.reactions.M);
            assert.ok(i.reactions.I);
            assert.ok(i.reactions.back);
            assert.equal(i.question, "Choose target **Minotaur** 🇲, **ifrit** 🇮");
            assert.equal(i.summary, "Melee attack with dagger");
        });
        it("returns the interaction on going back", function() {
            handleReaction(makeReaction("🇲"), incomingMessage.author);
            let ret = handleReaction(makeReaction(BACK_EMOJI), incomingMessage.author);
            assert.ok(ret);
            assert.deepEqual(i, ret);
        });
    });
});