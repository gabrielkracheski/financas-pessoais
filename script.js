const form = document.getElementById("form-lancamento");
const lista = document.getElementById("lista-lancamentos");

let lancamentos = JSON.parse(localStorage.getItem("lancamentos")) || [];

function salvar() {
    localStorage.setItem("lancamentos", JSON.stringify(lancamentos));
}

function renderizar() {
    lista.innerHTML = "";

    lancamentos.forEach(function (item) {
        const linha = document.createElement("li");
        linha.textContent =
            item.data + " | " + item.descricao + " | " + item.categoria +
            " | " + item.tipo + " | R$ " + item.valor.toFixed(2) +
            " | " + item.forma;
        lista.appendChild(linha);
    });
}

const meses = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"
];

function calcularResumo() {
    const resumoPorMes = {};

    lancamentos.forEach(function (item) {
        const [ano, mes] = item.data.split("-");
        const chave = ano + "-" + mes;

        if (!resumoPorMes[chave]) {
            resumoPorMes[chave] = {
                ano: ano,
                mes: parseInt(mes) - 1,
                entradas: 0,
                saidas: 0
            };
        }

        if (item.tipo === "Entrada") {
            resumoPorMes[chave].entradas += item.valor;
        } else {
            resumoPorMes[chave].saidas += item.valor;
        }
    });

    return resumoPorMes;
}

function renderizarResumo() {
    const resumo = calcularResumo();
    const corpo = document.getElementById("corpo-resumo");
    corpo.innerHTML = "";

    const chaves = Object.keys(resumo).sort();

    chaves.forEach(function (chave) {
        const item = resumo[chave];
        const saldo = item.entradas - item.saidas;
        const situacao = saldo > 0 ? "🟢" : saldo < 0 ? "🔴" : "⚪";

        const linha = document.createElement("tr");
        linha.innerHTML =
            "<td>" + meses[item.mes] + "/" + item.ano + "</td>" +
            "<td>R$ " + item.entradas.toFixed(2) + "</td>" +
            "<td>R$ " + item.saidas.toFixed(2) + "</td>" +
            "<td>R$ " + saldo.toFixed(2) + "</td>" +
            "<td>" + situacao + "</td>";
        corpo.appendChild(linha);
    });
}

let grafico = null;

function preencherSeletorMeses() {
    const seletor = document.getElementById("mes-dashboard");
    const resumo = calcularResumo();
    const chaves = Object.keys(resumo).sort();

    const chaveSelecionada = seletor.value;
    seletor.innerHTML = "";

    chaves.forEach(function (chave) {
        const item = resumo[chave];
        const opcao = document.createElement("option");
        opcao.value = chave;
        opcao.textContent = meses[item.mes] + "/" + item.ano;
        seletor.appendChild(opcao);
    });

    if (chaves.includes(chaveSelecionada)) {
        seletor.value = chaveSelecionada;
    }
}

function calcularGastosPorCategoria(chaveMes) {
    const [ano, mes] = chaveMes.split("-");
    const porCategoria = {};

    lancamentos.forEach(function (item) {
        const [anoItem, mesItem] = item.data.split("-");
        if (anoItem === ano && mesItem === mes && item.tipo === "Saída") {
            porCategoria[item.categoria] = (porCategoria[item.categoria] || 0) + item.valor;
        }
    });

    return porCategoria;
}

function renderizarDashboard() {
    const seletor = document.getElementById("mes-dashboard");
    const chaveMes = seletor.value;
    if (!chaveMes) return;

    const dados = calcularGastosPorCategoria(chaveMes);
    const categorias = Object.keys(dados);
    const valores = categorias.map(function (cat) { return dados[cat]; });

    const ctx = document.getElementById("grafico-categorias");

    if (grafico) {
        grafico.destroy();
    }

    grafico = new Chart(ctx, {
        type: "pie",
        data: {
            labels: categorias,
            datasets: [{
                data: valores
            }]
        }
    });
}

document.getElementById("mes-dashboard").addEventListener("change", renderizarDashboard);

form.addEventListener("submit", function (evento) {
    evento.preventDefault();

    const lancamento = {
        data: document.getElementById("data").value,
        descricao: document.getElementById("descricao").value,
        categoria: document.getElementById("categoria").value,
        tipo: document.getElementById("tipo").value,
        valor: parseFloat(document.getElementById("valor").value),
        forma: document.getElementById("forma").value
    };

    lancamentos.push(lancamento);
    salvar();
    renderizar();
    renderizarResumo();
    preencherSeletorMeses();
    renderizarDashboard();
    form.reset();
});

renderizar();
renderizarResumo();
preencherSeletorMeses();
renderizarDashboard();