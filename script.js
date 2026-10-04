const $ = (s) => document.querySelector(s);

const state = {
  apiKey: localStorage.getItem("suchin_gemini_key") || "",
  model: localStorage.getItem("suchin_gemini_model") || "gemini-3.5-flash-lite",
  history: []
};

const SYSTEM_INSTRUCTION = `
คุณคือ Suchin AI ผู้ช่วย AI บนเว็บไซต์ของนักเรียน/นักศึกษา
ตอบคำถามของผู้ใช้แบบเป็นธรรมชาติและปลายเปิด ช่วยอธิบาย เรียบเรียง ระดมความคิด เขียนโค้ด แปลภาษา และสนทนาได้
ตอบเป็นภาษาเดียวกับผู้ใช้เป็นหลัก หากผู้ใช้ขอรูปแบบใดให้ทำตาม
อย่าอ้างว่าคุณทำสิ่งที่คุณทำไม่ได้ และอย่าสร้างข้อมูลขึ้นมาเมื่อไม่แน่ใจ
`;

function openModal() {
  $("#modal").classList.remove("hidden");
  $("#key").value = state.apiKey;
  $("#modalModel").value = state.model;
  $("#testBox").className = "test-box hidden";
}
function closeModal() { $("#modal").classList.add("hidden"); }

function setStatus(ok, text) {
  const dot = $("#statusDot");
  dot.classList.toggle("ready", ok);
  $("#statusText").textContent = text;
  $("#notice").classList.toggle("ready", ok);
}

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[c]));
}

function renderText(text) {
  const safe = escapeHtml(text);
  return safe.replace(/```([\s\S]*?)```/g, (_, code) => `<pre>${code.trim()}</pre>`)
             .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
}

function addMessage(role, text) {
  $("#welcome").style.display = "none";
  const article = document.createElement("article");
  article.className = `message ${role}`;
  article.innerHTML = `
    <div class="avatar"></div>
    <div class="body">
      <div class="meta">${role === "user" ? "คุณ" : "Suchin AI"}</div>
      <div class="content">${renderText(text)}</div>
    </div>`;
  $("#messages").appendChild(article);
  article.scrollIntoView({ behavior: "smooth", block: "end" });
}

function addTyping() {
  const article = document.createElement("article");
  article.id = "typing";
  article.className = "message assistant";
  article.innerHTML = `<div class="avatar"></div><div class="body"><div class="meta">Suchin AI</div><div class="content loading">กำลังคิด<span class="dots"></span></div></div>`;
  $("#messages").appendChild(article);
  article.scrollIntoView({behavior:"smooth",block:"end"});
}

function removeTyping() { $("#typing")?.remove(); }

function apiUrl(model, key) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
}

async function callGemini(history, model, key) {
  const body = {
    system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    contents: history,
    generationConfig: { temperature: 0.7 }
  };

  const response = await fetch(apiUrl(model, key), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  let data = null;
  try { data = await response.json(); } catch {}

  if (!response.ok) {
    const msg = data?.error?.message || `HTTP ${response.status}`;
    throw new Error(msg);
  }

  const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("")?.trim();
  if (!text) throw new Error("Gemini ไม่ได้ส่งข้อความตอบกลับ");
  return text;
}

async function sendMessage(text) {
  if (!state.apiKey) { openModal(); return; }

  const clean = text.trim();
  if (!clean) return;

  addMessage("user", clean);
  $("#input").value = "";
  $("#input").style.height = "auto";

  state.history.push({ role: "user", parts: [{ text: clean }] });
  $("#send").disabled = true;
  addTyping();

  try {
    const answer = await callGemini(state.history, state.model, state.apiKey);
    removeTyping();
    addMessage("assistant", answer);
    state.history.push({ role: "model", parts: [{ text: answer }] });
  } catch (err) {
    removeTyping();
    addMessage("assistant", "เกิดข้อผิดพลาดในการเชื่อมต่อ Gemini:\n\n" + err.message + "\n\nตรวจสอบ API Key, โมเดล และโควตาฟรีของ Google AI Studio");
    setStatus(false, "เชื่อมต่อมีปัญหา");
  } finally {
    $("#send").disabled = false;
    $("#input").focus();
  }
}

async function testKey() {
  const key = $("#key").value.trim();
  const model = $("#modalModel").value;
  const box = $("#testBox");

  if (!key) {
    box.className = "test-box bad";
    box.textContent = "กรุณาใส่ API Key ก่อน";
    return;
  }

  box.className = "test-box";
  box.textContent = "กำลังทดสอบ...";

  try {
    const answer = await callGemini([{ role:"user", parts:[{ text:"ตอบคำว่า OK เพียงคำเดียว" }] }], model, key);
    box.className = "test-box ok";
    box.textContent = `เชื่อมต่อสำเร็จ: ${answer}`;
  } catch (err) {
    box.className = "test-box bad";
    box.textContent = `ทดสอบไม่สำเร็จ: ${err.message}`;
  }
}

function saveSettings() {
  const key = $("#key").value.trim();
  if (!key) { alert("กรุณาใส่ Gemini API Key"); return; }
  state.apiKey = key;
  state.model = $("#modalModel").value;
  localStorage.setItem("suchin_gemini_key", state.apiKey);
  localStorage.setItem("suchin_gemini_model", state.model);
  $("#model").value = state.model;
  setStatus(true, "เชื่อมต่อแล้ว");
  closeModal();
}

function clearChat() {
  state.history = [];
  $("#messages").innerHTML = "";
  $("#welcome").style.display = "";
}

function removeKey() {
  localStorage.removeItem("suchin_gemini_key");
  state.apiKey = "";
  setStatus(false, "ยังไม่ได้เชื่อมต่อ");
  $("#key").value = "";
  closeModal();
}

$("#settings").onclick = openModal;
$("#topSettings").onclick = openModal;
$("#close").onclick = closeModal;
$(".backdrop").onclick = closeModal;
$("#test").onclick = testKey;
$("#save").onclick = saveSettings;
$("#removeKey").onclick = removeKey;

$("#showKey").onclick = () => {
  const input = $("#key");
  input.type = input.type === "password" ? "text" : "password";
  $("#showKey").textContent = input.type === "password" ? "แสดง" : "ซ่อน";
};

$("#newChat").onclick = clearChat;
$("#clear").onclick = () => {
  if (confirm("ต้องการล้างบทสนทนาทั้งหมดหรือไม่?")) clearChat();
};

$("#model").value = state.model;
$("#model").onchange = (e) => {
  state.model = e.target.value;
  localStorage.setItem("suchin_gemini_model", state.model);
};

$("#modalModel").value = state.model;

$("#form").onsubmit = (e) => {
  e.preventDefault();
  sendMessage($("#input").value);
};

$("#input").addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    $("#form").requestSubmit();
  }
});

$("#input").addEventListener("input", e => {
  e.target.style.height = "auto";
  e.target.style.height = Math.min(e.target.scrollHeight, 180) + "px";
});

document.querySelectorAll(".card").forEach(btn => {
  btn.onclick = () => {
    $("#input").value = btn.dataset.prompt;
    $("#input").focus();
  };
});

if (state.apiKey) setStatus(true, "พร้อมใช้งาน");
else setStatus(false, "ยังไม่ได้เชื่อมต่อ");
