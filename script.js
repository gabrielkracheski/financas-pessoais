import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
    getFirestore,
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    query,
    where,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDkYOSD4sBg7_SxF0R9BmJ_LqxIrzkRQXE",
    authDomain: "financas-pessoais-f8d56.firebaseapp.com",
    projectId: "financas-pessoais-f8d56",
    storageBucket: "financas-pessoais-f8d56.firebasestorage.app",
    messagingSenderId: "401364657824",
    appId: "1:401364657824:web:cbe771ced21c80162d4bc5"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const telaLogin = document.getElementById("tela-login");
const telaApp = document.getElementById("tela-app");
const loginErro = document.getElementById("login-erro");

const botoesNav = document.querySelectorAll(".nav-item");
const secoes = document.querySelectorAll(".secao");

const botaoTema = document.getElementById("botao-tema");
const temaSalvo = localStorage.getItem("tema") || "claro";

document.documentElement.setAttribute("data-tema", temaSalvo);

botaoTema.addEventListener("click", function () {
    const temaAtual = document.documentElement.getAttribute("data-tema");
    const novoTema = temaAtual === "claro" ? "escuro" : "claro";

    document.documentElement.setAttribute("data-tema", novoTema);
    localStorage.setItem("tema", novoTema);
});

function mostrarSecao(nomeSecao) {
    secoes.forEach(function (secao) {
        secao.style.display = secao.id === "secao-" + nomeSecao ? "block" : "none";
    });

    botoesNav.forEach(function (botao) {
        botao.classList.toggle("ativo", botao.dataset.secao === nomeSecao);
    });
}

botoesNav.forEach(function (botao) {
    botao.addEventListener("click", function () {
        mostrarSecao(botao.dataset.secao);
    });
});

mostrarSecao("lancamentos");

document.getElementById("botao-entrar").addEventListener("click", function () {
    const email = document.getElementById("login-email").value;
    const senha = document.getElementById("login-senha").value;

    signInWithEmailAndPassword(auth, email, senha)
        .catch(function (erro) {
            loginErro.textContent = "E-mail ou senha inválidos.";
        });
});

document.getElementById("botao-criar-conta").addEventListener("click", function () {
    const email = document.getElementById("login-email").value;
    const senha = document.getElementById("login-senha").value;

    createUserWithEmailAndPassword(auth, email, senha)
        .catch(function (erro) {
            loginErro.textContent = erro.message;
        });
});

document.getElementById("botao-sair").addEventListener("click", function () {
    signOut(auth);
});

let lancamentos = [];
let pararDeEscutar = null;

onAuthStateChanged(auth, function (usuario) {
    if (usuario) {
        telaLogin.style.display = "none";
        telaApp.style.display = "block";

        const consulta = query(
            collection(db, "lancamentos"),
            where("uid", "==", usuario.uid)
        );

        pararDeEscutar = onSnapshot(consulta, function (snapshot) {
            lancamentos = snapshot.docs.map(function (documento) {
                return { id: documento.id, ...documento.data() };
            });

            renderizar();
            renderizarResumo();
            renderizarResumoAnual();
            preencherSeletorMeses();
            renderizarDashboard();
        });

    } else {
        telaLogin.style.display = "block";
        telaApp.style.display = "none";

        if (pararDeEscutar) {
            pararDeEscutar();
        }
        lancamentos = [];
    }
});

const form = document.getElementById("form-lancamento");
const lista = document.getElementById("lista-lancamentos");

const filtroDataInicio = document.getElementById("filtro-data-inicio");
const filtroDataFim = document.getElementById("filtro-data-fim");
const filtroCategoria = document.getElementById("filtro-categoria");
const filtroTipo = document.getElementById("filtro-tipo");
const filtroForma = document.getElementById("filtro-forma");
const botaoLimparFiltros = document.getElementById("botao-limpar-filtros");

const modal = document.getElementById("modal-lancamento");
const modalTitulo = document.getElementById("modal-titulo");
const botaoNovoLancamento = document.getElementById("botao-novo-lancamento");
const botaoFecharModal = document.getElementById("botao-fechar-modal");

filtroDataInicio.addEventListener("change", renderizar);
filtroDataFim.addEventListener("change", renderizar);
filtroCategoria.addEventListener("change", renderizar);
filtroTipo.addEventListener("change", renderizar);
filtroForma.addEventListener("change", renderizar);

botaoLimparFiltros.addEventListener("click", function () {
    filtroDataInicio.value = "";
    filtroDataFim.value = "";
    filtroCategoria.value = "";
    filtroTipo.value = "";
    filtroForma.value = "";
    renderizar();
});

async function excluirLancamento(indice) {
    const confirmar = confirm("Tem certeza que deseja excluir este lançamento?");
    if (!confirmar) return;

    const idDocumento = lancamentos[indice].id;
    await deleteDoc(doc(db, "lancamentos", idDocumento));
}

let indiceEmEdicao = null;

function abrirModal(titulo) {
    modalTitulo.textContent = titulo;
    modal.style.display = "flex";
}

function fecharModal() {
    modal.style.display = "none";
    form.reset();
    indiceEmEdicao = null;
    form.querySelector("button[type=submit]").textContent = "Adicionar";
}

botaoNovoLancamento.addEventListener("click", function () {
    abrirModal("Novo Lançamento");
});

botaoFecharModal.addEventListener("click", fecharModal);

modal.addEventListener("click", function (evento) {
    if (evento.target === modal) {
        fecharModal();
    }
});

function editarLancamento(indice) {
    const item = lancamentos[indice];

    document.getElementById("data").value = item.data;
    document.getElementById("descricao").value = item.descricao;
    document.getElementById("categoria").value = item.categoria;
    document.getElementById("tipo").value = item.tipo;
    document.getElementById("valor").value = item.valor;
    document.getElementById("forma").value = item.forma;

    indiceEmEdicao = indice;
    form.querySelector("button[type=submit]").textContent = "Salvar alteração";
    abrirModal("Editar Lançamento");
}

function formatarData(dataISO) {
    const [ano, mes, dia] = dataISO.split("-");
    return dia + "-" + mes + "-" + ano;
}

function renderizar() {
    lista.innerHTML = "";

    const dataInicio = filtroDataInicio.value;
    const dataFim = filtroDataFim.value;
    const categoriaEscolhida = filtroCategoria.value;
    const tipoEscolhido = filtroTipo.value;
    const formaEscolhida = filtroForma.value;

    const lancamentosFiltrados = lancamentos.filter(function (item) {
        const passaDataInicio = dataInicio === "" || item.data >= dataInicio;
        const passaDataFim = dataFim === "" || item.data <= dataFim;
        const passaCategoria = categoriaEscolhida === "" || item.categoria === categoriaEscolhida;
        const passaTipo = tipoEscolhido === "" || item.tipo === tipoEscolhido;
        const passaForma = formaEscolhida === "" || item.forma === formaEscolhida;
        return passaDataInicio && passaDataFim && passaCategoria && passaTipo && passaForma;
    });

    lancamentosFiltrados.forEach(function (item) {
        const linha = document.createElement("tr");

        const celulaData = document.createElement("td");
        celulaData.textContent = formatarData(item.data);

        const celulaDescricao = document.createElement("td");
        celulaDescricao.textContent = item.descricao;

        const celulaCategoria = document.createElement("td");
        celulaCategoria.textContent = item.categoria;

        const celulaTipo = document.createElement("td");
        celulaTipo.textContent = item.tipo;

        const celulaValor = document.createElement("td");
        celulaValor.textContent = "R$ " + item.valor.toFixed(2).replace(".", ",");

        const celulaForma = document.createElement("td");
        celulaForma.textContent = item.forma;

        const celulaAcoes = document.createElement("td");

        const botaoEditar = document.createElement("button");
        botaoEditar.textContent = "Editar";
        botaoEditar.addEventListener("click", function () {
            const indiceReal = lancamentos.indexOf(item);
            editarLancamento(indiceReal);
        });

        const botaoExcluir = document.createElement("button");
        botaoExcluir.textContent = "Excluir";
        botaoExcluir.addEventListener("click", function () {
            const indiceReal = lancamentos.indexOf(item);
            excluirLancamento(indiceReal);
        });

        celulaAcoes.appendChild(botaoEditar);
        celulaAcoes.appendChild(botaoExcluir);

        linha.appendChild(celulaData);
        linha.appendChild(celulaDescricao);
        linha.appendChild(celulaCategoria);
        linha.appendChild(celulaTipo);
        linha.appendChild(celulaValor);
        linha.appendChild(celulaForma);
        linha.appendChild(celulaAcoes);

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

    if (chaves.length > 0) {
        const chaveRecente = chaves[chaves.length - 1];
        const itemRecente = resumo[chaveRecente];
        const saldoRecente = itemRecente.entradas - itemRecente.saidas;

        document.getElementById("label-mes-atual").textContent =
            "Entradas (" + meses[itemRecente.mes] + "/" + itemRecente.ano + ")";
        document.getElementById("metrica-entradas-mes").textContent =
            "R$ " + itemRecente.entradas.toFixed(2).replace(".", ",");
        document.getElementById("metrica-saidas-mes").textContent =
            "R$ " + itemRecente.saidas.toFixed(2).replace(".", ",");
        document.getElementById("metrica-saldo-mes").textContent =
            "R$ " + saldoRecente.toFixed(2).replace(".", ",");
    }

    chaves.forEach(function (chave) {
        const item = resumo[chave];
        const saldo = item.entradas - item.saidas;

        const classeSituacao = saldo > 0 ? "badge-positivo" : saldo < 0 ? "badge-negativo" : "badge-neutro";
        const textoSituacao = saldo > 0 ? "Positivo" : saldo < 0 ? "Negativo" : "Neutro";

        const linha = document.createElement("tr");
        linha.innerHTML =
            "<td>" + meses[item.mes] + "/" + item.ano + "</td>" +
            "<td>R$ " + item.entradas.toFixed(2) + "</td>" +
            "<td>R$ " + item.saidas.toFixed(2) + "</td>" +
            "<td>R$ " + saldo.toFixed(2) + "</td>" +
            "<td><span class='badge " + classeSituacao + "'>" + textoSituacao + "</span></td>";
        corpo.appendChild(linha);
    });
}

function calcularResumoAnual() {
    const resumoPorAno = {};

    lancamentos.forEach(function (item) {
        const ano = item.data.split("-")[0];

        if (!resumoPorAno[ano]) {
            resumoPorAno[ano] = { entradas: 0, saidas: 0 };
        }

        if (item.tipo === "Entrada") {
            resumoPorAno[ano].entradas += item.valor;
        } else {
            resumoPorAno[ano].saidas += item.valor;
        }
    });

    return resumoPorAno;
}

function renderizarResumoAnual() {
    const resumo = calcularResumoAnual();
    const corpo = document.getElementById("corpo-resumo-anual");
    corpo.innerHTML = "";

    const anos = Object.keys(resumo).sort();

    anos.forEach(function (ano) {
        const item = resumo[ano];
        const saldo = item.entradas - item.saidas;

        const classeSituacao = saldo > 0 ? "badge-positivo" : saldo < 0 ? "badge-negativo" : "badge-neutro";
        const textoSituacao = saldo > 0 ? "Positivo" : saldo < 0 ? "Negativo" : "Neutro";

        const linha = document.createElement("tr");
        linha.innerHTML =
            "<td>" + ano + "</td>" +
            "<td>R$ " + item.entradas.toFixed(2) + "</td>" +
            "<td>R$ " + item.saidas.toFixed(2) + "</td>" +
            "<td>R$ " + saldo.toFixed(2) + "</td>" +
            "<td><span class='badge " + classeSituacao + "'>" + textoSituacao + "</span></td>";
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

    const categoriasOrdenadas = Object.keys(dados).sort(function (a, b) {
        return dados[b] - dados[a];
    });

    const categorias = categoriasOrdenadas;
    const valores = categoriasOrdenadas.map(function (cat) { return dados[cat]; });

    const total = valores.reduce(function (soma, valor) { return soma + valor; }, 0);
    const topCategoria = categorias.length > 0 ? categorias[0] : "-";

    document.getElementById("metrica-total").textContent =
        "R$ " + total.toFixed(2).replace(".", ",");
    document.getElementById("metrica-top-categoria").textContent = topCategoria;
    document.getElementById("metrica-num-categorias").textContent = categorias.length;

    const ctx = document.getElementById("grafico-categorias");

    if (grafico) {
        grafico.destroy();
    }

    grafico = new Chart(ctx, {
        type: "bar",
        data: {
            labels: categorias,
            datasets: [{
                label: "Gastos (R$)",
                data: valores,
                backgroundColor: "#2563eb",
                borderRadius: 6
            }]
        },
        options: {
            indexAxis: "y",
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function (contexto) {
                            return "R$ " + contexto.parsed.x.toFixed(2);
                        }
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    grid: { color: "rgba(148, 163, 184, 0.2)" },
                    ticks: {
                        callback: function (valor) {
                            return "R$ " + valor;
                        }
                    }
                },
                y: {
                    grid: { display: false }
                }
            }
        }
    });
}

document.getElementById("mes-dashboard").addEventListener("change", renderizarDashboard);

form.addEventListener("submit", async function (evento) {
    evento.preventDefault();

    const lancamento = {
        uid: auth.currentUser.uid,
        data: document.getElementById("data").value,
        descricao: document.getElementById("descricao").value,
        categoria: document.getElementById("categoria").value,
        tipo: document.getElementById("tipo").value,
        valor: parseFloat(document.getElementById("valor").value),
        forma: document.getElementById("forma").value
    };

    if (indiceEmEdicao === null) {
        await addDoc(collection(db, "lancamentos"), lancamento);
    } else {
        const idDocumento = lancamentos[indiceEmEdicao].id;
        await updateDoc(doc(db, "lancamentos", idDocumento), lancamento);
        indiceEmEdicao = null;
        form.querySelector("button[type=submit]").textContent = "Adicionar";
    }

    form.reset();
    fecharModal();
});

renderizar();
renderizarResumo();
renderizarResumoAnual();
preencherSeletorMeses();
renderizarDashboard();