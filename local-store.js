// Armazenamento no próprio aparelho (IndexedDB), com a mesma interface que o app usa no Claude:
// db.collection(nome).add / .doc(id).set / .delete / .onSnapshot e db.doc("config/geral").
(() => {
  const NOME = "controle-financeiro", LOJA = "docs";
  const mem = new Map(), inscritos = [];
  let conexao, carga;

  const abrir = () => conexao || (conexao = new Promise((ok, falha) => {
    const r = indexedDB.open(NOME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(LOJA);
    r.onsuccess = () => ok(r.result);
    r.onerror = () => falha(r.error);
  }));

  const carregar = () => carga || (carga = abrir().then(d => new Promise((ok, falha) => {
    const cur = d.transaction(LOJA).objectStore(LOJA).openCursor();
    cur.onsuccess = () => { const c = cur.result; if (c) { mem.set(c.key, c.value); c.continue(); } else ok(); };
    cur.onerror = () => falha(cur.error);
  })));

  async function gravar(caminho, valor) {
    await carregar();
    const d = await abrir();
    await new Promise((ok, falha) => {
      const t = d.transaction(LOJA, "readwrite"), s = t.objectStore(LOJA);
      valor === undefined ? s.delete(caminho) : s.put(valor, caminho);
      t.oncomplete = ok; t.onerror = () => falha(t.error); t.onabort = () => falha(t.error);
    });
    valor === undefined ? mem.delete(caminho) : mem.set(caminho, valor);
    avisar(caminho);
  }

  const copia = v => v === undefined ? undefined : JSON.parse(JSON.stringify(v));
  const fotoColecao = nome => {
    const pre = nome + "/";
    const docs = [...mem].filter(([k]) => k.startsWith(pre) && !k.slice(pre.length).includes("/"))
      .map(([k, v]) => ({ id: k.slice(pre.length), data: () => copia(v) }));
    return { docs, metadata: { fromCache: false } };
  };
  const fotoDoc = caminho => {
    const v = mem.get(caminho);
    return { id: caminho.split("/").pop(), exists: v !== undefined, data: () => copia(v) };
  };

  // Agrupa avisos: restaurar um backup grava centenas de itens, mas a tela redesenha uma vez
  function avisar(caminho) {
    for (const s of inscritos) {
      const bate = s.doc ? s.caminho === caminho : caminho.startsWith(s.caminho + "/");
      if (!bate || s.pendente) continue;
      s.pendente = true;
      setTimeout(() => { s.pendente = false; s.cb(s.doc ? fotoDoc(s.caminho) : fotoColecao(s.caminho)); }, 0);
    }
  }
  function inscrever(caminho, doc, cb, erro) {
    const s = { caminho, doc, cb };
    inscritos.push(s);
    carregar().then(() => cb(doc ? fotoDoc(caminho) : fotoColecao(caminho)), e => erro && erro(e));
    return () => { const i = inscritos.indexOf(s); if (i >= 0) inscritos.splice(i, 1); };
  }

  const novoId = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)).replace(/-/g, "");
  const docRef = caminho => ({
    set: v => gravar(caminho, copia(v)),
    delete: () => gravar(caminho, undefined),
    onSnapshot: (cb, erro) => inscrever(caminho, true, cb, erro)
  });
  const db = {
    collection: nome => ({
      add: async v => { const id = novoId(); await gravar(nome + "/" + id, copia(v)); return { id }; },
      doc: id => docRef(nome + "/" + id),
      onSnapshot: (cb, erro) => inscrever(nome, false, cb, erro)
    }),
    doc: docRef
  };

  // Salvar arquivo: no iPhone abre a folha de compartilhar ("Salvar em Arquivos", Drive, iCloud…)
  const downloads = {
    async save({ filename, data }) {
      const tipo = filename.endsWith(".csv") ? "text/csv" : "application/json";
      const arq = new File([data], filename, { type: tipo });
      if (navigator.canShare && navigator.canShare({ files: [arq] })) {
        try { await navigator.share({ files: [arq] }); }
        catch (e) { if (e.name === "AbortError") { const er = new Error("cancelado"); er.code = "declined"; throw er; } throw e; }
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(arq); a.download = filename;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      }
      if (filename.startsWith("backup")) {
        try { localStorage.setItem("ultimoBackup", new Date().toISOString()); } catch {}
        window.dispatchEvent(new Event("backup-feito"));
      }
    }
  };

  window.localClaude = {
    use: async nome => nome === "db" ? db : nome === "downloads" ? downloads : null,
    contar: async colecao => { await carregar(); return fotoColecao(colecao).docs.length; }
  };
})();
