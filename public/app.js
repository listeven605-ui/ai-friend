let lastDate = null

window.onload = async () => {
  const res = await fetch("/history?userId=me")
  const data = await res.json()

  data.forEach(m => {
    add(m.content, m.role === "user" ? "me" : "ai", m.time)
  })

  scrollBottom()
}

async function send() {
  const input = document.getElementById("msg")
  const text = input.value.trim()
  if (!text) return

  add(text, "me")
  input.value = ""

  scrollBottom()

  const res = await fetch("/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: "me", message: text })
  })

  const data = await res.json()
  add(data.reply, "ai")

  scrollBottom()
}

function add(text, type, time = new Date()) {
  const date = new Date(time).toDateString()

  if (date !== lastDate) {
    lastDate = date
    const div = document.createElement("div")
    div.style.textAlign = "center"
    div.style.color = "#999"
    div.style.fontSize = "12px"
    div.innerText = date
    document.getElementById("chat").appendChild(div)
  }

  const wrap = document.createElement("div")
  wrap.className = "msg " + type

  const bubble = document.createElement("div")
  bubble.innerText = text

  wrap.appendChild(bubble)
  document.getElementById("chat").appendChild(wrap)
}

function scrollBottom() {
  window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })
}

async function searchChat(q) {
  const res = await fetch(`/history/search?q=${q}&userId=me`)
  const data = await res.json()

  document.getElementById("chat").innerHTML = ""

  data.forEach(m => {
    add(m.content, m.role === "user" ? "me" : "ai", m.time)
  })
}

async function loadByDate(date) {
  const res = await fetch(`/history/date?date=${date}&userId=me`)
  const data = await res.json()

  document.getElementById("chat").innerHTML = ""

  data.forEach(m => {
    add(m.content, m.role === "user" ? "me" : "ai", m.time)
  })
}