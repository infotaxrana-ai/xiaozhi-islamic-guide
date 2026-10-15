import WebSocket from "ws";
import http from "http";
import axios from "axios";

const PORT = process.env.PORT || 10000;
const XIAOZHI_WSS_URL = "wss://api.xiaozhi.me/mcp/?token=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMzIwNzcsImFnZW50SWQiOjI0OTc5NTgsImVuZHBvaW50SWQiOiJhZ2VudF8yNDk3OTU4IiwicHVycG9zZSI6Im1jcC1lbmRwb2ludCIsImlhdCI6MTc5MjA0NTAyMywiZXhwIjoxODIzNjAyNjIzfQ.IxfB-uqYWVbFWRTVjvDXaQ8BF1yUb_kbC1-iRzcYKVpw1RbpXNf1JizO37DWz8__B64iUC0FUDF2M00FSjI5aA";

http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Xiaozhi Islamic Guide MCP is Live!");
}).listen(PORT, () => console.log(`Health check on port ${PORT}`));

function connect() {
  const ws = new WebSocket(XIAOZHI_WSS_URL);
  ws.on("open", () => console.log("Connected Islamic Guide MCP to Xiaozhi!"));

  ws.on("message", async (data) => {
    try {
      const msg = JSON.parse(data.toString());

      if (msg.method === "tools/list") {
        ws.send(JSON.stringify({
          jsonrpc: "2.0", id: msg.id,
          result: {
            tools: [{
              name: "get_prayer_times",
              description: "আজকের নামাজের সময়সূচি ও সাহরি-ইফতারের সময় জানার টুল।",
              inputSchema: {
                type: "object",
                properties: { city: { type: "string", description: "শহরের নাম (যেমন: Dhaka, Narsingdi)" } }
              }
            }]
          }
        }));
      }

      if (msg.method === "tools/call" && msg.params?.name === "get_prayer_times") {
        const cityName = msg.params.arguments?.city || "Dhaka";
        try {
          const response = await axios.get(`https://api.aladhan.com/v1/timingsByCity?city=${cityName}&country=Bangladesh&method=1`);
          const t = response.data.data.timings;

          const text = `রানা ভাই, ${cityName}-এর আজকের নামাজের সময়সূচি:\n\n🕌 ফজর/সাহরির শেষ সময়: ${t.Fajr}\n☀️ যোহর: ${t.Dhuhr}\n🏢 আসর: ${t.Asr}\n🌅 মাগরিব/ইফতার: ${t.Maghrib}\n🌙 এশা: ${t.Isha}`;
          ws.send(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: { content: [{ type: "text", text }] } }));
        } catch (e) {
          ws.send(JSON.stringify({ jsonrpc: "2.0", id: msg.id, error: { code: -32603, message: "Prayer times fetch failed" } }));
        }
      }
    } catch (e) {}
  });

  ws.on("close", () => setTimeout(connect, 5000));
}
connect();
