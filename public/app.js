async function loadSessions() {
  const res = await fetch("/sessions")
  const data = await res.json()

  const list = document.getElementById("sessionList")
  list.innerHTML = ""

  data.forEach(s => {
    const div = document.createElement("div")
    div.className = "session"
    div.innerText = s.title

    div.onclick = () => {
      location.href = `/chat.html?id=${s.sessionId}`
    }

    list.appendChild(div)
  })
}

async function globalSearch(q) {
  if (!q) return loadSessions()

  const res = await fetch(`/search?q=${q}`)
  const data = await res.json()

  console.log(data)
}

loadSessions()