console.log("🌸 WECHAT UI FULL SYSTEM")

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
// ENV
// =====================
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
const MONGO_URI = process.env.MONGO_URI

// =====================
// DB
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
  emotion: String
})

const Message = mongoose.model("Message", MessageSchema)
const Profile = mongoose.model("Profile", ProfileSchema)

// =====================
// emotion
// =====================
function nextEmotion(e = "平静") {
  const map = {
    平静: ["温柔", "开心"],
    开心: ["想你", "温柔"],
    想你: ["依赖", "低落"],
    低落: ["平静", "温柔"],
    温柔: ["开心", "想你"],
    依赖: ["想你", "温柔"]
  }
  const list = map[e] || ["平静"]
  return list[Math.floor(Math.random() * list.length)]
}

// =====================
// memory
// =====================
function updateMemory(profile, msg) {
  if (msg.includes("我叫")) profile.memory = msg
  return profile
}

// =====================
// prompt
// =====================
function systemPrompt(profile) {
  return `
你叫若兰，是一个真实女生。

情绪：${profile.emotion}
记忆：${profile.memory || "未知"}

风格：
- 简短
- 像真人
- 有情绪
`
}

// =====================
// chat
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
        emotion: "平静"
      })
    }

    profile = updateMemory(profile, message)
    profile.emotion = nextEmotion(profile.emotion)

    await Profile.updateOne({ userId }, profile)

    const history = await Message.find({ userId })
      .sort({ time: -1 })
      .limit(10)

    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "openai/gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: systemPrompt(profile)
          },
          ...history.reverse().map(m => ({
            role: m.role,
            content: m.content
          })),
          {
            role: "user",
            content: message
          }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json`
        }
      }
    )

    const reply =
      response.data.choices?.[0]?.message?.content ||
      "我有点走神了…"

    await Message.create({ userId, role: "assistant", content: reply })

    res.json({ reply })

  } catch (e) {
    console.log(e.response?.data || e.message)
    res.json({ reply: "我有点乱…" })
  }
})

// =====================
// history API
// =====================
app.get("/history", async (req, res) => {
  const { userId = "me" } = req.query

  const data = await Message.find({ userId })
    .sort({ time: 1 })

  res.json(data)
})

app.get("/history/search", async (req, res) => {
  const { userId = "me", q = "" } = req.query

  const data = await Message.find({
    userId,
    content: { $regex: q, $options: "i" }
  }).sort({ time: -1 })

  res.json(data)
})

app.get("/history/date", async (req, res) => {
  const { userId = "me", date } = req.query

  const start = new Date(date)
  const end = new Date(date)
  end.setDate(end.getDate() + 1)

  const data = await Message.find({
    userId,
    time: { $gte: start, $lt: end }
  }).sort({ time: 1 })

  res.json(data)
})

app.listen(3000, () => console.log("RUN 3000"))