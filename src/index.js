export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        // Teste do backend
        if (url.pathname === "/api/teste") {
            return new Response(
                JSON.stringify({
                    status: "ok",
                    mensagem: "Cloudflare Worker funcionando!"
                }),
                {
                    headers: {
                        "Content-Type": "application/json"
                    }
                }
            );
        }

        // Receber temperatura do ESP32
        if (url.pathname === "/api/temperatura" && request.method === "POST") {
            
            const dados = await request.json();

            console.log("Temperatura recebida:", dados);

            return new Response(
                JSON.stringify({
                    recebido: true,
                    dados: dados
                }),
                {
                    headers: {
                        "Content-Type": "application/json"
                    }
                }
            );
        }

        // Qualquer outra requisição:
        // entrega os arquivos da pasta public
        return env.ASSETS.fetch(request);
    }
};
