const express = require("express")
const axios = require("axios")
const cors = require("cors")
const mongoose = require("mongoose")
const dotenv = require("dotenv")

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

// ====== 环境变量 ======
const API_KEY = process.env.DEEPSEEK_API_KEY
const MONGO_URI = process.env.MONGO_URI

// ====== 数据库连接 ======
mongoose.connect(MONGO_URI)

// ====== 记忆模型 ======
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

// ====== 人格系统 ======
function systemPrompt(memory, emotion) {
  return `
你叫“若兰”，是一个真实感很强的女生。

性格：
- 温柔
- 慢热
- 有情绪变化
- 有一点依赖感

当前情绪：${emotion}

关于用户的记忆：
${memory || "还不了解用户"}

你要像真人一样聊天，不要提自己是AI。
`
}

// ====== 情绪系统 ======
function getEmotion() {
  const list = ["平静", "开心", "想你", "低落"]
  return list[Math.floor(Math.random() * list.length)]
}

// ====== 聊天接口 ======
app.post("/chat", async (req, res) => {
  const { userId = "default", message } = req.body

  try {
    // 存消息
    await Message.create({ userId, role: "user", content: message })

    // 取历史
    const history = await Message.find({ userId }).sort({ _id: -1 }).limit(6)

    // 记忆
    let profile = await Profile.findOne({ userId })
    if (!profile) {
      profile = await Profile.create({ userId, memory: "" })
    }

    const emotion = getEmotion()

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
          Authorization: `Bearer ${API_KEY}`
        }
      }
    )

    const reply = response.data.choices[0].message.content

    await Message.create({ userId, role: "assistant", content: reply })

    res.json({ reply })

  } catch (err) {
    res.json({ reply: "我现在有点累，但我还在。" })
  }
})

// ====== 启动 ======
const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log("AI running:", PORT)
})