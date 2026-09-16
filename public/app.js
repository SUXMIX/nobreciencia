


/* ============================================================
   ELEMENTOS
   ============================================================ */

const canvas = document.getElementById("graph");
const graficoArea = document.getElementById("graficoArea");

const ctx = canvas.getContext("2d");

const temperaturaElemento =
    document.getElementById("temperatura1");

const tempoAtualElemento =
    document.getElementById("tempoAtual");

const quantidadeLeiturasElemento =
    document.getElementById("quantidadeLeituras");

const statusIndicador =
    document.getElementById("statusIndicador");

const statusTexto =
    document.getElementById("statusTexto");

const statusLive =
    document.getElementById("statusLive");

const descricaoControle =
    document.getElementById("descricaoControle");

const estadoExperimento =
    document.getElementById("estadoExperimento");

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

const tooltip =
    document.getElementById("graficoTooltip");

const tooltipTempo =
    document.getElementById("tooltipTempo");

const tooltipTemperatura =
    document.getElementById("tooltipTemperatura");


/* ============================================================
   ESTADO DO EXPERIMENTO
   ============================================================ */

let etapa = "aguardando1";

/*
 * Estados possíveis:
 *
 * aguardando1
 * capsula1
 * aguardando2
 * capsula2
 * finalizada
 */


/*
 * Dados das duas cápsulas.
 *
 * IMPORTANTE:
 *
 * O tempo armazenado aqui é o tempo LOCAL da cápsula.
 *
 * Portanto:
 *
 * cápsula 1 → começa em 0
 * cápsula 2 → começa novamente em 0
 *
 * O tempo global do ESP32 não é usado para criar
 * o eixo do gráfico.
 */

let dadosCapsula1 = [];
let dadosCapsula2 = [];


/* ============================================================
   TEMPOS
   ============================================================ */

let inicioRealCapsula1 = null;
let inicioRealCapsula2 = null;

let duracaoCapsula1 = null;
let duracaoCapsula2 = null;

let tempoParadoCapsula1 = null;
let tempoParadoCapsula2 = null;


/*
 * Timer usado para garantir que a cápsula 2
 * pare exatamente na duração da cápsula 1.
 */

let temporizadorCapsula2 = null;


/* ============================================================
   TEMPERATURA
   ============================================================ */

let temperaturaAtual = null;


/*
 * Temperatura mais recente recebida do ESP32.
 */

let ultimoDadoRecebido = null;


/*
 * Contador total de leituras.
 */

let totalLeituras = 0;


/* ============================================================
   REPRISE
   ============================================================ */

let mostrandoReprise = false;

let repriseEmExecucao = false;

let inicioReprise = null;

let tempoReprise = 0;


/* ============================================================
   WEBSOCKET
   ============================================================ */

let ws = null;


/*
 * Mantém a URL exatamente no padrão utilizado
 * pelo Cloudflare Worker.
 */

const protocolo =
    location.protocol === "https:"
        ? "wss:"
        : "ws:";

const enderecoWebSocket =
    `${protocolo}//${location.host}/api/ws`;


/* ============================================================
   CONFIGURAÇÕES DO GRÁFICO
   ============================================================ */

const MAX_PONTOS_GRAFICO = 600;


/*
 * Margens do gráfico.
 */

const MARGEM = {
    esquerda: 62,
    direita: 22,
    superior: 25,
    inferior: 50
};


/* ============================================================
   UTILIDADES
   ============================================================ */

function limitar(valor, minimo, maximo) {

    return Math.max(
        minimo,
        Math.min(maximo, valor)
    );
}


function arredondarInteiro(valor) {

    return Math.round(valor);
}


function formatarTemperatura(valor) {

    if (!Number.isFinite(valor)) {
        return "--";
    }

    /*
     * A temperatura atual continua com uma casa decimal,
     * pois isso preserva melhor a leitura científica.
     */

    return valor.toFixed(1);
}


/*
 * Converte um valor para número de forma segura.
 */

function numeroSeguro(valor) {

    const numero = Number(valor);

    return Number.isFinite(numero)
        ? numero
        : null;
}


/* ============================================================
   TEMPO LOCAL DA CÁPSULA
   ============================================================ */

function obterTempoCapsula1() {

    if (inicioRealCapsula1 === null) {

        return 0;
    }


    if (tempoParadoCapsula1 !== null) {

        return tempoParadoCapsula1;
    }


    return (
        performance.now() -
        inicioRealCapsula1
    ) / 1000;
}


function obterTempoCapsula2() {

    if (inicioRealCapsula2 === null) {

        return 0;
    }


    if (tempoParadoCapsula2 !== null) {

        return tempoParadoCapsula2;
    }


    return (
        performance.now() -
        inicioRealCapsula2
    ) / 1000;
}


/* ============================================================
   TEMPO VISUAL
   ============================================================ */

function atualizarTempoVisual() {

    let tempo = 0;


    if (etapa === "capsula1") {

        tempo = obterTempoCapsula1();

    } else if (etapa === "capsula2") {

        tempo = obterTempoCapsula2();

    } else if (
        etapa === "aguardando2" &&
        duracaoCapsula1 !== null
    ) {

        /*
         * Cápsula 1 congelada.
         */

        tempo = duracaoCapsula1;

    } else if (
        etapa === "finalizada" &&
        duracaoCapsula2 !== null
    ) {

        tempo = duracaoCapsula2;
    }


    if (mostrandoReprise) {

        tempo = tempoReprise;
    }


    tempo = Math.max(0, tempo);


    tempoAtualElemento.innerHTML =
        `${tempo.toFixed(1)} <small>s</small>`;
}


/* ============================================================
   TEMPERATURA ATUAL
   ============================================================ */

function atualizarTemperaturaVisual() {

    if (temperaturaAtual === null) {

        temperaturaElemento.innerHTML =
            `-- <small>°C</small>`;

        return;
    }


    temperaturaElemento.innerHTML =
        `${formatarTemperatura(temperaturaAtual)}
         <small>°C</small>`;
}


/* ============================================================
   RECEBER TEMPERATURA
   ============================================================ */

function receberTemperatura(dados) {

    if (!dados || typeof dados !== "object") {

        return;
    }


    /*
     * O ESP32 deve enviar:
     *
     * {
     *   temperatura: ...
     *   tempo: ...
     * }
     *
     * O campo tempo é mantido para compatibilidade,
     * mas o gráfico utiliza o relógio local da etapa.
     */

    const temperatura =
        numeroSeguro(dados.temperatura);


    if (temperatura === null) {

        return;
    }


    temperaturaAtual = temperatura;

    ultimoDadoRecebido = dados;

    totalLeituras++;


    atualizarTemperaturaVisual();


    quantidadeLeiturasElemento.textContent =
        totalLeituras;


    /*
     * --------------------------------------------------------
     * CÁPSULA 1
     * --------------------------------------------------------
     */

    if (etapa === "capsula1") {

        let tempoLocal =
            obterTempoCapsula1();


        /*
         * Nunca permitir ponto depois da duração.
         */

        if (
            duracaoCapsula1 !== null &&
            tempoLocal > duracaoCapsula1
        ) {

            return;
        }


        adicionarPonto(
            dadosCapsula1,
            tempoLocal,
            temperatura
        );


        atualizarTempoVisual();

        desenharGrafico();

        return;
    }


    /*
     * --------------------------------------------------------
     * CÁPSULA 2
     * --------------------------------------------------------
     */

    if (etapa === "capsula2") {

        let tempoLocal =
            obterTempoCapsula2();


        /*
         * A cápsula 2 possui exatamente a mesma
         * duração da cápsula 1.
         */

        if (
            duracaoCapsula1 !== null &&
            tempoLocal > duracaoCapsula1
        ) {

            return;
        }


        adicionarPonto(
            dadosCapsula2,
            tempoLocal,
            temperatura
        );


        atualizarTempoVisual();

        desenharGrafico();

        return;
    }


    /*
     * Se nenhuma cápsula está rodando,
     * apenas atualizamos a temperatura.
     */

    atualizarTempoVisual();

    desenharGrafico();
}


/* ============================================================
   ADICIONAR PONTO
   ============================================================ */

function adicionarPonto(lista, tempo, temperatura) {

    if (!Number.isFinite(tempo)) {

        return;
    }


    if (!Number.isFinite(temperatura)) {

        return;
    }


    /*
     * Evita pontos com tempo negativo.
     */

    tempo = Math.max(0, tempo);


    /*
     * Se o tempo estiver exatamente além do limite,
     * não registra.
     */

    if (
        duracaoCapsula1 !== null &&
        (
            etapa === "capsula1" ||
            etapa === "capsula2"
        ) &&
        tempo > duracaoCapsula1
    ) {

        return;
    }


    lista.push({
        tempo,
        temperatura
    });


    /*
     * Limite de segurança.
     *
     * Mantém os últimos pontos caso o ESP32 envie
     * uma quantidade muito grande de leituras.
     */

    if (lista.length > MAX_PONTOS_GRAFICO) {

        lista.splice(
            0,
            lista.length - MAX_PONTOS_GRAFICO
        );
    }
}


/* ============================================================
   ESCALA INTEIRA DO EIXO X
   ============================================================ */

function obterEscalaX() {

    let duracao = 0;


    if (duracaoCapsula1 !== null) {

        duracao = duracaoCapsula1;

    } else if (etapa === "capsula1") {

        duracao = obterTempoCapsula1();

    } else if (etapa === "capsula2") {

        duracao = duracaoCapsula1 || obterTempoCapsula2();

    } else {

        duracao = Math.max(
            obterMaiorTempo(),
            1
        );
    }


    if (mostrandoReprise) {

        duracao =
            duracaoCapsula1 ||
            duracao;
    }


    /*
     * O eixo deve ser proporcional ao experimento.
     *
     * Exemplo:
     *
     * 3,2 s → eixo até 4 s
     * 7,1 s → eixo até 8 s
     * 20,4 s → eixo até 21 s
     */

    let maximo =
        Math.ceil(Math.max(duracao, 1));


    /*
     * Na reprise, quando o tempo está correndo,
     * mostramos progressivamente o gráfico.
     */

    if (
        mostrandoReprise &&
        repriseEmExecucao
    ) {

        maximo =
            Math.max(
                1,
                Math.ceil(
                    Math.max(
                        tempoReprise,
                        1
                    )
                )
            );
    }


    return {
        min: 0,
        max: maximo
    };
}


/* ============================================================
   MAIOR TEMPO DOS DADOS
   ============================================================ */

function obterMaiorTempo() {

    let maior = 0;


    for (const ponto of dadosCapsula1) {

        if (ponto.tempo > maior) {

            maior = ponto.tempo;
        }
    }


    for (const ponto of dadosCapsula2) {

        if (ponto.tempo > maior) {

            maior = ponto.tempo;
        }
    }


    return maior;
}


/* ============================================================
   ESCALA Y
   ============================================================ */

function obterEscalaY(dados) {

    if (dados.length === 0) {

        return {
            min: 0,
            max: 10,
            passo: 2
        };
    }


    let minimo = Infinity;
    let maximo = -Infinity;


    for (const ponto of dados) {

        if (
            !Number.isFinite(ponto.temperatura)
        ) {
            continue;
        }


        minimo =
            Math.min(
                minimo,
                ponto.temperatura
            );

        maximo =
            Math.max(
                maximo,
                ponto.temperatura
            );
    }


    /*
     * Se não encontramos dados válidos.
     */

    if (
        !Number.isFinite(minimo) ||
        !Number.isFinite(maximo)
    ) {

        return {
            min: 0,
            max: 10,
            passo: 2
        };
    }


    /*
     * Eixo com valores inteiros.
     */

    minimo = Math.floor(minimo);
    maximo = Math.ceil(maximo);


    /*
     * Se todas as temperaturas forem iguais,
     * criamos espaço em torno delas.
     */

    if (minimo === maximo) {

        minimo -= 2;
        maximo += 2;
    }


    /*
     * Margem vertical pequena.
     */

    const faixa =
        maximo - minimo;


    const margem =
        Math.max(
            1,
            Math.ceil(faixa * 0.12)
        );


    minimo -= margem;
    maximo += margem;


    /*
     * Garantir que o eixo tenha amplitude
     * suficiente para mostrar os pontos.
     */

    if (maximo - minimo < 4) {

        const centro =
            (maximo + minimo) / 2;

        minimo =
            Math.floor(centro - 2);

        maximo =
            Math.ceil(centro + 2);
    }


    /*
     * Determina aproximadamente 5–7 divisões.
     */

    const faixaFinal =
        maximo - minimo;


    const passoBruto =
        faixaFinal / 6;


    const pot =
        Math.pow(
            10,
            Math.floor(
                Math.log10(
                    Math.max(passoBruto, 1)
                )
            )
        );


    const normalizado =
        passoBruto / pot;


    let passo;


    if (normalizado <= 1) {

        passo = 1 * pot;

    } else if (normalizado <= 2) {

        passo = 2 * pot;

    } else if (normalizado <= 5) {

        passo = 5 * pot;

    } else {

        passo = 10 * pot;
    }


    passo = Math.max(
        1,
        Math.round(passo)
    );


    minimo =
        Math.floor(minimo / passo) *
        passo;


    maximo =
        Math.ceil(maximo / passo) *
        passo;


    return {
        min: minimo,
        max: maximo,
        passo
    };
}


/* ============================================================
   CONVERTER PONTO PARA PIXEL
   ============================================================ */

function converterX(tempo, escala, larguraGrafico) {

    const proporcao =
        (tempo - escala.min) /
        (escala.max - escala.min);


    return (
        MARGEM.esquerda +
        proporcao * larguraGrafico
    );
}


function converterY(
    temperatura,
    escala,
    alturaGrafico
) {

    const proporcao =
        (temperatura - escala.min) /
        (escala.max - escala.min);


    return (
        MARGEM.superior +
        (
            1 - proporcao
        ) * alturaGrafico
    );
}


/* ============================================================
   DESENHAR GRÁFICO
   ============================================================ */

function desenharGrafico() {

    if (!canvas) {

        return;
    }


    const larguraCSS =
        graficoArea.clientWidth;


    const alturaCSS =
        graficoArea.clientHeight;


    if (
        larguraCSS <= 0 ||
        alturaCSS <= 0
    ) {

        return;
    }


    /*
     * Retina / telas de alta densidade.
     */

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


    canvas.style.width =
        `${larguraCSS}px`;


    canvas.style.height =
        `${alturaCSS}px`;


    ctx.setTransform(
        dpr,
        0,
        0,
        dpr,
        0,
        0
    );


    const largura =
        larguraCSS;


    const altura =
        alturaCSS;


    ctx.clearRect(
        0,
        0,
        largura,
        altura
    );


    /*
     * Fundo
     */

    ctx.fillStyle = "#ffffff";

    ctx.fillRect(
        0,
        0,
        largura,
        altura
    );


    /*
     * Área útil
     */

    const larguraGrafico =
        largura -
        MARGEM.esquerda -
        MARGEM.direita;


    const alturaGrafico =
        altura -
        MARGEM.superior -
        MARGEM.inferior;


    /*
     * Dados que realmente serão exibidos.
     */

    const dadosVisiveis =
        obterDadosVisiveis();


    /*
     * Dados para determinar a escala Y.
     */

    const dadosParaEscala =
        dadosVisiveis;


    const escalaX =
        obterEscalaX();


    const escalaY =
        obterEscalaY(
            dadosParaEscala
        );


    desenharGrade(
        larguraGrafico,
        alturaGrafico,
        escalaX,
        escalaY
    );


    desenharEixos(
        larguraGrafico,
        alturaGrafico,
        escalaX,
        escalaY
    );


    /*
     * Linha da cápsula 1
     */

    const pontos1 =
        obterPontosVisiveis(
            dadosCapsula1
        );


    /*
     * Linha da cápsula 2
     */

    const pontos2 =
        obterPontosVisiveis(
            dadosCapsula2
        );


    desenharSerie(
        pontos1,
        escalaX,
        escalaY,
        larguraGrafico,
        alturaGrafico,
        "#0A2E5C"
    );


    desenharSerie(
        pontos2,
        escalaX,
        escalaY,
        larguraGrafico,
        alturaGrafico,
        "#2EC4B6"
    );


    /*
     * Texto do eixo X
     */

    ctx.save();

    ctx.fillStyle = "#59636e";

    ctx.font =
        "12px Arial";

    ctx.textAlign = "center";

    ctx.textBaseline = "top";

    ctx.fillText(
        "Tempo (s)",
        MARGEM.esquerda +
        larguraGrafico / 2,
        altura - 28
    );

    ctx.restore();


    /*
     * Texto do eixo Y
     */

    ctx.save();

    ctx.fillStyle = "#59636e";

    ctx.font =
        "12px Arial";

    ctx.translate(
        17,
        MARGEM.superior +
        alturaGrafico / 2
    );

    ctx.rotate(-Math.PI / 2);

    ctx.textAlign = "center";

    ctx.textBaseline = "middle";

    ctx.fillText(
        "Temperatura (°C)",
        0,
        0
    );

    ctx.restore();


    /*
     * Caso não haja nenhum dado.
     */

    if (dadosVisiveis.length === 0) {

        ctx.save();

        ctx.fillStyle = "#98a2b3";

        ctx.font =
            "14px Arial";

        ctx.textAlign = "center";

        ctx.textBaseline = "middle";

        ctx.fillText(
            "Aguardando leituras do ESP32...",
            MARGEM.esquerda +
            larguraGrafico / 2,
            MARGEM.superior +
            alturaGrafico / 2
        );

        ctx.restore();
    }
}


/* ============================================================
   DADOS VISÍVEIS
   ============================================================ */

function obterDadosVisiveis() {

    if (mostrandoReprise) {

        const limite =
            tempoReprise;


        const dados = [];


        for (const ponto of dadosCapsula1) {
