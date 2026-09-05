const ctx = document.getElementById("graficoTemperatura");

const grafico = new Chart(ctx, {
    type: "line",

    data: {
        labels: [],
        datasets: [
            {
                label: "Cápsula 1",
                data: [],
                tension: 0.3
            },
            {
                label: "Cápsula 2",
                data: [],
                tension: 0.3
            }
        ]
    },

    options: {
        responsive: true,
        maintainAspectRatio: false,

        animation: false,

        scales: {
            x: {
                title: {
                    display: true,
                    text: "Tempo (s)"
                }
            },

            y: {
                title: {
                    display: true,
                    text: "Temperatura (°C)"
                }
            }
        }
    }
});

let intervalo = null;
let tempo = 0;

let temperatura1 = 25;
let temperatura2 = 25;

function adicionarDados() {

    tempo++;

    // Simulação temporária das temperaturas
    temperatura1 += 0.08 + (Math.random() - 0.5) * 0.08;
    temperatura2 += 0.04 + (Math.random() - 0.5) * 0.08;

    grafico.data.labels.push(tempo);

    grafico.data.datasets[0].data.push(temperatura1);
    grafico.data.datasets[1].data.push(temperatura2);

    // Mantém somente os últimos 60 segundos visíveis
    if (grafico.data.labels.length > 60) {
        grafico.data.labels.shift();
        grafico.data.datasets[0].data.shift();
        grafico.data.datasets[1].data.shift();
    }

    grafico.update();

    document.getElementById("temp1").textContent =
        temperatura1.toFixed(2) + " °C";

    document.getElementById("temp2").textContent =
        temperatura2.toFixed(2) + " °C";
}

document.getElementById("iniciar").addEventListener("click", () => {

    if (intervalo !== null) {
        return;
    }

    document.getElementById("status").textContent =
        "Experimento em andamento...";

    intervalo = setInterval(adicionarDados, 1000);
});

document.getElementById("parar").addEventListener("click", () => {

    clearInterval(intervalo);

    intervalo = null;

    document.getElementById("status").textContent =
        "Experimento finalizado.";
});
