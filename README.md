# Coleção Pokémon — Tracker

App web (PWA) para acompanhar sua coleção de cartas Pokémon: saber, **em cada set**,
quais cartas você **já tem** e quais **faltam**.

Sem instalação, sem servidor, sem login. Roda 100% no navegador e guarda seus dados
no próprio dispositivo (IndexedDB). Dá pra instalar como app no celular e usar offline.

## O que ele acompanha (regras da coleção)

Uma carta entra como **alvo** da sua coleção se atender a qualquer uma destas regras
(todas configuráveis em **Ajustes**):

1. **Raridades-chase** — `UR`, `IR`, `SIR`, `HR`/`MHR`, `MAR`.
   Os códigos são deduzidos automaticamente das raridades reais de cada set;
   você confirma quais valem em **Ajustes → Raridades descobertas**.
2. **Pokémon específicos** — todas as cartas de **Pikachu, Charmander, Squirtle e Bulbasaur**,
   em qualquer raridade ou set.
3. **Evoluções do bloco Mega Evolução** — cartas de evolução (Mega / Stage) dos sets
   do bloco atual. O app detecta o bloco automaticamente na lista de séries.

## Como usar

1. Abra o app (veja _Hospedar_ abaixo, ou rode localmente).
2. **Ver demo** — carrega cartas fictícias só pra você conhecer a interface sem rede.
3. **Sincronizar** — busca os sets na [TCGdex](https://tcgdex.dev). Os sets do bloco
   Mega Evolução já vêm marcados; marque também a opção de importar Pikachu/starters.
   Clique em **Importar selecionados** (a primeira vez baixa os detalhes das cartas
   e pode demorar — fica em cache depois).
4. Marque com **✓** as cartas que você tem. O progresso por set aparece no topo de cada seção.
5. Filtre por set, regra, raridade ou por **Faltam / Tenho**.
6. **Exportar / Importar** — faça backup do seu progresso em um arquivo `.json`
   (útil pra trocar de aparelho, já que os dados ficam no navegador).

## Dados

- Fonte: **TCGdex** (API pública, gratuita, com suporte a português e aos sets japoneses
  recentes do bloco Mega Evolução). A busca acontece no seu navegador.
- Nada é enviado para nenhum servidor nosso — não existe backend.
- O cache de cartas e o que você marcou como "tenho" ficam no IndexedDB do navegador.
  Limpar os dados do site apaga isso; por isso use **Exportar** para backup.

## Rodar localmente

Como usa ES Modules, precisa ser servido por HTTP (não abra o `index.html` via `file://`):

```bash
# qualquer servidor estático serve, por exemplo:
python3 -m http.server 8000
# depois abra http://localhost:8000
```

## Hospedar de graça (GitHub Pages)

Já existe um workflow em `.github/workflows/deploy-pages.yml`. Depois do merge na branch
padrão, ative o Pages em **Settings → Pages → Build and deployment → GitHub Actions**.
O site fica em `https://<seu-usuario>.github.io/<repo>/`.

## Estrutura

```
index.html            # shell da interface
styles.css            # estilos (tema escuro)
manifest.webmanifest  # PWA
sw.js                 # service worker (offline do app)
assets/icon.svg       # ícone (Poké Ball)
js/
  config.js           # regras/ajustes padrão + heurística de raridades
  api.js              # adaptador da TCGdex (fetch + concorrência)
  db.js               # IndexedDB (cache, coleção, backup)
  rules.js            # motor de regras (o que é "alvo" e por quê)
  demo.js             # dados fictícios para demonstração/offline
  app.js              # estado, sincronização e render
```

## Notas

- As raridades novas do bloco Mega (ex.: **MAR**, **MHR**) e as strings em português
  podem variar; por isso a classificação é ajustável em **Ajustes**, e você pode
  marcar/desmarcar qualquer raridade descoberta.
- "Evolução" no bloco Mega considera cartas com `evolveFrom` ou estágio diferente de
  básico (Mega, Stage 1/2). Dá pra desligar isso em **Ajustes** para contar o bloco inteiro.
