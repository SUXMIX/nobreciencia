import { DurableObject } from "cloudflare:workers";

export default {
    async fetch(request, env) {

        const url = new URL(request.url);

        /*
         * Teste do backend
         */
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


        /*
         * Receber temperatura do ESP32
         */
        if (
            url.pathname === "/api/temperatura" &&
            request.method === "POST"
        ) {

            const id =
                env.EXPERIMENTO.idFromName("principal");

            const stub =
                env.EXPERIMENTO.get(id);

            return stub.fetch(
                new Request(
                    "https://experimento/temperatura",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: await request.text()
                    }
                )
            );
        }


        /*
         * WebSocket para o navegador
         */
        if (
            url.pathname === "/api/ws" &&
            request.headers.get("Upgrade") === "websocket"
        ) {

            const id =
                env.EXPERIMENTO.idFromName("principal");

            const stub =
                env.EXPERIMENTO.get(id);

            return stub.fetch(request);
        }


        /*
         * Entregar o site
         */
        return env.ASSETS.fetch(request);
    }
};


/*
 * Durable Object
 */

export class ExperimentoDO extends DurableObject {

    async fetch(request) {

        const url = new URL(request.url);


        /*
         * Navegador solicita WebSocket
         */

        if (
            request.headers.get("Upgrade") === "websocket"
        ) {

            const pair = new WebSocketPair();

            const client = pair[0];
            const server = pair[1];

            this.ctx.acceptWebSocket(server);

            return new Response(null, {
                status: 101,
                webSocket: client
            });
        }


        /*
         * Receber temperatura do ESP32
         */

        if (
            url.pathname === "/temperatura" &&
            request.method === "POST"
        ) {

            const dados = await request.json();

            console.log(
                "Temperatura recebida:",
                dados
            );


            /*
             * Enviar para todos os navegadores conectados
             */

            const mensagem =
                JSON.stringify(dados);

            for (
                const websocket
                of this.ctx.getWebSockets()
            ) {

                try {

                    websocket.send(mensagem);

                } catch (erro) {

                    console.log(
                        "Erro ao enviar WebSocket:",
                        erro
                    );

                }
            }


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


        return new Response("OK");
    }


    webSocketMessage(websocket, mensagem) {

        console.log(
            "Mensagem recebida do navegador:",
            mensagem
        );

    }


    webSocketClose(
        websocket,
        code,
        reason,
        wasClean
    ) {

        console.log(
            "WebSocket fechado."
        );

    }
}
