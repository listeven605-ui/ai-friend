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
  const div = document.createElement("div")
  div.className = "msg " + type
  div.innerText = text
  document.getElementById("chat").appendChild(div)
}