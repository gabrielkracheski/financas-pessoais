/* ====================================================================
   FIREBASE: inicialização
   Importa só os módulos específicos que o site usa, direto do CDN do
   Google (sem bundler). apiKey não é secreta — quem protege os dados
   são as regras de segurança do Firestore (uid do usuário autenticado).
   ==================================================================== */
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

/* ====================================================================
   REFERÊNCIAS DE ELEMENTOS + TEMA + RESPONSIVIDADE
   Nota: em JavaScript, const/let precisam ser declaradas ANTES de
   serem usadas em qualquer addEventListener — por isso quase todas as
   referências de elementos ficam agrupadas no topo do arquivo.
   ==================================================================== */
const telaLogin = document.getElementById("tela-login");
const telaApp = document.getElementById("tela-app");
const loginErro = document.getElementById("login-erro");

const botoesNav = document.querySelectorAll(".nav-item");
const secoes = document.querySelectorAll(".secao");

const botaoTema = document.getElementById("botao-tema");
// Preferência de tema é só um dado de interface (não sensível como os
// lançamentos), então localStorage (por dispositivo) é suficiente aqui
const temaSalvo = localStorage.getItem("tema") || "claro";

const textoUsuarioLogado = document.getElementById("texto-usuario-logado");

// Seleção múltipla da tabela de Lançamentos (checkboxes + exclusão em massa)
const selecionarTodos = document.getElementById("selecionar-todos");
const textoTotalLancamentos = document.getElementById("texto-total-lancamentos");
const textoSelecionados = document.getElementById("texto-selecionados");
const botaoExcluirSelecionados = document.getElementById("botao-excluir-selecionados");

// Menu retrátil no celular (ver media query no CSS)
const botaoMenuMobile = document.getElementById("botao-menu-mobile");
const sidebar = document.querySelector(".sidebar");

botaoMenuMobile.addEventListener("click", function () {
    sidebar.classList.toggle("aberta");
});

// Set: guarda os IDs dos lançamentos marcados. Fonte única de verdade
// sobre "o que está selecionado" — sobrevive a re-renderizações e trocas
// de página (diferente de guardar o estado no próprio checkbox do DOM)
let selecionados = new Set();
// IDs visíveis na página atual, usado só pelo checkbox "selecionar todos"
let idsPaginaAtual = [];

// Aplica o tema salvo assim que a página carrega (antes de qualquer clique)
document.documentElement.setAttribute("data-tema", temaSalvo);

botaoTema.addEventListener("click", function () {
    const temaAtual = document.documentElement.getAttribute("data-tema");
    const novoTema = temaAtual === "claro" ? "escuro" : "claro";

    document.documentElement.setAttribute("data-tema", novoTema);
    localStorage.setItem("tema", novoTema);
});

// Formata qualquer valor numérico como moeda brasileira (ex: 1500 -> "R$ 1.500,00")
// Usada em todas as telas (Lançamentos, Resumos, Dashboard) para manter
// a formatação consistente num único lugar
function formatarMoeda(valor) {
    return "R$ " + valor.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// Controla qual <section> fica visível, com base no data-secao do botão
// clicado no menu lateral (ver HTML: <button data-secao="lancamentos">)
function mostrarSecao(nomeSecao) {
    secoes.forEach(function (secao) {
        secao.style.display = secao.id === "secao-" + nomeSecao ? "block" : "none";
    });

    botoesNav.forEach(function (botao) {
        botao.classList.toggle("ativo", botao.dataset.secao === nomeSecao);
    });
}

// Recalcula, a partir do Set "selecionados", o texto "X selecionado(s)",
// se o botão de excluir em massa deve estar habilitado, e se o checkbox
// "selecionar todos" deve aparecer marcado (só quando TODOS os itens da
// página atual já estão no Set)
function atualizarBarraSelecao() {
    const quantidade = selecionados.size;
    textoSelecionados.textContent = quantidade > 0 ? quantidade + " selecionado(s)" : "";
    botaoExcluirSelecionados.disabled = quantidade === 0;

    selecionarTodos.checked = idsPaginaAtual.length > 0 &&
        idsPaginaAtual.every(function (id) { return selecionados.has(id); });
}

botoesNav.forEach(function (botao) {
    botao.addEventListener("click", function () {
        mostrarSecao(botao.dataset.secao);
        sidebar.classList.remove("aberta"); // fecha o menu retrátil no celular ao navegar
    });
});

mostrarSecao("lancamentos"); // seção exibida por padrão ao carregar a página

/* ====================================================================
   AUTENTICAÇÃO (login / criar conta / sair)
   ==================================================================== */
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

/* ====================================================================
   ESTADO DOS LANÇAMENTOS + SINCRONIZAÇÃO EM TEMPO REAL
   "lancamentos" é preenchido exclusivamente pelo onSnapshot abaixo —
   nunca editado diretamente; toda alteração (criar/editar/excluir)
   passa pelo Firestore, que por sua vez dispara o onSnapshot de novo.
   ==================================================================== */
let lancamentos = [];
let pararDeEscutar = null; // referência para "desligar" a escuta ao deslogar

onAuthStateChanged(auth, function (usuario) {
    if (usuario) {
        telaLogin.style.display = "none";
        telaApp.style.display = "block";
        textoUsuarioLogado.textContent = usuario.email;

        // Só busca (e escuta) os documentos que pertencem a este usuário
        const consulta = query(
            collection(db, "lancamentos"),
            where("uid", "==", usuario.uid)
        );

        // onSnapshot = "escuta ao vivo": roda de novo automaticamente
        // toda vez que os dados mudam no Firestore, em qualquer dispositivo
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
            pararDeEscutar(); // evita continuar escutando dados de uma sessão encerrada
        }
        lancamentos = [];
    }
});

/* ====================================================================
   REFERÊNCIAS: FORMULÁRIO, PAGINAÇÃO, FILTROS, MODAL, IMPORTAÇÃO
   ==================================================================== */
const form = document.getElementById("form-lancamento");
const lista = document.getElementById("lista-lancamentos");

let paginaAtual = 1;
let itensPorPagina = 10; // let, não const: muda via seletor de itens por página
let indiceEmEdicao = null; // null = criando um novo; número = editando esse índice

const botaoPaginaAnterior = document.getElementById("botao-pagina-anterior");
const botaoPaginaProxima = document.getElementById("botao-pagina-proxima");
const textoPagina = document.getElementById("texto-pagina");
const seletorItensPorPagina = document.getElementById("itens-por-pagina");

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

const botaoImportar = document.getElementById("botao-importar");
const inputArquivoPlanilha = document.getElementById("input-arquivo-planilha");

const checkboxRepetirMensalmente = document.getElementById("repetir-mensalmente");
const grupoDataFim = document.getElementById("grupo-data-fim");
const inputDataFimRepeticao = document.getElementById("data-fim-repeticao");

/* ---------- Filtros: cada campo re-renderiza a lista ao mudar,
   sempre voltando para a página 1 (evita ficar "preso" numa página
   que deixou de existir depois de um filtro mais restritivo) ---------- */
filtroDataInicio.addEventListener("change", function () {
    paginaAtual = 1;
    renderizar();
});
filtroDataFim.addEventListener("change", function () {
    paginaAtual = 1;
    renderizar();
});
filtroCategoria.addEventListener("change", function () {
    paginaAtual = 1;
    renderizar();
});
filtroTipo.addEventListener("change", function () {
    paginaAtual = 1;
    renderizar();
});
filtroForma.addEventListener("change", function () {
    paginaAtual = 1;
    renderizar();
});

/* ---------- Paginação ---------- */
botaoPaginaAnterior.addEventListener("click", function () {
    paginaAtual--;
    renderizar();
});

botaoPaginaProxima.addEventListener("click", function () {
    paginaAtual++;
    renderizar();
});

seletorItensPorPagina.addEventListener("change", function () {
    itensPorPagina = parseInt(seletorItensPorPagina.value);
    paginaAtual = 1;
    renderizar();
});

botaoLimparFiltros.addEventListener("click", function () {
    filtroDataInicio.value = "";
    filtroDataFim.value = "";
    filtroCategoria.value = "";
    filtroTipo.value = "";
    filtroForma.value = "";
    paginaAtual = 1;
    renderizar();
});

/* ---------- Exclusão individual ---------- */
async function excluirLancamento(indice) {
    const confirmar = confirm("Tem certeza que deseja excluir este lançamento?");
    if (!confirmar) return;

    const idDocumento = lancamentos[indice].id;
    await deleteDoc(doc(db, "lancamentos", idDocumento));
    // Não precisa chamar renderizar() aqui: o onSnapshot detecta a
    // exclusão no Firestore e atualiza a tela sozinho
}

/* ---------- Modal: reaproveitado tanto para criar quanto editar ---------- */
// permitirRepeticao: só true ao abrir para um lançamento NOVO — não faz
// sentido "repetir mensalmente" ao editar um lançamento já existente
function abrirModal(titulo, permitirRepeticao) {
    modalTitulo.textContent = titulo;
    modal.style.display = "flex";
    checkboxRepetirMensalmente.parentElement.style.display = permitirRepeticao ? "flex" : "none";
}

function fecharModal() {
    modal.style.display = "none";
    form.reset();
    indiceEmEdicao = null;
    form.querySelector("button[type=submit]").textContent = "Adicionar";
}

/* ---------- Importação de planilha ---------- */
// O Excel entrega células de data já como objeto Date (por causa da opção
// { cellDates: true } no XLSX.read) — aqui convertemos para o formato
// AAAA-MM-DD que o resto do site usa internamente
function converterDataParaISO(valorData) {
    if (valorData instanceof Date) {
        const ano = valorData.getFullYear();
        const mes = String(valorData.getMonth() + 1).padStart(2, "0");
        const dia = String(valorData.getDate()).padStart(2, "0");
        return ano + "-" + mes + "-" + dia;
    }
    return valorData; // já veio como texto: devolve sem alterar
}

// O <input type="file"> real fica escondido (display: none no HTML);
// clicamos nele programaticamente ao clicar no botão "visível"
botaoImportar.addEventListener("click", function () {
    inputArquivoPlanilha.click();
});

checkboxRepetirMensalmente.addEventListener("change", function () {
    grupoDataFim.style.display = checkboxRepetirMensalmente.checked ? "block" : "none";
});

inputArquivoPlanilha.addEventListener("change", async function (evento) {
    const arquivo = evento.target.files[0];
    if (!arquivo) return;

    const dadosArquivo = await arquivo.arrayBuffer();
    const planilha = XLSX.read(dadosArquivo, { cellDates: true });

    // O nome "Lancamentos" precisa bater exatamente com o nome da aba no arquivo
    const abaLancamentos = planilha.Sheets["Lancamentos"];
    const linhas = XLSX.utils.sheet_to_json(abaLancamentos);

    const confirmar = confirm("Foram encontradas " + linhas.length + " linhas. Deseja importar todas para o Firestore?");
    if (!confirmar) return;

    for (const linha of linhas) {

        // Pula linhas em branco/incompletas (evita gravar documentos
        // com campos undefined, que o Firestore rejeita e travaria o loop)
        if (!linha["Data"] || !linha["Descrição"]) {
            continue;
        }

        const lancamento = {
            uid: auth.currentUser.uid,
            data: converterDataParaISO(linha["Data"]),
            descricao: linha["Descrição"],
            categoria: linha["Categoria"],
            tipo: linha["Tipo"],
            valor: linha["Valor"],
            forma: linha["Forma de Pagamento"]
        };

        // Gravação uma linha de cada vez (await dentro do loop) — mais
        // lento que disparar tudo de uma vez, mas mais fácil de depurar
        await addDoc(collection(db, "lancamentos"), lancamento);
    }

    alert("Importação concluída!");
    inputArquivoPlanilha.value = ""; // permite escolher o mesmo arquivo de novo depois
});

botaoNovoLancamento.addEventListener("click", function () {
    abrirModal("Novo Lançamento", true);
});

botaoFecharModal.addEventListener("click", fecharModal);

// Fecha o modal ao clicar na área escurecida fora do card (mas não ao
// clicar dentro do formulário) — checagem via evento.target === modal
modal.addEventListener("click", function (evento) {
    if (evento.target === modal) {
        fecharModal();
    }
});

/* ---------- Editar: preenche o formulário com os dados do item clicado ---------- */
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
    abrirModal("Editar Lançamento", false);
}

/* ---------- Lançamento recorrente (repetir mensalmente) ----------
   Gera um array de datas ISO (AAAA-MM-DD), uma por mês, do início ao fim */
function gerarDatasMensais(dataInicioISO, dataFimISO) {
    const datas = [];
    const [anoIni, mesIni, diaIni] = dataInicioISO.split("-").map(Number);
    const dataFim = new Date(dataFimISO + "T00:00:00");

    let ano = anoIni;
    let mes = mesIni;

    while (true) {
        // new Date(ano, mes, 0) = "dia 0 do próximo mês" = truque para
        // pegar o último dia do mês ATUAL, sem tabela manual de dias por mês
        const ultimoDiaDoMes = new Date(ano, mes, 0).getDate();
        // Protege contra dia inválido (ex: começar dia 31 e cair num
        // mês de 28/29/30 dias) — "encolhe" para o último dia disponível
        const dia = Math.min(diaIni, ultimoDiaDoMes);
        const dataAtual = new Date(ano, mes - 1, dia);

        if (dataAtual > dataFim) break; // condição de parada do loop

        const anoStr = ano;
        const mesStr = String(mes).padStart(2, "0");
        const diaStr = String(dia).padStart(2, "0");
        datas.push(anoStr + "-" + mesStr + "-" + diaStr);

        mes++;
        if (mes > 12) { // vira o ano quando passa de dezembro
            mes = 1;
            ano++;
        }
    }

    return datas;
}

// Só para EXIBIÇÃO na tabela (DD-MM-AAAA); o dado internamente continua
// em AAAA-MM-DD, formato necessário para os filtros/comparações de data
function formatarData(dataISO) {
    const [ano, mes, dia] = dataISO.split("-");
    return dia + "-" + mes + "-" + ano;
}

/* ====================================================================
   RENDERIZAÇÃO: TABELA DE LANÇAMENTOS
   Fluxo: filtra -> ordena -> pagina -> desenha as linhas -> atualiza
   contadores. Chamada sempre que "lancamentos" muda (via onSnapshot)
   ou quando filtro/página/seleção mudam.
   ==================================================================== */
function renderizar() {
    lista.innerHTML = "";

    const dataInicio = filtroDataInicio.value;
    const dataFim = filtroDataFim.value;
    const categoriaEscolhida = filtroCategoria.value;
    const tipoEscolhido = filtroTipo.value;
    const formaEscolhida = filtroForma.value;

    // Datas em formato AAAA-MM-DD podem ser comparadas como texto
    // (>=, <=) e o resultado bate com a ordem cronológica real
    const lancamentosFiltrados = lancamentos.filter(function (item) {
        const passaDataInicio = dataInicio === "" || item.data >= dataInicio;
        const passaDataFim = dataFim === "" || item.data <= dataFim;
        const passaCategoria = categoriaEscolhida === "" || item.categoria === categoriaEscolhida;
        const passaTipo = tipoEscolhido === "" || item.tipo === tipoEscolhido;
        const passaForma = formaEscolhida === "" || item.forma === formaEscolhida;
        return passaDataInicio && passaDataFim && passaCategoria && passaTipo && passaForma;
    }).sort(function (a, b) {
        return b.data.localeCompare(a.data); // mais recente primeiro
    });

    const totalPaginas = Math.max(1, Math.ceil(lancamentosFiltrados.length / itensPorPagina));

    // Evita ficar numa página que deixou de existir (ex: filtro reduziu o total)
    if (paginaAtual > totalPaginas) {
        paginaAtual = totalPaginas;
    }

    const inicio = (paginaAtual - 1) * itensPorPagina;
    const fim = inicio + itensPorPagina;
    const lancamentosDaPagina = lancamentosFiltrados.slice(inicio, fim);

    textoPagina.textContent = "Página " + paginaAtual + " de " + totalPaginas;
    botaoPaginaAnterior.disabled = paginaAtual === 1;
    botaoPaginaProxima.disabled = paginaAtual === totalPaginas;

    lancamentosDaPagina.forEach(function (item) {
        const linha = document.createElement("tr");

        // Checkbox de seleção: nasce marcado/desmarcado consultando o
        // Set "selecionados" — ele é sempre a fonte da verdade, não o DOM
        const celulaSelecionar = document.createElement("td");
        const checkboxLinha = document.createElement("input");
        checkboxLinha.type = "checkbox";
        checkboxLinha.checked = selecionados.has(item.id);
        checkboxLinha.addEventListener("change", function () {
            if (checkboxLinha.checked) {
                selecionados.add(item.id);
            } else {
                selecionados.delete(item.id);
            }
            atualizarBarraSelecao();
        });
        celulaSelecionar.appendChild(checkboxLinha);

        const celulaData = document.createElement("td");
        celulaData.textContent = formatarData(item.data);

        const celulaDescricao = document.createElement("td");
        celulaDescricao.textContent = item.descricao;

        const celulaCategoria = document.createElement("td");
        celulaCategoria.textContent = item.categoria;

        const celulaTipo = document.createElement("td");
        celulaTipo.textContent = item.tipo;

        const celulaValor = document.createElement("td");
        celulaValor.textContent = formatarMoeda(item.valor);
        const celulaForma = document.createElement("td");
        celulaForma.textContent = item.forma;

        const celulaAcoes = document.createElement("td");

        const botaoEditar = document.createElement("button");
        botaoEditar.textContent = "Editar";
        botaoEditar.addEventListener("click", function () {
            // Usa indexOf no array ORIGINAL (não no filtrado) — essencial
            // para editar/excluir o item certo mesmo com filtro ativo
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

        linha.appendChild(celulaSelecionar);
        linha.appendChild(celulaData);
        linha.appendChild(celulaDescricao);
        linha.appendChild(celulaCategoria);
        linha.appendChild(celulaTipo);
        linha.appendChild(celulaValor);
        linha.appendChild(celulaForma);
        linha.appendChild(celulaAcoes);

        lista.appendChild(linha);
    });

    atualizarBarraSelecao();

    idsPaginaAtual = lancamentosDaPagina.map(function (item) { return item.id; });
    textoTotalLancamentos.textContent = "Total: " + lancamentosFiltrados.length + " lançamento(s)";

}

/* ====================================================================
   RESUMO MENSAL / ANUAL
   Agrupam os lançamentos por chave (ano-mês, ou só ano) somando
   entradas/saídas — mesmo padrão de "acumulador" nas duas funções.
   ==================================================================== */
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
                mes: parseInt(mes) - 1, // -1: índice do array "meses" começa em 0
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

    // Chaves no formato "AAAA-MM" ordenam corretamente como texto
    const chaves = Object.keys(resumo).sort();

    // Cards do topo: sempre mostram o mês atual
    const hoje = new Date();
    const anoAtual = hoje.getFullYear();
    const mesAtualIndice = hoje.getMonth(); // 0 a 11
    const chaveMesAtual = anoAtual + "-" + String(mesAtualIndice + 1).padStart(2, "0");

    const itemMesAtual = resumo[chaveMesAtual] || { entradas: 0, saidas: 0 };
    const saldoMesAtual = itemMesAtual.entradas - itemMesAtual.saidas;

    document.getElementById("label-mes-atual").textContent =
        "Entradas (" + meses[mesAtualIndice] + "/" + anoAtual + ")";
    document.getElementById("metrica-entradas-mes").textContent =
        formatarMoeda(itemMesAtual.entradas);
    document.getElementById("metrica-saidas-mes").textContent =
        formatarMoeda(itemMesAtual.saidas);
    document.getElementById("metrica-saldo-mes").textContent =
        formatarMoeda(saldoMesAtual);

    chaves.forEach(function (chave) {
        const item = resumo[chave];
        const saldo = item.entradas - item.saidas;

        const classeSituacao = saldo > 0 ? "badge-positivo" : saldo < 0 ? "badge-negativo" : "badge-neutro";
        const textoSituacao = saldo > 0 ? "Positivo" : saldo < 0 ? "Negativo" : "Neutro";

        const linha = document.createElement("tr");
        linha.innerHTML =
            "<td>" + meses[item.mes] + "/" + item.ano + "</td>" +
            "<td>" + formatarMoeda(item.entradas) + "</td>" +
            "<td>" + formatarMoeda(item.saidas) + "</td>" +
            "<td>" + formatarMoeda(saldo) + "</td>" +
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
            "<td>" + formatarMoeda(item.entradas) + "</td>" +
            "<td>" + formatarMoeda(item.saidas) + "</td>" +
            "<td>" + formatarMoeda(saldo) + "</td>" +
            "<td><span class='badge " + classeSituacao + "'>" + textoSituacao + "</span></td>";
        corpo.appendChild(linha);
    });
}

/* ====================================================================
   DASHBOARD (gráfico de gastos por categoria)
   ==================================================================== */
let grafico = null; // referência ao gráfico atual, para poder destruí-lo
// antes de desenhar um novo (Chart.js exige isso)

// Preenche o <select> de mês/ano com base nos meses que têm lançamentos
function preencherSeletorMeses() {
    const seletor = document.getElementById("mes-dashboard");
    const resumo = calcularResumo();
    const chaves = Object.keys(resumo).sort();

    const chaveSelecionada = seletor.value; // preserva a seleção atual, se possível
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

// Filtra por ano+mês exatos e só considera Saídas (o Dashboard não mostra Entradas)
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
    if (!chaveMes) return; // nenhum mês disponível ainda (sem lançamentos)

    const dados = calcularGastosPorCategoria(chaveMes);

    // Ordena da maior para a menor categoria de gasto
    const categoriasOrdenadas = Object.keys(dados).sort(function (a, b) {
        return dados[b] - dados[a];
    });

    const categorias = categoriasOrdenadas;
    const valores = categoriasOrdenadas.map(function (cat) { return dados[cat]; });

    const total = valores.reduce(function (soma, valor) { return soma + valor; }, 0);
    const topCategoria = categorias.length > 0 ? categorias[0] : "-";

    document.getElementById("metrica-total").textContent =
        formatarMoeda(total);
    document.getElementById("metrica-top-categoria").textContent = topCategoria;
    document.getElementById("metrica-num-categorias").textContent = categorias.length;

    const ctx = document.getElementById("grafico-categorias");

    if (grafico) {
        grafico.destroy(); // evita erro do Chart.js ao redesenhar no mesmo canvas
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
            indexAxis: "y", // barras horizontais (melhor para nomes de categoria longos)
            plugins: {
                legend: { display: false }, // só 1 série de dados: legenda seria redundante
                tooltip: {
                    callbacks: {
                        label: function (contexto) {
                            return formatarMoeda(contexto.parsed.x);
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
                            return formatarMoeda(valor);
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

/* ====================================================================
   SELEÇÃO EM MASSA: "selecionar todos" + exclusão
   ==================================================================== */
selecionarTodos.addEventListener("change", function () {
    // Marca/desmarca só os IDs da PÁGINA ATUAL (não todos os filtrados)
    idsPaginaAtual.forEach(function (id) {
        if (selecionarTodos.checked) {
            selecionados.add(id);
        } else {
            selecionados.delete(id);
        }
    });
    renderizar();
});

botaoExcluirSelecionados.addEventListener("click", async function () {
    const confirmar = confirm("Excluir " + selecionados.size + " lançamento(s) selecionado(s)? Esta ação não pode ser desfeita.");
    if (!confirmar) return;

    // for...of funciona em qualquer iterável, incluindo Set (que não
    // tem .forEach com a mesma assinatura simples dos arrays)
    for (const id of selecionados) {
        await deleteDoc(doc(db, "lancamentos", id));
    }

    selecionados.clear();
    // Não precisa renderizar() manualmente: o onSnapshot detecta as
    // exclusões e atualiza a tela sozinho
});

document.getElementById("mes-dashboard").addEventListener("change", renderizarDashboard);

/* ====================================================================
   ENVIO DO FORMULÁRIO (criar, editar, ou criar em série/repetição)
   ==================================================================== */
form.addEventListener("submit", async function (evento) {
    evento.preventDefault(); // evita o comportamento padrão de recarregar a página

    // Dados comuns a todos os casos (novo, edição, ou cada cópia de uma repetição)
    const dadosBase = {
        uid: auth.currentUser.uid,
        descricao: document.getElementById("descricao").value,
        categoria: document.getElementById("categoria").value,
        tipo: document.getElementById("tipo").value,
        valor: parseFloat(document.getElementById("valor").value),
        forma: document.getElementById("forma").value
    };

    const dataInicio = document.getElementById("data").value;

    if (indiceEmEdicao === null) {
        // Criando um lançamento novo (ou vários, se repetição estiver marcada)
        if (checkboxRepetirMensalmente.checked && inputDataFimRepeticao.value) {
            const datas = gerarDatasMensais(dataInicio, inputDataFimRepeticao.value);

            if (datas.length === 0) {
                alert("A data final precisa ser igual ou posterior à data inicial.");
                return; // interrompe sem fechar o modal, para o usuário corrigir
            }

            for (const data of datas) {
                // spread (...dadosBase) copia os campos comuns; "data" é
                // sobrescrita para cada mês gerado
                await addDoc(collection(db, "lancamentos"), { ...dadosBase, data: data });
            }
        } else {
            await addDoc(collection(db, "lancamentos"), { ...dadosBase, data: dataInicio });
        }
    } else {
        // Editando um lançamento existente: atualiza o documento pelo ID salvo
        const idDocumento = lancamentos[indiceEmEdicao].id;
        await updateDoc(doc(db, "lancamentos", idDocumento), { ...dadosBase, data: dataInicio });
        indiceEmEdicao = null;
        form.querySelector("button[type=submit]").textContent = "Adicionar";
    }

    checkboxRepetirMensalmente.checked = false;
    grupoDataFim.style.display = "none";
    form.reset();
    fecharModal();
});

/* ====================================================================
   CHAMADAS INICIAIS
   Garantem que a tela já mostre algo mesmo antes do primeiro onSnapshot
   responder (ex: "Página 1 de 1", tabelas vazias formatadas) — o
   onSnapshot, quando chegar, chama todas essas funções de novo com os
   dados reais.
   ==================================================================== */
renderizar();
renderizarResumo();
renderizarResumoAnual();
preencherSeletorMeses();
renderizarDashboard();