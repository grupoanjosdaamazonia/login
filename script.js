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

  /* ---------- Toast (com ícone e variantes) ---------- */
  const toastEl = $('toast');
  const toastMsgEl = $('toastMsg');
  const toastIcEl = $('toastIc');
  const TOAST_ICONS = { success: 'check_circle', error: 'error', info: 'info' };
  let tt;
  function toast(m, kind) {
    kind = kind || 'success';
    toastMsgEl.textContent = m;
    toastIcEl.textContent = TOAST_ICONS[kind] || TOAST_ICONS.success;
    toastEl.className = 'toast show ' + kind;
    clearTimeout(tt);
    tt = setTimeout(() => toastEl.classList.remove('show'), 3200);
  }

  /* ---------- Botão com estado de carregando ---------- */
  function setBtnLoading(btn, loading) {
    if (!btn) return;
    btn.classList.toggle('is-loading', !!loading);
    btn.disabled = !!loading;
  }

  /* ---------- Máscara de telefone (Brasil) ---------- */
  function maskPhone(v) {
    v = v.replace(/\D/g, '').slice(0, 11);
    if (v.length > 10) return v.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').trim().replace(/-$/, '');
    if (v.length > 6) return v.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').trim().replace(/-$/, '');
    if (v.length > 2) return v.replace(/(\d{2})(\d{0,5})/, '($1) $2').trim();
    if (v.length > 0) return v.replace(/(\d{0,2})/, '($1');
    return v;
  }
  document.querySelectorAll('input[type="tel"]').forEach((inp) => {
    inp.addEventListener('input', () => { inp.value = maskPhone(inp.value); });
  });

  /* ---------- Mostrar/ocultar senha ---------- */
  document.querySelectorAll('.pass-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = btn.previousElementSibling;
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.querySelector('.material-symbols-rounded').textContent = show ? 'visibility_off' : 'visibility';
      btn.setAttribute('aria-label', show ? 'Ocultar senha' : 'Mostrar senha');
    });
  });

  /* ---------- Diálogo de confirmação (reutilizável) ---------- */
  const confirmOverlay = $('confirmOverlay');
  function confirmDialog({ title, text, okLabel, icon, danger }) {
    return new Promise((resolve) => {
      $('confirmTitle').textContent = title || 'Tem certeza?';
      $('confirmText').textContent = text || '';
      $('confirmOk').textContent = okLabel || 'Confirmar';
      $('confirmOk').className = 'btn ' + (danger === false ? 'btn-primary' : 'btn-primary');
      $('confirmIc').textContent = icon || 'help';
      $('confirmIc').style.background = danger === false ? 'var(--primary-soft)' : '#fdeceb';
      $('confirmIc').style.color = danger === false ? 'var(--primary)' : '#dc2626';
      confirmOverlay.classList.add('open');
      confirmOverlay.setAttribute('aria-hidden', 'false');
      function cleanup(result) {
        confirmOverlay.classList.remove('open');
        confirmOverlay.setAttribute('aria-hidden', 'true');
        $('confirmOk').removeEventListener('click', onOk);
        $('confirmCancel').removeEventListener('click', onCancel);
        resolve(result);
      }
      function onOk() { cleanup(true); }
      function onCancel() { cleanup(false); }
      $('confirmOk').addEventListener('click', onOk);
      $('confirmCancel').addEventListener('click', onCancel);
    });
  }

  /* ---------- Saudação personalizada ---------- */
  function setGreeting(nome) {
    const h = new Date().getHours();
    const periodo = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
    $('greetPeriod').textContent = periodo;
    $('greetName').textContent = (nome || 'Motorista').split(' ')[0];
  }

  /* ---------- Tempo relativo ---------- */
  function timeAgo(iso) {
    if (!iso) return '';
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return 'agora mesmo';
    if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
    if (diff < 172800) return 'ontem';
    if (diff < 604800) return `há ${Math.floor(diff / 86400)} dias`;
    return new Date(iso).toLocaleDateString('pt-BR');
  }
  function mesLabel(ref) {
    if (!ref || !/^\d{4}-\d{2}$/.test(ref)) return ref || 'Ganho';
    const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const [y, m] = ref.split('-');
    return `${meses[parseInt(m, 10) - 1]} de ${y}`;
  }

  /* ---------- Navegação por abas ---------- */
  const navItems = document.querySelectorAll('.nav-item');
  const panels = document.querySelectorAll('.tab-panel');
  function goTo(tab) {
    navItems.forEach((n) => n.classList.toggle('active', n.dataset.tab === tab));
    panels.forEach((p) => p.classList.toggle('active', p.id === 'tab-' + tab));
    window.scrollTo({ top: 0, behavior: 'smooth' });
    closeDrawer();
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
      const btn = form.querySelector('button[type="submit"]');
      const req = Array.from(form.querySelectorAll('[required]'));
      if (req.some((f) => !f.value.trim())) { msgEl.style.color = '#dc2626'; msgEl.textContent = 'Preencha os campos obrigatórios.'; return; }
      const fd = Object.fromEntries(new FormData(form).entries());
      const payload = {
        tipo, nome: fd.nome || fd.responsavel || null, email: fd.email || null,
        telefone: fd.telefone || null, cidade: fd.cidade || null, empresa: fd.empresa || null,
        formato: fd.formato || null, mensagem: fd.veiculo ? 'Veículo: ' + fd.veiculo : null,
      };
      if (!sb) { msgEl.style.color = '#dc2626'; msgEl.textContent = 'Conecte o Supabase no config.js.'; return; }
      setBtnLoading(btn, true);
      const { error } = await sb.from('leads').insert(payload);
      setBtnLoading(btn, false);
      if (error) { msgEl.style.color = '#dc2626'; msgEl.textContent = 'Erro ao enviar. Tente novamente.'; return; }
      msgEl.style.color = ''; msgEl.textContent = sucesso; form.reset();
      toast(sucesso.replace('✅ ', ''));
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
    const f = e.target, msg = $('msgVeiculo'), btn = f.querySelector('button[type="submit"]');
    const req = Array.from(f.querySelectorAll('[required]'));
    if (req.some((x) => !x.value.trim())) { msg.style.color = '#dc2626'; msg.textContent = 'Preencha os campos obrigatórios.'; return; }
    const payload = {
      motorista_id: currentUser.id,
      marca: f.marca.value.trim(), modelo: f.modelo.value.trim(),
      ano: f.ano.value ? parseInt(f.ano.value, 10) : null,
      placa: f.placa.value.trim(), cidade: f.cidade.value.trim() || null,
      app_transporte: f.app_transporte.value, status: 'pendente',
    };
    setBtnLoading(btn, true);
    const { error } = await sb.from('veiculos').insert(payload);
    setBtnLoading(btn, false);
    if (error) { msg.style.color = '#dc2626'; msg.textContent = 'Erro ao salvar. Tente de novo.'; return; }
    msg.style.color = ''; msg.textContent = '✅ Veículo cadastrado!'; f.reset();
    toast('Veículo cadastrado! Vamos analisar seus dados.');
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
    const f = e.target, msg = $('msgPerfil'), btn = f.querySelector('button[type="submit"]');
    setBtnLoading(btn, true);
    const { error } = await sb.from('profiles').update({
      nome: f.nome.value.trim(), telefone: f.telefone.value.trim() || null, cidade: f.cidade.value.trim() || null,
    }).eq('id', currentUser.id);
    setBtnLoading(btn, false);
    if (error) { msg.style.color = '#dc2626'; msg.textContent = 'Erro ao salvar.'; return; }
    msg.style.color = ''; msg.textContent = '✅ Dados atualizados!';
    toast('Dados atualizados com sucesso!');
    await loadProfile();
    setTimeout(() => { closeSheet(perfilSheet); msg.textContent = ''; }, 1200);
  });

  /* ---------- Ações do menu do perfil ---------- */
  document.querySelectorAll('[data-action]').forEach((el) => {
    el.addEventListener('click', () => {
      const a = el.dataset.action;
      if (a.startsWith('goto:')) return goTo(a.split(':')[1]);
      if (a === 'dados') return openPerfilEdit();
      if (a === 'ajuda') {
        window.open('https://wa.me/5596900000000?text=' + encodeURIComponent('Olá! Preciso de ajuda com o Go.Drive.'), '_blank');
        return;
      }
      if (a === 'sair') return doLogout();
    });
  });

  /* ---------- Saque real (PIX) ---------- */
  const saqueSheet = $('saqueSheet');
  let saldoDisponivel = 0;
  $('closeSaque').addEventListener('click', () => closeSheet(saqueSheet));
  saqueSheet.addEventListener('click', (e) => { if (e.target === saqueSheet) closeSheet(saqueSheet); });
  const sacarBtn = $('sacarBtn');
  if (sacarBtn) sacarBtn.addEventListener('click', () => {
    if (!requireAuth()) return;
    if (saldoDisponivel <= 0) { toast('Você ainda não tem saldo disponível para saque.', 'info'); return; }
    $('saqueSaldo').textContent = brl(saldoDisponivel);
    $('formSaque').reset();
    $('msgSaque').textContent = '';
    openSheet(saqueSheet);
  });
  $('formSaque').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!requireAuth()) return;
    const f = e.target, msg = $('msgSaque'), btn = $('btnSaque');
    const pix = f.pix.value.trim();
    const valor = parseFloat(f.valor.value.replace(/\./g, '').replace(',', '.'));
    if (!pix) { msg.style.color = '#dc2626'; msg.textContent = 'Informe sua chave PIX.'; return; }
    if (!valor || valor <= 0) { msg.style.color = '#dc2626'; msg.textContent = 'Informe um valor válido.'; return; }
    if (valor > saldoDisponivel) { msg.style.color = '#dc2626'; msg.textContent = 'Valor maior que o saldo disponível.'; return; }
    setBtnLoading(btn, true);
    const { error } = await sb.from('saques').insert({
      motorista_id: currentUser.id, valor, chave_pix: pix, status: 'solicitado',
    });
    setBtnLoading(btn, false);
    if (error) { msg.style.color = '#dc2626'; msg.textContent = 'Não foi possível enviar. Tente novamente.'; return; }
    msg.style.color = ''; msg.textContent = '✅ Saque solicitado! Cai em até 2 dias úteis.';
    toast('Saque solicitado com sucesso!');
    setTimeout(() => { closeSheet(saqueSheet); msg.textContent = ''; }, 1600);
  });

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
    const f = e.target, msg = $('loginMsg'), btn = $('btnLogin');
    msg.style.color = ''; msg.textContent = '';
    setBtnLoading(btn, true);
    const { error } = await sb.auth.signInWithPassword({ email: f.email.value.trim(), password: f.password.value });
    setBtnLoading(btn, false);
    if (error) { msg.style.color = '#dc2626'; msg.textContent = traduzErro(error.message); }
    else msg.textContent = '';
  }
  async function onSignup(e) {
    e.preventDefault();
    const f = e.target, msg = $('signupMsg'), btn = $('btnSignup');
    msg.style.color = ''; msg.textContent = '';
    setBtnLoading(btn, true);
    const { data, error } = await sb.auth.signUp({
      email: f.email.value.trim(), password: f.password.value,
      options: { data: { nome: f.nome.value.trim(), tipo: f.tipo.value } },
    });
    setBtnLoading(btn, false);
    if (error) { msg.style.color = '#dc2626'; msg.textContent = traduzErro(error.message); return; }
    if (!data.session) { msg.style.color = ''; msg.textContent = 'Conta criada! Confirme pelo e-mail e depois entre.'; }
    else msg.textContent = '';
  }
  async function doLogout() {
    closeDrawer();
    const ok = await confirmDialog({
      title: 'Sair da conta?',
      text: 'Você precisará entrar novamente para ver seus veículos e ganhos.',
      okLabel: 'Sair',
      icon: 'logout',
    });
    if (!ok) return;
    if (sb) await sb.auth.signOut();
    currentUser = null; currentProfile = null;
    toast('Você saiu da sua conta.', 'info');
    showAuth();
  }

  function showSkeletons() {
    $('veiculosList').innerHTML = skeletonCards(2);
    $('ganhosList').innerHTML = skeletonCards(3, true);
    $('notifList').innerHTML = skeletonCards(2, true);
  }
  function skeletonCards(n, thin) {
    return Array.from({ length: n }).map(() =>
      `<div class="skel ${thin ? 'skel-card' : 'skel-card'}" style="height:${thin ? 62 : 78}px"></div>`
    ).join('');
  }

  async function onAuthed(user) {
    if (currentUser && currentUser.id === user.id) { hideAuth(); return; }
    currentUser = user;
    hideAuth();
    showSkeletons();
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
    setGreeting(nome);
  }

  const STATUS_ICON = { pendente: 'schedule', aprovado: 'check_circle', ativo: 'bolt', inativo: 'block', recusado: 'cancel' };
  function renderVeiculos(list) {
    const el = $('veiculosList');
    if (!list.length) {
      el.innerHTML = `<div class="empty">
        <div class="empty-ic"><span class="material-symbols-rounded">directions_car</span></div>
        <strong>Nenhum veículo cadastrado</strong>
        <p>Cadastre seu carro para começar a receber campanhas de publicidade.</p>
      </div>`;
      return;
    }
    el.innerHTML = list.map((v) => `
      <div class="veiculo-card">
        <div class="veiculo-ic"><span class="material-symbols-rounded">directions_car</span></div>
        <div class="info">
          <h3>${[v.marca, v.modelo].filter(Boolean).join(' ') || 'Veículo'}</h3>
          <span class="plate">${v.placa || ''} · ${v.app_transporte || ''}</span>
        </div>
        <span class="status ${v.status}"><span class="material-symbols-rounded">${STATUS_ICON[v.status] || 'info'}</span>${v.status}</span>
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
    saldoDisponivel = pago;
    $('saldo').textContent = brl(pago);
    $('mesValor').textContent = brl(doMes);
    const box = $('ganhosList');
    if (!list.length) {
      box.innerHTML = `<div class="empty">
        <div class="empty-ic"><span class="material-symbols-rounded">payments</span></div>
        <strong>Sem lançamentos ainda</strong>
        <p>Assim que seu carro começar a rodar com o anúncio, seus ganhos aparecem aqui.</p>
      </div>`;
      return;
    }
    box.innerHTML = list.map((g) => `
      <div class="ganho-item">
        <div class="g-left">
          <div class="g-ic"><span class="material-symbols-rounded">campaign</span></div>
          <div><h4>${mesLabel(g.referencia)}</h4><small>${g.status === 'pago' ? 'Pago' : 'Pendente'}</small></div>
        </div>
        <span class="g-val ${g.status}">${brl(g.valor)}</span>
      </div>`).join('');
  }
  async function loadGanhos() {
    const { data } = await sb.from('ganhos').select('*').eq('motorista_id', currentUser.id).order('criado_em', { ascending: false });
    renderGanhos(data || []);
  }

  let notifCache = [];
  function renderNotif(list) {
    notifCache = list;
    $('notifDot').classList.toggle('on', list.some((n) => !n.lida));
    const box = $('notifList');
    if (!list.length) {
      box.innerHTML = `<div class="empty">
        <div class="empty-ic"><span class="material-symbols-rounded">notifications</span></div>
        <strong>Nenhuma notificação</strong>
        <p>Avisos sobre seu cadastro, campanhas e pagamentos aparecem por aqui.</p>
      </div>`;
      return;
    }
    box.innerHTML = list.map((n) => `
      <div class="notif-item ${n.lida ? '' : 'unread'}" data-notif-id="${n.id}">
        ${!n.lida ? '<span class="unread-dot"></span>' : ''}
        <div class="notif-ic"><span class="material-symbols-rounded">${n.tipo || 'notifications'}</span></div>
        <div style="flex:1">
          <h4>${n.titulo}</h4><p>${n.mensagem || ''}</p>
          <time class="notif-time">${timeAgo(n.criado_em)}</time>
        </div>
      </div>`).join('');
    box.querySelectorAll('[data-notif-id]').forEach((el) =>
      el.addEventListener('click', () => markOneRead(el.dataset.notifId))
    );
  }
  async function loadNotificacoes() {
    const { data } = await sb.from('notificacoes').select('*').eq('profile_id', currentUser.id).order('criado_em', { ascending: false });
    renderNotif(data || []);
  }
  async function markOneRead(id) {
    const n = notifCache.find((x) => String(x.id) === String(id));
    if (!n || n.lida) return;
    n.lida = true;
    renderNotif(notifCache);
    if (sb) await sb.from('notificacoes').update({ lida: true }).eq('id', id);
  }


  const EXEMPLOS = [
    { foto_url: 'carro1.png?v=11', empresa_nome: 'AquaMax', formato: 'GD Full', veiculo: 'Chevrolet Onix · Uber Comfort' },
    { foto_url: 'carro2.webp?v=14', empresa_nome: 'Verde Hortifruti', formato: 'GD Door', veiculo: 'BYD Seagull · Uber Black' },
    { foto_url: 'carro3.png?v=11', empresa_nome: 'Sol Turismo', formato: 'GD Light', veiculo: 'Fiat Mobi · 99 Pop' },
  ];
  function renderExemplos(list) {
    const wrap = $('exemplos');
    if (!list.length) { wrap.innerHTML = ''; return; }
    wrap.innerHTML = list.map((e) => `
      <article class="ex-card">
        <div class="ex-photo"><img src="${e.foto_url}" alt="${e.empresa_nome || ''}" loading="lazy" /><span class="ex-badge">${e.formato || ''}</span></div>
        <div class="ex-info"><h4>${e.empresa_nome || ''}</h4><span>${e.veiculo || ''}</span></div>
      </article>`).join('');
  }
  function loadExemplos() {
    renderExemplos(EXEMPLOS);
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
