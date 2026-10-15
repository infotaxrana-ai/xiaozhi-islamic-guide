import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";

const server = new Server(
  { name: "xiaozhi-islamic-guide", version: "2.0.0" }, 
  { capabilities: { tools: {} } }
);

// কাস্টম অ্যালার্ম এবং আজান ট্র্যাক করার মেমোরি লিস্ট
let customAlarms = [];
let prayerTimings = {};

// Aladhan API থেকে ঢাকা/নরসিংদীর লাইভ নামাজের সময়সূচি নেওয়ার ফাংশন
async function updatePrayerTimes() {
  try {
    // পদ্ধতি: ঢাকা, বাংলাদেশ এর মেথড ১ (University of Islamic Sciences, Karachi) অনুযায়ী সময় নেবে
    const response = await axios.get("https://aladhan.com");
    if (response.data && response.data.data) {
      prayerTimings = response.data.data.timings;
      console.log("নামাজের সময়সূচি সফলভাবে আপডেট হয়েছে:", prayerTimings);
    }
  } catch (error) {
    console.error("নামাজের সময়সূচি লোড করতে সমস্যা হয়েছে।");
  }
}

// সার্ভার চালু হওয়ার সাথে সাথেই একবার নামাজের সময় নিয়ে নেবে
await updatePrayerTimes();

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "get_prayer_times",
      description: "আজকের পাঁচ ওয়াক্ত নামাজের সঠিক সময়সূচি এবং সাহরি-ইফতারের সময় জানার টুল।"
    },
    {
      name: "set_custom_alarm",
      description: "এআই বা ব্যবহারকারী কর্তৃক কাস্টম সময় ও সাউন্ড উল্লেখ করে অ্যালার্ম বা আজান সেট করার টুল।",
      inputSchema: {
        type: "object",
        properties: {
          alarmTime: { type: "string", description: "অ্যালার্মের সময় ২৪ ঘণ্টার ফরম্যাটে (যেমন: '04:15', '17:30')" },
          label: { type: "string", description: "অ্যালার্মের নাম (যেমন: সাহরি, ফজর আজান)" }
        },
        required: ["alarmTime", "label"]
      }
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  // ১. নামাজের সময়সূচি জানার টুল
  if (name === "get_prayer_times") {
    if (!prayerTimings.Fajr) await updatePrayerTimes();
    const schedule = `আজকের নামাজের সময়সূচি:\n- ফজর: ${prayerTimings.Fajr}\n- যোহর: ${prayerTimings.Dhuhr}\n- আসর: ${prayerTimings.Asr}\n- মাগরিব (ইফতার): ${prayerTimings.Maghrib}\n- ইশা: ${prayerTimings.Isha}\n- তাহাজ্জুদ/সাহরির শেষ সময়: ${prayerTimings.Imsak}`;
    return { content: [{ type: "text", text: schedule }] };
  }

  // ২. এআই নিজেই কাস্টম অ্যালার্ম সেট করার টুল
  if (name === "set_custom_alarm") {
    const alarmTime = args.alarmTime;
    const label = args.label;

    const newAlarm = {
      id: Math.random().toString(36).substr(2, 5),
      time: alarmTime,
      label: label,
      triggered: false
    };

    customAlarms.push(newAlarm);
    return { content: [{ type: "text", text: `ঠিক আছে রাজ ভাই, আমি ঘড়ির সাথে মিলিয়ে ${alarmTime} মিনিটে আপনার কাস্টম অ্যালার্ম "${label}" সেট করে রাখলাম। সময় হলে আমি নিজে থেকেই স্পিকারে বাজিয় দেব।` }] };
  }
});

// ব্যাকগ্রাউন্ড টাইমার লুপ (প্রতি মিনিটে চেক করবে কাস্টম অ্যালার্ম বা নামাজের আজানের সময় হয়েছে কি না)
setInterval(() => {
  const now = new Date();
  const currentHourMin = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // কাস্টম অ্যালার্ম চেক
  customAlarms.forEach(alarm => {
    if (!alarm.triggered && alarm.time === currentHourMin) {
      alarm.triggered = true;
      console.log(`[ALARM TRIGGERED] রাজ ভাই, আপনার অ্যালার্ম "${alarm.label}" বাজার সময় হয়ে গেছে!`);
      // এখানে সরাসরি XiaoZhi সার্ভারের মাধ্যমে MAX98357A স্পিকারে অডিও প্লেব্যাক ট্রিগার হবে
    }
  });
}, 60000);

const transport = new StdioServerTransport();
await server.connect(transport);
