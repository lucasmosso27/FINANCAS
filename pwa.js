// Só no app instalado: funcionar offline, senha ao abrir e lembrete de backup.
(() => {
  const $ = id => document.getElementById(id);
  const ls = {
    get: k => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} }
  };

  // ---------- Offline ----------
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  // Pede ao sistema para não apagar os dados por falta de espaço
  navigator.storage?.persist?.().catch(() => {});

  // ---------- Senha ----------
  async function hash(pin, sal) {
    const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(sal + ":" + pin));
    return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
  }
  const temPin = () => !!ls.get("pinHash");
  function travar() {
    if (!temPin()) return;
    $("trava").hidden = false; $("travaPin").value = ""; $("travaMsg").textContent = "";
    setTimeout(() => $("travaPin").focus(), 50);
  }
  async function conferir() {
    const v = $("travaPin").value;
    if (!v) return;
    if (await hash(v, ls.get("pinSal")) === ls.get("pinHash")) { $("trava").hidden = true; $("travaPin").blur(); }
    else { $("travaMsg").textContent = "Senha errada."; $("travaPin").value = ""; }
  }
  $("travaOk").addEventListener("click", conferir);
  $("travaPin").addEventListener("keydown", e => { if (e.key === "Enter") conferir(); });
  $("travaPin").addEventListener("input", e => { if (e.target.value.length === +(ls.get("pinLen") || 0)) conferir(); });
  if (temPin()) travar();
  // Volta a pedir a senha se o app ficou mais de 1 minuto em segundo plano
  let saiuEm = 0;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) saiuEm = Date.now();
    else if (saiuEm && Date.now() - saiuEm > 60000) travar();
  });

  function renderPin() {
    const on = temPin();
    $("pinInfo").textContent = on ? "Ativa: pede a senha ao abrir o app." : "Pede uma senha ao abrir o app.";
    $("pinNovo").placeholder = on ? "Nova senha (4 a 6 números)" : "Senha (4 a 6 números)";
    $("pinSalvar").textContent = on ? "Trocar senha" : "Ativar senha";
    $("pinTirar").hidden = !on;
  }
  $("pinSalvar").addEventListener("click", async () => {
    const v = $("pinNovo").value.trim(), m = $("pinMsg");
    if (!/^\d{4,6}$/.test(v)) { m.textContent = "Use de 4 a 6 números."; m.className = "msg err"; return; }
    const sal = crypto.getRandomValues(new Uint32Array(2)).join("");
    ls.set("pinSal", sal); ls.set("pinHash", await hash(v, sal)); ls.set("pinLen", String(v.length));
    $("pinNovo").value = ""; m.textContent = "Senha ativada."; m.className = "msg ok";
    renderPin();
  });
  $("pinTirar").addEventListener("click", () => {
    ["pinSal", "pinHash", "pinLen"].forEach(k => ls.set(k, null));
    $("pinMsg").textContent = "Senha removida."; $("pinMsg").className = "msg ok";
    renderPin();
  });
  renderPin();

  // ---------- Lembrete de backup ----------
  async function lembrete() {
    const box = $("lembreteBk");
    const n = await window.localClaude.contar("lancamentos").catch(() => 0);
    const ult = ls.get("ultimoBackup"), adiado = +(ls.get("adiarBk") || 0);
    const dias = ult ? Math.floor((Date.now() - new Date(ult)) / 864e5) : Infinity;
    if (!n || dias < 7 || Date.now() < adiado) { box.hidden = true; return; }
    box.innerHTML = `<span>💾 ${ult ? `Último backup há ${dias} dias.` : "Faça seu primeiro backup."}</span>
      <span class="row"><button class="small primary" data-bk="fazer">Fazer backup</button><button class="small" data-bk="depois">Depois</button></span>`;
    box.hidden = false;
  }
  $("lembreteBk").addEventListener("click", e => {
    const b = e.target.closest("[data-bk]"); if (!b) return;
    if (b.dataset.bk === "fazer") {
      document.querySelector('.aba[data-ir="ajustes"]').click();
      $("btnBackup").click();
    } else ls.set("adiarBk", String(Date.now() + 2 * 864e5));
    $("lembreteBk").hidden = true;
  });
  window.addEventListener("backup-feito", lembrete);
  setTimeout(lembrete, 1500);
})();
