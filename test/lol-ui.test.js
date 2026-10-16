'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

// UI contract tests without Discord credentials or network access.
class Fluent {
  constructor() { this.fields = []; this.components = []; this.options = []; }
  setTitle(title) { this.title = title; return this; }
  setDescription(description) { this.description = description; return this; }
  setColor(color) { this.color = color; return this; }
  setFooter(footer) { this.footer = footer; return this; }
  addFields(...fields) { this.fields.push(...fields); return this; }
  addComponents(...components) { this.components.push(...components); return this; }
  setCustomId(customId) { this.customId = customId; return this; }
  setLabel(label) { this.label = label; return this; }
  setStyle(style) { this.style = style; return this; }
  setPlaceholder(placeholder) { this.placeholder = placeholder; return this; }
  addOptions(options) { this.options.push(...options); return this; }
}
const fakeDiscord = {
  ActionRowBuilder: Fluent,
  ButtonBuilder: Fluent,
  ButtonStyle: { Primary: 1, Secondary: 2 },
  EmbedBuilder: Fluent,
  StringSelectMenuBuilder: Fluent,
  MessageFlags: { Ephemeral: 64 },
};
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === 'discord.js') return fakeDiscord;
  return originalLoad.apply(this, [request, parent, isMain]);
};
const lol = require('../features/lol');
Module._load = originalLoad;
const GUILD_ID = '111111111111111111';
const createId = i => String(100000000000000000n + BigInt(i));
function mockInteraction(n, { botFixtureCount = 0 } = {}) {
  const members = new Map();
  for (let i = 0; i < n; i++) {
    const id = createId(i);
    members.set(id, {
      id,
      displayName: `Member ${i}`,
      user: { bot: i > 0 && i <= botFixtureCount },
      voice: { channelId: 'vc', channel: { name: 'VC' } },
      roles: { cache: new Map([[1, { name: ['Gold', 'Silver', 'Bronze', 'Diamond'][i % 4] }], [2, { name: ['TOP','JG','MID','ADC','SUP'][i % 5] }]]) },
    });
  }
  const callerId = createId(0);
  const interaction = {
    guildId: GUILD_ID, user: { id: callerId },
    guild: {
      id: GUILD_ID,
      members: { fetch: async id => members.get(id) },
      voiceStates: { cache: new Map([...members.keys()].map(id => [id, { id, channelId: 'vc' }])) },
    },
    deferReply: async () => {},
    editReply: async payload => { interaction.replied = payload; },
  };
  return interaction;
}
test('single human in VC receives a valid embed with no swap selector', async () => {
  const interaction = mockInteraction(1);
  await lol.start(interaction);
  assert.equal(interaction.replied.embeds[0].fields[0].value.includes('Member 0'), true);
  assert.equal(interaction.replied.embeds[0].fields[1].value, '（参加者なし）');
  assert.equal(interaction.replied.components.length, 1);
});
test('VC 2..10 humans: both teams and capped swap menu', async () => {
  for (let n = 2; n <= 10; n++) {
    const interaction = mockInteraction(n);
    await lol.start(interaction);
    assert.equal(interaction.replied.embeds.length, 1, `n=${n}`);
    assert.equal(interaction.replied.components.length, 2, `n=${n}`);
    const selector = interaction.replied.components[1].components[0];
    assert.equal(selector.options.length, Math.min(4, Math.floor(n / 2)), `n=${n}`);
  }
});
test('VC 11 humans receives a helpful error', async () => {
  const interaction = mockInteraction(11);
  await lol.start(interaction);
  assert.match(interaction.replied.content, /11 人/);
  assert.deepEqual(interaction.replied.components, []);
});
test('only explicitly allowlisted test bots are considered', async () => {
  const prevGuild = process.env.LOL_TEST_GUILD_ID;
  const prevIds = process.env.LOL_TEST_BOT_IDS;
  try {
    process.env.LOL_TEST_GUILD_ID = GUILD_ID;
    process.env.LOL_TEST_BOT_IDS = [createId(1), createId(2)].join(',');
    const interaction = mockInteraction(3, { botFixtureCount: 2 });
    await lol.start(interaction);
    assert.match(interaction.replied.embeds[0].footer.text, /参加者3人/);
    process.env.LOL_TEST_GUILD_ID = '222222222222222222';
    const onlyHuman = mockInteraction(3, { botFixtureCount: 2 });
    await lol.start(onlyHuman);
    assert.match(onlyHuman.replied.embeds[0].footer.text, /参加者1人/);
  } finally {
    if (prevGuild === undefined) delete process.env.LOL_TEST_GUILD_ID; else process.env.LOL_TEST_GUILD_ID = prevGuild;
    if (prevIds === undefined) delete process.env.LOL_TEST_BOT_IDS; else process.env.LOL_TEST_BOT_IDS = prevIds;
  }
});

test('role diagnosis shows recognized ranks, lowercase lane and raw role names', async () => {
  const interaction = mockInteraction(3);
  const role = interaction.guild.members.fetch;
  interaction.guild.members.fetch = async id => {
    const member = await role(id);
    if (member.id === createId(0)) member.roles.cache = new Map([
      ['r', { id: 'r', name: 'グランドマスター+α' }],
      ['l', { id: 'l', name: 'top' }],
    ]);
    return member;
  };
  interaction.deferReply = async opts => { interaction.deferOptions = opts; };
  await lol.diagnose(interaction);
  assert.match(interaction.replied.content, /Grandmaster\(8\)/);
  assert.match(interaction.replied.content, /レーン=TOP/);
  assert.match(interaction.replied.content, /グランドマスター\+α/);
  assert.ok(interaction.replied.content.length < 2000);
});