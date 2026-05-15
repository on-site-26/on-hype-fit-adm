// CONFIGURAÇÃO DO FIREBASE ATUALIZADA E ATIVA
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyCH5HAgQCkNKPthTAISBHCbwbw1Gbj_Pxc",
    authDomain: "on-hype-fit.firebaseapp.com",
    databaseURL: "https://on-hype-fit-default-rtdb.firebaseio.com",
    projectId: "on-hype-fit",
    storageBucket: "on-hype-fit.appspot.com",
    messagingSenderId: "871484604932",
    appId: "1:871484604932:web:4a20243e0cedc21e756b51",
    measurementId: "G-KN9EVFMYXH"
};

// Inicializa o Firebase e força a conexão com o Banco de Dados Online
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
    };
    
    Chart.register(ChartDataLabels);

let orders = JSON.parse(localStorage.getItem('hype_orders')) || [];
let expenses = JSON.parse(localStorage.getItem('hype_expenses')) || [];
let currentItems = []; 
let editingId = null;
let charts = {};

// CORREÇÃO FUSO HORÁRIO (DATA LOCAL)
function getLocalDate() {
    const d = new Date();
    const ano = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
}

window.onload = function() {
    // Escuta e puxa todos os pedidos salvos na nuvem em tempo real
    db.ref('orders').on('value', snapshot => {
        orders = [];
        snapshot.forEach(child => { 
            orders.push(child.val()); 
        });
        // Atualiza a tabela na tela do usuário instantaneamente
        filterList('hoje'); 
    });

    // Escuta e puxa todas as despesas salvas na nuvem em tempo real
    db.ref('expenses').on('value', snapshot => {
        expenses = [];
        snapshot.forEach(child => { 
            expenses.push(child.val()); 
        });
        if(typeof renderExpenseTable === "function") renderExpenseTable();
    });

    if(sessionStorage.getItem('isLogged') === 'true') showApp();
};

function checkLogin() {
    const u = document.getElementById('user-input').value;
    const p = document.getElementById('pass-input').value;
    if(u === "Gabriella" && p === "123cg") {
        sessionStorage.setItem('isLogged', 'true');
        showApp();
    } else alert("Usuário ou senha incorretos!");
}

function logout() { sessionStorage.removeItem('isLogged'); location.reload(); }

function showApp() {
    document.getElementById('login-overlay').style.display = "none";
    document.getElementById('main-content').style.display = "block";
    document.getElementById('order-date').value = getLocalDate();
    filterList('hoje');
}

// LÓGICA DE PRODUTOS
function addItem() {
    const select = document.getElementById('prod-select');
    const qty = parseInt(document.getElementById('prod-qty').value);
    if(!select.value) return;
    const [name, price] = select.value.split('|');
    currentItems.push({ name, price: parseFloat(price), qty, subtotal: parseFloat(price) * qty });
    updateCurrentItemsList();
}

function updateCurrentItemsList() {
    const container = document.getElementById('current-order-items');
    const discount = parseFloat(document.getElementById('order-discount').value) || 0;
    container.innerHTML = "";
    let subtotalItems = 0;
    currentItems.forEach((item, index) => {
        subtotalItems += item.subtotal;
        container.innerHTML += `<div class="item-row"><span>${item.qty}x ${item.name}</span><span>R$ ${item.subtotal.toFixed(2)} <button onclick="removeItem(${index})" style="color:red; background:none; font-weight:bold; cursor:pointer;">x</button></span></div>`;
    });
    let val = subtotalItems - discount;
    document.getElementById('order-value').value = (val < 0 ? 0 : val).toFixed(2);
}

function removeItem(index) { currentItems.splice(index, 1); updateCurrentItemsList(); }

// SALVAR PEDIDO
function saveOrder() {
    const name = document.getElementById('cust-name').value;
    if(!name || currentItems.length === 0) return alert("Preencha o nome e adicione produtos!");
    
    const order = {
        id: editingId || Date.now().toString(),
        date: document.getElementById('order-date').value,
        name: name,
        items: [...currentItems],
        productsNames: currentItems.map(i => `${i.qty}x ${i.name}`).join(', '),
        discount: parseFloat(document.getElementById('order-discount').value) || 0,
        value: parseFloat(document.getElementById('order-value').value),
        payMethod: document.getElementById('order-pay-method').value,
        isPaid: document.getElementById('order-status').value,
        delivery: document.getElementById('delivery-status').value,
        location: document.getElementById('order-loc').value
    };

    // Força o salvamento na nuvem do Firebase Realtime Database
    db.ref('orders/' + order.id).set(order)
        .then(() => {
            resetForm();
            alert("Pedido sincronizado na nuvem com sucesso!");
        })
        .catch((error) => {
            console.error("Erro ao salvar no Firebase: ", error);
            alert("Erro de conexão! O dado não pôde ser enviado para a nuvem.");
        });
}

function resetForm() {
    editingId = null;
    document.getElementById('form-title').innerText = "📝 Novo Pedido";
    document.getElementById('btn-main-action').innerText = "SALVAR PEDIDO";
    document.getElementById('btn-cancel-edit').style.display = "none";
    document.getElementById('order-date').value = getLocalDate();
    document.getElementById('cust-name').value = "";
    document.getElementById('order-discount').value = "0.00";
    document.getElementById('order-loc').value = "";
    currentItems = []; updateCurrentItemsList();
}

function editOrder(id) {
    const o = orders.find(x => x.id === id);
    editingId = id;
    document.getElementById('form-title').innerText = "✏️ Editando Pedido";
    document.getElementById('btn-main-action').innerText = "ATUALIZAR";
    document.getElementById('btn-cancel-edit').style.display = "block";
    document.getElementById('order-date').value = o.date;
    document.getElementById('cust-name').value = o.name;
    document.getElementById('order-discount').value = o.discount;
    document.getElementById('order-pay-method').value = o.payMethod;
    document.getElementById('order-status').value = o.isPaid;
    document.getElementById('delivery-status').value = o.delivery;
    document.getElementById('order-loc').value = o.location;
    currentItems = [...o.items]; updateCurrentItemsList();
    document.getElementById('form-section').scrollIntoView({behavior: "smooth"});
}

function deleteOrder(id) { if(confirm("Excluir pedido?")) { orders = orders.filter(o => o.id !== id); localStorage.setItem('hype_orders', JSON.stringify(orders)); filterList('hoje'); } }

function renderTable(data, showDate) {
    const thead = document.getElementById('table-head');
    const tbody = document.getElementById('table-body');
    thead.innerHTML = `<tr>${showDate?'<th>Data</th>':''}<th>Cliente</th><th>Produtos</th><th>Valor</th><th>Pagamento</th><th>Pago?</th><th>Entrega</th><th>Ação</th></tr>`;
    tbody.innerHTML = "";
    data.forEach(o => {
        tbody.innerHTML += `
            <tr>
                ${showDate?`<td>${o.date.split('-').reverse().join('/')}</td>`:''}
                <td>${o.name}</td>
                <td>${o.productsNames}</td>
                <td>R$ ${o.value.toFixed(2)}</td>
                <td>${o.payMethod}</td>
                <td class="${o.isPaid==='Sim'?'status-pago':'status-pendente'}">${o.isPaid}</td>
                <td>${o.delivery}</td>
                <td>
                    <button class="btn-edit-table" onclick="editOrder(${o.id})">Editar</button> 
                    <button class="btn-del-table" onclick="deleteOrder(${o.id})">Excluir</button>
                </td>
            </tr>`;
    });
}

function filterList(type) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    const hoje = getLocalDate();
    if(type === 'hoje') { 
        document.getElementById('btn-hoje').classList.add('active'); 
        renderTable(orders.filter(o => o.date === hoje), false); 
    } else { 
        document.getElementById('btn-30').classList.add('active'); 
        const d30 = new Date(); d30.setDate(d30.getDate()-30); 
        renderTable(orders.filter(o => new Date(o.date) >= d30), true); 
    }
}

// LÓGICA DE DESPESAS (POP-UP)
function toggleExpenseModal(show) { 
    document.getElementById('expense-modal').style.display = show ? 'flex' : 'none'; 
    if(show) { document.getElementById('exp-date').value = getLocalDate(); renderExpenseTable(); }
}

function saveExpense() {
    const date = document.getElementById('exp-date').value;
    const desc = document.getElementById('exp-desc').value;
    const val = parseFloat(document.getElementById('exp-val').value);
    const qty = parseInt(document.getElementById('exp-qty').value);
    if(!desc || isNaN(val)) return alert("Preencha todos os campos!");
    expenses.push({ id: Date.now(), date, desc, val, qty, total: val * qty });
    localStorage.setItem('hype_expenses', JSON.stringify(expenses));
    document.getElementById('exp-desc').value = ""; document.getElementById('exp-val').value = "";
    renderExpenseTable();
}

function deleteExpense(id) { if(confirm("Excluir despesa?")) { expenses = expenses.filter(e => e.id !== id); localStorage.setItem('hype_expenses', JSON.stringify(expenses)); renderExpenseTable(); } }

function renderExpenseTable() {
    const tbody = document.getElementById('expense-table-body');
    tbody.innerHTML = "";
    expenses.forEach(e => {
        tbody.innerHTML += `<tr><td>${e.date.split('-').reverse().join('/')}</td><td>${e.desc}</td><td>${e.qty}</td><td>R$ ${e.total.toFixed(2)}</td><td><button onclick="deleteExpense(${e.id})" style="background:red; color:white; border-radius:4px; padding:2px 5px;">X</button></td></tr>`;
    });
}

// RELATÓRIOS
function reportToday() {
    const hoje = getLocalDate();
    document.getElementById('stats-from').value = hoje;
    document.getElementById('stats-to').value = hoje;
    generateStats();
}

function generateStats() {
    const from = document.getElementById('stats-from').value;
    const to = document.getElementById('stats-to').value;
    if(!from || !to) return alert("Selecione o período!");
    
    const fOrders = orders.filter(o => o.date >= from && o.date <= to);
    const fExpenses = expenses.filter(e => e.date >= from && e.date <= to);

    let vlrPago = 0, vlrPend = 0, totalExp = 0, prods = {}, entregue = 0, nEntregue = 0;
    let payStats = { 'Pix': {q:0, v:0}, 'Dinheiro': {q:0, v:0}, 'Crédito': {q:0, v:0}, 'Débito': {q:0, v:0} };
    let week = { 'Dom':0, 'Seg':0, 'Ter':0, 'Qua':0, 'Qui':0, 'Sex':0, 'Sáb':0 };
    const weekMap = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

    fOrders.forEach(o => {
        if(o.isPaid==='Sim') vlrPago += o.value; else vlrPend += o.value;
        if(o.delivery==='Entregue') entregue++; else nEntregue++;
        if(payStats[o.payMethod]) { payStats[o.payMethod].q++; payStats[o.payMethod].v += o.value; }
        o.items.forEach(i => prods[i.name] = (prods[i.name]||0) + i.qty);
        
        // Lógica do Gráfico de Semana (Corrige fuso ao criar Date)
        const d = new Date(o.date + "T00:00:00");
        week[weekMap[d.getDay()]] += o.value;
    });

    fExpenses.forEach(e => totalExp += e.total);
    let lucro = vlrPago - totalExp;

    document.getElementById('total-payment-value').innerText = `Vendas no Período: R$ ${(vlrPago + vlrPend).toFixed(2)}`;
    document.getElementById('lucro-total-box').innerHTML = `Entradas (Pago): R$ ${vlrPago.toFixed(2)} | Despesas: R$ ${totalExp.toFixed(2)}<br><strong>LUCRO LÍQUIDO: R$ ${lucro.toFixed(2)}</strong>`;
    document.getElementById('lucro-total-box').style.background = lucro >= 0 ? 'var(--success)' : 'var(--danger)';

    updateCharts(vlrPago, vlrPend, prods, entregue, nEntregue, payStats, totalExp, lucro, week);
}

function updateCharts(pago, pend, prods, ent, nEnt, pay, tExp, lucro, week) {
    Object.values(charts).forEach(c => c.destroy());

    charts.lucro = new Chart(document.getElementById('chartLucro'), {
        type:'bar', data:{ labels:['Entradas (Pago)', 'Despesas', 'Lucro Líquido'], datasets:[{data:[pago, tExp, lucro], backgroundColor:['#27ae60','#e74c3c','#3498db']}]},
        options: { plugins: { datalabels: { anchor:'end', align:'top', formatter: (v)=>'R$ '+v.toFixed(2) }}}
    });

    charts.fin = new Chart(document.getElementById('chartFinanceiro'), {
        type:'pie', data:{ labels:['Pago','Pendente'], datasets:[{data:[pago, pend], backgroundColor:['#27ae60','#f1c40f']}]},
        options: { plugins: { datalabels: { color:'#fff', formatter: (v)=>'R$ '+v.toFixed(2) }}}
    });

    charts.prd = new Chart(document.getElementById('chartProdutos'), {
        type:'bar', data:{ labels:Object.keys(prods), datasets:[{label:'Qtd', data:Object.values(prods), backgroundColor:'#3498db'}]},
        options: { plugins: { datalabels: { anchor:'end', align:'top' }}}
    });

    charts.ent = new Chart(document.getElementById('chartEntrega'), {
        type:'doughnut', data:{ labels:['Entregue','Pendente'], datasets:[{data:[ent, nEnt], backgroundColor:['#7dc242','#e67e22']}]},
        options: { plugins: { datalabels: { color:'#fff' }}}
    });

    charts.sem = new Chart(document.getElementById('chartSemana'), {
        type:'line', data:{ labels:Object.keys(week), datasets:[{label:'R$', data:Object.values(week), borderColor:'#7dc242', fill:true, backgroundColor:'rgba(125,194,66,0.1)'}]},
        options: { plugins: { datalabels: { anchor:'end', align:'top', formatter: (v)=>'R$ '+v.toFixed(2) }}}
    });

    charts.pay = new Chart(document.getElementById('chartPagamento'), {
        type:'bar', data:{ labels:Object.keys(pay), datasets:[{label:'Qtd', data:Object.values(pay).map(x=>x.q), backgroundColor:'#9b59b6'}, {label:'Valor (R$)', data:Object.values(pay).map(x=>x.v), backgroundColor:'#2ecc71'}]},
        options: { plugins: { datalabels: { anchor:'end', align:'top', formatter: (v, ctx)=> ctx.datasetIndex === 1 ? 'R$ '+v.toFixed(2) : v }}}
    });
}

function cancelEdit() { resetForm(); }
