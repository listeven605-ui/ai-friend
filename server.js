console.log("🌸 FINAL OPENROUTER VERSION")

require("dotenv").config()

const express = require("express")
const cors = require("cors")
const mongoose = require("mongoose")
const axios = require("axios")

const app = express()
app.use(cors())
app.use(express.json())
app.use(express.static(__dirname))

// =====================
// 🔐 环境变量
// =====================
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
const MONGO_URI = process.env.MONGO_URI

console.log("🔑 OPENROUTER KEY =", OPENROUTER_API_KEY ? "已读取" : "未读取")

// =====================
// 🧠 MongoDB
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
  memory: String,
  emotion: String
})

const Message = mongoose.model("Message", MessageSchema)
const Profile = mongoose.model("Profile", ProfileSchema)

// =====================
// 🎭 情绪系统
// =====================
function nextEmotion(old) {
  const map = {
    平静: ["温柔", "开心"],
    开心: ["想你", "温柔"],
    想你: ["依赖", "低落"],
    低落: ["平静", "温柔"],
    温柔: ["开心", "想你"],
    依赖: ["想你", "温柔"]
  }
  const list = map[old] || ["平静"]
  return list[Math.floor(Math.random() * list.length)]
}

// =====================
// 🧠 记忆更新
// =====================
function updateMemory(oldMemory, msg) {
  if (msg.includes("我叫")) return msg
  if (msg.includes("喜欢")) return msg
  return oldMemory
}

// =====================
// 💬 人格系统（若兰）
// =====================
function systemPrompt(memory, emotion) {
  return `
你叫“若兰”，是一个真实感很强的女生。

性格：
- 温柔
- 有情绪变化
- 有一点依赖用户
- 像真实人一样聊天

当前情绪：${emotion}

关于用户记忆：
${memory || "还不太了解他"}

聊天规则：
- 简短自然（1~2句）
- 可以有停顿感（比如“嗯…”）
- 不要解释自己
- 不要像机器人
`
}

// =====================
// 🧠 聊天接口（OpenRouter版）
// =====================
app.post("/chat", async (req, res) => {
  const { userId = "default", message } = req.body

  if (!message) {
    return res.json({ reply: "你还没说话呢。" })
  }

  try {
    await Message.create({ userId, role: "user", content: message })

    const history = await Message.find({ userId })
      .sort({ time: -1 })
      .limit(8)

    let profile = await Profile.findOne({ userId })
    if (!profile) {
      profile = await Profile.create({
        userId,
        memory: "",
        emotion: "平静"
      })
    }

    // 更新情绪 + 记忆
    const emotion = nextEmotion(profile.emotion)
    const memory = updateMemory(profile.memory, message)

    await Profile.updateOne({ userId }, { emotion, memory })

    const fullPrompt = `
${systemPrompt(memory, emotion)}

对话：
${history.reverse().map(m => m.content).join("\n")}

用户：${message}
若兰：
`

    // =====================
    // 🤖 OpenRouter 调用
    // =====================
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "openai/gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: systemPrompt(memory, emotion)
          },
          {
            role: "user",
            content: fullPrompt
          }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost",
          "X-Title": "RuoLan AI"
        }
      }
    )

    let reply =
      response.data?.choices?.[0]?.message?.content ||
      "嗯…我刚刚在想你说的话。"

    await Message.create({ userId, role: "assistant", content: reply })

    res.json({ reply })

  } catch (err) {
    console.log("🔥 ERROR:", err.response?.data || err.message)
    res.json({ reply: "我有点乱…等一下好吗。" })
  }
})

// =====================
// 🌐 首页
// =====================
app.get("/", (req, res) => {
  res.send("AI running 🌸")
})

// =====================
// 🚀 启动
// =====================
const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log("🚀 running:", PORT)
})