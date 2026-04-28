async function send() {
  const input = document.getElementById("msg")
  const text = input.value
  if (!text) return

  add(text, "me")
  input.value = ""

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
}

function add(text, type) {
  const wrap = document.createElement("div")
  wrap.className = "msg " + type

  const bubble = document.createElement("div")
  bubble.innerText = text

  wrap.appendChild(bubble)
  document.getElementById("chat").appendChild(wrap)

  window.scrollTo(0, document.body.scrollHeight)
}