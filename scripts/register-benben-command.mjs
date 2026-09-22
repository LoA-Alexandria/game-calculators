const applicationId = process.env.DISCORD_APPLICATION_ID;
const botToken = process.env.DISCORD_BOT_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID ?? "1534685294371274822";

if (!applicationId || !botToken) {
  console.error("Set DISCORD_APPLICATION_ID and DISCORD_BOT_TOKEN before running this script.");
  process.exit(1);
}

const response = await fetch(`https://discord.com/api/v10/applications/${applicationId}/guilds/${guildId}/commands`, {
  method: "POST",
  headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
  body: JSON.stringify({ name: "benben", description: "Visit and care for the community pet Benben", type: 1 }),
});

if (!response.ok) {
  console.error(`Discord command registration failed (${response.status}): ${await response.text()}`);
  process.exit(1);
}

const command = await response.json();
console.log(`Registered /${command.name} (${command.id}) in guild ${guildId}.`);
