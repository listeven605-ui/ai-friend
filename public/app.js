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
    body: JSON.stringify({
      userId: "me",
      message: text
    })
  })

  const data = await res.json()
  add(data.reply, "ai")

  scrollBottom()
}

function add(text, type) {
  const wrap = document.createElement("div")
  wrap.className = `msg ${type}`

  const bubble = document.createElement("div")
  bubble.innerText = text

  wrap.appendChild(bubble)
  document.getElementById("chat").appendChild(wrap)
}

function scrollBottom() {
  window.scrollTo({
    top: document.body.scrollHeight,
    behavior: "smooth"
  })
}