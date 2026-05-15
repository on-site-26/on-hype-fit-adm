// ==========================================
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

// Inicializa o Firebase e estabelece a conexão global
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// Registro do plugin de rótulos dos gráficos se a biblioteca estiver presente
if (typeof ChartDataLabels !== 'undefined') {
    Chart.register(ChartDataLabels);
}

let orders = [];
let expenses = [];
let currentItems = []; 
let editingId = null;
let charts = {};

function getLocalDate() {
    const d = new Date();
    const ano = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
}

// ==========================================
// CARREGAMENTO DOS DADOS ONLINE (SINCRONIZADO)
// ==========================================
window.onload = function() {
    // Escuta e puxa os pedidos salvos no Firebase em tempo real
    db.ref('orders').on('value', snapshot => {
        orders = [];
        snapshot.forEach(child => { orders.push(child.val()); });
        filterList('hoje');
    }, error => {
        console.error("Erro ao ler pedidos do Firebase: ", error);
    });

    // Escuta e puxa as despesas salvas no Firebase em tempo real
    db.ref('expenses').on('value', snapshot => {
        expenses = [];
        snapshot.forEach(child => { expenses.push(child.val()); });
        renderExpenseTable();
    }, error => {
        console.error("Erro ao ler despesas do Firebase: ", error);
    });

    if(sessionStorage.getItem('isLogged') === 'true') showApp();
};

function checkLogin() {
    const u = document.getElementById('user-input').value;
    const p = document.getElementById('pass-input').value;
    if(u === "Gabriella" && p === "12345678") {
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

// ==========================================
// FUNÇÕES DE PRODUTOS E ITENS DO PEDIDO
// ==========================================
function addItem() {
    const select = document.getElementById('prod-select');
    const qtyInput = document.getElementById('prod-qty');
    const qty = parseInt(qtyInput.value) || 1;
    
    if(!select.value) {
        return alert("Por favor, selecione um produto antes de adicionar!");
    }
    
    const [name, price] = select.value.split('|');
    currentItems.push({ 
        name: name, 
        price: parseFloat(price), 
        qty: qty, 
        subtotal: parseFloat(price) * qty 
    });
    
    updateCurrentItemsList();
    // Reseta o seletor para facilitar a próxima adição
    select.value = "";
    qtyInput.value = "1";
}

function updateCurrentItemsList() {
    const container = document.getElementById('current-order-items');
    const discount = parseFloat(document.getElementById('order-discount').value) || 0;
    container.innerHTML = "";
    let subtotalItems = 0;
    
    currentItems.forEach((item, index) => {
        subtotalItems += item.subtotal;
        container.innerHTML += `
            <div class="item-row" style="display:flex; justify-content:space-between; align-items:center; padding: 5px 0; border-bottom: 1px dashed #eee;">
                <span>${item.qty}x ${item.name}</span>
                <span>R$ ${item.subtotal.toFixed(2)} 
                    <button type="button" onclick="removeItem(${index})" style="color:red; background:none; border:none; font-weight:bold; cursor:pointer; margin-left:10px;">X</button>
                </span>
            </div>`;
    });
    
    let val = subtotalItems - discount;
    document.getElementById('order-value').value = (val < 0 ? 0 : val).toFixed(2);
}

function removeItem(index) { 
    currentItems.splice(index, 1); 
    updateCurrentItemsList(); 
}

// ==========================================
// SALVAR NO FIREBASE REALTIME DATABASE
// ==========================================
function saveOrder() {
    const name = document.getElementById('cust-name').value;
    if(!name || currentItems.length === 0) {
        return alert("Erro: Certifique-se de preencher o nome do cliente e adicionar pelo menos 1 produto através do botão (+)!");
    }
    
    const orderId = editingId || Date.now().toString();
    const order = {
        id: orderId,
        date: document.getElementById('order-date').value,
        name: name,
        items: [...currentItems],
        productsNames: currentItems.map(i => `${i.qty}x ${i.name}`).join(', '),
        discount: parseFloat(document.getElementById('order-discount').value) || 0,
        value: parseFloat(document.getElementById('order-value').value) || 0,
        payMethod: document.getElementById('order-pay-method').value,
        isPaid: document.getElementById('order-status').value,
        delivery: document.getElementById('delivery-status').value,
        location: document.getElementById('order-loc').value
    };

    // Grava na referência exata do Firebase online
    db.ref('orders/' + orderId).set(order)
        .then(() => {
            resetForm();
            alert("Pedido salvo e sincronizado com sucesso!");
        })
        .catch(error => {
            console.error("Erro ao salvar no Firebase: ", error);
            alert("Falha de conexão ao salvar online. Verifique as regras do seu Firebase.");
        });
}

function resetForm() {
    editingId = null;
    document.getElementById('form-title').innerText = "📝 Novo Pedido";
    document.getElementById('btn-main-action').innerText = "SALVAR PEDIDO";
    if(document.getElementById('btn-cancel-edit')) document.getElementById('btn-cancel-edit').style.display = "none";
    document.getElementById('order-date').value = getLocalDate();
    document.getElementById('cust-name').value = "";
    document.getElementById('order-discount').value = "0.00";
    document.getElementById('order-loc').value = "";
    currentItems = []; 
    updateCurrentItemsList();
}

function editOrder(id) {
    const o = orders.find(x => x.id == id);
    if(!o) return;
    editingId = id;
    document.getElementById('form-title').innerText = "✏️ Editando Pedido";
    document.getElementById('btn-main-action').innerText = "ATUALIZAR";
    if(document.getElementById('btn-cancel-edit')) document.getElementById('btn-cancel-edit').style.display = "block";
    document.getElementById('order-date').value = o.date;
    document.getElementById('cust-name').value = o.name;
    document.getElementById('order-discount').value = o.discount;
    document.getElementById('order-pay-method').value = o.payMethod;
    document.getElementById('order-status').value = o.isPaid;
    document.getElementById('delivery-status').value = o.delivery;
    document.getElementById('order-loc').value = o.location;
    currentItems = o.items ? [...o.items] : []; 
    updateCurrentItemsList();
    document.getElementById('form-section').scrollIntoView({behavior: "smooth"});
}

function deleteOrder(id) {
    if(confirm("Deseja realmente excluir este pedido definitivamente da nuvem?")) {
        db.ref('orders/' + id).remove()
            .then(() => alert("Pedido removido!"))
            .catch(err => alert("Erro ao deletar: " + err));
    }
}

function renderTable(data, showDate) {
    const thead = document.getElementById('table-head');
    const tbody = document.getElementById('table-body');
    if(!thead || !tbody) return;
    
    thead.innerHTML = `<tr>${showDate?'<th>Data</th>':''}<th>Cliente</th><th>Produtos</th><th>Valor</th><th>Pagamento</th><th>Pago?</th><th>Entrega</th><th>Ação</th></tr>`;
    tbody.innerHTML = "";
    
    data.forEach(o => {
        tbody.innerHTML += `
            <tr>
                ${showDate?`<td>${o.date.split('-').reverse().join('/')}</td>`:''}
                <td>${o.name}</td>
                <td>${o.productsNames || ''}</td>
                <td>R$ ${parseFloat(o.value).toFixed(2)}</td>
                <td>${o.payMethod}</td>
                <td class="${o.isPaid==='Sim'?'status-pago':'status-pendente'}">${o.isPaid}</td>
                <td>${o.delivery}</td>
                <td>
                    <button class="btn-edit-table" onclick="editOrder('${o.id}')">Editar</button> 
                    <button class="btn-del-table" onclick="deleteOrder('${o.id}')">Excluir</button>
                </td>
            </tr>`;
    });
}

function filterList(type) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    const hoje = getLocalDate();
    if(type === 'hoje') { 
        const btn = document.getElementById('btn-hoje');
        if(btn) btn.classList.add('active'); 
        renderTable(orders.filter(o => o.date === hoje), false); 
    } else { 
        const btn = document.getElementById('btn-30');
        if(btn) btn.classList.add('active'); 
        const d30 = new Date(); d30.setDate(d30.getDate()-30); 
        renderTable(orders.filter(o => new Date(o.date) >= d30), true); 
    }
}

// ==========================================
// SEÇÃO DE GESTÃO DE DESPESAS ONLINE
// ==========================================
function toggleExpenseModal(show) { 
    const modal = document.getElementById('expense-modal');
    if(modal) modal.style.display = show ? 'flex' : 'none'; 
    if(show) { document.getElementById('exp-date').value = getLocalDate(); renderExpenseTable(); }
}

function saveExpense() {
    const date = document.getElementById('exp-date').value;
    const desc = document.getElementById('exp-desc').value;
    const val = parseFloat(document.getElementById('exp-val').value);
    const qty = parseInt(document.getElementById('exp-qty').value) || 1;
    
    if(!desc || isNaN(val)) return alert("Preencha a descrição e o valor da despesa corretamente!");
    
    const expId = Date.now().toString();
    const exp = { id: expId, date, desc, val, qty, total: val * qty };
    
    db.ref('expenses/' + expId).set(exp)
        .then(() => {
            document.getElementById('exp-desc').value = ""; 
            document.getElementById('exp-val').value = "";
            alert("Despesa salva com sucesso!");
        })
        .catch(err => alert("Erro ao salvar despesa online: " + err));
}

function deleteExpense(id) {
    if(confirm("Excluir esta despesa permanentemente?")) {
        db.ref('expenses/' + id).remove();
    }
}

function renderExpenseTable() {
    const tbody = document.getElementById('expense-table-body');
    if(!tbody) return;
    tbody.innerHTML = "";
    expenses.forEach(e => {
        tbody.innerHTML += `<tr><td>${e.date.split('-').reverse().join('/')}</td><td>${e.desc}</td><td>${e.qty}</td><td>R$ ${parseFloat(e.total).toFixed(2)}</td><td><button onclick="deleteExpense('${e.id}')" style="background:red; color:white; border:none; border-radius:4px; padding:2px 5px; cursor:pointer;">X</button></td></tr>`;
    });
}

// ==========================================
// FILTROS, ESTATÍSTICAS E GRÁFICOS
// ==========================================
function reportToday() {
    const hoje = getLocalDate();
    document.getElementById('stats-from').value = hoje;
    document.getElementById('stats-to').value = hoje;
    generateStats();
}

function generateStats() {
    const from = document.getElementById('stats-from').value;
    const to = document.getElementById('stats-to').value;
    if(!from || !to) return alert("Selecione o período para gerar os relatórios!");
    
    const fOrders = orders.filter(o => o.date >= from && o.date <= to);
    const fExpenses = expenses.filter(e => e.date >= from && e.date <= to);

    let vlrPago = 0, vlrPend = 0, totalExp = 0, prods = {}, entregue = 0, nEntregue = 0;
    let payStats = { 'Pix': {q:0, v:0}, 'Dinheiro': {q:0, v:0}, 'Crédito': {q:0, v:0}, 'Débito': {q:0, v:0} };
    let week = { 'Dom':0, 'Seg':0, 'Ter':0, 'Qua':0, 'Qui':0, 'Sex':0, 'Sáb':0 };
    const weekMap = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

    fOrders.forEach(o => {
        const valOrder = parseFloat(o.value) || 0;
        if(o.isPaid==='Sim') vlrPago += valOrder; else vlrPend += valOrder;
        if(o.delivery==='Entregue') entregue++; else nEntregue++;
        if(payStats[o.payMethod]) { payStats[o.payMethod].q++; payStats[o.payMethod].v += valOrder; }
        
        if (o.items) {
            o.items.forEach(i => prods[i.name] = (prods[i.name]||0) + (parseInt(i.qty) || 1));
        }
        const d = new Date(o.date + "T00:00:00");
        week[weekMap[d.getDay()]] += valOrder;
    });

    fExpenses.forEach(e => totalExp += (parseFloat(e.total) || 0));
    let lucro = vlrPago - totalExp;

    if(document.getElementById('total-payment-value')) {
        document.getElementById('total-payment-value').innerText = `Vendas no Período: R$ ${(vlrPago + vlrPend).toFixed(2)}`;
    }
    const boxLucro = document.getElementById('lucro-total-box');
    if(boxLucro) {
        boxLucro.innerHTML = `Entradas (Pago): R$ ${vlrPago.toFixed(2)} | Despesas: R$ ${totalExp.toFixed(2)}<br><strong>LUCRO LÍQUIDO: R$ ${lucro.toFixed(2)}</strong>`;
        boxLucro.style.background = lucro >= 0 ? 'var(--success)' : 'var(--danger)';
    }

    if(typeof Chart !== 'undefined') {
        updateCharts(vlrPago, vlrPend, prods, entregue, nEntregue, payStats, totalExp, lucro, week);
    }
}

function updateCharts(pago, pend, prods, ent, nEnt, pay, tExp, lucro, week) {
    Object.values(charts).forEach(c => c.destroy());

    const configDatalabels = { anchor:'end', align:'top', formatter: (v)=> typeof v === 'number' ? 'R$ '+v.toFixed(2) : v };

    if(document.getElementById('chartLucro')) {
        charts.lucro = new Chart(document.getElementById('chartLucro'), {
            type:'bar', data:{ labels:['Entradas (Pago)', 'Despesas', 'Lucro Líquido'], datasets:[{data:[pago, tExp, lucro], backgroundColor:['#27ae60','#e74c3c','#3498db']}]},
            options: { plugins: { datalabels: configDatalabels }}
        });
    }

    if(document.getElementById('chartFinanceiro')) {
        charts.fin = new Chart(document.getElementById('chartFinanceiro'), {
            type:'pie', data:{ labels:['Pago','Pendente'], datasets:[{data:[pago, pend], backgroundColor:['#27ae60','#f1c40f']}]},
            options: { plugins: { datalabels: { color:'#fff', formatter: (v)=>'R$ '+parseFloat(v).toFixed(2) }}}
        });
    }

    if(document.getElementById('chartProdutos')) {
        charts.prd = new Chart(document.getElementById('chartProdutos'), {
            type:'bar', data:{ labels:Object.keys(prods), datasets:[{label:'Qtd', data:Object.values(prods), backgroundColor:'#3498db'}]},
            options: { plugins: { datalabels: { anchor:'end', align:'top' }}}
        });
    }

    if(document.getElementById('chartEntrega')) {
        charts.ent = new Chart(document.getElementById('chartEntrega'), {
            type:'doughnut', data:{ labels:['Entregue','Pendente'], datasets:[{data:[ent, nEnt], backgroundColor:['#7dc242','#e67e22']}]},
            options: { plugins: { datalabels: { color:'#fff' }}}
        });
    }

    if(document.getElementById('chartSemana')) {
        charts.sem = new Chart(document.getElementById('chartSemana'), {
            type:'line', data:{ labels:Object.keys(week), datasets:[{label:'R$', data:Object.values(week), borderColor:'#7dc242', fill:true, backgroundColor:'rgba(125,194,66,0.1)'}]},
            options: { plugins: { datalabels: configDatalabels }}
        });
    }

    if(document.getElementById('chartPagamento')) {
        charts.pay = new Chart(document.getElementById('chartPagamento'), {
            type:'bar', data:{ labels:Object.keys(pay), datasets:[{label:'Qtd', data:Object.values(pay).map(x=>x.q), backgroundColor:'#9b59b6'}, {label:'Valor (R$)', data:Object.values(pay).map(x=>x.v), backgroundColor:'#2ecc71'}]},
            options: { plugins: { datalabels: { anchor:'end', align:'top', formatter: (v, ctx)=> ctx.datasetIndex === 1 ? 'R$ '+parseFloat(v).toFixed(2) : v }}}
        });
    }
}

function cancelEdit() { resetForm(); }
