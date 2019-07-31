/* eslint no-console: "off" */
const http = require("http");
const url = require('url');
const request_lib = require("request");
const tokens = require("./token");

const STOPPERS = {};
const DISCORD_TOKENS = {};

const exchangeCode = function(code) {
    return new Promise((resolve, reject) => {
        request_lib.post("https://discordapp.com/api/v6/oauth2/token", {
            form: {
                client_id: tokens.discord_client_id,
                client_secret: tokens.discord_client_secret,
                code: code,
                grant_type: "authorization_code",
                redirect_uri: "http://localhost:41174",
                scope: "identify"
            }
        }, function(err, response, body) {
            if (err) return reject(err);
            let b;
            try {
                b = JSON.parse(body);
            } catch(e) {
                return reject(e);
            }
            return resolve(b);
        });
    })
}

const queryDiscordMe = (token) => {
    return new Promise((resolve, reject) => {
        request_lib.get({
            url: "https://discordapp.com/api/v6/users/@me",
            headers: {
                "User-Agent": "avrae combat helper",
                "Authorization": "Bearer " + token
            }
        }, function(err, response, body) {
            if (err) return reject(err);
            let b;
            try {
                b = JSON.parse(body);
            } catch(e) {
                return reject(e);
            }
            resolve(b);
        });
    });
}


const getAvrae = (token) => {
    return new Promise((resolve, reject) => {
        request_lib.get({
            url: "https://api.avrae.io/characters/meta",
            headers: {
                "User-Agent": "avrae combat helper",
                "Authorization": token
            }
        }, function(err, response, body) {
            if (err) return reject(err);
            let b;
            try {
                b = JSON.parse(body);
            } catch(e) {
                return reject(e);
            }
            resolve(b);
        });
    });
}

const setDiscordToken = async (userid, details) => {
    DISCORD_TOKENS[userid] = details;
}

const startServer = (userRegisteredCallback) => {
    const server = http.createServer(async (request, response) => {
        let u = url.parse(request.url)
        if (u.query && u.query.startsWith("code=")) {
            let code = u.query.split("=")[1];
            let token_details = await exchangeCode(code);
            let expires_at = new Date().getTime() + (token_details.expires_in * 1000);
            // now look up the user
            let user_details = await queryDiscordMe(token_details.access_token);
            let details = {
                refresh_token: token_details.refresh_token,
                access_token: token_details.access_token,
                expires_at: expires_at
            }
            details = Object.assign(details, user_details);
            setDiscordToken(user_details.id, details)
            userRegisteredCallback(user_details.id);
        }
        response.end('Thank you for registering with Avrae Combat Help. You can close this tab now.');
    })
    server.listen(41174, (err) => {
        if (err) { console.log('something bad happened', err); return; }
        console.log("server is listening");
    })
}

const reallyGetDiscordToken = async (userid) => {
    return DISCORD_TOKENS[userid] ? DISCORD_TOKENS[userid].access_token : null
}

const getDiscordTokenRepeatedly = async (userid, notifyUserCallback, first) => {
    let token = await reallyGetDiscordToken(userid);
    if (token) {
        return token;
    }

    // now prompt the user to click the link
    if (first) {
        notifyUserCallback(userid, "https://discordapp.com/api/oauth2/authorize?client_id=605711472152281098&redirect_uri=http%3A%2F%2Flocalhost%3A41174&response_type=code&scope=identify");
    }

    await new Promise((resolve) => { setTimeout(resolve, 1000); })
    if (STOPPERS[userid] == "stop") {
        console.log("Stopping getDiscordTokenRepeatedly for", userid);
        return false;
    }
    return await getDiscordTokenRepeatedly(userid, notifyUserCallback, false);
}

const parseBeyond = (sheet) => {
    // now parse the DDB sheet
    let attacks = [];
    if (sheet.actions) {
        Object.values(sheet.actions).forEach((aa) => {
            aa.forEach((a) => {
                if (a.displayAsAttack) attacks.push(a.name);
            })
        })
        sheet.customActions.forEach((a) => {
            attacks.push(a.name);
        })
        sheet.inventory.forEach((item) => {
            if (item.equipped && item.definition && (item.definition.filterType == "Weapon" || item.displayAsAttack)) {
                attacks.push(item.definition.name);
            }
        })
    }
    let spells = {area: [], target: []};
    if (sheet.classSpells) {
        sheet.classSpells.forEach((cs) => {
            cs.spells.forEach((s) => {
                if (s.definition.range && s.definition.range.aoeType) {
                    spells.area.push(s.definition.name);
                } else {
                    spells.target.push(s.definition.name);
                }
            })
        });
    }
    return {
        attacks: attacks,
        spells: spells
    }
}

const getBeyond = async (ddbid) => {
    return new Promise((resolve, reject) => {
        request_lib.get({
            url: "https://www.dndbeyond.com/character/" + ddbid + "/json",
            headers: {
                "User-Agent": "avrae combat helper"
            }
        }, function(err, response, body) {
            if (err) return reject(err);
            let b;
            try {
                b = JSON.parse(body);
            } catch(e) {
                return reject(e);
            }
            resolve(parseBeyond(b));
        });
    });
}

const getSheet = async (character) => {
    if (!character || !character.upstream) return null;
    if (character.upstream.startsWith("beyond-")) {
        return await getBeyond(character.upstream.split("-")[1]);
    }
    console.log("Unknown character upstream", character.upstream);
    return null;
}

const reallyGetUserDetails = async (userid, notifyUserCallback) => {
    let user_discord_token = await getDiscordTokenRepeatedly(userid, notifyUserCallback, true);
    if (user_discord_token === false) {
        // token fetch was stopped.
        return false
    }
    // look up details at avrae
    let character_details = await getAvrae(user_discord_token);
    let active = character_details.filter((c) => c.active);
    if (active.length === 0) return null;
    let sheet = await getSheet(active[0]);
    return sheet;
}

const getUserDetails = async (userid, notifyUserCallback) => {
    let timeout;
    STOPPERS[userid] = "go";
    let timer = new Promise((resolve) => { timeout = setTimeout(() => { resolve(null); }, 30000); })

    // async but no await because we await it next
    let fetcher = reallyGetUserDetails(userid, notifyUserCallback);

    let result = await Promise.race([timer, fetcher]);
    // one of the promises finished, but the other one is still running, so kill them both
    STOPPERS[userid] = "stop";
    clearTimeout(timeout);
    if (result === false) {
        // token fetch was stopped because getDiscordTokenRepeatedly was stopped by us
        return null;
    } else if (result === null) {
        // timeout fired first
        return null;
    }
    return result;
}

module.exports = {getUserDetails, startServer}