const dgram = require("dgram");
const os = require("os");

// Porta padrão do Art-Net
const ARTNET_PORT = 6454;
const server = dgram.createSocket("udp4");
const client = dgram.createSocket("udp4");

server.on("listening", () => {
  const address = server.address();
  console.log(`🎭 Art-Net listener ativo em ${address.address}:${address.port}`);
});

server.on("message", (msg, rinfo) => {
  // Checa se o pacote é Art-Net
  if (msg.toString("ascii", 0, 7) === "Art-Net") {
    const opcode = msg.readUInt16LE(8);

    if (opcode === 0x5000) {
      // ArtDmx packet
      const universe = msg.readUInt16LE(14);
      const length = msg.readUInt16BE(16);
      const dmxData = msg.slice(18, 18 + length);

      console.log(`🎛️ Pacote DMX recebido de ${rinfo.address}`);
      console.log(`  Universo: ${universe}`);
      console.log(`  Tamanho: ${length}`);
      console.log(`  Dados (primeiros 18 canais):`, [...dmxData.slice(0, 18)]);
    } else {
      console.log(`📦 Outro pacote Art-Net (OpCode: 0x${opcode.toString(16)})`);
    }
  } else {
    console.log("📡 Pacote não é Art-Net");
  }
});



// Obtém o endereço de broadcast da rede
// Para WSL, pode ser necessário usar o IP do host Windows ou o broadcast da rede
const networkInterfaces = os.networkInterfaces();

// Tenta encontrar um endereço de broadcast apropriado
function getBroadcastAddress() {
  // Em WSL, tenta usar o IP do gateway (geralmente o host Windows)
  for (const name of Object.keys(networkInterfaces)) {
    for (const iface of networkInterfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        // Calcula broadcast: IP & subnet mask, depois inverte subnet
        const maskParts = iface.netmask.split(".").map(Number);
        const ipParts = iface.address.split(".").map(Number);
        const broadcast = ipParts.map((ipPart, i) => {
          const maskPart = maskParts[i];
          // Broadcast = (IP & Mask) | (~Mask & 0xFF)
          return (ipPart & maskPart) | ((~maskPart) & 0xFF);
        }).join(".");
        console.log(`📡 Usando interface: ${name}, IP: ${iface.address}, Broadcast: ${broadcast}`);
        return broadcast;
      }
    }
  }
  // Fallback para broadcast global
  console.log("📡 Usando broadcast global: 255.255.255.255");
  return "255.255.255.255";
}

const broadcastAddress = getBroadcastAddress();
let sequenceCounter = 0;
const startTime = Date.now();

// Função para gerar efeito de dimmer Halloween (ritmo lento e pulsante)
function getHalloweenDimmingValue(time) {
  // Ritmo principal: pulso lento (ciclo de ~3 segundos)
  const slowPulse = Math.sin(time * 0.002) * 0.3 + 0.7; // Varia entre 40% e 100%
  
  // Ritmo secundário: pulso médio para variação orgânica (ciclo de ~1.5 segundos)
  const mediumPulse = Math.sin(time * 0.004) * 0.15;
  
  // Ritmo terciário: micro-variações para efeito "respiração" (ciclo de ~0.5 segundos)
  const fastPulse = Math.sin(time * 0.012) * 0.1;
  
  // Combina os ritmos para efeito orgânico
  const combined = slowPulse + mediumPulse + fastPulse;
  
  // Garante que o valor está entre 0.1 e 1.0 (mantém sempre algo visível, mas varia)
  const normalized = Math.max(0.1, Math.min(1.0, combined));
  
  // Converte para 0-255
  return Math.round(normalized * 255);
}

// Liga o cliente e habilita broadcast após o bind
client.bind(() => {
  // Habilita broadcast no socket cliente para poder enviar para broadcast address
  client.setBroadcast(true);
  console.log("📡 Cliente Art-Net pronto para enviar");
  console.log(`📡 Enviando para: ${broadcastAddress}:${ARTNET_PORT}`);
  console.log("🎃 Modo Halloween ativo - dimming pulsante no canal 1");
  
  // Inicia o envio periódico após o socket estar pronto
  // Intervalo de 50ms para animação suave
  setInterval(() => {
    // Envia pacote no universo 0 com 512 canais
    const dmxData = Buffer.alloc(512, 0);
    dmxData.fill(0);
    
    // Calcula tempo desde o início
    const elapsedTime = Date.now() - startTime;
    
    // Aplica efeito Halloween no canal 1 (dmxData[0])
    dmxData[0] = getHalloweenDimmingValue(elapsedTime);
    dmxData[5] = getHalloweenDimmingValue(elapsedTime);
    

    sequenceCounter = (sequenceCounter + 1) % 256; // Incrementa sequência (0-255)
    sendArtDmx(0, dmxData, broadcastAddress, sequenceCounter);
  }, 50); // 50ms = 20 updates por segundo para animação suave
});

server.bind(ARTNET_PORT);

// Função para enviar pacote ArtDmx
function sendArtDmx(universe, dmxData, targetAddress = "255.255.255.255", sequence = 0) {
  // Art-Net requer um byte de start code (0x00) antes dos dados DMX
  const dataLength = 1 + dmxData.length; // Start code + DMX data
  const buffer = Buffer.allocUnsafe(18 + dataLength);
  
  // Header "Art-Net\0" (8 bytes)
  buffer.write("Art-Net", 0, "ascii");
  buffer[7] = 0;
  
  // OpCode: 0x5000 (ArtDmx) - little-endian (2 bytes)
  buffer.writeUInt16LE(0x5000, 8);
  
  // Protocol version: 14 - little-endian (2 bytes)
  buffer.writeUInt16LE(14, 10);
  
  // Sequence (1 byte) - alguns dispositivos precisam de sequência não-zero
  buffer[12] = sequence;
  
  // Physical input port (1 byte) - 0
  buffer[13] = 0;
  
  // Universe - little-endian (2 bytes)
  buffer.writeUInt16LE(universe, 14);
  
  // Length of DMX data INCLUDING start code - big-endian (2 bytes)
  buffer.writeUInt16BE(dataLength, 16);
  
  // DMX Start Code (1 byte) - 0x00 para dados DMX normais
  buffer[18] = 0x00;
  
  // DMX data (começa no byte 19)
  dmxData.copy(buffer, 18);
  
  // Envia o pacote
  client.send(buffer, 0, buffer.length, ARTNET_PORT, targetAddress, (err) => {
    if (err) {
      console.error("❌ Erro ao enviar pacote Art-Net:", err);
    } else {
      console.log(`✅ Pacote Art-Net enviado - Universo: ${universe}, Tamanho: ${dataLength} (incl. start code)`);
    }
  });
}
