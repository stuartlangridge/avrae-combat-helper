module.exports = {
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
    },
    target: {
        description: "Choose a spell: {targetspelllist}",
        summary: "Cast a spell",
        next_stage: "target_spell",
        store_as: "spell"
    },
    target_spell: {
        description: "Choose target {targetlist}",
        summary: "Cast _{spell}_",
        next_stage: "target_spell_target",
        store_as: "target"
    },
    target_spell_target: {
        description: "Copy and paste the command below",
        summary: "Cast _{spell}_ at {target}",
        avrae: '!init cast {spell} -t {target}'
    },
    area: {
        description: "Choose a spell: {areaspelllist}",
        summary: "Cast a spell",
        next_stage: "area_spell",
        store_as: "spell"
    },
    area_spell: {
        description: "Copy and paste the command below",
        summary: "Cast _{spell}_",
        avrae: '!init cast {spell}'
    },
    reaction: {
        description: "Choose a spell: {targetspelllist}",
        summary: "Cast a spell as a reaction",
        next_stage: "reaction_spell",
        store_as: "spell"
    },
    reaction_spell: {
        description: "Choose target {targetlist}",
        summary: "Cast _{spell}_ as a reaction",
        next_stage: "reaction_spell_target",
        store_as: "target"
    },
    reaction_spell_target: {
        description: "Copy and paste the command below",
        summary: "Cast _{spell}_ at {target} as a reaction",
        avrae: '!init reactcast {target} {spell}'
    }
}
