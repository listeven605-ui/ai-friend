require("dotenv").config()

const express = require("express")
const axios = require("axios")
const cors = require("cors")
const mongoose = require("mongoose")

const app = express()
app.use(cors())
app.use(express.json())
app.use(express.static(__dirname))

// =====================
// 🔐 环境变量
// =====================
const API_KEY = process.env.GEMINI_API_KEY
const MONGO_URI = process.env.MONGO_URI

console.log("🔑 GEMINI KEY =", API_KEY ? "已读取" : "未读取")

// =====================
// 🧠 MongoDB连接
// =====================
mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.log("❌ Mongo error:", err.message))

// =====================
// 🧾 数据结构
// =====================
const MessageSchema = new mongoose.Schema({
  userId: String,
  role: String,
  content: String,
  time: { type: Date, default: Date.now }
})

const ProfileSchema = new mongoose.Schema({
  userId: String,
  memory: String
})

const Message = mongoose.model("Message", MessageSchema)
const Profile = mongoose.model("Profile", ProfileSchema)

// =====================
// 🎭 情绪系统
// =====================
function getEmotion() {
  const list = ["平静", "开心", "想你", "低落", "温柔", "好奇"]
  return list[Math.floor(Math.random() * list.length)]
}

// =====================
// 💬 人格系统
// =====================
function systemPrompt(memory, emotion) {
  return `
你叫“若兰”，是一个自然、真实感很强的女生。

性格：
- 温柔
- 有情绪变化
- 像朋友一样聊天

当前情绪：${emotion}

关于用户的记忆：
${memory || "暂无"}

要求：
- 自然聊天
- 简短一点
`
}

// =====================
// 🧠 聊天接口
// =====================
app.post("/chat", async (req, res) => {
  const { userId = "default", message } = req.body

  if (!message) {
    return res.json({ reply: "你还没说话呢。" })
  }

  try {
    // 存用户消息
    await Message.create({ userId, role: "user", content: message })

    // 历史
    const history = await Message.find({ userId })
      .sort({ time: -1 })
      .limit(10)

    let profile = await Profile.findOne({ userId })
    if (!profile) {
      profile = await Profile.create({ userId, memory: "" })
    }

    const emotion = getEmotion()

    // 👉 拼对话
    const fullPrompt = `
${systemPrompt(profile.memory, emotion)}

对话历史：
${history.reverse().map(m => m.content).join("\n")}

用户：${message}
AI：
`

    // 👉 调用 Gemini
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent`,
      {
        contents: [
          {
            parts: [{ text: fullPrompt }]
          }
        ]
      }
    )

    const reply =
      response.data.candidates?.[0]?.content?.parts?.[0]?.text ||
      "我有点走神了..."

    await Message.create({ userId, role: "assistant", content: reply })

    res.json({ reply })

  } catch (err) {
    console.log("🔥 ERROR:", err.response?.data || err.message)
    res.json({ reply: "出问题了（看日志）" })
  }
})

// =====================
// 🌐 首页
// =====================
app.get("/", (req, res) => {
  res.send("AI server is running 🚀")
})

// =====================
// 🚀 启动
// =====================
const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log("🚀 AI running on port:", PORT)
})