// ============================================================
// EFEITO ESTUFA — MONITORAMENTO
// Controle das cápsulas, WebSocket e gráfico
// ============================================================


// ============================================================
// CONFIGURAÇÃO
// ============================================================

const ENDERECO_WEBSOCKET =
    "wss://nobreciencia.lilolilo09666.workers.dev/api/ws";

const COR_CAPSULA_1 = "#0B2545";
const COR_CAPSULA_2 = "#F59E0B";

// Limite de pontos desenhados por linha (downsampling)
const MAX_PONTOS_LINHA = 420;
// Raio da média móvel usada para suavizar (em pontos)
const RAIO_SUAVIZACAO = 3;


// ============================================================
// ESTADO DO EXPERIMENTO
// ============================================================

let etapa = "aguardando1";

let dadosCapsula1 = [];
let dadosCapsula2 = [];

let inicioRealCapsula1 = null;
let inicioRealCapsula2 = null;

let duracaoCapsula1 = null;
let duracaoCapsula2 = null;

let tempoParadoCapsula1 = null;
let tempoParadoCapsula2 = null;

let temperaturaFinalCapsula1 = null;
let temperaturaFinalCapsula2 = null;

let temperaturaAtual = null;
let totalLeituras = 0;

let temporizadorCapsula2 = null;

let ws = null;
let reconexaoTimer = null;

let emReprise = false;
let repriseInicio = null;
let repriseAnimacao = null;
let repriseDuracaoTotal = 0;


// ============================================================
// ELEMENTOS
// ============================================================

const canvas = document.getElementById("graph");
const ctx = canvas ? canvas.getContext("2d") : null;

const statusIndicador = document.getElementById("statusIndicador");
const statusTexto     = document.getElementById("statusTexto");
const statusLive      = document.getElementById("statusLive");

const temperatura1     = document.getElementById("temperatura1");
const tempoAtual       = document.getElementById("tempoAtual");
const quantidadeLeituras = document.getElementById("quantidadeLeituras");

const estadoExperimento  = document.getElementById("estadoExperimento");
const descricaoControle  = document.getElementById("descricaoControle");

const botaoIniciar    = document.getElementById("iniciar");
const botaoParar      = document.getElementById("parar");
const botaoIniciar2   = document.getElementById("iniciar2");
const botaoParar2     = document.getElementById("parar2");
const botaoReprise    = document.getElementById("reprise");
const botaoNovaSessao = document.getElementById("novaSessao");


// ============================================================
// UTILIDADES
// ============================================================

function numeroValido(valor) {
    return typeof valor === "number" && Number.isFinite(valor);
}

function formatarTemperatura(valor) {
    if (!numeroValido(valor)) return "--";
    return valor.toFixed(2).replace(".", ",") + " °C";
}

function formatarTempo(segundos) {
    if (!numeroValido(segundos)) return "0,0 s";
    return segundos.toFixed(1).replace(".", ",") + " s";
}

// Arredonda o tempo máximo do eixo X para "saltos" bonitos.
// Isso evita o efeito de o eixo ficar respirando a cada frame
// durante a cápsula 1.
function arredondarTempoMaximo(valor) {
    if (valor <= 10) return 10;
    if (valor <= 20) return 20;
    if (valor <= 30) return 30;
    if (valor <= 60) return 60;
    if (valor <= 90) return 90;
    if (valor <= 120) return 120;
    if (valor <= 180) return 180;
    if (valor <= 240) return 240;
    if (valor <= 300) return 300;
    if (valor <= 600) return 600;
    return Math.ceil(valor / 60) * 60;
}

function atualizarInterface() {
    if (temperatura1) {
        temperatura1.innerHTML =
            numeroValido(temperaturaAtual)
                ? temperaturaAtual.toFixed(2).replace(".", ",") +
                  ' <small>°C</small>'
                : '-- <small>°C</small>';
    }
    if (quantidadeLeituras) {
        quantidadeLeituras.textContent = totalLeituras;
    }
}


// ============================================================
// STATUS
// ============================================================

function atualizarStatus(texto, tipo = "normal") {
    if (statusTexto) statusTexto.textContent = texto;
    if (!statusIndicador) return;

    statusIndicador.classList.remove("online", "offline", "processando");

    if (tipo === "online")      statusIndicador.classList.add("online");
    if (tipo === "offline")     statusIndicador.classList.add("offline");
    if (tipo === "processando") statusIndicador.classList.add("processando");
}

function atualizarEstadoExperimento() {
    if (!estadoExperimento) return;

    estadoExperimento.classList.remove("ativo", "finalizado");

    if (etapa === "aguardando1") {
        estadoExperimento.textContent = "Aguardando início da Cápsula 1";
    }
    else if (etapa === "capsula1") {
        estadoExperimento.textContent = "Cápsula 1 em andamento";
        estadoExperimento.classList.add("ativo");
    }
    else if (etapa === "aguardando2") {
        estadoExperimento.textContent = "Pronto para iniciar a Cápsula 2";
    }
    else if (etapa === "capsula2") {
        estadoExperimento.textContent = "Cápsula 2 em andamento";
        estadoExperimento.classList.add("ativo");
    }
    else if (etapa === "finalizado") {
        estadoExperimento.textContent = "Experimento finalizado";
        estadoExperimento.classList.add("finalizado");
    }
}


// ============================================================
// WEBSOCKET
// ============================================================

function conectarWebSocket() {

    if (ws) {
        try { ws.close(); } catch (e) { /* noop */ }
    }

    atualizarStatus("Conectando ao sistema...", "processando");

    ws = new WebSocket(ENDERECO_WEBSOCKET);

    ws.onopen = function () {
        console.log("WebSocket conectado!");
        atualizarStatus("Sistema conectado", "online");
        if (statusLive) {
            statusLive.textContent = "LIVE";
            statusLive.classList.add("visivel");
        }
    };

    ws.onmessage = function (evento) {
        processarTemperatura(evento.data);
    };

    ws.onerror = function (erro) {
        console.error("Erro no WebSocket:", erro);
        atualizarStatus("Erro na conexão", "offline");
    };

    ws.onclose = function () {
        console.log("WebSocket desconectado.");
        atualizarStatus("Reconectando...", "offline");
        if (statusLive) {
            statusLive.textContent = "OFFLINE";
            statusLive.classList.add("visivel");
        }

        if (!reconexaoTimer) {
            reconexaoTimer = setTimeout(function () {
                reconexaoTimer = null;
                conectarWebSocket();
            }, 3000);
        }
    };
}


// ============================================================
// PROCESSAMENTO DA TEMPERATURA
// ============================================================

function processarTemperatura(mensagem) {

    let dados;
    try { dados = JSON.parse(mensagem); }
    catch (e) { console.error("Mensagem inválida:", mensagem); return; }

    const temperatura = Number(dados.temperatura);
    if (!Number.isFinite(temperatura)) return;

    temperaturaAtual = temperatura;
    atualizarInterface();

    if (etapa !== "capsula1" && etapa !== "capsula2") return;

    let inicioAtual, dadosAtual;
    if (etapa === "capsula1") {
        inicioAtual = inicioRealCapsula1;
        dadosAtual  = dadosCapsula1;
    } else {
        inicioAtual = inicioRealCapsula2;
        dadosAtual  = dadosCapsula2;
    }

    if (inicioAtual === null) return;

    const agora = performance.now();
    const tempo = (agora - inicioAtual) / 1000;

    let duracaoLimite = null;
    if (etapa === "capsula1")      duracaoLimite = null;
    else if (etapa === "capsula2") duracaoLimite = duracaoCapsula2;

    if (duracaoLimite !== null && tempo > duracaoLimite) return;

    dadosAtual.push({ tempo: tempo, temperatura: temperatura });

    totalLeituras++;
    atualizarInterface();

    if (tempoAtual) tempoAtual.innerHTML =
        tempo.toFixed(1).replace(".", ",") + ' <small>s</small>';

    desenharGrafico();
}


// ============================================================
// INICIAR CÁPSULA 1
// ============================================================

function iniciarCapsula1() {

    if (etapa !== "aguardando1" && etapa !== "finalizado") return;

    pararReprise();

    dadosCapsula1 = [];
    dadosCapsula2 = [];

    inicioRealCapsula1 = performance.now();
    inicioRealCapsula2 = null;

    duracaoCapsula1 = null;
    duracaoCapsula2 = null;

    tempoParadoCapsula1 = null;
    tempoParadoCapsula2 = null;

    temperaturaFinalCapsula1 = null;
    temperaturaFinalCapsula2 = null;

    totalLeituras = 0;
    etapa = "capsula1";

    if (botaoIniciar)  botaoIniciar.disabled = true;
    if (botaoParar)    botaoParar.disabled = false;
    if (botaoIniciar2) botaoIniciar2.disabled = true;
    if (botaoParar2)   botaoParar2.disabled = true;
    if (botaoReprise)  botaoReprise.disabled = true;

    atualizarStatus("Cápsula 1 em andamento", "online");
    atualizarEstadoExperimento();

    if (descricaoControle) {
        descricaoControle.textContent =
            "A cápsula 1 está sendo monitorada. Pressione “Parar” quando a etapa terminar.";
    }

    atualizarInterface();
    desenharGrafico();
}


// ============================================================
// PARAR CÁPSULA 1
// ============================================================

function pararCapsula1() {

    if (etapa !== "capsula1") return;

    const agora = performance.now();
    duracaoCapsula1 = (agora - inicioRealCapsula1) / 1000;
    tempoParadoCapsula1 = agora;

    if (dadosCapsula1.length > 0) {
        temperaturaFinalCapsula1 =
            dadosCapsula1[dadosCapsula1.length - 1].temperatura;
    }

    etapa = "aguardando2";

    if (botaoIniciar)  botaoIniciar.disabled = true;
    if (botaoParar)    botaoParar.disabled = true;
    if (botaoIniciar2) botaoIniciar2.disabled = false;
    if (botaoParar2)   botaoParar2.disabled = true;

    atualizarStatus("Cápsula 1 finalizada", "online");
    atualizarEstadoExperimento();

    if (descricaoControle) {
        descricaoControle.textContent =
            "Cápsula 1 concluída em " + formatarTempo(duracaoCapsula1) +
            ". A Cápsula 2 usará exatamente esta duração.";
    }

    desenharGrafico();
}


// ============================================================
// INICIAR CÁPSULA 2
// ============================================================

function iniciarCapsula2() {

    if (etapa !== "aguardando2") return;
    if (duracaoCapsula1 === null || duracaoCapsula1 <= 0) return;

    dadosCapsula2 = [];
    inicioRealCapsula2 = performance.now();
    duracaoCapsula2 = duracaoCapsula1;

    tempoParadoCapsula2 = null;
    temperaturaFinalCapsula2 = null;

    etapa = "capsula2";

    if (botaoIniciar2) botaoIniciar2.disabled = true;
    if (botaoParar2)   botaoParar2.disabled = false;
    if (botaoReprise)  botaoReprise.disabled = true;

    atualizarStatus("Cápsula 2 em andamento", "online");
    atualizarEstadoExperimento();

    if (descricaoControle) {
        descricaoControle.textContent =
            "Cápsula 2 iniciada. Ela será encerrada automaticamente após " +
            formatarTempo(duracaoCapsula2) + ".";
    }

    desenharGrafico();

    if (temporizadorCapsula2) clearTimeout(temporizadorCapsula2);
    temporizadorCapsula2 = setTimeout(pararCapsula2, duracaoCapsula2 * 1000);
}


// ============================================================
// PARAR CÁPSULA 2
// ============================================================

function pararCapsula2() {

    if (etapa !== "capsula2") return;

    if (temporizadorCapsula2) {
        clearTimeout(temporizadorCapsula2);
        temporizadorCapsula2 = null;
    }

    const agora = performance.now();
    const tempoDecorrido = (agora - inicioRealCapsula2) / 1000;

    tempoParadoCapsula2 = agora;
    duracaoCapsula2 = Math.min(tempoDecorrido, duracaoCapsula1);

    dadosCapsula2 = dadosCapsula2.filter(p => p.tempo <= duracaoCapsula2);

    if (dadosCapsula2.length > 0) {
        temperaturaFinalCapsula2 =
            dadosCapsula2[dadosCapsula2.length - 1].temperatura;
    }

    etapa = "finalizado";

    if (botaoIniciar2) botaoIniciar2.disabled = true;
    if (botaoParar2)   botaoParar2.disabled = true;
    if (botaoReprise)  botaoReprise.disabled = false;

    atualizarStatus("Experimento finalizado", "online");
    atualizarEstadoExperimento();

    if (descricaoControle) {
        descricaoControle.textContent =
            "As duas cápsulas foram concluídas. Você pode iniciar a reprise para " +
            "visualizar a evolução das temperaturas.";
    }

    desenharGrafico();
    mostrarTemperaturasFinais();
}


// ============================================================
// PRÉ-PROCESSAMENTO DOS DADOS PARA O DESENHO
// ============================================================

// Reduz número de pontos preservando formato geral (média por bucket)
function reduzirDados(dados, maxPontos) {
    if (dados.length <= maxPontos) return dados;

    const resultado = [];
    const passo = dados.length / maxPontos;

    for (let i = 0; i < maxPontos; i++) {
        const inicio = Math.floor(i * passo);
        const fim    = Math.max(inicio + 1, Math.floor((i + 1) * passo));

        let somaT = 0, somaTemp = 0, count = 0;
        for (let j = inicio; j < fim && j < dados.length; j++) {
            somaT    += dados[j].tempo;
            somaTemp += dados[j].temperatura;
            count++;
        }
        if (count > 0) {
            resultado.push({
                tempo: somaT / count,
                temperatura: somaTemp / count
            });
        }
    }
    return resultado;
}

// Média móvel com peso triangular (smoothing)
function suavizarDados(dados, raio) {
    if (dados.length < 3) return dados;

    const n = dados.length;
    const resultado = new Array(n);

    for (let i = 0; i < n; i++) {
        const de  = Math.max(0, i - raio);
        const ate = Math.min(n - 1, i + raio);

        let soma = 0, pesoTotal = 0;
        for (let j = de; j <= ate; j++) {
            const peso = (raio + 1) - Math.abs(j - i);
            soma += dados[j].temperatura * peso;
            pesoTotal += peso;
        }

        resultado[i] = {
            tempo: dados[i].tempo,
            temperatura: soma / pesoTotal
        };
    }
    return resultado;
}

// Pipeline: reduz → suaviza
function prepararDadosParaDesenho(dados) {
    if (!dados || dados.length === 0) return [];

    let pontos = dados;
    if (pontos.length > MAX_PONTOS_LINHA) {
        pontos = reduzirDados(pontos, MAX_PONTOS_LINHA);
    }
    if (pontos.length >= 5) {
        pontos = suavizarDados(pontos, RAIO_SUAVIZACAO);
    }
    return pontos;
}


// ============================================================
// GRÁFICO — CANVAS
// ============================================================

function prepararCanvas() {
    if (!canvas || !ctx) return null;

    const larguraCSS = canvas.clientWidth;
    const alturaCSS  = canvas.clientHeight;
    if (larguraCSS <= 0 || alturaCSS <= 0) return null;

    const dpr = window.devicePixelRatio || 1;
    const novaLargura = Math.round(larguraCSS * dpr);
    const novaAltura  = Math.round(alturaCSS  * dpr);

    if (canvas.width !== novaLargura || canvas.height !== novaAltura) {
        canvas.width  = novaLargura;
        canvas.height = novaAltura;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    return { largura: larguraCSS, altura: alturaCSS };
}


function obterTemperaturasValidas() {
    const temperaturas = [];
    for (const p of dadosCapsula1) if (numeroValido(p.temperatura)) temperaturas.push(p.temperatura);
    for (const p of dadosCapsula2) if (numeroValido(p.temperatura)) temperaturas.push(p.temperatura);
    return temperaturas;
}


function calcularEscalaY() {

    const temperaturas = obterTemperaturasValidas();

    if (temperaturas.length === 0) {
        return { minimo: 20, maximo: 30, passo: 2 };
    }

    let minimo = Math.min(...temperaturas);
    let maximo = Math.max(...temperaturas);
    let variacao = maximo - minimo;

    if (variacao < 0.1) {
        const centro = (minimo + maximo) / 2;
        minimo = centro - 0.5;
        maximo = centro + 0.5;
    }
    else if (variacao < 1) {
        const margem = Math.max(variacao * 0.30, 0.15);
        minimo -= margem; maximo += margem;
    }
    else if (variacao < 3) {
        const margem = variacao * 0.20;
        minimo -= margem; maximo += margem;
    }
    else {
        const margem = variacao * 0.10;
        minimo -= margem; maximo += margem;
    }

    const novaVariacao = maximo - minimo;
    let passo;
    if (novaVariacao <= 1)       passo = 0.2;
    else if (novaVariacao <= 2)  passo = 0.5;
    else if (novaVariacao <= 5)  passo = 1;
    else if (novaVariacao <= 10) passo = 2;
    else                         passo = 5;

    return { minimo, maximo, passo };
}


function formatarEixoY(valor) {
    if (Math.abs(valor) < 0.0001) valor = 0;
    return valor.toFixed(1).replace(".", ",") + "°";
}


function desenharEixos(largura, altura, margem, tempoMaximo, escalaY) {

    // Grid suave (dashed)
    ctx.save();
    ctx.setLineDash([3, 5]);
    ctx.strokeStyle = "#E7ECF2";
    ctx.lineWidth = 1;

    const quantidadeLinhas = Math.max(
        2,
        Math.round((escalaY.maximo - escalaY.minimo) / escalaY.passo)
    );

    ctx.fillStyle = "#94A3B8";
    ctx.font = "12px Inter, Arial, sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    for (let i = 0; i <= quantidadeLinhas; i++) {
        const proporcao = i / quantidadeLinhas;
        const y = margem.superior +
                  proporcao * (altura - margem.superior - margem.inferior);
        const valor = escalaY.maximo -
                      proporcao * (escalaY.maximo - escalaY.minimo);

        ctx.beginPath();
        ctx.moveTo(margem.esquerda, y);
        ctx.lineTo(largura - margem.direita, y);
        ctx.stroke();

        ctx.fillText(formatarEixoY(valor), margem.esquerda - 10, y);
    }
    ctx.restore();

    // Eixo X
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    const quantidadeTempos = Math.min(
        6,
        Math.max(2, Math.ceil(tempoMaximo / 10) + 1)
    );

    for (let i = 0; i <= quantidadeTempos; i++) {
        const proporcao = i / quantidadeTempos;
        const x = margem.esquerda +
                  proporcao * (largura - margem.esquerda - margem.direita);
        const segundos = proporcao * tempoMaximo;

        ctx.fillText(
            segundos.toFixed(1).replace(".", ",") + " s",
            x,
            altura - margem.inferior + 10
        );
    }

    // Rótulos
    ctx.save();
    ctx.translate(18, altura / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#94A3B8";
    ctx.font = "12px Inter, Arial, sans-serif";
    ctx.fillText("Temperatura (°C)", 0, 0);
    ctx.restore();

    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("Tempo", largura / 2, altura - 4);
}


// ============================================================
// DESENHA LINHA SUAVE (Catmull-Rom → Bézier)
// ============================================================

function desenharLinha(dados, margem, graficoLargura, graficoAltura,
                       tempoMaximo, temperaturaMinima, temperaturaMaxima, cor) {

    if (!dados || dados.length === 0) return;

    // Constrói pontos em coordenadas de tela
    const pontos = [];

    for (const p of dados) {
        if (!numeroValido(p.tempo) || !numeroValido(p.temperatura)) continue;
        if (p.tempo < 0 || p.tempo > tempoMaximo) continue;

        const proporcaoX = tempoMaximo > 0 ? p.tempo / tempoMaximo : 0;
        const proporcaoY =
            (p.temperatura - temperaturaMinima) /
            (temperaturaMaxima - temperaturaMinima);

        pontos.push({
            x: margem.esquerda + proporcaoX * graficoLargura,
            y: margem.superior + graficoAltura - proporcaoY * graficoAltura
        });
    }

    if (pontos.length === 0) return;

    // Linha principal
    ctx.strokeStyle = cor;
    ctx.lineWidth = 2.4;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    ctx.beginPath();
    ctx.moveTo(pontos[0].x, pontos[0].y);

    if (pontos.length === 2) {
        ctx.lineTo(pontos[1].x, pontos[1].y);
    } else {
        // Catmull-Rom → Bézier
        for (let i = 0; i < pontos.length - 1; i++) {
            const p0 = pontos[i - 1] || pontos[i];
            const p1 = pontos[i];
            const p2 = pontos[i + 1];
            const p3 = pontos[i + 2] || pontos[i + 1];

            const cp1x = p1.x + (p2.x - p0.x) / 6;
            const cp1y = p1.y + (p2.y - p0.y) / 6;
            const cp2x = p2.x - (p3.x - p1.x) / 6;
            const cp2y = p2.y - (p3.y - p1.y) / 6;

            ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
        }
    }
    ctx.stroke();

    // Ponto "vivo" no final da linha
    const ultimo = pontos[pontos.length - 1];

    ctx.beginPath();
    ctx.arc(ultimo.x, ultimo.y, 8, 0, Math.PI * 2);
    ctx.fillStyle = cor + "26"; // leve transparência
    ctx.fill();

    ctx.beginPath();
    ctx.arc(ultimo.x, ultimo.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = cor;
    ctx.fill();

    ctx.lineWidth = 2;
    ctx.strokeStyle = "#FFFFFF";
    ctx.stroke();
}


// ============================================================
// DESENHAR GRÁFICO PRINCIPAL
// ============================================================

function desenharGrafico() {

    if (!canvas || !ctx) return;

    const dimensoes = prepararCanvas();
    if (!dimensoes) return;

    const { largura, altura } = dimensoes;

    ctx.clearRect(0, 0, largura, altura);

    const margem = { esquerda: 68, direita: 26, superior: 26, inferior: 54 };

    const graficoLargura = largura - margem.esquerda - margem.direita;
    const graficoAltura  = altura  - margem.superior - margem.inferior;

    // Tempo máximo
    let tempoMaximo = 10;

    if (duracaoCapsula1 !== null && duracaoCapsula1 > 0) {
        tempoMaximo = duracaoCapsula1;
    }

    if (etapa === "capsula1" && inicioRealCapsula1 !== null) {
        const t = (performance.now() - inicioRealCapsula1) / 1000;
        tempoMaximo = arredondarTempoMaximo(Math.max(1, t));
    }

    const escalaY = calcularEscalaY();

    desenharEixos(largura, altura, margem, tempoMaximo, escalaY);

    const d1 = prepararDadosParaDesenho(dadosCapsula1);
    const d2 = prepararDadosParaDesenho(dadosCapsula2);

    desenharLinha(
        d1, margem, graficoLargura, graficoAltura,
        tempoMaximo, escalaY.minimo, escalaY.maximo, COR_CAPSULA_1
    );

    desenharLinha(
        d2, margem, graficoLargura, graficoAltura,
        tempoMaximo, escalaY.minimo, escalaY.maximo, COR_CAPSULA_2
    );
}


// ============================================================
// LOOP
// ============================================================

function loopGrafico() {
    if (etapa === "capsula1" || etapa === "capsula2") {
        desenharGrafico();
    }
    requestAnimationFrame(loopGrafico);
}


// ============================================================
// RESULTADO FINAL
// ============================================================

function mostrarTemperaturasFinais() {

    let resultado = document.getElementById("resultadoFinal");

    if (!resultado) {
        resultado = document.createElement("div");
        resultado.id = "resultadoFinal";
        resultado.className = "resultado-final";

        const graficoArea = document.getElementById("graficoArea");
        if (graficoArea) graficoArea.insertAdjacentElement("afterend", resultado);
        else document.body.appendChild(resultado);
    }

    resultado.innerHTML = `
        <div class="resultado-final-titulo">Resultado final</div>
        <div class="resultado-final-grid">
            <div class="resultado-final-item">
                <span>Cápsula 1</span>
                <strong>${formatarTemperatura(temperaturaFinalCapsula1)}</strong>
            </div>
            <div class="resultado-final-item">
                <span>Cápsula 2</span>
                <strong>${formatarTemperatura(temperaturaFinalCapsula2)}</strong>
            </div>
        </div>
    `;
}


// ============================================================
// REPRISE
// ============================================================

function iniciarReprise() {

    if (etapa !== "finalizado") return;
    if (dadosCapsula1.length === 0 && dadosCapsula2.length === 0) return;

    pararReprise();

    emReprise = true;
    repriseInicio = performance.now();
    repriseDuracaoTotal = duracaoCapsula1 || 0;

    if (repriseDuracaoTotal <= 0) return;

    if (botaoReprise)    botaoReprise.disabled = true;
    if (botaoNovaSessao) botaoNovaSessao.disabled = true;

    atualizarStatus("Reprise em andamento", "processando");

    if (descricaoControle) {
        descricaoControle.textContent =
            "Reprise: o experimento está sendo reproduzido desde o início.";
    }

    executarReprise();
}


function executarReprise() {

    if (!emReprise) return;

    const agora = performance.now();
    const tempoDecorrido = (agora - repriseInicio) / 1000;

    const progresso = Math.min(1, tempoDecorrido / repriseDuracaoTotal);
    const tempoAtualReprise = progresso * repriseDuracaoTotal;

    desenharGraficoReprise(tempoAtualReprise);

    if (progresso >= 1) {
        emReprise = false;
        repriseAnimacao = null;

        atualizarStatus("Reprise concluída", "online");

        if (descricaoControle) descricaoControle.textContent = "Reprise concluída.";

        if (botaoReprise)    botaoReprise.disabled = false;
        if (botaoNovaSessao) botaoNovaSessao.disabled = false;

        mostrarTemperaturasFinais();
        return;
    }

    repriseAnimacao = requestAnimationFrame(executarReprise);
}


function desenharGraficoReprise(tempoAtualReprise) {

    if (!canvas || !ctx) return;

    const dimensoes = prepararCanvas();
    if (!dimensoes) return;

    const { largura, altura } = dimensoes;

    ctx.clearRect(0, 0, largura, altura);

    const margem = { esquerda: 68, direita: 26, superior: 26, inferior: 54 };

    const graficoLargura = largura - margem.esquerda - margem.direita;
    const graficoAltura  = altura  - margem.superior - margem.inferior;

    const escalaY = calcularEscalaY();

    desenharEixos(largura, altura, margem, repriseDuracaoTotal, escalaY);

    const d1 = prepararDadosParaDesenho(
        dadosCapsula1.filter(p => p.tempo <= tempoAtualReprise)
    );

    const d2 = prepararDadosParaDesenho(
        dadosCapsula2.filter(p => p.tempo <= tempoAtualReprise)
    );

    desenharLinha(
        d1, margem, graficoLargura, graficoAltura,
        repriseDuracaoTotal, escalaY.minimo, escalaY.maximo, COR_CAPSULA_1
    );

    desenharLinha(
        d2, margem, graficoLargura, graficoAltura,
        repriseDuracaoTotal, escalaY.minimo, escalaY.maximo, COR_CAPSULA_2
    );
}


function pararReprise() {
    emReprise = false;
    if (repriseAnimacao) {
        cancelAnimationFrame(repriseAnimacao);
        repriseAnimacao = null;
    }
}


// ============================================================
// NOVA SESSÃO
// ============================================================

function novaSessao() {

    pararReprise();

    if (temporizadorCapsula2) {
        clearTimeout(temporizadorCapsula2);
        temporizadorCapsula2 = null;
    }

    etapa = "aguardando1";

    dadosCapsula1 = [];
    dadosCapsula2 = [];

    inicioRealCapsula1 = null;
    inicioRealCapsula2 = null;

    duracaoCapsula1 = null;
    duracaoCapsula2 = null;

    tempoParadoCapsula1 = null;
    tempoParadoCapsula2 = null;

    temperaturaFinalCapsula1 = null;
    temperaturaFinalCapsula2 = null;

    temperaturaAtual = null;
    totalLeituras = 0;

    if (botaoIniciar)    botaoIniciar.disabled = false;
    if (botaoParar)      botaoParar.disabled = true;
    if (botaoIniciar2)   botaoIniciar2.disabled = true;
    if (botaoParar2)     botaoParar2.disabled = true;
    if (botaoReprise)    botaoReprise.disabled = true;
    if (botaoNovaSessao) botaoNovaSessao.disabled = false;

    if (tempoAtual) tempoAtual.innerHTML = '0,0 <small>s</small>';
    if (quantidadeLeituras) quantidadeLeituras.textContent = "0";

    atualizarEstadoExperimento();

    if (descricaoControle) {
        descricaoControle.textContent =
            "Pressione “Iniciar” para começar uma nova medição.";
    }

    const resultado = document.getElementById("resultadoFinal");
    if (resultado) resultado.remove();

    atualizarStatus("Sistema pronto", "online");

    desenharGrafico();
}


// ============================================================
// EVENTOS
// ============================================================

if (botaoIniciar)    botaoIniciar.addEventListener("click", iniciarCapsula1);
if (botaoParar)      botaoParar.addEventListener("click", pararCapsula1);
if (botaoIniciar2)   botaoIniciar2.addEventListener("click", iniciarCapsula2);
if (botaoParar2)     botaoParar2.addEventListener("click", pararCapsula2);
if (botaoReprise)    botaoReprise.addEventListener("click", iniciarReprise);
if (botaoNovaSessao) botaoNovaSessao.addEventListener("click", novaSessao);

window.addEventListener("resize", desenharGrafico);


// ============================================================
// INICIALIZAÇÃO
// ============================================================

atualizarEstadoExperimento();
atualizarInterface();

if (botaoParar)    botaoParar.disabled = true;
if (botaoIniciar2) botaoIniciar2.disabled = true;
if (botaoParar2)   botaoParar2.disabled = true;
if (botaoReprise)  botaoReprise.disabled = true;

conectarWebSocket();
loopGrafico();
desenharGrafico();
