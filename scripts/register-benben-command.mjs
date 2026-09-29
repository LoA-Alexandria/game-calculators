const applicationId = process.env.DISCORD_APPLICATION_ID;
const botToken = process.env.DISCORD_BOT_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID ?? "1534685294371274822";

if (!applicationId || !botToken) {
  console.error("Set DISCORD_APPLICATION_ID and DISCORD_BOT_TOKEN before running this script.");
  process.exit(1);
}

const commands = [
  { name: "benben", description: "Visit and care for the community pet Benben", type: 1 },
  {
    name: "share-content",
    description: "Share a Pop Epoch news post, guide, or event",
    type: 1,
    options: [
      {
        name: "category",
        description: "What kind of Pop Epoch content are you sharing?",
        type: 3,
        required: true,
        choices: [
          { name: "News", value: "news" },
          { name: "Guide", value: "guide" },
          { name: "Event", value: "event" },
        ],
      },
      { name: "title", description: "The title shown in the post", type: 3, required: true, max_length: 120 },
      { name: "summary", description: "A short introduction (up to 900 characters)", type: 3, required: true, max_length: 900 },
      { name: "link", description: "The published Pop Epoch page", type: 3, required: true, max_length: 300 },
    ],
  },
];

for (const command of commands) {
  const response = await fetch(`https://discord.com/api/v10/applications/${applicationId}/guilds/${guildId}/commands`, {
    method: "POST",
    headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });

  if (!response.ok) {
    console.error(`Discord command registration failed (${response.status}): ${await response.text()}`);
    process.exit(1);
  }

  const registered = await response.json();
  console.log(`Registered /${registered.name} (${registered.id}) in guild ${guildId}.`);
}
