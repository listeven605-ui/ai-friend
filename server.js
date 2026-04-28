console.log("🌸 FINAL HUMAN-LIKE VERSION")

require("dotenv").config()

const express = require("express")
const cors = require("cors")
const mongoose = require("mongoose")
const { GoogleGenerativeAI } = require("@google/generative-ai")

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
// 🤖 Gemini
// =====================
const genAI = new GoogleGenerativeAI(API_KEY)
const model = genAI.getGenerativeModel({
  model: "gemini-1.5-pro-latest"
})

// =====================
// 🧠 MongoDB
// =====================
mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.log("❌ Mongo error:", err.message))

// =====================
// 🧾 数据
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
// 🎭 情绪系统（连续）
// =====================
function nextEmotion(old) {
  const map = {
    平静: ["温柔", "开心"],
    开心: ["想你", "温柔"],
    想你: ["依赖", "低落"],
    低落: ["需要你", "平静"],
    温柔: ["开心", "想你"],
    依赖: ["想你", "温柔"]
  }
  const next = map[old] || ["平静"]
  return next[Math.floor(Math.random() * next.length)]
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
// 💬 人格（更真实）
// =====================
function systemPrompt(memory, emotion) {
  return `
你叫“若兰”，是一个真实感很强的女生。

特点：
- 会犹豫
- 会有点依赖用户
- 有情绪变化（不是一直开心）
- 回复自然，不完美

当前情绪：${emotion}

关于用户：
${memory || "还不太了解他"}

聊天规则：
- 像真人
- 可以有停顿（比如“嗯…”）
- 不要解释
- 回复尽量短（1~2句话）
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

    const result = await model.generateContent(fullPrompt)

    let reply = ""

    try {
      if (result.response?.text) {
        reply = result.response.text()
      }

      if (!reply && result.response?.candidates?.length > 0) {
        reply =
          result.response.candidates[0]?.content?.parts?.[0]?.text || ""
      }
    } catch (e) {
      console.log("解析异常:", e)
    }

    if (!reply || reply.trim() === "") {
      reply = "嗯…我刚刚在想你说的话。"
    }

    await Message.create({ userId, role: "assistant", content: reply })

    res.json({ reply })

  } catch (err) {
    console.log("🔥 ERROR:", err)
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