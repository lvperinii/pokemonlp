# Coleção Megaevolução — o que falta

App web (PWA) para acompanhar a coleção de cartas do bloco **Megaevolução**:
saber, **em cada set**, quais cartas você **já tem** e quais **faltam** comprar.

Abre já mostrando a lista do que falta (por set, com imagem), sem precisar
sincronizar nada. O que você marca como "tenho" fica salvo no próprio navegador.

🔗 **Online:** https://lvperinii.github.io/pokemonlp/

## O que ele acompanha

As cartas-alvo do bloco Megaevolução (série `me` da TCGdex), filtradas por:

1. **Raridades-chase** — `UR` (Ultra Rara), `IR` (Ilustração Rara),
   `SIR` (Ilustração Rara Especial) e `MHR` (Mega Hiper Raro).
2. **Cartas Mega** — todas as cartas de Megaevolução (nome "Mega …").
3. **Pikachu, Charmander, Squirtle e Bulbasaur** que aparecem no bloco.

> Observação: a TCGdex não separa as raridades **MAR** (Mega Attack Rare) nem
> um **HR** "dourado" à parte neste bloco — a raridade-topo aqui é a **MHR**.

## Como usar

1. Abra o app (link acima) ou rode localmente (veja abaixo).
2. A tela já mostra **o que falta em cada set**. Use os filtros (set, raridade,
   regra, ou Faltam/Tenho/Todos) e a busca.
3. Clique no **+** de uma carta para marcar que você já tem (vira ✓).
4. Clique na carta para ver a arte grande e o botão **Comprar na Liga Pokémon**.
5. **Exportar / Importar** faz backup do seu progresso em `.json`
   (os dados ficam no navegador; use para trocar de aparelho).

## De onde vêm os dados

- Fonte: **TCGdex** (API pública, em português, com imagens das cartas).
- O arquivo `data/targets.json` é **gerado no GitHub Actions** pelo script
  `scripts/build-data.mjs` (que busca o bloco na TCGdex, classifica as
  raridades e monta a lista de alvos) e commitado no repositório.
- Atualiza automaticamente toda semana (e sob demanda) pelo workflow
  **Atualizar dados (Megaevolução)** — rode-o manualmente em *Actions* quando
  sair um set novo.
- Nada é enviado para nenhum servidor nosso: o que você marca fica só no seu
  navegador (localStorage).

## Rodar localmente

O jeito mais fácil (abre o navegador sozinho):

- **Windows:** duplo-clique em `start.bat`
- **macOS / Linux:** `./start.sh`
- **npm:** `npm start` — ou **Node:** `node server.js`

Abre em http://localhost:8000. (Precisa ser via HTTP — não abra o `index.html`
direto pelo `file://`.)

## Estrutura

```
index.html            # interface
styles.css            # estilos (tema escuro)
manifest.webmanifest  # PWA
sw.js                 # service worker (offline)
server.js             # servidor local sem dependências
start.sh / start.bat  # atalhos para rodar localmente
assets/icon.svg       # ícone (Poké Ball)
data/targets.json     # cartas-alvo (gerado da TCGdex)
js/app.js             # app: carrega os dados, filtra, marca tenho/faltam
scripts/build-data.mjs           # gerador dos dados (roda no CI)
.github/workflows/build-data.yml # gera e commita os dados
.github/workflows/deploy-pages.yml # publica no GitHub Pages
```
