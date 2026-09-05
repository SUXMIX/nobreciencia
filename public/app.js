const canvas = document.getElementById("graficoTemperatura");
const ctx = canvas.getContext("2d");

let dados1 = [];
let dados2 = [];
let tempo = 0;
let intervalo = null;

function ajustarCanvas() {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    desenharGrafico();
}

function desenharGrafico() {
    const largura = canvas.width;
    const altura = canvas.height;

    ctx.clearRect(0, 0, largura, altura);

    // Fundo
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0,
