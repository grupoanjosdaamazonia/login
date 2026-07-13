/* ===================== Go.Drive · script.js ===================== */
(function () {
  'use strict';

  /* ---------- Splash (tela de abertura) ---------- */
  const splash = document.getElementById('splash');
  if (splash) {
    setTimeout(() => {
      splash.classList.add('hide');
      setTimeout(() => { splash.style.display = 'none'; }, 500);
    }, 1800);
  }

  const cfg = window.GODRIVE_CONFIG || {};
  const configured = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase);
  const sb = configured ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;

  let currentUser = null;
  let currentProfile = null;

  const $ = (id) => document.getElementById(id);
  const brl = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

  /* ---------- Toast ---------- */
  const toastEl = $('toast');
  let tt;
  function toast(m) {
    toastEl.textContent = m;
    toastEl.classList.add('show');
    clearTimeout(tt);
    tt = setTimeout(() => toastEl.classList.remove('show'), 2800);
  }

  /* ---------- Navegação por abas ---------- */
  const navItems = document.querySelectorAll('.nav-item');
  const panels = document.querySelectorAll('.tab-panel');
  function goTo(tab) {
    navItems.forEach((n) => n.classList.toggle('active', n.dataset.tab === tab));
    panels.forEach((p) => p.classList.toggle('active', p.id === 'tab-' + tab));
    window.scrollTo({ top: 0, behavior: 'smooth' });
    closeDrawer();
    if (tab === 'notificacoes') markNotifRead();
  }
  navItems.forEach((n) => n.addEventListener('click', () => goTo(n.dataset.tab)));
  document.querySelectorAll('[data-goto]').forEach((el) =>
    el.addEventListener('click', () => goTo(el.dataset.goto))
  );

  /* ---------- Passos "Como funciona" (toque para ver mais) ---------- */
  document.querySelectorAll('.step-card').forEach((card) => {
    card.addEventListener('click', () => {
      const isOpen = card.classList.contains('open');
      document.querySelectorAll('.step-card.open').forEach((c) => c.classList.remove('open'));
      if (!isOpen) card.classList.add('open');
    });
  });

  /* ---------- Menu lateral (drawer) ---------- */
  const drawer = $('drawer');
  function openDrawer() { drawer.classList.add('open'); drawer.setAttribute('aria-hidden', 'false'); }
  function closeDrawer() { drawer.classList.remove('open'); drawer.setAttribute('aria-hidden', 'true'); }
  $('menuBtn').addEventListener('click', openDrawer);
  drawer.addEventListener('click', (e) => { if (e.target === drawer) closeDrawer(); });
  $('drawerLogout').addEventListener('click', doLogout);

  /* ---------- Sheets (helpers) ---------- */
  function openSheet(el) { el.classList.add('open'); el.setAttribute('aria-hidden', 'false'); }
  function closeSheet(el) { el.classList.remove('open'); el.setAttribute('aria-hidden', 'true'); }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.sheet-overlay.open').forEach(closeSheet);
      closeDrawer();
    }
  });

  /* ---------- Autenticação exigida ---------- */
  function requireAuth() {
    if (!currentUser) { showAuth(); toast('Entre na sua conta para continuar.'); return false; }
    return true;
  }

  /* ---------- Cadastro público (leads) ---------- */
  const cadastroSheet = $('cadastroSheet');
  const sheetTabs = document.querySelectorAll('.sheet-tab');
  const leadForms = { motorista: $('formMotorista'), empresa: $('formEmpresa') };
  function activateLeadForm(name) {
    sheetTabs.forEach((t) => t.classList.toggle('active', t.dataset.form === name));
    Object.entries(leadForms).forEach(([k, f]) => f.classList.toggle('active', k === name));
  }
  function openCadastro(which) { activateLeadForm(which || 'motorista'); openSheet(cadastroSheet); }
  sheetTabs.forEach((t) => t.addEventListener('click', () => activateLeadForm(t.dataset.form)));
  $('closeSheet').addEventListener('click', () => closeSheet(cadastroSheet));
  cadastroSheet.addEventListener('click', (e) => { if (e.target === cadastroSheet) closeSheet(cadastroSheet); });
  document.querySelectorAll('[data-cadastro]').forEach((b) =>
    b.addEventListener('click', () => openCadastro(b.dataset.cadastro))
  );
  function wireLead(form, tipo, msgEl, sucesso) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const req = Array.from(form.querySelectorAll('[required]'));
      if (req.some((f) => !f.value.trim())) { msgEl.style.color = '#dc2626'; msgEl.textContent = 'Preencha os campos obrigatórios.'; return; }
      const fd = Object.fromEntries(new FormData(form).entries());
      const payload = {
        tipo, nome: fd.nome || fd.responsavel || null, email: fd.email || null,
        telefone: fd.telefone || null, cidade: fd.cidade || null, empresa: fd.empresa || null,
        formato: fd.formato || null, mensagem: fd.veiculo ? 'Veículo: ' + fd.veiculo : null,
      };
      if (!sb) { msgEl.style.color = '#dc2626'; msgEl.textContent = 'Conecte o Supabase no config.js.'; return; }
      const { error } = await sb.from('leads').insert(payload);
      if (error) { msgEl.style.color = '#dc2626'; msgEl.textContent = 'Erro ao enviar. Tente novamente.'; return; }
      msgEl.style.color = ''; msgEl.textContent = sucesso; form.reset();
      setTimeout(() => { closeSheet(cadastroSheet); msgEl.textContent = ''; }, 1600);
    });
  }
  wireLead(leadForms.motorista, 'motorista', $('msgMotorista'), '✅ Cadastro enviado! Entraremos em contato.');
  wireLead(leadForms.empresa, 'empresa', $('msgEmpresa'), '✅ Recebemos seu interesse!');

  /* ---------- Cadastro de veículo (real, exige login) ---------- */
  const veiculoSheet = $('veiculoSheet');
  $('closeVeiculo').addEventListener('click', () => closeSheet(veiculoSheet));
  veiculoSheet.addEventListener('click', (e) => { if (e.target === veiculoSheet) closeSheet(veiculoSheet); });
  $('addVeiculo').addEventListener('click', () => { if (requireAuth()) openSheet(veiculoSheet); });

  $('formVeiculo').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!requireAuth()) return;
    const f = e.target, msg = $('msgVeiculo');
    const req = Array.from(f.querySelectorAll('[required]'));
    if (req.some((x) => !x.value.trim())) { msg.style.color = '#dc2626'; msg.textContent = 'Preencha os campos obrigatórios.'; return; }
    const payload = {
      motorista_id: currentUser.id,
      marca: f.marca.value.trim(), modelo: f.modelo.value.trim(),
      ano: f.ano.value ? parseInt(f.ano.value, 10) : null,
      placa: f.placa.value.trim(), cidade: f.cidade.value.trim() || null,
      app_transporte: f.app_transporte.value, status: 'pendente',
    };
    const { error } = await sb.from('veiculos').insert(payload);
    if (error) { msg.style.color = '#dc2626'; msg.textContent = 'Erro ao salvar. Tente de novo.'; return; }
    msg.style.color = ''; msg.textContent = '✅ Veículo cadastrado!'; f.reset();
    await loadVeiculos();
    setTimeout(() => { closeSheet(veiculoSheet); msg.textContent = ''; }, 1400);
  });

  /* ---------- Editar dados (perfil, real) ---------- */
  const perfilSheet = $('perfilSheet');
  $('closePerfil').addEventListener('click', () => closeSheet(perfilSheet));
  perfilSheet.addEventListener('click', (e) => { if (e.target === perfilSheet) closeSheet(perfilSheet); });
  function openPerfilEdit() {
    if (!requireAuth()) return;
    const f = $('formPerfil');
    f.nome.value = currentProfile.nome || '';
    f.telefone.value = currentProfile.telefone || '';
    f.cidade.value = currentProfile.cidade || '';
    openSheet(perfilSheet);
  }
  $('formPerfil').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!requireAuth()) return;
    const f = e.target, msg = $('msgPerfil');
    const { error } = await sb.from('profiles').update({
      nome: f.nome.value.trim(), telefone: f.telefone.value.trim() || null, cidade: f.cidade.value.trim() || null,
    }).eq('id', currentUser.id);
    if (error) { msg.style.color = '#dc2626'; msg.textContent = 'Erro ao salvar.'; return; }
    msg.style.color = ''; msg.textContent = '✅ Dados atualizados!';
    await loadProfile();
    setTimeout(() => { closeSheet(perfilSheet); msg.textContent = ''; }, 1200);
  });

  /* ---------- Ações do menu do perfil ---------- */
  document.querySelectorAll('[data-action]').forEach((el) => {
    el.addEventListener('click', () => {
      const a = el.dataset.action;
      if (a.startsWith('goto:')) return goTo(a.split(':')[1]);
      if (a === 'dados') return openPerfilEdit();
      if (a === 'ajuda') return toast('Fale com a Go.Drive: WhatsApp (96) 90000-0000.');
      if (a === 'sair') return doLogout();
    });
  });
  const sacarBtn = $('sacarBtn');
  if (sacarBtn) sacarBtn.addEventListener('click', () => toast('Saque disponível após conectar sua conta bancária.'));

  /* =====================================================================
     AUTENTICAÇÃO (Supabase Auth)
  ===================================================================== */
  const authScreen = $('authScreen');
  function showAuth() { authScreen.classList.remove('hidden'); }
  function hideAuth() { authScreen.classList.add('hidden'); }

  document.querySelectorAll('.auth-tab').forEach((t) =>
    t.addEventListener('click', () => {
      document.querySelectorAll('.auth-tab').forEach((x) => x.classList.toggle('active', x === t));
      $('loginForm').classList.toggle('active', t.dataset.auth === 'login');
      $('signupForm').classList.toggle('active', t.dataset.auth === 'signup');
    })
  );

  function traduzErro(m) {
    if (/Invalid login/i.test(m)) return 'E-mail ou senha inválidos.';
    if (/already registered/i.test(m)) return 'Este e-mail já tem conta. Faça login.';
    if (/at least 6/i.test(m)) return 'A senha precisa ter ao menos 6 caracteres.';
    if (/Email not confirmed/i.test(m)) return 'Confirme seu e-mail antes de entrar.';
    return m;
  }

  async function onLogin(e) {
    e.preventDefault();
    const f = e.target, msg = $('loginMsg');
    msg.style.color = ''; msg.textContent = 'Entrando...';
    const { error } = await sb.auth.signInWithPassword({ email: f.email.value.trim(), password: f.password.value });
    if (error) { msg.style.color = '#dc2626'; msg.textContent = traduzErro(error.message); }
    else msg.textContent = '';
  }
  async function onSignup(e) {
    e.preventDefault();
    const f = e.target, msg = $('signupMsg');
    msg.style.color = ''; msg.textContent = 'Criando conta...';
    const { data, error } = await sb.auth.signUp({
      email: f.email.value.trim(), password: f.password.value,
      options: { data: { nome: f.nome.value.trim(), tipo: f.tipo.value } },
    });
    if (error) { msg.style.color = '#dc2626'; msg.textContent = traduzErro(error.message); return; }
    if (!data.session) { msg.style.color = ''; msg.textContent = 'Conta criada! Confirme pelo e-mail e depois entre.'; }
    else msg.textContent = '';
  }
  async function doLogout() {
    closeDrawer();
    if (sb) await sb.auth.signOut();
    currentUser = null; currentProfile = null;
    showAuth();
  }

  async function onAuthed(user) {
    if (currentUser && currentUser.id === user.id) { hideAuth(); return; }
    currentUser = user;
    hideAuth();
    await loadProfile();
    await Promise.all([loadVeiculos(), loadGanhos(), loadNotificacoes(), loadExemplos()]);
  }

  /* =====================================================================
     CARREGAMENTO DE DADOS REAIS
  ===================================================================== */
  async function loadProfile() {
    const { data } = await sb.from('profiles').select('*').eq('id', currentUser.id).maybeSingle();
    currentProfile = data || {};
    const meta = currentUser.user_metadata || {};
    const nome = currentProfile.nome || meta.nome || 'Usuário';
    const tipo = currentProfile.tipo || meta.tipo || 'motorista';
    $('profileName').textContent = nome;
    $('profileTipo').textContent = tipo;
    $('drawerName').textContent = nome;
    $('drawerEmail').textContent = currentUser.email || '';
  }

  function renderVeiculos(list) {
    const el = $('veiculosList');
    if (!list.length) {
      el.innerHTML = '<div class="empty"><span class="material-symbols-rounded">directions_car</span>Você ainda não cadastrou veículos.<br>Toque em <b>Cadastrar</b>.</div>';
      return;
    }
    el.innerHTML = list.map((v) => `
      <div class="veiculo-card">
        <div class="veiculo-ic"><span class="material-symbols-rounded">directions_car</span></div>
        <div class="info">
          <h3>${[v.marca, v.modelo].filter(Boolean).join(' ') || 'Veículo'}</h3>
          <span class="plate">${v.placa || ''} · ${v.app_transporte || ''}</span>
        </div>
        <span class="status ${v.status}">${v.status}</span>
      </div>`).join('');
  }
  async function loadVeiculos() {
    const { data } = await sb.from('veiculos').select('*').eq('motorista_id', currentUser.id).order('criado_em', { ascending: false });
    renderVeiculos(data || []);
  }

  function renderGanhos(list) {
    const pago = list.filter((g) => g.status === 'pago').reduce((s, g) => s + Number(g.valor), 0);
    const mes = new Date().toISOString().slice(0, 7);
    const doMes = list.filter((g) => (g.referencia || '') === mes).reduce((s, g) => s + Number(g.valor), 0);
    $('saldo').textContent = brl(pago);
    $('mesValor').textContent = brl(doMes);
    const box = $('ganhosList');
    if (!list.length) { box.innerHTML = '<div class="empty"><span class="material-symbols-rounded">payments</span>Sem lançamentos ainda.</div>'; return; }
    box.innerHTML = list.map((g) => `
      <div class="ganho-item">
        <div class="g-left">
          <div class="g-ic"><span class="material-symbols-rounded">campaign</span></div>
          <div><h4>${g.referencia || 'Ganho'}</h4><small>${g.status}</small></div>
        </div>
        <span class="g-val ${g.status}">${brl(g.valor)}</span>
      </div>`).join('');
  }
  async function loadGanhos() {
    const { data } = await sb.from('ganhos').select('*').eq('motorista_id', currentUser.id).order('criado_em', { ascending: false });
    renderGanhos(data || []);
  }

  function renderNotif(list) {
    $('notifDot').classList.toggle('on', list.some((n) => !n.lida));
    const box = $('notifList');
    if (!list.length) { box.innerHTML = '<div class="empty"><span class="material-symbols-rounded">notifications</span>Nenhuma notificação.</div>'; return; }
    box.innerHTML = list.map((n) => `
      <div class="notif-item ${n.lida ? '' : 'unread'}">
        <div class="notif-ic"><span class="material-symbols-rounded">${n.tipo || 'notifications'}</span></div>
        <div style="flex:1"><h4>${n.titulo}</h4><p>${n.mensagem || ''}</p></div>
      </div>`).join('');
  }
  async function loadNotificacoes() {
    const { data } = await sb.from('notificacoes').select('*').eq('profile_id', currentUser.id).order('criado_em', { ascending: false });
    renderNotif(data || []);
  }
  async function markNotifRead() {
    if (!currentUser || !sb) return;
    await sb.from('notificacoes').update({ lida: true }).eq('profile_id', currentUser.id).eq('lida', false);
    $('notifDot').classList.remove('on');
  }

  function renderExemplos(list) {
    const wrap = $('exemplos');
    if (!list.length) { wrap.innerHTML = '<div class="empty" style="flex:1">Sem fotos ainda. Adicione em <b>fotos_exemplos</b> no Supabase.</div>'; return; }
    wrap.innerHTML = list.map((e) => {
      const media = e.foto_url ? `<img src="${e.foto_url}" alt="${e.titulo || ''}" loading="lazy" />`
        : '<span class="material-symbols-rounded ph-ic">photo_camera</span>';
      const bg = e.foto_url ? '' : 'style="background:#F26A1B"';
      return `<article class="ex-card">
        <div class="ex-photo" ${bg}>${media}<span class="ex-badge">${e.formato || ''}</span></div>
        <div class="ex-info"><h4>${e.empresa_nome || e.titulo || ''}</h4><span>${e.veiculo || ''}</span></div>
      </article>`;
    }).join('');
  }
  async function loadExemplos() {
    const { data } = await sb.from('fotos_exemplos').select('*').eq('ativo', true).order('ordem', { ascending: true });
    renderExemplos(data || []);
  }

  /* =====================================================================
     INICIALIZAÇÃO
  ===================================================================== */
  if (!configured) {
    // Sem Supabase: mostra a tela de login com instrução (nada de dados falsos)
    showAuth();
    document.querySelectorAll('.auth-tabs, .auth-form').forEach((el) => (el.style.display = 'none'));
    $('authNote').innerHTML = '⚙️ Para ativar login e dados reais, configure o <b>Supabase</b> no arquivo <b>config.js</b> (veja o README).';
  } else {
    $('loginForm').addEventListener('submit', onLogin);
    $('signupForm').addEventListener('submit', onSignup);
    sb.auth.getSession().then(({ data }) => {
      if (data.session && data.session.user) onAuthed(data.session.user);
      else showAuth();
    });
    sb.auth.onAuthStateChange((_ev, session) => {
      if (session && session.user) onAuthed(session.user);
      else showAuth();
    });
  }
})();
