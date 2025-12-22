const mqtt = require('mqtt');

// Connection options
const options = {
  host: '192.168.5.49',       // Mosquitto broker address
  port: 1883,               // Default MQTT port
  username: 'mqtt-test-user',       // Replace with your username
  password: 'mqtt-test-user11',   // Replace with your password
  protocol: 'mqtt'          // Protocol can be 'mqtt', 'mqtts', 'ws', 'wss'
};

// Connect to the broker
const client = mqtt.connect(options);

client.on('connect', () => {
  console.log('✅ Connected to Mosquitto broker');

  // Subscribe to a topic (or all topics with '#')
  client.subscribe('zlansub', (err) => {
    if (!err) {
      console.log('📡 Subscribed to all topics');
    } else {
      console.error('❌ Subscription error:', err);
    }
  });
});

client.on('message', (topic, message) => {
  console.log(`[${new Date().toISOString()}] Topic: ${topic} → Message: ${message.toString('hex')}`);
});

client.on('error', (err) => {
  console.error('❌ Connection error:', err);
});

client.on('close', () => {
  console.log('🔌 Disconnected from broker');
});


