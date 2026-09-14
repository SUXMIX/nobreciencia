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
         *
         * Mantido para compatibilidade com o método HTTP antigo.
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
         * WebSocket
         *
         * Usado pelo ESP32 e pelo navegador.
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
         * Solicitação de WebSocket
         *
         * Tanto o ESP32 quanto o navegador
         * podem estabelecer uma conexão aqui.
         */

        if (
            request.headers.get("Upgrade") === "websocket"
        ) {

            const pair = new WebSocketPair();

            const client = pair[0];
            const server = pair[1];


            /*
             * Aceita a conexão no Durable Object
             */

            this.ctx.acceptWebSocket(server);


            return new Response(null, {

                status: 101,

                webSocket: client
            });
        }


        /*
         * Receber temperatura pelo método HTTP
         *
         * Mantido para compatibilidade com
         * o sistema anterior.
         */

        if (
            url.pathname === "/temperatura" &&
            request.method === "POST"
        ) {

            const dados = await request.json();


            console.log(
                "Temperatura recebida via HTTP:",
                dados
            );


            /*
             * Transformar os dados em JSON
             */

            const mensagem =
                JSON.stringify(dados);


            /*
             * Enviar para todos os WebSockets
             * conectados.
             */

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


            /*
             * Resposta HTTP
             */

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


    /*
     * Mensagem recebida através do WebSocket
     *
     * Agora o ESP32 pode enviar diretamente
     * a temperatura pelo WebSocket.
     */

    webSocketMessage(websocket, mensagem) {


        console.log(
            "Mensagem recebida pelo WebSocket:",
            mensagem
        );


        /*
         * Repassar a mensagem para os outros
         * WebSockets conectados.
         *
         * Assim:
         *
         * ESP32
         *   ↓
         * Worker
         *   ↓
         * navegador
         */

        for (
            const cliente
            of this.ctx.getWebSockets()
        ) {


            /*
             * Não envia novamente para o próprio
             * dispositivo que enviou a mensagem.
             */

            if (cliente === websocket) {
                continue;
            }


            try {

                cliente.send(mensagem);

            } catch (erro) {

                console.log(
                    "Erro ao encaminhar mensagem:",
                    erro
                );

            }
        }
    }


    /*
     * WebSocket fechado
     */

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
