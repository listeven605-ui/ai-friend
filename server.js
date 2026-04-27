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

if (!API_KEY) console.log("❌ Missing DEEPSEEK_API_KEY")
if (!MONGO_URI) console.log("❌ Missing MONGO_URI")

// =====================
// 🧠 MongoDB连接（稳定版）
// =====================
mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.log("❌ Mongo error:", err))

// =====================
// 🧾 数据结构（记忆系统）
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
// 🎭 情绪系统（可扩展）
// =====================
function getEmotion() {
  const list = ["平静", "开心", "想你", "低落", "温柔", "好奇"]
  return list[Math.floor(Math.random() * list.length)]
}

// =====================
// 🧠 长期记忆提取（升级点1）
// =====================
function updateMemory(oldMemory, userMessage, aiReply) {
  // 简单记忆规则（后面可以升级成AI总结）
  if (userMessage.includes("我叫")) {
    return userMessage
  }
  return oldMemory
}

// =====================
// 💬 人格系统（安全优化版）
// =====================
function systemPrompt(memory, emotion) {
  return `
你叫“若兰”，是一个自然、真实感很强的AI助手。

性格：
- 温柔
- 有情绪变化
- 喜欢和用户交流
- 像朋友一样聊天

当前情绪：${emotion}

已知关于用户的记忆：
${memory || "暂无记忆"}

规则：
- 不要提“我是AI”
- 不要机械回复
- 不要长篇解释
- 像真人一样自然对话
`
}

// =====================
// 🧠 聊天接口（核心）
// =====================
app.post("/chat", async (req, res) => {
  const { userId = "default", message } = req.body

  if (!message) {
    return res.json({ reply: "你还没说话呢。" })
  }

  try {
    // 1️⃣ 存用户消息
    await Message.create({ userId, role: "user", content: message })

    // 2️⃣ 获取历史（记忆窗口）
    const history = await Message.find({ userId })
      .sort({ time: -1 })
      .limit(10)

    // 3️⃣ 获取/创建用户档案
    let profile = await Profile.findOne({ userId })
    if (!profile) {
      profile = await Profile.create({ userId, memory: "" })
    }

    const emotion = getEmotion()

    // 4️⃣ 调用AI
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

    // 5️⃣ 存AI回复
    await Message.create({ userId, role: "assistant", content: reply })

    // 6️⃣ 更新记忆（升级点1）
    const newMemory = updateMemory(profile.memory, message, reply)
    await Profile.updateOne({ userId }, { memory: newMemory })

    res.json({ reply })

  } catch (err) {
    console.log(err)
    res.json({ reply: "我现在有点累，稍后再说吧。" })
  }
})

// =====================
// 🌐 健康检查（部署必备）
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