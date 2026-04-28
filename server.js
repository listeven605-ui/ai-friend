console.log("🚀 WECHAT AI V2 START")

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

mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ DB OK"))
  .catch(e => console.log("DB ERROR", e.message))

// =====================
// CHAT SESSION（核心升级）
// =====================
const MessageSchema = new mongoose.Schema({
  sessionId: String,   // 👈 多会话核心
  role: String,
  content: String,
  time: { type: Date, default: Date.now }
})

const SessionSchema = new mongoose.Schema({
  sessionId: String,
  title: String,
  memory: String,
  updatedAt: { type: Date, default: Date.now }
})

const Message = mongoose.model("Message", MessageSchema)
const Session = mongoose.model("Session", SessionSchema)

// =====================
// AI
// =====================
function buildPrompt(session) {
  return `
你叫若兰。

用户记忆：
${session.memory || "暂无"}

要求：
- 像真人聊天
- 简短
- 有情绪
`
}

// =====================
// CHAT
// =====================
app.post("/chat", async (req, res) => {
  const { sessionId, message } = req.body

  if (!sessionId) return res.json({ reply: "no session" })

  await Message.create({ sessionId, role: "user", content: message })

  let session = await Session.findOne({ sessionId })
  if (!session) {
    session = await Session.create({
      sessionId,
      title: "若兰",
      memory: ""
    })
  }

  // 🧠 简单记忆压缩（核心）
  session.memory = (session.memory + " " + message).slice(-300)
  session.updatedAt = new Date()

  await Session.updateOne({ sessionId }, session)

  const history = await Message.find({ sessionId })
    .sort({ time: -1 })
    .limit(12)

  const response = await axios.post(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      model: "openai/gpt-4o-mini",
      messages: [
        { role: "system", content: buildPrompt(session) },
        ...history.reverse().map(m => ({
          role: m.role,
          content: m.content
        })),
        { role: "user", content: message }
      ]
    },
    {
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      }
    }
  )

  const reply =
    response.data.choices?.[0]?.message?.content || "..."

  await Message.create({ sessionId, role: "assistant", content: reply })

  res.json({ reply })
})

// =====================
// SESSION LIST（微信首页）
// =====================
app.get("/sessions", async (req, res) => {
  const data = await Session.find().sort({ updatedAt: -1 })
  res.json(data)
})

// =====================
// HISTORY
// =====================
app.get("/history", async (req, res) => {
  const { sessionId } = req.query
  const data = await Message.find({ sessionId }).sort({ time: 1 })
  res.json(data)
})

// =====================
// SEARCH GLOBAL
// =====================
app.get("/search", async (req, res) => {
  const { q } = req.query

  const data = await Message.find({
    content: { $regex: q, $options: "i" }
  }).sort({ time: -1 })

  res.json(data)
})

app.listen(3000, () => console.log("RUN 3000"))