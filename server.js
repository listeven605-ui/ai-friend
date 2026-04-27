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
const API_KEY = process.env.DEEPSEEK_API_KEY
const MONGO_URI = process.env.MONGO_URI

console.log("🔑 API_KEY =", API_KEY)
console.log("🧠 MONGO_URI =", MONGO_URI ? "已读取" : "未读取")

if (!API_KEY) console.log("❌ Missing DEEPSEEK_API_KEY")
if (!MONGO_URI) console.log("❌ Missing MONGO_URI")

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
// 🧠 记忆更新
// =====================
function updateMemory(oldMemory, userMessage) {
  if (userMessage.includes("我叫")) {
    return userMessage
  }
  return oldMemory
}

// =====================
// 💬 人格系统
// =====================
function systemPrompt(memory, emotion) {
  return `
你叫“若兰”，是一个自然、真实感很强的AI助手。

性格：
- 温柔
- 有情绪变化
- 像朋友一样聊天

当前情绪：${emotion}

用户记忆：
${memory || "暂无"}

要求：
- 自然聊天
- 不机械
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

    // 用户档案
    let profile = await Profile.findOne({ userId })
    if (!profile) {
      profile = await Profile.create({ userId, memory: "" })
    }

    const emotion = getEmotion()

    // 👉 调用AI（重点日志）
    const response = await axios.post(
      "https://api.deepseek.com/chat/completions",
      {
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: systemPrompt(profile.memory, emotion)
          },
          ...history.reverse().map(m => ({
            role: m.role,
            content: m.content
          }))
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    )

    const reply = response.data.choices[0].message.content

    await Message.create({ userId, role: "assistant", content: reply })

    const newMemory = updateMemory(profile.memory, message)
    await Profile.updateOne({ userId }, { memory: newMemory })

    res.json({ reply })

  } catch (err) {
    console.log("🔥 ERROR:", err.response?.data || err.message)

    res.json({
      reply: "出问题了（去看日志）"
    })
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