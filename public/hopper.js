// ============================================================
// NOBRE CIÊNCIA — PÁGINA GRACE HOPPER
// Simulador de compilação e execução do programa em C
// ============================================================

(function () {
    "use strict";


    // ========================================================
    // CÓDIGO EM C EXIBIDO NO EDITOR
    // Este é o código do grupo (analise.c). Se mudar o programa, atualize
    // também a lógica logo abaixo (cabecalho e resumo), que gera a saída.
    // ========================================================

    const CODIGO = String.raw`#include<stdio.h>
#include<stdlib.h>
#include<time.h>
#include<unistd.h>

#define LINHAS 5
#define INSTRUCOES 5
#define NUM_TIPOS 8

//Atribuir palavras-chave e erros para os índices
const char *PALAVRAS[NUM_TIPOS] = {
    "Vazio", "int", "float", "Erro de tipo", "if", "Erro de sintaxe", "return", "for"
};

//Definir quais índices são erros
const int ERROS[NUM_TIPOS] = {0, 0, 0, 1, 0, 1, 0, 0};

int main(){
    int codigo_tokens[LINHAS][INSTRUCOES];
    int contador[NUM_TIPOS] = {0};
    int soma_repeticoes = 0;

    //Tabela de palavras-chave
    printf("Codigos: \n");
    for(int i = 0; i < NUM_TIPOS; i++){
        printf("%d = %s\n", i, PALAVRAS[i]);
    }
    printf("\n");

    //rand para obter as instruções
    srand(time(NULL));
    printf("Recebendo os valores das instruções na matriz: \n");
    for(int i = 0; i < LINHAS; i++){
        for(int j = 0; j < INSTRUCOES; j++){
            codigo_tokens[i][j] = rand() % 8;
            printf("%d ",codigo_tokens[i][j]);
            fflush(stdout);
            sleep(1);
        }
        printf("\n");
    }
    printf("\n");

    //Laços aninhados que verificam a quantidade de instruções e de repetições em cada etapa
    for(int i = 0; i < LINHAS; i++){
        int cont_convertidas = 0;
        int repeticoes = 0;
        for(int j = 0; j < INSTRUCOES; j++){
            int t = codigo_tokens[i][j];
            contador[t]++;
            if(t != 0)
                cont_convertidas++;
            if(j > 0 && t == codigo_tokens[i][j-1] && t != 0)
                repeticoes++;
        }
        soma_repeticoes += repeticoes;
        printf("Etapa %d: %d instruções, %d repetições\n", i + 1, cont_convertidas, repeticoes);
    }
    printf("Total de repetições: %d", soma_repeticoes);

    printf("\n\nOcorrências de palavras-chave: \n\n");
    for(int i = 1; i < NUM_TIPOS; i++){
        if(ERROS[i] == 0){
            printf("%s: %d ocorrências\n", PALAVRAS[i], contador[i]);
        }
    }

    printf("\nOcorrências de erros: \n\n");
    for(int i = 1; i < NUM_TIPOS; i++){
        if(ERROS[i] == 1){
            printf("%s: %d ocorrências\n", PALAVRAS[i], contador[i]);
        }
    }

    return 0;
}`;

    // Lógica do programa em C, reproduzida aqui para gerar a saída na hora.
    // Os valores são sorteados a cada execução (como rand() no C).
    // Tempo entre os números (o sleep(1) do C). Use 1000 para ficar igual ao programa.
    const PAUSA_SLEEP_MS = 400;

    // <<LOGICA
    const LINHAS = 5, INSTRUCOES = 5, NUM_TIPOS = 8;

    const PALAVRAS = ["Vazio", "int", "float", "Erro de tipo", "if", "Erro de sintaxe", "return", "for"];
    const ERROS    = [0, 0, 0, 1, 0, 1, 0, 0];

    function cabecalho() {
        const l = ["Codigos: "];
        for (let i = 0; i < NUM_TIPOS; i++) l.push(i + " = " + PALAVRAS[i]);
        l.push("");
        l.push("Recebendo os valores das instruções na matriz: ");
        return l;
    }

    function resumo(m) {
        const saida = [];
        const contador = new Array(NUM_TIPOS).fill(0);
        let somaRepeticoes = 0;

        for (let i = 0; i < LINHAS; i++) {
            let contConvertidas = 0;
            let repeticoes = 0;
            for (let j = 0; j < INSTRUCOES; j++) {
                const t = m[i][j];
                contador[t]++;
                if (t !== 0) contConvertidas++;
                if (j > 0 && t === m[i][j - 1] && t !== 0) repeticoes++;
            }
            somaRepeticoes += repeticoes;
            saida.push("Etapa " + (i + 1) + ": " + contConvertidas + " instruções, " + repeticoes + " repetições");
        }

        saida.push("Total de repetições: " + somaRepeticoes);
        saida.push("", "Ocorrências de palavras-chave: ", "");
        for (let i = 1; i < NUM_TIPOS; i++) {
            if (ERROS[i] === 0) saida.push(PALAVRAS[i] + ": " + contador[i] + " ocorrências");
        }

        saida.push("", "Ocorrências de erros: ", "");
        for (let i = 1; i < NUM_TIPOS; i++) {
            if (ERROS[i] === 1) saida.push(PALAVRAS[i] + ": " + contador[i] + " ocorrências");
        }
        return saida;
    }
    // LOGICA>>

    const NOME_FONTE = "analise.c";
    const NOME_EXE   = "analise.exe";


    // ========================================================
    // UTILIDADES
    // ========================================================

    const $ = function (id) { return document.getElementById(id); };
    const esperar = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
    const reduzir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ritmo = function (ms) { return reduzir ? Math.min(ms, 8) : ms; };

    function escapar(s) {
        return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }


    // ========================================================
    // REALCE DE SINTAXE (C)
    // ========================================================

    function realcar(src) {
        const re = /(\/\*[\s\S]*?\*\/|\/\/[^\n]*)|("(?:\\.|[^"\\])*")|(^#.*$)|\b(int|void|const|char|double|float)\b|\b(for|return|if|else|while)\b|\b(\d+(?:\.\d+)?)\b|\b([A-Z][A-Z0-9_]{2,})\b|\b([a-zA-Z_]\w*)(?=\()/gm;

        return escapar(src).replace(re, function (m, com, str, pre, tipo, kw, num, mac, fn) {
            if (com)  return '<span class="tk-c">' + com.split("\n").join('</span>\n<span class="tk-c">') + "</span>";
            if (str)  return '<span class="tk-s">' + str + "</span>";
            if (pre)  return '<span class="tk-p">' + pre + "</span>";
            if (tipo) return '<span class="tk-t">' + tipo + "</span>";
            if (kw)   return '<span class="tk-k">' + kw + "</span>";
            if (num)  return '<span class="tk-n">' + num + "</span>";
            if (mac)  return '<span class="tk-m">' + mac + "</span>";
            if (fn)   return '<span class="tk-f">' + fn + "</span>";
            return m;
        });
    }


    // ========================================================
    // ELEMENTOS
    // ========================================================

    const fonte   = $("codigo-fonte");
    const term    = $("term");
    const status  = $("ideStatus");
    const editor  = fonte ? fonte.parentElement : null;
    const btnCompilar = $("btnCompilar");
    const btnExecutar = $("btnExecutar");
    const btnTudo     = $("btnTudo");
    const btnLimpar   = $("btnLimpar");

    let ocupado = false;
    let compilado = false;


    // ========================================================
    // EDITOR
    // ========================================================

    function montarEditor() {
        if (!fonte) return;
        const linhas = realcar(CODIGO).split("\n");

        fonte.innerHTML = linhas.map(function (html, i) {
            return '<div class="ln"><span class="n">' + (i + 1) + '</span><span class="c">' +
                   (html === "" ? " " : html) + "</span></div>";
        }).join("");

        const info = $("ideLinhas");
        if (info) info.textContent = linhas.length + " linhas";
    }

    function limparMarcas() {
        if (!fonte) return;
        fonte.querySelectorAll(".ln").forEach(function (l) {
            l.classList.remove("varrendo", "concluida");
        });
    }

    function manterVisivel(linha) {
        if (!editor) return;
        const topo = linha.offsetTop;
        const base = topo + linha.offsetHeight;
        if (base > editor.scrollTop + editor.clientHeight - 24) {
            editor.scrollTop = base - editor.clientHeight + 48;
        } else if (topo < editor.scrollTop) {
            editor.scrollTop = Math.max(0, topo - 24);
        }
    }


    // ========================================================
    // TERMINAL
    // ========================================================

    function escrever(texto, classe, prompt) {
        const d = document.createElement("div");
        d.className = "t " + (classe || "t-info") + (prompt ? " t-prompt" : "");
        d.textContent = texto === "" ? "\u00A0" : texto;
        term.appendChild(d);
        term.scrollTop = term.scrollHeight;
        return d;
    }

    function definirStatus(texto, tipo) {
        if (!status) return;
        status.textContent = texto;
        status.className = "ide-status" + (tipo ? " " + tipo : "");
    }

    function travar(sim) {
        [btnCompilar, btnExecutar, btnTudo, btnLimpar].forEach(function (b) {
            if (b) b.disabled = sim;
        });
    }

    function mensagemInicial() {
        term.innerHTML = "";
        escrever("Clique em “Compilar e Executar” para ver o programa em ação.", "t-dim");
    }


    // ========================================================
    // COMPILAR
    // ========================================================

    async function compilar() {
        compilado = false;
        limparMarcas();
        term.innerHTML = "";
        definirStatus("Compilando…", "ocupado");

        escrever("Compilador: GCC (padrão C99)", "t-dim");
        escrever("gcc " + NOME_FONTE + " -o " + NOME_EXE + " -Wall -Wextra", "t-cmd", true);
        await esperar(ritmo(450));

        const linhas = fonte.querySelectorAll(".ln");
        const etapas = ["Pré-processando", "Compilando", "Montando", "Ligando"];
        const barra = escrever("", "t-info");
        const total = linhas.length;

        for (let i = 0; i < total; i++) {
            if (i > 0) {
                linhas[i - 1].classList.remove("varrendo");
                linhas[i - 1].classList.add("concluida");
            }
            linhas[i].classList.add("varrendo");
            manterVisivel(linhas[i]);

            const pct = Math.round(((i + 1) / total) * 100);
            const cheios = Math.round(pct / 5);
            const etapa = etapas[Math.min(etapas.length - 1, Math.floor(pct / 25.01))];

            barra.textContent =
                "[" + "█".repeat(cheios) + "░".repeat(20 - cheios) + "] " +
                String(pct).padStart(3, " ") + "%  " + etapa + "…";

            await esperar(ritmo(45));
        }

        linhas[total - 1].classList.remove("varrendo");
        linhas[total - 1].classList.add("concluida");
        if (editor) editor.scrollTop = 0;

        await esperar(ritmo(250));
        escrever("", "t-dim");
        escrever("Resultados da compilação:", "t-info");
        await esperar(ritmo(120));
        escrever("--------", "t-dim");
        escrever("- Erros: 0", "t-ok");
        await esperar(ritmo(120));
        escrever("- Avisos: 0", "t-ok");
        await esperar(ritmo(120));
        escrever("- Arquivo de saída: " + NOME_EXE, "t-info");
        await esperar(ritmo(200));
        escrever("Compilação concluída com sucesso.", "t-ok");

        compilado = true;
        definirStatus("Compilado com sucesso", "sucesso");
        return true;
    }


    // ========================================================
    // EXECUTAR
    // ========================================================

    async function executar() {
        if (!compilado) {
            escrever("Erro: compile o programa antes de executar.", "t-erro");
            definirStatus("Compile primeiro", "erro");
            return false;
        }

        definirStatus("Executando…", "ocupado");
        escrever("", "t-dim");
        escrever(NOME_EXE, "t-cmd", true);
        await esperar(ritmo(600));

        // Tabela de palavras-chave
        const cab = cabecalho();
        for (let i = 0; i < cab.length; i++) {
            escrever(cab[i], "t-saida");
            await esperar(ritmo(110));
        }

        // rand() + printf + fflush + sleep: um número por vez
        const matriz = [];
        for (let i = 0; i < LINHAS; i++) {
            const linha = [];
            matriz.push(linha);
            const el = escrever("", "t-saida");
            let texto = "";
            for (let j = 0; j < INSTRUCOES; j++) {
                const v = Math.floor(Math.random() * NUM_TIPOS);
                linha.push(v);
                texto += v + " ";
                el.textContent = texto;
                term.scrollTop = term.scrollHeight;
                await esperar(ritmo(PAUSA_SLEEP_MS));
            }
        }
        escrever("", "t-saida");
        await esperar(ritmo(250));

        // Laços aninhados: contagem de instruções, repetições e ocorrências
        const res = resumo(matriz);
        for (let i = 0; i < res.length; i++) {
            escrever(res[i], "t-saida");
            await esperar(ritmo(110));
        }

        await esperar(ritmo(300));
        escrever("", "t-dim");
        escrever("--------------------------------", "t-dim");
        escrever("Processo finalizado com valor de retorno 0", "t-ok");
        escrever("Pressione qualquer tecla para continuar . . .", "t-dim");

        definirStatus("Executado (retorno 0)", "sucesso");
        return true;
    }


    // ========================================================
    // BOTÕES
    // ========================================================

    async function rodar(tarefa) {
        if (ocupado) return;
        ocupado = true;
        travar(true);
        try { await tarefa(); }
        finally { ocupado = false; travar(false); }
    }

    if (btnCompilar) btnCompilar.addEventListener("click", function () { rodar(compilar); });
    if (btnExecutar) btnExecutar.addEventListener("click", function () { rodar(executar); });

    if (btnTudo) btnTudo.addEventListener("click", function () {
        rodar(async function () {
            if (await compilar()) await executar();
        });
    });

    if (btnLimpar) btnLimpar.addEventListener("click", function () {
        if (ocupado) return;
        compilado = false;
        limparMarcas();
        mensagemInicial();
        definirStatus("Pronto", "");
    });

    if (fonte && term) {
        montarEditor();
        mensagemInicial();
    }


    // ========================================================
    // PÁGINA: revelar ao rolar, progresso e menu
    // ========================================================

    const doc = document, raiz = doc.documentElement;
    raiz.classList.add("js");

    const alvos = doc.querySelectorAll(".secao-cab, .grace-grid, .filme, .ide, .ide-nota");
    alvos.forEach(function (el) { el.classList.add("reveal"); });

    if (reduzir || !("IntersectionObserver" in window)) {
        alvos.forEach(function (el) { el.classList.add("visivel"); });
    } else {
        const io = new IntersectionObserver(function (itens) {
            itens.forEach(function (i) {
                if (i.isIntersecting) { i.target.classList.add("visivel"); io.unobserve(i.target); }
            });
        }, { threshold: 0.1, rootMargin: "0px 0px -6% 0px" });
        alvos.forEach(function (el) { io.observe(el); });
    }

    const barra = doc.querySelector(".progresso");
    const menu = doc.querySelector(".nav");
    let aguardando = false;

    function atualizar() {
        const total = raiz.scrollHeight - window.innerHeight;
        if (barra) barra.style.transform = "scaleX(" + (total > 0 ? window.scrollY / total : 0) + ")";
        if (menu) menu.classList.toggle("rolou", window.scrollY > 30);
        aguardando = false;
    }

    window.addEventListener("scroll", function () {
        if (!aguardando) { aguardando = true; requestAnimationFrame(atualizar); }
    }, { passive: true });
    atualizar();

    if ("IntersectionObserver" in window) {
        const links = {};
        doc.querySelectorAll('.nav-links a[href^="#"]').forEach(function (a) {
            links[a.getAttribute("href").slice(1)] = a;
        });
        const so = new IntersectionObserver(function (itens) {
            itens.forEach(function (i) {
                if (i.isIntersecting) {
                    Object.keys(links).forEach(function (k) {
                        links[k].classList.toggle("ativo", k === i.target.id);
                    });
                }
            });
        }, { rootMargin: "-40% 0px -55% 0px" });
        Object.keys(links).forEach(function (id) {
            const s = doc.getElementById(id);
            if (s) so.observe(s);
        });
    }

})();
