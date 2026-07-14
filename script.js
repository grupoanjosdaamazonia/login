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
  let meuVeiculoAtivo = null;
  let watchId = null;
  let ownMapObj = null, ownMarker = null;
  let lastSentAt = 0;
  let trackToggleWired = false;
  let fleetMapObj = null;
  let fleetMarkers = {};
  let fleetChannel = null;
  let veiculosChannel = null;
  let fleetFitDone = false;

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
      $('confirmIc').style.background = danger === false ? 'var(--primary-soft)' : 'rgba(248,113,113,.16)';
      $('confirmIc').style.color = danger === false ? 'var(--primary)' : '#f87171';
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
    if (tab === 'frota' && fleetMapObj) setTimeout(() => fleetMapObj.invalidateSize(), 250);
    if (tab === 'veiculos' && ownMapObj) setTimeout(() => ownMapObj.invalidateSize(), 250);
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
      if (req.some((f) => !f.value.trim())) { msgEl.style.color = '#f87171'; msgEl.textContent = 'Preencha os campos obrigatórios.'; return; }
      const fd = Object.fromEntries(new FormData(form).entries());
      const payload = {
        tipo, nome: fd.nome || fd.responsavel || null, email: fd.email || null,
        telefone: fd.telefone || null, cidade: fd.cidade || null, empresa: fd.empresa || null,
        formato: fd.formato || null, mensagem: fd.veiculo ? 'Veículo: ' + fd.veiculo : null,
      };
      if (!sb) { msgEl.style.color = '#f87171'; msgEl.textContent = 'Conecte o Supabase no config.js.'; return; }
      setBtnLoading(btn, true);
      const { error } = await sb.from('leads').insert(payload);
      setBtnLoading(btn, false);
      if (error) { msgEl.style.color = '#f87171'; msgEl.textContent = 'Erro ao enviar. Tente novamente.'; return; }
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
    if (req.some((x) => !x.value.trim())) { msg.style.color = '#f87171'; msg.textContent = 'Preencha os campos obrigatórios.'; return; }
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
    if (error) { msg.style.color = '#f87171'; msg.textContent = 'Erro ao salvar. Tente de novo.'; return; }
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
    if (error) { msg.style.color = '#f87171'; msg.textContent = 'Erro ao salvar.'; return; }
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
    if (!pix) { msg.style.color = '#f87171'; msg.textContent = 'Informe sua chave PIX.'; return; }
    if (!valor || valor <= 0) { msg.style.color = '#f87171'; msg.textContent = 'Informe um valor válido.'; return; }
    if (valor > saldoDisponivel) { msg.style.color = '#f87171'; msg.textContent = 'Valor maior que o saldo disponível.'; return; }
    setBtnLoading(btn, true);
    const { error } = await sb.from('saques').insert({
      motorista_id: currentUser.id, valor, chave_pix: pix, status: 'solicitado',
    });
    setBtnLoading(btn, false);
    if (error) { msg.style.color = '#f87171'; msg.textContent = 'Não foi possível enviar. Tente novamente.'; return; }
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
    if (error) { msg.style.color = '#f87171'; msg.textContent = traduzErro(error.message); }
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
    if (error) { msg.style.color = '#f87171'; msg.textContent = traduzErro(error.message); return; }
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
    stopTracking();
    resetFleet();
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
    initTrackToggle();
    initAdminIfNeeded();
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
    renderAvatar(currentProfile.avatar_url);
  }

  /* ---------- Foto de perfil (upload real, Supabase Storage) ---------- */
  function renderAvatar(url) {
    const img = $('avatarImg'), ic = $('avatarIc');
    const dImg = $('drawerAvatarImg'), dIc = $('drawerAvatarIc');
    if (url) {
      img.src = url; img.hidden = false; ic.style.display = 'none';
      dImg.src = url; dImg.hidden = false; dIc.style.display = 'none';
    } else {
      img.hidden = true; ic.style.display = '';
      dImg.hidden = true; dIc.style.display = '';
    }
  }
  const avatarBtn = $('avatarBtn'), avatarInput = $('avatarInput');
  avatarBtn.addEventListener('click', () => { if (requireAuth()) avatarInput.click(); });
  avatarInput.addEventListener('change', async () => {
    const file = avatarInput.files[0];
    avatarInput.value = '';
    if (!file || !currentUser) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { toast('Envie uma imagem PNG, JPG ou WEBP.', 'error'); return; }
    if (file.size > 5 * 1024 * 1024) { toast('A imagem precisa ter até 5MB.', 'error'); return; }
    if (!sb) { toast('Conecte o Supabase no config.js.', 'error'); return; }

    const localUrl = URL.createObjectURL(file);
    renderAvatar(localUrl); // pré-visualização instantânea
    avatarBtn.classList.add('uploading');

    const ext = file.type.split('/')[1];
    const path = `${currentUser.id}/avatar.${ext}`;
    const { error: upErr } = await sb.storage.from('avatars').upload(path, file, { upsert: true, cacheControl: '3600' });
    if (upErr) {
      avatarBtn.classList.remove('uploading');
      renderAvatar(currentProfile.avatar_url);
      toast('Não foi possível enviar a foto. Verifique se o bucket "avatars" existe no Supabase.', 'error');
      return;
    }
    const { data: pub } = sb.storage.from('avatars').getPublicUrl(path);
    const finalUrl = pub.publicUrl + '?t=' + Date.now();
    const { error: dbErr } = await sb.from('profiles').update({ avatar_url: finalUrl }).eq('id', currentUser.id);
    avatarBtn.classList.remove('uploading');
    if (dbErr) { toast('Foto enviada, mas não salvou no perfil.', 'error'); return; }
    currentProfile.avatar_url = finalUrl;
    renderAvatar(finalUrl);
    toast('Foto de perfil atualizada!');
  });

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
    meuVeiculoAtivo = (data || []).find((v) => v.status === 'ativo') || null;
    updateTrackUI();
  }

  /* =====================================================================
     RASTREAMENTO EM TEMPO REAL (motorista)
     Só funciona com o app aberto na tela — navegador não rastreia em
     segundo plano. O motorista precisa ligar manualmente (consentimento).
  ===================================================================== */
  function gdIcon(stale) {
    return L.divIcon({
      className: '',
      html: `<div class="gd-marker${stale ? ' stale' : ''}"><span class="material-symbols-rounded">directions_car</span></div>`,
      iconSize: [34, 34], iconAnchor: [17, 30],
    });
  }
  function updateTrackUI() {
    const toggle = $('trackToggle'), status = $('trackStatus');
    if (!meuVeiculoAtivo) {
      toggle.checked = false; toggle.disabled = true;
      status.textContent = 'Cadastre um veículo e aguarde a aprovação para poder compartilhar localização.';
      return;
    }
    toggle.disabled = false;
    if (!watchId) status.textContent = 'Desligado — ative para aparecer no mapa da frota.';
  }
  function initTrackToggle() {
    updateTrackUI();
    const toggle = $('trackToggle');
    if (currentProfile && currentProfile.compartilha_localizacao && meuVeiculoAtivo) {
      toggle.checked = true;
      startTracking();
    }
    if (trackToggleWired) return;
    trackToggleWired = true;
    toggle.addEventListener('change', async () => {
      if (toggle.checked) {
        if (!navigator.geolocation) { toast('Seu navegador não suporta localização.', 'error'); toggle.checked = false; return; }
        if (!meuVeiculoAtivo) { toggle.checked = false; return; }
        startTracking();
        if (sb && currentUser) await sb.from('profiles').update({ compartilha_localizacao: true }).eq('id', currentUser.id);
      } else {
        stopTracking();
        if (sb && currentUser) await sb.from('profiles').update({ compartilha_localizacao: false }).eq('id', currentUser.id);
      }
    });
  }
  function startTracking() {
    if (watchId != null || !meuVeiculoAtivo) return;
    $('liveDot').classList.add('on');
    $('trackStatus').textContent = 'Ativo — sua posição está sendo compartilhada agora.';
    $('ownMap').hidden = false;
    setTimeout(initOwnMap, 260);
    watchId = navigator.geolocation.watchPosition(onPosition, onPositionError, {
      enableHighAccuracy: true, maximumAge: 5000, timeout: 20000,
    });
  }
  function stopTracking() {
    if (watchId != null) { navigator.geolocation.clearWatch(watchId); watchId = null; }
    $('liveDot').classList.remove('on');
    $('ownMap').hidden = true;
    updateTrackUI();
  }
  function initOwnMap() {
    const el = $('ownMap');
    if (!el || el.hidden || typeof L === 'undefined') return;
    if (!ownMapObj) {
      ownMapObj = L.map(el, { zoomControl: false, attributionControl: false }).setView([-3.13, -60.02], 14);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(ownMapObj);
    }
    ownMapObj.invalidateSize();
  }
  async function onPosition(pos) {
    const { latitude, longitude, heading } = pos.coords;
    if (ownMapObj) {
      if (!ownMarker) ownMarker = L.marker([latitude, longitude], { icon: gdIcon() }).addTo(ownMapObj);
      else ownMarker.setLatLng([latitude, longitude]);
      ownMapObj.setView([latitude, longitude], ownMapObj.getZoom() || 14);
    }
    const now = Date.now();
    if (now - lastSentAt < 8000) return; // no máximo 1 atualização a cada 8s
    lastSentAt = now;
    if (!sb || !meuVeiculoAtivo || !currentUser) return;
    await sb.from('localizacoes').upsert({
      veiculo_id: meuVeiculoAtivo.id, motorista_id: currentUser.id,
      lat: latitude, lng: longitude, heading: heading ?? null,
      atualizado_em: new Date().toISOString(),
    });
  }
  function onPositionError() {
    toast('Não foi possível acessar sua localização. Verifique a permissão do navegador.', 'error');
    $('trackToggle').checked = false;
    stopTracking();
  }

  /* =====================================================================
     FROTA AO VIVO (admin) — mapa com todos os veículos compartilhando
  ===================================================================== */
  async function initAdminIfNeeded() {
    if (!currentProfile || currentProfile.tipo !== 'admin') return;
    $('navFrota').hidden = false;
    await Promise.all([loadFleet(), loadPendentes()]);
    if (!fleetChannel && sb) {
      fleetChannel = sb.channel('frota-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'localizacoes' }, () => loadFleet())
        .subscribe();
    }
    if (!veiculosChannel && sb) {
      veiculosChannel = sb.channel('veiculos-pendentes-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'veiculos' }, () => loadPendentes())
        .subscribe();
    }
  }

  /* ---------- Aprovação de veículos (admin) ---------- */
  async function loadPendentes() {
    const { data: veics } = await sb.from('veiculos').select('*').eq('status', 'pendente').order('criado_em', { ascending: true });
    const list = veics || [];
    const mIds = [...new Set(list.map((v) => v.motorista_id))];
    const { data: profs } = mIds.length
      ? await sb.from('profiles').select('id,nome,telefone').in('id', mIds)
      : { data: [] };
    const pMap = Object.fromEntries((profs || []).map((p) => [p.id, p]));
    renderPendentes(list.map((v) => ({ ...v, motorista: pMap[v.motorista_id] })));
  }
  function renderPendentes(list) {
    $('pendentesBlock').hidden = list.length === 0;
    $('pendCount').textContent = list.length;
    $('pendentesList').innerHTML = list.map((v) => `
      <div class="pend-item" data-id="${v.id}">
        <div class="pend-top">
          <div class="veiculo-ic"><span class="material-symbols-rounded">directions_car</span></div>
          <div class="info">
            <h4>${[v.marca, v.modelo].filter(Boolean).join(' ') || 'Veículo'}</h4>
            <small>${v.placa || ''} · ${v.app_transporte || ''} · ${v.motorista ? v.motorista.nome : 'Motorista'}</small>
          </div>
        </div>
        <div class="pend-actions">
          <button class="btn btn-reject sm" data-act="recusar">Recusar</button>
          <button class="btn btn-primary sm" data-act="aceitar">Aceitar</button>
        </div>
      </div>`).join('');
    $('pendentesList').querySelectorAll('[data-act]').forEach((btn) => {
      btn.addEventListener('click', () => resolverPendente(btn.closest('.pend-item').dataset.id, btn.dataset.act));
    });
  }
  async function resolverPendente(veiculoId, acao) {
    const novoStatus = acao === 'aceitar' ? 'ativo' : 'recusado';
    const item = document.querySelector(`.pend-item[data-id="${veiculoId}"]`);
    if (item) item.style.opacity = '.5';
    const { data: veic, error } = await sb.from('veiculos').update({ status: novoStatus }).eq('id', veiculoId).select().single();
    if (error) { toast('Não foi possível atualizar o veículo.', 'error'); if (item) item.style.opacity = ''; return; }
    // avisa o motorista automaticamente
    if (veic) {
      await sb.from('notificacoes').insert({
        profile_id: veic.motorista_id,
        tipo: acao === 'aceitar' ? 'check_circle' : 'cancel',
        titulo: acao === 'aceitar' ? 'Veículo aprovado! 🎉' : 'Veículo não aprovado',
        mensagem: acao === 'aceitar'
          ? `Seu ${[veic.marca, veic.modelo].filter(Boolean).join(' ')} (${veic.placa}) foi aprovado e já pode compartilhar localização.`
          : `Seu ${[veic.marca, veic.modelo].filter(Boolean).join(' ')} (${veic.placa}) não foi aprovado. Fale com a Go.Drive para entender o motivo.`,
      });
    }
    toast(acao === 'aceitar' ? 'Veículo aprovado!' : 'Veículo recusado.');
    await loadPendentes();
  }
  function resetFleet() {
    if (fleetChannel && sb) { sb.removeChannel(fleetChannel); fleetChannel = null; }
    if (veiculosChannel && sb) { sb.removeChannel(veiculosChannel); veiculosChannel = null; }
    fleetMarkers = {}; fleetFitDone = false;
    $('navFrota').hidden = true;
  }
  function initFleetMap() {
    if (fleetMapObj || typeof L === 'undefined') return;
    fleetMapObj = L.map('fleetMap', { attributionControl: false }).setView([-3.13, -60.02], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(fleetMapObj);
  }
  async function loadFleet() {
    initFleetMap();
    const { data: locs } = await sb.from('localizacoes').select('*');
    const list = locs || [];
    const vIds = [...new Set(list.map((l) => l.veiculo_id))];
    const mIds = [...new Set(list.map((l) => l.motorista_id))];
    const [{ data: veics }, { data: profs }] = await Promise.all([
      vIds.length ? sb.from('veiculos').select('id,marca,modelo,placa').in('id', vIds) : Promise.resolve({ data: [] }),
      mIds.length ? sb.from('profiles').select('id,nome,avatar_url').in('id', mIds) : Promise.resolve({ data: [] }),
    ]);
    const vMap = Object.fromEntries((veics || []).map((v) => [v.id, v]));
    const pMap = Object.fromEntries((profs || []).map((p) => [p.id, p]));
    renderFleet(list.map((l) => ({ ...l, veiculo: vMap[l.veiculo_id], motorista: pMap[l.motorista_id] })));
  }
  function renderFleet(list) {
    $('fleetCount').textContent = `${list.length} online`;
    if (fleetMapObj) {
      const seen = new Set();
      list.forEach((item) => {
        seen.add(item.veiculo_id);
        const stale = Date.now() - new Date(item.atualizado_em).getTime() > 90000;
        if (fleetMarkers[item.veiculo_id]) {
          fleetMarkers[item.veiculo_id].setLatLng([item.lat, item.lng]);
          fleetMarkers[item.veiculo_id].setIcon(gdIcon(stale));
        } else {
          fleetMarkers[item.veiculo_id] = L.marker([item.lat, item.lng], { icon: gdIcon(stale) }).addTo(fleetMapObj);
        }
        const nome = item.motorista ? item.motorista.nome : 'Motorista';
        const carro = item.veiculo ? [item.veiculo.marca, item.veiculo.modelo].filter(Boolean).join(' ') : 'Veículo';
        fleetMarkers[item.veiculo_id].bindPopup(`<strong>${nome}</strong><br>${carro}${item.veiculo && item.veiculo.placa ? ' · ' + item.veiculo.placa : ''}`);
      });
      Object.keys(fleetMarkers).forEach((id) => {
        if (!seen.has(id)) { fleetMapObj.removeLayer(fleetMarkers[id]); delete fleetMarkers[id]; }
      });
      if (list.length && !fleetFitDone) {
        fleetFitDone = true;
        const group = L.featureGroup(Object.values(fleetMarkers));
        if (group.getBounds().isValid()) fleetMapObj.fitBounds(group.getBounds().pad(0.3));
      }
    }
    const box = $('fleetList');
    if (!list.length) {
      box.innerHTML = `<div class="empty">
        <div class="empty-ic"><span class="material-symbols-rounded">map</span></div>
        <strong>Nenhum carro online agora</strong>
        <p>Assim que um motorista ligar o compartilhamento de localização, ele aparece aqui.</p>
      </div>`;
      return;
    }
    box.innerHTML = list.map((item) => {
      const stale = Date.now() - new Date(item.atualizado_em).getTime() > 90000;
      const nome = item.motorista ? item.motorista.nome : 'Motorista';
      const carro = item.veiculo ? [item.veiculo.marca, item.veiculo.modelo].filter(Boolean).join(' ') : 'Veículo';
      const foto = item.motorista && item.motorista.avatar_url;
      return `<div class="fleet-item">
        <div class="avatar sm">${foto ? `<img src="${foto}" alt="" />` : '<span class="material-symbols-rounded">person</span>'}</div>
        <div class="fi-info"><h4>${nome}</h4><small>${carro} · atualizado ${timeAgo(item.atualizado_em)}${stale ? ' · sinal antigo' : ''}</small></div>
        <span class="live-dot ${stale ? '' : 'on'}"></span>
      </div>`;
    }).join('');
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
    const cardHTML = (e, dup) => `
      <article class="ex-card${dup ? ' dup' : ''}">
        <div class="ex-photo"><img src="${e.foto_url}" alt="${e.empresa_nome || ''}" loading="lazy" /><span class="ex-badge">${e.formato || ''}</span></div>
        <div class="ex-info"><h4>${e.empresa_nome || ''}</h4><span>${e.veiculo || ''}</span></div>
      </article>`;
    // duplica a lista pra criar o efeito de loop contínuo e suave (sem "salto" no fim)
    wrap.innerHTML = list.map((e) => cardHTML(e, false)).join('') + list.map((e) => cardHTML(e, true)).join('');
  }
  function loadExemplos() {
    renderExemplos(EXEMPLOS);
  }
  const exViewport = $('exemplosViewport');
  if (exViewport) {
    const pause = () => $('exemplos').classList.add('paused');
    const resume = () => $('exemplos').classList.remove('paused');
    exViewport.addEventListener('touchstart', pause, { passive: true });
    exViewport.addEventListener('touchend', resume);
    exViewport.addEventListener('touchcancel', resume);
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
