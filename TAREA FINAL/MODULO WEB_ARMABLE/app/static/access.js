const get = id => document.getElementById(id);
const query = new URLSearchParams(location.search);
const preferred = query.get('plan');
const titles = {login:'Iniciar sesión', register:'Crear cuenta', 'select-plan':'Elige tu plan'};

async function api(path, method = 'GET', data) {
  const response = await fetch(path, {
    method, headers:{'X-Editor-Request':'1', 'Content-Type':'application/json'},
    body:JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok) {
    const detail = result.detail;
    throw new Error(typeof detail === 'string' ? detail : 'Revisa los datos del formulario.');
  }
  return result;
}

function show(form) {
  for (const name of Object.keys(titles)) get(name).hidden = name !== form;
  get('access-title').textContent = titles[form];
  get('access-status').textContent = '';
}

function bind(form, path, method) {
  get(form).addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.submitter;
    button.disabled = true;
    try {
      await api(path, method, Object.fromEntries(new FormData(event.currentTarget)));
      location.replace(form === 'login' && preferred ? '/builder?plan=' + encodeURIComponent(preferred) : '/builder');
    } catch (error) {
      get('access-status').textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
}

async function boot() {
  try {
    const [session, plans] = await Promise.all([api('/api/session'), api('/api/plans')]);
    if (session.editor_access) {
      location.replace('/builder');
      return;
    }
    const selected = Object.hasOwn(plans, preferred) ? preferred : '';
    for (const id of ['register-plan', 'account-plan']) {
      const field = get(id);
      field.add(new Option('Selecciona un plan', ''));
      for (const [key, plan] of Object.entries(plans)) {
        field.add(new Option(`${plan.name} · ${plan.pages} páginas/mes · ${plan.credits} créditos/mes`, key));
      }
      field.value = selected;
    }
    get('invitation-field').hidden = !session.invitation_required;
    get('invitation').required = session.invitation_required;
    get('show-register').onclick = () => show('register');
    get('show-login').onclick = () => show('login');
    get('sign-out').onclick = async () => {
      try {
        await api('/api/logout', 'POST');
        show('login');
      } catch (error) {
        get('access-status').textContent = error.message;
      }
    };
    bind('login', '/api/login', 'POST');
    bind('register', '/api/register', 'POST');
    bind('select-plan', '/api/account/plan', 'PUT');
    show(session.authenticated ? 'select-plan' : (selected || query.has('registro')) ? 'register' : 'login');
  } catch (error) {
    get('access-status').textContent = error.message;
  }
}
boot();
