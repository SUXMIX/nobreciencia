// ============================================================
// EFEITO ESTUFA — MONITORAMENTO
// app.js
// ============================================================


// ============================================================
// CONFIGURAÇÃO DO WEBSOCKET
// ============================================================

const enderecoWebSocket =
    "wss://nobreciencia.lilolilo09666.workers.dev/api/ws";


// ============================================================
// ELEMENTOS DA PÁGINA
// ============================================================

const canvas = document.getElementById("graph");
const graficoArea = document.getElementById("graficoArea");
const ctx = canvas.getContext("2d");

const statusIndicador =
    document.getElementById("statusIndicador");

const statusTexto =
    document.getElementById("statusTexto");

const statusLive =
    document.getElementById("statusLive");

const temperaturaElemento =
    document.getElementById("temperatura1");

const tempoElemento =
    document.getElementById("tempoAtual");

const quantidadeLeiturasElemento =
    document.getElementById("quantidadeLeituras");

const estadoExperimentoElemento =
    document.getElementById("estadoExperimento");

const descricaoControleElemento =
    document.getElementById("descricaoControle");

const iniciarBotao =
    document.getElementById("iniciar");

const pararBotao =
    document.getElementById("parar");

const iniciar2Botao =
    document.getElementById("iniciar2");

const parar2Botao =
    document.getElementById("parar2");

const repriseBotao =
    document.getElementById("reprise");

const novaSessaoBotao =
    document.getElementById("novaSessao");


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

let temperaturaAtual = null;

let temperaturaFinalCapsula1 = null;
let temperaturaFinalCapsula2 = null;

let totalLeituras = 0;

let temporizadorCapsula2 = null;


// ============================================================
// ESTADO DO WEBSOCKET
// ============================================================

let ws = null;
let reconexaoTimer = null;


// ============================================================
// ESTADO DA REPRISE
// ============================================================

let emReprise = false;
let repriseInicio = null;
let repriseAnimacao = null;
let repriseDuracaoTotal = 0;


// ============================================================
// CORES DAS CÁPSULAS
// ============================================================

const COR_CAPSULA_1 = "#0A2E5C";
const COR_CAPSULA_2 = "#F9A825";


// ============================================================
// CANVAS
// ============================================================

function ajustarCanvas() {

    const largura = graficoArea.clientWidth;
    const altura = graficoArea.clientHeight;

    const dpr = window.devicePixelRatio || 1;

    canvas.width = largura * dpr;
    canvas.height = altura * dpr;

    canvas.style.width = largura + "px";
    canvas.style.height = altura + "px";

    ctx.setTransform(
        dpr,
        0,
        0,
        dpr,
        0,
        0
    );

    desenharGrafico();
}


// ============================================================
// FUNÇÕES AUXILIARES
// ============================================================

function formatarTemperatura(valor) {

    if (
        valor === null ||
        valor === undefined ||
        !Number.isFinite(valor)
    ) {
        return "--";
    }

    return (
        valor.toFixed(2).replace(".", ",") +
        " °C"
    );
}


function formatarTempo(segundos) {

    if (
        !Number.isFinite(segundos) ||
        segundos < 0
    ) {
        segundos = 0;
    }

    segundos = Math.floor(segundos);

    const minutos =
        Math.floor(segundos / 60);

    const segundosRestantes =
        segundos % 60;

    return (
        String(minutos).padStart(2, "0") +
        ":" +
        String(segundosRestantes).padStart(2, "0")
    );
}


function atualizarStatus(
    texto,
    conectado = false
) {

    if (statusTexto) {
        statusTexto.textContent = texto;
    }

    if (statusIndicador) {
        statusIndicador.classList.toggle(
            "online",
            conectado
        );
    }

    if (statusLive) {
        statusLive.textContent =
            conectado ? "LIVE" : "OFFLINE";
    }
}


// ============================================================
// ATUALIZAR INTERFACE
// ============================================================

function atualizarInterface() {

    if (temperaturaElemento) {

        temperaturaElemento.textContent =
            formatarTemperatura(
                temperaturaAtual
            );
    }


    if (quantidadeLeiturasElemento) {

        quantidadeLeiturasElemento.textContent =
            totalLeituras;
    }


    if (estadoExperimentoElemento) {

        const estados = {

            aguardando1:
                "Aguardando cápsula 1",

            capsula1:
                "Cápsula 1 em andamento",

            aguardando2:
                "Aguardando cápsula 2",

            capsula2:
                "Cápsula 2 em andamento",

            finalizada:
                "Experimento finalizado"
        };

        estadoExperimentoElemento.textContent =
            estados[etapa] || "";
    }


    if (descricaoControleElemento) {

        const descricoes = {

            aguardando1:
                "Inicie a cápsula 1 para começar a coleta.",

            capsula1:
                "A cápsula 1 está sendo monitorada em tempo real.",

            aguardando2:
                "A cápsula 1 foi encerrada. Insira a cápsula 2 e inicie a medição.",

            capsula2:
                "A cápsula 2 está sendo monitorada com a mesma duração da cápsula 1.",

            finalizada:
                "As duas cápsulas foram medidas. Você pode reproduzir o experimento."
        };

        descricaoControleElemento.textContent =
            descricoes[etapa] || "";
    }


    // --------------------------------------------------------
    // BOTÃO CÁPSULA 1
    // --------------------------------------------------------

    if (iniciarBotao) {

        iniciarBotao.disabled =
            etapa !== "aguardando1";
    }


    if (pararBotao) {

        pararBotao.disabled =
            etapa !== "capsula1";
    }


    // --------------------------------------------------------
    // BOTÃO CÁPSULA 2
    // --------------------------------------------------------

    if (iniciar2Botao) {

        iniciar2Botao.disabled =
            etapa !== "aguardando2";
    }


    if (parar2Botao) {

        parar2Botao.disabled =
            etapa !== "capsula2";
    }


    // --------------------------------------------------------
    // REPRISE
    // --------------------------------------------------------

    if (repriseBotao) {

        repriseBotao.disabled =
            dadosCapsula1.length === 0 ||
            dadosCapsula2.length === 0;
    }
}


// ============================================================
// TEMPO DAS CÁPSULAS
// ============================================================

function tempoDaCapsula1() {

    if (inicioRealCapsula1 === null) {
        return 0;
    }

    if (tempoParadoCapsula1 !== null) {
        return tempoParadoCapsula1;
    }

    return (
        performance.now() -
        inicioRealCapsula1
    );
}


function tempoDaCapsula2() {

    if (inicioRealCapsula2 === null) {
        return 0;
    }

    if (tempoParadoCapsula2 !== null) {
        return tempoParadoCapsula2;
    }

    return (
        performance.now() -
        inicioRealCapsula2
    );
}


// ============================================================
// RECEBIMENTO DA TEMPERATURA
// ============================================================

function processarTemperatura(dado) {

    if (!dado) {
        return;
    }


    let temperatura = null;


    if (typeof dado === "number") {

        temperatura = dado;
    }


    if (typeof dado === "object") {

        if (
            typeof dado.temperatura === "number"
        ) {

            temperatura =
                dado.temperatura;

        } else if (
            typeof dado.temperatura === "string"
        ) {

            temperatura =
                Number(dado.temperatura);
        }
    }


    if (!Number.isFinite(temperatura)) {
        return;
    }


    // ========================================================
    // IMPORTANTE:
    // FORA DE UMA CÁPSULA NÃO CONTA LEITURA.
    // ========================================================

    if (
        etapa !== "capsula1" &&
        etapa !== "capsula2"
    ) {
        return;
    }


    temperaturaAtual = temperatura;

    // A contagem começa somente quando o botão
    // "Iniciar" de uma cápsula foi pressionado.
    totalLeituras++;


    atualizarInterface();


    // ========================================================
    // CÁPSULA 1
    // ========================================================

    if (etapa === "capsula1") {

        const tempo =
            tempoDaCapsula1();


        // Nunca aceitar leitura depois do limite.
        if (
            duracaoCapsula1 !== null &&
            tempo > duracaoCapsula1
        ) {
            return;
        }


        dadosCapsula1.push({

            tempo: tempo,

            temperatura: temperatura
        });


        // Atualiza continuamente a temperatura final.
        temperaturaFinalCapsula1 =
            temperatura;


        desenharGrafico();

        return;
    }


    // ========================================================
    // CÁPSULA 2
    // ========================================================

    if (etapa === "capsula2") {

        const tempo =
            tempoDaCapsula2();


        // A cápsula 2 NÃO pode ultrapassar
        // a duração real da cápsula 1.
        if (
            duracaoCapsula1 !== null &&
            tempo > duracaoCapsula1
        ) {
            return;
        }


        dadosCapsula2.push({

            tempo: tempo,

            temperatura: temperatura
        });


        // Atualiza continuamente a temperatura final.
        temperaturaFinalCapsula2 =
            temperatura;


        desenharGrafico();

        return;
    }
}


// ============================================================
// WEBSOCKET
// ============================================================

function conectarWebSocket() {

    if (
        ws &&
        (
            ws.readyState === WebSocket.OPEN ||
            ws.readyState === WebSocket.CONNECTING
        )
    ) {
        return;
    }


    console.log(
        "Conectando ao:",
        enderecoWebSocket
    );


    atualizarStatus(
        "Conectando...",
        false
    );


    try {

        ws =
            new WebSocket(
                enderecoWebSocket
            );

    } catch (erro) {

        console.error(
            "Erro ao criar WebSocket:",
            erro
        );

        atualizarStatus(
            "Erro na conexão",
            false
        );

        programarReconexao();

        return;
    }


    ws.onopen = function () {

        console.log(
            "WebSocket conectado!"
        );

        atualizarStatus(
            "Conectado ao sistema",
            true
        );
    };


    ws.onmessage = function (evento) {

        console.log(
            "Dados recebidos:",
            evento.data
        );


        try {

            const dado =
                JSON.parse(
                    evento.data
                );

            processarTemperatura(
                dado
            );

        } catch (erro) {

            console.error(
                "Erro ao interpretar dados recebidos:",
                erro
            );
        }
    };


    ws.onerror = function (erro) {

        console.error(
            "Erro no WebSocket:",
            erro
        );

        atualizarStatus(
            "Erro na conexão",
            false
        );
    };


    ws.onclose = function () {

        console.warn(
            "WebSocket desconectado."
        );

        atualizarStatus(
            "Desconectado",
            false
        );

        programarReconexao();
    };
}


// ============================================================
// RECONEXÃO
// ============================================================

function programarReconexao() {

    if (reconexaoTimer !== null) {
        return;
    }


    reconexaoTimer =
        setTimeout(function () {

            reconexaoTimer = null;

            conectarWebSocket();

        }, 2000);
}


// ============================================================
// INICIAR CÁPSULA 1
// ============================================================

function iniciarCapsula1() {

    if (etapa !== "aguardando1") {
        return;
    }


    pararReprise();


    dadosCapsula1 = [];

    temperaturaFinalCapsula1 = null;


    // --------------------------------------------------------
    // A CONTAGEM COMEÇA EXATAMENTE AQUI.
    // --------------------------------------------------------

    totalLeituras = 0;


    inicioRealCapsula1 =
        performance.now();


    tempoParadoCapsula1 = null;

    duracaoCapsula1 = null;


    etapa = "capsula1";


    atualizarInterface();

    desenharGrafico();


    console.log(
        "Cápsula 1 iniciada."
    );
}


// ============================================================
// PARAR CÁPSULA 1
// ============================================================

function pararCapsula1() {

    if (etapa !== "capsula1") {
        return;
    }


    tempoParadoCapsula1 =
        performance.now() -
        inicioRealCapsula1;


    duracaoCapsula1 =
        tempoParadoCapsula1;


    if (
        !Number.isFinite(
            duracaoCapsula1
        ) ||
        duracaoCapsula1 < 0
    ) {

        duracaoCapsula1 = 0;
    }


    // --------------------------------------------------------
    // REMOVER LEITURAS FORA DO LIMITE
    // --------------------------------------------------------

    dadosCapsula1 =
        dadosCapsula1.filter(
            ponto =>
                ponto.tempo <=
                duracaoCapsula1
        );


    // Atualizar temperatura final novamente
    // após a filtragem.
    if (dadosCapsula1.length > 0) {

        temperaturaFinalCapsula1 =
            dadosCapsula1[
                dadosCapsula1.length - 1
            ].temperatura;

    } else {

        temperaturaFinalCapsula1 = null;
    }


    etapa = "aguardando2";


    atualizarInterface();

    desenharGrafico();


    console.log(
        "Cápsula 1 parada."
    );

    console.log(
        "Duração:",
        duracaoCapsula1,
        "ms"
    );

    console.log(
        "Leituras:",
        dadosCapsula1.length
    );

    console.log(
        "Temperatura final:",
        temperaturaFinalCapsula1
    );
}


// ============================================================
// INICIAR CÁPSULA 2
// ============================================================

function iniciarCapsula2() {

    if (etapa !== "aguardando2") {
        return;
    }


    if (
        duracaoCapsula1 === null ||
        !Number.isFinite(
            duracaoCapsula1
        )
    ) {

        console.error(
            "Duração da cápsula 1 não encontrada."
        );

        return;
    }


    pararReprise();


    dadosCapsula2 = [];

    temperaturaFinalCapsula2 = null;


    // --------------------------------------------------------
    // A CONTAGEM DA CÁPSULA 2 COMEÇA AQUI.
    //
    // Ela continua a contagem total da sessão.
    // --------------------------------------------------------

    totalLeituras = 0;


    // O tempo da cápsula 2 começa novamente em ZERO.
    inicioRealCapsula2 =
        performance.now();


    tempoParadoCapsula2 = null;


    // EXATAMENTE a mesma duração da cápsula 1.
    duracaoCapsula2 =
        duracaoCapsula1;


    etapa = "capsula2";


    atualizarInterface();

    desenharGrafico();


    console.log(
        "Cápsula 2 iniciada."
    );

    console.log(
        "Duração:",
        duracaoCapsula2,
        "ms"
    );


    // --------------------------------------------------------
    // PARADA AUTOMÁTICA
    // --------------------------------------------------------

    temporizadorCapsula2 =
        setTimeout(
            finalizarCapsula2Automaticamente,
            duracaoCapsula2
        );
}


// ============================================================
// FINALIZAR CÁPSULA 2 AUTOMATICAMENTE
// ============================================================

function finalizarCapsula2Automaticamente() {

    if (etapa !== "capsula2") {
        return;
    }


    tempoParadoCapsula2 =
        duracaoCapsula2;


    dadosCapsula2 =
        dadosCapsula2.filter(
            ponto =>
                ponto.tempo <=
                duracaoCapsula2
        );


    if (dadosCapsula2.length > 0) {

        temperaturaFinalCapsula2 =
            dadosCapsula2[
                dadosCapsula2.length - 1
            ].temperatura;

    } else {

        temperaturaFinalCapsula2 = null;
    }


    etapa = "finalizada";


    temporizadorCapsula2 = null;


    atualizarInterface();

    desenharGrafico();


    console.log(
        "Cápsula 2 finalizada automaticamente."
    );

    console.log(
        "Temperatura final:",
        temperaturaFinalCapsula2
    );
}


// ============================================================
// PARAR CÁPSULA 2 MANUALMENTE
// ============================================================

function pararCapsula2() {

    if (etapa !== "capsula2") {
        return;
    }


    if (temporizadorCapsula2 !== null) {

        clearTimeout(
            temporizadorCapsula2
        );

        temporizadorCapsula2 = null;
    }


    tempoParadoCapsula2 =
        performance.now() -
        inicioRealCapsula2;


    // Nunca ultrapassar a duração da cápsula 1.
    tempoParadoCapsula2 =
        Math.min(
            tempoParadoCapsula2,
            duracaoCapsula1
        );


    dadosCapsula2 =
        dadosCapsula2.filter(
            ponto =>
                ponto.tempo <=
                tempoParadoCapsula2
        );


    if (dadosCapsula2.length > 0) {

        temperaturaFinalCapsula2 =
            dadosCapsula2[
                dadosCapsula2.length - 1
            ].temperatura;

    } else {

        temperaturaFinalCapsula2 = null;
    }


    etapa = "finalizada";


    atualizarInterface();

    desenharGrafico();


    console.log(
        "Cápsula 2 parada manualmente."
    );

    console.log(
        "Temperatura final:",
        temperaturaFinalCapsula2
    );
}


// ============================================================
// NOVA SESSÃO
// ============================================================

function novaSessao() {

    pararReprise();


    if (temporizadorCapsula2 !== null) {

        clearTimeout(
            temporizadorCapsula2
        );

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


    temperaturaAtual = null;

    temperaturaFinalCapsula1 = null;
    temperaturaFinalCapsula2 = null;


    totalLeituras = 0;


    if (tempoElemento) {

        tempoElemento.textContent =
            "00:00";
    }


    atualizarInterface();

    desenharGrafico();


    console.log(
        "Nova sessão iniciada."
    );
}


// ============================================================
// INICIAR REPRISE
// ============================================================

function iniciarReprise() {

    if (
        dadosCapsula1.length === 0 ||
        dadosCapsula2.length === 0
    ) {
        return;
    }


    pararReprise();


    emReprise = true;

    repriseInicio =
        performance.now();


    const fimCapsula1 =
        dadosCapsula1.length > 0
            ? dadosCapsula1[
                dadosCapsula1.length - 1
            ].tempo
            : 0;


    const fimCapsula2 =
        dadosCapsula2.length > 0
            ? dadosCapsula2[
                dadosCapsula2.length - 1
            ].tempo
            : 0;


    repriseDuracaoTotal =
        Math.max(
            fimCapsula1,
            fimCapsula2
        );


    desenharGraficoReprise(0);


    repriseAnimacao =
        requestAnimationFrame(
            atualizarReprise
        );
}


// ============================================================
// ATUALIZAR REPRISE
// ============================================================

function atualizarReprise() {

    if (!emReprise) {
        return;
    }


    const tempoDecorrido =
        performance.now() -
        repriseInicio;


    if (
        tempoDecorrido >=
        repriseDuracaoTotal
    ) {

        desenharGraficoReprise(
            repriseDuracaoTotal
        );


        emReprise = false;

        repriseAnimacao = null;


        // ----------------------------------------------------
        // MOSTRAR TEMPERATURAS FINAIS
        // ----------------------------------------------------

        mostrarTemperaturasFinais();


        return;
    }


    desenharGraficoReprise(
        tempoDecorrido
    );


    repriseAnimacao =
        requestAnimationFrame(
            atualizarReprise
        );
}


// ============================================================
// PARAR REPRISE
// ============================================================

function pararReprise() {

    emReprise = false;


    if (repriseAnimacao !== null) {

        cancelAnimationFrame(
            repriseAnimacao
        );

        repriseAnimacao = null;
    }
}


// ============================================================
// MOSTRAR TEMPERATURAS FINAIS
// ============================================================

function mostrarTemperaturasFinais() {

    // Primeiro tenta encontrar elementos próprios
    // para as temperaturas finais.

    const final1 =
        document.getElementById(
            "temperaturaFinalCapsula1"
        );

    const final2 =
        document.getElementById(
            "temperaturaFinalCapsula2"
        );


    if (final1) {

        final1.textContent =
            formatarTemperatura(
                temperaturaFinalCapsula1
            );
    }


    if (final2) {

        final2.textContent =
            formatarTemperatura(
                temperaturaFinalCapsula2
            );
    }


    // Caso os elementos ainda não existam no HTML,
    // cria um bloco de resultado dentro da área do gráfico.

    if (
        !final1 &&
        !final2
    ) {

        let resultado =
            document.getElementById(
                "resultadoFinal"
            );


        if (!resultado) {

            resultado =
                document.createElement(
                    "div"
                );

            resultado.id =
                "resultadoFinal";

            resultado.className =
                "resultado-final";


            graficoArea.parentNode.insertBefore(
                resultado,
                graficoArea.nextSibling
            );
        }


        resultado.innerHTML = `

            <div class="resultado-final-titulo">
                Temperaturas finais
            </div>

            <div class="resultado-final-grid">

                <div class="resultado-final-item">

                    <span>
                        Cápsula 1
                    </span>

                    <strong>
                        ${formatarTemperatura(
                            temperaturaFinalCapsula1
                        )}
                    </strong>

                </div>


                <div class="resultado-final-item">

                    <span>
                        Cápsula 2
                    </span>

                    <strong>
                        ${formatarTemperatura(
                            temperaturaFinalCapsula2
                        )}
                    </strong>

                </div>

            </div>
        `;
    }
}


// ============================================================
// DESENHAR GRÁFICO NORMAL
// ============================================================

function desenharGrafico() {

    if (emReprise) {
        return;
    }


    const largura =
        graficoArea.clientWidth;

    const altura =
        graficoArea.clientHeight;


    ctx.clearRect(
        0,
        0,
        largura,
        altura
    );


    // Fundo
    ctx.fillStyle =
        "#ffffff";

    ctx.fillRect(
        0,
        0,
        largura,
        altura
    );


    const margem = {

        esquerda: 70,

        direita: 30,

        superior: 30,

        inferior: 60
    };


    const graficoLargura =
        largura -
        margem.esquerda -
        margem.direita;


    const graficoAltura =
        altura -
        margem.superior -
        margem.inferior;


    const todosDados = [

        ...dadosCapsula1,

        ...dadosCapsula2
    ];


    if (
        todosDados.length === 0
    ) {

        desenharEixos(

            margem,

            graficoLargura,

            graficoAltura,

            largura,

            altura,

            60000,

            20,

            40
        );

        return;
    }


    // --------------------------------------------------------
    // TEMPO MÁXIMO
    // --------------------------------------------------------

    let tempoMaximo;


    if (
        duracaoCapsula1 !== null
    ) {

        tempoMaximo =
            duracaoCapsula1;

    } else {

        tempoMaximo =
            Math.max(
                ...todosDados.map(
                    ponto =>
                        ponto.tempo
                )
            );
    }


    tempoMaximo =
        Math.max(
            tempoMaximo,
            1000
        );


    // --------------------------------------------------------
    // TEMPERATURA
    // --------------------------------------------------------

    const temperaturas =
        todosDados.map(
            ponto =>
                ponto.temperatura
        );


    let temperaturaMinima =
        Math.min(
            ...temperaturas
        );


    let temperaturaMaxima =
        Math.max(
            ...temperaturas
        );


    let intervalo =
        temperaturaMaxima -
        temperaturaMinima;


    if (intervalo < 1) {
        intervalo = 1;
    }


    temperaturaMinima -=
        intervalo * 0.15;


    temperaturaMaxima +=
        intervalo * 0.15;


    desenharEixos(

        margem,

        graficoLargura,

        graficoAltura,

        largura,

        altura,

        tempoMaximo,

        temperaturaMinima,

        temperaturaMaxima
    );


    // --------------------------------------------------------
    // CÁPSULA 1
    // --------------------------------------------------------

    desenharLinha(

        dadosCapsula1,

        margem,

        graficoLargura,

        graficoAltura,

        tempoMaximo,

        temperaturaMinima,

        temperaturaMaxima,

        COR_CAPSULA_1
    );


    // --------------------------------------------------------
    // CÁPSULA 2
    // --------------------------------------------------------

    desenharLinha(

        dadosCapsula2,

        margem,

        graficoLargura,

        graficoAltura,

        tempoMaximo,

        temperaturaMinima,

        temperaturaMaxima,

        COR_CAPSULA_2
    );


    // --------------------------------------------------------
    // TEMPO ATUAL
    // --------------------------------------------------------

    let tempoAtual = 0;


    if (
        etapa === "capsula1"
    ) {

        tempoAtual =
            Math.min(
                tempoDaCapsula1(),
                tempoMaximo
            );

    } else if (
        etapa === "capsula2"
    ) {

        tempoAtual =
            Math.min(
                tempoDaCapsula2(),
                tempoMaximo
            );

    } else if (
        etapa === "aguardando2"
    ) {

        tempoAtual =
            duracaoCapsula1;

    } else if (
        etapa === "finalizada"
    ) {

        tempoAtual =
            tempoMaximo;
    }


    if (tempoElemento) {

        tempoElemento.textContent =
            formatarTempo(
                tempoAtual / 1000
            );
    }
}


// ============================================================
// EIXOS
// ============================================================

function desenharEixos(

    margem,

    graficoLargura,

    graficoAltura,

    largura,

    altura,

    tempoMaximo,

    temperaturaMinima,

    temperaturaMaxima

) {

    ctx.strokeStyle =
        "#d7dde5";

    ctx.lineWidth = 1;

    ctx.fillStyle =
        "#4b5563";

    ctx.font =
        "13px Arial";


    const divisoesX = 6;
    const divisoesY = 5;


    // --------------------------------------------------------
    // EIXO X
    // --------------------------------------------------------

    for (
        let i = 0;
        i <= divisoesX;
        i++
    ) {

        const proporcao =
            i / divisoesX;


        const x =
            margem.esquerda +
            proporcao *
            graficoLargura;


        ctx.beginPath();

        ctx.moveTo(
            x,
            margem.superior
        );

        ctx.lineTo(
            x,
            margem.superior +
            graficoAltura
        );

        ctx.stroke();


        const valor =
            (
                tempoMaximo *
                proporcao
            ) / 1000;


        ctx.textAlign =
            "center";


        ctx.fillText(

            valor.toFixed(0) + " s",

            x,

            margem.superior +
            graficoAltura +
            28
        );
    }


    // --------------------------------------------------------
    // EIXO Y
    // --------------------------------------------------------

    for (
        let i = 0;
        i <= divisoesY;
        i++
    ) {

        const proporcao =
            i / divisoesY;


        const y =
            margem.superior +
            graficoAltura -
            proporcao *
            graficoAltura;


        ctx.beginPath();

        ctx.moveTo(
            margem.esquerda,
            y
        );

        ctx.lineTo(
            margem.esquerda +
            graficoLargura,
            y
        );

        ctx.stroke();


        const valor =
            temperaturaMinima +
            proporcao *
            (
                temperaturaMaxima -
                temperaturaMinima
            );


        ctx.textAlign =
            "right";


        ctx.fillText(

            valor.toFixed(1) + "°",

            margem.esquerda - 12,

            y + 4
        );
    }


    // --------------------------------------------------------
    // EIXOS PRINCIPAIS
    // --------------------------------------------------------

    ctx.strokeStyle =
        "#374151";

    ctx.lineWidth = 2;


    ctx.beginPath();

    ctx.moveTo(

        margem.esquerda,

        margem.superior
    );


    ctx.lineTo(

        margem.esquerda,

        margem.superior +
        graficoAltura
    );


    ctx.lineTo(

        margem.esquerda +
        graficoLargura,

        margem.superior +
        graficoAltura
    );


    ctx.stroke();


    // --------------------------------------------------------
    // TÍTULO X
    // --------------------------------------------------------

    ctx.fillStyle =
        "#374151";

    ctx.font =
        "14px Arial";

    ctx.textAlign =
        "center";


    ctx.fillText(

        "Tempo",

        margem.esquerda +
        graficoLargura / 2,

        altura - 12
    );


    // --------------------------------------------------------
    // TÍTULO Y
    // --------------------------------------------------------

    ctx.save();


    ctx.translate(

        18,

        margem.superior +
        graficoAltura / 2
    );


    ctx.rotate(
        -Math.PI / 2
    );


    ctx.fillText(

        "Temperatura (°C)",

        0,

        0
    );


    ctx.restore();
}


// ============================================================
// DESENHAR LINHA
// ============================================================
//
// SEM PONTOS.
// SEM CLIQUE.
// SOMENTE A LINHA CONTÍNUA.
// ============================================================

function desenharLinha(

    dados,

    margem,

    graficoLargura,

    graficoAltura,

    tempoMaximo,

    temperaturaMinima,

    temperaturaMaxima,

    cor

) {

    if (
        !dados ||
        dados.length === 0
    ) {
        return;
    }


    ctx.strokeStyle =
        cor;

    ctx.lineWidth = 3;

    ctx.lineJoin =
        "round";

    ctx.lineCap =
        "round";


    ctx.beginPath();


    let primeiroPonto = true;


    for (
        const ponto of dados
    ) {

        if (
            ponto.tempo < 0 ||
            ponto.tempo > tempoMaximo
        ) {
            continue;
        }


        const x =
            margem.esquerda +
            (
                ponto.tempo /
                tempoMaximo
            ) *
            graficoLargura;


        const y =
            margem.superior +
            graficoAltura -
            (
                (
                    ponto.temperatura -
                    temperaturaMinima
                ) /
                (
                    temperaturaMaxima -
                    temperaturaMinima
                )
            ) *
            graficoAltura;


        if (primeiroPonto) {

            ctx.moveTo(
                x,
                y
            );

            primeiroPonto = false;

        } else {

            ctx.lineTo(
                x,
                y
            );
        }
    }


    ctx.stroke();
}


// ============================================================
// GRÁFICO DA REPRISE
// ============================================================

function desenharGraficoReprise(
    tempoReprise = 0
) {

    const largura =
        graficoArea.clientWidth;

    const altura =
        graficoArea.clientHeight;


    ctx.clearRect(
        0,
        0,
        largura,
        altura
    );


    ctx.fillStyle =
        "#ffffff";

    ctx.fillRect(
        0,
        0,
        largura,
        altura
    );


    const margem = {

        esquerda: 70,

        direita: 30,

        superior: 30,

        inferior: 60
    };


    const graficoLargura =
        largura -
        margem.esquerda -
        margem.direita;


    const graficoAltura =
        altura -
        margem.superior -
        margem.inferior;


    const todosDados = [

        ...dadosCapsula1,

        ...dadosCapsula2
    ];


    if (
        todosDados.length === 0
    ) {
        return;
    }


    // --------------------------------------------------------
    // DURANTE A REPRISE, O EIXO X USA A DURAÇÃO DA CÁPSULA 1.
    // --------------------------------------------------------

    const tempoMaximo =
        Math.max(
            duracaoCapsula1 || 0,
            duracaoCapsula2 || 0,
            1000
        );


    const temperaturas =
        todosDados.map(
            ponto =>
                ponto.temperatura
        );


    let temperaturaMinima =
        Math.min(
            ...temperaturas
        );


    let temperaturaMaxima =
        Math.max(
            ...temperaturas
        );


    let intervalo =
        temperaturaMaxima -
        temperaturaMinima;


    if (intervalo < 1) {
        intervalo = 1;
    }


    temperaturaMinima -=
        intervalo * 0.15;


    temperaturaMaxima +=
        intervalo * 0.15;


    desenharEixos(

        margem,

        graficoLargura,

        graficoAltura,

        largura,

        altura,

        tempoMaximo,

        temperaturaMinima,

        temperaturaMaxima
    );


    // --------------------------------------------------------
    // PEGAR SOMENTE O QUE JÁ DEVERIA TER APARECIDO
    // --------------------------------------------------------

    const dadosVisiveis1 =
        dadosCapsula1.filter(
            ponto =>
                ponto.tempo <=
                tempoReprise
        );


    const dadosVisiveis2 =
        dadosCapsula2.filter(
            ponto =>
                ponto.tempo <=
                tempoReprise
        );


    // --------------------------------------------------------
    // CÁPSULA 1
    // --------------------------------------------------------

    desenharLinha(

        dadosVisiveis1,

        margem,

        graficoLargura,

        graficoAltura,

        tempoMaximo,

        temperaturaMinima,

        temperaturaMaxima,

        COR_CAPSULA_1
    );


    // --------------------------------------------------------
    // CÁPSULA 2
    // --------------------------------------------------------

    desenharLinha(

        dadosVisiveis2,

        margem,

        graficoLargura,

        graficoAltura,

        tempoMaximo,

        temperaturaMinima,

        temperaturaMaxima,

        COR_CAPSULA_2
    );


    if (tempoElemento) {

        tempoElemento.textContent =
            formatarTempo(
                tempoReprise / 1000
            );
    }
}


// ============================================================
// EVENTOS DOS BOTÕES
// ============================================================

if (iniciarBotao) {

    iniciarBotao.addEventListener(
        "click",
        iniciarCapsula1
    );
}


if (pararBotao) {

    pararBotao.addEventListener(
        "click",
        pararCapsula1
    );
}


if (iniciar2Botao) {

    iniciar2Botao.addEventListener(
        "click",
        iniciarCapsula2
    );
}


if (parar2Botao) {

    parar2Botao.addEventListener(
        "click",
        pararCapsula2
    );
}


if (repriseBotao) {

    repriseBotao.addEventListener(
        "click",
        iniciarReprise
    );
}


if (novaSessaoBotao) {

    novaSessaoBotao.addEventListener(
        "click",
        novaSessao
    );
}


// ============================================================
// REDIMENSIONAMENTO
// ============================================================

window.addEventListener(
    "resize",
    ajustarCanvas
);


// ============================================================
// INICIALIZAÇÃO
// ============================================================

atualizarInterface();

ajustarCanvas();

conectarWebSocket();


// ============================================================
// ATUALIZAÇÃO DO TEMPO
// ============================================================

setInterval(function () {

    if (emReprise) {
        return;
    }


    if (
        etapa === "capsula1"
    ) {

        const tempo =
            tempoDaCapsula1();


        if (tempoElemento) {

            tempoElemento.textContent =
                formatarTempo(
                    tempo / 1000
                );
        }


        desenharGrafico();


    } else if (
        etapa === "capsula2"
    ) {

        const tempo =
            Math.min(
                tempoDaCapsula2(),
                duracaoCapsula1
            );


        if (tempoElemento) {

            tempoElemento.textContent =
                formatarTempo(
                    tempo / 1000
                );
        }


        desenharGrafico();
    }

}, 100);
