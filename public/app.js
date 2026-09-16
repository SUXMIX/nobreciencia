// ============================================================
// EFEITO ESTUFA — MONITORAMENTO
// Controle das cápsulas, WebSocket e gráfico
// ============================================================


// ============================================================
// CONFIGURAÇÃO
// ============================================================

const ENDERECO_WEBSOCKET =
    "wss://nobreciencia.lilolilo09666.workers.dev/api/ws";

const COR_CAPSULA_1 = "#0A2E5C";
const COR_CAPSULA_2 = "#F9A825";


// ============================================================
// ESTADO DO EXPERIMENTO
// ============================================================

let etapa = "aguardando1";

// Dados das cápsulas
let dadosCapsula1 = [];
let dadosCapsula2 = [];

// Instantes reais de início
let inicioRealCapsula1 = null;
let inicioRealCapsula2 = null;

// Duração real das cápsulas
let duracaoCapsula1 = null;
let duracaoCapsula2 = null;

// Instantes de parada
let tempoParadoCapsula1 = null;
let tempoParadoCapsula2 = null;

// Temperaturas finais
let temperaturaFinalCapsula1 = null;
let temperaturaFinalCapsula2 = null;

// Última temperatura recebida
let temperaturaAtual = null;

// Contagem total de leituras
let totalLeituras = 0;

// Timer automático da cápsula 2
let temporizadorCapsula2 = null;

// WebSocket
let ws = null;
let reconexaoTimer = null;

// Reprise
let emReprise = false;
let repriseInicio = null;
let repriseAnimacao = null;
let repriseDuracaoTotal = 0;


// ============================================================
// ELEMENTOS DA PÁGINA
// ============================================================

const canvas = document.getElementById("graph");
const ctx = canvas ? canvas.getContext("2d") : null;

const statusIndicador =
    document.getElementById("statusIndicador");

const statusTexto =
    document.getElementById("statusTexto");

const statusLive =
    document.getElementById("statusLive");

const temperatura1 =
    document.getElementById("temperatura1");

const tempoAtual =
    document.getElementById("tempoAtual");

const quantidadeLeituras =
    document.getElementById("quantidadeLeituras");

const estadoExperimento =
    document.getElementById("estadoExperimento");

const descricaoControle =
    document.getElementById("descricaoControle");

const botaoIniciar =
    document.getElementById("iniciar");

const botaoParar =
    document.getElementById("parar");

const botaoIniciar2 =
    document.getElementById("iniciar2");

const botaoParar2 =
    document.getElementById("parar2");

const botaoReprise =
    document.getElementById("reprise");

const botaoNovaSessao =
    document.getElementById("novaSessao");


// ============================================================
// UTILIDADES
// ============================================================

function numeroValido(valor) {
    return typeof valor === "number" && Number.isFinite(valor);
}


function formatarTemperatura(valor) {
    if (!numeroValido(valor)) {
        return "--";
    }

    return valor.toFixed(2) + " °C";
}


function formatarTempo(segundos) {
    if (!numeroValido(segundos)) {
        return "0,0 s";
    }

    return segundos.toFixed(1).replace(".", ",") + " s";
}


function atualizarInterface() {
    if (temperatura1) {
        temperatura1.textContent =
            formatarTemperatura(temperaturaAtual);
    }

    if (quantidadeLeituras) {
        quantidadeLeituras.textContent =
            totalLeituras;
    }
}


// ============================================================
// STATUS
// ============================================================

function atualizarStatus(
    texto,
    tipo = "normal"
) {
    if (statusTexto) {
        statusTexto.textContent = texto;
    }

    if (!statusIndicador) {
        return;
    }

    statusIndicador.classList.remove(
        "online",
        "offline",
        "processando"
    );

    if (tipo === "online") {
        statusIndicador.classList.add("online");
    }

    if (tipo === "offline") {
        statusIndicador.classList.add("offline");
    }

    if (tipo === "processando") {
        statusIndicador.classList.add("processando");
    }
}


function atualizarEstadoExperimento() {
    if (!estadoExperimento) {
        return;
    }

    if (etapa === "aguardando1") {
        estadoExperimento.textContent =
            "Aguardando início da Cápsula 1";
    }

    else if (etapa === "capsula1") {
        estadoExperimento.textContent =
            "Cápsula 1 em andamento";
    }

    else if (etapa === "aguardando2") {
        estadoExperimento.textContent =
            "Pronto para iniciar a Cápsula 2";
    }

    else if (etapa === "capsula2") {
        estadoExperimento.textContent =
            "Cápsula 2 em andamento";
    }

    else if (etapa === "finalizado") {
        estadoExperimento.textContent =
            "Experimento finalizado";
    }
}


// ============================================================
// WEBSOCKET
// ============================================================

function conectarWebSocket() {

    if (ws) {
        try {
            ws.close();
        } catch (erro) {
            console.error(erro);
        }
    }

    atualizarStatus(
        "Conectando ao sistema...",
        "processando"
    );

    ws = new WebSocket(
        ENDERECO_WEBSOCKET
    );


    ws.onopen = function () {

        console.log(
            "WebSocket conectado!"
        );

        atualizarStatus(
            "Sistema conectado",
            "online"
        );

        if (statusLive) {
            statusLive.textContent =
                "LIVE";
        }
    };


    ws.onmessage = function (evento) {

        console.log(
            "Dados recebidos:",
            evento.data
        );

        processarTemperatura(
            evento.data
        );
    };


    ws.onerror = function (erro) {

        console.error(
            "Erro no WebSocket:",
            erro
        );

        atualizarStatus(
            "Erro na conexão",
            "offline"
        );
    };


    ws.onclose = function () {

        console.log(
            "WebSocket desconectado."
        );

        atualizarStatus(
            "Reconectando...",
            "offline"
        );

        if (statusLive) {
            statusLive.textContent =
                "OFFLINE";
        }

        if (!reconexaoTimer) {

            reconexaoTimer =
                setTimeout(
                    function () {

                        reconexaoTimer =
                            null;

                        conectarWebSocket();

                    },
                    3000
                );
        }
    };
}


// ============================================================
// PROCESSAMENTO DA TEMPERATURA
// ============================================================

function processarTemperatura(mensagem) {

    let dados;

    try {
        dados = JSON.parse(mensagem);
    }

    catch (erro) {

        console.error(
            "Mensagem inválida:",
            mensagem
        );

        return;
    }


    const temperatura =
        Number(dados.temperatura);


    if (!Number.isFinite(temperatura)) {
        return;
    }


    temperaturaAtual =
        temperatura;


    atualizarInterface();


    // --------------------------------------------------------
    // Só registra dados depois que o botão "Iniciar" foi
    // pressionado.
    // --------------------------------------------------------

    if (
        etapa !== "capsula1" &&
        etapa !== "capsula2"
    ) {
        return;
    }


    let inicioAtual;

    let dadosAtual;


    if (etapa === "capsula1") {

        inicioAtual =
            inicioRealCapsula1;

        dadosAtual =
            dadosCapsula1;
    }

    else {

        inicioAtual =
            inicioRealCapsula2;

        dadosAtual =
            dadosCapsula2;
    }


    if (inicioAtual === null) {
        return;
    }


    const agora =
        performance.now();


    const tempo =
        (agora - inicioAtual) / 1000;


    // --------------------------------------------------------
    // Limite da duração
    // --------------------------------------------------------

    let duracaoLimite = null;

    if (etapa === "capsula1") {

        // Enquanto a cápsula 1 está ativa,
        // não há limite automático.
        duracaoLimite = null;
    }

    else if (etapa === "capsula2") {

        duracaoLimite =
            duracaoCapsula2;
    }


    if (
        duracaoLimite !== null &&
        tempo > duracaoLimite
    ) {
        return;
    }


    const ponto = {
        tempo: tempo,
        temperatura: temperatura
    };


    dadosAtual.push(ponto);


    // --------------------------------------------------------
    // A contagem começa na cápsula 1 e continua acumulada
    // na cápsula 2.
    // --------------------------------------------------------

    totalLeituras++;


    atualizarInterface();


    if (tempoAtual) {
        tempoAtual.textContent =
            formatarTempo(tempo);
    }


    desenharGrafico();
}


// ============================================================
// INICIAR CÁPSULA 1
// ============================================================

function iniciarCapsula1() {

    if (
        etapa !== "aguardando1" &&
        etapa !== "finalizado"
    ) {
        return;
    }


    // Cancela qualquer reprise anterior
    pararReprise();


    dadosCapsula1 = [];
    dadosCapsula2 = [];

    inicioRealCapsula1 =
        performance.now();

    inicioRealCapsula2 =
        null;

    duracaoCapsula1 =
        null;

    duracaoCapsula2 =
        null;

    tempoParadoCapsula1 =
        null;

    tempoParadoCapsula2 =
        null;

    temperaturaFinalCapsula1 =
        null;

    temperaturaFinalCapsula2 =
        null;


    // A contagem começa exatamente aqui.
    totalLeituras = 0;


    etapa = "capsula1";


    if (botaoIniciar) {
        botaoIniciar.disabled = true;
    }

    if (botaoParar) {
        botaoParar.disabled = false;
    }

    if (botaoIniciar2) {
        botaoIniciar2.disabled = true;
    }

    if (botaoParar2) {
        botaoParar2.disabled = true;
    }

    if (botaoReprise) {
        botaoReprise.disabled = true;
    }


    atualizarStatus(
        "Cápsula 1 em andamento",
        "online"
    );

    atualizarEstadoExperimento();


    if (descricaoControle) {
        descricaoControle.textContent =
            "A cápsula 1 está sendo monitorada. " +
            "Pressione “Parar” quando a etapa terminar.";
    }


    atualizarInterface();

    desenharGrafico();
}


// ============================================================
// PARAR CÁPSULA 1
// ============================================================

function pararCapsula1() {

    if (etapa !== "capsula1") {
        return;
    }


    const agora =
        performance.now();


    duracaoCapsula1 =
        (agora - inicioRealCapsula1) / 1000;


    tempoParadoCapsula1 =
        agora;


    // --------------------------------------------------------
    // Guarda a última temperatura válida dentro do limite.
    // --------------------------------------------------------

    if (dadosCapsula1.length > 0) {

        const ultimo =
            dadosCapsula1[
                dadosCapsula1.length - 1
            ];

        temperaturaFinalCapsula1 =
            ultimo.temperatura;
    }


    etapa = "aguardando2";


    if (botaoIniciar) {
        botaoIniciar.disabled = true;
    }

    if (botaoParar) {
        botaoParar.disabled = true;
    }

    if (botaoIniciar2) {
        botaoIniciar2.disabled = false;
    }

    if (botaoParar2) {
        botaoParar2.disabled = true;
    }


    atualizarStatus(
        "Cápsula 1 finalizada",
        "online"
    );

    atualizarEstadoExperimento();


    if (descricaoControle) {
        descricaoControle.textContent =
            "Cápsula 1 concluída em " +
            formatarTempo(duracaoCapsula1) +
            ". A Cápsula 2 usará exatamente esta duração.";
    }


    desenharGrafico();
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
        duracaoCapsula1 <= 0
    ) {
        return;
    }


    dadosCapsula2 = [];


    // --------------------------------------------------------
    // IMPORTANTE:
    // A cápsula 2 começa no próprio zero.
    // --------------------------------------------------------

    inicioRealCapsula2 =
        performance.now();


    // Exatamente a mesma duração da cápsula 1.
    duracaoCapsula2 =
        duracaoCapsula1;


    tempoParadoCapsula2 =
        null;

    temperaturaFinalCapsula2 =
        null;


    etapa = "capsula2";


    if (botaoIniciar2) {
        botaoIniciar2.disabled = true;
    }

    if (botaoParar2) {
        botaoParar2.disabled = false;
    }

    if (botaoReprise) {
        botaoReprise.disabled = true;
    }


    atualizarStatus(
        "Cápsula 2 em andamento",
        "online"
    );

    atualizarEstadoExperimento();


    if (descricaoControle) {
        descricaoControle.textContent =
            "Cápsula 2 iniciada. " +
            "Ela será encerrada automaticamente após " +
            formatarTempo(duracaoCapsula2) +
            ".";
    }


    desenharGrafico();


    // --------------------------------------------------------
    // PARADA AUTOMÁTICA
    // --------------------------------------------------------

    if (temporizadorCapsula2) {
        clearTimeout(temporizadorCapsula2);
    }


    temporizadorCapsula2 =
        setTimeout(
            function () {

                pararCapsula2();

            },
            duracaoCapsula2 * 1000
        );
}


// ============================================================
// PARAR CÁPSULA 2
// ============================================================

function pararCapsula2() {

    if (etapa !== "capsula2") {
        return;
    }


    if (temporizadorCapsula2) {

        clearTimeout(
            temporizadorCapsula2
        );

        temporizadorCapsula2 =
            null;
    }


    const agora =
        performance.now();


    const tempoDecorrido =
        (agora - inicioRealCapsula2) / 1000;


    tempoParadoCapsula2 =
        agora;


    // --------------------------------------------------------
    // Nunca deixa a duração passar da duração da cápsula 1.
    // --------------------------------------------------------

    duracaoCapsula2 =
        Math.min(
            tempoDecorrido,
            duracaoCapsula1
        );


    // --------------------------------------------------------
    // Remove qualquer leitura que tenha passado do limite.
    // --------------------------------------------------------

    dadosCapsula2 =
        dadosCapsula2.filter(
            function (ponto) {
                return ponto.tempo <= duracaoCapsula2;
            }
        );


    // --------------------------------------------------------
    // Temperatura final
    // --------------------------------------------------------

    if (dadosCapsula2.length > 0) {

        const ultimo =
            dadosCapsula2[
                dadosCapsula2.length - 1
            ];

        temperaturaFinalCapsula2 =
            ultimo.temperatura;
    }


    etapa = "finalizado";


    if (botaoIniciar2) {
        botaoIniciar2.disabled = true;
    }

    if (botaoParar2) {
        botaoParar2.disabled = true;
    }

    if (botaoReprise) {
        botaoReprise.disabled = false;
    }


    atualizarStatus(
        "Experimento finalizado",
        "online"
    );

    atualizarEstadoExperimento();


    if (descricaoControle) {
        descricaoControle.textContent =
            "As duas cápsulas foram concluídas. " +
            "Você pode iniciar a reprise para visualizar " +
            "a evolução das temperaturas.";
    }


    desenharGrafico();

    mostrarTemperaturasFinais();
}


// ============================================================
// GRÁFICO
// ============================================================

function prepararCanvas() {

    if (!canvas || !ctx) {
        return null;
    }


    const larguraCSS =
        canvas.clientWidth;

    const alturaCSS =
        canvas.clientHeight;


    if (
        larguraCSS <= 0 ||
        alturaCSS <= 0
    ) {
        return null;
    }


    const dpr =
        window.devicePixelRatio || 1;


    canvas.width =
        Math.round(
            larguraCSS * dpr
        );

    canvas.height =
        Math.round(
            alturaCSS * dpr
        );


    ctx.setTransform(
        dpr,
        0,
        0,
        dpr,
        0,
        0
    );


    return {
        largura: larguraCSS,
        altura: alturaCSS
    };
}


// ============================================================
// OBTÉM DADOS PARA O EIXO Y
// ============================================================

function obterTemperaturasValidas() {

    const temperaturas = [];


    for (const ponto of dadosCapsula1) {

        if (
            numeroValido(ponto.temperatura)
        ) {
            temperaturas.push(
                ponto.temperatura
            );
        }
    }


    for (const ponto of dadosCapsula2) {

        if (
            numeroValido(ponto.temperatura)
        ) {
            temperaturas.push(
                ponto.temperatura
            );
        }
    }


    return temperaturas;
}


// ============================================================
// CALCULA ESCALA Y COM ZOOM AUTOMÁTICO
// ============================================================

function calcularEscalaY() {

    const temperaturas =
        obterTemperaturasValidas();


    // Sem dados
    if (temperaturas.length === 0) {

        return {
            minimo: 20,
            maximo: 30,
            passo: 2
        };
    }


    let minimo =
        Math.min(...temperaturas);

    let maximo =
        Math.max(...temperaturas);


    let variacao =
        maximo - minimo;


    // --------------------------------------------------------
    // CASO 1:
    // praticamente nenhuma variação.
    //
    // Cria uma faixa pequena em torno da temperatura.
    // --------------------------------------------------------

    if (variacao < 0.1) {

        const centro =
            (minimo + maximo) / 2;

        minimo =
            centro - 0.5;

        maximo =
            centro + 0.5;

        variacao =
            maximo - minimo;
    }


    // --------------------------------------------------------
    // CASO 2:
    // variação pequena.
    //
    // O gráfico recebe pouco espaço extra.
    // Isso cria o efeito de "zoom".
    // --------------------------------------------------------

    else if (variacao < 1) {

        const margem =
            Math.max(
                variacao * 0.30,
                0.15
            );

        minimo -= margem;
        maximo += margem;
    }


    // --------------------------------------------------------
    // CASO 3:
    // variação moderada.
    // --------------------------------------------------------

    else if (variacao < 3) {

        const margem =
            variacao * 0.20;

        minimo -= margem;
        maximo += margem;
    }


    // --------------------------------------------------------
    // CASO 4:
    // variação maior.
    // --------------------------------------------------------

    else {

        const margem =
            variacao * 0.10;

        minimo -= margem;
        maximo += margem;
    }


    const novaVariacao =
        maximo - minimo;


    // --------------------------------------------------------
    // Escolha do passo do eixo Y.
    // --------------------------------------------------------

    let passo;


    if (novaVariacao <= 1) {
        passo = 0.2;
    }

    else if (novaVariacao <= 2) {
        passo = 0.5;
    }

    else if (novaVariacao <= 5) {
        passo = 1;
    }

    else if (novaVariacao <= 10) {
        passo = 2;
    }

    else {
        passo = 5;
    }


    return {
        minimo: minimo,
        maximo: maximo,
        passo: passo
    };
}


// ============================================================
// FORMATAÇÃO DO EIXO Y
// ============================================================

function formatarEixoY(valor) {

    if (
        Math.abs(valor) < 0.0001
    ) {
        valor = 0;
    }


    return valor
        .toFixed(1)
        .replace(".", ",") + "°";
}


// ============================================================
// DESENHA EIXOS
// ============================================================

function desenharEixos(
    largura,
    altura,
    margem,
    tempoMaximo,
    escalaY
) {

    ctx.strokeStyle =
        "#d9dee5";

    ctx.lineWidth = 1;


    ctx.fillStyle =
        "#667085";

    ctx.font =
        "13px Arial";

    ctx.textAlign =
        "right";

    ctx.textBaseline =
        "middle";


    // --------------------------------------------------------
    // Linhas horizontais + valores Y
    // --------------------------------------------------------

    const quantidadeLinhas =
        Math.max(
            2,
            Math.round(
                (
                    escalaY.maximo -
                    escalaY.minimo
                ) /
                escalaY.passo
            )
        );


    for (
        let i = 0;
        i <= quantidadeLinhas;
        i++
    ) {

        const proporcao =
            i / quantidadeLinhas;


        const y =
            margem.superior +
            proporcao *
            (altura - margem.superior - margem.inferior);


        const valor =
            escalaY.maximo -
            proporcao *
            (
                escalaY.maximo -
                escalaY.minimo
            );


        ctx.beginPath();

        ctx.moveTo(
            margem.esquerda,
            y
        );

        ctx.lineTo(
            largura - margem.direita,
            y
        );

        ctx.stroke();


        ctx.fillText(
            formatarEixoY(valor),
            margem.esquerda - 10,
            y
        );
    }


    // --------------------------------------------------------
    // Eixo X
    // --------------------------------------------------------

    ctx.textAlign =
        "center";

    ctx.textBaseline =
        "top";


    const quantidadeTempos =
        Math.min(
            6,
            Math.max(
                2,
                Math.ceil(
                    tempoMaximo / 10
                ) + 1
            )
        );


    for (
        let i = 0;
        i <= quantidadeTempos;
        i++
    ) {

        const proporcao =
            i / quantidadeTempos;


        const x =
            margem.esquerda +
            proporcao *
            (
                largura -
                margem.esquerda -
                margem.direita
            );


        const segundos =
            proporcao *
            tempoMaximo;


        ctx.fillText(
            segundos
                .toFixed(1)
                .replace(".", ",") + " s",
            x,
            altura - margem.inferior + 12
        );
    }


    // Título Y
    ctx.save();

    ctx.translate(
        18,
        altura / 2
    );

    ctx.rotate(
        -Math.PI / 2
    );

    ctx.textAlign =
        "center";

    ctx.textBaseline =
        "middle";

    ctx.font =
        "13px Arial";

    ctx.fillStyle =
        "#667085";

    ctx.fillText(
        "Temperatura (°C)",
        0,
        0
    );

    ctx.restore();


    // Título X

    ctx.textAlign =
        "center";

    ctx.textBaseline =
        "bottom";

    ctx.fillText(
        "Tempo",
        largura / 2,
        altura - 4
    );
}


// ============================================================
// DESENHA LINHA CURVA
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


    const pontos = [];


    for (const ponto of dados) {

        if (
            !numeroValido(ponto.tempo) ||
            !numeroValido(ponto.temperatura)
        ) {
            continue;
        }


        if (
            ponto.tempo < 0 ||
            ponto.tempo > tempoMaximo
        ) {
            continue;
        }


        const proporcaoX =
            tempoMaximo > 0
                ? ponto.tempo / tempoMaximo
                : 0;


        const proporcaoY =
            (
                ponto.temperatura -
                temperaturaMinima
            ) /
            (
                temperaturaMaxima -
                temperaturaMinima
            );


        const x =
            margem.esquerda +
            proporcaoX *
            graficoLargura;


        const y =
            margem.superior +
            graficoAltura -
            proporcaoY *
            graficoAltura;


        pontos.push({
            x: x,
            y: y
        });
    }


    if (pontos.length === 0) {
        return;
    }


    ctx.strokeStyle =
        cor;

    ctx.lineWidth =
        3;

    ctx.lineJoin =
        "round";

    ctx.lineCap =
        "round";


    ctx.beginPath();


    ctx.moveTo(
        pontos[0].x,
        pontos[0].y
    );


    // --------------------------------------------------------
    // Dois pontos: linha simples
    // --------------------------------------------------------

    if (pontos.length === 2) {

        ctx.lineTo(
            pontos[1].x,
            pontos[1].y
        );
    }


    // --------------------------------------------------------
    // Três ou mais pontos:
    // curvas Bézier suaves
    // --------------------------------------------------------

    else {

        for (
            let i = 0;
            i < pontos.length - 1;
            i++
        ) {

            const atual =
                pontos[i];

            const proximo =
                pontos[i + 1];

            const anterior =
                pontos[i - 1] || atual;

            const seguinte =
                pontos[i + 2] || proximo;


            const distanciaX =
                (
                    proximo.x -
                    atual.x
                ) * 0.35;


            const controle1 = {
                x:
                    atual.x +
                    distanciaX,

                y:
                    atual.y +
                    (
                        (
                            proximo.y -
                            anterior.y
                        ) * 0.15
                    )
            };


            const controle2 = {
                x:
                    proximo.x -
                    distanciaX,

                y:
                    proximo.y -
                    (
                        (
                            seguinte.y -
                            atual.y
                        ) * 0.15
                    )
            };


            ctx.bezierCurveTo(
                controle1.x,
                controle1.y,
                controle2.x,
                controle2.y,
                proximo.x,
                proximo.y
            );
        }
    }


    ctx.stroke();
}


// ============================================================
// DESENHAR GRÁFICO
// ============================================================

function desenharGrafico() {

    if (!canvas || !ctx) {
        return;
    }


    const dimensoes =
        prepararCanvas();


    if (!dimensoes) {
        return;
    }


    const largura =
        dimensoes.largura;

    const altura =
        dimensoes.altura;


    ctx.clearRect(
        0,
        0,
        largura,
        altura
    );


    const margem = {
        esquerda: 65,
        direita: 25,
        superior: 25,
        inferior: 55
    };


    const graficoLargura =
        largura -
        margem.esquerda -
        margem.direita;


    const graficoAltura =
        altura -
        margem.superior -
        margem.inferior;


    // --------------------------------------------------------
    // Descobre o maior tempo que deve aparecer.
    // --------------------------------------------------------

    let tempoMaximo = 10;


    if (
        duracaoCapsula1 !== null &&
        duracaoCapsula1 > 0
    ) {
        tempoMaximo =
            duracaoCapsula1;
    }


    if (
        etapa === "capsula1" &&
        inicioRealCapsula1 !== null
    ) {

        const tempoAtualCapsula1 =
            (
                performance.now() -
                inicioRealCapsula1
            ) / 1000;


        tempoMaximo =
            Math.max(
                1,
                tempoAtualCapsula1
            );
    }


    // --------------------------------------------------------
    // Escala Y com zoom automático
    // --------------------------------------------------------

    const escalaY =
        calcularEscalaY();


    desenharEixos(
        largura,
        altura,
        margem,
        tempoMaximo,
        escalaY
    );


    // --------------------------------------------------------
    // Linha da cápsula 1
    // --------------------------------------------------------

    desenharLinha(
        dadosCapsula1,
        margem,
        graficoLargura,
        graficoAltura,
        tempoMaximo,
        escalaY.minimo,
        escalaY.maximo,
        COR_CAPSULA_1
    );


    // --------------------------------------------------------
    // Linha da cápsula 2
    // --------------------------------------------------------

    desenharLinha(
        dadosCapsula2,
        margem,
        graficoLargura,
        graficoAltura,
        tempoMaximo,
        escalaY.minimo,
        escalaY.maximo,
        COR_CAPSULA_2
    );
}


// ============================================================
// ATUALIZAÇÃO CONTÍNUA DURANTE O EXPERIMENTO
// ============================================================

function loopGrafico() {

    if (
        etapa === "capsula1" ||
        etapa === "capsula2"
    ) {
        desenharGrafico();
    }


    requestAnimationFrame(
        loopGrafico
    );
}


// ============================================================
// RESULTADO FINAL
// ============================================================

function mostrarTemperaturasFinais() {

    let resultado =
        document.getElementById(
            "resultadoFinal"
        );


    if (!resultado) {

        resultado =
            document.createElement("div");

        resultado.id =
            "resultadoFinal";

        resultado.className =
            "resultado-final";


        const graficoArea =
            document.getElementById(
                "graficoArea"
            );


        if (graficoArea) {

            graficoArea.insertAdjacentElement(
                "afterend",
                resultado
            );
        }

        else {

            document.body.appendChild(
                resultado
            );
        }
    }


    resultado.innerHTML = `
        <div class="resultado-final-titulo">
            Resultado final
        </div>

        <div class="resultado-final-grid">

            <div class="resultado-final-item">
                <span>Cápsula 1</span>
                <strong>
                    ${
                        formatarTemperatura(
                            temperaturaFinalCapsula1
                        )
                    }
                </strong>
            </div>

            <div class="resultado-final-item">
                <span>Cápsula 2</span>
                <strong>
                    ${
                        formatarTemperatura(
                            temperaturaFinalCapsula2
                        )
                    }
                </strong>
            </div>

        </div>
    `;
}


// ============================================================
// REPRISE
// ============================================================

function iniciarReprise() {

    if (
        etapa !== "finalizado" ||
        dadosCapsula1.length === 0 &&
        dadosCapsula2.length === 0
    ) {
        return;
    }


    pararReprise();


    emReprise = true;


    repriseInicio =
        performance.now();


    repriseDuracaoTotal =
        duracaoCapsula1 || 0;


    if (
        repriseDuracaoTotal <= 0
    ) {
        return;
    }


    if (botaoReprise) {
        botaoReprise.disabled = true;
    }


    if (botaoNovaSessao) {
        botaoNovaSessao.disabled = true;
    }


    atualizarStatus(
        "Reprise em andamento",
        "processando"
    );


    if (descricaoControle) {
        descricaoControle.textContent =
            "Reprise: o experimento está sendo " +
            "reproduzido desde o início.";
    }


    executarReprise();
}


// ============================================================
// EXECUTA ANIMAÇÃO DA REPRISE
// ============================================================

function executarReprise() {

    if (!emReprise) {
        return;
    }


    const agora =
        performance.now();


    const tempoDecorrido =
        (
            agora -
            repriseInicio
        ) / 1000;


    const progresso =
        Math.min(
            1,
            tempoDecorrido /
            repriseDuracaoTotal
        );


    const tempoAtualReprise =
        progresso *
        repriseDuracaoTotal;


    desenharGraficoReprise(
        tempoAtualReprise
    );


    if (
        progresso >= 1
    ) {

        emReprise = false;

        repriseAnimacao = null;


        atualizarStatus(
            "Reprise concluída",
            "online"
        );


        if (descricaoControle) {
            descricaoControle.textContent =
                "Reprise concluída.";
        }


        if (botaoReprise) {
            botaoReprise.disabled = false;
        }


        if (botaoNovaSessao) {
            botaoNovaSessao.disabled = false;
        }


        mostrarTemperaturasFinais();

        return;
    }


    repriseAnimacao =
        requestAnimationFrame(
            executarReprise
        );
}


// ============================================================
// DESENHA GRÁFICO DA REPRISE
// ============================================================

function desenharGraficoReprise(
    tempoAtualReprise
) {

    if (!canvas || !ctx) {
        return;
    }


    const dimensoes =
        prepararCanvas();


    if (!dimensoes) {
        return;
    }


    const largura =
        dimensoes.largura;

    const altura =
        dimensoes.altura;


    ctx.clearRect(
        0,
        0,
        largura,
        altura
    );


    const margem = {
        esquerda: 65,
        direita: 25,
        superior: 25,
        inferior: 55
    };


    const graficoLargura =
        largura -
        margem.esquerda -
        margem.direita;


    const graficoAltura =
        altura -
        margem.superior -
        margem.inferior;


    const escalaY =
        calcularEscalaY();


    desenharEixos(
        largura,
        altura,
        margem,
        repriseDuracaoTotal,
        escalaY
    );


    // --------------------------------------------------------
    // Mostra apenas os dados até o instante atual da reprise.
    // --------------------------------------------------------

    const dados1 =
        dadosCapsula1.filter(
            function (ponto) {

                return (
                    ponto.tempo <=
                    tempoAtualReprise
                );
            }
        );


    const dados2 =
        dadosCapsula2.filter(
            function (ponto) {

                return (
                    ponto.tempo <=
                    tempoAtualReprise
                );
            }
        );


    desenharLinha(
        dados1,
        margem,
        graficoLargura,
        graficoAltura,
        repriseDuracaoTotal,
        escalaY.minimo,
        escalaY.maximo,
        COR_CAPSULA_1
    );


    desenharLinha(
        dados2,
        margem,
        graficoLargura,
        graficoAltura,
        repriseDuracaoTotal,
        escalaY.minimo,
        escalaY.maximo,
        COR_CAPSULA_2
    );
}


// ============================================================
// PARAR REPRISE
// ============================================================

function pararReprise() {

    emReprise = false;


    if (repriseAnimacao) {

        cancelAnimationFrame(
            repriseAnimacao
        );

        repriseAnimacao = null;
    }
}


// ============================================================
// NOVA SESSÃO
// ============================================================

function novaSessao() {

    pararReprise();


    if (temporizadorCapsula2) {

        clearTimeout(
            temporizadorCapsula2
        );

        temporizadorCapsula2 =
            null;
    }


    etapa = "aguardando1";


    dadosCapsula1 = [];
    dadosCapsula2 = [];


    inicioRealCapsula1 =
        null;

    inicioRealCapsula2 =
        null;


    duracaoCapsula1 =
        null;

    duracaoCapsula2 =
        null;


    tempoParadoCapsula1 =
        null;

    tempoParadoCapsula2 =
        null;


    temperaturaFinalCapsula1 =
        null;

    temperaturaFinalCapsula2 =
        null;


    temperaturaAtual =
        null;


    totalLeituras =
        0;


    if (botaoIniciar) {
        botaoIniciar.disabled = false;
    }

    if (botaoParar) {
        botaoParar.disabled = true;
    }

    if (botaoIniciar2) {
        botaoIniciar2.disabled = true;
    }

    if (botaoParar2) {
        botaoParar2.disabled = true;
    }

    if (botaoReprise) {
        botaoReprise.disabled = true;
    }

    if (botaoNovaSessao) {
        botaoNovaSessao.disabled = false;
    }


    if (tempoAtual) {
        tempoAtual.textContent =
            "0,0 s";
    }


    if (quantidadeLeituras) {
        quantidadeLeituras.textContent =
            "0";
    }


    atualizarEstadoExperimento();


    if (descricaoControle) {
        descricaoControle.textContent =
            "Pressione “Iniciar” para começar uma nova medição.";
    }


    const resultado =
        document.getElementById(
            "resultadoFinal"
        );


    if (resultado) {
        resultado.remove();
    }


    atualizarStatus(
        "Sistema pronto",
        "online"
    );


    desenharGrafico();
}


// ============================================================
// EVENTOS DOS BOTÕES
// ============================================================

if (botaoIniciar) {

    botaoIniciar.addEventListener(
        "click",
        iniciarCapsula1
    );
}


if (botaoParar) {

    botaoParar.addEventListener(
        "click",
        pararCapsula1
    );
}


if (botaoIniciar2) {

    botaoIniciar2.addEventListener(
        "click",
        iniciarCapsula2
    );
}


if (botaoParar2) {

    botaoParar2.addEventListener(
        "click",
        pararCapsula2
    );
}


if (botaoReprise) {

    botaoReprise.addEventListener(
        "click",
        iniciarReprise
    );
}


if (botaoNovaSessao) {

    botaoNovaSessao.addEventListener(
        "click",
        novaSessao
    );
}


// ============================================================
// REDIMENSIONAMENTO DA JANELA
// ============================================================

window.addEventListener(
    "resize",
    function () {

        desenharGrafico();
    }
);


// ============================================================
// INICIALIZAÇÃO
// ============================================================

atualizarEstadoExperimento();

atualizarInterface();

if (botaoParar) {
    botaoParar.disabled = true;
}

if (botaoIniciar2) {
    botaoIniciar2.disabled = true;
}

if (botaoParar2) {
    botaoParar2.disabled = true;
}

if (botaoReprise) {
    botaoReprise.disabled = true;
}


conectarWebSocket();

loopGrafico();

desenharGrafico();
