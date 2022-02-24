// Require the necessary discord.js classes

// Invite for the Bot:
// 
// https://discord.com/api/oauth2/authorize?client_id=935095039296688158&permissions=68608&scope=applications.commands%20bot

const { Client, Intents } = require('discord.js');
const { token } = require('./config.json');

// Create a new client instance
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.DIRECT_MESSAGES, Intents.FLAGS.GUILD_MESSAGES] });

// Login to Discord with your client's token
client.login(token);

// When the client is ready, run this code (only once)
client.once('ready', () => {
	console.log('Ready!');

    const channel = client.channels.cache.get("908171405789646891");
   // channel.send("test");

    channel.messages.fetch({ limit: 100, after: "0" }).then(messages => {
        console.log(`Received ${messages.size} messages`);
        //Iterate through the messages here with the variable "messages".
        messages.forEach(message =>  {
          console.log("ID:"+message.id);
            console.log("Content:"+message.content);
            console.log("CreatedAt:"+message.createdAt+" editedAt: "+message.editedAt);
        }
            )
      })



});
