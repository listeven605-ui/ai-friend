console.log("🌸 FULL UPGRADED SYSTEM START")

require("dotenv").config()

const express = require("express")
const cors = require("cors")
const mongoose = require("mongoose")
const axios = require("axios")

const app = express()
app.use(cors())
app.use(express.json())
app.use(express.static("public"))

// =====================
// 🔐 ENV
// =====================
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
const MONGO_URI = process.env.MONGO_URI

console.log("🔑 KEY =", OPENROUTER_API_KEY ? "OK" : "MISSING")

// =====================
// 🧠 DB
// =====================
mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ DB OK"))
  .catch(e => console.log("DB ERROR:", e.message))

const MessageSchema = new mongoose.Schema({
  userId: String,
  role: String,
  content: String,
  time: { type: Date, default: Date.now }
})

const ProfileSchema = new mongoose.Schema({
  userId: String,
  memory: String,
  emotion: String,
  name: String
})

const Message = mongoose.model("Message", MessageSchema)
const Profile = mongoose.model("Profile", ProfileSchema)

// =====================
// 🎭 emotion engine
// =====================
function nextEmotion(e) {
  const map = {
    平静: ["温柔", "开心"],
    开心: ["想你", "温柔"],
    想你: ["依赖", "低落"],
    低落: ["平静", "温柔"],
    温柔: ["开心", "想你"],
    依赖: ["想你", "温柔"]
  }
  return (map[e] || ["平静"])[Math.floor(Math.random() * 2)]
}

// =====================
// 🧠 memory
// =====================
function updateMemory(profile, msg) {
  if (msg.includes("我叫")) {
    profile.name = msg.replace("我叫", "")
  }
  profile.memory = msg
  return profile
}

// =====================
// 💬 prompt
// =====================
function systemPrompt(p) {
  return `
你叫若兰，是一个真实女生。

你有情绪，会变化：
当前情绪：${p.emotion}

你记得用户：
${p.memory || "不太了解"}

聊天方式：
- 简短
- 自然
- 像真人
- 可以有停顿
`
}

// =====================
// 💬 chat
// =====================
app.post("/chat", async (req, res) => {
  const { userId = "me", message } = req.body

  if (!message) return res.json({ reply: "嗯？" })

  try {
    await Message.create({ userId, role: "user", content: message })

    let profile = await Profile.findOne({ userId })
    if (!profile) {
      profile = await Profile.create({
        userId,
        memory: "",
        emotion: "平静",
        name: ""
      })
    }

    profile = updateMemory(profile, message)
    profile.emotion = nextEmotion(profile.emotion)

    await Profile.updateOne({ userId }, profile)

    const history = await Message.find({ userId })
      .sort({ time: -1 })
      .limit(6)

    const prompt = `
${systemPrompt(profile)}

对话：
${history.reverse().map(m => m.content).join("\n")}
用户：${message}
若兰：
`

    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "openai/gpt-4o-mini",
        messages: [
          { role: "user", content: prompt }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`
        }
      }
    )

    const reply =
      response.data.choices?.[0]?.message?.content ||
      "我刚刚走神了…"

    await Message.create({ userId, role: "assistant", content: reply })

    res.json({ reply })

  } catch (e) {
    console.log(e.response?.data || e.message)
    res.json({ reply: "我有点乱…" })
  }
})

app.listen(3000, () => console.log("RUN 3000"))