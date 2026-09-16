import { DurableObject } from "cloudflare:workers";


// ============================================================
// WORKER PRINCIPAL
// ============================================================

export default {

    async fetch(request, env, ctx) {

        const url = new URL(request.url);


        // ----------------------------------------------------
        // TESTE
        // ----------------------------------------------------

        if (
            request.method === "GET" &&
            url.pathname === "/api/teste"
        ) {

            return new Response(
                JSON.stringify({
                    ok: true,
                    mensagem: "Worker funcionando",
                    horario: new Date().toISOString()
                }),
                {
                    status: 200,
                    headers: {
                        "Content-Type": "application/json"
                    }
                }
            );
        }


        // ----------------------------------------------------
        // RECEBER TEMPERATURA DO ESP32
        // ----------------------------------------------------

        if (
            request.method === "POST" &&
            url.pathname === "/api/temperatura"
        ) {

            try {

                const texto =
                    await request.text();

                console.log(
                    "Temperatura recebida do ESP32:",
                    texto
                );


                // Verificar se é JSON válido.
                let dados;

                try {

                    dados = JSON.parse(texto);

                } catch (erro) {

                    return new Response(
                        JSON.stringify({
                            ok: false,
                            erro: "JSON inválido"
                        }),
                        {
                            status: 400,
                            headers: {
                                "Content-Type":
                                    "application/json"
                            }
                        }
                    );
                }


                // ------------------------------------------------
                // VALIDAR TEMPERATURA
                // ------------------------------------------------

                let temperatura =
                    Number(dados.temperatura);

                if (!Number.isFinite(temperatura)) {

                    return new Response(
                        JSON.stringify({
                            ok: false,
                            erro:
                                "Campo temperatura inválido"
                        }),
                        {
                            status: 400,
                            headers: {
                                "Content-Type":
                                    "application/json"
                            }
                        }
                    );
                }


                // Normaliza o objeto.
                const resposta = {
                    temperatura: temperatura,
                    tempo:
                        dados.tempo !== undefined
                            ? dados.tempo
                            : Date.now()
                };


                // ------------------------------------------------
                // ENVIAR PARA DURABLE OBJECT
                // ------------------------------------------------

                const id =
                    env.EXPERIMENTO.idFromName(
                        "experimento-principal"
                    );

                const stub =
                    env.EXPERIMENTO.get(id);


                const novaRequest =
                    new Request(
                        "https://durable-object/temperatura",
                        {
                            method: "POST",
                            headers: {
                                "Content-Type":
                                    "application/json"
                            },
                            body:
                                JSON.stringify(resposta)
                        }
                    );


                const respostaDO =
                    await stub.fetch(
                        novaRequest
                    );


                return new Response(
                    JSON.stringify({
                        ok: true,
                        dados: resposta
                    }),
                    {
                        status: 200,
                        headers: {
                            "Content-Type":
                                "application/json"
                        }
                    }
                );

            } catch (erro) {

                console.error(
                    "Erro ao processar temperatura:",
                    erro
                );

                return new Response(
                    JSON.stringify({
                        ok: false,
                        erro:
                            "Erro interno ao processar temperatura"
                    }),
                    {
                        status: 500,
                        headers: {
                            "Content-Type":
                                "application/json"
                        }
                    }
                );
            }
        }


        // ----------------------------------------------------
        // WEBSOCKET
        // ----------------------------------------------------

        if (
            request.method === "GET" &&
            url.pathname === "/api/ws"
        ) {

            if (
                request.headers.get("Upgrade")
                    ?.toLowerCase() !== "websocket"
            ) {

                return new Response(
                    JSON.stringify({
                        ok: false,
                        erro:
                            "Esta rota exige WebSocket"
                    }),
                    {
                        status: 426,
                        headers: {
                            "Content-Type":
                                "application/json"
                        }
                    }
                );
            }


            const id =
                env.EXPERIMENTO.idFromName(
                    "experimento-principal"
                );

            const stub =
                env.EXPERIMENTO.get(id);


            return stub.fetch(
                new Request(
                    "https://durable-object/ws",
                    request
                )
            );
        }


        // ----------------------------------------------------
        // ARQUIVOS ESTÁTICOS
        // ----------------------------------------------------

        return env.ASSETS.fetch(request);
    }
};


// ============================================================
// DURABLE OBJECT
// ============================================================

export class ExperimentoDO extends DurableObject {

    constructor(ctx, env) {

        super(ctx, env);

        this.env = env;
    }


    // ========================================================
    // FETCH DO DURABLE OBJECT
    // ========================================================

    async fetch(request) {

        const url =
            new URL(request.url);


        // ----------------------------------------------------
        // WEBSOCKET
        // ----------------------------------------------------

        if (
            url.pathname === "/ws" &&
            request.headers.get("Upgrade")
                ?.toLowerCase() === "websocket"
        ) {

            const par =
                new WebSocketPair();

            const cliente =
                par[0];

            const servidor =
                par[1];


            // API de WebSocket Hibernation.
            this.ctx.acceptWebSocket(
                servidor
            );


            console.log(
                "Novo cliente WebSocket conectado."
            );


            return new Response(
                null,
                {
                    status: 101,
                    webSocket: cliente
                }
            );
        }


        // ----------------------------------------------------
        // TEMPERATURA
        // ----------------------------------------------------

        if (
            request.method === "POST" &&
            url.pathname === "/temperatura"
        ) {

            try {

                const texto =
                    await request.text();

                console.log(
                    "Durable Object recebeu:",
                    texto
                );


                // Repassar exatamente o JSON recebido.
                this.broadcast(texto);


                return new Response(
                    JSON.stringify({
                        ok: true
                    }),
                    {
                        status: 200,
                        headers: {
                            "Content-Type":
                                "application/json"
                        }
                    }
                );

            } catch (erro) {

                console.error(
                    "Erro no Durable Object:",
                    erro
                );

                return new Response(
                    JSON.stringify({
                        ok: false,
                        erro:
                            "Erro ao transmitir temperatura"
                    }),
                    {
                        status: 500,
                        headers: {
                            "Content-Type":
                                "application/json"
                        }
                    }
                );
            }
        }


        return new Response(
            "Not Found",
            {
                status: 404
            }
        );
    }


    // ========================================================
    // RECEBER MENSAGEM DE UM WEBSOCKET
    // ========================================================

    async webSocketMessage(
        websocket,
        mensagem
    ) {

        console.log(
            "Mensagem recebida pelo WebSocket:",
            mensagem
        );


        // Repassar para todos os outros clientes.
        this.broadcast(
            mensagem,
            websocket
        );
    }


    // ========================================================
    // FECHAMENTO
    // ========================================================

    async webSocketClose(
        websocket,
        code,
        reason,
        wasClean
    ) {

        console.log(
            "WebSocket fechado:",
            code,
            reason
        );
    }


    // ========================================================
    // ERRO
    // ========================================================

    async webSocketError(
        websocket,
        error
    ) {

        console.error(
            "Erro no WebSocket:",
            error
        );
    }


    // ========================================================
    // TRANSMITIR PARA OS CLIENTES
    // ========================================================

    broadcast(
        mensagem,
        remetente = null
    ) {

        const sockets =
            this.ctx.getWebSockets();


        console.log(
            "Clientes conectados:",
            sockets.length
        );


        for (const socket of sockets) {

            // Se houver remetente, não enviar
            // novamente para ele.
            if (
                remetente &&
                socket === remetente
            ) {
                continue;
            }


            try {

                socket.send(mensagem);

            } catch (erro) {

                console.error(
                    "Erro ao enviar WebSocket:",
                    erro
                );
            }
        }
    }
}
